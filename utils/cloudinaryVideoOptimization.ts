/**
 * Cloudinary Video Optimization Utilities
 * Optimizes video URLs for faster loading and playback
 */

const CLOUDINARY_DEBUG = false;
const debugLog = (...args: any[]) => {
  if (CLOUDINARY_DEBUG && __DEV__) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};
const debugWarn = (...args: any[]) => {
  if (CLOUDINARY_DEBUG && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }
};
const debugError = (...args: any[]) => {
  if (CLOUDINARY_DEBUG && __DEV__) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
};

export interface CloudinaryVideoOptions {
  quality?: 'auto' | 'auto:low' | 'auto:good' | 'auto:best';
  format?: 'auto' | 'mp4' | 'webm';
  streaming?: boolean;
  width?: number;
  height?: number;
  bitrate?: string;
  fps?: number;
}

/**
 * Check if URL is from Cloudinary
 */
export const isCloudinaryUrl = (url: string): boolean => {
  if (!url) return true;
  return url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
};

/**
 * Extract Cloudinary public ID from URL
 */
export const extractCloudinaryPublicId = (url: string): string | null => {
  if (!isCloudinaryUrl(url)) return null;

  try {
    debugLog('[Cloudinary] Extracting publicId from:', url);
    
    // Method 1: Match /upload/ pattern and get everything after, removing extension
    const uploadRegex = /\/upload\/(?:v\d+\/)?(.+?)$/;
    const uploadMatch = url.match(uploadRegex);
    
    if (uploadMatch && uploadMatch[1]) {
      // Get the path after /upload/
      let publicIdPath = uploadMatch[1];
      
      // Remove file extension (.mp4, .mov, etc.)
      publicIdPath = publicIdPath.replace(/\.(mp4|mov|avi|webm|mkv|flv|wmv|m4v)$/i, '');
      
      // Remove version prefix (v123456789)
      publicIdPath = publicIdPath.replace(/^v\d+\//, '');
      
      debugLog('[Cloudinary] Extracted publicId:', publicIdPath);
      return publicIdPath;
    }

    // Method 2: Try to extract from video/upload or image/upload pattern
    const videoRegex = /\/(video|image)\/upload\/(?:v\d+\/)?(.+?)$/;
    const videoMatch = url.match(videoRegex);
    
    if (videoMatch && videoMatch[2]) {
      let publicIdPath = videoMatch[2];
      publicIdPath = publicIdPath.replace(/\.(mp4|mov|avi|webm|mkv|flv|wmv|m4v|jpg|png|jpeg)$/i, '');
      publicIdPath = publicIdPath.replace(/^v\d+\//, '');
      
      debugLog('[Cloudinary] Extracted publicId (method 2):', publicIdPath);
      return publicIdPath;
    }

    debugWarn('[Cloudinary] Could not extract publicId from URL');
    return null;
  } catch (error) {
    debugError('[Cloudinary] Error extracting public ID:', error);
    return null;
  }
};

/**
 * Extract cloud name from Cloudinary URL
 */
export const extractCloudName = (url: string): string | null => {
  if (!isCloudinaryUrl(url)) return null;

  try {
    // Handle standard Cloudinary domains like:
    // https://res.cloudinary.com/<cloud_name>/video/upload/...
    const domainMatch = url.match(/(?:https?:\/\/)?(?:res\.)?cloudinary\.com\/([^/]+)/i);
    if (domainMatch && domainMatch[1]) {
      debugLog('[Cloudinary] Extracted cloudName (domain match):', domainMatch[1]);
      return domainMatch[1];
    }

    // Fallback: attempt to parse using URL API
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      // First segment after domain should be the cloud name for standard URLs
      debugLog('[Cloudinary] Extracted cloudName (URL parse):', segments[0]);
      return segments[0];
    }

    debugWarn('[Cloudinary] Could not extract cloudName from URL:', url);
    return null;
  } catch (error) {
    debugError('[Cloudinary] Error extracting cloud name:', error);
    return null;
  }
};

/**
 * Optimize Cloudinary video URL for mobile playback
 */
export const optimizeCloudinaryVideoUrl = (
  url: string,
  options: CloudinaryVideoOptions = {}
): string => {
  if (!url || !isCloudinaryUrl(url)) {
    return url; // Return original URL if not from Cloudinary
  }

  const {
    quality = 'auto:good',
    format = 'auto',
    streaming = true,
    width = 1080,
    height,
    bitrate = '2m',
    fps = 30,
  } = options;

  const cloudName = extractCloudName(url);
  const publicId = extractCloudinaryPublicId(url);

  if (!cloudName || !publicId) {
    debugWarn('[Cloudinary] Could not extract Cloudinary details, returning original URL');
    return url;
  }

  // Build transformation parameters for optimal mobile video delivery
  const transformations = [
    `q_${quality}`, // Quality: auto adapts to network
    `f_${format}`, // Format: auto picks best format (mp4/webm)
    `w_${width}`, // Width for mobile screens
    height ? `h_${height}` : null,
    `c_limit`, // Don't upscale if source is smaller
    `br_${bitrate}`, // Bitrate: 2mbps is good for mobile
    `fps_${fps}`, // Frame rate
    'ac_none', // No audio codec change
    streaming ? 'sp_hd' : null, // Streaming profile for adaptive streaming
    'vc_auto', // Video codec: auto selects best
  ]
    .filter(Boolean)
    .join(',');

  // Ensure publicId has proper format (no double extensions)
  let finalPublicId = publicId;
  
  // If publicId doesn't end with a video extension, Cloudinary will add .mp4 automatically
  // But if it has a path with folders, we need to preserve that
  
  // Construct optimized URL with .mp4 extension explicitly
  const optimizedUrl = `https://res.cloudinary.com/${cloudName}/video/upload/${transformations}/${finalPublicId}.mp4`;

  debugLog('[Cloudinary] Optimized video URL:', {
    original: url.substring(0, 60) + '...',
    optimized: optimizedUrl.substring(0, 80) + '...',
    publicId: finalPublicId,
  });

  return optimizedUrl;
};

/**
 * Generate thumbnail from Cloudinary video
 */
export const getCloudinaryVideoThumbnail = (
  url: string,
  options: { width?: number; height?: number; time?: number } = {}
): string => {
  if (!url || !isCloudinaryUrl(url)) {
    return url;
  }

  const { width = 400, height = 600, time = 0 } = options;

  const cloudName = extractCloudName(url);
  const publicId = extractCloudinaryPublicId(url);

  if (!cloudName || !publicId) {
    return url;
  }

  // Generate thumbnail at specific time (default: first frame)
  const transformations = [
    `w_${width}`,
    `h_${height}`,
    'c_fill',
    'g_auto', // Auto gravity for best framing
    'q_auto:good',
    'f_auto', // Auto format (jpg/webp)
    `so_${time}`, // Start offset (time in seconds)
  ].join(',');

  return `https://res.cloudinary.com/${cloudName}/video/upload/${transformations}/${publicId}.jpg`;
};

/**
 * Get adaptive streaming URL (HLS/DASH)
 */
export const getCloudinaryStreamingUrl = (
  url: string,
  format: 'hls' | 'dash' = 'hls'
): string => {
  if (!url || !isCloudinaryUrl(url)) {
    return url;
  }

  const cloudName = extractCloudName(url);
  const publicId = extractCloudinaryPublicId(url);

  if (!cloudName || !publicId) {
    return url;
  }

  // HLS (m3u8) or DASH (mpd) for adaptive streaming
  const extension = format === 'hls' ? 'm3u8' : 'mpd';
  const transformations = 'q_auto:good,f_auto,sp_hd';

  return `https://res.cloudinary.com/${cloudName}/video/upload/${transformations}/${publicId}.${extension}`;
};

/**
 * Preload video for faster playback
 */
export const preloadCloudinaryVideo = async (
  url: string,
  sizeInMB: number = 2
): Promise<void> => {
  if (!url || !isCloudinaryUrl(url)) {
    return;
  }

  try {
    const optimizedUrl = optimizeCloudinaryVideoUrl(url, {
      quality: 'auto:low', // Use lower quality for preloading
      bitrate: '1m', // Lower bitrate for faster preload
    });

    const response = await fetch(optimizedUrl, {
      method: 'GET',
      headers: {
        Range: `bytes=0-${sizeInMB * 1024 * 1024}`, 
      },
    });

    if (response.ok) {
      // Read to cache
      await response.blob();
      debugLog(`[Cloudinary] Preloaded ${sizeInMB}MB of video`);
    }
  } catch (error) {
    debugWarn('[Cloudinary] Preload failed:', error);
  }
};



/**
 * Batch optimize multiple video URLs
 */



export const batchOptimizeCloudinaryVideos = (
  urls: string[],
  options: CloudinaryVideoOptions = {}
): string[] => {
  return urls.map((url) => optimizeCloudinaryVideoUrl(url, options));
};

