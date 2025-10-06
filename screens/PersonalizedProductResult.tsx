import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, SafeAreaView, Dimensions, Share, Alert, KeyboardAvoidingView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Video, ResizeMode } from 'expo-av';
import { getFirstSafeImageUrl, getProductImages, getFirstSafeProductImage } from '../utils/imageUtils';
import { ProductDetailsBottomSheet } from '../components/common';
import { supabase } from '../utils/supabase';
import { useUser } from '../contexts/UserContext';

const { width, height } = Dimensions.get('window');

interface Product {
  id: string;
  created_at: string;
  name: string;
  description: string;
  category_id: string;
  is_active: boolean;
  updated_at: string;
  featured_type?: 'trending' | 'best_seller' | null;
  like_count?: number;
  return_policy?: string;
  vendor_name?: string;
  alias_vendor?: string;
  stock_quantity?: number;
  image_urls?: string[];
  video_urls?: string[];
  rating?: number;
  reviews?: number;
  category?: {
    name: string;
  };
  variants: {
    id: string;
    product_id: string;
    color_id?: string;
    size_id: string;
    quantity: number;
    created_at: string;
    updated_at: string;
    price: number;
    sku?: string;
    mrp_price?: number;
    rsp_price?: number;
    cost_price?: number;
    discount_percentage?: number;
    image_urls?: string[];
    video_urls?: string[];
    size: {
      name: string;
    };
  }[];
}

type PersonalizedProductResultRouteProp = {
  product: {
    id: string;
    name: string;
    description: string;
    image_urls: string[];
    video_urls?: string[];
    faceSwapDate?: string;
    originalProductId?: string;
    isVideoPreview?: boolean;
    originalProductImage?: string;
  };
};

const PersonalizedProductResult = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { product } = (route.params as PersonalizedProductResultRouteProp) || {};
  const { t } = useTranslation();
  const { userData } = useUser();

  // Early return if no product data
  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Personalized Product</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No product data available</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [showProductDetailsSheet, setShowProductDetailsSheet] = useState(false);
  const [productForDetails, setProductForDetails] = useState<Product | null>(null);
  const [originalProduct, setOriginalProduct] = useState<Product | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
    const [showVideoControls, setShowVideoControls] = useState(true);
  const videoRef = useRef<any>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);
  const controlsOpacity = useRef(new Animated.Value(1)).current;

  // Function to start the timer to hide video controls after 2 seconds
  const startHideControlsTimer = useCallback(() => {
    // Clear any existing timer
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    
    // Set new timer to hide controls after 2 seconds
    hideControlsTimer.current = setTimeout(() => {
      // Animate fade out
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowVideoControls(false);
      });
    }, 2000);
  }, [controlsOpacity]);

  // Function to show controls and restart the timer
  const showControlsTemporarily = useCallback(() => {
    setShowVideoControls(true);
    // Animate fade in
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    startHideControlsTimer();
  }, [startHideControlsTimer, controlsOpacity]);

  // Get all personalized media (images or videos)
  // Prefer the theapi.app image first; fallback to provided order or second image
  const resultImagesRaw = product?.image_urls || [];
  const resultImages = (() => {
    if (!Array.isArray(resultImagesRaw) || resultImagesRaw.length === 0) return [];
    const idx = resultImagesRaw.findIndex(u => /theapi\.app/i.test(u));
    if (idx >= 0) {
      const copy = [...resultImagesRaw];
      const [picked] = copy.splice(idx, 1);
      return [picked, ...copy];
    }
    return resultImagesRaw.length > 1 ? [resultImagesRaw[1], ...resultImagesRaw.slice(0,1), ...resultImagesRaw.slice(2)] : resultImagesRaw;
  })();
  const resultVideos = product?.video_urls || [];
  const isVideoPreview = product?.isVideoPreview || false;
  const hasVideos = resultVideos.length > 0;

  // Start the timer when video begins playing or component mounts
  useEffect(() => {
    if (hasVideos) {
      // Reset controls to visible when video changes
      setShowVideoControls(true);
      controlsOpacity.setValue(1);
      
      if (isVideoPlaying) {
        startHideControlsTimer();
      }
    }
    
    // Cleanup timer on unmount
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, [hasVideos, isVideoPlaying, startHideControlsTimer, controlsOpacity]);

  // Safety check for selectedMediaIndex
  const safeSelectedIndex = Math.max(0, Math.min(
    selectedMediaIndex, 
    hasVideos ? resultVideos.length - 1 : resultImages.length - 1
  ));

  // Fetch original product details for Shop Now functionality
  useEffect(() => {
    const fetchOriginalProduct = async () => {
      if (!product?.originalProductId) return;

      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            category:categories(name),
            variants:product_variants(
              *,
              size:sizes(name)
            )
          `)
          .eq('id', product.originalProductId)
          .single();

        if (error) {
          console.error('Error fetching original product:', error);
          return;
        }

        setOriginalProduct(data);
      } catch (error) {
        console.error('Error fetching original product:', error);
      }
    };

    fetchOriginalProduct();
  }, [product?.originalProductId]);

  const getUserPrice = useCallback((product: Product) => {
    if (!product.variants || product.variants.length === 0) {
      return 0;
    }

    if (userData?.size) {
      const userSizeVariant = product.variants.find(v =>
        v.size?.name === userData.size
      );
      if (userSizeVariant) {
        return userSizeVariant.price;
      }
    }

    const sortedVariants = [...product.variants].sort((a, b) => a.price - b.price);
    return sortedVariants[0]?.price || 0;
  }, [userData?.size]);

  const handleShopNow = () => {
    if (!originalProduct) {
      Alert.alert('Error', 'Product details not available');
      return;
    }

    const userPrice = getUserPrice(originalProduct);

    // Get discount from first variant that has it
    const firstVariantWithDiscount = originalProduct.variants.find(v => v.discount_percentage && v.discount_percentage > 0);
    const discountPercentage = firstVariantWithDiscount?.discount_percentage || 0;
    const hasDiscount = discountPercentage > 0;
    const originalPrice = hasDiscount ? userPrice / (1 - discountPercentage / 100) : userPrice;

    // Prepare personalized media to show first in the product gallery
    const originalImageUrls = getProductImages(originalProduct);
    const originalVideoUrls = originalProduct.video_urls || [];
    
    let finalImageUrls = [...originalImageUrls];
    let finalVideoUrls = [...originalVideoUrls];
    let primaryImage = getFirstSafeProductImage(originalProduct);

    // If we have personalized results, put them first
    if (hasVideos && resultVideos.length > 0 && resultVideos[safeSelectedIndex]) {
      // 🎬 For video previews: Put personalized video FIRST in image_urls with video detection markers
      // Add video detection hints to ensure ProductDetailsBottomSheet detects it as video
      const personalizedVideoUrl = resultVideos[safeSelectedIndex];
      console.log('🎬 [Shop Now] Adding personalized video first:', personalizedVideoUrl);
      
      // Ensure video URL has video markers for detection
      let enhancedVideoUrl = personalizedVideoUrl;
      if (!enhancedVideoUrl.includes('.mp4') && !enhancedVideoUrl.includes('video')) {
        // Add video detection marker if not present
        enhancedVideoUrl = personalizedVideoUrl + (personalizedVideoUrl.includes('?') ? '&' : '?') + 'video=mp4';
      }
      
      finalImageUrls = [enhancedVideoUrl, ...originalImageUrls]; // Personalized video FIRST in images array
      finalVideoUrls = [...originalVideoUrls]; // Keep original videos separate
      
      // Keep original product image as fallback for thumbnail
      primaryImage = product?.originalProductImage || getFirstSafeProductImage(originalProduct);
    } else if (resultImages.length > 0 && resultImages[safeSelectedIndex]) {
      // For image previews, add personalized image first
      finalImageUrls = [resultImages[safeSelectedIndex], ...originalImageUrls];
      // Use personalized image as primary
      primaryImage = resultImages[safeSelectedIndex];
    }

    const productForDetails = {
      id: originalProduct.id,
      name: originalProduct.name, // 🎯 Clean product name without mentions
      price: userPrice,
      originalPrice: hasDiscount ? originalPrice : undefined,
      discount: Math.max(...(originalProduct.variants?.map(v => v.discount_percentage || 0) || [0])),
      rating: originalProduct.rating || 0,
      reviews: originalProduct.reviews || 0,
      image: primaryImage, // 🎯 Personalized image/video thumbnail as primary image
      image_urls: finalImageUrls, // 🎯 Personalized media FIRST, then original images
      video_urls: finalVideoUrls, // 🎯 Original videos  
      description: originalProduct.description, // 🎯 Clean description without mentions
      featured: originalProduct.featured_type !== null,
      images: finalImageUrls.length,
      sku: originalProduct.variants?.[0]?.sku || '',
      category: originalProduct.category?.name || '',
      vendor_name: originalProduct.vendor_name || '',
      alias_vendor: originalProduct.alias_vendor || '',
      return_policy: originalProduct.return_policy || '',
      // 🎬 Special flag to help ProductDetailsBottomSheet identify personalized video
      hasPersonalizedVideo: hasVideos,
      personalizedVideoUrl: hasVideos ? resultVideos[safeSelectedIndex] : undefined,
    };

    console.log('🛒 [Shop Now] Product data for bottom sheet:', {
      id: productForDetails.id,
      name: productForDetails.name,
      image_urls: productForDetails.image_urls,
      video_urls: productForDetails.video_urls,
      firstMediaUrl: productForDetails.image_urls[0],
      isPersonalizedVideo: hasVideos,
    });

    setProductForDetails(productForDetails as any);
    setShowProductDetailsSheet(true);
  };
  
  if (!product || (resultImages.length === 0 && resultVideos.length === 0)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Personalized Product</Text>
          <View style={styles.coinBalance}>
            <Text style={styles.coinText}># 9606</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No personalized {hasVideos ? 'videos' : 'images'} found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleSaveMedia = async (mediaUrl: string) => {
    try {
      // For now, just show an alert. In a real app, you'd implement actual media saving
      Alert.alert('Save Media', `${hasVideos ? 'Video' : 'Image'} saved to your gallery!`);
    } catch (error) {
      Alert.alert('Error', `Failed to save ${hasVideos ? 'video' : 'image'}`);
    }
  };

  const handleShareMedia = async (mediaUrl: string) => {
    try {
      await Share.share({
        message: `Check out my personalized ${product.name}!`,
        url: mediaUrl,
      });
    } catch (error) {
      Alert.alert('Error', `Failed to share ${hasVideos ? 'video' : 'image'}`);
    }
  };

  const renderResults = () => (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
    <View style={styles.resultsContainer}>
      <Text style={styles.resultsTitle}>
        {hasVideos ? 'Your Personalized Video' : (t('your_personalized_images') || 'Your Personalized Images')}
      </Text>
      <Text style={styles.resultsSubtitle}>
        {hasVideos ? 
          `Here is your personalized video with your face` : 
          `Here are ${resultImages.length} styled product images with your face`
        }
      </Text>

      {/* Main Media Display */}
      <View style={styles.mainImageContainer}>
        {hasVideos && resultVideos[safeSelectedIndex] ? (
          <TouchableOpacity
            activeOpacity={1}
            onPress={showControlsTemporarily}
            style={styles.mainImage}
          >
            <Video
              ref={videoRef}
              source={{ uri: resultVideos[safeSelectedIndex] }}
              style={styles.mainImage}
              useNativeControls={false}
              resizeMode={ResizeMode.COVER}
              shouldPlay={isVideoPlaying}
              isLooping={true}
              isMuted={false}
            />
          </TouchableOpacity>
        ) : resultImages[safeSelectedIndex] ? (
          <Image 
            source={{ uri: getFirstSafeImageUrl([resultImages[safeSelectedIndex]]) }} 
            style={styles.mainImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.mainImage}>
            <Text>No media available</Text>
          </View>
        )}
        {/* Video controls with smooth fade animation */}
        {hasVideos && resultVideos[safeSelectedIndex] && (
          <Animated.View 
            style={[
              styles.videoControlsContainer,
              { opacity: showVideoControls ? controlsOpacity : 0 }
            ]}
            pointerEvents={showVideoControls ? "auto" : "none"}
          >
            {/* Counter */}
            <View style={styles.videoCounter}>
              <Text style={styles.imageCounterText}>
                {safeSelectedIndex + 1} / {resultVideos.length}
              </Text>
            </View>
            
            {/* Play/Pause Button */}
            <TouchableOpacity 
              style={styles.videoPlayButton}
              activeOpacity={0.7}
              onPress={() => {
                setIsVideoPlaying(!isVideoPlaying);
                if (videoRef.current) {
                  if (isVideoPlaying) {
                    videoRef.current.pauseAsync();
                  } else {
                    videoRef.current.playAsync();
                  }
                }
                // Show controls again after interaction
                showControlsTemporarily();
              }}
            >
              <Ionicons 
                name={isVideoPlaying ? "pause-circle" : "play-circle"} 
                size={50} 
                color="rgba(255, 255, 255, 0.8)" 
              />
            </TouchableOpacity>
          </Animated.View>
        )}
        
        {/* Image counter (always visible for images) */}
        {!hasVideos && (
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {safeSelectedIndex + 1} / {resultImages.length}
            </Text>
          </View>
        )}
      </View>


      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => {
            const mediaUrl = hasVideos ? resultVideos[safeSelectedIndex] : resultImages[safeSelectedIndex];
            if (mediaUrl) handleSaveMedia(mediaUrl);
          }}
        >
          <Ionicons name="download-outline" size={20} color="#F53F7A" />
          <Text style={styles.actionButtonText}>{t('save') || 'Save'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => {
            const mediaUrl = hasVideos ? resultVideos[safeSelectedIndex] : resultImages[safeSelectedIndex];
            if (mediaUrl) handleShareMedia(mediaUrl);
          }}
        >
          <Ionicons name="share-outline" size={20} color="#F53F7A" />
          <Text style={styles.actionButtonText}>{t('share') || 'Share'}</Text>
        </TouchableOpacity>
      </View>

      {/* Shop Now Button */}
      {originalProduct && (
        <View style={styles.shopNowContainer}>
          <TouchableOpacity 
            style={styles.shopNowButton}
            onPress={handleShopNow}
          >
            <Ionicons name="bag-outline" size={20} color="#fff" />
            <Text style={styles.shopNowButtonText}>{t('shop_now') || 'Shop Now'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Face Swap</Text>
        <View style={styles.coinBalance}>
          <Text style={styles.coinText}># 9606</Text>
        </View>
      </View>
      
      {/* Main Content */}
      {renderResults()}

      {/* Product Details Bottom Sheet */}
      <ProductDetailsBottomSheet
        visible={showProductDetailsSheet}
        product={productForDetails as any}
        onClose={() => setShowProductDetailsSheet(false)}
      />
    </SafeAreaView>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  coinBalance: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F53F7A',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  resultsSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  mainImageContainer: {
    position: 'relative',
    width: '100%',
    height: height * 0.6,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  imageCounter: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  videoCounter: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 10,
  },
  videoControlsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  videoPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    zIndex: 5,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  thumbnailsContainer: {
    marginBottom: 24,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  selectedThumbnail: {
    borderColor: '#F53F7A',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F53F7A',
    minWidth: 120,
    justifyContent: 'center',
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#F53F7A',
  },
  shopNowContainer: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  shopNowButton: {
    backgroundColor: '#F53F7A',
    borderRadius: 25,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shopNowButtonText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});

export default PersonalizedProductResult; 