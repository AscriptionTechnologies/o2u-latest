import { supabase } from './supabase';
import { VideoCompressor, getVideoSize } from './videoCompression';

export interface FaceSwapRequest {
  userImageUrl: string;
  productImageUrl: string;
  userId: string;
  productId: string;
}

export interface VideoFaceSwapRequest {
  userImageUrl: string;
  productVideoUrl: string;
  userId: string;
  productId: string;
  swapFacesIndex?: string; // e.g., "0" or "1,0"
  targetFacesIndex?: string; // e.g., "0" or "0,1"
}

export interface FaceSwapTaskStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultImages?: string[];
  resultVideo?: string;
  error?: string;
}

class PiAPIService {
  private baseUrl: string = 'https://api.piapi.ai';
  private apiKey = 'c9aeb087becfb70cb8d4eba21801389429530dacfbc91e3520d853922eb8e9ef';

  private async validateImageUrl(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      const contentType = res.headers.get('content-type');
      return res.ok && (contentType?.startsWith('image/') ?? false);
    } catch {
      return false;
    }
  }

  private async validateVideoUrl(
    url: string
  ): Promise<{ valid: boolean; sizeInMB?: number; error?: string }> {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      const contentType = res.headers.get('content-type');
      const contentLength = res.headers.get('content-length');

      if (!res.ok) {
        return { valid: false, error: 'Video URL is not accessible' };
      }

      if (!contentType?.startsWith('video/')) {
        return { valid: false, error: 'URL does not point to a video file' };
      }

      // Check file size (PiAPI limit is 10MB)
      if (contentLength) {
        const sizeInBytes = parseInt(contentLength);
        const sizeInMB = sizeInBytes / (1024 * 1024);

        if (sizeInMB > 10) {
          return {
            valid: false,
            sizeInMB: Math.round(sizeInMB * 10) / 10, // Round to 1 decimal
            error: `Video file is ${Math.round(sizeInMB * 10) / 10}MB, but maximum allowed is 10MB`,
          };
        }

        return { valid: true, sizeInMB: Math.round(sizeInMB * 10) / 10 };
      }

      // If no content-length header, we can't validate size but assume it's ok
      return { valid: true };
    } catch {
      return { valid: false, error: 'Failed to validate video URL' };
    }
  }

  private convertGoogleDriveVideoUrl(url: string): string {
    if (!url || typeof url !== 'string') return url;

    // Check if it's a Google Drive URL
    if (!url.includes('drive.google.com')) return url;

    try {
      // Extract file ID from Google Drive URL
      let fileId: string | null = null;

      // Format 1: https://drive.google.com/file/d/{fileId}/view?usp=sharing
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch) {
        fileId = fileMatch[1];
      }

      // Format 2: https://drive.google.com/uc?export=view&id={fileId}
      const ucMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (ucMatch) {
        fileId = ucMatch[1];
      }

      if (fileId) {
        // Convert to direct download URL for external API access
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
      }

      return url;
    } catch (error) {
      console.error('Error converting Google Drive video URL:', error);
      return url;
    }
  }

  async initiateFaceSwap(
    request: FaceSwapRequest
  ): Promise<{ success: boolean; taskId?: string; piTaskId?: string; error?: string }> {
    try {
      if (!(await this.validateImageUrl(request.userImageUrl)))
        return { success: false, error: 'Invalid user image URL' };
      if (!(await this.validateImageUrl(request.productImageUrl)))
        return { success: false, error: 'Invalid product image URL' };

      const { data: taskData, error: dbError } = await supabase
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

      if (dbError || !taskData)
        return { success: false, error: 'Failed to create task in database' };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const createUrl = `${this.baseUrl}/api/face_swap/v1/async`;
      console.log('[PiAPIService] Creating task at:', createUrl);

      const response = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          target_image: request.productImageUrl,
          swap_image: request.userImageUrl,
          result_type: 'url',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        await supabase
          .from('face_swap_tasks')
          .update({ status: 'failed', error_message: `HTTP ${response.status}` })
          .eq('id', taskData.id);
        return { success: false, error: `PiAPI request failed: ${response.status}` };
      }

      const result = await response.json();
      console.log('[PiAPIService] Task creation response:', result);
      const piTaskId = result.data?.task_id;
      if (!piTaskId) {
        await supabase
          .from('face_swap_tasks')
          .update({ status: 'failed', error_message: 'No task_id received' })
          .eq('id', taskData.id);
        return { success: false, error: 'No task_id received from PiAPI' };
      }

      await supabase
        .from('face_swap_tasks')
        .update({ pi_task_id: piTaskId, status: 'processing' })
        .eq('id', taskData.id);
      return { success: true, taskId: taskData.id, piTaskId };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async initiateVideoFaceSwap(
    request: VideoFaceSwapRequest
  ): Promise<{ success: boolean; taskId?: string; piTaskId?: string; error?: string }> {
    // Variables accessible throughout the function for cleanup
    let finalVideoUrl = '';
    let needsCleanup = false;

    try {
      if (!(await this.validateImageUrl(request.userImageUrl)))
        return { success: false, error: 'Invalid user image URL' };

      // Convert Google Drive URLs to direct download format
      const convertedVideoUrl = this.convertGoogleDriveVideoUrl(request.productVideoUrl);
      console.log('[PiAPIService] Original video URL:', request.productVideoUrl);
      console.log('[PiAPIService] Converted video URL:', convertedVideoUrl);

      // Check video size and compress if necessary
      finalVideoUrl = convertedVideoUrl;
      needsCleanup = false;

      // Get video size
      const sizeCheck = await getVideoSize(convertedVideoUrl);
      if (sizeCheck.error) {
        console.warn('[PiAPIService] Could not determine video size:', sizeCheck.error);
      } else {
        console.log('[PiAPIService] Video size:', sizeCheck.sizeMB, 'MB');

        // If video is over 10MB, attempt compression or fallback
        if (sizeCheck.sizeMB > 10) {
          console.log('[PiAPIService] Video exceeds 10MB limit, attempting compression...');

          const compressionResult = await VideoCompressor.compressVideo(convertedVideoUrl);
          if (compressionResult.success && compressionResult.compressedUri) {
            finalVideoUrl = compressionResult.compressedUri;
            needsCleanup = true;

            // Log processing results
            console.log('[PiAPIService] Video processing completed:', {
              size: `${compressionResult.originalSizeMB}MB → ${compressionResult.compressedSizeMB}MB`,
              resolution: `${compressionResult.originalResolution} → ${compressionResult.compressedResolution}`,
              processed:
                compressionResult.originalSizeMB !== compressionResult.compressedSizeMB ||
                compressionResult.originalResolution !== compressionResult.compressedResolution,
            });
          } else {
            // Processing failed completely
            console.warn('[PiAPIService] Video processing failed, trying original video');
            console.log(
              '[PiAPIService] Note: PiAPI may reject videos that exceed size/resolution limits'
            );

            // Try with original video anyway - let PiAPI give the final verdict
            finalVideoUrl = convertedVideoUrl;
            needsCleanup = false;
          }
        }
      }

      const taskRecord = {
        user_id: request.userId,
        product_id: request.productId,
        user_image_url: request.userImageUrl,
        product_image_url: finalVideoUrl, // Store final video URL (original or compressed)
        status: 'pending',
        task_type: 'video_face_swap', // Different task type for video
      };

      console.log('[PiAPIService] Creating video face swap task with:', taskRecord);

      const { data: taskData, error: dbError } = await supabase
        .from('face_swap_tasks')
        .insert(taskRecord)
        .select()
        .single();

      if (dbError || !taskData) {
        console.error('[PiAPIService] Database error creating video task:', dbError);
        // Clean up compressed file if needed
        if (needsCleanup) {
          await VideoCompressor.cleanup(finalVideoUrl);
        }
        return { success: false, error: 'Failed to create task in database' };
      }

      console.log('[PiAPIService] Video task created successfully:', {
        id: taskData.id,
        task_type: taskData.task_type,
        status: taskData.status,
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // Increased timeout for video
      const createUrl = `${this.baseUrl}/api/v1/task`;
      console.log('[PiAPIService] Creating video task at:', createUrl);

      const requestBody = {
        model: 'Qubico/video-toolkit',
        task_type: 'face-swap',
        input: {
          swap_image: request.userImageUrl,
          target_video: finalVideoUrl, // Use final video URL (original or compressed)
          ...(request.swapFacesIndex && { swap_faces_index: request.swapFacesIndex }),
          ...(request.targetFacesIndex && { target_faces_index: request.targetFacesIndex }),
        },
      };

      console.log('[PiAPIService] Video face swap request body:', requestBody);

      const response = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        // Clean up compressed file if needed
        if (needsCleanup) {
          await VideoCompressor.cleanup(finalVideoUrl);
        }

        // Capture the actual error response for debugging
        let errorMessage = `HTTP ${response.status}`;
        let userFriendlyError = `PiAPI video request failed: ${response.status}`;

        try {
          const errorBody = await response.text();
          console.error('[PiAPIService] Video API Error Response:', errorBody);

          // Parse PiAPI error response
          const errorData = JSON.parse(errorBody);
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;

            // Provide user-friendly error messages
            if (errorMessage.includes('file size') && errorMessage.includes('too large')) {
              userFriendlyError =
                'Video file is too large. Please use a video smaller than 10MB for video preview.';
            } else if (
              errorMessage.includes('video resolution') &&
              errorMessage.includes('too large')
            ) {
              // Extract resolution info from error message
              const resolutionMatch = errorMessage.match(/resolution (\d+x\d+)/);
              const currentRes = resolutionMatch ? resolutionMatch[1] : 'current resolution';
              userFriendlyError = `Video resolution (${currentRes}) is too large. Maximum allowed is 720x1280. Please use a lower resolution video.`;
            } else if (errorMessage.includes('invalid video url')) {
              userFriendlyError =
                'Video format not supported. Please ensure the video is in MP4 format.';
            } else if (errorMessage.includes('maximum is 10MB')) {
              userFriendlyError = 'Video file exceeds 10MB limit. Please use a smaller video file.';
            } else {
              userFriendlyError = `Video processing failed: ${errorMessage}`;
            }
          }
        } catch (e) {
          console.error('[PiAPIService] Could not parse error response body');
        }

        await supabase
          .from('face_swap_tasks')
          .update({ status: 'failed', error_message: errorMessage })
          .eq('id', taskData.id);
        return { success: false, error: userFriendlyError };
      }

      const result = await response.json();
      console.log('[PiAPIService] Video task creation response:', result);
      const piTaskId = result.data?.task_id;
      if (!piTaskId) {
        // Clean up compressed file if needed
        if (needsCleanup) {
          await VideoCompressor.cleanup(finalVideoUrl);
        }
        await supabase
          .from('face_swap_tasks')
          .update({ status: 'failed', error_message: 'No task_id received' })
          .eq('id', taskData.id);
        return { success: false, error: 'No task_id received from PiAPI video service' };
      }

      const updateResult = await supabase
        .from('face_swap_tasks')
        .update({
          pi_task_id: piTaskId,
          status: 'processing',
        })
        .eq('id', taskData.id);

      if (updateResult.error) {
        console.error('[PiAPIService] Error updating task status:', updateResult.error);
      } else {
        console.log('[PiAPIService] Task updated to processing with pi_task_id:', piTaskId);
      }

      // Clean up compressed file after successful API call
      if (needsCleanup) {
        console.log('[PiAPIService] Cleaning up temporary compressed video file');
        await VideoCompressor.cleanup(finalVideoUrl);
      }

      return { success: true, taskId: taskData.id, piTaskId };
    } catch (error) {
      // Clean up compressed file on any error
      if (needsCleanup) {
        await VideoCompressor.cleanup(finalVideoUrl);
      }
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async checkTaskStatus(taskId: string): Promise<FaceSwapTaskStatus> {
    const { data: task, error } = await supabase
      .from('face_swap_tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    if (error || !task) return { status: 'failed', error: 'Task not found' };

    console.log('[PiAPIService] CheckTaskStatus - Task details:', {
      taskId,
      task_type: task.task_type,
      status: task.status,
      pi_task_id: task.pi_task_id,
    });

    // Return cached results if already completed
    if (task.status === 'completed') {
      if (task.task_type === 'video_face_swap') {
        return {
          status: 'completed',
          resultVideo: task.result_images?.[0],
          error: task.error_message,
        };
      } else {
        return { status: 'completed', resultImages: task.result_images, error: task.error_message };
      }
    }

    if (task.status === 'failed') return { status: 'failed', error: task.error_message };

    if (task.status === 'processing' && task.pi_task_id) {
      try {
        const isVideoTask = task.task_type === 'video_face_swap';
        console.log('[PiAPIService] Task type check:', {
          task_type: task.task_type,
          isVideoTask,
          will_use_endpoint: isVideoTask ? '/api/v1/fetch' : '/api/face_swap/v1/fetch',
        });

        const piStatus = isVideoTask
          ? await this.pollVideoTaskStatus(task.pi_task_id)
          : await this.pollPiAPITaskStatus(task.pi_task_id);

        if (piStatus.status === 'completed' && piStatus.result_url) {
          await supabase
            .from('face_swap_tasks')
            .update({
              status: 'completed',
              result_images: [piStatus.result_url],
            })
            .eq('id', taskId);

          if (isVideoTask) {
            return { status: 'completed', resultVideo: piStatus.result_url };
          } else {
            return { status: 'completed', resultImages: [piStatus.result_url] };
          }
        } else if (piStatus.status === 'failed') {
          // If we get a 404 error, it might be due to wrong endpoint - debug this
          if (piStatus.error?.includes('404')) {
            console.error(
              '[PiAPIService] ❌ 404 Error detected - this might be an endpoint mismatch!'
            );
            await this.debugTaskStatus(taskId);
          }

          await supabase
            .from('face_swap_tasks')
            .update({
              status: 'failed',
              error_message: piStatus.error || 'PiAPI task failed',
            })
            .eq('id', taskId);
          return { status: 'failed', error: piStatus.error || 'PiAPI task failed' };
        }
        return { status: 'processing' };
      } catch (error) {
        console.error('[PiAPIService] Error in checkTaskStatus:', error);
        // Debug the task when there's an error
        await this.debugTaskStatus(taskId);
        return { status: 'processing' };
      }
    }
    return { status: task.status };
  }

  private async pollPiAPITaskStatus(
    piTaskId: string
  ): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result_url?: string;
    error?: string;
  }> {
    const pollUrl = `${this.baseUrl}/api/face_swap/v1/fetch`;
    console.log('[PiAPIService] 📸 POLLING IMAGE TASK at:', pollUrl, 'for task:', piTaskId);

    const requestBody = { task_id: piTaskId };
    console.log('[PiAPIService] Image polling request body:', requestBody);

    const response = await fetch(pollUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[PiAPIService] Image polling HTTP status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PiAPIService] Image polling error response:', errorText);
      return { status: 'failed', error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    console.log('[PiAPIService] Image polling response:', result);
    const data = result.data;

    if (data.status === 'success' && data.image)
      return { status: 'completed', result_url: data.image };
    if (data.status === 'failed')
      return { status: 'failed', error: (data.error_messages || []).join(', ') };
    return { status: 'processing' };
  }

  private async pollVideoTaskStatus(
    piTaskId: string
  ): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result_url?: string;
    error?: string;
  }> {
    // Try multiple polling patterns since documentation doesn't specify
    const pollPatterns = [
      {
        url: `${this.baseUrl}/api/v1/task/${piTaskId}`,
        method: 'GET',
        desc: 'RESTful GET pattern',
      },
      {
        url: `${this.baseUrl}/api/v1/fetch`,
        method: 'POST',
        desc: 'Original POST pattern',
        body: { task_id: piTaskId },
      },
      {
        url: `${this.baseUrl}/api/v1/task/status`,
        method: 'POST',
        desc: 'Status endpoint pattern',
        body: { task_id: piTaskId },
      },
      {
        url: `${this.baseUrl}/api/v1/tasks/${piTaskId}`,
        method: 'GET',
        desc: 'Plural RESTful pattern',
      },
    ];

    for (const pattern of pollPatterns) {
      try {
        console.log(`[PiAPIService] 🎬 TRYING VIDEO POLLING: ${pattern.desc} at:`, pattern.url);

        const headers: Record<string, string> = {
          'x-api-key': this.apiKey,
          Accept: 'application/json',
        };

        const requestOptions: RequestInit = {
          method: pattern.method,
          headers,
        };

        if (pattern.body) {
          headers['Content-Type'] = 'application/json';
          requestOptions.body = JSON.stringify(pattern.body);
          console.log('[PiAPIService] Request body:', pattern.body);
        }

        const response = await fetch(pattern.url, requestOptions);
        console.log(`[PiAPIService] ${pattern.desc} HTTP status:`, response.status);

        if (response.ok) {
          const result = await response.json();
          console.log(`[PiAPIService] ✅ SUCCESS with ${pattern.desc}:`, result);

          // Parse response based on different possible formats
          let data = result.data || result;

          // For video tasks, check for video_url in the output
          if (data.status === 'success' && data.output?.video_url) {
            return { status: 'completed', result_url: data.output.video_url };
          }
          if (data.status === 'completed' && data.output?.video_url) {
            return { status: 'completed', result_url: data.output.video_url };
          }
          if (data.status === 'failed') {
            return {
              status: 'failed',
              error: data.error?.message || (data.error_messages || []).join(', ') || 'Task failed',
            };
          }

          // If we get here, task is still processing
          return { status: 'processing' };
        } else {
          const errorText = await response.text();
          console.log(
            `[PiAPIService] ❌ ${pattern.desc} failed with ${response.status}:`,
            errorText
          );
          // Continue to next pattern
        }
      } catch (error) {
        console.log(`[PiAPIService] ❌ ${pattern.desc} threw error:`, error);
        // Continue to next pattern
      }
    }

    // If all patterns failed
    console.error('[PiAPIService] ❌ All video polling patterns failed');
    return { status: 'failed', error: 'Unable to poll video task status - all endpoints failed' };
  }

  async getUserCoinBalance(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('users')
      .select('coin_balance')
      .eq('id', userId)
      .single();
    return error || !data ? 0 : data.coin_balance || 0;
  }

  async saveFaceSwapResults(
    userId: string,
    productId: string,
    resultImages: string[]
  ): Promise<boolean> {
    const { error } = await supabase
      .from('user_face_swap_results')
      .upsert({ user_id: userId, product_id: productId, result_images: resultImages });
    return !error;
  }

  async getUserFaceSwapResults(userId: string, productId: string): Promise<string[] | null> {
    const { data, error } = await supabase
      .from('user_face_swap_results')
      .select('result_images')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();
    return error || !data ? null : data.result_images || [];
  }

  async awardReferralCoins(userId: string, productId: string, method: string, amount: number = 2): Promise<boolean> {
    try {
      if (!userId) return false;

      // Record a referral/share event (optional analytics table if exists)
      try {
        await supabase.from('referral_events').insert({
          user_id: userId,
          product_id: productId,
          method,
          coins_awarded: amount,
        });
      } catch (e) {
        // Table may not exist; ignore silently
      }

      // Atomically increment coin balance
      const { data, error } = await supabase
        .from('users')
        .update({ coin_balance: (supabase as any).rpc ? undefined : undefined })
        .eq('id', userId)
        .select('coin_balance')
        .single();

      // If RPC for increment isn't available, do manual fetch/update
      if (error || !data) {
        const { data: current, error: getErr } = await supabase
          .from('users')
          .select('coin_balance')
          .eq('id', userId)
          .single();
        if (getErr) return false;
        const newBalance = (current?.coin_balance || 0) + amount;
        const { error: updErr } = await supabase
          .from('users')
          .update({ coin_balance: newBalance })
          .eq('id', userId);
        return !updErr;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Debug utility to check task in database
  async debugTaskStatus(taskId: string): Promise<void> {
    console.log('[PiAPIService] 🔍 DEBUG: Checking task in database...');
    const { data, error } = await supabase
      .from('face_swap_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) {
      console.error('[PiAPIService] 🔍 DEBUG: Database error:', error);
      return;
    }

    if (!data) {
      console.error('[PiAPIService] 🔍 DEBUG: No task found with ID:', taskId);
      return;
    }

    console.log('[PiAPIService] 🔍 DEBUG: Task found in database:', {
      id: data.id,
      task_type: data.task_type,
      status: data.status,
      pi_task_id: data.pi_task_id,
      created_at: data.created_at,
      updated_at: data.updated_at,
    });

    // Also check what polling method would be used
    const isVideoTask = data.task_type === 'video_face_swap';
    console.log('[PiAPIService] 🔍 DEBUG: Polling method selection:', {
      task_type: data.task_type,
      isVideoTask,
      polling_endpoint: isVideoTask ? '/api/v1/fetch' : '/api/face_swap/v1/fetch',
    });
  }
}

const piAPIService = new PiAPIService();
export default piAPIService;
export const akoolService = piAPIService;
