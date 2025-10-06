/**
 * Utility functions for handling image URLs, especially Google Drive links
 */

// Default fallback image URLs
export const FALLBACK_IMAGES = {
  product: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300&h=300&fit=crop',
  placeholder: 'https://via.placeholder.com/300x300?text=No+Image',
  fashion: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=300&h=300&fit=crop',
};

/**
 * Convert Google Drive sharing URL to direct image URL
 * @param url - Google Drive sharing URL
 * @returns Direct image URL or null if conversion fails
 */
export const convertGoogleDriveUrl = (url: string): string | null => {
  if (!url || typeof url !== 'string') return null;

  // Remove any leading @ symbol
  const cleanUrl = url.replace(/^@/, '');

  // Check if it's a Google Drive URL
  if (!cleanUrl.includes('drive.google.com')) return null;

  try {
    // Handle different Google Drive URL formats
    let fileId: string | null = null;

    // Format 1: https://drive.google.com/file/d/{fileId}/view?usp=sharing
    const fileMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) {
      fileId = fileMatch[1];
    }

    // Format 2: https://drive.google.com/open?id={fileId}
    const openMatch = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (openMatch) {
      fileId = openMatch[1];
    }

    // Format 3: https://drive.google.com/thumbnail?id={fileId}&sz=w400
    const thumbnailMatch = cleanUrl.match(/thumbnail\?id=([a-zA-Z0-9_-]+)/);
    if (thumbnailMatch) {
      fileId = thumbnailMatch[1];
    }

    if (fileId) {
      // Try multiple Google Drive URL formats for better reliability
      // Method 1: Direct download URL (most reliable for images)
      const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

      // Method 2: Thumbnail URL with different sizes
      const thumbnailUrl1 = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
      const thumbnailUrl2 = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;

      // Method 3: View URL
      const viewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

      // Return the direct download URL as it's most likely to work
      return directUrl;
    }

    return null;
  } catch (error) {
    console.error('Error converting Google Drive URL:', error);
    return null;
  }
};

/**
 * Get a safe image URL that works in React Native
 * @param url - Original image URL
 * @param fallbackType - Type of fallback image to use
 * @returns Safe image URL
 */
export const getSafeImageUrl = (
  url: string | null | undefined,
  fallbackType: 'product' | 'placeholder' | 'fashion' = 'product'
): string => {
  if (!url || typeof url !== 'string') {
    return FALLBACK_IMAGES[fallbackType];
  }

  // Remove any leading @ symbol
  const cleanUrl = url.replace(/^@/, '');

  // If it's a Google Drive URL, try to convert it
  if (cleanUrl.includes('drive.google.com')) {
    const convertedUrl = convertGoogleDriveUrl(cleanUrl);
    if (convertedUrl) {
      return convertedUrl;
    }
    // If conversion fails, return fallback
    return FALLBACK_IMAGES[fallbackType];
  }

  // For other URLs, check if they're valid
  try {
    new URL(cleanUrl);
    return cleanUrl;
  } catch (error) {
    // Invalid URL, return fallback
    return FALLBACK_IMAGES[fallbackType];
  }
};

/**
 * Process an array of image URLs and return safe URLs
 * @param urls - Array of image URLs
 * @param fallbackType - Type of fallback image to use
 * @returns Array of safe image URLs
 */
export const getSafeImageUrls = (
  urls: string[] | null | undefined,
  fallbackType: 'product' | 'placeholder' | 'fashion' = 'product'
): string[] => {
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return [FALLBACK_IMAGES[fallbackType]];
  }

  const safeUrls = urls
    .map((url) => getSafeImageUrl(url, fallbackType))
    .filter((url) => url !== FALLBACK_IMAGES[fallbackType] || urls.length === 1); // Keep fallback only if it's the only image

  return safeUrls.length > 0 ? safeUrls : [FALLBACK_IMAGES[fallbackType]];
};

/**
 * Get the first safe image URL from an array
 * @param urls - Array of image URLs
 * @param fallbackType - Type of fallback image to use
 * @returns First safe image URL
 */
export const getFirstSafeImageUrl = (
  urls: string[] | null | undefined,
  fallbackType: 'product' | 'placeholder' | 'fashion' = 'product'
): string => {
  const safeUrls = getSafeImageUrls(urls, fallbackType);
  return safeUrls[0];
};

/**
 * Prefer API-rendered result image when present.
 * Moves any URL that includes "theapi.app" to the front so preview uses it.
 */
export const preferApiRenderedImageFirst = (urls: string[] | null | undefined): string[] => {
  if (!urls || !Array.isArray(urls) || urls.length === 0) return [];
  const theApi = urls.find(u => typeof u === 'string' && /theapi\.app/i.test(u));
  if (!theApi) return urls;
  const others = urls.filter(u => u !== theApi);
  return [theApi, ...others];
};

/**
 * Extract images from product variants with fallback to product images
 * @param product - Product object with variants
 * @returns Array of image URLs
 */
export const getProductImages = (product: any): string[] => {
  if (!product) return [];

  const variants = product.variants || product.product_variants || [];

  // Get images from the first variant that has images
  const variantImages =
    variants.find((v: any) => v.image_urls && v.image_urls.length > 0)?.image_urls || [];

  // Fallback to product images
  const productImages = product.image_urls || [];

  // Return variant images if available, otherwise product images
  return variantImages.length > 0 ? variantImages : productImages;
};

/**
 * Get the first safe image URL from product variants with fallback
 * @param product - Product object with variants
 * @returns First image URL or fallback image
 */
export const getFirstSafeProductImage = (product: any): string => {
  if (!product) return FALLBACK_IMAGES.product;

  const variants = product.variants || product.product_variants || [];

  // First, try to get images from variants
  for (const variant of variants) {
    if (variant.image_urls && Array.isArray(variant.image_urls) && variant.image_urls.length > 0) {
      const firstVariantImage = variant.image_urls[0];
      if (firstVariantImage) {
        return getSafeImageUrl(firstVariantImage);
      }
    }
  }

  // Fallback to product images
  if (product.image_urls && Array.isArray(product.image_urls) && product.image_urls.length > 0) {
    const firstProductImage = product.image_urls[0];
    if (firstProductImage) {
      return getSafeImageUrl(firstProductImage);
    }
  }

  // Final fallback
  return FALLBACK_IMAGES.product;
};

export type MediaItem = {
  type: 'image' | 'video';
  url: string;
};

export const getAllSafeProductMedia = (product: any): MediaItem[] => {
  if (!product) return [{ type: 'image', url: FALLBACK_IMAGES.product }];

  const media: MediaItem[] = [];

  const variants = product.variants || product.product_variants || [];

  // Collect images from variants
  for (const variant of variants) {
    if (Array.isArray(variant.image_urls)) {
      for (const url of variant.image_urls) {
        if (url) media.push({ type: 'image', url: getSafeImageUrl(url) });
      }
    }
    if (Array.isArray(variant.video_urls)) {
      for (const url of variant.video_urls) {
        if (url) media.push({ type: 'video', url });
      }
    }
  }

  // Collect images from product
  if (Array.isArray(product.image_urls)) {
    for (const url of product.image_urls) {
      if (url) media.push({ type: 'image', url: getSafeImageUrl(url) });
    }
  }

  // Collect videos from product
  if (Array.isArray(product.video_urls)) {
    for (const url of product.video_urls) {
      if (url) media.push({ type: 'video', url });
    }
  }

  // Remove duplicates
  const uniqueMedia = Array.from(new Map(media.map((m) => [m.url, m])).values());

  // Fallback if nothing valid found
  return uniqueMedia.length > 0 ? uniqueMedia : [{ type: 'image', url: FALLBACK_IMAGES.product }];
};

export default {
  convertGoogleDriveUrl,
  getSafeImageUrl,
  getSafeImageUrls,
  getFirstSafeImageUrl,
  FALLBACK_IMAGES,
};
