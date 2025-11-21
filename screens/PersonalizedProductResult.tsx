import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions, Share, Alert, KeyboardAvoidingView, Animated, Modal, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Video, ResizeMode } from 'expo-av';
import { PinchGestureHandler, PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
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
  const [isFullScreenVisible, setIsFullScreenVisible] = useState(false);
  const [fullScreenMediaType, setFullScreenMediaType] = useState<'image' | 'video'>('image');
  const [isFullScreenVideoPlaying, setIsFullScreenVideoPlaying] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(1);
  const videoRef = useRef<any>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);
  const controlsOpacity = useRef(new Animated.Value(1)).current;

  // Zoom and pan state
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const combinedScale = Animated.multiply(baseScale, pinchScale);
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);

  const resetZoom = useCallback(() => {
    baseScale.setValue(1);
    pinchScale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
    translateX.setOffset(0);
    translateY.setOffset(0);
    translateX.flattenOffset();
    translateY.flattenOffset();
    lastScale.current = 1;
    lastTranslateX.current = 0;
    lastTranslateY.current = 0;
    setCurrentZoom(1);
  }, [baseScale, pinchScale, translateX, translateY, setCurrentZoom]);

  // Reset zoom when changing media or closing fullscreen
  useEffect(() => {
    resetZoom();
  }, [selectedMediaIndex, resetZoom]);

  // Pinch gesture handler
  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

  const onPinchStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      let nextScale = lastScale.current * event.nativeEvent.scale;
      nextScale = Math.max(1, Math.min(nextScale, 2.5)); // Clamp between 1x and 2.5x
      baseScale.setValue(nextScale);
      pinchScale.setValue(1);
      lastScale.current = nextScale;
      setCurrentZoom(parseFloat(nextScale.toFixed(2)));

      // Reset translation if scale returns to 1
      if (nextScale === 1) {
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start();
        translateX.setOffset(0);
        translateY.setOffset(0);
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
      }
    }
  };

  const openFullScreen = useCallback(
    (type: 'image' | 'video') => {
      setFullScreenMediaType(type);
      setIsFullScreenVisible(true);
      if (type === 'video') {
        setIsVideoPlaying(false);
        setIsFullScreenVideoPlaying(true);
      } else {
        resetZoom();
        setCurrentZoom(1);
      }
    },
    [resetZoom, setIsFullScreenVideoPlaying, setCurrentZoom, setIsVideoPlaying]
  );

  const closeFullScreen = useCallback(() => {
    setIsFullScreenVisible(false);
    if (fullScreenMediaType === 'video') {
      setIsVideoPlaying(true);
      setIsFullScreenVideoPlaying(false);
    }
    resetZoom();
    setCurrentZoom(1);
  }, [fullScreenMediaType, resetZoom, setIsFullScreenVideoPlaying, setCurrentZoom, setIsVideoPlaying]);

  // Pan gesture handler
  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    {
      useNativeDriver: true,
      listener: (event: any) => {
        if (lastScale.current <= 1) {
          translateX.setValue(0);
          translateY.setValue(0);
        }
      },
    }
  );

  const onPanStateChange = (event: any) => {
    if (lastScale.current <= 1) {
      translateX.setOffset(0);
      translateY.setOffset(0);
      translateX.setValue(0);
      translateY.setValue(0);
      return;
    }

    if (event.nativeEvent.state === State.BEGAN) {
      translateX.setOffset(lastTranslateX.current);
      translateX.setValue(0);
      translateY.setOffset(lastTranslateY.current);
      translateY.setValue(0);
    }

    if (event.nativeEvent.oldState === State.ACTIVE) {
      lastTranslateX.current += event.nativeEvent.translationX;
      lastTranslateY.current += event.nativeEvent.translationY;
      translateX.flattenOffset();
      translateY.flattenOffset();
    }
  };

  // Double tap to reset zoom
  const handleDoubleTap = () => {
    if (lastScale.current > 1) {
      // Reset zoom
      Animated.parallel([
        Animated.spring(baseScale, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(pinchScale, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
      lastScale.current = 1;
      lastTranslateX.current = 0;
      lastTranslateY.current = 0;
      translateX.setOffset(0);
      translateY.setOffset(0);
      translateX.setValue(0);
      translateY.setValue(0);
      setCurrentZoom(1);
    } else {
      // Zoom in to 2x
      Animated.parallel([
        Animated.spring(baseScale, {
          toValue: 2,
          useNativeDriver: true,
        }),
        Animated.spring(pinchScale, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
      translateX.setOffset(0);
      translateY.setOffset(0);
      translateX.setValue(0);
      translateY.setValue(0);
      lastScale.current = 2;
      setCurrentZoom(2);
    }
  };

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
              shouldPlay={isVideoPlaying && !isFullScreenVisible}
              isLooping={true}
              isMuted={false}
            />
            <TouchableOpacity
              style={styles.expandHint}
              activeOpacity={0.8}
              onPress={() => openFullScreen('video')}
            >
              <Ionicons name="expand-outline" size={16} color="#fff" />
              <Text style={styles.expandHintText}>Full view</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ) : resultImages[safeSelectedIndex] ? (
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => openFullScreen('image')}
            style={styles.mainImage}
          >
            <Image 
              source={{ uri: getFirstSafeImageUrl([resultImages[safeSelectedIndex]]) }} 
              style={styles.mainImage}
              resizeMode="cover"
            />
            <View style={styles.expandHint}>
              <Ionicons name="expand-outline" size={16} color="#fff" />
              <Text style={styles.expandHintText}>Full view</Text>
            </View>
          </TouchableOpacity>
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
        {originalProduct && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.shopNowButton]}
            onPress={handleShopNow}
          >
            <Ionicons name="bag-outline" size={20} color="#fff" />
            <Text style={[styles.actionButtonText, styles.shopNowButtonText] }>
              {t('shop_now') || 'Shop Now'}
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.shareButton]}
          onPress={() => {
            const mediaUrl = hasVideos ? resultVideos[safeSelectedIndex] : resultImages[safeSelectedIndex];
            if (mediaUrl) handleShareMedia(mediaUrl);
          }}
        >
          <Ionicons name="share-outline" size={20} color="#F53F7A" />
          <Text style={styles.actionButtonText}>{t('share') || 'Share'}</Text>
        </TouchableOpacity>
      </View>
    </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Clean Modern Header */}
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Preview</Text>
          <View style={styles.headerRight}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          </View>
        </View>
      </View>
      
      {/* Main Content */}
      {renderResults()}

      <Modal
        visible={isFullScreenVisible}
        animationType="fade"
        transparent={false}
        onRequestClose={closeFullScreen}
        presentationStyle="fullScreen"
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.fullscreenContainer}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />
            <SafeAreaView style={styles.fullscreenSafeArea}>
              <View style={styles.fullscreenHeader}>
                <TouchableOpacity
                  onPress={closeFullScreen}
                  style={styles.fullscreenCloseButton}
                >
                  <Ionicons name="close" size={26} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.fullscreenTitle}>Preview</Text>
                <View style={styles.fullscreenHeaderAction}>
                  {fullScreenMediaType === 'video' ? (
                    <TouchableOpacity
                      onPress={() => setIsFullScreenVideoPlaying(prev => !prev)}
                      style={styles.fullscreenControlButton}
                    >
                      <Ionicons
                        name={isFullScreenVideoPlaying ? 'pause' : 'play'}
                        size={22}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={resetZoom}
                      style={styles.fullscreenControlButton}
                    >
                      <Ionicons name="refresh" size={22} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.fullscreenContent}>
                {fullScreenMediaType === 'video' && hasVideos && resultVideos[safeSelectedIndex] ? (
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setIsFullScreenVideoPlaying(prev => !prev)}
                    style={styles.fullscreenMedia}
                  >
                    <Video
                      source={{ uri: resultVideos[safeSelectedIndex] }}
                      style={styles.fullscreenMedia}
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay={isFullScreenVideoPlaying}
                      useNativeControls
                      isLooping
                    />
                  </TouchableOpacity>
                ) : fullScreenMediaType === 'image' && resultImages[safeSelectedIndex] ? (
                  <PanGestureHandler
                    onGestureEvent={onPanEvent}
                    onHandlerStateChange={onPanStateChange}
                    minPointers={1}
                    maxPointers={1}
                    avgTouches
                  >
                    <Animated.View style={styles.fullscreenMedia}>
                      <PinchGestureHandler
                        onGestureEvent={onPinchEvent}
                        onHandlerStateChange={onPinchStateChange}
                      >
                        <Animated.View style={styles.fullscreenMedia}>
                          <TouchableOpacity
                            activeOpacity={1}
                            onPress={handleDoubleTap}
                            style={styles.fullscreenMedia}
                          >
                            <Animated.Image
                              source={{ uri: getFirstSafeImageUrl([resultImages[safeSelectedIndex]]) }}
                              style={[
                                styles.fullscreenMedia,
                                {
                                  transform: [
                                    { scale: combinedScale },
                                    { translateX },
                                    { translateY },
                                  ],
                                },
                              ]}
                              resizeMode="contain"
                            />
                          </TouchableOpacity>
                          <View style={styles.fullscreenHint}>
                            <Ionicons name="hand-left-outline" size={16} color="#fff" />
                            <Text style={styles.fullscreenHintText}>Pinch & drag to explore</Text>
                          </View>
                          {currentZoom > 1 && (
                            <View style={styles.zoomIndicator}>
                              <Ionicons name="expand-outline" size={16} color="#fff" />
                              <Text style={styles.zoomIndicatorText}>
                                {currentZoom.toFixed(1)}x
                              </Text>
                            </View>
                          )}
                        </Animated.View>
                      </PinchGestureHandler>
                    </Animated.View>
                  </PanGestureHandler>
                ) : (
                  <View style={styles.fullscreenEmpty}>
                    <Text style={styles.fullscreenEmptyText}>No media available</Text>
                  </View>
                )}
              </View>
            </SafeAreaView>
          </View>
        </GestureHandlerRootView>
      </Modal>

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
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  coinBalance: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
    paddingVertical: 20,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  resultsSubtitle: {
    fontSize: 14,
    color: '#737373',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  mainImageContainer: {
    position: 'relative',
    width: '100%',
    height: height * 0.55,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  expandHint: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandHintText: {
    marginLeft: 6,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  imageCounter: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  videoCounter: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  videoControlsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 40,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  zoomIndicator: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  zoomIndicatorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
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
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginBottom: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  actionButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    letterSpacing: 0.2,
  },
  shareButton: {
    borderColor: '#F53F7A',
  },
  shopNowButton: {
    backgroundColor: '#F53F7A',
    borderColor: '#F53F7A',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  shopNowButtonText: {
    color: '#fff',
  },
  shopNowContainer: {
    marginTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 24,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenSafeArea: {
    flex: 1,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  fullscreenCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  fullscreenTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  fullscreenHeaderAction: {
    width: 44,
    alignItems: 'flex-end',
  },
  fullscreenControlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  fullscreenContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenMedia: {
    width: '100%',
    height: '100%',
  },
  fullscreenHint: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  fullscreenHintText: {
    marginLeft: 8,
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  fullscreenEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenEmptyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PersonalizedProductResult; 