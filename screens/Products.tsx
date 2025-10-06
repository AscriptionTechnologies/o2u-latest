import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Dimensions, Vibration ,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
  FlatList,
  TextInput,
} from 'react-native';
import { PanGestureHandler, Pressable } from 'react-native-gesture-handler';
import { Ionicons, MaterialCommunityIcons , MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '~/utils/supabase';
import { useWishlist } from '~/contexts/WishlistContext';
import { useUser } from '~/contexts/UserContext';
import { SaveToCollectionSheet } from '~/components/common';
import { useTranslation } from 'react-i18next';
import i18n from '../utils/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '@gorhom/bottom-sheet';
import {
  getFirstSafeImageUrl,
  getProductImages,
  getFirstSafeProductImage,
  FALLBACK_IMAGES,
  getAllSafeProductMedia,
} from '../utils/imageUtils';
import type { Product } from '~/types/product';
import OverlayLabel from '~/components/overlay';
import { ImageBackground } from 'expo-image';
import { ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

// Get screen dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// cardHeight constant for backward compatibility - increased for better visibility
const cardHeight = Math.min(screenHeight * 0.70, 520); // 70% of screen height, max 520
// Export cardHeight for external use
export { cardHeight };
interface Category {
  id: string;
  name: string;
  description: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type RouteParams = {
  category: Category;
  featuredType?: 'trending' | 'best_seller';
};

// Tinder Card Component
const TinderCard = ({
  product,
  index,
  onSwipe,
  productPrices,
  productRatings,
  getUserPrice,
  isInWishlist,
  removeFromWishlist,
  setSelectedProduct,
  setShowCollectionSheet,
  navigation,
}: any) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const rotateStr = rotate.interpolate({
    inputRange: [-100, 0, 100],
    outputRange: ['-30deg', '0deg', '30deg'],
    extrapolate: 'clamp',
  });

  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { 
      useNativeDriver: false,
      listener: (event: any) => {
        // Real-time physics updates for smoother card movement
        const { translationX, translationY, velocityX, velocityY } = event.nativeEvent;
        
        // Enhanced rotation based on velocity and position
        const rotationValue = (translationX / 8) + (velocityX * 0.001);
        rotate.setValue(rotationValue);
        
        // Dynamic scaling based on distance and velocity
        const distance = Math.sqrt(translationX * translationX + translationY * translationY);
        const maxDistance = screenWidth * 0.6;
        const velocityFactor = Math.min(Math.abs(velocityX) / 1000, 0.5);
        const scaleValue = Math.max(0.88, 1 - (distance / maxDistance) * 0.12 - velocityFactor * 0.08);
        
        scale.setValue(scaleValue);
        
        // Subtle vertical movement based on horizontal velocity
        const verticalOffset = translationY + (velocityX * 0.05);
        translateY.setValue(verticalOffset);
      }
    }
  );

  const onPanHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === 4) {
      // ACTIVE - Enhanced physics with momentum
      const { translationX, translationY, velocityX, velocityY } = event.nativeEvent;
      const threshold = screenWidth * 0.2; // Reduced threshold for easier swipes
      const velocityThreshold = 500; // Minimum velocity for quick swipes

      const shouldSwipe = Math.abs(translationX) > threshold || Math.abs(velocityX) > velocityThreshold;

      if (shouldSwipe) {
        // Add haptic feedback for swipe action
        if (Platform.OS === 'ios') {
          Vibration.vibrate([0, 50, 100, 50]);
        } else {
          Vibration.vibrate(100);
        }
        
        // Calculate momentum-based values
        const direction = translationX > 0 ? 'right' : 'left';
        const momentumFactor = Math.min(Math.abs(velocityX) / 1000, 2); // Cap momentum factor
        
        // Enhanced exit animation with natural physics
        const baseDistance = screenWidth * 1.5;
        const toValue = translationX > 0 ? baseDistance * (1.2 + momentumFactor) : -baseDistance * (1.2 + momentumFactor);
        const rotateValue = (translationX > 0 ? 40 : -40) * (1 + momentumFactor * 0.4);
        const scaleValue = Math.max(0.5, 0.85 - momentumFactor * 0.25);
        
        // More natural vertical movement with physics
        const gravity = 0.3; // Simulate gravity effect
        const verticalVelocity = velocityY * 0.2;
        const verticalOffset = translationY + verticalVelocity + (translationY > 0 ? 150 : -150);

        // Smooth single-phase animation
        Animated.parallel([
          Animated.timing(translateX, {
            toValue,
            duration: 350, // Fixed smooth duration
            useNativeDriver: false,
          }),
          Animated.timing(translateY, {
            toValue: verticalOffset,
            duration: 350,
            useNativeDriver: false,
          }),
          Animated.timing(rotate, {
            toValue: rotateValue,
            duration: 350,
            useNativeDriver: false,
          }),
          Animated.timing(scale, {
            toValue: scaleValue,
            duration: 350,
            useNativeDriver: false,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300, // Slightly faster fade
            useNativeDriver: false,
          }),
        ]).start(() => {
          // Small delay before showing next card
          setTimeout(() => {
            onSwipe(direction, product);
          }, 50);
        });
      } else {
        // Enhanced return-to-center with natural bounce physics
        const distanceFromCenter = Math.sqrt(translationX * translationX + translationY * translationY);
        const bounceIntensity = Math.min(distanceFromCenter / (screenWidth * 0.3), 1.5);
        
        Animated.sequence([
          // Initial return with overshoot
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
              tension: 500,
              friction: 25,
            useNativeDriver: false,
          }),
          Animated.spring(translateY, {
            toValue: 0,
              tension: 500,
              friction: 25,
            useNativeDriver: false,
          }),
          Animated.spring(rotate, {
            toValue: 0,
              tension: 500,
              friction: 25,
            useNativeDriver: false,
          }),
            Animated.spring(scale, {
              toValue: 1 + (bounceIntensity * 0.05), // Slight overshoot in scale
              tension: 500,
              friction: 25,
              useNativeDriver: false,
            }),
          ]),
          // Subtle settle animation
          Animated.parallel([
            Animated.spring(scale, {
              toValue: 1,
              tension: 800,
              friction: 30,
              useNativeDriver: false,
            }),
          ]),
        ]).start();
      }
    } else {
      // Add subtle haptic feedback when crossing threshold
      const { translationX } = event.nativeEvent;
      const threshold = screenWidth * 0.15;
      if (Math.abs(translationX) > threshold && Math.abs(translationX - threshold) < 10) {
        if (Platform.OS === 'ios') {
          Vibration.vibrate([0, 20]);
        } else {
          Vibration.vibrate(50);
        }
      }
    }
  };

  // Compute local min price for this product in this scope
  const _pricesLocal = product.variants?.map((v: any) => v.price) || [0];
  const _minPriceLocal = Math.min(..._pricesLocal);

  const handleProductPress = () => {
    const userPrice = _minPriceLocal;
    const hasDiscount =
      product.variants?.some((v: any) => v.discount_percentage && v.discount_percentage > 0) ||
      false;
    const originalPrice = hasDiscount
      ? userPrice /
        (1 -
          Math.max(...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])) / 100)
      : userPrice;
    const totalStock =
      product.variants?.reduce((sum: any, variant: any) => sum + (variant.quantity || 0), 0) || 0;

    const productForDetails = {
      id: product.id,
      name: product.name,
      price: userPrice,
      originalPrice: hasDiscount ? originalPrice : undefined,
      discount: Math.max(...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])),
      rating: productRatings[product.id]?.rating || 0,
      reviews: productRatings[product.id]?.reviews || 0,
      image: getFirstSafeProductImage(product),
      image_urls: getProductImages(product),
      video_urls: product.video_urls || [],
      description: product.description,
      stock: totalStock.toString(),
      featured: product.featured_type !== null,
      images: 1,
      sku: product.variants?.[0]?.sku || '',
      category: product.category?.name || '',
      vendor_name: product.vendor_name || '',
      alias_vendor: product.alias_vendor || '',
      return_policy: product.return_policy || '',
    };
    navigation.navigate('ProductDetails', { product: productForDetails });
  };

  const userPrice = _minPriceLocal;
  const hasDiscount =
    product.variants?.some((v: any) => v.discount_percentage && v.discount_percentage > 0) || false;
  const originalPrice = hasDiscount
    ? userPrice /
      (1 -
        Math.max(...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])) / 100)
    : userPrice;
  const totalStock =
    product.variants?.reduce((sum: any, variant: any) => sum + (variant.quantity || 0), 0) || 0;

  return (
    <PanGestureHandler
      onGestureEvent={onPanGestureEvent}
      onHandlerStateChange={onPanHandlerStateChange}>
      <Animated.View
        style={[
          styles.tinderCard,
          {
            transform: [
              { translateX },
              { translateY },
              { rotate: rotateStr },
              {
                scale: scale.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95 - index * 0.05, 1 - index * 0.05],
                }),
              },
            ],
            opacity,
            zIndex: 1000 - index,
            top: index * 10,
          },
        ]}>
        <TouchableOpacity
          style={styles.cardTouchable}
          onPress={handleProductPress}
          activeOpacity={0.95}>
          {/* Product Image */}
          <View style={styles.tinderImageContainer}>
            <Image
              source={{ uri: getFirstSafeProductImage(product) }}
              style={styles.tinderImage}
              resizeMode="cover"
            />

            {/* Gradient Overlay */}
            <View style={styles.gradientOverlay} />

            {/* Featured Badge */}
            {product.featured_type && (
              <View
                style={[
                  styles.tinderFeaturedBadge,
                  { backgroundColor: product.featured_type === 'trending' ? '#FF9800' : '#4CAF50' },
                ]}>
                <Text style={styles.tinderFeaturedText}>
                  {product.featured_type === 'trending' ? 'TRENDING' : 'BEST SELLER'}
                </Text>
              </View>
            )}

            {/* Wishlist Button */}
            <TouchableOpacity
              style={styles.tinderWishlistButton}
              onPress={async (e) => {
                e.stopPropagation();
                if (isInWishlist(product.id)) {
                  removeFromWishlist(product.id);
                } else {
                  setSelectedProduct({
                    ...product,
                    price: _minPriceLocal,
                    featured_type: product.featured_type || undefined,
                  });
                  setShowCollectionSheet(true);
                }
              }}
              activeOpacity={0.7}>
              <Ionicons
                name={isInWishlist(product.id) ? 'heart' : 'heart-outline'}
                size={26}
                color={isInWishlist(product.id) ? '#F53F7A' : '#fff'}
              />
            </TouchableOpacity>
          </View>

          {/* Product Info */}
          <View style={styles.tinderProductInfo}>
            <View style={styles.tinderProductHeader}>
              <Text style={styles.tinderProductName} numberOfLines={2}>
                {product.name}
              </Text>
              <View style={styles.tinderStockBadge}>
                <Text style={styles.tinderStockText}>{totalStock} left</Text>
              </View>
            </View>

            <Text style={styles.tinderCategory} numberOfLines={1}>
              {product.category?.name || ''}
            </Text>

            <View style={styles.tinderPriceContainer}>
              <View style={styles.tinderPriceRow}>
                <Text style={styles.tinderPrice}>₹{Math.round(getUserPrice(product))}</Text>
                {hasDiscount && (
                  <Text style={styles.tinderOriginalPrice}>₹{Math.round(originalPrice)}</Text>
                )}
              </View>

              <View style={styles.tinderMetaRow}>
                {hasDiscount && (
                  <View style={styles.tinderDiscountBadge}>
                    <Text style={styles.tinderDiscountText}>
                      {Math.round(
                        Math.max(
                          ...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])
                        )
                      )}
                      % OFF
                    </Text>
                  </View>
                )}

                <View style={styles.tinderRatingContainer}>
                  <Ionicons name="star" size={14} color="#FFD600" />
                  <Text style={styles.tinderRatingText}>
                    {productRatings[product.id]?.rating?.toFixed(1) || '4.5'}
                  </Text>
                  <Text style={styles.tinderReviewsText}>
                    ({productRatings[product.id]?.reviews || 10})
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Enhanced Swipe Indicators with Gradient Overlays */}
        <Animated.View
          style={[
            styles.swipeIndicator,
            styles.likeIndicator,
            {
              opacity: translateX.interpolate({
                inputRange: [0, screenWidth * 0.15, screenWidth * 0.25],
                outputRange: [0, 0.7, 1],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  scale: translateX.interpolate({
                    inputRange: [0, screenWidth * 0.2],
                    outputRange: [0.7, 1.2],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  rotate: translateX.interpolate({
                    inputRange: [0, screenWidth * 0.2],
                    outputRange: ['-8deg', '8deg'],
                    extrapolate: 'clamp',
                  }),
                },
              ],
              shadowOpacity: translateX.interpolate({
                inputRange: [0, screenWidth * 0.2],
                outputRange: [0, 0.6],
                extrapolate: 'clamp',
              }),
              shadowRadius: translateX.interpolate({
                inputRange: [0, screenWidth * 0.2],
                outputRange: [0, 15],
                extrapolate: 'clamp',
              }),
            },
          ]}>
          <LinearGradient
            colors={['rgba(76, 175, 80, 0.4)', 'rgba(76, 175, 80, 0.25)', 'rgba(76, 175, 80, 0.1)']}
            style={styles.gradientOverlay}
          />
          <Text style={styles.swipeIndicatorText}>LIKE</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.swipeIndicator,
            styles.passIndicator,
            {
              opacity: translateX.interpolate({
                inputRange: [-screenWidth * 0.25, -screenWidth * 0.15, 0],
                outputRange: [1, 0.7, 0],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  scale: translateX.interpolate({
                    inputRange: [-screenWidth * 0.2, 0],
                    outputRange: [1.2, 0.7],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  rotate: translateX.interpolate({
                    inputRange: [-screenWidth * 0.2, 0],
                    outputRange: ['8deg', '-8deg'],
                    extrapolate: 'clamp',
                  }),
                },
              ],
              shadowOpacity: translateX.interpolate({
                inputRange: [-screenWidth * 0.2, 0],
                outputRange: [0.6, 0],
                extrapolate: 'clamp',
              }),
              shadowRadius: translateX.interpolate({
                inputRange: [-screenWidth * 0.2, 0],
                outputRange: [15, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}>
          <LinearGradient
            colors={['rgba(244, 67, 54, 0.4)', 'rgba(244, 67, 54, 0.25)', 'rgba(244, 67, 54, 0.1)']}
            style={styles.gradientOverlay}
          />
          <Text style={styles.swipeIndicatorText}>PASS</Text>
        </Animated.View>
      </Animated.View>
    </PanGestureHandler>
  );
};

// Create dynamic styles function - Enhanced Tinder-like design
const createSwipeCardStyles = (cardHeight: number, cardIndex: number = 0) => {
  // Different shadow intensities and scales based on card position in stack
  const shadowIntensity = Math.max(0.1, 0.4 - (cardIndex * 0.15));
  const elevationIntensity = Math.max(5, 30 - (cardIndex * 12));
  const scaleValue = Math.max(0.8, 1 - (cardIndex * 0.1)); // More aggressive scaling for better visibility
  const translateY = cardIndex * 8; // More vertical offset for each card
  
  return {
    swipeCardContainer: {
      width: screenWidth - 32, // More margin for Tinder-like feel
      height: cardHeight,
      borderRadius: 20, // More rounded corners like Tinder
      backgroundColor: cardIndex === 0 ? '#fff' : cardIndex === 1 ? '#f5f5f5' : '#eeeeee', // More distinct backgrounds for stacked cards
      shadowColor: '#000',
      shadowOpacity: shadowIntensity, // Dynamic shadow based on card position
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 20 },
      elevation: elevationIntensity, // Dynamic elevation based on card position
      overflow: 'hidden' as const,
      alignSelf: 'center' as const, // Center the card
      borderWidth: 1,
      borderColor: cardIndex === 0 ? 'rgba(0, 0, 0, 0.05)' : cardIndex === 1 ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.2)', // More distinct borders for stacked cards
      transform: [
        { scale: scaleValue },
        { translateY: translateY }
      ],
    },
    swipeImageContainer: {
      height: cardHeight * 0.68, // Adjusted for better balance
      position: 'relative' as const,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'hidden' as const,
    },
    swipeImageBackground: {
      width: screenWidth - 32,
      height: cardHeight * 0.68,
      justifyContent: 'flex-end' as const,
    },
    swipeVideoStyle: {
      width: screenWidth - 32,
      height: cardHeight * 0.68,
    },
    swipeImageGradient: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      height: 100,
    },
    swipeInfoPanel: {
      backgroundColor: '#fff',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 15,
      shadowOffset: { width: 0, height: -5 },
      elevation: 8,
      flex: 1, // Take remaining space
      minHeight: 120, // Ensure enough space for buttons
    },
  };
};

// Product Card Swipe Component (moved up for CustomSwipeView to use)
const ProductCardSwipe = ({ 
  product, 
  cardHeight, 
  cardIndex = 0, 
  navigation, 
  userData, 
  isInWishlist, 
  addToWishlist, 
  removeFromWishlist 
}: { 
  product: Product; 
  cardHeight: number; 
  cardIndex?: number;
  navigation: any;
  userData: any;
  isInWishlist: (id: string) => boolean;
  addToWishlist: (product: any) => void;
  removeFromWishlist: (id: string) => void;
}) => {
  // Calculate original price and discount
  const flatListRef = useRef<FlatList<any>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const dynamicStyles = createSwipeCardStyles(cardHeight, cardIndex);

  const goToIndex = (index: number) => {
    if (index >= 0 && index < images.length) {
      setCurrentIndex(index);
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }
  };

  const images = getAllSafeProductMedia(product);
  const productPrices = product.variants?.map((v: any) => v.price) || [0];
  const minPrice = Math.min(...productPrices);
  const maxPrice = Math.max(...productPrices);
  const originalPrices = product.variants?.map((v: any) => v.original_price) || [0];
  const maxOriginalPrice = Math.max(...originalPrices);
  const discountPercentage = maxOriginalPrice > minPrice 
    ? Math.round(((maxOriginalPrice - minPrice) / maxOriginalPrice) * 100) 
    : 0;

  // Calculate total stock from variants
  const totalStock =
    product.variants?.reduce((sum, variant) => sum + (variant.quantity || 0), 0) || 0;

  return (
    <View style={dynamicStyles.swipeCardContainer}>
      {/* Main Image Container */}
      <View style={dynamicStyles.swipeImageContainer}>
        {/* Wishlist icon */}
        <TouchableOpacity
          style={styles.swipeWishlistIcon}
          onPress={async (e) => {
            e.stopPropagation();
            if (isInWishlist(product.id)) {
              removeFromWishlist(product.id);
              if (userData?.id) {
                await supabase
                  .from('collection_products')
                  .delete()
                  .match({ product_id: product.id });
              }
            } else {
              addToWishlist({
                ...product,
                price: minPrice,
                featured_type: product.featured_type || undefined,
              });
              if (userData?.id) {
                await supabase.from('collection_products').insert({
                  user_id: userData.id,
                  product_id: product.id,
                });
              }
            }
          }}
        >
          <Ionicons
            name={isInWishlist(product.id) ? 'heart' : 'heart-outline'}
            size={24}
            color={isInWishlist(product.id) ? '#F53F7A' : '#fff'}
          />
        </TouchableOpacity>

        {/* Featured badge */}
        {product.featured_type && (
          <View style={styles.swipeFeaturedBadge}>
            <Text style={styles.swipeFeaturedText}>
              {product.featured_type.toUpperCase()}
            </Text>
          </View>
        )}

        {/* Image/Video Display */}
        {images.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / (screenWidth - 32));
              setCurrentIndex(index);
            }}
            renderItem={({ item, index }) => (
              <View style={dynamicStyles.swipeImageBackground}>
                {item.type === 'video' ? (
                  <Video
                    source={{ uri: item.url }}
                    style={dynamicStyles.swipeVideoStyle}
                    shouldPlay={index === currentIndex}
                    isLooping
                    resizeMode={ResizeMode.COVER}
                  />
                ) : (
                  <ImageBackground
                    source={{ uri: item.url }}
                    style={dynamicStyles.swipeImageBackground}
                    imageStyle={{ borderRadius: 20 }}
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.3)']}
                      style={dynamicStyles.swipeImageGradient}
                    />
                  </ImageBackground>
                )}
              </View>
            )}
            keyExtractor={(item, index) => `${item.url}-${index}`}
          />
        ) : (
          <View style={styles.swipeImageError}>
            <Ionicons name="image-outline" size={50} color="#ccc" />
            <Text style={styles.swipeImageErrorText}>No Image</Text>
          </View>
        )}

        {/* Navigation dots */}
        {images.length > 1 && (
          <View style={styles.swipeNavButton}>
            <TouchableOpacity
              style={[styles.swipeNavLeft, { opacity: currentIndex > 0 ? 1 : 0.3 }]}
              onPress={() => goToIndex(currentIndex - 1)}
              disabled={currentIndex === 0}
            >
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.swipeNavRight, { opacity: currentIndex < images.length - 1 ? 1 : 0.3 }]}
              onPress={() => goToIndex(currentIndex + 1)}
              disabled={currentIndex === images.length - 1}
            >
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Top overlay with product info */}
        <View style={styles.swipeTopOverlay}>
          <View style={styles.swipeProductHeaderRow}>
            <Text style={styles.swipeProductName} numberOfLines={2}>
              {product.name}
            </Text>
            {totalStock > 0 && (
              <View style={styles.swipeStockIndicator}>
                <Text style={styles.swipeStockText}>
                  {totalStock} in stock
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.swipeMetaRow}>
            <View style={styles.swipeRatingBadge}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.swipeRatingText}>
                {product.rating?.toFixed(1) || '4.5'}
              </Text>
              <Text style={styles.swipeReviewsText}>
                ({(product as any).review_count || 0})
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Product Info Panel */}
      <View style={dynamicStyles.swipeInfoPanel}>
        {/* Price Row */}
        <View style={styles.swipePriceRow}>
          <View style={styles.swipePriceContainer}>
            <Text style={styles.swipePrice}>
              {minPrice === maxPrice 
                ? `₹${minPrice.toLocaleString()}` 
                : `₹${minPrice.toLocaleString()} - ₹${maxPrice.toLocaleString()}`
              }
            </Text>
            {discountPercentage > 0 && (
              <>
                <Text style={styles.swipeOriginalPriceText}>
                  ₹{maxOriginalPrice.toLocaleString()}
                </Text>
                <View style={styles.swipeDiscountTag}>
                  <Text style={styles.swipeDiscountText}>
                    -{discountPercentage}%
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.swipeButtonRow}>
          <TouchableOpacity
            style={styles.swipeTryButton}
            onPress={() => {
              // Navigate to product details for virtual try-on
              navigation.navigate('ProductDetails', { product, tryNow: true });
            }}
          >
            <Ionicons name="camera-outline" size={18} color="#F53F7A" />
            <Text style={styles.swipeTryButtonText}>Try On</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.swipeShopButton}
            onPress={() => {
              navigation.navigate('ProductDetails', { product });
            }}
          >
            <Ionicons name="bag-outline" size={18} color="#fff" />
            <Text style={styles.swipeShopButtonText}>Shop Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// Custom Swipe View Component
const CustomSwipeView = ({ 
  products, 
  cardHeight, 
  onSwipeRight, 
  onSwipeLeft,
  navigation,
  userData,
  isInWishlist,
  addToWishlist,
  removeFromWishlist
}: { 
  products: Product[]; 
  cardHeight: number; 
  onSwipeRight: (product: Product) => void;
  onSwipeLeft: (product: Product) => void;
  navigation: any;
  userData: any;
  isInWishlist: (id: string) => boolean;
  addToWishlist: (product: any) => void;
  removeFromWishlist: (id: string) => void;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { 
      useNativeDriver: false,
      listener: (event: any) => {
        // Real-time physics updates for CustomSwipeView
        const { translationX, translationY, velocityX, velocityY } = event.nativeEvent;
        
        // Enhanced rotation with velocity influence
        const rotationValue = (translationX / 7) + (velocityX * 0.0015);
        rotate.setValue(rotationValue);
        
        // Dynamic scaling with velocity factor
        const distance = Math.sqrt(translationX * translationX + translationY * translationY);
        const maxDistance = screenWidth * 0.5;
        const velocityFactor = Math.min(Math.abs(velocityX) / 800, 0.6);
        const scaleValue = Math.max(0.9, 1 - (distance / maxDistance) * 0.1 - velocityFactor * 0.05);
        
        // Subtle vertical movement
        const verticalOffset = translationY + (velocityX * 0.03);
        translateY.setValue(verticalOffset);
      }
    }
  );

  const onPanHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === 4) { // ACTIVE
      const { translationX, translationY, velocityX, velocityY } = event.nativeEvent;
      const threshold = screenWidth * 0.2;
      const velocityThreshold = 600;

      const shouldSwipe = Math.abs(translationX) > threshold || Math.abs(velocityX) > velocityThreshold;

      if (shouldSwipe) {
        // Add haptic feedback for swipe action
        if (Platform.OS === 'ios') {
          Vibration.vibrate([0, 50, 100, 50]);
        } else {
          Vibration.vibrate(100);
        }
        
        setIsAnimating(true);
        const direction = translationX > 0 ? 'right' : 'left';
        setSwipeDirection(direction);
        
        // Enhanced momentum-based calculations with natural physics
        const momentumFactor = Math.min(Math.abs(velocityX) / 1200, 1.5);
        const baseDistance = screenWidth * 1.4;
        const toValue = translationX > 0 ? baseDistance * (1.1 + momentumFactor) : -baseDistance * (1.1 + momentumFactor);
        const rotateValue = (translationX > 0 ? 35 : -35) * (1 + momentumFactor * 0.5);
        
        // Natural vertical movement with physics
        const verticalVelocity = velocityY * 0.15;
        const verticalOffset = translationY + verticalVelocity + (translationY > 0 ? 120 : -120);

        // Staggered animation for more natural movement
        Animated.sequence([
          // Initial acceleration phase
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: toValue * 0.6,
              duration: Math.max(200, 280 - momentumFactor * 60),
              useNativeDriver: false,
            }),
            Animated.timing(translateY, {
              toValue: verticalOffset * 0.7,
              duration: Math.max(200, 280 - momentumFactor * 60),
              useNativeDriver: false,
            }),
            Animated.timing(rotate, {
              toValue: rotateValue * 0.7,
              duration: Math.max(200, 280 - momentumFactor * 60),
              useNativeDriver: false,
            }),
          ]),
          // Final acceleration and fade
        Animated.parallel([
          Animated.timing(translateX, {
            toValue,
              duration: Math.max(150, 220 - momentumFactor * 80),
            useNativeDriver: false,
          }),
          Animated.timing(translateY, {
              toValue: verticalOffset,
              duration: Math.max(150, 220 - momentumFactor * 80),
            useNativeDriver: false,
          }),
          Animated.timing(rotate, {
            toValue: rotateValue,
              duration: Math.max(150, 220 - momentumFactor * 80),
            useNativeDriver: false,
          }),
          Animated.timing(opacity, {
            toValue: 0,
              duration: Math.max(120, 180 - momentumFactor * 50),
            useNativeDriver: false,
          }),
          ]),
        ]).start(() => {
          // Handle swipe action
          const currentProduct = products[currentIndex];
          if (direction === 'right') {
            onSwipeRight(currentProduct);
          } else {
            onSwipeLeft(currentProduct);
          }
          
          // Move to next card
          setCurrentIndex(prev => prev + 1);
          setSwipeDirection(null);
          setIsAnimating(false);
          
          // Reset animations with smooth transition
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: 0,
              duration: 0,
              useNativeDriver: false,
            }),
            Animated.timing(translateY, {
              toValue: 0,
              duration: 0,
              useNativeDriver: false,
            }),
            Animated.timing(rotate, {
              toValue: 0,
              duration: 0,
              useNativeDriver: false,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 0,
              useNativeDriver: false,
            }),
          ]).start();
        });
      } else {
        // Enhanced return-to-center with natural bounce physics
        const distanceFromCenter = Math.sqrt(translationX * translationX + translationY * translationY);
        const bounceIntensity = Math.min(distanceFromCenter / (screenWidth * 0.25), 1.2);
        
        Animated.sequence([
          // Initial return with natural bounce
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
              tension: 550,
              friction: 28,
            useNativeDriver: false,
          }),
          Animated.spring(translateY, {
            toValue: 0,
              tension: 550,
              friction: 28,
            useNativeDriver: false,
          }),
          Animated.spring(rotate, {
            toValue: 0,
              tension: 550,
              friction: 28,
            useNativeDriver: false,
          }),
          ]),
          // Subtle settle animation for natural feel
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              tension: 900,
              friction: 35,
              useNativeDriver: false,
            }),
            Animated.spring(translateY, {
              toValue: 0,
              tension: 900,
              friction: 35,
              useNativeDriver: false,
            }),
          ]),
        ]).start();
      }
    } else {
      // Add subtle haptic feedback when crossing threshold
      const { translationX } = event.nativeEvent;
      const threshold = screenWidth * 0.15;
      if (Math.abs(translationX) > threshold && Math.abs(translationX - threshold) < 10) {
        if (Platform.OS === 'ios') {
          Vibration.vibrate([0, 20]);
        } else {
          Vibration.vibrate(50);
        }
      }
    }
  };

  const rotateStr = rotate.interpolate({
    inputRange: [-25, 0, 25],
    outputRange: ['-30deg', '0deg', '30deg'],
    extrapolate: 'clamp',
  });

  if (currentIndex >= products.length) {
    return (
      <View style={styles.noMoreCardsContainer}>
        <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
        <Text style={styles.noMoreCardsTitle}>All done!</Text>
        <Text style={styles.noMoreCardsSubtitle}>
          You've seen all products in this category
        </Text>
        <TouchableOpacity 
          style={styles.resetButton} 
          onPress={() => setCurrentIndex(0)}
        >
          <Text style={styles.resetButtonText}>Start Over</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.customSwipeContainer}>
      {/* Stacked cards behind */}
      {products.slice(currentIndex, currentIndex + 3).map((product, index) => {
        if (index === 0) return null; // Skip the front card
        
        const scale = 1 - (index * 0.05);
        const translateY = index * 8;
        const opacity = 1 - (index * 0.1);
        
        return (
          <Animated.View
            key={`${product.id}-${currentIndex + index}`}
            style={[
              styles.stackedCard,
              {
                transform: [
                  { scale },
                  { translateY },
                ],
                opacity,
                zIndex: 10 - index,
              },
            ]}
          >
            <ProductCardSwipe 
              product={product} 
              cardHeight={cardHeight} 
              cardIndex={index}
              navigation={navigation}
              userData={userData}
              isInWishlist={isInWishlist}
              addToWishlist={addToWishlist}
              removeFromWishlist={removeFromWishlist}
            />
          </Animated.View>
        );
      })}
      
      {/* Front card */}
      <PanGestureHandler
        onGestureEvent={onPanGestureEvent}
        onHandlerStateChange={onPanHandlerStateChange}
        enabled={!isAnimating}
      >
        <Animated.View
          style={[
            styles.frontCard,
            {
              transform: [
                { translateX },
                { translateY },
                { rotate: rotateStr },
              ],
              opacity,
              zIndex: 1000,
            },
          ]}
        >
          <ProductCardSwipe 
            product={products[currentIndex]} 
            cardHeight={cardHeight} 
            cardIndex={0}
            navigation={navigation}
            userData={userData}
            isInWishlist={isInWishlist}
            addToWishlist={addToWishlist}
            removeFromWishlist={removeFromWishlist}
          />
          
          {/* Enhanced Swipe overlays with gradient and shadow effects */}
          <Animated.View
            style={[
              styles.swipeOverlay,
              styles.rightOverlay,
              {
                opacity: translateX.interpolate({
                  inputRange: [0, screenWidth * 0.15, screenWidth * 0.25],
                  outputRange: [0, 0.8, 1],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    scale: translateX.interpolate({
                      inputRange: [0, screenWidth * 0.2],
                      outputRange: [0.7, 1.2],
                      extrapolate: 'clamp',
                    }),
                  },
                  {
                    rotate: translateX.interpolate({
                      inputRange: [0, screenWidth * 0.2],
                      outputRange: ['-8deg', '8deg'],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
                shadowOpacity: translateX.interpolate({
                  inputRange: [0, screenWidth * 0.2],
                  outputRange: [0, 0.7],
                  extrapolate: 'clamp',
                }),
                shadowRadius: translateX.interpolate({
                  inputRange: [0, screenWidth * 0.2],
                  outputRange: [0, 20],
                  extrapolate: 'clamp',
                }),
              },
            ]}>
            <LinearGradient
              colors={['rgba(76, 175, 80, 0.4)', 'rgba(76, 175, 80, 0.25)', 'rgba(76, 175, 80, 0.1)']}
              style={styles.fullGradientOverlay}
            />
            <Text style={[styles.swipeText, styles.rightText]}>LIKE</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.swipeOverlay,
              styles.leftOverlay,
              {
                opacity: translateX.interpolate({
                  inputRange: [-screenWidth * 0.25, -screenWidth * 0.15, 0],
                  outputRange: [1, 0.8, 0],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    scale: translateX.interpolate({
                      inputRange: [-screenWidth * 0.2, 0],
                      outputRange: [1.2, 0.7],
                      extrapolate: 'clamp',
                    }),
                  },
                  {
                    rotate: translateX.interpolate({
                      inputRange: [-screenWidth * 0.2, 0],
                      outputRange: ['8deg', '-8deg'],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
                shadowOpacity: translateX.interpolate({
                  inputRange: [-screenWidth * 0.2, 0],
                  outputRange: [0.7, 0],
                  extrapolate: 'clamp',
                }),
                shadowRadius: translateX.interpolate({
                  inputRange: [-screenWidth * 0.2, 0],
                  outputRange: [20, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}>
            <LinearGradient
              colors={['rgba(244, 67, 54, 0.4)', 'rgba(244, 67, 54, 0.25)', 'rgba(244, 67, 54, 0.1)']}
              style={styles.fullGradientOverlay}
            />
            <Text style={[styles.swipeText, styles.leftText]}>PASS</Text>
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const Products = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { category, featuredType } = route.params as RouteParams;
  const insets = useSafeAreaInsets();
  
  // Calculate dynamic card height based on actual screen dimensions and safe areas
  const headerHeight = 60; // Header height from design
  const titleSectionHeight = 60; // Title and toggle buttons section
  const bottomTabHeight = 60; // Bottom tab navigation
  const availableHeight = screenHeight - insets.top - insets.bottom - headerHeight - titleSectionHeight - bottomTabHeight - 20; // Reduced padding
  const dynamicCardHeight = Math.max(availableHeight * 0.85, screenHeight * 0.55); // Use 85% of available height, minimum 55% of screen height
  
  // Swipe handlers for custom swipe view
  const handleSwipeRight = async (product: Product) => {
    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id);
      if (userData?.id) {
        await supabase
          .from('collection_products')
          .delete()
          .match({ product_id: product.id });
      }
    } else {
      addToWishlist({
        ...product,
        price: productPrices[product.id as string] || 0,
        featured_type: product.featured_type || undefined,
      });
      if (userData?.id) {
        await supabase.from('collection_products').insert({
          user_id: userData.id,
          product_id: product.id,
        });
      }
      const newCount = rightSwipeCount + 1;
      setRightSwipeCount(newCount);
      
      if (newCount % 5 === 0) {
        setShowWishlistPopup(true);
        setTimeout(() => {
          setShowWishlistPopup(false);
        }, 3000);
      }
    }
  };

  const handleSwipeLeft = (product: Product) => {
    // Handle left swipe (pass)
    console.log('Passed on:', product.name);
  };
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<
    'name' | 'price' | 'created_at' | 'like_count' | 'discount_percentage' | 'rating'
  >('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { wishlist, toggleWishlist, addToWishlist, isInWishlist, removeFromWishlist } =
    useWishlist();
  const { userData } = useUser();
  const [showCollectionSheet, setShowCollectionSheet] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [layout, setLayout] = useState(true); // true for grid/tinder, false for list
  const { t } = useTranslation();
  const [langMenuVisible, setLangMenuVisible] = useState(false);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const filterSheetRef = useRef<BottomSheet>(null);
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterDiscount, setFilterDiscount] = useState(false);
  const [filterInStock, setFilterInStock] = useState(false);
  const [showSavedPopup, setShowSavedPopup] = useState(false);
  const [savedProductName, setSavedProductName] = useState('');
  const popupAnimation = useRef(new Animated.Value(0)).current;
  const shimmerAnimation = useRef(new Animated.Value(0)).current;
  const [productRatings, setProductRatings] = useState<{
    [productId: string]: { rating: number; reviews: number };
  }>({});
  const [imageLoadingStates, setImageLoadingStates] = useState<{
    [productId: string]: 'loading' | 'loaded' | 'error';
  }>({});
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [tinderMode, setTinderMode] = useState(false); // New state for tinder mode
  const [rightSwipeCount, setRightSwipeCount] = useState(0); // Track right swipes for popup
  const [showWishlistPopup, setShowWishlistPopup] = useState(false); // Show popup after 5 swipes

  // Sort options mapping
  const sortOptions = [
    { label: t('whats_new'), value: { by: 'created_at', order: 'desc' } },
    { label: t('price_high_to_low'), value: { by: 'price', order: 'desc' } },
    { label: t('popularity'), value: { by: 'like_count', order: 'desc' } },
    { label: t('discount'), value: { by: 'discount_percentage', order: 'desc' } },
    { label: t('price_low_to_high'), value: { by: 'price', order: 'asc' } },
    { label: t('customer_rating'), value: { by: 'rating', order: 'desc' } },
  ];

  // Helper to get current sort label
  const getCurrentSortLabel = () => {
    const found = sortOptions.find((o) => o.value.by === sortBy && o.value.order === sortOrder);
    return found ? found.label : t('whats_new');
  };

  // Update sort logic for new options
  const handleSortOption = (option: (typeof sortOptions)[0]) => {
    setSortBy(option.value.by as any);
    setSortOrder(option.value.order as any);
  };

  useEffect(() => {
    fetchProducts();
  }, [category.id, featuredType, sortBy, sortOrder]);

  // Function to fetch ratings for products
  const fetchProductRatings = async (productIds: string[]) => {
    try {
      if (productIds.length === 0) return;

      const { data, error } = await supabase
        .from('product_reviews')
        .select('product_id, rating')
        .in('product_id', productIds);

      if (error) {
        console.error('Error fetching product ratings:', error);
        return;
      }

      // Calculate average rating and count for each product
      const ratings: { [productId: string]: { rating: number; reviews: number } } = {};

      productIds.forEach((productId) => {
        const productReviews = data?.filter((review) => review.product_id === productId) || [];
        const totalRating = productReviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = productReviews.length > 0 ? totalRating / productReviews.length : 0;

        ratings[productId] = {
          rating: averageRating,
          reviews: productReviews.length,
        };
      });

      setProductRatings((prev) => ({ ...prev, ...ratings }));
    } catch (error) {
      console.error('Error fetching product ratings:', error);
    }
  };

  // Auto-hide saved popup with smooth animation
  useEffect(() => {
    if (showSavedPopup) {
      // Animate in
      Animated.spring(popupAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();

      const timer = setTimeout(() => {
        // Animate out
        Animated.timing(popupAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowSavedPopup(false);
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [showSavedPopup, popupAnimation]);

  // Auto-hide wishlist milestone popup with smooth animation
  useEffect(() => {
    if (showWishlistPopup) {
      // Animate in
      Animated.spring(popupAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();

      const timer = setTimeout(() => {
        // Animate out
        Animated.timing(popupAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowWishlistPopup(false);
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [showWishlistPopup, popupAnimation]);

  // Reset animation when popup is hidden
  useEffect(() => {
    if (!showSavedPopup) {
      popupAnimation.setValue(0);
    }
  }, [showSavedPopup, popupAnimation]);

  // Shimmer animation effect
  useEffect(() => {
    const shimmerLoop = () => {
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(shimmerLoop);
    };
    shimmerLoop();
  }, [shimmerAnimation]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('products')
        .select(
          `
          id,
          name,
          description,
          category_id,
          category:categories(name),
          image_urls,
          video_urls,
          is_active,
          featured_type,
          like_count,
          return_policy,
          vendor_name,
          alias_vendor,
          created_at,
          updated_at,
          product_variants(
            id,
            price,
            sku,
            mrp_price,
            rsp_price,
            cost_price,
            discount_percentage,
            quantity,
            image_urls,
            video_urls,
            size:sizes(name)
          )
        `
        )
        .eq('is_active', true);

      // If featuredType is provided, filter by featured_type instead of category_id
      if (featuredType) {
        query = query.eq('featured_type', featuredType);
      } else {
        query = query.eq('category_id', category.id);
      }
      if (filterMinPrice) query = query.gte('product_variants.price', Number(filterMinPrice));
      if (filterMaxPrice) query = query.lte('product_variants.price', Number(filterMaxPrice));
      if (filterDiscount) query = query.gt('discount_percentage', 0);
      if (filterInStock) query = query.gt('stock_quantity', 0);
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      const { data, error } = await query;
      if (error) {
        console.error('Error fetching products:', error);
        return;
      }
      const fixedData = (data || []).map((item: any) => {
        const extractedImages = getProductImages(item);

        return {
          ...item,
          image_urls: extractedImages,
          category: Array.isArray(item.category) ? item.category[0] : item.category,
          variants: item.product_variants || [],
        };
      });
      setProducts(fixedData);
      setCurrentCardIndex(0); // Reset card index when products change

      // Fetch ratings for products
      const productIds = fixedData.map((product) => product.id);
      await fetchProductRatings(productIds);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  // Function to get user-specific price for a product
  const getUserPrice = useCallback(
    (product: Product) => {
      if (!product.variants || product.variants.length === 0) {
        return 1400; // No variants available
      }

      // If user has a size preference, try to find that size
      if (userData?.size) {
        const userSizeVariant = product.variants.find((v) => v.size?.name === userData.size);
        if (userSizeVariant) {
          return userSizeVariant.price;
        }
      }

      // If user size not found or no user size, return the smallest price
      const sortedVariants = [...product.variants].sort((a, b) => a.price - b.price);
      return sortedVariants[0]?.price || 0;
    },
    [userData?.size]
  );

  // Memoize product prices to prevent unnecessary recalculations
  const productPrices = useMemo(() => {
    const prices: { [key: string]: number } = {};
    products.forEach((product) => {
      prices[product.id] = getUserPrice(product);
    });
    return prices;
  }, [products, getUserPrice]);

  // Function to get the smallest price for a product
  const getSmallestPrice = (product: Product) => {
    if (!product.variants || product.variants.length === 0) {
      return 0;
    }
    const sortedVariants = [...product.variants].sort((a, b) => a.price - b.price);
    return sortedVariants[0]?.price || 0;
  };

  // Handle tinder card swipe
  const handleTinderSwipe = (direction: 'left' | 'right', product: Product) => {
    if (direction === 'right') {
      // Right swipe = like/add to wishlist
      if (!isInWishlist(product.id)) {
        setSelectedProduct({
          ...product,
          price: productPrices[product.id as string] || 0,
          featured_type: product.featured_type || undefined,
        } as any);
        setShowCollectionSheet(true);
      }
    }

    // Move to next card
    setCurrentCardIndex((prev) => prev + 1);
  };

  const renderProductCard = (product: Product) => {
    // Calculate original price and discount
    const userPrice = productPrices[product.id as string] || 0;
    const hasDiscount =
      product.variants?.some((v) => v.discount_percentage && v.discount_percentage > 0) || false;
    const originalPrice = hasDiscount
      ? userPrice /
        (1 - Math.max(...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])) / 100)
      : userPrice;
    const discountedPrice = userPrice;

    // Calculate total stock from variants
    const totalStock =
      product.variants?.reduce((sum, variant) => sum + (variant.quantity || 0), 0) || 0;

    return (
      <TouchableOpacity
        style={layout && !tinderMode ? styles.productCard : styles.productListStyle}
        onPress={() => {
          // Transform Product to match ProductDetails expected format
          const productForDetails = {
            id: product.id,
            name: product.name,
            price: discountedPrice,
            originalPrice: hasDiscount ? originalPrice : undefined,
            discount: Math.max(
              ...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])
            ),
            rating: productRatings[product.id]?.rating || 0, // Real rating from product_reviews
            reviews: productRatings[product.id]?.reviews || 0, // Real review count from product_reviews
            image: getFirstSafeProductImage(product),
            image_urls: getProductImages(product),
            video_urls: product.video_urls || [],
            description: product.description,
            stock: totalStock.toString(),
            featured: product.featured_type !== null,
            images: 1,
            sku: product.variants?.[0]?.sku || '',
            category: product.category?.name || '',
            vendor_name: product.vendor_name || '',
            alias_vendor: product.alias_vendor || '',
            return_policy: product.return_policy || '',
          };
          (navigation as any).navigate('ProductDetails', { product: productForDetails });
        }}>
        {/* Wishlist icon - now opens collection sheet and shows filled if in wishlist */}
        <TouchableOpacity
          style={styles.wishlistIcon}
          onPress={async (e) => {
            e.stopPropagation();
            if (isInWishlist(product.id)) {
              removeFromWishlist(product.id);
              // Remove from all collections in Supabase
              if (userData?.id) {
                await supabase
                  .from('collection_products')
                  .delete()
                  .match({ product_id: product.id });
              }
            } else {
              setSelectedProduct({
                ...product,
                price: productPrices[product.id as string] || 0,
                featured_type: product.featured_type || undefined,
              } as any);
              setShowCollectionSheet(true);
            }
          }}
          activeOpacity={0.7}>
          <Ionicons
            name={isInWishlist(product.id) ? 'heart' : 'heart-outline'}
            size={22}
            color={isInWishlist(product.id) ? '#F53F7A' : '#999'}
          />
        </TouchableOpacity>

        {/* Resell button - visible for all logged-in users */}
        {userData?.id && (
          <TouchableOpacity
            style={styles.resellIcon}
            onPress={(e) => {
              e.stopPropagation();
              (navigation as any).navigate('CatalogShare', { product });
            }}
            activeOpacity={0.7}>
            <Ionicons
              name="share-social"
              size={20}
              color="#4CAF50"
            />
          </TouchableOpacity>
        )}
        {product.featured_type && (
          <View
            style={[
              styles.featuredBadge,
              { backgroundColor: product.featured_type === 'trending' ? '#FF9800' : '#4CAF50' },
            ]}>
            <Text style={styles.featuredBadgeText}>
              {product.featured_type === 'trending' ? t('trending') : t('best_seller')}
            </Text>
          </View>
        )}
        {imageLoadingStates[product.id] === 'error' ? (
          // Show skeleton when image failed to load
          <View
            style={
              layout && !tinderMode
                ? [styles.productImage, styles.imageSkeleton]
                : styles.listImageContainer
            }>
            <Animated.View
              style={[
                styles.skeletonShimmer,
                {
                  opacity: shimmerAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 0.7],
                  }),
                },
              ]}
            />
            <Ionicons name="image-outline" size={32} color="#ccc" />
          </View>
        ) : (
          <Image
            source={{ uri: getFirstSafeProductImage(product) }}
            style={layout && !tinderMode ? styles.productImage : styles.listImage}
            onLoadStart={() => {
              setImageLoadingStates((prev) => ({ ...prev, [product.id]: 'loading' }));
            }}
            onLoad={() => {
              setImageLoadingStates((prev) => ({ ...prev, [product.id]: 'loaded' }));
            }}
            onError={(error) => {
              setImageLoadingStates((prev) => ({ ...prev, [product.id]: 'error' }));
            }}
          />
        )}
        <View style={styles.productInfo}>
          {/* Stock indicator above product title */}
          <View style={styles.stockIndicator}>
            <Text style={styles.stockText}>
              {totalStock} {t('left')}
            </Text>
          </View>

          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>

          {/* Discount badge moved below product name */}
          {hasDiscount && (
            <View style={styles.discountBadgeInline}>
              <Text style={styles.discountBadgeTextInline}>
                {Math.round(
                  Math.max(...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0]))
                )}
                % OFF
              </Text>
            </View>
          )}

          <View style={styles.priceContainer}>
            <View style={styles.priceInfo}>
              {hasDiscount && (
                <Text style={styles.originalPrice}>₹{Math.round(originalPrice)}</Text>
              )}
              <Text style={styles.price}>₹{Math.round(getUserPrice(product))}</Text>
            </View>
            <View style={styles.discountAndRatingRow}>
              <View style={styles.reviewsContainer}>
                <Ionicons name="star" size={12} color="#FFD600" style={{ marginRight: 2 }} />
                <Text style={styles.reviews}>
                  {productRatings[product.id]?.rating?.toFixed(1) || '0.0'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  const blurhash =
    '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[';

  // Create dynamic styles function - Enhanced Tinder-like design


  const handleApplyFilters = () => {
    setFilterSheetVisible(false);
    fetchProducts();
  };

  const handleClearFilters = () => {
    setFilterMinPrice('');
    setFilterMaxPrice('');
    setFilterDiscount(false);
    setFilterInStock(false);
    setFilterSheetVisible(false);
    fetchProducts();
  };

  const handleProductClick = (product: Product) => {
    const userPrice = productPrices[product.id as string] || 0;
    const hasDiscount =
      product.variants?.some((v) => v.discount_percentage && v.discount_percentage > 0) || false;
    const originalPrice = hasDiscount
      ? userPrice /
        (1 - Math.max(...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])) / 100)
      : userPrice;
    const totalStock =
      product.variants?.reduce((sum, variant) => sum + (variant.quantity || 0), 0) || 0;

    const productForDetails = {
      id: product.id,
      name: product.name,
      price: userPrice,
      originalPrice: hasDiscount ? originalPrice : undefined,
      discount: Math.max(...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])),
      rating: productRatings[product.id]?.rating || 0,
      reviews: productRatings[product.id]?.reviews || 0,
      image: getFirstSafeProductImage(product),
      image_urls: getProductImages(product),
      video_urls: product.video_urls || [],
      description: product.description,
      stock: totalStock.toString(),
      featured: product.featured_type !== null,
      images: 1,
      sku: product.variants?.[0]?.sku || '',
      category: product.category?.name || '',
      vendor_name: product.vendor_name || '',
      alias_vendor: product.alias_vendor || '',
      return_policy: product.return_policy || '',
    };
    (navigation as any).navigate('ProductDetails', { product: productForDetails });
  };

  const renderStars = (rating: number) => {
    const filledStars = Math.floor(rating);
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <MaterialIcons
          key={i}
          name={i < filledStars ? 'star' : 'star-border'}
          size={16}
          color="#facc15"
        />
      );
    }
    return stars;
  };

  const renderItem = ({ item }: { item: Product }) =>
    layout && !tinderMode ? (
      // Horizontal Card (List View)
      <TouchableOpacity onPress={() => handleProductClick(item)} style={styles.horizontalCard}>
        <Image source={{ uri: getFirstSafeProductImage(item) }} style={styles.horizontalImage} />
        <View style={styles.horizontalDetails}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.category}>{item.category?.name || ''}</Text>
          <Text style={styles.horizontalPrice}>₹{productPrices[item.id] || 0}</Text>
          <View style={styles.ratingRow}>
            {renderStars(productRatings[item.id]?.rating || 4.8)}
            <Text style={styles.reviewText}>({productRatings[item.id]?.reviews || 10})</Text>
          </View>
        </View>
      </TouchableOpacity>
    ) : (
      // Vertical Card (Grid View)
      <TouchableOpacity onPress={() => handleProductClick(item)} style={styles.verticalCardWrapper}>
        <View style={styles.verticalCard}>
          <Image source={{ uri: getFirstSafeProductImage(item) }} style={styles.verticalImage} />
          <View style={styles.verticalDetails}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.category}>{item.category?.name || ''}</Text>
            <Text style={styles.verticalPrice}>₹{productPrices[item.id] || 0}</Text>
            <View style={styles.ratingRow}>
              {renderStars(productRatings[item.id]?.rating || 4.8)}
              <Text style={styles.reviewText}>({productRatings[item.id]?.reviews || 10})</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );

  // Render Tinder Cards
  const renderTinderCards = () => {
    if (products.length === 0) return null;

    const visibleCards = products.slice(currentCardIndex, currentCardIndex + 3);

    return (
      <View style={styles.tinderContainer}>
        {visibleCards.length === 0 ? (
          <View style={styles.noMoreCardsContainer}>
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            <Text style={styles.noMoreCardsTitle}>All done!</Text>
            <Text style={styles.noMoreCardsSubtitle}>
              You've seen all products in this category
            </Text>
            <TouchableOpacity style={styles.resetButton} onPress={() => setCurrentCardIndex(0)}>
              <Text style={styles.resetButtonText}>Start Over</Text>
            </TouchableOpacity>
          </View>
        ) : (
          visibleCards
            .map((product, index) => (
              <TinderCard
                key={`${product.id}-${currentCardIndex + index}`}
                product={product}
                index={index}
                onSwipe={handleTinderSwipe}
                productPrices={productPrices}
                productRatings={productRatings}
                getUserPrice={getUserPrice}
                isInWishlist={isInWishlist}
                removeFromWishlist={removeFromWishlist}
                setSelectedProduct={setSelectedProduct}
                setShowCollectionSheet={setShowCollectionSheet}
                navigation={navigation}
              />
            ))
            .reverse()
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Text style={styles.logo}>
            <Text>Only</Text>
            <Text style={{ color: '#F53F7A' }}>2</Text>
            <Text>U</Text>
          </Text>
          <View style={styles.headerRight}>
            <View style={styles.languageContainer}>
              <TouchableOpacity
                onPress={() => setLangMenuVisible((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="globe-outline" size={16} color="#666" />
                <Text style={styles.languageText}>{i18n.language === 'te' ? 'TE' : 'EN'}</Text>
              </TouchableOpacity>
              {langMenuVisible && (
                <View
                  style={{
                    position: 'absolute',
                    top: 32,
                    right: 0,
                    backgroundColor: '#f7f8fa',
                    borderRadius: 12,
                    shadowColor: '#000',
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 4,
                    minWidth: 120,
                    zIndex: 100,
                  }}>
                  <TouchableOpacity
                    style={{
                      padding: 12,
                      borderTopLeftRadius: 12,
                      borderTopRightRadius: 12,
                      backgroundColor: i18n.language === 'en' ? '#f1f2f4' : 'transparent',
                    }}
                    onPress={() => {
                      i18n.changeLanguage('en');
                      setLangMenuVisible(false);
                    }}>
                    <Text style={{ color: '#222', fontSize: 16 }}>{t('english')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      padding: 12,
                      borderBottomLeftRadius: 12,
                      borderBottomRightRadius: 12,
                      backgroundColor: i18n.language === 'te' ? '#f1f2f4' : 'transparent',
                    }}
                    onPress={() => {
                      i18n.changeLanguage('te');
                      setLangMenuVisible(false);
                    }}>
                    <Text style={{ color: '#222', fontSize: 18 }}>{t('telugu')} (Telugu)</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <View style={styles.currencyContainer}>
              <Text style={styles.currencyText}>{userData?.coin_balance || 0}</Text>
              <MaterialCommunityIcons name="face-man-shimmer" size={18} color="#F53F7A" />
            </View>
            <View>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => (navigation as any).navigate('Wishlist')}>
                <Ionicons name="heart-outline" size={24} color="#333" />
                {wishlist.length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{wishlist.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.iconButton,
                {
                  backgroundColor: userData?.profilePhoto ? 'transparent' : 'lightgray',
                  borderRadius: 20,
                },
              ]}
              onPress={() => (navigation as any).navigate('Profile')}>
              {userData?.profilePhoto ? (
                <Image source={{ uri: userData.profilePhoto }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person-outline" size={16} color="#333" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.titleContainer}>
        <View style={styles.titleLeft}>
          <Text style={styles.title}>{category.name}</Text>
          <Text style={styles.count}>
            {products.length} {t('items')}
          </Text>
        </View>
        {/* View Toggle Buttons */}
        <View style={styles.viewToggleContainer}>
          <TouchableOpacity
            style={[styles.viewToggleButton, !tinderMode && layout && styles.activeViewToggle]}
            onPress={() => {
              setLayout(true);
              setTinderMode(false);
            }}>
            <Ionicons name="grid" size={18} color={!tinderMode && layout ? '#F53F7A' : '#666'} />
            <Text style={[styles.viewToggleText, !tinderMode && layout && styles.activeViewToggleText]}>
              Grid
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.viewToggleButton, tinderMode && styles.activeViewToggle]}
            onPress={() => {
              setLayout(true);
              setTinderMode(true);
            }}>
            <Ionicons name="layers" size={18} color={tinderMode ? '#F53F7A' : '#666'} />
            <Text style={[styles.viewToggleText, tinderMode && styles.activeViewToggleText]}>
              Swipe
            </Text>
          </TouchableOpacity>
          
          {/* Filter Button */}
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFilterSheetVisible(true)}>
            <Ionicons name="filter-outline" size={18} color="#666" />
            <Text style={styles.filterButtonText}>Filter</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Products */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F53F7A" />
          <Text style={styles.loadingText}>{t('loading_products')}</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={64} color="#999" />
          <Text style={styles.emptyTitle}>{t('no_products_found')}</Text>
          <Text style={styles.emptySubtitle}>{t('no_products_in_category')}</Text>
        </View>
      ) : layout && tinderMode ? (
        // Tinder Mode
        <View style={[styles.tinderModeContainer, { 
          paddingTop: 20,
          paddingBottom: insets.bottom + 5,
          height: screenHeight - insets.top - insets.bottom - 120
        }]}>
          <CustomSwipeView 
            products={products}
            cardHeight={dynamicCardHeight}
            onSwipeRight={handleSwipeRight}
            onSwipeLeft={handleSwipeLeft}
            navigation={navigation}
            userData={userData}
            isInWishlist={isInWishlist}
            addToWishlist={addToWishlist}
            removeFromWishlist={removeFromWishlist}
          />
        </View>
      ) : (
        // Regular Grid/List Mode
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            data={products}
            renderItem={({ item }) => renderProductCard(item)}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.productList}
            showsVerticalScrollIndicator={false}
            key={`'normal'}`} // Force re-render on layout change
          />
        </KeyboardAvoidingView>
      )}

      {/* Tinder Action Buttons */}
      {/* {layout && tinderMode && products.length > 0 && currentCardIndex < products.length && (
        <View style={styles.tinderActionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.passButton]}
            onPress={() => handleTinderSwipe('left', products[currentCardIndex])}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton]}
            onPress={() => handleTinderSwipe('right', products[currentCardIndex])}>
            <Ionicons name="heart" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      )} */}

      {/* Filter & Sort BottomSheet Modal */}
      <BottomSheet
        ref={filterSheetRef}
        index={filterSheetVisible ? 0 : -1}
        snapPoints={[600]}
        enablePanDownToClose
        onClose={() => setFilterSheetVisible(false)}
        backgroundStyle={{ backgroundColor: '#fff' }}
        handleIndicatorStyle={{ backgroundColor: '#ccc' }}>
        <View style={styles.sortSheetContent}>
          {/* Filter Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sortSheetLabel}>{t('filter') || 'Filter'}</Text>
            <View style={{ marginBottom: 18 }}>
              <Text style={styles.filterLabel}>{t('price_range') || 'Price Range'}</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <TextInput
                  style={styles.filterInput}
                  placeholder={t('min') || 'Min'}
                  keyboardType="numeric"
                  value={filterMinPrice}
                  onChangeText={setFilterMinPrice}
                />
                <TextInput
                  style={styles.filterInput}
                  placeholder={t('max') || 'Max'}
                  keyboardType="numeric"
                  value={filterMaxPrice}
                  onChangeText={setFilterMaxPrice}
                />
              </View>
            </View>
            <TouchableOpacity
              style={styles.filterCheckboxRow}
              onPress={() => setFilterDiscount((v) => !v)}
              activeOpacity={0.7}>
              <Ionicons
                name={filterDiscount ? 'checkbox' : 'square-outline'}
                size={22}
                color="#F53F7A"
              />
              <Text style={styles.filterCheckboxLabel}>
                {t('only_discounted') || 'Only show discounted'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterCheckboxRow}
              onPress={() => setFilterInStock((v) => !v)}
              activeOpacity={0.7}>
              <Ionicons
                name={filterInStock ? 'checkbox' : 'square-outline'}
                size={22}
                color="#F53F7A"
              />
              <Text style={styles.filterCheckboxLabel}>
                {t('only_in_stock') || 'Only show in stock'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Sort Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sortSheetLabel}>{t('sort_by') || 'SORT BY'}</Text>
            {sortOptions.map((option, idx) => {
              const selected = sortBy === option.value.by && sortOrder === option.value.order;
              return (
                <TouchableOpacity
                  key={option.label}
                  style={styles.sortSheetOption}
                  onPress={() => {
                    handleSortOption(option);
                    setFilterSheetVisible(false);
                  }}>
                  <Text
                    style={[
                      styles.sortSheetOptionText,
                      selected && styles.sortSheetOptionTextSelected,
                    ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity style={styles.filterClearBtn} onPress={handleClearFilters}>
              <Text style={styles.filterClearBtnText}>{t('clear') || 'Clear'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterApplyBtn} onPress={handleApplyFilters}>
              <Text style={styles.filterApplyBtnText}>{t('apply') || 'Apply'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      {/* Save to Collection Bottom Sheet - moved after filter and sort sheets */}
     {showCollectionSheet && <View
        style={{
          flex: 1,
          zIndex: 10000,
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          left: 0,
        }}>
        <SaveToCollectionSheet
          visible={showCollectionSheet}
          product={selectedProduct}
          onClose={() => {
            setShowCollectionSheet(false);
          }}
          onSaved={(product, collectionName) => {
            // Show saved popup when product is successfully saved
            setSavedProductName(product.name);
            setShowSavedPopup(true);
            // Store collection name for display
            setSavedProductName(collectionName);
          }}
        />
      </View>}

      {/* Saved Popup */}
      {showSavedPopup && (
        <Animated.View
          style={[
            styles.savedPopup,
            {
              transform: [
                {
                  translateY: popupAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                },
              ],
              opacity: popupAnimation,
              zIndex: 1,
            },
          ]}>
          <View style={styles.savedPopupContent}>
            <View style={styles.savedPopupLeft}>
              <Image
                source={{
                  uri: selectedProduct
                    ? getFirstSafeProductImage(selectedProduct)
                    : FALLBACK_IMAGES.product,
                }}
                style={styles.savedPopupImage}
              />
            </View>
            <View style={styles.savedPopupText}>
              <Text style={styles.savedPopupTitle}>{t('saved')}</Text>
              <Text style={styles.savedPopupSubtitle}>Saved to {savedProductName}</Text>
            </View>
            <TouchableOpacity
              style={styles.savedPopupViewButton}
              onPress={() => {
                // Animate out when View button is pressed
                Animated.timing(popupAnimation, {
                  toValue: 0,
                  duration: 300,
                  useNativeDriver: true,
                }).start(() => {
                  setShowSavedPopup(false);
                  (navigation as any).navigate('Home', { screen: 'Wishlist' });
                });
              }}>
              <Text style={styles.savedPopupViewText}>{t('view')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Wishlist Milestone Popup */}
      {showWishlistPopup && (
        <Animated.View
          style={[
            styles.wishlistMilestonePopup,
            {
              transform: [
                {
                  scale: popupAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
              opacity: popupAnimation,
              zIndex: 1000,
            },
          ]}>
          <View style={styles.wishlistMilestoneContent}>
            <View style={styles.wishlistMilestoneIcon}>
              <Ionicons name="heart" size={32} color="#F53F7A" />
            </View>
            <Text style={styles.wishlistMilestoneTitle}>Awesome!</Text>
            <Text style={styles.wishlistMilestoneSubtitle}>
              You've added {rightSwipeCount} items to your wishlist
            </Text>
            <TouchableOpacity
              style={styles.wishlistMilestoneButton}
              onPress={() => {
                Animated.timing(popupAnimation, {
                  toValue: 0,
                  duration: 300,
                  useNativeDriver: true,
                }).start(() => {
                  setShowWishlistPopup(false);
                });
              }}>
              <Text style={styles.wishlistMilestoneButtonText}>Keep Swiping!</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Custom Swipe View Styles
  customSwipeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  stackedCard: {
    position: 'absolute',
    width: screenWidth - 32,
    alignSelf: 'center',
  },
  frontCard: {
    position: 'absolute',
    width: screenWidth - 32,
    alignSelf: 'center',
  },
  swipeOverlay: {
    position: 'absolute',
    top: '30%',
    left: '20%',
    right: '20%',
    bottom: '30%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    zIndex: 1001,
  },
  leftOverlay: {
    backgroundColor: 'transparent',
  },
  rightOverlay: {
    backgroundColor: 'transparent',
  },
  swipeText: {
    fontSize: 36,
    fontWeight: '900',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 1.5,
  },
  leftText: {
    transform: [{ rotate: '-15deg' }],
  },
  rightText: {
    transform: [{ rotate: '15deg' }],
  },
  noMoreCardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noMoreCardsTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  noMoreCardsSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  resetButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    overflow: 'hidden',
    paddingBottom: 0,
  },
  container2: {
    flex: 1,
    height: '100%',
    //overflow: 'hidden',
  },
  overlayWrapper: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginLeft: 0,
    zIndex: 1000,
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 0,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 1000,
  },
  statusBarSpacer: {
    height: 0,
    backgroundColor: '#fff',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  languageText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  currencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currencyText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  iconButton: {
    position: 'relative',
    padding: 2,
  },
  avatarImage: {
    width: 30,
    height: 30,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#F53F7A',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#F53F7A',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Tinder Styles
  tinderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  tinderCard: {
    position: 'absolute',
    width: screenWidth - 40,
    height: screenHeight * 0.7,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 15,
    overflow: 'hidden',
  },
  cardTouchable: {
    flex: 1,
  },
  tinderImageContainer: {
    flex: 1,
    position: 'relative',
  },
  tinderImage: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    top: '35%',
    left: '25%',
    right: '25%',
    bottom: '35%',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  tinderFeaturedBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 2,
  },
  tinderFeaturedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tinderWishlistButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  tinderProductInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 25,
    zIndex: 1,
  },
  tinderProductHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tinderProductName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 10,
  },
  tinderStockBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tinderStockText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tinderCategory: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 15,
  },
  tinderPriceContainer: {
    gap: 10,
  },
  tinderPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tinderPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  tinderOriginalPrice: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    textDecorationLine: 'line-through',
  },
  tinderMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tinderDiscountBadge: {
    backgroundColor: '#F53F7A',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tinderDiscountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tinderRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  tinderRatingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tinderReviewsText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  swipeIndicator: {
    position: 'absolute',
    top: '50%',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
    transform: [{ translateY: -25 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  likeIndicator: {
    right: '25%',
    borderColor: 'rgba(76, 175, 80, 0.8)',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  passIndicator: {
    left: '25%',
    borderColor: 'rgba(244, 67, 54, 0.8)',
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
  },
  swipeIndicatorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    zIndex: 10,
  },
  fullGradientOverlay: {
    position: 'absolute',
    top: '35%',
    left: '25%',
    right: '25%',
    bottom: '35%',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  tinderActionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 20,
    gap: 40,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  passButton: {
    backgroundColor: '#F44336',
  },
  likeButton: {
    backgroundColor: '#4CAF50',
  },

  // Original styles continue...
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  productCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sortLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
  },
  sortButtons: {
    flexDirection: 'row',
    flex: 1,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  activeSortButton: {
    backgroundColor: '#FFE8F0',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  horizontalCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  horizontalImage: {
    width: 110,
    height: 110,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  horizontalDetails: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  verticalCardWrapper: {
    width: '50%',
    padding: 6,
  },
  verticalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  verticalImage: {
    width: '100%',
    height: 180,
  },
  verticalDetails: {
    padding: 8,
  },
  name: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  category: {
    fontSize: 12,
    color: '#666',
  },
  horizontalPrice: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: 16,
  },
  verticalPrice: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: 14,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  reviewText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  activeSortButtonText: {
    color: '#F53F7A',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  productList: {
    padding: 12,
    paddingBottom: 20,
  },
  productCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    position: 'relative',
    margin: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  featuredBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  productImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  listImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listImage: {
    width: 80,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  productInfo: {
    padding: 10,
    paddingBottom: 12,
  },
  productName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1a1a',
    paddingBottom: 4,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  productDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    lineHeight: 16,
  },
  productMeta: {
    marginBottom: 8,
  },
  productStock: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  productSku: {
    fontSize: 11,
    color: '#999',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productListStyle: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 1,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
  originalPrice: {
    fontSize: 11,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  titleLeft: {
    flex: 1,
  },
  filterSortButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  count: {
    fontSize: 14,
    color: '#666',
  },
  offTag: {
    position: 'absolute',
    bottom: 95,
    left: 10,
    backgroundColor: '#F53F7A',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 2,
  },
  offTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  wishlistIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  resellIcon: {
    position: 'absolute',
    top: 10,
    right: 50,
    zIndex: 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  categoryName: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
    flexShrink: 1,
  },
  bottomBar: {
    width: '100%',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  bottomBarButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  bottomBarButtonText: {
    fontSize: 16,
    color: '#222',
    fontWeight: '600',
  },
  sortSheetContent: {
    padding: 24,
  },
  sortSheetLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 18,
    textTransform: 'uppercase',
  },
  sortSheetOption: {
    paddingVertical: 10,
  },
  sortSheetOptionText: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '400',
  },
  sortSheetOptionTextSelected: {
    color: '#000',
    fontWeight: 'bold',
  },
  filterLabel: {
    fontSize: 15,
    color: '#222',
    fontWeight: '600',
    marginBottom: 2,
  },
  filterInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#f7f8fa',
  },
  filterCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  filterCheckboxLabel: {
    fontSize: 16,
    color: '#222',
    marginLeft: 10,
  },
  filterApplyBtn: {
    backgroundColor: '#F53F7A',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  filterApplyBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  filterClearBtn: {
    backgroundColor: '#eee',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  filterClearBtnText: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 16,
  },
  stockIndicator: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3B30',
  },
  savedPopup: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  savedPopupContent: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  savedPopupLeft: {
    marginRight: 12,
  },
  savedPopupImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  savedPopupText: {
    flex: 1,
  },
  savedPopupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  savedPopupSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  savedPopupViewButton: {
    backgroundColor: '#F53F7A',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  savedPopupViewText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 24,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  discountAndRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    marginTop: 4,
  },
  discountPercentage: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 4,
    backgroundColor: '#F53F7A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#F53F7A',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 2,
  },
  discountBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
  },
  discountBadgeInline: {
    alignSelf: 'flex-start',
    backgroundColor: '#F53F7A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  discountBadgeTextInline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  reviewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 6,
  },
  reviews: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
  },
  imageSkeleton: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  skeletonShimmer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e0e0e0',
    position: 'absolute',
  },
  
  // View Toggle Styles
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  activeViewToggle: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeViewToggleText: {
    color: '#F53F7A',
  },
  
  // Filter Button Styles
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  
  // Wishlist Milestone Popup Styles
  wishlistMilestonePopup: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    transform: [{ translateY: -100 }],
  },
  wishlistMilestoneContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 15,
    borderWidth: 2,
    borderColor: '#F53F7A',
  },
  wishlistMilestoneIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFE8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  wishlistMilestoneTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  wishlistMilestoneSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  wishlistMilestoneButton: {
    backgroundColor: '#F53F7A',
    borderRadius: 25,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  wishlistMilestoneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Tinder Mode Container - Enhanced for better centering
  tinderModeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: '#f8f9fa', // Light background like Tinder
  },

  // New Swipe Card Styles (now using dynamic styles in component)
  // swipeCardContainer and swipeImageContainer moved to dynamic styles
  swipeWishlistIcon: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  swipeFeaturedBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  swipeFeaturedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  swipeImageError: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeImageErrorText: {
    marginTop: 10,
    color: '#999',
    fontSize: 14,
  },
  // swipeImageBackground moved to dynamic styles
  swipeImageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  // swipeVideoStyle moved to dynamic styles
  swipeNavButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9,
  },
  swipeNavLeft: {
    left: 12,
  },
  swipeNavRight: {
    right: 12,
  },
  swipeTopOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 8,
  },
  swipeProductHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  swipeProductName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    flex: 1,
    marginRight: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  swipeStockIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  swipeStockText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  swipeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  swipeRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  swipeRatingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  swipeReviewsText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
  },
  // swipeInfoPanel moved to dynamic styles
  swipePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  swipePriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swipePrice: {
    fontSize: 26,
    fontWeight: '800',
    color: '#333',
    letterSpacing: 0.5,
  },
  swipeOriginalPriceText: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  swipeDiscountTag: {
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  swipeDiscountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  swipeButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  swipeTryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#F53F7A',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#F53F7A',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  swipeTryButtonText: {
    color: '#F53F7A',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  swipeShopButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F53F7A',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#F53F7A',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  swipeShopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default Products;