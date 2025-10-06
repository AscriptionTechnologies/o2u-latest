// Profile Photo Upload Utility
// Handles uploading profile photos to Supabase Storage with proper error handling

import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';
import Toast from 'react-native-toast-message';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export class ProfilePhotoUploadService {
  private static readonly BUCKET_NAME = 'avatars';
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  /**
   * Upload a profile photo to Supabase Storage
   */
  static async uploadProfilePhoto(imageUri: string): Promise<UploadResult> {
    try {
      console.log('[ProfilePhotoUpload] Starting upload for:', imageUri);

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) {
        return {
          success: false,
          error: 'Image file not found'
        };
      }

      // Check file size
      if (fileInfo.size && fileInfo.size > this.MAX_FILE_SIZE) {
        return {
          success: false,
          error: 'Image file is too large. Maximum size is 5MB.'
        };
      }

      // Read the image file
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Create a unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileName = `profile_${timestamp}_${randomString}.jpg`;
      const filePath = `profiles/${fileName}`;

      console.log('[ProfilePhotoUpload] Uploading to path:', filePath);

      // Convert base64 to Uint8Array for upload
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Ensure the storage bucket exists
      await this.ensureBucketExists();

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, bytes, {
          contentType: 'image/jpeg',
          upsert: false, // Don't overwrite existing files
        });

      if (error) {
        console.error('[ProfilePhotoUpload] Upload error:', error);
        
        // Handle specific error cases
        if (error.message.includes('already exists')) {
          // Try with a different filename
          const newFileName = `profile_${timestamp}_${randomString}_${Date.now()}.jpg`;
          const newFilePath = `profiles/${newFileName}`;
          
          const { data: retryData, error: retryError } = await supabase.storage
            .from(this.BUCKET_NAME)
            .upload(newFilePath, bytes, {
              contentType: 'image/jpeg',
              upsert: false,
            });

          if (retryError) {
            return {
              success: false,
              error: `Upload failed: ${retryError.message}`
            };
          }

          // Get the public URL for the retry
          const { data: urlData } = supabase.storage
            .from(this.BUCKET_NAME)
            .getPublicUrl(newFilePath);

          return {
            success: true,
            url: urlData.publicUrl
          };
        }

        return {
          success: false,
          error: `Upload failed: ${error.message}`
        };
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(filePath);

      console.log('[ProfilePhotoUpload] Upload successful:', urlData.publicUrl);

      return {
        success: true,
        url: urlData.publicUrl
      };

    } catch (error) {
      console.error('[ProfilePhotoUpload] Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Ensure the storage bucket exists and is properly configured
   */
  private static async ensureBucketExists(): Promise<void> {
    try {
      // Check if bucket exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.error('[ProfilePhotoUpload] Error listing buckets:', listError);
        // Don't throw here, just log the error and continue
        return;
      }

      const bucketExists = buckets?.some(bucket => bucket.name === this.BUCKET_NAME);
      
      if (!bucketExists) {
        console.log('[ProfilePhotoUpload] Creating bucket:', this.BUCKET_NAME);
        
        try {
          // Create the bucket
          const { data, error } = await supabase.storage.createBucket(this.BUCKET_NAME, {
            public: true,
            allowedMimeTypes: this.ALLOWED_TYPES,
            fileSizeLimit: this.MAX_FILE_SIZE,
          });

          if (error) {
            console.error('[ProfilePhotoUpload] Error creating bucket:', error);
            // Don't throw here, just log the error
            console.log('[ProfilePhotoUpload] Bucket creation failed, but continuing with upload attempt');
            return;
          }

          console.log('[ProfilePhotoUpload] Bucket created successfully');
        } catch (createError) {
          console.error('[ProfilePhotoUpload] Exception during bucket creation:', createError);
          // Don't throw here, just log the error
          console.log('[ProfilePhotoUpload] Bucket creation failed, but continuing with upload attempt');
        }
      } else {
        console.log('[ProfilePhotoUpload] Bucket already exists');
      }
    } catch (error) {
      console.error('[ProfilePhotoUpload] Error ensuring bucket exists:', error);
      // Don't throw here, just log the error and continue
      console.log('[ProfilePhotoUpload] Bucket check failed, but continuing with upload attempt');
    }
  }

  /**
   * Delete a profile photo from storage
   */
  static async deleteProfilePhoto(photoUrl: string): Promise<boolean> {
    try {
      if (!photoUrl) return true;

      // Extract file path from URL
      const urlParts = photoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `profiles/${fileName}`;

      console.log('[ProfilePhotoUpload] Deleting file:', filePath);

      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([filePath]);

      if (error) {
        console.error('[ProfilePhotoUpload] Delete error:', error);
        return false;
      }

      console.log('[ProfilePhotoUpload] File deleted successfully');
      return true;
    } catch (error) {
      console.error('[ProfilePhotoUpload] Delete error:', error);
      return false;
    }
  }

  /**
   * Validate image file
   */
  static async validateImage(imageUri: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      
      if (!fileInfo.exists) {
        return { valid: false, error: 'File does not exist' };
      }

      if (fileInfo.size && fileInfo.size > this.MAX_FILE_SIZE) {
        return { 
          valid: false, 
          error: `File size (${Math.round(fileInfo.size / 1024 / 1024 * 10) / 10}MB) exceeds maximum allowed size (5MB)` 
        };
      }

      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown validation error' 
      };
    }
  }
}

/**
 * Convenience function for uploading profile photos
 */
export const uploadProfilePhoto = async (imageUri: string): Promise<UploadResult> => {
  return ProfilePhotoUploadService.uploadProfilePhoto(imageUri);
};

/**
 * Convenience function for deleting profile photos
 */
export const deleteProfilePhoto = async (photoUrl: string): Promise<boolean> => {
  return ProfilePhotoUploadService.deleteProfilePhoto(photoUrl);
};

/**
 * Convenience function for validating images
 */
export const validateImage = async (imageUri: string): Promise<{ valid: boolean; error?: string }> => {
  return ProfilePhotoUploadService.validateImage(imageUri);
};
