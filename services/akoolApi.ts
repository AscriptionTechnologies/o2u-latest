// AkoolService.ts

import { convertGoogleDriveUrl, getSafeImageUrl } from '~/utils/imageUtils';
import { supabase } from '~/utils/supabase';

export interface FaceSwapRequest {
  userImageUrl: string;
  productImageUrl: string;
  userId: string;
  productId: string;
}

export interface FaceSwapTaskStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultImages?: string[];
  error?: string;
}

class AkoolService {
  private clientId: string;
  private clientSecret: string;
  private token: string | null = null;

  private baseUrl: string = 'https://openapi.akool.com/api/open/v3';

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /** Get or refresh token */
  private async getToken(): Promise<string> {
    if (this.token) return this.token;

    const resp = await fetch(`${this.baseUrl}/getToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      }),
    });

    const json = await resp.json();
    if (json.code !== 1000) {
      throw new Error(`Token request failed: ${json.msg || json.code}`);
    }

    this.token = json.token;
    return this.token;
  }

  /** Detect face to get opts (landmarks) */
  private async detectFace(imageUrl: string): Promise<string> {
    const token = await this.getToken();

    // Fix Google Drive URL if needed
    console.log('TOken :', token);
    const processedUrl = this.fixGoogleDriveUrl(imageUrl);

    const resp = await fetch('https://sg3.akool.com/detect', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        single_face: true,
        image_url: processedUrl,
      }),
    });

    const json = await resp.json();
    console.log('Detection response:', json);

    if (json.error_code !== 0 || !json.landmarks_str?.length) {
      throw new Error(`Face detection failed: ${json.error_msg || JSON.stringify(json)}`);
    }

    return json.landmarks_str;
  }

  private fixGoogleDriveUrl(url: string): string {
    if (url.includes('drive.google.com')) {
      const uri = convertGoogleDriveUrl(url);
      console.log('uri :', uri);
      return uri;
    }
    return url;
  }

  /** Start face swap */
  private async startFaceSwap(
    productImage: string,
    targetOpts: string,
    userImage: string,
    sourceOpts: string
  ): Promise<{ _id: string; job_id: string; url: string }> {
    const token = await this.getToken();

    const requestBody = {
      sourceImage: [
        {
          path: userImage,
          opts: sourceOpts, // Direct object/array, not stringified
        },
      ],
      targetImage: [
        {
          path: productImage,
          opts: targetOpts, // Direct object/array, not stringified
        },
      ],
      face_enhance: 1,
      modifyImage: productImage,
      // webhookUrl: "your-webhook-url" // Optional: add if you have webhook
    };

    console.log('Sending to Akool API:', JSON.stringify(requestBody, null, 2));

    const resp = await fetch(`${this.baseUrl}/faceswap/highquality/specifyimage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const json = await resp.json();
    console.log('Akool API response:', json);

    if (json.code !== 1000) {
      throw new Error(`Face swap failed: ${json.msg} (code: ${json.code})`);
    }

    return json.data;
  }

  /** Poll result status */
  private async checkStatus(
    jobId: string
  ): Promise<{ status: 'processing' | 'completed' | 'failed'; url?: string }> {
    const token = await this.getToken();
    try {
      const myHeaders = new Headers();
      myHeaders.append('Authorization', `Bearer ${token}`);

      const requestOptions = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow',
      };
      const resp = await fetch(`${this.baseUrl}/faceswap/result/listbyids?_ids=${jobId}`, {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow',
      });

      const json = await resp.json();
      console.log('resoonse :', json);
      if (json.code !== 1000) {
        throw new Error(`Status check failed: ${json.msg}`);
      }

      const result = json.data.result[0];
      if (result.faceswap_status === 3) {
        return { status: 'completed', url: result.url };
      }
      if (result.faceswap_status === 4) {
        return { status: 'failed' };
      }
      return { status: 'processing' };
    } catch (error) {
      console.log('error checkstatus :', error);
    }
  }

  /** Cloud: initiate face swap task */
  async initiateFaceSwap(
    request: FaceSwapRequest
  ): Promise<{ success: boolean; taskId?: string; error?: string }> {
    let taskData: any = null;

    try {
      // Step 1: create DB record
      const { data, error: dbError } = await supabase
        .from('face_swap_tasks')
        .insert({
          user_id: request.userId,
          product_id: request.productId,
          user_image_url: request.userImageUrl,
          product_image_url: request.productImageUrl,
          status: 'pending',
          task_type: 'face_swap',
        })
        .select()
        .single();

      console.log('db error :', dbError);
      if (dbError || !data) {
        return { success: false, error: 'Failed to create task in database' };
      }

      taskData = data;

      // Step 2: detect faces - ADD PROPER ERROR HANDLING
      let targetOpts, sourceOpts;
      try {
        [targetOpts, sourceOpts] = await Promise.all([
          this.detectFace(request.productImageUrl),
          this.detectFace(request.userImageUrl),
        ]);
        console.log('detect faces :', targetOpts, sourceOpts);
      } catch (detectError) {
        console.error('Face detection failed:', detectError);
        await supabase
          .from('face_swap_tasks')
          .update({
            status: 'failed',
            error_message: `Face detection failed: ${detectError instanceof Error ? detectError.message : 'Unknown error'}`,
          })
          .eq('id', taskData.id);

        return {
          success: false,
          error: `Face detection failed: ${detectError instanceof Error ? detectError.message : 'Unknown error'}`,
        };
      }

      // Step 3: start face swap
      const { _id } = await this.startFaceSwap(
        request.productImageUrl,
        targetOpts,
        request.userImageUrl,
        sourceOpts
      );

      // Save Akool job id
      await supabase
        .from('face_swap_tasks')
        .update({ status: 'processing', pi_task_id: _id })
        .eq('id', taskData.id);

      return { success: true, taskId: taskData.id };
    } catch (error) {
      console.error('Initiate face swap error:', error);

      // Update database if task was created but failed
      if (taskData) {
        await supabase
          .from('face_swap_tasks')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', taskData.id);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /** Cloud: check task status */
  async checkTaskStatus(taskId: string): Promise<FaceSwapTaskStatus> {
    const { data: task, error } = await supabase
      .from('face_swap_tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    console.log('task :', task);
    if (error || !task) return { status: 'failed', error: 'Task not found' };

    if (task.status === 'completed')
      return { status: 'completed', resultImages: task.result_images };
    if (task.status === 'failed') return { status: 'failed', error: task.error_message };

    if (task.status === 'processing' && task.pi_task_id) {
      const result = await this.checkStatus(task.pi_task_id);

      if (result.status === 'completed' && result.url) {
        await supabase
          .from('face_swap_tasks')
          .update({ status: 'completed', result_images: [result.url] })
          .eq('id', taskId);

        return { status: 'completed', resultImages: [result.url] };
      }

      if (result.status === 'failed') {
        await supabase
          .from('face_swap_tasks')
          .update({ status: 'failed', error_message: 'Akool task failed' })
          .eq('id', taskId);

        return { status: 'failed', error: 'Akool task failed' };
      }

      return { status: 'processing' };
    }

    return { status: task.status };
  }
}

export const akool = new AkoolService(
  'cXMApU6MQ82C78iZDsAamA==',
  'WX/vVLFHnl23F/tyRye+y0nefePwCRVg'
);

// async function runSwap() {
//   try {
//     const resultUrl = await akool.swapFaces(
//       "https://example.com/target.jpg",
//       "https://example.com/source.jpg"
//     );
//     console.log("Face swapped image:", resultUrl);
//   } catch (e) {
//     console.error("Swap failed:", e);
//   }
// }
