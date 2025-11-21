import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  Share,
  Linking,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import Constants from 'expo-constants';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useUser } from '~/contexts/UserContext';
import type { Product } from '~/types/product';
import { getProductImages, getAllSafeProductMedia, MediaItem } from '~/utils/imageUtils';

const { width: screenWidth } = Dimensions.get('window');

interface RouteParams {
  product: Product & {
    resellPrice?: number;
    margin?: number;
    basePrice?: number;
    availableSizes?: Array<{ id: string; name: string } | string>;
  };
}

const CatalogShare = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const { userData } = useUser();
  const { product } = route.params as RouteParams;
  
  const [loading, setLoading] = useState(false);
  const [downloadingImages, setDownloadingImages] = useState(false);
  const [downloadedImages, setDownloadedImages] = useState<string[]>([]);
  const [downloadedVideos, setDownloadedVideos] = useState<string[]>([]);
  const [savedImageAssets, setSavedImageAssets] = useState<string[]>([]); // Gallery asset URIs for images
  const [savedVideoAssets, setSavedVideoAssets] = useState<string[]>([]); // Gallery asset URIs for videos
  const [customMessage, setCustomMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [sharedImageCount, setSharedImageCount] = useState(0);
  const [sharedVideoCount, setSharedVideoCount] = useState(0);
  const successAnimation = useState(new Animated.Value(0))[0];

  const productImages = getProductImages(product);
  const productMedia = getAllSafeProductMedia(product);
  
  // Debug: Log media found
  useEffect(() => {
    console.log('[CatalogShare] Product media found:', productMedia.length);
    console.log('[CatalogShare] Images:', productMedia.filter(m => m.type === 'image').length);
    console.log('[CatalogShare] Videos:', productMedia.filter(m => m.type === 'video').length);
    console.log('[CatalogShare] Product variants:', product.variants?.length || product.product_variants?.length || 0);
    console.log('[CatalogShare] Product video_urls:', product.video_urls?.length || 0);
    if (product.variants) {
      product.variants.forEach((v: any, idx: number) => {
        console.log(`[CatalogShare] Variant ${idx} video_urls:`, v.video_urls?.length || 0);
      });
    }
  }, [productMedia, product]);
  
  // Extract available sizes - try multiple ways to get size data
  const extractAvailableSizes = (): string => {
    const variants = product.variants || product.product_variants || [];
    const sizeSet = new Set<string>();
    
    // Method 1: Try to get from variant.size.name
    variants.forEach((v: any) => {
      if (v.size?.name) {
        sizeSet.add(v.size.name);
      }
    });
    
    // Method 2: Try to get from variant.size_name (if size object is not populated)
    variants.forEach((v: any) => {
      if (v.size_name) {
        sizeSet.add(v.size_name);
      }
    });
    
    // Method 3: If product has availableSizes array (from ProductDetails)
    if (product.availableSizes && Array.isArray(product.availableSizes)) {
      product.availableSizes.forEach((s: any) => {
        if (s.name) sizeSet.add(s.name);
        if (typeof s === 'string') sizeSet.add(s);
      });
    }
    
    const sizes = Array.from(sizeSet).sort();
    return sizes.length > 0 ? sizes.join(', ') : 'N/A';
  };
  
  const availableSizes = extractAvailableSizes();
  const availableColors = product.variants?.map((v: any) => v.color?.name || v.color_name).filter(Boolean).join(', ') || 'N/A';

  // Convert Google Drive video URL to direct download URL
  const convertGoogleDriveVideoUrl = (url: string): string => {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('drive.google.com')) return url;

    try {
      let fileId: string | null = null;
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch) {
        fileId = fileMatch[1];
      } else {
        const ucMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (ucMatch) {
          fileId = ucMatch[1];
        }
      }

      if (fileId) {
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
      return url;
    } catch (error) {
      console.error('Error converting Google Drive video URL:', error);
      return url;
    }
  };

  // Download product images and videos
  const ensureMediaDownloadDirectory = async (): Promise<string> => {
    const fallbackDir = `${FileSystem.documentDirectory || ''}Only2UMedia/`;

    const ensureDir = async (dir: string) => {
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
    };

    if (Platform.OS === 'android') {
      const packageName =
        Constants?.expoConfig?.android?.package ||
        (Constants as any)?.manifest?.android?.package ||
        'com.only2u.app';

      const candidateDirs = [
        `file:///storage/emulated/0/Movies/Only2U/`,
        `file:///storage/emulated/0/Pictures/Only2U/`,
        `file:///storage/emulated/0/Android/media/${packageName}/Only2U/`,
      ];

      for (const dir of candidateDirs) {
        try {
          await ensureDir(dir);
          return dir;
        } catch (error) {
          console.warn('[CatalogShare] Unable to prepare directory', dir, error);
        }
      }
    }

    await ensureDir(fallbackDir);
    return fallbackDir;
  };

  const downloadProductMedia = async () => {
    if (downloadedImages.length > 0 && downloadedVideos.length > 0) {
      return { images: downloadedImages, videos: downloadedVideos };
    }
    
    setDownloadingImages(true);
    const downloadedImagePaths: string[] = [];
    const downloadedVideoPaths: string[] = [];
    
    try {
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access to save product media.');
        return { images: [], videos: [] };
      }

      // Prepare the base directory where media will be stored
      const downloadDirectory = await ensureMediaDownloadDirectory();

      // Download each product media item (images and videos)
      const mediaToDownload = productMedia.slice(0, 10); // Limit to 10 items total for better sharing
      
      for (let i = 0; i < mediaToDownload.length; i++) {
        const mediaItem = mediaToDownload[i];
        if (!mediaItem || !mediaItem.url) continue;

        try {
          const isVideo = mediaItem.type === 'video';
          // Convert video URL if it's a Google Drive URL
          const mediaUrl = isVideo ? convertGoogleDriveVideoUrl(mediaItem.url) : mediaItem.url;
          const extension = isVideo ? 'mp4' : 'jpg';
          const filename = `product_${product.id}_${isVideo ? 'video' : 'image'}_${i + 1}_${Date.now()}.${extension}`;
          const fileUri = `${downloadDirectory}${filename}`;
          
          console.log(`Downloading ${isVideo ? 'video' : 'image'}:`, mediaUrl, 'to:', fileUri);
          if (isVideo && mediaUrl !== mediaItem.url) {
            console.log(`[CatalogShare] Converted video URL from:`, mediaItem.url, 'to:', mediaUrl);
          }
          
          // Download the media with proper options
          const downloadResult = await FileSystem.downloadAsync(mediaUrl, fileUri, {
            headers: {
              'Accept': isVideo ? 'video/*' : 'image/*',
            },
          });
          
          if (downloadResult.status === 200) {
            console.log(`Successfully downloaded ${isVideo ? 'video' : 'image'}:`, downloadResult.uri);
            
            // Verify the file exists and is readable
            const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
            if (fileInfo.exists && fileInfo.size > 0) {
              if (isVideo) {
                // Additional validation for videos
                console.log(`Video file info - Size: ${fileInfo.size} bytes, URI: ${downloadResult.uri}`);
                // Ensure the file has .mp4 extension for proper recognition
                if (!downloadResult.uri.toLowerCase().endsWith('.mp4')) {
                  const newUri = downloadResult.uri.replace(/\.[^/.]+$/, '') + '.mp4';
                  try {
                    await FileSystem.moveAsync({
                      from: downloadResult.uri,
                      to: newUri,
                    });
                    console.log(`Renamed video file to .mp4:`, newUri);
                    downloadedVideoPaths.push(newUri);
                  } catch (renameError) {
                    console.log('Failed to rename video file, using original:', renameError);
                    downloadedVideoPaths.push(downloadResult.uri);
                  }
                } else {
                  downloadedVideoPaths.push(downloadResult.uri);
                }
              } else {
                downloadedImagePaths.push(downloadResult.uri);
              }
            } else {
              console.log(`Downloaded ${isVideo ? 'video' : 'image'} file is empty or doesn't exist - exists: ${fileInfo.exists}, size: ${fileInfo.size}`);
            }
          } else {
            console.log(`Download failed with status:`, downloadResult.status, 'for URL:', mediaUrl);
          }
        } catch (error) {
          console.log(`Failed to download ${mediaItem.type} ${i + 1}:`, error);
        }
      }
      
      console.log('Total downloaded images:', downloadedImagePaths.length);
      console.log('Total downloaded videos:', downloadedVideoPaths.length);
      setDownloadedImages(downloadedImagePaths);
      setDownloadedVideos(downloadedVideoPaths);
      return { images: downloadedImagePaths, videos: downloadedVideoPaths };
    } catch (error) {
      console.log('Error downloading media:', error);
      Alert.alert('Error', 'Failed to download product media. Sharing will continue without media.');
      return { images: [], videos: [] };
    } finally {
      setDownloadingImages(false);
    }
  };


  const generateShareContent = () => {
    let content = `🛍️ *${product.name}*\n\n`;
    content += `📝 ${product.description || 'Premium quality product'}\n\n`;
    
    if (product.resellPrice) {
      content += `💰 *Price: ₹${product.resellPrice}*\n`;
    } else {
      content += `💰 *Price: ₹${product.price}*\n`;
    }
    
    content += `📏 *Available Sizes: ${availableSizes}*\n`;
    content += `🎨 *Available Colors: ${availableColors}*\n\n`;
    
    if (customMessage) {
      content += `💬 *Message:* ${customMessage}\n\n`;
    }
    
    content += `🛒 Order now and get the best deals!\n`;
    content += `📱 Contact me for more details`;

    return content;
  };

  const handleShare = async () => {
    if (!userData?.id) {
      Alert.alert('Error', 'Please login to share products');
      return;
    }

    setLoading(true);
    try {
      const shareContent = generateShareContent();
      
      const { images: imagesToShare, videos: videosToShare } = await downloadProductMedia();
        
      const savedImageUris: string[] = [];
      const savedVideoUris: string[] = [];
      
      if (imagesToShare.length > 0 || videosToShare.length > 0) {
          try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === 'granted') {
              // Create or get the Only2U album
              const albumName = 'Only2U';
              let album: MediaLibrary.Album | null = null;
              
              try {
                // Try to find existing album
                const albums = await MediaLibrary.getAlbumsAsync();
                album = albums.find(a => a.title === albumName) || null;
                
                if (!album) {
                  // Create new album if it doesn't exist
                  album = await MediaLibrary.createAlbumAsync(albumName);
                  console.log('Created Only2U album:', album.id);
                } else {
                  console.log('Found existing Only2U album:', album.id);
                }
              } catch (albumError) {
                console.log('Error creating/getting album, saving to default location:', albumError);
              }
              
              // Save videos FIRST (so they appear on top in gallery)
              const allVideoAssets: MediaLibrary.Asset[] = [];
              for (const videoPath of videosToShare) {
                try {
                  // Verify file exists before saving
                  const fileInfo = await FileSystem.getInfoAsync(videoPath);
                  if (fileInfo.exists && fileInfo.size > 0) {
                    console.log('Attempting to save video to gallery:', videoPath, 'Size:', fileInfo.size);
                    
                    // Create asset
                    const asset = await MediaLibrary.createAssetAsync(videoPath);
                    console.log('Successfully saved video to gallery:', asset.id, 'Type:', asset.mediaType, 'Duration:', asset.duration);
                    
                    // Verify the asset was created and is a video
                    if (asset && asset.id) {
                      console.log('Video asset created successfully:', {
                        id: asset.id,
                        uri: asset.uri,
                        filename: asset.filename,
                        mediaType: asset.mediaType,
                      });
                      
                      // Add to album if available
                      if (album) {
                        try {
                          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                          console.log('Video added to Only2U album');
                        } catch (albumError) {
                          console.log('Failed to add video to album:', albumError);
                        }
                      }
                      
                      allVideoAssets.push(asset);
                      savedVideoUris.push(asset.uri);
                      
                      // Double-check it's actually a video
                      if (asset.mediaType === 'video' || asset.mediaType === 'unknown') {
                        console.log('Video saved successfully to gallery! URI:', asset.uri);
                      } else {
                        console.log('Warning: Asset type is not video:', asset.mediaType);
                      }
                    } else {
                      console.log('Video asset creation returned invalid result:', asset);
                      savedVideoUris.push(videoPath);
                    }
                  } else {
                    console.log('Video file does not exist or is empty:', videoPath);
                    savedVideoUris.push(videoPath);
                  }
                } catch (error: any) {
                  console.log('Failed to save video to gallery:', error);
                  savedVideoUris.push(videoPath);
                  
                  // Try alternative method
                  try {
                    if (!videoPath.toLowerCase().endsWith('.mp4')) {
                      const newPath = videoPath.replace(/\.[^/.]+$/, '') + '.mp4';
                      await FileSystem.moveAsync({ from: videoPath, to: newPath });
                      const asset = await MediaLibrary.createAssetAsync(newPath);
                      if (asset && asset.uri) {
                        if (album) {
                          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                        }
                        savedVideoUris[savedVideoUris.length - 1] = asset.uri;
                      }
                    }
                  } catch (altError) {
                    console.log('Alternative video save method failed:', altError);
                  }
                }
              }
              
              // Save images AFTER videos (so videos appear on top)
              const allImageAssets: MediaLibrary.Asset[] = [];
              for (const imagePath of imagesToShare) {
                try {
                  const fileInfo = await FileSystem.getInfoAsync(imagePath);
                  if (fileInfo.exists && fileInfo.size > 0) {
                    const asset = await MediaLibrary.createAssetAsync(imagePath);
                    console.log('Successfully saved image to gallery:', asset.id);
                    
                    // Add to album if available
                    if (album) {
                      try {
                        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                        console.log('Image added to Only2U album');
                      } catch (albumError) {
                        console.log('Failed to add image to album:', albumError);
                      }
                    }
                    
                    allImageAssets.push(asset);
                    savedImageUris.push(asset.uri);
                  } else {
                    console.log('Image file does not exist or is empty:', imagePath);
                    savedImageUris.push(imagePath);
                  }
                } catch (error) {
                  console.log('Failed to save image to gallery:', error);
                  savedImageUris.push(imagePath);
                }
              }
              
              // Store the saved asset URIs
              setSavedImageAssets(savedImageUris);
              setSavedVideoAssets(savedVideoUris);
            }
          } catch (error) {
            console.log('Failed to save media to gallery:', error);
            // Fallback to file paths
            setSavedImageAssets(imagesToShare);
            setSavedVideoAssets(videosToShare);
        }
      } else {
        // No media to save, use empty arrays
        setSavedImageAssets([]);
        setSavedVideoAssets([]);
      }

      // For sharing, use file paths (not asset URIs) as Share API needs accessible file paths
      // Asset URIs are for gallery tracking, but file paths work better for sharing
      // Videos especially need to be shared from file paths, not asset URIs
      console.log('Sharing images:', imagesToShare.length, 'videos:', videosToShare.length);
      console.log('Video paths for sharing:', videosToShare);
      
      await shareViaWhatsApp(shareContent, imagesToShare, videosToShare);

      // Show success modal with animation
      setSharedImageCount(imagesToShare.length);
      setSharedVideoCount(videosToShare.length);
      setShowSuccessModal(true);
      
      // Animate the success modal
      Animated.sequence([
        Animated.spring(successAnimation, {
          toValue: 1,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error: any) {
      console.error('Share error:', error);
      Alert.alert('Error', error.message || 'Failed to share catalog');
    } finally {
      setLoading(false);
    }
  };

  const shareViaWhatsApp = async (content: string, images: string[] = [], videos: string[] = []) => {
    // Share images and videos separately for better compatibility
    // Start with images first, then videos
    
    if (images.length > 0 || videos.length > 0) {
      try {
        console.log('Sharing with media:', images.length, 'images,', videos.length, 'videos');
        
        // Share images first
        if (images.length > 0) {
          console.log('Sharing images first...');
          const shareOptions = {
            message: content, // Include message with first image
            url: images[0],
            title: product.name,
            type: 'image/jpeg',
          };
          
          const shareResult = await Share.share(shareOptions, {
            dialogTitle: 'Share to WhatsApp',
            subject: product.name,
            UTI: 'public.jpeg',
            excludedActivityTypes: Platform.OS === 'ios' ? ['com.apple.UIKit.activity.Mail', 'com.apple.UIKit.activity.Message'] : undefined,
          });
          
          if (shareResult.action === Share.dismissedAction) {
            return;
          }
          
          // Share additional images
          if (images.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            for (let i = 1; i < Math.min(images.length, 5); i++) {
              try {
                await Share.share({
                  message: '',
                  url: images[i],
                  title: product.name,
                  type: 'image/jpeg',
                }, {
                  dialogTitle: 'Share additional image to WhatsApp',
                  subject: product.name,
                  UTI: 'public.jpeg',
                });
                if (i < Math.min(images.length, 5) - 1) {
                  await new Promise(resolve => setTimeout(resolve, 1500));
                }
              } catch (error) {
                console.log(`Failed to share additional image ${i + 1}:`, error);
              }
            }
          }
        } else if (videos.length > 0) {
          // If no images, share message with first video
          console.log('Sharing first video with message...');
          const shareOptions = {
            message: content,
            url: videos[0],
            title: product.name,
            type: 'video/mp4',
          };
          
          const shareResult = await Share.share(shareOptions, {
            dialogTitle: 'Share to WhatsApp',
            subject: product.name,
            UTI: 'public.mpeg-4',
            excludedActivityTypes: Platform.OS === 'ios' ? ['com.apple.UIKit.activity.Mail', 'com.apple.UIKit.activity.Message'] : undefined,
          });
          
          if (shareResult.action === Share.dismissedAction) {
            return;
          }
        }
        
        // Now share videos (after images, or if no images were shared)
        if (videos.length > 0) {
          const startIndex = images.length > 0 ? 0 : 1; // Skip first video if message was already shared with it
          await new Promise(resolve => setTimeout(resolve, images.length > 0 ? 2000 : 0));
          
          for (let i = startIndex; i < Math.min(videos.length, 5); i++) {
            try {
              console.log(`Sharing video ${i + 1}/${videos.length}:`, videos[i]);
              
              // Verify video file exists before sharing
              const fileInfo = await FileSystem.getInfoAsync(videos[i]);
              if (!fileInfo.exists || fileInfo.size === 0) {
                console.log(`Video file ${i + 1} does not exist or is empty, skipping`);
                continue;
              }
              
              await Share.share({
                message: i === startIndex && images.length === 0 ? content : '', // Include message only with first video if no images
                url: videos[i],
                title: product.name,
                type: 'video/mp4',
              }, {
                dialogTitle: `Share video ${i + 1} to WhatsApp`,
                subject: product.name,
                UTI: 'public.mpeg-4',
              });
              
              if (i < Math.min(videos.length, 5) - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay for videos
              }
            } catch (error: any) {
              console.log(`Failed to share video ${i + 1}:`, error.message || error);
            }
          }
        }
      } catch (error) {
        console.log('Error sharing with media, trying alternative method:', error);
        
        // Method 3: Alternative approach - try to open WhatsApp directly with media
        try {
          // First, share the text message
          const url = `whatsapp://send?text=${encodeURIComponent(content)}`;
          const canOpen = await Linking.canOpenURL(url);
          
          if (canOpen) {
            await Linking.openURL(url);
            
            // Wait for WhatsApp to open, then try to share media
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Share images first
            for (let i = 0; i < Math.min(images.length, 5); i++) {
              try {
                await Share.share({
                  message: '',
                  url: images[i],
                  title: product.name,
                  type: 'image/jpeg',
                });
                if (i < Math.min(images.length, 5) - 1) {
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
              } catch (imgError) {
                console.log(`Failed to share image ${i + 1}:`, imgError);
              }
            }
            
            // Then share videos
            if (videos.length > 0) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              for (let i = 0; i < Math.min(videos.length, 5); i++) {
                try {
                  await Share.share({
                    message: '',
                    url: videos[i],
                    title: product.name,
                    type: 'video/mp4',
                  });
                  if (i < Math.min(videos.length, 5) - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                  }
                } catch (videoError) {
                  console.log(`Failed to share video ${i + 1}:`, videoError);
                }
              }
            }
          } else {
            // Final fallback to web WhatsApp
            const webUrl = `https://wa.me/?text=${encodeURIComponent(content)}`;
            await Linking.openURL(webUrl);
          }
        } catch (fallbackError) {
          console.log('All methods failed, using text-only');
          // Final fallback to text-only
          const url = `whatsapp://send?text=${encodeURIComponent(content)}`;
          const canOpen = await Linking.canOpenURL(url);
          
          if (canOpen) {
            await Linking.openURL(url);
          } else {
            const webUrl = `https://wa.me/?text=${encodeURIComponent(content)}`;
            await Linking.openURL(webUrl);
          }
        }
      }
    } else {
      // Text-only sharing
      const url = `whatsapp://send?text=${encodeURIComponent(content)}`;
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        const webUrl = `https://wa.me/?text=${encodeURIComponent(content)}`;
        await Linking.openURL(webUrl);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Product</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Product Preview */}
        <View style={styles.productPreview}>
          <Text style={styles.previewTitle}>Product Preview</Text>
          <View style={styles.productCard}>
            <Image
              source={{ uri: productImages[0] || product.image }}
              style={styles.productImage}
              resizeMode="cover"
            />
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {product.name}
              </Text>
              
              {/* Price Display with Margin Information */}
              <View style={styles.priceContainer}>
                {product.resellPrice ? (
                  <>
                    <Text style={styles.resellPrice}>₹{product.resellPrice}</Text>
                    <View style={styles.marginInfo}>
                      <Text style={styles.basePrice}>Base: ₹{product.basePrice || product.price}</Text>
                      <Text style={styles.marginText}>+{product.margin}% margin</Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.productPrice}>₹{product.price}</Text>
                )}
              </View>
              
              <Text style={styles.productDescription} numberOfLines={3}>
                {product.description || 'Premium quality product'}
              </Text>
              <View style={styles.productDetails}>
                <Text style={styles.detailText}>Sizes: {availableSizes}</Text>
                <Text style={styles.detailText}>Colors: {availableColors}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Custom Message */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Message (Optional)</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Add a personal message to your catalog..."
            value={customMessage}
            onChangeText={setCustomMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>


        {/* Share Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Share Preview</Text>
          <View style={styles.sharePreview}>
            <Text style={styles.sharePreviewText}>{generateShareContent()}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Share Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.shareButton, (loading || downloadingImages) && styles.shareButtonDisabled]}
          onPress={handleShare}
          disabled={loading || downloadingImages}
        >
          {loading || downloadingImages ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.shareButtonText}>
                {downloadingImages ? 'Downloading Media...' : 
                 'Sharing...'}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={styles.shareButtonText}>Share via WhatsApp</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          successAnimation.setValue(0);
          setShowSuccessModal(false);
        }}
      >
        <View style={styles.successModalOverlay}>
          <Animated.View
            style={[
              styles.successModalContent,
              {
                transform: [
                  {
                    scale: successAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
                opacity: successAnimation,
              },
            ]}
          >
            {/* Success Icon with Animation */}
            <View style={styles.successIconContainer}>
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: successAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                }}
              >
                <Ionicons name="checkmark-circle" size={80} color="#10B981" />
              </Animated.View>
            </View>

            {/* Success Title */}
            <Text style={styles.successTitle}>🎉 Shared Successfully!</Text>

            {/* Success Message */}
            <Text style={styles.successMessage}>
              Your product has been shared to WhatsApp{
                sharedImageCount > 0 || sharedVideoCount > 0
                  ? ` with ${sharedImageCount > 0 ? `${sharedImageCount} image${sharedImageCount > 1 ? 's' : ''}` : ''}${sharedImageCount > 0 && sharedVideoCount > 0 ? ' and ' : ''}${sharedVideoCount > 0 ? `${sharedVideoCount} video${sharedVideoCount > 1 ? 's' : ''}` : ''}`
                  : ''
              }.
            </Text>

            {/* Details */}
            {(sharedImageCount > 0 || sharedVideoCount > 0) && (
              <View style={styles.successDetails}>
                {sharedImageCount > 0 && (
                  <View style={styles.successDetailRow}>
                    <Ionicons name="images" size={20} color="#F53F7A" />
                    <Text style={styles.successDetailText}>
                      {sharedImageCount} {sharedImageCount === 1 ? 'image' : 'images'} saved to Only2U album
                    </Text>
                  </View>
                )}
                {sharedVideoCount > 0 && (
                  <View style={styles.successDetailRow}>
                    <Ionicons name="videocam" size={20} color="#F53F7A" />
                    <Text style={styles.successDetailText}>
                      {sharedVideoCount} {sharedVideoCount === 1 ? 'video' : 'videos'} saved to Only2U album (videos appear first)
                    </Text>
                  </View>
                )}
                <View style={styles.successDetailRow}>
                  <Ionicons name="folder" size={20} color="#F53F7A" />
                  <Text style={styles.successDetailText}>
                    Find all content in the "Only2U" album in your gallery
                  </Text>
                </View>
                <View style={styles.successDetailRow}>
                  <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                  <Text style={styles.successDetailText}>
                    Ready to share with your customers
                  </Text>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.successButtonsContainer}>
              {sharedImageCount > 0 && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      Linking.openURL('photos-redirect://');
                    } else {
                      Linking.openURL('content://media/external/images/media/');
                    }
                  }}
                >
                  <Ionicons name="folder-open-outline" size={18} color="#F53F7A" />
                  <Text style={styles.secondaryButtonText}>Open Gallery</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  successAnimation.setValue(0);
                  setShowSuccessModal(false);
                  navigation.goBack();
                }}
              >
                <Text style={styles.primaryButtonText}>Done</Text>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  productPreview: {
    marginTop: 16,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  productCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F53F7A',
    marginBottom: 8,
  },
  priceContainer: {
    marginBottom: 8,
  },
  resellPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 4,
  },
  marginInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  basePrice: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'line-through',
  },
  marginText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  productDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  productDetails: {
    gap: 2,
  },
  detailText: {
    fontSize: 12,
    color: '#999',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    height: 100,
  },
  sharePreview: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F53F7A',
  },
  sharePreviewText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  bottomContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Success Modal Styles
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  successDetails: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  successDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  successDetailText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  successButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F4',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFD6E0',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F53F7A',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default CatalogShare;
