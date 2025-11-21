import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Linking,
  Platform,
  ToastAndroid,
  Alert,
  Modal,
  StatusBar,
  Animated,
  TextInput,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AntDesign } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '~/types/navigation';
import { useUser } from '~/contexts/UserContext';
import { useCart } from '~/contexts/CartContext';
import { useWishlist } from '~/contexts/WishlistContext';
import { usePreview } from '~/contexts/PreviewContext';
import { supabase } from '~/utils/supabase';
import { akoolService } from '~/utils/akoolService';
import piAPIVirtualTryOnService from '~/services/piapiVirtualTryOn';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { getSafeImageUrls, getFirstSafeImageUrl, getProductImages, getFirstSafeProductImage } from '../../utils/imageUtils';
import BottomSheet from '@gorhom/bottom-sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SaveToCollectionSheet, ProfilePhotoRequiredModal } from '~/components/common';
import { useLoginSheet } from '~/contexts/LoginSheetContext';
import { GestureHandlerRootView, PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');

// Size sorting constants and functions
const SIZE_PRIORITY = [
  'XXS',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  '2XL',
  '3XL',
  '4XL',
  '5XL',
  '6XL',
  '7XL',
  '8XL',
];

const getSizeSortValue = (sizeName: string) => {
  if (!sizeName) return Number.MAX_SAFE_INTEGER;
  const normalized = sizeName.trim().toUpperCase();
  const priorityIndex = SIZE_PRIORITY.indexOf(normalized);
  if (priorityIndex !== -1) return priorityIndex;

  const numericValue = parseFloat(normalized.replace(/[^0-9.]/g, ''));
  if (!Number.isNaN(numericValue)) {
    return SIZE_PRIORITY.length + numericValue;
  }

  return SIZE_PRIORITY.length + normalized.charCodeAt(0);
};

const sortSizesAscending = <T extends { name: string }>(sizes: T[]): T[] => {
  return [...sizes].sort((a, b) => getSizeSortValue(a.name) - getSizeSortValue(b.name));
};

interface ProductVariant {
  id: string;
  product_id: string;
  color_id?: string;
  size_id: string;
  quantity: number;
  price?: number;
  image_urls?: string[];
  video_urls?: string[];
  color?: {
    id: string;
    name: string;
    hex_code: string;
  };
  size: {
    id: string;
    name: string;
  };
}

interface Product {
  id: string;
  name: string;
  description: string;
  image_urls?: string[];
  video_urls?: string[];
  featured?: any;
  category?: {
    name: string;
  };
  stock_quantity: number;
  discount?: number;
  like_count?: number;
  variants: {
    id: string;
    price: number;
    size: {
      name: string;
    };
  }[];
}

interface ProductDetailsBottomSheetProps {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onShowCollectionSheet?: (product: any) => void;
}

const ProductDetailsBottomSheet: React.FC<ProductDetailsBottomSheetProps> = ({
  visible,
  product,
  onClose,
  onShowCollectionSheet,
}) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { userData, setUserData, refreshUserData } = useUser();
  const { showLoginSheet } = useLoginSheet();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist, removeFromWishlist, addToWishlist } = useWishlist();
  const { addToPreview } = usePreview();
  const { t } = useTranslation();

  // State for collection sheet
  const [showCollectionSheet, setShowCollectionSheet] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
  // Try on modal state
  const [showTryOnModal, setShowTryOnModal] = useState(false);
  const [showProfilePhotoModal, setShowProfilePhotoModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showSizeSelectionModal, setShowSizeSelectionModal] = useState(false);
  const [sizeSelectionDraft, setSizeSelectionDraft] = useState<string | null>(null);
  const [sizeSelectionError, setSizeSelectionError] = useState('');
  const [tryOnSizeId, setTryOnSizeId] = useState<string | null>(null);
  const [coinBalance, setCoinBalance] = useState(0);

  const promptLoginForTryOn = useCallback(() => {
    Toast.show({
      type: 'info',
      text1: 'Login Required',
      text2: 'Please login to use Face Swap.',
    });
    showLoginSheet();
  }, [showLoginSheet]);
  
  // Vendor info from product data
  const vendorName = (product as any)?.vendor_name || 'Unknown Vendor';
  const vendorAlias = (product as any)?.alias_vendor;
  const returnPolicy = (product as any)?.return_policy;

  // State for variants and available options
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [availableColors, setAvailableColors] = useState<{ id: string; name: string; hex_code: string }[]>([]);
  const [availableSizes, setAvailableSizes] = useState<{ id: string; name: string }[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [showMarginModal, setShowMarginModal] = useState(false);
  const [selectedMargin, setSelectedMargin] = useState(15);
  const [customPrice, setCustomPrice] = useState('');
  const [customPriceError, setCustomPriceError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  
  // More Like This suggestions
  const [suggestedProducts, setSuggestedProducts] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  
  // Video state
  const [videoStates, setVideoStates] = useState<{ [key: number]: { isPlaying: boolean; isMuted: boolean } }>({});
  const videoRefs = useRef<{ [key: number]: any }>({});
  const mediaListRef = useRef<FlatList<MediaItem>>(null);
  
  // Unified media interface
  interface MediaItem {
    type: 'image' | 'video';
    url: string;
    thumbnail?: string;
  }
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isFullScreenVisible, setIsFullScreenVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [fullScreenMediaType, setFullScreenMediaType] = useState<'image' | 'video'>('image');
  const [isFullScreenVideoPlaying, setIsFullScreenVideoPlaying] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(1);
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const combinedScale = Animated.multiply(baseScale, pinchScale);
  const translateXFullscreen = useRef(new Animated.Value(0)).current;
  const translateYFullscreen = useRef(new Animated.Value(0)).current;
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);

  const selectedTryOnSizeName = useMemo(() => {
    const targetId = tryOnSizeId || sizeSelectionDraft || selectedSize;
    if (!targetId) return null;
    const size = availableSizes.find((s) => s.id === targetId);
    return size?.name || null;
  }, [tryOnSizeId, sizeSelectionDraft, selectedSize, availableSizes]);

  const resetFullScreenZoom = useCallback(() => {
    baseScale.setValue(1);
    pinchScale.setValue(1);
    translateXFullscreen.setValue(0);
    translateYFullscreen.setValue(0);
    translateXFullscreen.setOffset(0);
    translateYFullscreen.setOffset(0);
    translateXFullscreen.flattenOffset();
    translateYFullscreen.flattenOffset();
    lastScale.current = 1;
    lastTranslateX.current = 0;
    lastTranslateY.current = 0;
    setCurrentZoom(1);
  }, [baseScale, pinchScale, translateXFullscreen, translateYFullscreen]);

  useEffect(() => {
    if (!visible) {
      setIsFullScreenVisible(false);
      resetFullScreenZoom();
      setCurrentZoom(1);
    }
  }, [visible, resetFullScreenZoom]);

  useEffect(() => {
    resetFullScreenZoom();
  }, [imageViewerIndex, resetFullScreenZoom]);

  const onPinchEvent = Animated.event([{ nativeEvent: { scale: pinchScale } }], {
    useNativeDriver: true,
  });

  const onPinchStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      let nextScale = lastScale.current * event.nativeEvent.scale;
      nextScale = Math.max(1, Math.min(nextScale, 2.5));
      baseScale.setValue(nextScale);
      pinchScale.setValue(1);
      lastScale.current = nextScale;
      setCurrentZoom(parseFloat(nextScale.toFixed(2)));

      if (nextScale === 1) {
        Animated.parallel([
          Animated.spring(translateXFullscreen, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.spring(translateYFullscreen, {
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start();
        translateXFullscreen.setOffset(0);
        translateYFullscreen.setOffset(0);
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
      }
    }
  };

  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationX: translateXFullscreen, translationY: translateYFullscreen } }],
    {
      useNativeDriver: true,
      listener: () => {
        if (lastScale.current <= 1) {
          translateXFullscreen.setValue(0);
          translateYFullscreen.setValue(0);
        }
      },
    }
  );

  const onPanStateChange = (event: any) => {
    if (lastScale.current <= 1) {
      translateXFullscreen.setOffset(0);
      translateYFullscreen.setOffset(0);
      translateXFullscreen.setValue(0);
      translateYFullscreen.setValue(0);
      return;
    }

    if (event.nativeEvent.state === State.BEGAN) {
      translateXFullscreen.setOffset(lastTranslateX.current);
      translateXFullscreen.setValue(0);
      translateYFullscreen.setOffset(lastTranslateY.current);
      translateYFullscreen.setValue(0);
    }

    if (event.nativeEvent.state === State.END || event.nativeEvent.oldState === State.ACTIVE) {
      lastTranslateX.current += event.nativeEvent.translationX;
      lastTranslateY.current += event.nativeEvent.translationY;
      translateXFullscreen.flattenOffset();
      translateYFullscreen.flattenOffset();
    }
  };

  const handleFullScreenDoubleTap = () => {
    if (lastScale.current > 1) {
      Animated.parallel([
        Animated.spring(baseScale, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(pinchScale, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(translateXFullscreen, {
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.spring(translateYFullscreen, {
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
      lastScale.current = 1;
      lastTranslateX.current = 0;
      lastTranslateY.current = 0;
      translateXFullscreen.setOffset(0);
      translateYFullscreen.setOffset(0);
      translateXFullscreen.setValue(0);
      translateYFullscreen.setValue(0);
      setCurrentZoom(1);
    } else {
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
      translateXFullscreen.setOffset(0);
      translateYFullscreen.setOffset(0);
      translateXFullscreen.setValue(0);
      translateYFullscreen.setValue(0);
      lastScale.current = 2;
      setCurrentZoom(2);
    }
  };

  const openFullScreen = useCallback(
    (type: 'image' | 'video', index: number) => {
      setImageViewerIndex(index);
      setFullScreenMediaType(type);
      if (type === 'video') {
        setIsFullScreenVideoPlaying(true);
      } else {
        resetFullScreenZoom();
      }
      setCurrentZoom(1);
      setIsFullScreenVisible(true);
    },
    [resetFullScreenZoom]
  );

  const closeFullScreen = useCallback(() => {
    setIsFullScreenVisible(false);
    setIsFullScreenVideoPlaying(true);
    resetFullScreenZoom();
    setCurrentZoom(1);
  }, [resetFullScreenZoom]);
  
  // Cache for processed image URLs to avoid repeated conversions
  const processedImageCache = useRef<{ [key: string]: string[] }>({});
  
  // Image loading states
  const [imageLoadingStates, setImageLoadingStates] = useState<{ [key: string]: boolean }>({});

  // Selection state
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [addToCartLoading, setAddToCartLoading] = useState(false);
  const [replacementPolicyVisible, setReplacementPolicyVisible] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['25%', '50%', '90%'], []);

  // Memoize the getUserPrice function to prevent unnecessary recalculations
  // Helper function to add product directly to "All" collection
  const addToAllCollection = async () => {
    if (!userData?.id || !product?.id) {
      console.log('No user ID or product ID, cannot add to collection');
      return;
    }

    // Show toast immediately when heart is clicked
    Toast.show({
      type: 'success',
      text1: 'Added to Wishlist',
      text2: `${product.name} saved to All folder`,
      position: 'top',
      visibilityTime: 3000,
    });

    try {
      // Get or create "All" collection
      let allCollectionId = null;
      const { data: existingAllCollection } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', userData.id)
        .eq('name', 'All')
        .single();

      if (existingAllCollection) {
        allCollectionId = existingAllCollection.id;
      } else {
        // Create "All" collection
        const { data: newCollection, error: createError } = await supabase
          .from('collections')
          .insert({
            user_id: userData.id,
            name: 'All',
            is_private: false,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating All collection:', createError);
          return;
        }
        allCollectionId = newCollection.id;
      }

      // Check if product already exists in "All" collection
      const { data: existingProduct } = await supabase
        .from('collection_products')
        .select('id')
        .eq('product_id', product.id)
        .eq('collection_id', allCollectionId)
        .single();

      if (!existingProduct) {
        // Add product to "All" collection
        const { error: insertError } = await supabase
          .from('collection_products')
          .insert({
            product_id: product.id,
            collection_id: allCollectionId,
          });

        if (insertError) {
          console.error('Error adding to All collection:', insertError);
        } else {
          console.log('Successfully added to All collection');
          
          // Add to wishlist context with complete product object
          const wishlistProduct = {
            id: product.id,
            name: product.name,
            description: product.description || '',
            price: getUserPrice(product),
            image_url: productImages[0] || '',
            image_urls: productImages,
            video_urls: product.video_urls || [],
            featured_type: product.featured || '',
            category: product.category,
            stock_quantity: product.stock_quantity || 0,
            variants: product.variants || [],
          };
          
          await addToWishlist(wishlistProduct);
          
          // Toast already shown at the beginning
        }
      } else {
        console.log('Product already in All collection');
      }
    } catch (error) {
      console.error('Error in addToAllCollection:', error);
    }
  };

  const getUserPrice = useCallback((product: Product) => {
    console.log('💰 getUserPrice called - variants:', variants.length, 'product.variants:', product.variants?.length);
    
    // First check if we have variants from the database
    if (variants && variants.length > 0) {
      console.log('📊 Database variants found:', variants.map(v => ({ id: v.id, price: v.price, size: v.size?.name })));
      
      // If user has selected size and color, get that variant's price
      if (selectedSize && selectedColor) {
        const selectedVariant = variants.find(v => 
          v.size_id === selectedSize && v.color_id === selectedColor
        );
        if (selectedVariant?.price) {
          console.log('✅ Selected variant price:', selectedVariant.price);
          return selectedVariant.price;
        }
      }
      
      // If user has a size preference, try to find that size
      if (userData?.size) {
        const userSizeVariant = variants.find(v => 
          v.size?.name === userData.size
        );
        if (userSizeVariant?.price) {
          console.log('👤 User size variant price:', userSizeVariant.price);
          return userSizeVariant.price;
        }
      }
      
      // Return the first available variant price
      const firstVariant = variants.find(v => v.price);
      if (firstVariant?.price) {
        console.log('🥇 First variant price:', firstVariant.price);
        return firstVariant.price;
      }
    }
    
    // Fallback to product.variants (from the original product data)
    if (product.variants && product.variants.length > 0) {
      console.log('📦 Product variants found:', product.variants.map(v => ({ price: v.price, size: v.size?.name })));
      
      if (userData?.size) {
        const userSizeVariant = product.variants.find(v => 
          v.size?.name === userData.size
        );
        if (userSizeVariant) {
          console.log('👤 User size product variant price:', userSizeVariant.price);
          return userSizeVariant.price;
        }
      }

      const sortedVariants = [...product.variants].sort((a, b) => a.price - b.price);
      const lowestPrice = sortedVariants[0]?.price || 0;
      console.log('🥇 Lowest product variant price:', lowestPrice);
      return lowestPrice;
    }
    
    console.log('❌ No price found, returning 0');
    return 0;
  }, [variants, selectedSize, selectedColor, userData?.size]);

  // Memoize expensive calculations
  const userPrice = useMemo(() => {
    if (!product) return 0;
    return getUserPrice(product);
  }, [product, getUserPrice]);

  const baseResellPrice = useMemo(() => {
    if (selectedVariant?.price) return selectedVariant.price;
    const pricedVariant = variants.find((v) => v.price);
    if (pricedVariant?.price) return pricedVariant.price;
    if (product?.variants && product.variants.length > 0) {
      const productVariantWithPrice = product.variants.find((v) => v.price);
      if (productVariantWithPrice?.price) return productVariantWithPrice.price;
    }
    return userPrice || 0;
  }, [selectedVariant, variants, product?.variants, userPrice]);

  const totalStock = useMemo(() => {
    if (variants.length > 0) {
      return variants.reduce((sum, variant) => sum + variant.quantity, 0);
    }
    return product?.stock_quantity || 0;
  }, [variants, product?.stock_quantity]);

  const availableQuantity = useMemo(() => {
    if (!selectedSize) return 0;
    
    // If color is selected, find variant with both size and color
    if (selectedColor) {
      const variant = variants.find(v => v.size_id === selectedSize && v.color_id === selectedColor);
      console.log('🎨 Color selected - variant found:', variant?.quantity || 0);
      return variant?.quantity || 0;
    }
    
    // If no color selected, sum all quantities for the selected size
    const sizeVariants = variants.filter(v => v.size_id === selectedSize);
    const totalQuantity = sizeVariants.reduce((sum, variant) => sum + variant.quantity, 0);
    console.log('👕 No color selected - total quantity for size:', selectedSize, '=', totalQuantity);
    return totalQuantity;
  }, [variants, selectedSize, selectedColor]);

  const isLowStock = useMemo(() => totalStock < 5, [totalStock]);

  // Debug logging for add to cart button state
  useEffect(() => {
    console.log('🛒 Add to cart button - availableQuantity:', availableQuantity, 'disabled:', availableQuantity === 0 || addToCartLoading);
  }, [availableQuantity, addToCartLoading]);

  useEffect(() => {
    console.log('🔄 ProductDetailsBottomSheet useEffect - visible:', visible, 'product:', product?.id);
    if (visible && product) {
      console.log('📱 Expanding ProductDetailsBottomSheet');
      setTimeout(() => {
        bottomSheetRef.current?.expand();
      }, 100);
      fetchProductVariants();
      fetchReviews();
      processProductImages();
      fetchSuggestedProducts();
    } else {
      console.log('📱 Closing ProductDetailsBottomSheet');
      bottomSheetRef.current?.close();
    }
  }, [visible, product]);

  // Fetch user coin balance
  useEffect(() => {
    if (userData?.id) {
      fetchUserCoinBalance();
    }
  }, [userData?.id]);

  const fetchReviews = async () => {
    if (!product?.id) return;

    try {
      setReviewsLoading(true);
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reviews:', error);
        return;
      }

      setReviews(data || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setReviewsLoading(false);
    }
  };

  // Fetch suggested products based on current product
  const fetchSuggestedProducts = async () => {
    if (!product?.id) return;
    
    try {
      setSuggestionsLoading(true);
      
      // Fetch all products from the database (not filtered by category)
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          image_urls,
          vendor_name,
          product_variants(
            id, 
            price, 
            mrp_price, 
            rsp_price, 
            discount_percentage, 
            image_urls
          )
        `)
        .neq('id', product.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50); // Fetch 50 products to ensure variety

      if (error) {
        console.error('Error fetching suggested products:', error);
        return;
      }

      console.log('📦 BottomSheet - Fetched suggested products:', data?.length || 0, 'products');

      setSuggestedProducts(data || []);
    } catch (error) {
      console.error('Error fetching suggested products:', error);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // Process images when selected variant changes
  useEffect(() => {
    if (visible && product) {
      processProductImages();
    }
  }, [selectedVariant, visible, product]);

  // Pre-load all images for faster switching using React Native Image.prefetch
  useEffect(() => {
    if (mediaItems.length > 0) {
      // Pre-load all images in the background
      mediaItems.forEach((mediaItem, index) => {
        if (mediaItem.type === 'image' && mediaItem.url && !mediaItem.url.includes('placeholder')) {
          Image.prefetch(mediaItem.url).catch(() => {
            // Silently handle prefetch errors
          });
        }
      });
    }
  }, [mediaItems]);

  const processProductImages = () => {
    if (product) {
      console.log('🔍 BottomSheet - product:', {
        id: product.id,
        image_urls: product.image_urls,
        video_urls: product.video_urls,
        selectedVariant: selectedVariant?.id,
      });

      // Clear cache for this product to ensure fresh processing
      const productCacheKey = `product_${product.id}`;
      const urlsCacheKey = `product_urls_${product.id}`;
      if (processedImageCache.current[productCacheKey] || processedImageCache.current[urlsCacheKey]) {
        console.log('🧹 [BottomSheet] Clearing cache for product:', product.id);
        delete processedImageCache.current[productCacheKey];
        delete processedImageCache.current[urlsCacheKey];
      }

      // Helper function to check if URL is a video
      const isVideoUrl = (url: string) => {
        if (!url) return false;
        const lowerUrl = url.toLowerCase();
        
        // Explicitly exclude Google Drive thumbnail URLs (these are always images)
        if (lowerUrl.includes('drive.google.com/thumbnail')) {
          return false;
        }
        
        // More precise video detection - only if it explicitly has video markers
        const hasVideoExtension = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'].some(ext => lowerUrl.endsWith(ext));
        const hasExplicitVideoMarkers = lowerUrl.includes('/video/') || url.includes('video=mp4');
        
        // Special case for known video service domains with explicit video extensions  
        const isKnownVideoService = (
          (lowerUrl.includes('theapi.app') || lowerUrl.includes('piapi.ai')) && 
          hasVideoExtension
        );
        
        // Google Drive video URLs (not thumbnails)
        const isGoogleDriveVideo = lowerUrl.includes('drive.google.com') && 
                                  !lowerUrl.includes('thumbnail') && 
                                  (lowerUrl.includes('export=download') || hasVideoExtension);
        
        const isVideo = hasVideoExtension || hasExplicitVideoMarkers || isKnownVideoService || isGoogleDriveVideo;
        
        console.log('🎬 [BottomSheet] Video detection for URL:', url.substring(0, 60) + '...', '→', isVideo, {
          hasVideoExtension,
          hasExplicitVideoMarkers,
          isKnownVideoService,
          isGoogleDriveVideo,
          isGoogleDriveThumbnail: lowerUrl.includes('drive.google.com/thumbnail')
        });
        return isVideo;
      };

      // Helper function to convert Google Drive URLs to direct video URLs
      const convertGoogleDriveVideoUrl = (url: string): string => {
        if (!url || typeof url !== 'string') return url;
        
        // Check if it's a Google Drive URL
        if (!url.includes('drive.google.com')) return url;
        
        try {
          // Extract file ID from Google Drive URL
          let fileId: string | null = null;
          
          // Format: https://drive.google.com/file/d/{fileId}/view?usp=sharing
          const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
          if (fileMatch) {
            fileId = fileMatch[1];
          }
          
          if (fileId) {
            // Convert to direct video URL for Google Drive
            return `https://drive.google.com/uc?export=download&id=${fileId}`;
          }
          
          return url;
        } catch (error) {
          console.error('Error converting Google Drive video URL:', error);
          return url;
        }
      };

      let unifiedMediaItems: MediaItem[] = [];

      // Priority 1: Check for images from selected variant
      if (selectedVariant && selectedVariant.image_urls && selectedVariant.image_urls.length > 0) {
        const cacheKey = `variant_${selectedVariant.id}`;
                if (processedImageCache.current[cacheKey]) {
            const cachedImages = processedImageCache.current[cacheKey];
            unifiedMediaItems = cachedImages.map(url => {
              const isVideo = isVideoUrl(url);
              console.log('🔍 [BottomSheet] Processing cached variant URL:', url.substring(0, 60) + '... →', isVideo ? 'VIDEO' : 'IMAGE');
              return { 
                type: isVideo ? 'video' as const : 'image' as const, 
                url 
              };
            });
            console.log('✅ BottomSheet - Using cached images from selected variant:', cachedImages);
        } else {
          // Use raw URLs for faster processing, let Image component handle errors
          const images = selectedVariant.image_urls.filter(url => url && typeof url === 'string');
          unifiedMediaItems = images.map(url => {
            const isVideo = isVideoUrl(url);
            console.log('🔍 [BottomSheet] Processing variant URL:', url.substring(0, 60) + '... →', isVideo ? 'VIDEO' : 'IMAGE');
            return { 
              type: isVideo ? 'video' as const : 'image' as const, 
              url 
            };
          });
          processedImageCache.current[cacheKey] = images;
          console.log('✅ BottomSheet - Using raw images from selected variant:', images);
        }
      }
      // Priority 2: Check for images in product variants first
      else {
        const productImages = getProductImages(product);
        if (productImages.length > 0) {
          const cacheKey = `product_${product.id}`;
          if (processedImageCache.current[cacheKey]) {
            const cachedImages = processedImageCache.current[cacheKey];
            unifiedMediaItems = cachedImages.map(url => {
              const isVideo = isVideoUrl(url);
              console.log('🔍 [BottomSheet] Processing cached product URL:', url.substring(0, 60) + '... →', isVideo ? 'VIDEO' : 'IMAGE');
              return { 
                type: isVideo ? 'video' as const : 'image' as const, 
                url 
              };
            });
            console.log('✅ BottomSheet - Using cached images from product variants:', cachedImages);
          } else {
            // Use raw URLs for faster processing
            const images = productImages.filter(url => url && typeof url === 'string');
            unifiedMediaItems = images.map(url => {
              const isVideo = isVideoUrl(url);
              console.log('🔍 [BottomSheet] Processing product URL:', url.substring(0, 60) + '... →', isVideo ? 'VIDEO' : 'IMAGE');
              return { 
                type: isVideo ? 'video' as const : 'image' as const, 
                url 
              };
            });
            processedImageCache.current[cacheKey] = images;
            console.log('✅ BottomSheet - Using raw images from product variants:', images);
          }
        }
        // Priority 3: Check for images in image_urls array
        else if (
          product.image_urls &&
          Array.isArray(product.image_urls) &&
          product.image_urls.length > 0
        ) {
          const cacheKey = `product_urls_${product.id}`;
          if (processedImageCache.current[cacheKey]) {
            const cachedImages = processedImageCache.current[cacheKey];
            unifiedMediaItems = cachedImages.map(url => {
              const isVideo = isVideoUrl(url);
              console.log('🔍 [BottomSheet] Processing cached image_urls URL:', url.substring(0, 60) + '... →', isVideo ? 'VIDEO' : 'IMAGE');
              return { 
                type: isVideo ? 'video' as const : 'image' as const, 
                url 
              };
            });
            console.log('✅ BottomSheet - Using cached image_urls array:', cachedImages);
          } else {
            // Use raw URLs for faster processing
            const images = product.image_urls.filter(url => url && typeof url === 'string');
            unifiedMediaItems = images.map(url => {
              const isVideo = isVideoUrl(url);
              console.log('🔍 [BottomSheet] Processing image_urls URL:', url.substring(0, 60) + '... →', isVideo ? 'VIDEO' : 'IMAGE');
              return { 
                type: isVideo ? 'video' as const : 'image' as const, 
                url 
              };
            });
            processedImageCache.current[cacheKey] = images;
            console.log('✅ BottomSheet - Using raw image_urls array:', images);
          }
        }
      }

      // Add videos if available (from selected variant first, then product)
      let videoItems: MediaItem[] = [];
      if (selectedVariant && selectedVariant.video_urls && selectedVariant.video_urls.length > 0) {
        videoItems = selectedVariant.video_urls
          .filter(url => url && typeof url === 'string')
          .map(url => ({ 
            type: 'video' as const, 
            url: convertGoogleDriveVideoUrl(url),
            thumbnail: unifiedMediaItems[0]?.url // Use first image as thumbnail
          }));
        console.log('✅ BottomSheet - Using videos from selected variant:', selectedVariant.video_urls);
      } else if (
        product.video_urls &&
        Array.isArray(product.video_urls) &&
        product.video_urls.length > 0
      ) {
        videoItems = product.video_urls
          .filter(url => url && typeof url === 'string')
          .map(url => ({ 
            type: 'video' as const, 
            url: convertGoogleDriveVideoUrl(url),
            thumbnail: unifiedMediaItems[0]?.url // Use first image as thumbnail
          }));
        console.log('✅ BottomSheet - Using videos from product:', product.video_urls);
      }

      // Combine images and videos
      const combinedMediaItems = [...unifiedMediaItems, ...videoItems];

      console.log('📸 BottomSheet - Final unified media items:', combinedMediaItems.map(item => ({ 
        type: item.type, 
        url: item.url.substring(0, 50) + '...', 
        isFirstItem: combinedMediaItems.indexOf(item) === 0 
      })));
      
      // Only update if the media items have actually changed
      setMediaItems(prevItems => {
        const newItems = combinedMediaItems;
        if (JSON.stringify(prevItems) !== JSON.stringify(newItems)) {
      setCurrentImageIndex(0);
          return newItems;
        }
        return prevItems;
      });

      // Also update productImages for backward compatibility
      setProductImages(prevImages => {
        const newImages = combinedMediaItems.map(item => item.url);
        if (JSON.stringify(prevImages) !== JSON.stringify(newImages)) {
          return newImages;
        }
        return prevImages;
      });
    }
  };

  const fetchProductVariants = async () => {
    if (!product?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_variants')
        .select(`
          id,
          product_id,
          color_id,
          size_id,
          quantity,
          price,
          size:sizes(id, name)
        `)
        .eq('product_id', product.id);

      if (error) {
        console.error('Error fetching variants:', error);
        return;
      }

      console.log('📊 Fetched variants data:', data);

      const variantsData: ProductVariant[] = (data || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        color_id: item.color_id,
        size_id: item.size_id,
        quantity: item.quantity,
        price: item.price,
        color: item.color_id ? { id: item.color_id, name: 'Color', hex_code: '#000000' } : undefined,
        size: Array.isArray(item.size) ? item.size[0] : item.size,
      }));

      console.log('🔧 Processed variants:', variantsData.map(v => ({
        id: v.id,
        size: v.size?.name,
        color_id: v.color_id,
        quantity: v.quantity,
        price: v.price
      })));

      setVariants(variantsData);

      // Only show sizes since colors are optional now
      const sizes = [...new Map(variantsData.map(v => v.size).filter(Boolean).map(v => [v.id, v])).values()];

      // Sort sizes in ascending order (XS, S, M, L, XL, 2XL, etc.)
      const sortedSizes = sortSizesAscending(sizes);

      console.log('👕 Available sizes:', sortedSizes.map(s => ({ id: s.id, name: s.name })));

      setAvailableSizes(sortedSizes);

      if (sizes.length > 0 && !selectedSize) {
        const userSizeVariant = sizes.find(s => s.name === userData?.size);
        const initialSize = userSizeVariant?.id || sizes[0].id;
        console.log('🎯 Setting initial size:', initialSize);
        setSelectedSize(initialSize);
      }
    } catch (error) {
      console.error('Error fetching variants:', error);
    } finally {
      setLoading(false);
    }
  };



  const renderSizeOption = (size: { id: string; name: string }) => (
    <TouchableOpacity
      key={size.id}
      style={[
        styles.sizeOption,
        selectedSize === size.id && styles.selectedSizeOption
      ]}
      onPress={() => setSelectedSize(size.id)}
    >
      <Text style={[
        styles.sizeText,
        selectedSize === size.id && styles.selectedSizeText
      ]}>
        {size.name}
      </Text>
    </TouchableOpacity>
  );

  const renderColorOption = (color: { id: string; name: string; hex_code: string }) => (
    <TouchableOpacity
      key={color.id}
      style={styles.colorOptionContainer}
      onPress={() => setSelectedColor(color.id)}
    >
      <View style={[
        styles.colorOption,
        { backgroundColor: color.hex_code },
        color.hex_code.toLowerCase() === '#ffffff' && styles.whiteColorBorder,
        selectedColor === color.id && styles.selectedColorOption
      ]} />
      <Text style={styles.colorName}>{color.name}</Text>
    </TouchableOpacity>
  );

  const fetchUserCoinBalance = async () => {
    if (!userData?.id) return;
    
    try {
      const balance = await akoolService.getUserCoinBalance(userData.id);
      setCoinBalance(balance);
    } catch (error) {
      console.error('Error fetching coin balance:', error);
    }
  };

  const handleTryOnButtonPress = () => {
    if (!userData?.id) {
      promptLoginForTryOn();
      return;
    }

    if (availableSizes.length > 0) {
      const preferredSize =
        (selectedSize && availableSizes.find((size) => size.id === selectedSize)) ||
        (tryOnSizeId && availableSizes.find((size) => size.id === tryOnSizeId)) ||
        (userData?.size && availableSizes.find((size) => size.name === userData.size));
      const initialSizeId = preferredSize?.id || availableSizes[0].id;
      setSizeSelectionDraft(initialSizeId);
      setSizeSelectionError('');
      setShowSizeSelectionModal(true);
    } else {
      setSizeSelectionDraft(null);
      setTryOnSizeId(null);
      setSizeSelectionError('');
      setShowConsentModal(true);
    }
  };

  const handleConfirmSizeSelection = () => {
    if (!sizeSelectionDraft) {
      setSizeSelectionError('Please choose a size to continue.');
      return;
    }

    setTryOnSizeId(sizeSelectionDraft);
    setSelectedSize(sizeSelectionDraft);
    setShowSizeSelectionModal(false);
    setSizeSelectionError('');
    setShowConsentModal(true);
  };

  const handleCancelSizeSelection = () => {
    setShowSizeSelectionModal(false);
    setSizeSelectionDraft(null);
    setSizeSelectionError('');
    setTryOnSizeId(null);
  };

  const handleConsentCancel = () => {
    setShowConsentModal(false);
    setTryOnSizeId(null);
    setSizeSelectionDraft(null);
  };

  const handleConsentAgree = () => {
    setShowConsentModal(false);
    setShowTryOnModal(true);
  };

  const handleStartFaceSwap = () => {
    const sizeId = tryOnSizeId || selectedSize || undefined;
    handleVirtualTryOn(sizeId);
  };

  const handleVirtualTryOn = async (sizeId?: string) => {
    if (!userData?.id) {
      setShowTryOnModal(false);
      promptLoginForTryOn();
      return;
    }

    // Ensure we have the latest profile state
    await refreshUserData?.();
    if (!userData?.profilePhoto) {
      setShowTryOnModal(false);
      setShowProfilePhotoModal(true);
      setTryOnSizeId(null);
      setSizeSelectionDraft(null);
      setSizeSelectionError('');
      return;
    }

    if (coinBalance < 25) {
      Alert.alert('Insufficient Coins', 'You need at least 25 coins for Face Swap. Please purchase more coins.');
      return;
    }

    const productId = product?.id;
    if (!productId) {
      Alert.alert('Error', 'Product not available');
      return;
    }
    
    const sizedVariant =
      sizeId && variants.find((variant) => variant.size_id === sizeId && variant.image_urls?.length);
    const firstVariantWithImage = variants.find(v => v.image_urls && v.image_urls.length > 0);
    const productImageUrl =
      sizedVariant?.image_urls?.[0] ||
      firstVariantWithImage?.image_urls?.[0] ||
      product?.image_urls?.[0];

    if (!productImageUrl) {
      Alert.alert('Error', 'Product image not available');
      return;
    }

    setShowTryOnModal(false);

    try {
      // Update coin balance (deduct 25 coins for face swap)
      setCoinBalance(prev => prev - 25);
      
      // Also update user context
      if (userData) {
        setUserData({ ...userData, coin_balance: (userData.coin_balance || 0) - 25 });
      }

      // Deduct coins from database
      await supabase
        .from('users')
        .update({ coin_balance: (userData?.coin_balance || 0) - 25 })
        .eq('id', userData?.id);

      // Initiate face swap with PiAPI
      const response = await piAPIVirtualTryOnService.initiateVirtualTryOn({
        userImageUrl: userData.profilePhoto,
        productImageUrl: productImageUrl,
        userId: userData.id,
        productId: productId,
        batchSize: 1,
      });

      if (response.success && response.taskId) {
        // PiAPI always processes asynchronously - start polling
        startFaceSwapPolling(productId, response.taskId);
          
        Toast.show({
          type: 'success',
          text1: 'Face Swap Started',
          text2: 'Your face swap is being processed. This may take a few minutes.',
        });
      } else {
        // Refund coins on failure
        setCoinBalance(prev => prev + 25);
        if (userData) {
          setUserData({ ...userData, coin_balance: (userData.coin_balance || 0) + 25 });
        }
        await supabase
          .from('users')
          .update({ coin_balance: (userData?.coin_balance || 0) + 25 })
          .eq('id', userData?.id);

        Alert.alert('Error', response.error || 'Failed to start face swap');
      }
    } catch (error) {
      console.error('Error starting face swap:', error);
      Alert.alert('Error', 'Failed to start face swap. Please try again.');
    } finally {
      setTryOnSizeId(null);
      setSizeSelectionDraft(null);
      setSizeSelectionError('');
    }
  };

  const startFaceSwapPolling = (productId: string, taskId: string) => {
    let pollCount = 0;
    const maxPollAttempts = 60; // 5 minutes timeout (60 * 5 seconds)
    
    const interval = setInterval(async () => {
      try {
        pollCount++;
        console.log(`[ProductDetailsBottomSheet] Polling attempt ${pollCount}/${maxPollAttempts}`);
        
        const status = await piAPIVirtualTryOnService.checkTaskStatus(taskId);
        
        if (status.status === 'completed' && status.resultImages) {
          clearInterval(interval);
          
          // Save results permanently
          if (userData?.id) {
            await akoolService.saveFaceSwapResults(userData.id, productId, status.resultImages);
          }
          
          // Add product to preview
          const orderedImages = (status.resultImages || []).sort((a, b) => {
            const aApi = /theapi\.app/i.test(a) ? 0 : 1;
            const bApi = /theapi\.app/i.test(b) ? 0 : 1;
            return aApi - bApi;
          });

          const personalizedProduct = {
            id: `personalized_${productId}_${Date.now()}`,
            name: product?.name || '',
            description: `Personalized ${product?.name || ''} with your face`,
            price: 0,
            image_urls: orderedImages,
            video_urls: [],
            featured_type: 'personalized',
            category: product?.category,
            stock_quantity: 1,
            variants: [],
            isPersonalized: true,
            originalProductImage: product?.image_urls?.[0] || '',
            faceSwapDate: new Date().toISOString(),
            originalProductId: productId,
          };
          addToPreview(personalizedProduct as any);
          
          Toast.show({
            type: 'success',
            text1: 'Preview Ready!',
            text2: 'Your personalized product has been added to Your Preview.',
          });
        } else if (status.status === 'failed') {
          clearInterval(interval);
          Alert.alert('Error', status.error || 'Face swap failed. Please try again.');
        } else if (pollCount >= maxPollAttempts) {
          // Timeout after 5 minutes
          clearInterval(interval);
          console.warn('[ProductDetailsBottomSheet] Face swap polling timeout');
          Alert.alert(
            'Processing Timeout', 
            'Face swap is taking longer than expected. Please try again later or contact support if the issue persists.'
          );
        }
      } catch (error) {
        console.error('Error checking face swap status:', error);
        if (pollCount >= maxPollAttempts) {
          clearInterval(interval);
        }
      }
    }, 5000); // Poll every 5 seconds
  };

  const handleAddToCart = async () => {
    if (!product || !userData?.id) return;

    setAddToCartLoading(true);
    try {
      let selectedVariantData = null;
      let size = 'Default';
      let color = 'Default';
      let price = getUserPrice(product);

      // If we have variants and user has selected size/color, use that
      if (variants.length > 0 && selectedSize && selectedColor) {
        selectedVariantData = variants.find(v => 
          v.size_id === selectedSize && v.color_id === selectedColor
        );
        if (selectedVariantData) {
          size = selectedVariantData.size.name;
        color = selectedVariantData.color?.name || 'Default';
          price = selectedVariantData.price || price;
        }
      } else if (variants.length > 0) {
        // Use first available variant
        selectedVariantData = variants[0];
        size = selectedVariantData.size.name;
        color = selectedVariantData.color?.name || 'Default';
        price = selectedVariantData.price || price;
      } else if (product.variants && product.variants.length > 0) {
        // Use first variant from product data
        const firstVariant = product.variants[0];
        size = firstVariant.size?.name || 'Default';
        price = firstVariant.price || price;
      }

      const cartItem = {
        productId: product.id,
        variantId: selectedVariantData?.id,
        name: product.name,
        price: price,
        image: getFirstSafeProductImage(product),
        image_urls: product.image_urls || (getFirstSafeProductImage(product) ? [getFirstSafeProductImage(product)] : []),
        size: size,
        color: color,
        quantity: 1,
        stock: product.stock_quantity,
        sku: product.sku || product.id,
        isReseller: false,
      };

      await addToCart(cartItem);
      onClose();
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setAddToCartLoading(false);
    }
  };

  const shareUrl = mediaItems[currentImageIndex]?.url || product?.image_urls?.[0];
  const shareText = `${product?.name}\n${product?.description}\n${shareUrl}`;

  const shareOnWhatsApp = () => {
    const url = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
    Linking.openURL(url).catch(() => {
      if (Platform.OS === 'android')
        ToastAndroid.show('WhatsApp not installed', ToastAndroid.SHORT);
    });
    // Award referral coins on successful share intent
    if (userData?.id && product?.id) {
      akoolService.awardReferralCoins(userData.id, product.id, 'whatsapp', 2).then((ok) => {
        if (ok) {
          Toast.show({ type: 'success', text1: t('coins_awarded') || 'Coins awarded', text2: '+2 coins for sharing' });
          // Optimistically update local coin balance
          setCoinBalance((prev) => prev + 2);
        }
      });
    }
    setShareModalVisible(false);
  };

  const handleResellPress = () => {
    if (!userData?.id) {
      Toast.show({
        type: 'info',
        text1: 'Login Required',
        text2: 'Please login to resell products.',
      });
      showLoginSheet();
      return;
    }
    setShowMarginModal(true);
  };

  const closeMarginModal = () => {
    setShowMarginModal(false);
    setCustomPrice('');
    setCustomPriceError(null);
  };

  const computeEffectiveResellPrice = useCallback(() => {
    const base = baseResellPrice || 0;
    const customNum = Number(customPrice);
    const useCustom = !!customPrice && !isNaN(customNum) && customNum >= base;
    if (useCustom) return Math.round(customNum);
    return Math.round(base * (1 + selectedMargin / 100));
  }, [baseResellPrice, customPrice, selectedMargin]);

  const handleResellContinue = () => {
    if (!product) return;
    const base = baseResellPrice;
    if (!base || base <= 0) {
      Toast.show({ type: 'error', text1: 'Price unavailable', text2: 'Unable to calculate base price.' });
      return;
    }
    const resellPrice = computeEffectiveResellPrice();
    const effectiveMarginPct = Math.round(((resellPrice - base) / base) * 100);

    closeMarginModal();
    onClose?.();
    (navigation as any).navigate('CatalogShare', {
      product: {
        ...product,
        variants,
        product_variants: variants,
        availableSizes,
        resellPrice,
        margin: effectiveMarginPct,
        basePrice: base,
      },
    });
  };

  const scrollToMediaIndex = useCallback(
    (targetIndex: number) => {
      if (mediaItems.length === 0) return;
      let nextIndex = targetIndex;
      if (targetIndex < 0) {
        nextIndex = mediaItems.length - 1;
      } else if (targetIndex >= mediaItems.length) {
        nextIndex = 0;
      }
      setCurrentImageIndex(nextIndex);
      mediaListRef.current?.scrollToIndex?.({ index: nextIndex, animated: true });
    },
    [mediaItems.length]
  );

  const handleMediaScroll = useCallback(
    (event: any) => {
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      if (!layoutMeasurement?.width) return;
      const index = Math.round(contentOffset.x / layoutMeasurement.width);
      if (index !== currentImageIndex) {
        setCurrentImageIndex(index);
      }
    },
    [currentImageIndex]
  );

  const handleImagePress = (index: number) => {
    scrollToMediaIndex(index);
  };

  const handleScrollToIndexFailed = useCallback((info: { index: number }) => {
    requestAnimationFrame(() => {
      mediaListRef.current?.scrollToIndex?.({ index: info.index, animated: true });
    });
  }, []);

  // Video control functions
  const togglePlay = (index: number) => {
    setVideoStates((prev) => {
      const prevState = prev[index] || { isPlaying: true, isMuted: true };
      const newState = { ...prevState, isPlaying: !prevState.isPlaying };
      const ref = videoRefs.current[index];
      if (ref) {
        if (newState.isPlaying) ref.playAsync();
        else ref.pauseAsync();
      }
      return { ...prev, [index]: newState };
    });
  };

  const toggleMute = (index: number) => {
    setVideoStates((prev) => {
      const prevState = prev[index] || { isPlaying: true, isMuted: false };
      const newState = { ...prevState, isMuted: !prevState.isMuted };
      const ref = videoRefs.current[index];
      if (ref) ref.setIsMutedAsync(newState.isMuted);
      return { ...prev, [index]: newState };
    });
  };

  const handleVideoTap = (index: number) => {
    setVideoStates((prev) => {
      const prevState = prev[index] || { isPlaying: true, isMuted: false };
      const newState = { ...prevState, isMuted: !prevState.isMuted };
      const ref = videoRefs.current[index];
      if (ref) {
        ref.setIsMutedAsync(newState.isMuted);
      }
      return { ...prev, [index]: newState };
    });
  };

  const renderImageGallery = () => {
    if (!product || mediaItems.length === 0) {
      return (
        <View style={styles.imageContainer}>
          <View style={styles.noImagePlaceholder}>
            <Ionicons name="image-outline" size={64} color="#ccc" />
            <Text style={styles.noImageText}>{t('no_images_available')}</Text>
          </View>
        </View>
      );
    }

    const currentMedia = mediaItems[currentImageIndex];

    const renderMediaItem = ({ item, index }: { item: MediaItem; index: number }) => {
      const videoState = videoStates[index] || { isPlaying: true, isMuted: false };
      const isActive = index === currentImageIndex;

      if (item.type === 'video') {
        return (
          <TouchableOpacity
            key={`${item.url}-${index}`}
            activeOpacity={1}
            style={styles.mediaSlide}
            onPress={() => handleVideoTap(index)}
          >
            <Video
              ref={(ref) => {
                if (ref) videoRefs.current[index] = ref;
              }}
              source={{ uri: item.url }}
              style={styles.videoBackground}
              resizeMode={ResizeMode.COVER}
              shouldPlay={isActive && videoState.isPlaying}
              isLooping
              isMuted={videoState.isMuted}
              posterSource={{ uri: item.thumbnail }}
              posterStyle={{ resizeMode: 'cover' }}
              usePoster
              onError={(error) => {
                console.error('❌ Video error for index:', index, error);
                console.error('❌ Video URL:', item.url);
              }}
              onLoad={() => {
                console.log('✅ Video loaded for index:', index);
                console.log('✅ Video URL:', item.url);
              }}
            />

            <View style={styles.videoControlsOverlay}>
              <TouchableOpacity style={styles.videoControlButton} onPress={() => togglePlay(index)}>
                <Ionicons name={videoState.isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.videoControlButton} onPress={() => toggleMute(index)}>
                <Ionicons name={videoState.isMuted ? 'volume-mute' : 'volume-high'} size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      }

      return (
        <TouchableOpacity
          key={`${item.url}-${index}`}
          style={styles.mediaSlide}
          activeOpacity={0.95}
          onPress={() => openFullScreen('image', index)}
        >
          <Image
            source={{ uri: item.url }}
            style={styles.productImage}
            resizeMode="cover"
            fadeDuration={0}
            onLoadStart={() => setImageLoadingStates((prev) => ({ ...prev, [index]: true }))}
            onLoad={() => setImageLoadingStates((prev) => ({ ...prev, [index]: false }))}
            onError={() => setImageLoadingStates((prev) => ({ ...prev, [index]: false }))}
          />
          {imageLoadingStates[index] && (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator size="large" color="#F53F7A" />
            </View>
          )}
        </TouchableOpacity>
      );
    };

    return (
      <View style={styles.imageContainer}>
        <FlatList
          ref={mediaListRef}
          data={mediaItems}
          keyExtractor={(item, index) => `${item.url}-${index}`}
          renderItem={renderMediaItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMediaScroll}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          extraData={{ currentImageIndex, videoStates, imageLoadingStates }}
          onScrollToIndexFailed={handleScrollToIndexFailed}
        />

        {/* Navigation Arrows */}
        {mediaItems.length > 1 && (
          <>
            <TouchableOpacity 
              style={[styles.navArrow, styles.leftArrow]} 
              onPress={() => scrollToMediaIndex(currentImageIndex - 1)}
              disabled={currentImageIndex === 0}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.navArrow, styles.rightArrow]} 
              onPress={() => scrollToMediaIndex(currentImageIndex + 1)}
              disabled={currentImageIndex === mediaItems.length - 1}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        {/* Rating Badge (bottom right) */}
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingBadgeText}>
            {reviews.length > 0 
              ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
              : '0.0'
            }
          </Text>
          <Ionicons name="star" size={12} color="#FFD700" />
          <Text style={styles.ratingCountText}>{reviews.length}</Text>
        </View>
        
        {/* Media Dots Indicator (inside image, absolute bottom center) */}
        {mediaItems.length > 1 && (
          <View style={styles.imageDotsOverlay}>
            {mediaItems.map((media, idx) => (
              <View
                key={idx}
                style={[
                  styles.imageDot,
                  idx === currentImageIndex && styles.activeImageDot
                ]}
              >
                {media.type === 'video' && (
                  <Ionicons name="play" size={8} color="#fff" style={styles.mediaTypeIcon} />
                )}
              </View>
            ))}
          </View>
        )}
        
        {/* Full View Button */}
        <TouchableOpacity
          style={styles.fullViewButton}
          onPress={() => openFullScreen(currentMedia.type, currentImageIndex)}
          activeOpacity={0.7}
        >
          <Ionicons name="search-outline" size={20} color="#333" />
        </TouchableOpacity>

        {/* Wishlist Icon */}
        <TouchableOpacity 
          style={styles.wishlistButton} 
          onPress={async () => {
            if (isInWishlist(product.id)) {
              // Show collection sheet in parent to manually remove from collections
              if (onShowCollectionSheet) {
                onShowCollectionSheet({
                  id: product.id,
                  name: product.name,
                  description: product.description,
                  price: getUserPrice(product),
                  image_urls: productImages,
                  video_urls: product.video_urls || [],
                  featured_type: product.featured || undefined,
                  category: product.category,
                  stock_quantity: product.stock_quantity,
                  variants: product.variants,
                });
              }
            } else {
              // Add to "All" collection first
              await addToAllCollection();
              // Then show collection sheet to optionally add to other folders
              if (onShowCollectionSheet) {
                setTimeout(() => {
                  onShowCollectionSheet({
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    price: getUserPrice(product),
                    image_urls: productImages,
                    video_urls: product.video_urls || [],
                    featured_type: product.featured || undefined,
                    category: product.category,
                    stock_quantity: product.stock_quantity,
                    variants: product.variants,
                  });
                }, 500);
              }
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={isInWishlist(product.id) ? 'heart' : 'heart-outline'} 
            size={24} 
            color={isInWishlist(product.id) ? '#F53F7A' : '#333'} 
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderImageThumbnails = () => {
    if (mediaItems.length <= 1) return null;

    return (
      <View style={styles.thumbnailsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {mediaItems.map((media, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.thumbnail,
                currentImageIndex === index && styles.selectedThumbnail
              ]}
              onPress={() => handleImagePress(index)}
            >
              <Image 
                source={{ uri: media.type === 'video' ? (media.thumbnail || media.url) : media.url }} 
                style={styles.thumbnailImage} 
              />
              {media.type === 'video' && (
                <View style={styles.videoThumbnailOverlay}>
                  <Ionicons name="play" size={12} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  if (!product) return null;

  return (
    <>
    <BottomSheet
      ref={bottomSheetRef}
      index={visible ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose={true}
      onClose={onClose}
      backgroundStyle={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18 }}
      handleIndicatorStyle={{ backgroundColor: '#ccc' }}
      enableContentPanningGesture={true}
      keyboardBehavior="interactive"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingText}>
                {reviews.length > 0 
                  ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
                  : '0.0'
                }
              </Text>
              <Text style={styles.reviewsText}>({reviews.length})</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
          {/* Image Gallery */}
          {renderImageGallery()}

          {/* Product Info */}
          <View style={styles.productInfo}>
            {/* Vendor Name, Product Title and Share Button Row */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.productName}>
                  {vendorName} <Text style={{ fontSize: 18, color: '#666', fontWeight: '400' }}> {product.name}</Text>
                </Text>
              </View>
              <TouchableOpacity style={styles.shareButton} onPress={() => setShareModalVisible(true)}>
                <AntDesign name="sharealt" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Price */}
            <View style={styles.priceContainer}>
              <Text style={styles.price}>₹{userPrice}</Text>
              {product.discount && product.discount > 0 && (
                <Text style={styles.originalPrice}>MRP ₹{(userPrice / (1 - product.discount / 100)).toFixed(2)}</Text>
              )}
              {product.discount && product.discount > 0 && (
                <Text style={styles.discount}>({product.discount}% OFF)</Text>
              )}
            </View>



            {/* Size Selection */}
            {availableSizes.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('select_size')}</Text>
                </View>
                <View style={styles.sizesContainer}>
                  {availableSizes.map(renderSizeOption)}
                </View>
              </View>
            )}





            {/* Tabs */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'details' && styles.activeTab]}
                onPress={() => setActiveTab('details')}
              >
                <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>
                  {t('product_details')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'reviews' && styles.activeTab]}
                onPress={() => setActiveTab('reviews')}
              >
                <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>
                  {t('reviews')} ({reviews.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab Content */}
            {activeTab === 'details' && (
              <View style={styles.tabContent}>
                <Text style={styles.descriptionTitle}>{t('description')}</Text>
                <Text style={styles.descriptionText}>{product.description}</Text>
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Replacement Policy</Text>
                    <TouchableOpacity onPress={() => setReplacementPolicyVisible(true)}>
                      <Ionicons name="add" size={22} color="#F53F7A" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {activeTab === 'reviews' && (
              <View style={styles.tabContent}>
                {reviewsLoading ? (
                  <ActivityIndicator size="large" color="#F53F7A" style={{ marginVertical: 20 }} />
                ) : reviews.length > 0 ? (
                  <View>
                    {reviews.map((review, index) => (
                      <View key={review.id} style={styles.reviewItem}>
                        <View style={styles.reviewHeader}>
                          <View style={styles.reviewerInfo}>
                            {review.profile_image_url ? (
                              <Image source={{ uri: review.profile_image_url }} style={styles.reviewerImage} />
                            ) : (
                              <View style={styles.reviewerImagePlaceholder}>
                                <Ionicons name="person" size={20} color="#666" />
                              </View>
                            )}
                            <View style={styles.reviewerDetails}>
                              <Text style={styles.reviewerName}>{review.reviewer_name}</Text>
                              <View style={styles.ratingRow}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Ionicons
                                    key={star}
                                    name={star <= review.rating ? "star" : "star-outline"}
                                    size={16}
                                    color={star <= review.rating ? "#FFD700" : "#ccc"}
                                  />
                                ))}
                                {review.is_verified && (
                                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" style={{ marginLeft: 8 }} />
                                )}
                              </View>
                            </View>
                          </View>
                          <Text style={styles.reviewDate}>
                            {new Date(review.date || review.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                        <Text style={styles.reviewComment}>{review.comment}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                <Text style={styles.noReviewsText}>{t('no_reviews_yet')}</Text>
                )}
              </View>
            )}
          </View>
        <View style={styles.bottomBar}>
          <View style={styles.bottomTopRow}>
            <TouchableOpacity
              style={styles.tryOnButton}
              onPress={handleTryOnButtonPress}
            >
              <Ionicons name="camera" size={20} color="#F53F7A" style={{ marginRight: 8 }} />
              <Text style={styles.tryOnButtonText}>{t('try_on')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addToCartButton, { opacity: availableQuantity === 0 ? 0.5 : 1 }]}
              onPress={handleAddToCart}
              disabled={availableQuantity === 0 || addToCartLoading}
            >
              <Ionicons name="cart-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.addToCartButtonText}>
                {addToCartLoading ? t('adding') : t('add_to_cart')}
              </Text>
            </TouchableOpacity>
          </View>

          {userData?.id && (
            <TouchableOpacity
              style={styles.resellButtonFull}
              onPress={handleResellPress}
            >
              <Ionicons name="storefront" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.resellButtonFullText}>Resell</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* More Like This Section */}
        {suggestedProducts.length > 0 && (
          <View style={styles.moreLikeThisContainer}>
            <View style={styles.moreLikeThisHeader}>
              <Text style={styles.moreLikeThisTitle}>More Like This</Text>
              {suggestedProducts.length > 10 && (
                <TouchableOpacity
                  onPress={() => {
                    // Close bottom sheet and navigate to Products screen
                    onClose();
                    // Note: Navigation would need to be passed as prop for this to work
                  }}
                >
                  <Text style={styles.seeMoreText}>See More</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.suggestionsWrapper}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionsListContent}
                style={styles.suggestionsScrollView}
                nestedScrollEnabled={true}
              >
              {suggestedProducts.slice(0, 10).map((p: any) => {
                const variants = p.product_variants || [];
                const firstVariant = variants[0];
                const img = (firstVariant?.image_urls && firstVariant.image_urls[0]) || (p.image_urls && p.image_urls[0]);
                
                // Calculate MRP, RSP, and discount from variants (same logic as Cart)
                const mrpPrices = variants
                  .map((v: any) => v.mrp_price)
                  .filter((price: any) => price != null && price > 0);
                const rspPrices = variants
                  .map((v: any) => v.rsp_price || v.price)
                  .filter((price: any) => price != null && price > 0);
                const discounts = variants
                  .map((v: any) => v.discount_percentage)
                  .filter((d: any) => d != null && d > 0);
                
                const minMrpPrice = mrpPrices.length > 0 ? Math.min(...mrpPrices) : 0;
                const minRspPrice = rspPrices.length > 0 ? Math.min(...rspPrices) : (firstVariant?.price || 0);
                const maxDiscountPercentage = discounts.length > 0 ? Math.max(...discounts) : 0;
                
                const calculatedDiscount = maxDiscountPercentage > 0
                  ? maxDiscountPercentage
                  : minMrpPrice > 0 && minRspPrice > 0 && minMrpPrice > minRspPrice
                  ? Math.round(((minMrpPrice - minRspPrice) / minMrpPrice) * 100)
                  : 0;
                
                return (
                  <View key={p.id || Math.random()} style={styles.suggestionCard}>
                    <TouchableOpacity
                      onPress={() => {
                        // Close current bottom sheet and navigate to ProductDetails screen
                        onClose();
                        setTimeout(() => {
                          navigation.navigate('ProductDetails', { productId: p.id });
                        }, 300);
                      }}
                      activeOpacity={0.9}>
                      <Image
                        source={{ uri: img || 'https://via.placeholder.com/160x160.png?text=Only2U' }}
                        style={styles.suggestionImage}
                      />
                      <View style={styles.suggestionInfo}>
                        <Text style={styles.suggestionProductName} numberOfLines={2}>
                          {p.name}
                        </Text>
                        <View style={styles.suggestionPriceContainer}>
                          {minMrpPrice > 0 && minMrpPrice > minRspPrice && (
                            <Text style={styles.suggestionOriginalPrice}>₹{Math.round(minMrpPrice)}</Text>
                          )}
                          <Text style={styles.suggestionPrice}>₹{Math.round(minRspPrice)}</Text>
                          {calculatedDiscount > 0 && (
                            <Text style={styles.suggestionDiscountBadge}>{calculatedDiscount}% OFF</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.suggestionAddButton}
                      onPress={() => {
                        // Add to cart functionality would go here
                        Alert.alert('Added!', `${p.name} added to cart`, [{ text: 'OK' }]);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                );
              })}
              </ScrollView>
            </View>
          </View>
        )}
        </BottomSheetScrollView>
      </View>
      
      {/* Replacement Policy Modal */}
      {replacementPolicyVisible && (
        <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 99999 }}>
          <View style={{ width: '88%', maxHeight: '80%', backgroundColor: '#fff', borderRadius: 16, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#222' }}>Replacement Policy</Text>
              <TouchableOpacity onPress={() => setReplacementPolicyVisible(false)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={true} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 8 }}>✅ Conditions for Replacement:</Text>
              <Text style={{ color: '#333', marginBottom: 10 }}>1. Unboxing Video Required – Customers must record a clear video while opening the parcel, showing the product from start to finish.</Text>
              <Text style={{ color: '#333', marginBottom: 10 }}>2. Dress Condition – The item must be unused, in good condition, and with the original tag intact.</Text>
              <Text style={{ color: '#333', marginBottom: 10 }}>3. Size Replacement Option – If the fitting is not right, you can request a size replacement (subject to availability).</Text>
              <Text style={{ color: '#666', fontStyle: 'italic', marginBottom: 10 }}>Note: Size replacement requests must also be made within 48 hours of receiving the product.</Text>
              <Text style={{ color: '#333', marginBottom: 10 }}>4. Report Within 48 Hours – All replacement requests (damaged/defective/size issues) should be raised within 48 hours of delivery through the app.</Text>
              <Text style={{ color: '#333', marginBottom: 16 }}>5. Original Packaging – Keep the dress in its original packaging until replacement is confirmed.</Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 8 }}>⚡ How It Works:</Text>
              <Text style={{ color: '#333', marginBottom: 10 }}>1. Upload your unboxing video in the My Orders section and request a replacement.</Text>
              <Text style={{ color: '#333', marginBottom: 10 }}>2. Our team will verify and approve your request.</Text>
              <Text style={{ color: '#333', marginBottom: 16 }}>3. A replacement product will be shipped to you at no extra cost.</Text>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Try On Modal */}
      {showTryOnModal && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.3)',
            zIndex: 9999,
          }}
        >
          <View style={styles.akoolModal}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowTryOnModal(false);
                setTryOnSizeId(null);
              }}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.akoolTitle}>👗 Want to see how this outfit looks on you?</Text>
            <Text style={styles.akoolSubtitle}>Try on with Only2U Face Swap AI</Text>
            <View style={styles.tryOnInfoCard}>
              <View style={styles.tryOnInfoHeader}>
                <Ionicons name="sparkles" size={20} color="#F53F7A" />
                <Text style={styles.tryOnInfoTitle}>Photo Face Swap</Text>
              </View>
              <Text style={styles.tryOnInfoDesc}>
                See how this outfit looks on you with AI-powered face swap
              </Text>
              {selectedTryOnSizeName && (
                <Text style={styles.tryOnInfoDesc}>
                  Preview size: {selectedTryOnSizeName}
                </Text>
              )}
              <View style={styles.tryOnInfoCost}>
                <Ionicons name="diamond-outline" size={16} color="#F53F7A" />
                <Text style={styles.tryOnInfoCostText}>25 coins</Text>
              </View>
            </View>
            <Text style={styles.akoolBalance}>
              {t('available_balance')}:{' '}
              <Text style={{ color: '#F53F7A', fontWeight: 'bold' }}>
                {coinBalance} {t('coins')}
              </Text>
            </Text>
            <TouchableOpacity style={styles.akoolContinueBtn} onPress={handleStartFaceSwap}>
              <Text style={styles.akoolContinueText}>Start Face Swap</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Consent Modal */}
      {showConsentModal && (
        <Modal
          transparent
          animationType="fade"
          visible={showConsentModal}
          onRequestClose={handleConsentCancel}
        >
          <View style={styles.consentOverlay}>
            <View style={styles.consentModal}>
              <View style={styles.consentIconCircle}>
                <Ionicons name="shield-checkmark" size={40} color="#F53F7A" />
              </View>
              <Text style={styles.consentTitle}>Privacy & Consent</Text>
              <View style={styles.consentContent}>
                <View style={styles.consentPoint}>
                  <View style={styles.consentBullet}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  </View>
                  <Text style={styles.consentPointText}>I have the right to use this photo</Text>
                </View>
                <View style={styles.consentPoint}>
                  <View style={styles.consentBullet}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  </View>
                  <Text style={styles.consentPointText}>I consent to AI processing for face swap</Text>
                </View>
                <View style={styles.consentPoint}>
                  <View style={styles.consentBullet}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  </View>
                    <Text style={styles.consentPointText}>
                      Generated previews may be stored to improve my experience
                    </Text>
                </View>
              </View>
              <View style={styles.consentButtons}>
                <TouchableOpacity style={styles.consentCancelButton} onPress={handleConsentCancel}>
                  <Text style={styles.consentCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.consentAgreeButton} onPress={handleConsentAgree}>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.consentAgreeText}>I Agree</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Size Selection Modal */}
      <Modal
        visible={showSizeSelectionModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelSizeSelection}
      >
        <View style={styles.sizeModalOverlay}>
          <View style={styles.sizeModalContainer}>
            <View style={styles.sizeModalHeader}>
              <Text style={styles.sizeModalTitle}>Select Your Size</Text>
              <TouchableOpacity style={styles.sizeModalCloseButton} onPress={handleCancelSizeSelection}>
                <Ionicons name="close" size={20} color="#1C1C1E" />
              </TouchableOpacity>
            </View>
            <Text style={styles.sizeModalSubtitle}>
              Choose the size you want to preview before running Face Swap.
            </Text>
            <View style={styles.sizeOptionsWrap}>
              {availableSizes.map((size) => {
                const isSelected = sizeSelectionDraft === size.id;
                return (
                  <TouchableOpacity
                    key={`modal-size-${size.id}`}
                    style={[
                      styles.sizeOptionChip,
                      isSelected && styles.sizeOptionChipSelected,
                    ]}
                    onPress={() => {
                      setSizeSelectionDraft(size.id);
                      setSizeSelectionError('');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.sizeOptionChipText,
                        isSelected && styles.sizeOptionChipTextSelected,
                      ]}
                    >
                      {size.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {!!sizeSelectionError && (
              <Text style={styles.sizeSelectionError}>{sizeSelectionError}</Text>
            )}
            <TouchableOpacity style={styles.sizeModalConfirmButton} onPress={handleConfirmSizeSelection}>
              <Text style={styles.sizeModalConfirmText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* SaveToCollectionSheet */}
      <SaveToCollectionSheet
        visible={showCollectionSheet}
        product={selectedProduct}
        onClose={() => {
          setShowCollectionSheet(false);
          setSelectedProduct(null);
        }}
      />

      {showMarginModal && (
        <View style={styles.marginModalOverlay}>
          <View style={styles.marginModal}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={closeMarginModal}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>

            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              style={styles.marginScroll}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <Text style={styles.marginModalTitle}>💰 Set Your Margin</Text>
              <Text style={styles.marginModalSubtitle}>
                Choose your profit margin for this product
              </Text>

              <View style={styles.marginOptions}>
                {[10, 15, 20, 25, 30].map((margin) => (
                  <TouchableOpacity
                    key={margin}
                    style={[
                      styles.marginOption,
                      selectedMargin === margin && styles.marginOptionSelected,
                    ]}
                    onPress={() => setSelectedMargin(margin)}>
                    <View style={styles.radioCircle}>
                      {selectedMargin === margin && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.marginOptionTitle}>{margin}% Margin</Text>
                      <Text style={styles.marginOptionDesc}>
                        Sell at ₹{Math.round((baseResellPrice || 0) * (1 + margin / 100))}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.customPriceContainer}>
                <Text style={styles.customPriceLabel}>Or enter a custom price</Text>
                <View style={styles.customPriceRow}>
                  <Text style={styles.customCurrency}>₹</Text>
                  <TextInput
                    value={customPrice}
                    onChangeText={(val) => {
                      setCustomPrice(val);
                      const base = baseResellPrice || 0;
                      const num = Number(val);
                      if (!val) {
                        setCustomPriceError(null);
                      } else if (isNaN(num)) {
                        setCustomPriceError('Enter a valid number');
                      } else if (num < base) {
                        setCustomPriceError(`Must be ≥ ₹${base}`);
                      } else {
                        setCustomPriceError(null);
                      }
                    }}
                    placeholder={`${baseResellPrice || 0}`}
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    style={styles.customPriceInput}
                  />
                </View>
                {!!customPriceError && <Text style={styles.customPriceError}>{customPriceError}</Text>}
                <Text style={styles.customPriceHelp}>Leave empty to use selected margin</Text>
              </View>

              <View style={styles.marginSummary}>
                <Text style={styles.marginSummaryTitle}>Profit Summary</Text>
                {(() => {
                  const base = baseResellPrice || 0;
                  const resellPrice = computeEffectiveResellPrice();
                  const effectiveMarginPct = base > 0 ? Math.round(((resellPrice - base) / base) * 100) : 0;
                  const effectiveProfit = base > 0 ? Math.round(resellPrice - base) : 0;
                  return (
                    <>
                      <View style={styles.marginSummaryRow}>
                        <Text style={styles.marginSummaryLabel}>Base Price:</Text>
                        <Text style={styles.marginSummaryValue}>
                          ₹{base}
                        </Text>
                      </View>
                      <View style={styles.marginSummaryRow}>
                        <Text style={styles.marginSummaryLabel}>Your Margin:</Text>
                        <Text style={styles.marginSummaryValue}>{effectiveMarginPct}%</Text>
                      </View>
                      <View style={styles.marginSummaryRow}>
                        <Text style={styles.marginSummaryLabel}>Your Price:</Text>
                        <Text style={[styles.marginSummaryValue, styles.marginSummaryHighlight]}>
                          ₹{resellPrice}
                        </Text>
                      </View>
                      <View style={styles.marginSummaryRow}>
                        <Text style={styles.marginSummaryLabel}>Your Profit:</Text>
                        <Text style={[styles.marginSummaryValue, styles.marginSummaryProfit]}>
                          ₹{effectiveProfit}
                        </Text>
                      </View>
                    </>
                  );
                })()}
              </View>

              <TouchableOpacity
                style={styles.marginContinueBtn}
                onPress={handleResellContinue}>
                <Text style={styles.marginContinueText}>Continue to Share</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}

{shareModalVisible && (
        <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 9999 }}>
          <View style={styles.akoolModal}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShareModalVisible(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <View style={styles.shareModalContent}>
            <TouchableOpacity style={styles.shareModalOption} onPress={shareOnWhatsApp}>
              <Ionicons
                name="logo-whatsapp"
                size={30}
                color="#25D366"
                style={{ marginRight: 10 }}
              />
              <Text style={styles.shareModalText}>{t('share_on_whatsapp')}</Text>
            </TouchableOpacity>
          </View>
          </View>
        </View>
      )}
    </BottomSheet>

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
          <View style={styles.fullscreenSafeArea}>
            <View style={styles.fullscreenHeader}>
              <TouchableOpacity onPress={closeFullScreen} style={styles.fullscreenCloseButton}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.fullscreenTitle}>Preview</Text>
              <View style={styles.fullscreenHeaderAction}>
                {fullScreenMediaType === 'video' ? (
                  <TouchableOpacity
                    onPress={() => setIsFullScreenVideoPlaying((prev) => !prev)}
                    style={styles.fullscreenControlButton}
                  >
                    <Ionicons
                      name={isFullScreenVideoPlaying ? 'pause' : 'play'}
                      size={22}
                      color="#fff"
                    />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={resetFullScreenZoom} style={styles.fullscreenControlButton}>
                    <Ionicons name="refresh" size={22} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.fullscreenContent}>
              {fullScreenMediaType === 'video' && mediaItems[imageViewerIndex]?.type === 'video' ? (
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => setIsFullScreenVideoPlaying((prev) => !prev)}
                  style={styles.fullscreenMedia}
                >
                  <Video
                    source={{ uri: mediaItems[imageViewerIndex]?.url }}
                    style={styles.fullscreenMedia}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={isFullScreenVideoPlaying}
                    useNativeControls
                    isLooping
                  />
                </TouchableOpacity>
              ) : (
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
                          onPress={handleFullScreenDoubleTap}
                          style={styles.fullscreenMedia}
                        >
                          <Animated.Image
                            source={{ uri: mediaItems[imageViewerIndex]?.url }}
                            style={[
                              styles.fullscreenMedia,
                              {
                                transform: [
                                  { scale: combinedScale },
                                  { translateX: translateXFullscreen },
                                  { translateY: translateYFullscreen },
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
                            <Text style={styles.zoomIndicatorText}>{currentZoom.toFixed(1)}x</Text>
                          </View>
                        )}
                      </Animated.View>
                    </PinchGestureHandler>
                  </Animated.View>
                </PanGestureHandler>
              )}
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
    <ProfilePhotoRequiredModal
      visible={showProfilePhotoModal}
      title="Profile Photo Required"
      description="Upload a profile photo to unlock Face Swap and see outfits on you."
      dismissLabel="Maybe Later"
      uploadLabel="Upload Photo"
      onDismiss={() => {
        setShowProfilePhotoModal(false);
        setShowConsentModal(false);
        setShowTryOnModal(false);
        setSizeSelectionDraft(null);
        setSizeSelectionError('');
        setTryOnSizeId(null);
      }}
      onUpload={() => {
        setShowProfilePhotoModal(false);
        setShowConsentModal(false);
        setShowTryOnModal(false);
        setSizeSelectionDraft(null);
        setSizeSelectionError('');
        setTryOnSizeId(null);
        (navigation as any).navigate('ProfilePictureUpload');
      }}
    />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  closeButton: {
    padding: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 4,
    fontWeight: '500',
  },
  reviewsText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  scrollContent: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    height: 500,
  },
  mediaSlide: {
    width,
    height: '100%',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  ratingBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  ratingCountText: {
    fontSize: 12,
    color: '#666',
  },
  imageDotsOverlay: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  imageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
  },
  activeImageDot: {
    backgroundColor: '#F53F7A',
    width: 16,
  },
  wishlistButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 25,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  fullViewButton: {
    position: 'absolute',
    top: 72,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 25,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  shareButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 7,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  noImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -12 }],
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  leftArrow: {
    left: 16,
  },
  rightArrow: {
    right: 16,
  },
  imageCounter: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 4,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  thumbnailsContainer: {
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 4,
    marginRight: 12,
  },
  selectedThumbnail: {
    borderWidth: 2,
    borderColor: '#F53F7A',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  productInfo: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  originalPrice: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  discount: {
    fontSize: 14,
    color: '#F53F7A',
    fontWeight: '600',
    marginLeft: 8,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sizeGuide: {
    fontSize: 14,
    color: '#F53F7A',
    fontWeight: '500',
  },
  sizesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sizeOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  selectedSizeOption: {
    borderColor: '#F53F7A',
    backgroundColor: '#F53F7A',
  },
  sizeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  selectedSizeText: {
    color: '#fff',
  },
  colorsContainer: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 10,
  },
  colorOptionContainer: {
    alignItems: 'center',
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
  },
  whiteColorBorder: {
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedColorOption: {
    borderWidth: 3,
    borderColor: '#F53F7A',
  },
  colorName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    width: 120,
    marginTop: 10,
  },
  quantityText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  activeTab: {
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#F53F7A',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#333',
    fontWeight: '600',
  },
  tabContent: {
    paddingTop: 16,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#666',
  },
  featuredText: {
    color: '#F53F7A',
    fontWeight: '600',
  },
  noReviewsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 40,
  },
  tryOnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#F53F7A',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    flex: 1,
    marginRight: 12,
  },
  tryOnButtonText: {
    color: '#F53F7A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F53F7A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  addToCartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resellButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 10,
    paddingVertical: 14,
    minHeight: 52,
    marginTop: 8,
    width: '100%',
  },
  resellButtonFullText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resellButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 10,
    paddingVertical: 14,
    minHeight: 52,
    marginTop: 4,
  },
  resellButtonFullText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stockIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 18,
    alignSelf: 'flex-start',
  },
  stockIndicatorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  returnPolicyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  returnPolicyText: {
    flex: 1,
    marginLeft: 12,
  },
  returnPolicyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  returnPolicyDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  bottomBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 16,
    marginBottom: 20,
  },
  shareModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    minWidth: 220,
    alignItems: 'flex-start',
    elevation: 8,
  },
  shareModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    width: '100%',
  },
  shareModalText: {
    fontSize: 16,
    color: '#222',
  },
  marginModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 10000,
    padding: 16,
  },
  marginModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
  },
  marginScroll: {
    maxHeight: '100%',
  },
  marginModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  marginModalSubtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
  },
  marginOptions: {
    marginBottom: 16,
  },
  marginOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 12,
    marginBottom: 12,
  },
  marginOptionSelected: {
    borderColor: '#F53F7A',
    backgroundColor: '#FFF5F8',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#F53F7A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F53F7A',
  },
  marginOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  marginOptionDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  customPriceContainer: {
    marginTop: 8,
    marginBottom: 20,
  },
  customPriceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  customPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  customCurrency: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginRight: 4,
  },
  customPriceInput: {
    flex: 1,
    fontSize: 18,
    color: '#111',
  },
  customPriceError: {
    color: '#D93025',
    marginTop: 6,
  },
  customPriceHelp: {
    color: '#6B7280',
    marginTop: 4,
  },
  marginSummary: {
    marginTop: 4,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
  },
  marginSummaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  marginSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  marginSummaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  marginSummaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  marginSummaryHighlight: {
    color: '#10B981',
  },
  marginSummaryProfit: {
    color: '#F53F7A',
  },
  marginContinueBtn: {
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  marginContinueText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  reviewItem: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewerImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewerDetails: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewDate: {
    fontSize: 14,
    color: '#666',
  },
  reviewComment: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoBackground: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  videoControlsOverlay: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
    zIndex: 10,
  },
  videoControlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  mediaTypeIcon: {
    position: 'absolute',
    top: 1,
    left: 1,
  },
  videoThumbnailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  // Try on modal styles
  akoolModal: {
    width: 340,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  akoolTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 4,
  },
  akoolSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 18,
  },
  tryOnInfoCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#FEE2E8',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFF6FA',
    marginBottom: 16,
  },
  tryOnInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tryOnInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F53F7A',
  },
  tryOnInfoDesc: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 8,
  },
  tryOnInfoCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tryOnInfoCostText: {
    color: '#F53F7A',
    fontWeight: '700',
  },
  akoolBalance: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginBottom: 18,
  },
  akoolContinueBtn: {
    backgroundColor: '#F53F7A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  akoolContinueText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  consentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  consentModal: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
  },
  consentIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  consentTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111827',
    marginBottom: 16,
  },
  consentContent: {
    gap: 12,
    marginBottom: 20,
  },
  consentPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  consentBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  consentPointText: {
    flex: 1,
    fontSize: 15,
    color: '#1F2933',
    lineHeight: 20,
  },
  consentButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  consentCancelButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    alignItems: 'center',
  },
  consentCancelText: {
    color: '#1F2933',
    fontSize: 15,
    fontWeight: '600',
  },
  consentAgreeButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#F53F7A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  consentAgreeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  sizeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sizeModalContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },
  sizeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sizeModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  sizeModalSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 16,
  },
  sizeModalCloseButton: {
    padding: 4,
  },
  sizeOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  sizeOptionChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  sizeOptionChipSelected: {
    borderColor: '#F53F7A',
    backgroundColor: '#FFF0F5',
  },
  sizeOptionChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2933',
  },
  sizeOptionChipTextSelected: {
    color: '#F53F7A',
  },
  sizeSelectionError: {
    color: '#DC2626',
    fontSize: 13,
    marginBottom: 12,
  },
  sizeModalConfirmButton: {
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sizeModalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // More Like This Styles (Horizontal Scroll)
  moreLikeThisContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  moreLikeThisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  moreLikeThisTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  seeMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F53F7A',
  },
  suggestionsListContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  suggestionsScrollView: {
    paddingLeft: 0,
    paddingHorizontal: 0,
  },
  suggestionsWrapper: {
    width: '100%',
  },
  suggestionCard: {
    width: 160,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    position: 'relative',
    marginRight: 12,
  },
  suggestionImage: {
    width: 160,
    height: 180,
    backgroundColor: '#F9FAFB',
    resizeMode: 'cover',
  },
  suggestionInfo: {
    padding: 10,
  },
  suggestionAddButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#F53F7A',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  suggestionVendorName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#282c3f',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionProductName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 18,
    marginBottom: 6,
  },
  suggestionPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestionPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F53F7A',
  },
  suggestionOriginalPrice: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  suggestionDiscountBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F53F7A',
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenSafeArea: {
    flex: 1,
    paddingTop: 24,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fullscreenCloseButton: {
    padding: 8,
    width: 44,
  },
  fullscreenTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  fullscreenHeaderAction: {
    width: 44,
    alignItems: 'flex-end',
  },
  fullscreenControlButton: {
    padding: 8,
  },
  fullscreenContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenMedia: {
    width: '100%',
    height: '100%',
  },
  fullscreenHint: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullscreenHintText: {
    marginLeft: 6,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  zoomIndicator: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zoomIndicatorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ProductDetailsBottomSheet; 