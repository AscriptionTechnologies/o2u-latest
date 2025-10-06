// PiAPI Virtual Try-On Service
// Implements Kling Virtual Try-On API for face swapping user's face onto product model images

import { supabase } from '~/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface VirtualTryOnRequest {
  userImageUrl: string;
  productImageUrl: string;
  userId: string;
  productId: string;
  batchSize?: number;
}

export interface VirtualTryOnTaskStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultImages?: string[];
  error?: string;
}

class PiAPIVirtualTryOnService {
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

  private convertGoogleDriveUrl(url: string): string {
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
      console.error('Error converting Google Drive URL:', error);
      return url;
    }
  }

  /**
   * Initiate Virtual Try-On using PiAPI Kling API
   * This will face swap the user's face onto the product model image
   */
  async initiateVirtualTryOn(
    request: VirtualTryOnRequest
  ): Promise<{ success: boolean; taskId?: string; piTaskId?: string; error?: string }> {
    try {
      // Validate image URLs
      if (!(await this.validateImageUrl(request.userImageUrl))) {
        return { success: false, error: 'Invalid user image URL' };
      }
      if (!(await this.validateImageUrl(request.productImageUrl))) {
        return { success: false, error: 'Invalid product image URL' };
      }

      // Convert Google Drive URLs if needed
      const processedUserImageUrl = this.convertGoogleDriveUrl(request.userImageUrl);
      const processedProductImageUrl = this.convertGoogleDriveUrl(request.productImageUrl);

      console.log('[PiAPIVirtualTryOn] Creating virtual try-on task with:', {
        userImageUrl: processedUserImageUrl,
        productImageUrl: processedProductImageUrl,
        userId: request.userId,
        productId: request.productId,
      });

      // Create database record
      const insertData = {
        user_id: request.userId,
        product_id: request.productId,
        user_image_url: processedUserImageUrl,
        product_image_url: processedProductImageUrl,
        status: 'pending',
        task_type: 'face_swap', // Using PiAPI Faceswap API
      };

      console.log('[PiAPIVirtualTryOn] Inserting task data:', insertData);

      const { data: taskData, error: dbError } = await supabase
        .from('face_swap_tasks')
        .insert(insertData)
        .select()
        .single();

      if (dbError || !taskData) {
        console.error('[PiAPIVirtualTryOn] Database error:', dbError);
        return { success: false, error: 'Failed to create task in database' };
      }

      console.log('[PiAPIVirtualTryOn] Task created successfully:', {
        id: taskData.id,
        task_type: taskData.task_type,
        status: taskData.status,
      });

      // Create PiAPI task
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const createUrl = `${this.baseUrl}/api/v1/task`;

      // PiAPI Faceswap API
      // Docs: https://piapi.ai/docs/faceswap-api/create-task
      const requestBody = {
        model: 'Qubico/image-toolkit',
        task_type: 'face-swap',
        input: {
          // target_image: model/product image, swap_image: user's face image
          target_image: processedProductImageUrl,
          swap_image: processedUserImageUrl,
        },
      };

      console.log('[PiAPIVirtualTryOn] Creating faceswap task at:', createUrl);
      console.log('[PiAPIVirtualTryOn] Request body:', requestBody);

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
        let errorMessage = `HTTP ${response.status}`;
        let userFriendlyError = `PiAPI faceswap request failed: ${response.status}`;

        try {
          const errorBody = await response.text();
          console.error('[PiAPIVirtualTryOn] API Error Response:', errorBody);

          const errorData = JSON.parse(errorBody);
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
            userFriendlyError = `Face swap failed: ${errorMessage}`;
          }
        } catch (e) {
          console.error('[PiAPIVirtualTryOn] Could not parse error response body');
        }

        await supabase
          .from('face_swap_tasks')
          .update({ status: 'failed', error_message: errorMessage })
          .eq('id', taskData.id);
        return { success: false, error: userFriendlyError };
      }

      const result = await response.json();
      console.log('[PiAPIVirtualTryOn] Task creation response:', result);
      
      const piTaskId = result.data?.task_id;
      if (!piTaskId) {
        await supabase
          .from('face_swap_tasks')
          .update({ status: 'failed', error_message: 'No task_id received' })
          .eq('id', taskData.id);
        return { success: false, error: 'No task_id received from PiAPI virtual try-on service' };
      }

      // Update task with PiAPI task ID
      const updateResult = await supabase
        .from('face_swap_tasks')
        .update({
          pi_task_id: piTaskId,
          status: 'processing',
        })
        .eq('id', taskData.id);

      if (updateResult.error) {
        console.error('[PiAPIVirtualTryOn] Error updating task status:', updateResult.error);
      } else {
        console.log('[PiAPIVirtualTryOn] Task updated to processing with pi_task_id:', piTaskId);
      }

      return { success: true, taskId: taskData.id, piTaskId };
    } catch (error) {
      console.error('[PiAPIVirtualTryOn] Error in initiateVirtualTryOn:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check the status of a faceswap task
   */
  async checkTaskStatus(taskId: string): Promise<VirtualTryOnTaskStatus> {
    const { data: task, error } = await supabase
      .from('face_swap_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error || !task) {
      return { status: 'failed', error: 'Task not found' };
    }

    console.log('[PiAPIVirtualTryOn] CheckTaskStatus - Task details:', {
      taskId,
      task_type: task.task_type,
      status: task.status,
      pi_task_id: task.pi_task_id,
    });

    // Return cached results if already completed, and ensure user_face_swap_results is up to date
    if (task.status === 'completed') {
      const images: string[] = Array.isArray(task.result_images) ? task.result_images : [];
      // Reorder so theapi.app image comes first for downstream consumers
      const ordered = images.length > 1
        ? (() => {
            const idx = images.findIndex((u: string) => /theapi\.app/i.test(u));
            if (idx > 0) {
              const copy = [...images];
              const [picked] = copy.splice(idx, 1);
              return [picked, ...copy];
            }
            return images;
          })()
        : images;

      try {
        if (task.user_id && task.product_id && ordered.length > 0) {
          await supabase
            .from('user_face_swap_results')
            .upsert({
              user_id: task.user_id,
              product_id: task.product_id,
              result_images: ordered,
            });
        }
      } catch (e) {
        console.log('[PiAPIVirtualTryOn] Upsert cached results failed:', e);
      }

      return { status: 'completed', resultImages: ordered };
    }

    if (task.status === 'failed') {
      return { status: 'failed', error: task.error_message };
    }

    if (task.status === 'processing' && task.pi_task_id) {
      try {
        const piStatus = await this.pollPiAPITaskStatus(task.pi_task_id);

        if (piStatus.status === 'completed' && piStatus.result_urls) {
          await supabase
            .from('face_swap_tasks')
            .update({
              status: 'completed',
              result_images: piStatus.result_urls,
            })
            .eq('id', taskId);

          // Persist an in-app notification for the user and save results
          try {
            const { data: taskRow } = await supabase
              .from('face_swap_tasks')
              .select('user_id, product_id')
              .eq('id', taskId)
              .single();

            if (taskRow?.user_id) {
              const storageKey = `notifications_${taskRow.user_id}`;
              const raw = await AsyncStorage.getItem(storageKey);
              const list = raw ? JSON.parse(raw) : [];
              const notif = {
                id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
                title: 'Your Face Swap is Ready',
                subtitle: 'Open Your Preview to view the results',
                image: piStatus.result_urls[0],
                timeIso: new Date().toISOString(),
                unread: true,
              };
              await AsyncStorage.setItem(storageKey, JSON.stringify([notif, ...list]));

              // Upsert into permanent results table
              await supabase
                .from('user_face_swap_results')
                .upsert({
                  user_id: taskRow.user_id,
                  product_id: taskRow.product_id,
                  result_images: piStatus.result_urls,
                });
            }
          } catch (e) {
            console.log('[PiAPIVirtualTryOn] Failed to persist notification:', e);
          }

          return { status: 'completed', resultImages: piStatus.result_urls };
        } else if (piStatus.status === 'failed') {
          await supabase
            .from('face_swap_tasks')
            .update({
              status: 'failed',
              error_message: piStatus.error || 'PiAPI virtual try-on task failed',
            })
            .eq('id', taskId);
          return { status: 'failed', error: piStatus.error || 'PiAPI virtual try-on task failed' };
        }

        return { status: 'processing' };
      } catch (error) {
        console.error('[PiAPIVirtualTryOn] Error in checkTaskStatus:', error);
        return { status: 'processing' };
      }
    }

    return { status: task.status };
  }

  /**
   * Poll PiAPI task status for virtual try-on
   */
  private async pollPiAPITaskStatus(
    piTaskId: string
  ): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result_urls?: string[];
    error?: string;
  }> {
    const pollUrl = `${this.baseUrl}/api/v1/task/${piTaskId}`;
    console.log('[PiAPIVirtualTryOn] Polling virtual try-on task at:', pollUrl);

    const response = await fetch(pollUrl, {
      method: 'GET',
      headers: {
        'x-api-key': this.apiKey,
        Accept: 'application/json',
      },
    });

    console.log('[PiAPIVirtualTryOn] Polling HTTP status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PiAPIVirtualTryOn] Polling error response:', errorText);
      return { status: 'failed', error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    console.log('[PiAPIVirtualTryOn] Polling response:', result);

    const data = result.data || result;

    const extractImageUrls = (obj: any): string[] => {
      try {
        const urls: string[] = [];
        const visit = (v: any) => {
          if (!v) return;
          if (Array.isArray(v)) return v.forEach(visit);
          if (typeof v === 'string') {
            if (/^https?:\/\//.test(v)) urls.push(v);
            return;
          }
          if (typeof v === 'object') Object.values(v).forEach(visit);
        };
        visit(obj);
        const images = urls.filter(u => /(\.png|\.jpg|\.jpeg|\.webp)(\?|$)/i.test(u));
        return images.length ? images : urls;
      } catch { return []; }
    };

    // Check for completion
    if (data.status === 'success' || data.status === 'completed') {
      // Known shapes
      if (data.output?.images && Array.isArray(data.output.images)) {
        return { status: 'completed', result_urls: data.output.images };
      }
      if (data.result?.images && Array.isArray(data.result.images)) {
        return { status: 'completed', result_urls: data.result.images };
      }
      if (data.output?.image) {
        return { status: 'completed', result_urls: [data.output.image] };
      }
      if (data.result?.image) {
        return { status: 'completed', result_urls: [data.result.image] };
      }
      // Fallback deep search
      const urls = extractImageUrls(data);
      if (urls.length) return { status: 'completed', result_urls: urls };
      return { status: 'failed', error: 'Completed without image URLs' };
    }

    if (data.status === 'failed') {
      return { 
        status: 'failed', 
        error: data.error?.message || (data.error_messages || []).join(', ') || 'Task failed' 
      };
    }

    return { status: 'processing' };
  }

  /**
   * Get user's coin balance
   */
  async getUserCoinBalance(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('users')
      .select('coin_balance')
      .eq('id', userId)
      .single();
    return error || !data ? 0 : data.coin_balance || 0;
  }

  /**
   * Save virtual try-on results to user's collection
   */
  async saveVirtualTryOnResults(
    userId: string,
    productId: string,
    resultImages: string[]
  ): Promise<boolean> {
    const { error } = await supabase
      .from('user_face_swap_results')
      .upsert({ 
        user_id: userId, 
        product_id: productId, 
        result_images: resultImages 
      });
    return !error;
  }

  /**
   * Get user's virtual try-on results for a product
   */
  async getUserVirtualTryOnResults(userId: string, productId: string): Promise<string[] | null> {
    const { data, error } = await supabase
      .from('user_face_swap_results')
      .select('result_images')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();
    return error || !data ? null : data.result_images || [];
  }
}

const piAPIVirtualTryOnService = new PiAPIVirtualTryOnService();
export default piAPIVirtualTryOnService;
