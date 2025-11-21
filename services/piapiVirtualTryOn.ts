// PiAPI Face Swap Service
// Implements PiAPI Face Swap API for swapping user's face onto product images

import { supabase } from '~/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FaceSwapRequest {
  userImageUrl: string;
  productImageUrl: string;
  userId: string;
  productId: string;
  batchSize?: number;
}

export interface FaceSwapTaskStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultImages?: string[];
  error?: string;
}

class PiAPIFaceSwapService {
  private baseUrl: string = 'https://api.piapi.ai';
  private apiKey = '15de29d320caacc4ea0d3cb76ce18df1f0d7509b9828c763dd98a6b4450f2453';

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
    if (!url.includes('drive.google.com')) return url;

    try {
      let fileId: string | null = null;
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch) fileId = fileMatch[1];
      const ucMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (ucMatch) fileId = ucMatch[1];

      if (fileId) {
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
      }

      return url;
    } catch (error) {
      console.error('Error converting Google Drive URL:', error);
      return url;
    }
  }

  /**
   * Initiate Face Swap using PiAPI Face Swap API
   * Docs: https://piapi.ai/workspace/faceswap
   */

  
  async initiateVirtualTryOn(
    request: FaceSwapRequest
  ): Promise<{ success: boolean; taskId?: string; piTaskId?: string; error?: string }> {
    try {
      if (!(await this.validateImageUrl(request.userImageUrl))) {
        return { success: false, error: 'Invalid user image URL' };
      }
      if (!(await this.validateImageUrl(request.productImageUrl))) {
        return { success: false, error: 'Invalid product image URL' };
      }

      const processedUserImageUrl = this.convertGoogleDriveUrl(request.userImageUrl);
      const processedProductImageUrl = this.convertGoogleDriveUrl(request.productImageUrl);

      console.log('[PiAPIFaceSwap] Creating face swap task with:', {
        userImageUrl: processedUserImageUrl,
        productImageUrl: processedProductImageUrl,
        userId: request.userId,
        productId: request.productId,
      });

      const { data: taskData, error: dbError } = await supabase
        .from('face_swap_tasks')
        .insert({
        user_id: request.userId,
        product_id: request.productId,
        user_image_url: processedUserImageUrl,
        product_image_url: processedProductImageUrl,
        status: 'pending',
          task_type: 'face_swap',
        })
        .select()
        .single();

      if (dbError || !taskData) {
        console.error('[PiAPIFaceSwap] Database error:', dbError);
        return { success: false, error: 'Failed to create task in database' };
      }

      console.log('[PiAPIFaceSwap] Task created successfully:', {
        id: taskData.id,
        task_type: taskData.task_type,
        status: taskData.status,
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const createUrl = `${this.baseUrl}/api/face_swap/v1/async`;
      const requestBody = {
          target_image: processedProductImageUrl,
          swap_image: processedUserImageUrl,
        result_type: 'url',
      };

      console.log('[PiAPIFaceSwap] Creating face swap task at:', createUrl);

      const response = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorBody = await response.text();
          console.error('[PiAPIFaceSwap] API Error Response:', errorBody);
          const errorData = JSON.parse(errorBody);
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch {
          // ignore parse errors
        }

        await supabase
          .from('face_swap_tasks')
          .update({ status: 'failed', error_message: errorMessage })
          .eq('id', taskData.id);
        return { success: false, error: `Face swap request failed: ${errorMessage}` };
      }

      const result = await response.json();
      console.log('[PiAPIFaceSwap] Task creation response:', result);
      
      const piTaskId = result.data?.task_id || result.task_id;
      if (!piTaskId) {
        await supabase
          .from('face_swap_tasks')
          .update({ status: 'failed', error_message: 'No task_id received' })
          .eq('id', taskData.id);
        return { success: false, error: 'No task_id received from PiAPI face swap service' };
      }

      const updateResult = await supabase
        .from('face_swap_tasks')
        .update({
          pi_task_id: piTaskId,
          status: 'processing',
        })
        .eq('id', taskData.id);

      if (updateResult.error) {
        console.error('[PiAPIFaceSwap] Error updating task status:', updateResult.error);
      } else {
        console.log('[PiAPIFaceSwap] Task updated to processing with pi_task_id:', piTaskId);
      }

      return { success: true, taskId: taskData.id, piTaskId };
    } catch (error) {
      console.error('[PiAPIFaceSwap] Error in initiateFaceSwap:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        return { 
          success: false, 
          error: 'Request timeout. Please check your internet connection and try again.',
        };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check the status of a face swap task
   */
  async checkTaskStatus(taskId: string): Promise<FaceSwapTaskStatus> {
    const { data: task, error } = await supabase
      .from('face_swap_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error || !task) {
      return { status: 'failed', error: 'Task not found' };
    }

    console.log('[PiAPIFaceSwap] CheckTaskStatus - Task details:', {
      taskId,
      task_type: task.task_type,
      status: task.status,
      pi_task_id: task.pi_task_id,
    });

    if (task.status === 'completed') {
      const images: string[] = Array.isArray(task.result_images) ? task.result_images : [];
      const ordered = images.length > 1
        ? (() => {
            const idx = images.findIndex((u: string) => /piapi\.ai|theapi\.app/i.test(u));
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
        console.log('[PiAPIFaceSwap] Upsert cached results failed:', e);
      }

      return { status: 'completed', resultImages: ordered };
    }

    if (task.status === 'failed') {
      return { status: 'failed', error: task.error_message };
    }

    if (task.status === 'processing' && task.pi_task_id) {
      try {
        const piStatus = await this.pollFaceSwapTaskStatus(task.pi_task_id);

        if (piStatus.status === 'completed' && piStatus.result_urls) {
          await supabase
            .from('face_swap_tasks')
            .update({
              status: 'completed',
              result_images: piStatus.result_urls,
            })
            .eq('id', taskId);

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
                productId: taskRow.product_id, // Include product ID for navigation
                resultImages: piStatus.result_urls, // Include result images
              };
              await AsyncStorage.setItem(storageKey, JSON.stringify([notif, ...list]));

              await supabase
                .from('user_face_swap_results')
                .upsert({
                  user_id: taskRow.user_id,
                  product_id: taskRow.product_id,
                  result_images: piStatus.result_urls,
                });
            }
          } catch (e) {
            console.log('[PiAPIFaceSwap] Failed to persist notification:', e);
          }

          return { status: 'completed', resultImages: piStatus.result_urls };
        } else if (piStatus.status === 'failed') {
          await supabase
            .from('face_swap_tasks')
            .update({
              status: 'failed',
              error_message: piStatus.error || 'PiAPI face swap task failed',
            })
            .eq('id', taskId);
          return { status: 'failed', error: piStatus.error || 'PiAPI face swap task failed' };
        }

        return { status: 'processing' };
      } catch (error) {
        console.error('[PiAPIFaceSwap] Error in checkTaskStatus:', error);
        return { status: 'processing' };
      }
    }

    return { status: task.status };
  }

  /**
   * Poll PiAPI task status for face swap
   */
  private async pollFaceSwapTaskStatus(
    piTaskId: string
  ): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result_urls?: string[];
    error?: string;
  }> {
    const pollUrl = `${this.baseUrl}/api/face_swap/v1/fetch`;
    console.log('[PiAPIFaceSwap] Polling face swap task at:', pollUrl);

    const response = await fetch(pollUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        Accept: 'application/json',
      },
      body: JSON.stringify({ task_id: piTaskId }),
    });

    console.log('[PiAPIFaceSwap] Polling HTTP status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PiAPIFaceSwap] Polling error response:', errorText);
      return { status: 'failed', error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    console.log('[PiAPIFaceSwap] Polling response:', result);

    const data = result.data || result;

    if (data.status === 'success' || data.status === 'completed') {
      if (data.image) return { status: 'completed', result_urls: [data.image] };
      if (data.output?.image) return { status: 'completed', result_urls: [data.output.image] };
      if (Array.isArray(data.images) && data.images.length)
        return { status: 'completed', result_urls: data.images };

      // fallback deep search
        const urls: string[] = [];
        const visit = (v: any) => {
          if (!v) return;
        if (typeof v === 'string' && /^https?:\/\//.test(v)) {
          urls.push(v);
            return;
          }
        if (Array.isArray(v)) return v.forEach(visit);
          if (typeof v === 'object') Object.values(v).forEach(visit);
        };
      visit(data);
        const images = urls.filter(u => /(\.png|\.jpg|\.jpeg|\.webp)(\?|$)/i.test(u));
      if (images.length) return { status: 'completed', result_urls: images };

      return { status: 'failed', error: 'Completed without image URL' };
    }

    if (data.status === 'failed') {
      const errorMessage =
        data.error?.message || (data.error_messages || []).join(', ') || 'Task failed';
      return { status: 'failed', error: errorMessage };
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
   * Save face swap results to user's collection
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
        result_images: resultImages,
      });
    return !error;
  }

  /**
   * Get user's face swap results for a product
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

const piAPIFaceSwapService = new PiAPIFaceSwapService();
export default piAPIFaceSwapService;

