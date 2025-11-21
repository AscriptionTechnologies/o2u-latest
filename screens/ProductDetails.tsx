import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
// FlatList already imported below in the grouped import
import { Animated, KeyboardAvoidingView, TextInput, PanResponder } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Share,
  Alert,
  FlatList,
  Platform,
  ActionSheetIOS,
  Modal,
  Pressable,
  ToastAndroid,
  Linking,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';
import { AntDesign } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '~/types/navigation';
import { useUser } from '~/contexts/UserContext';
import { useCart } from '~/contexts/CartContext';
import { useWishlist } from '~/contexts/WishlistContext';
import { usePreview } from '~/contexts/PreviewContext';
import { SaveToCollectionSheet, Only2ULogo, ProfilePhotoRequiredModal } from '~/components/common';
import { useLoginSheet } from '~/contexts/LoginSheetContext';
import { useVendor } from '~/contexts/VendorContext';
import { supabase } from '~/utils/supabase';
import { akoolService } from '~/utils/akoolService';
import piAPIVirtualTryOnService from '~/services/piapiVirtualTryOn';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import i18n from '../utils/i18n';
import { PinchGestureHandler, PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  getSafeImageUrls,
  getFirstSafeImageUrl,
  getProductImages,
  getFirstSafeProductImage,
} from '../utils/imageUtils';
import type { Product, ProductVariant, LegacyProduct } from '~/types/product';
import { akool } from '~/services/akoolApi';
import { uploadProfilePhoto, validateImage } from '~/utils/profilePhotoUpload';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const RESELL_TUTORIAL_VIDEO_URL = 'https://res.cloudinary.com/dtt75ypdv/video/upload/v1763566954/productvideos/cw11qeyqdpfpjsyjjwzm.mov';
const RESELL_TUTORIAL_STORAGE_KEY = 'ONLY2U_RESELL_TUTORIAL_SEEN';
const TRYON_TUTORIAL_VIDEO_URL = 'https://res.cloudinary.com/dtt75ypdv/video/upload/v1763566957/productvideos/tryon-tutorial.mov';
const TRYON_TUTORIAL_STORAGE_KEY = 'ONLY2U_TRYON_TUTORIAL_SEEN';

type ProductDetailsNavigationProp = StackNavigationProp<RootStackParamList>;
type ProductDetailsRouteProp = RouteProp<RootStackParamList, 'ProductDetails'>;

const ProductDetails = () => {
  const navigation = useNavigation<ProductDetailsNavigationProp>();
  const route = useRoute<ProductDetailsRouteProp>();
  const { product, productId } = route.params || {};
  const isFocused = useIsFocused();
  
  // State for fetched product (when only productId is provided)
  const [fetchedProduct, setFetchedProduct] = useState<any>(null);
  const [fetchingProduct, setFetchingProduct] = useState(false);

  const { userData, setUserData } = useUser();
  const { addToCart } = useCart();
  const { wishlist, toggleWishlist, isInWishlist, removeFromWishlist, addToWishlist } = useWishlist();
  const { addToPreview } = usePreview();
  const { showLoginSheet } = useLoginSheet();
  const { getVendorByProductId } = useVendor();

  // State for variants and available options
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [availableColors, setAvailableColors] = useState<
    { id: string; name: string; hex_code: string }[]
  >([]);
  const [availableSizes, setAvailableSizes] = useState<{ id: string; name: string }[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [pendingAddToCollection, setPendingAddToCollection] = useState(false);
  const [collectionCategories, setCollectionCategories] = useState<string[]>([]);
  const [collectionOccasions, setCollectionOccasions] = useState<string[]>([]);
  const [collectionStyles, setCollectionStyles] = useState<string[]>([]);
  const [collectionThemes, setCollectionThemes] = useState<string[]>([]);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingConsentAction, setPendingConsentAction] = useState<'photo' | 'video' | null>(null);
  const [showSizeSelectionModal, setShowSizeSelectionModal] = useState(false);
  const [sizeSelectionDraft, setSizeSelectionDraft] = useState<string | null>(null);
  const [sizeSelectionError, setSizeSelectionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  // Video state
  const [videoStates, setVideoStates] = useState<{
    [key: number]: { isPlaying: boolean; isMuted: boolean };
  }>({});
  const videoRefs = useRef<{ [key: number]: any }>({});

  // Unified media interface
  interface MediaItem {
    type: 'image' | 'video';
    url: string;
    thumbnail?: string;
  }
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const VIDEO_THUMB_PLACEHOLDER = 'https://placehold.co/400x400?text=Video';
  const [showCollectionSheet, setShowCollectionSheet] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [heartLoading, setHeartLoading] = useState(false);
  const [showSavedPopup, setShowSavedPopup] = useState(false);
  const [savedProductName, setSavedProductName] = useState('');
  const popupAnimation = useRef(new Animated.Value(0)).current;

  // Try on modal state
  const [showTryOnModal, setShowTryOnModal] = useState(false);
  const [showTryOnCompleteModal, setShowTryOnCompleteModal] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'photo' | 'video' | null>(null);
  const [replacementPolicyVisible, setReplacementPolicyVisible] = useState(false);
  const [coinBalance, setCoinBalance] = useState(0);
  const [showProfilePhotoModal, setShowProfilePhotoModal] = useState(false);
  const [profilePhotoModalContext, setProfilePhotoModalContext] = useState<'virtual_try_on' | 'video_face_swap'>('virtual_try_on');
  const [showPhotoPickerModal, setShowPhotoPickerModal] = useState(false);
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const [permissionModal, setPermissionModal] = useState<{ visible: boolean; context: 'camera' | 'gallery' }>({ visible: false, context: 'camera' });
  const [showTryOnTutorialModal, setShowTryOnTutorialModal] = useState(false);
  const [tryOnTutorialDontShowAgain, setTryOnTutorialDontShowAgain] = useState(false);
  const [hasSeenTryOnTutorial, setHasSeenTryOnTutorial] = useState(false);

  const promptLoginForTryOn = useCallback(() => {
    Toast.show({
      type: 'info',
      text1: 'Login Required',
      text2: 'Please login to use Face Swap.',
    });
    showLoginSheet();
  }, [showLoginSheet]);

  const profilePhotoModalContent =
    profilePhotoModalContext === 'video_face_swap'
      ? {
        description: 'Upload a profile photo first to use Video Face Swap feature.',
        icon: 'videocam-outline' as const,
      }
      : {
        description: 'Upload a profile photo first to use Face Swap feature.',
        icon: 'camera-outline' as const,
      };
  const profilePhotoModalTitle =
    profilePhotoModalContext === 'video_face_swap'
      ? 'Profile Photo Needed'
      : 'Profile Photo Required';

  // Image viewer state
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

  // Review media viewer state
  const [showReviewMediaViewer, setShowReviewMediaViewer] = useState(false);
  const [reviewMediaIndex, setReviewMediaIndex] = useState(0);
  const [reviewMediaItems, setReviewMediaItems] = useState<Array<{ type: 'image' | 'video', url: string }>>([]);
  // Track failed video thumbnail loads to show a fallback image instead of gray background
  const [failedVideoThumbs, setFailedVideoThumbs] = useState<{ [url: string]: boolean }>({});
  const [videoThumbnails, setVideoThumbnails] = useState<{ [url: string]: string }>({});

  // Convert Google Drive links to direct download for thumbnail generation
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
    const loadTutorialFlags = async () => {
      try {
        const [resellStored, tryOnStored] = await Promise.all([
          AsyncStorage.getItem(RESELL_TUTORIAL_STORAGE_KEY),
          AsyncStorage.getItem(TRYON_TUTORIAL_STORAGE_KEY),
        ]);
        setHasSeenResellTutorial(resellStored === 'true');
        setHasSeenTryOnTutorial(tryOnStored === 'true');
      } catch (error) {
        console.warn('Failed to load tutorial preference', error);
      }
    };
    loadTutorialFlags();
  }, []);

  useEffect(() => {
    resetFullScreenZoom();
  }, [imageViewerIndex, resetFullScreenZoom]);

  // Pause videos when screen loses focus
  useEffect(() => {
    if (!isFocused) {
      // Pause all main videos
      setVideoStates((prev) => {
        const newState = { ...prev };
        Object.keys(newState).forEach((key) => {
          if (newState[Number(key)]) {
            newState[Number(key)] = { ...newState[Number(key)], isPlaying: false };
          }
        });
        return newState;
      });

      // Pause full screen video
      setIsFullScreenVideoPlaying(false);
    }
  }, [isFocused]);

  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

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

    if (event.nativeState === State.END || event.nativeEvent.oldState === State.ACTIVE) {
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

  const convertGoogleDriveUrl = (url: string): string => {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('drive.google.com')) return url;
    try {
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      const ucMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      const fileId = fileMatch ? fileMatch[1] : (ucMatch ? ucMatch[1] : null);
      return fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : url;
    } catch {
      return url;
    }
  };


  // Review interaction state
  const [helpfulVotes, setHelpfulVotes] = useState<{ [reviewId: string]: boolean }>({});
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | null>(null);

  // Scroll ref for scrolling to reviews
  const scrollViewRef = useRef<ScrollView>(null);
  const [contentHeight, setContentHeight] = useState(0);

  // Reviews state
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  // Generate thumbnails for review videos (first frame)
  useEffect(() => {
    const allVideos = (reviews || []).flatMap((r: any) => r.review_videos || []);
    if (!allVideos.length) return;

    const generateThumbnails = async () => {
      console.log('[ProductDetails] Generating thumbnails for', allVideos.length, 'videos');

      for (const originalUrl of allVideos) {
        const videoUrl = originalUrl;
        const sourceUrl = convertGoogleDriveUrl(originalUrl);
        // Skip if already generated
        if (videoThumbnails[videoUrl]) {
          console.log('[ProductDetails] Thumbnail already exists for:', videoUrl);
          continue;
        }

        try {
          console.log('[ProductDetails] Generating thumbnail for:', sourceUrl);
          const { uri } = await VideoThumbnails.getThumbnailAsync(sourceUrl, {
            time: 0,
            quality: 0.8,
          });
          console.log('[ProductDetails] Thumbnail generated:', uri);

          setVideoThumbnails(prev => ({
            ...prev,
            [videoUrl]: uri
          }));
        } catch (error) {
          console.error('[ProductDetails] Failed to generate thumbnail for:', sourceUrl, error);
          // Set placeholder as the thumbnail on failure
          setVideoThumbnails(prev => ({
            ...prev,
            [videoUrl]: VIDEO_THUMB_PLACEHOLDER
          }));
        }
      }
    };

    generateThumbnails();
  }, [reviews]);

  // Sample product data (fallback if no product passed)
  const sampleProduct = useMemo(
    (): LegacyProduct => ({
      id: '1',
      name: 'Pink Pattu Saree with Gold Border',
      price: 2500,
      originalPrice: 5000,
      discount: 50,
      rating: 4.5,
      reviews: 120,
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&h=600&fit=crop',
      image_urls: [] as string[],
      video_urls: [] as string[],
      description: 'Beautiful pink silk saree with intricate gold border work',
      stock: '0',
      featured: true,
      images: 1,
      sku: 'SKU-001',
      category: '',
    }),
    []
  );

  // Fetch product by ID if only productId is provided
  useEffect(() => {
    const fetchProductById = async () => {
      if (!productId || product) return; // Don't fetch if product is already provided
      
      try {
        setFetchingProduct(true);
        setLoading(true);
        
        // Fetch product with all necessary fields including variants
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            product_variants(
              id,
              product_id,
              color_id,
              size_id,
              quantity,
              price,
              mrp_price,
              rsp_price,
              discount_percentage,
              sku,
              cost_price,
              image_urls,
              video_urls,
              size:sizes(id, name)
            )
          `)
          .eq('id', productId)
          .single();
        
        if (error) {
          console.error('Error fetching product:', error);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to load product details',
          });
          return;
        }
        
        if (data) {
          console.log('✅ Fetched product with variants:', {
            id: data.id,
            name: data.name,
            variantsCount: data.product_variants?.length || 0,
            image_urls: data.image_urls?.length || 0,
            video_urls: data.video_urls?.length || 0,
          });
          setFetchedProduct(data);
          
          // Set variants from fetched product if available
          if (data.product_variants && Array.isArray(data.product_variants) && data.product_variants.length > 0) {
            const variantsData: ProductVariant[] = data.product_variants.map((item: any) => ({
              id: item.id,
              product_id: item.product_id,
              color_id: item.color_id,
              size_id: item.size_id,
              quantity: item.quantity,
              created_at: item.created_at,
              updated_at: item.updated_at,
              price: item.price || 0,
              sku: item.sku,
              mrp_price: item.mrp_price,
              rsp_price: item.rsp_price,
              cost_price: item.cost_price,
              discount_percentage: item.discount_percentage,
              image_urls: item.image_urls,
              video_urls: item.video_urls,
              color: undefined, // Will be populated separately if color_id exists
              size: Array.isArray(item.size) ? item.size[0] : item.size,
            }));
            
            // Fetch color data separately for variants that have color_id (same as fetchProductVariants)
            const variantsWithColors = variantsData.filter((v) => v.color_id);
            if (variantsWithColors.length > 0) {
              const colorIds = [...new Set(variantsWithColors.map((v) => v.color_id!))];
              const { data: colorData, error: colorError } = await supabase
                .from('colors')
                .select('id, name, hex_code')
                .in('id', colorIds);

              if (!colorError && colorData) {
                const colorMap = new Map(colorData.map((c) => [c.id, c]));
                const updatedVariants = variantsData.map((variant) => ({
                  ...variant,
                  color: variant.color_id ? colorMap.get(variant.color_id) : undefined,
                }));
                setVariants(updatedVariants);
                console.log('✅ Set variants with colors from fetched product:', updatedVariants.length);
                return;
              }
            }
            
            setVariants(variantsData);
            console.log('✅ Set variants from fetched product:', variantsData.length);
            
            // Set default variant (first variant with images, or first variant)
            if (variantsData.length > 0 && !selectedVariant) {
              const defaultVariant = variantsData.find((v) => v.image_urls && v.image_urls.length > 0) || variantsData[0];
              setSelectedVariant(defaultVariant);
              console.log('✅ Set default variant from fetched product:', defaultVariant.id);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching product by ID:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load product details',
        });
      } finally {
        setFetchingProduct(false);
        setLoading(false);
      }
    };
    
    fetchProductById();
  }, [productId, product]);

  // Use fetched product if available, otherwise use passed product
  const effectiveProduct = fetchedProduct || product;

  const productData = useMemo(
    () => ({
      ...sampleProduct,
      ...effectiveProduct,
      sku: (effectiveProduct as any)?.sku ?? sampleProduct.sku,
      category: (effectiveProduct as any)?.category?.name ?? sampleProduct.category,
      stock: Number((effectiveProduct as any)?.stock ?? sampleProduct.stock),
      image_urls: (effectiveProduct as any)?.image_urls ?? sampleProduct.image_urls,
      video_urls: (effectiveProduct as any)?.video_urls ?? sampleProduct.video_urls,
    }),
    [effectiveProduct, sampleProduct]
  );

  // Vendor info from product data
  const [vendorProfile, setVendorProfile] = useState<any | null>(null);
  const vendorName = (productData as any).vendor_name || 'Unknown Vendor';
  const vendorAlias = (productData as any).alias_vendor;
  const returnPolicy = (productData as any).return_policy;
  const isPersonalizedProduct = Boolean((productData as any).isPersonalized);

  useEffect(() => {
    let isMounted = true;
    const fetchVendorProfile = async () => {
      try {
        if (!productData?.id || isPersonalizedProduct) {
          setVendorProfile(null);
          return;
        }
        const vendor = await getVendorByProductId(productData.id);
        if (isMounted) {
          setVendorProfile(vendor);
        }
      } catch (error) {
        console.error('Error fetching vendor profile for product:', error);
        if (isMounted) {
          setVendorProfile(null);
        }
      }
    };
    fetchVendorProfile();
    return () => {
      isMounted = false;
    };
  }, [getVendorByProductId, productData?.id, isPersonalizedProduct]);

  const displayVendorName = useMemo(() => {
    if (isPersonalizedProduct) return 'Personalized';
    return vendorProfile?.business_name || vendorAlias || vendorName;
  }, [isPersonalizedProduct, vendorProfile, vendorAlias, vendorName]);

  const handleVendorPress = useCallback(() => {
    if (!vendorProfile || isPersonalizedProduct) return;
    navigation.navigate('VendorProfile', {
      vendorId: vendorProfile.id,
      vendor: vendorProfile,
    });
  }, [navigation, vendorProfile, isPersonalizedProduct]);


  // Use user's size as default
  const defaultSize = userData?.size || '';
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('details');
  const [addToCartLoading, setAddToCartLoading] = useState(false);
  const [showMarginModal, setShowMarginModal] = useState(false);
  const [showResellTutorialModal, setShowResellTutorialModal] = useState(false);
  const [resellTutorialDontShowAgain, setResellTutorialDontShowAgain] = useState(false);
  const [hasSeenResellTutorial, setHasSeenResellTutorial] = useState(false);
  const [selectedMargin, setSelectedMargin] = useState(15); // Default 15% margin
  const [customPrice, setCustomPrice] = useState<string>('');
  const [customPriceError, setCustomPriceError] = useState<string | null>(null);
  const [showLowCoinsModal, setShowLowCoinsModal] = useState(false);

  // More Like This suggestions
  const [suggestedProducts, setSuggestedProducts] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const { t } = useTranslation();
  const [langMenuVisible, setLangMenuVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const suggestionsListRef = useRef<any>(null);
  const suggestionsScrollOffsetRef = useRef<number>(0);
  const suggestionsStartOffsetRef = useRef<number>(0);

  // Pan gesture to manually control horizontal scroll on Android
  const suggestionsPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) => {
          // Activate when horizontal movement dominates
          return Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy);
        },
        onPanResponderGrant: () => {
          suggestionsStartOffsetRef.current = suggestionsScrollOffsetRef.current || 0;
        },
        onPanResponderMove: (_evt, gesture) => {
          const target = Math.max(0, suggestionsStartOffsetRef.current - gesture.dx);
          try {
            suggestionsListRef.current?.scrollToOffset?.({ offset: target, animated: false });
          } catch { }
        },
        onPanResponderRelease: (_evt, gesture) => {
          const finalOffset = Math.max(0, suggestionsStartOffsetRef.current - gesture.dx);
          suggestionsScrollOffsetRef.current = finalOffset;
          try {
            suggestionsListRef.current?.scrollToOffset?.({ offset: finalOffset, animated: true });
          } catch { }
        },
        onPanResponderTerminationRequest: () => true,
      }),
    []
  );

  const handleResellButtonPress = useCallback(() => {
    if (!hasSeenResellTutorial) {
      setShowResellTutorialModal(true);
      return;
    }
    setShowMarginModal(true);
  }, [hasSeenResellTutorial]);

  const handleDismissResellTutorial = useCallback(() => {
    setResellTutorialDontShowAgain(false);
    setShowResellTutorialModal(false);
  }, []);

  const handleContinueResellTutorial = useCallback(async () => {
    try {
      if (resellTutorialDontShowAgain) {
        await AsyncStorage.setItem(RESELL_TUTORIAL_STORAGE_KEY, 'true');
        setHasSeenResellTutorial(true);
      }
    } catch (error) {
      console.warn('Failed to persist resell tutorial flag', error);
    } finally {
      setShowResellTutorialModal(false);
      setResellTutorialDontShowAgain(false);
      setTimeout(() => setShowMarginModal(true), 200);
    }
  }, [resellTutorialDontShowAgain]);


  // Fetch product variants (only if not already loaded from fetched product)
  useEffect(() => {
    if (productData.id && String(productData.id) !== '1') {
      // Only fetch variants if we don't already have them from fetchedProduct
      if (!fetchedProduct || !fetchedProduct.product_variants || fetchedProduct.product_variants.length === 0) {
        fetchProductVariants();
      }
      fetchProductReviews();
      fetchSuggestedProducts();
    }
  }, [productData.id, fetchedProduct]);

  // Fetch user coin balance
  useEffect(() => {
    if (userData?.id) {
      fetchUserCoinBalance();
    }
  }, [userData?.id]);

  // Process product images and videos based on selected variant
  useEffect(() => {
    if (productData) {
      console.log('🔍 ProductDetails - productData:', {
        id: productData.id,
        image_urls: productData.image_urls,
        video_urls: productData.video_urls,
        image: productData.image,
        selectedVariant: selectedVariant?.id,
      });

      // Helper function to check if URL is a video
      const isVideoUrl = (url: string) => {
        if (!url) return false;
        const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
        const lowerUrl = url.toLowerCase();
        return (
          videoExtensions.some((ext) => lowerUrl.includes(ext)) ||
          lowerUrl.includes('video') ||
          lowerUrl.includes('mp4') ||
          lowerUrl.includes('drive.google.com')
        ); // Assume Google Drive URLs are videos
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
      const allImageUrls = new Set<string>(); // Use Set to avoid duplicates

      // Collect images from ALL variants (not just selected variant)
      if (variants && variants.length > 0) {
        variants.forEach((variant: any) => {
          if (variant.image_urls && Array.isArray(variant.image_urls)) {
            variant.image_urls.forEach((url: string) => {
              if (url && 
                  typeof url === 'string' && 
                  !url.includes('placeholder') && 
                  !url.includes('placehold') &&
                  !url.includes('via.placeholder') &&
                  !url.includes('unsplash.com/photo-1610030469983')) {
                allImageUrls.add(url);
              }
            });
          }
        });
      }

      // If we have images from variants, use them
      if (allImageUrls.size > 0) {
        unifiedMediaItems = Array.from(allImageUrls).map((url) => ({ type: 'image' as const, url }));
        console.log('✅ Using images from all variants:', unifiedMediaItems.length);
      }
      // Priority 2: Check for images in product variants first
      else {
        const productImages = getProductImages(productData);
        if (productImages.length > 0) {
          const cacheKey = `product_${productData.id}`;
          if (processedImageCache.current[cacheKey]) {
            const cachedImages = processedImageCache.current[cacheKey].filter((url: string) => 
              url && 
              !url.includes('placeholder') && 
              !url.includes('placehold') &&
              !url.includes('via.placeholder') &&
              !url.includes('unsplash.com/photo-1610030469983')
            );
            unifiedMediaItems = cachedImages.map((url) => ({ type: 'image' as const, url }));
            console.log('✅ Using cached images from product variants:', cachedImages);
          } else {
            // Use raw URLs for faster processing
            // Filter out placeholder images
            const images = productImages.filter((url: string) => 
              url && 
              typeof url === 'string' && 
              !url.includes('placeholder') && 
              !url.includes('placehold') &&
              !url.includes('via.placeholder') &&
              !url.includes('unsplash.com/photo-1610030469983')
            );
            unifiedMediaItems = images.map((url: string) => ({ type: 'image' as const, url }));
            processedImageCache.current[cacheKey] = images;
            console.log('✅ Using raw images from product variants:', images);
          }
        }
        // Priority 3: Check for images in image_urls array
        else if (
          productData.image_urls &&
          Array.isArray(productData.image_urls) &&
          productData.image_urls.length > 0
        ) {
          const cacheKey = `product_urls_${productData.id}`;
          if (processedImageCache.current[cacheKey]) {
            const cachedImages = processedImageCache.current[cacheKey].filter((url: string) => 
              url && 
              !url.includes('placeholder') && 
              !url.includes('placehold') &&
              !url.includes('via.placeholder') &&
              !url.includes('unsplash.com/photo-1610030469983')
            );
            unifiedMediaItems = cachedImages.map((url) => ({ type: 'image' as const, url }));
            console.log('✅ Using cached image_urls array:', cachedImages);
          } else {
            // Use raw URLs for faster processing
            // Filter out placeholder images
            const images = productData.image_urls.filter((url: string) => 
              url && 
              typeof url === 'string' && 
              !url.includes('placeholder') && 
              !url.includes('placehold') &&
              !url.includes('via.placeholder') &&
              !url.includes('unsplash.com/photo-1610030469983')
            );
            unifiedMediaItems = images.map((url: string) => ({ type: 'image' as const, url }));
            processedImageCache.current[cacheKey] = images;
            console.log('✅ Using raw image_urls array:', images);
          }
        }
        // Priority 4: Fallback to old image field
        else if (productData.image && 
                 !productData.image.includes('placeholder') && 
                 !productData.image.includes('placehold') &&
                 !productData.image.includes('via.placeholder') &&
                 !productData.image.includes('unsplash.com/photo-1610030469983')) {
          // Old format: single image from image field (only if not placeholder)
          unifiedMediaItems = [{ type: 'image' as const, url: productData.image }];
          console.log('✅ Using image field:', productData.image);
        }
      }

      // Add videos if available (from ALL variants, then product)
      let videoItems: MediaItem[] = [];
      const allVideoUrls = new Set<string>(); // Use Set to avoid duplicates
      
      // Collect videos from ALL variants
      if (variants && variants.length > 0) {
        variants.forEach((variant: any) => {
          if (variant.video_urls && Array.isArray(variant.video_urls)) {
            variant.video_urls.forEach((url: string) => {
              if (url && typeof url === 'string') {
                allVideoUrls.add(url);
              }
            });
          }
        });
      }
      
      // If we have videos from variants, use them
      if (allVideoUrls.size > 0) {
        videoItems = Array.from(allVideoUrls).map((url: string) => ({
          type: 'video' as const,
          url: convertGoogleDriveVideoUrl(url),
          thumbnail: unifiedMediaItems[0]?.url, // Use first image as thumbnail
        }));
        console.log('✅ Using videos from all variants:', videoItems.length);
      } else if (
        productData.video_urls &&
        Array.isArray(productData.video_urls) &&
        productData.video_urls.length > 0
      ) {
        videoItems = productData.video_urls
          .filter((url: string) => url && typeof url === 'string')
          .map((url: string) => ({
            type: 'video' as const,
            url: convertGoogleDriveVideoUrl(url),
            thumbnail: unifiedMediaItems[0]?.url, // Use first image as thumbnail
          }));
        console.log('✅ Using videos from product:', productData.video_urls);
      }

      // Combine images and videos
      const combinedMediaItems = [...unifiedMediaItems, ...videoItems];

      console.log(
        '📸 Final unified media items:',
        combinedMediaItems.map((item) => ({ type: item.type, url: item.url }))
      );

      // Only update if the media items have actually changed
      setMediaItems((prevItems) => {
        const newItems = combinedMediaItems;
        if (JSON.stringify(prevItems) !== JSON.stringify(newItems)) {
          setCurrentImageIndex(0);
          return newItems;
        }
        return prevItems;
      });

      // Also update productImages for backward compatibility
      setProductImages((prevImages) => {
        const newImages = combinedMediaItems.map((item) => item.url);
        if (JSON.stringify(prevImages) !== JSON.stringify(newImages)) {
          return newImages;
        }
        return prevImages;
      });
    }
  }, [productData.image_urls, productData.video_urls, productData.image, selectedVariant, variants]);

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

  const fetchProductVariants = async () => {
    try {
      // Validate product ID
      if (!productData.id || String(productData.id) === '1') {
        console.log('Invalid product ID, skipping variant fetch');
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('product_variants')
        .select(
          `
          id,
          product_id,
          color_id,
          size_id,
          quantity,
          created_at,
          updated_at,
          price,
          sku,
          mrp_price,
          rsp_price,
          cost_price,
          discount_percentage,
          image_urls,
          video_urls,
          size:sizes(id, name)
        `
        )
        .eq('product_id', productData.id);

      if (error) {
        console.error('Error fetching variants:', error);
        return;
      }

      // Transform the data to match our interface
      const variantsData: ProductVariant[] = (data || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        color_id: item.color_id,
        size_id: item.size_id,
        quantity: item.quantity,
        created_at: item.created_at,
        updated_at: item.updated_at,
        price: item.price || 0,
        sku: item.sku,
        mrp_price: item.mrp_price,
        rsp_price: item.rsp_price,
        cost_price: item.cost_price,
        discount_percentage: item.discount_percentage,
        image_urls: item.image_urls,
        video_urls: item.video_urls,
        color: undefined, // Will be populated separately if color_id exists
        size: Array.isArray(item.size) ? item.size[0] : item.size,
      }));

      setVariants(variantsData);

      // Fetch color data separately for variants that have color_id
      const variantsWithColors = variantsData.filter((v) => v.color_id);
      let availableColorsArray: any[] = [];

      if (variantsWithColors.length > 0) {
        const colorIds = [...new Set(variantsWithColors.map((v) => v.color_id!))];
        const { data: colorData, error: colorError } = await supabase
          .from('colors')
          .select('id, name, hex_code')
          .in('id', colorIds);

        if (!colorError && colorData) {
          // Create a map of color data
          const colorMap = new Map(colorData.map((c) => [c.id, c]));

          // Update variants with color data
          const updatedVariants = variantsData.map((variant) => ({
            ...variant,
            color: variant.color_id ? colorMap.get(variant.color_id) : undefined,
          }));

          setVariants(updatedVariants);

          // Extract unique colors
          availableColorsArray = [...colorMap.values()];
          setAvailableColors(availableColorsArray);
        }
      } else {
        setAvailableColors([]);
      }

      // Extract unique sizes and sort in standard order
      const sizes = [...new Map(variantsData.map((v) => [v.size.id, v.size])).values()];
      const sizePriority = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];
      const getPriority = (name: string) => {
        const idx = sizePriority.indexOf((name || '').trim());
        return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
      };
      const sortedSizes = [...sizes].sort((a, b) => {
        const pa = getPriority(a.name);
        const pb = getPriority(b.name);
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name);
      });
      setAvailableSizes(sortedSizes);

      // Set default selections if available
      if (availableColorsArray.length > 0 && !selectedColor) {
        setSelectedColor(availableColorsArray[0].id);
      }
      if (sortedSizes.length > 0 && !selectedSize) {
        // Try to match user's default size with available sizes
        const userSizeMatch = sortedSizes.find((s) => s.name === defaultSize);
        if (userSizeMatch) {
          setSelectedSize(userSizeMatch.id);
        } else {
          setSelectedSize(sortedSizes[0].id);
        }
      }
      
      // Set default variant if no variant is selected (first variant with images, or first variant)
      if (variantsData.length > 0 && !selectedVariant) {
        const defaultVariant = variantsData.find((v) => v.image_urls && v.image_urls.length > 0) || variantsData[0];
        setSelectedVariant(defaultVariant);
        console.log('✅ Set default variant:', defaultVariant.id);
      }
    } catch (error) {
      console.error('Error fetching variants:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductReviews = async () => {
    try {
      setReviewsLoading(true);
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', productData.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reviews:', error);
        return;
      }

      setReviews(data || []);

      // Calculate average rating and total reviews
      if (data && data.length > 0) {
        const totalRating = data.reduce((sum, review) => sum + review.rating, 0);
        setAverageRating(totalRating / data.length);
        setTotalReviews(data.length);
      } else {
        setAverageRating(0);
        setTotalReviews(0);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setReviewsLoading(false);
    }
  };

  // Fetch suggested products based on current product
  const fetchSuggestedProducts = async () => {
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
        .neq('id', productData.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50); // Fetch 50 products to ensure variety

      if (error) {
        console.error('Error fetching suggested products:', error);
        return;
      }

      console.log('📦 Fetched suggested products:', data?.length || 0, 'products');

      setSuggestedProducts(data || []);
    } catch (error) {
      console.error('Error fetching suggested products:', error);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // Update selected variant when color or size changes
  useEffect(() => {
    if (selectedSize) {
      let variant: ProductVariant | null = null;

      if (selectedColor) {
        // If color is selected, find variant with both color and size
        variant =
          variants.find((v) => v.color_id === selectedColor && v.size_id === selectedSize) || null;
      } else {
        // If no color is selected, find variant with just the size
        variant = variants.find((v) => v.size_id === selectedSize) || null;
      }

      setSelectedVariant(variant);
      setQuantity(1); // Reset quantity when variant changes
    }
  }, [selectedColor, selectedSize, variants]);

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

  // Reset animation when popup is hidden
  useEffect(() => {
    if (!showSavedPopup) {
      popupAnimation.setValue(0);
    }
  }, [showSavedPopup, popupAnimation]);

  const renderSizeOption = (size: { id: string; name: string }) => (
    <TouchableOpacity
      key={size.id}
      style={[styles.sizeOption, selectedSize === size.id && styles.selectedSizeOption]}
      onPress={() => {
        setSelectedSize(size.id);
      }}>
      <Text style={[styles.sizeText, selectedSize === size.id && styles.selectedSizeText]}>
        {size.name}
      </Text>
    </TouchableOpacity>
  );

  const renderModalSizeOption = (size: { id: string; name: string }) => {
    const isSelected = sizeSelectionDraft === size.id;
    return (
      <TouchableOpacity
        key={`modal-size-${size.id}`}
        style={[styles.sizeOption, isSelected && styles.selectedSizeOption]}
        onPress={() => {
          setSizeSelectionDraft(size.id);
          setSizeSelectionError('');
        }}
      >
        <Text style={[styles.sizeText, isSelected && styles.selectedSizeText]}>{size.name}</Text>
      </TouchableOpacity>
    );
  };

  const renderColorOption = (color: { id: string; name: string; hex_code: string }) => (
    <TouchableOpacity
      key={color.id}
      style={styles.colorOptionContainer}
      onPress={() => setSelectedColor(color.id)}>
      <View
        style={[
          styles.colorOption,
          { backgroundColor: color.hex_code },
          color.hex_code === '#FFFFFF' && styles.whiteColorBorder,
          selectedColor === color.id && styles.selectedColorOption,
        ]}
      />
      {/* <Text style={styles.colorName}>{color.name}</Text> */}
    </TouchableOpacity>
  );

  // Helper function to add product directly to "All" collection
  const addToAllCollection = async () => {
    if (!userData?.id || !productData?.id) {
      console.log('No user ID or product ID, cannot add to collection');
      return;
    }

    // Show toast immediately when heart is clicked
    Toast.show({
      type: 'success',
      text1: 'Added to Wishlist',
      text2: `${productData.name} saved to All folder`,
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
        .eq('product_id', productData.id.toString())
        .eq('collection_id', allCollectionId)
        .single();

      if (!existingProduct) {
        // Add product to "All" collection
        const { error: insertError } = await supabase
          .from('collection_products')
          .insert({
            product_id: productData.id.toString(),
            collection_id: allCollectionId,
          });

        if (insertError) {
          console.error('Error adding to All collection:', insertError);
        } else {
          console.log('Successfully added to All collection');

          // Add to wishlist context with complete product object
          const wishlistProduct = {
            id: productData.id.toString(),
            name: productData.name,
            description: productData.description || '',
            price: selectedVariant?.price || productData.price || 0,
            image_url: productImages[0] || '',
            image_urls: productImages,
            video_urls: productData.video_urls || [],
            featured_type: productData.featured ? 'trending' : '',
            category: productData.category,
            stock_quantity: getAvailableQuantity(),
            variants: variants,
          };

          await addToWishlist(wishlistProduct);

          // Toast already shown at the beginning
          return true; // Indicate success
        }
      } else {
        console.log('Product already in All collection');
        return true; // Product was already in collection
      }
    } catch (error) {
      console.error('Error in addToAllCollection:', error);
      return false; // Indicate failure
    }
  };

  const handleAddToCart = async () => {
    if (!selectedSize) {
      Alert.alert('Error', 'Please select a size');
      return;
    }
    if (availableColors.length > 0 && !selectedColor) {
      Alert.alert('Error', 'Please select a color');
      return;
    }
    if (!selectedVariant) {
      Alert.alert('Error', 'Selected combination is not available');
      return;
    }
    if (quantity < 1 || quantity > selectedVariant.quantity) {
      Alert.alert('Error', 'Invalid quantity');
      return;
    }

    setAddToCartLoading(true);

    const selectedColorData = availableColors.find((c) => c.id === selectedColor);
    const selectedSizeData = availableSizes.find((s) => s.id === selectedSize);

    addToCart({
      productId: productData.id,
      variantId: selectedVariant?.id || null,
      name: productData.name,
      price: selectedVariant?.price || productData.price,
      image: productData.image,
      image_urls: productData.image_urls || (productData.image ? [productData.image] : []),
      size: selectedSizeData?.name || selectedSize,
      color: selectedColorData?.name || selectedColor || 'N/A',
      quantity,
      stock: selectedVariant.quantity,
      category: productData.category,
      sku: productData.sku || productData.id,
      isReseller: false,
    });

    setAddToCartLoading(false);

    // Show toast notification
    Toast.show({
      type: 'success',
      text1: 'Yayy!! Added to Cart 🎉',
      text2: productData.name,
      position: 'top',
      visibilityTime: 2000,
    });
  };

  const fetchUserCoinBalance = async () => {
    if (!userData?.id) return;

    try {
      const balance = await akoolService.getUserCoinBalance(userData.id);
      setCoinBalance(balance);

      if (userData && balance !== userData.coin_balance) {
        setUserData({ ...userData, coin_balance: balance });
      }
    } catch (error) {
      console.error('Error fetching coin balance:', error);
    }
  };

  

  const continueTryOnFlow = async () => {
    if (!userData?.id) {
      setShowConsentModal(false);
      promptLoginForTryOn();
      return;
    }

    let profilePhoto = userData.profilePhoto;

    if (!profilePhoto) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('profilePhoto')
          .eq('id', userData.id)
          .single();

        if (!error && data?.profilePhoto) {
          profilePhoto = data.profilePhoto;
          setUserData({ ...userData, profilePhoto });
        }
      } catch (error) {
        console.warn('Error fetching user profile photo before try-on:', error);
      }
    }

    if (!profilePhoto) {
      setShowConsentModal(false);
      setShowTryOnModal(false);
      setSelectedOption(null);
      setProfilePhotoModalContext('virtual_try_on');
      setShowProfilePhotoModal(true);
      return;
    }

    setShowConsentModal(true);
  };

  const handleTryOnFlowStart = useCallback(async () => {
    if (availableSizes.length > 0) {
      const initialSize = selectedSize || availableSizes[0]?.id || null;
      setSizeSelectionDraft(initialSize);
      setSizeSelectionError('');
      setShowSizeSelectionModal(true);
      return;
    }

    await continueTryOnFlow();
  }, [availableSizes.length, continueTryOnFlow, selectedSize]);

  const handleTryOnButtonPress = useCallback(async () => {
    if (!userData?.id) {
      promptLoginForTryOn();
      return;
    }

    if (!hasSeenTryOnTutorial) {
      setShowTryOnTutorialModal(true);
      return;
    }

    await handleTryOnFlowStart();
  }, [
    handleTryOnFlowStart,
    hasSeenTryOnTutorial,
    promptLoginForTryOn,
    userData?.id,
  ]);

  const handleDismissTryOnTutorial = useCallback(() => {
    setTryOnTutorialDontShowAgain(false);
    setShowTryOnTutorialModal(false);
  }, []);

  const handleContinueTryOnTutorial = useCallback(async () => {
    try {
      if (tryOnTutorialDontShowAgain) {
        await AsyncStorage.setItem(TRYON_TUTORIAL_STORAGE_KEY, 'true');
        setHasSeenTryOnTutorial(true);
      }
    } catch (error) {
      console.warn('Failed to persist try-on tutorial flag', error);
    } finally {
      setShowTryOnTutorialModal(false);
      setTryOnTutorialDontShowAgain(false);
      setTimeout(() => handleTryOnFlowStart(), 200);
    }
  }, [handleTryOnFlowStart, tryOnTutorialDontShowAgain]);

  const handleConfirmSizeSelection = async () => {
    if (!sizeSelectionDraft) {
      setSizeSelectionError('Please choose a size to continue.');
      return;
    }

    setSelectedSize(sizeSelectionDraft);
    setShowSizeSelectionModal(false);
    await continueTryOnFlow();
  };

  const handleCancelSizeSelection = () => {
    setShowSizeSelectionModal(false);
    setSizeSelectionError('');
    setSizeSelectionDraft(null);
  };

  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setPermissionModal({ visible: true, context: 'camera' });
      return false;
    }
    return true;
  };

  const requestGalleryPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setPermissionModal({ visible: true, context: 'gallery' });
      return false;
    }
    return true;
  };

  const handleProfilePhotoUpload = async (uri: string) => {
    if (!userData?.id) {
      Toast.show({
        type: 'error',
        text1: 'Not Logged In',
        text2: 'Please log in to update your profile photo.',
      });
      return;
    }

    try {
      setUploadingProfilePhoto(true);

      const validation = await validateImage(uri);
      if (!validation.valid) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Image',
          text2: validation.error || 'Please select a valid image file.',
        });
        return;
      }

      const uploadResult = await uploadProfilePhoto(uri);

      if (uploadResult.success && uploadResult.url) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ profilePhoto: uploadResult.url })
          .eq('id', userData.id);

        if (updateError) {
          throw updateError;
        }

        setUserData({ ...userData, profilePhoto: uploadResult.url });

        Toast.show({
          type: 'success',
          text1: 'Photo Updated',
          text2: 'Your profile photo has been updated successfully!',
        });

        setShowPhotoPickerModal(false);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Upload Failed',
          text2: uploadResult.error || 'Failed to upload profile photo. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload Error',
        text2: 'An error occurred while uploading your photo.',
      });
    } finally {
      setUploadingProfilePhoto(false);
    }
  };

  const takeProfilePhoto = async () => {
    if (uploadingProfilePhoto) return;
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await handleProfilePhotoUpload(result.assets[0].uri);
    }
  };

  const pickProfilePhotoFromGallery = async () => {
    if (uploadingProfilePhoto) return;
    const hasPermission = await requestGalleryPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await handleProfilePhotoUpload(result.assets[0].uri);
    }
  };

  const closePermissionModal = () => setPermissionModal((prev) => ({ ...prev, visible: false }));

  const openSettingsForPermissions = async () => {
    closePermissionModal();
    try {
      if (Linking.openSettings) {
        await Linking.openSettings();
      } else {
        await Linking.openURL('app-settings:');
      }
    } catch (error) {
      console.warn('Unable to open settings:', error);
    }
  };

  const handleVirtualTryOn = async () => {
    try {
      if (!userData?.id) {
        setShowTryOnModal(false);
        setSelectedOption(null);
        promptLoginForTryOn();
        return;
      }

      if (!userData?.profilePhoto) {
        setProfilePhotoModalContext('virtual_try_on');
        setShowProfilePhotoModal(true);
        setShowTryOnModal(false);
        setSelectedOption(null);
        return;
      }

      if (coinBalance < 25) {
        setShowLowCoinsModal(true);
        return;
      }

      if (!productData?.id) {
        Alert.alert('Product Error', 'Product information is not available. Please try again.');
        return;
      }

      const productId = productData.id;

      // Get image from selected variant if available
      let productImageUrl = null;

      console.log('Face Swap - Selected size ID:', selectedSize, 'Selected color ID:', selectedColor);
      console.log('Face Swap - Available variants:', variants.map(v => ({
        size_id: v.size_id,
        color_id: v.color_id,
        images: v.image_urls?.length || 0
      })));

      // First, try to find the variant matching selected size and color (comparing IDs)
      if (selectedSize || selectedColor) {
        const selectedVariant = variants.find((v) => {
          const sizeMatch = !selectedSize || v.size_id === selectedSize;
          const colorMatch = !selectedColor || v.color_id === selectedColor;
          return sizeMatch && colorMatch && v.image_urls && v.image_urls.length > 0;
        });

        console.log('Face Swap - Selected variant found:', selectedVariant ? 'YES' : 'NO');

        if (selectedVariant?.image_urls?.[0]) {
          productImageUrl = selectedVariant.image_urls[0];
          console.log('Face Swap - Using selected variant image:', productImageUrl);
        }
      }

      // Fallback to first variant with image, or product default image
      if (!productImageUrl) {
        const firstVariantWithImage = variants.find((v) => v.image_urls && v.image_urls.length > 0);
        productImageUrl = firstVariantWithImage?.image_urls?.[0] || productData.image_urls?.[0] || productData.image;
        console.log('Face Swap - Using fallback image:', productImageUrl);
      }

      if (!productImageUrl) {
        Alert.alert('Product Image Error', 'Product image is not available for Face Swap. Please try a different product.');
        return;
      }

      setShowTryOnModal(false);

      // Update coin balance (deduct 25 coins for face swap)
      setCoinBalance((prev) => prev - 25);

      // Also update user context
      if (userData) {
        setUserData({ ...userData, coin_balance: (userData.coin_balance || 0) - 25 });
      }

      // Deduct coins from database
      const { error: coinUpdateError } = await supabase
        .from('users')
        .update({ coin_balance: (userData?.coin_balance || 0) - 25 })
        .eq('id', userData?.id);

      if (coinUpdateError) {
        console.error('Error updating coin balance:', coinUpdateError);
        // Refund coins on database error
        setCoinBalance((prev) => prev + 25);
        if (userData) {
          setUserData({ ...userData, coin_balance: (userData.coin_balance || 0) + 25 });
        }
        Alert.alert('Error', 'Failed to update coin balance. Please try again.');
        return;
      }

      // Check if piAPIVirtualTryOnService is available
      if (!piAPIVirtualTryOnService || typeof piAPIVirtualTryOnService.initiateVirtualTryOn !== 'function') {
        // Refund coins on service error
        setCoinBalance((prev) => prev + 25);
        if (userData) {
          setUserData({ ...userData, coin_balance: (userData.coin_balance || 0) + 25 });
        }
        await supabase
          .from('users')
          .update({ coin_balance: (userData?.coin_balance || 0) + 25 })
          .eq('id', userData?.id);

        Alert.alert('Service Unavailable', 'Face Swap service is currently unavailable. Please try again later.');
        return;
      }

      // Initiate face swap with PiAPI
      const response = await piAPIVirtualTryOnService.initiateVirtualTryOn({
        userImageUrl: userData.profilePhoto,
        productImageUrl: productImageUrl,
        userId: userData.id,
        productId: productId,
        batchSize: 1,
      });

      if (response && response.success && response.taskId) {
        startFaceSwapPolling(productId, response.taskId);

        Toast.show({
          type: 'success',
          text1: 'Face Swap Started',
          text2: 'Your face swap is being processed. This may take a few minutes.',
        });
      } else {
        // Refund coins on failure
        setCoinBalance((prev) => prev + 25);
        if (userData) {
          setUserData({ ...userData, coin_balance: (userData.coin_balance || 0) + 25 });
        }
        await supabase
          .from('users')
          .update({ coin_balance: (userData?.coin_balance || 0) + 25 })
          .eq('id', userData?.id);

        Alert.alert('Face Swap Failed', response?.error || 'Failed to start face swap. Your coins have been refunded.');
      }
    } catch (error) {
      console.error('Error starting face swap:', error);

      // Refund coins on any error
      setCoinBalance((prev) => prev + 25);
      if (userData) {
        setUserData({ ...userData, coin_balance: (userData.coin_balance || 0) + 25 });
      }

      try {
        await supabase
          .from('users')
          .update({ coin_balance: (userData?.coin_balance || 0) + 25 })
          .eq('id', userData?.id);
      } catch (refundError) {
        console.error('Error refunding coins:', refundError);
      }

      Alert.alert('Error', 'An unexpected error occurred. Your coins have been refunded. Please try again.');
    }
  };

  const handleVideoFaceSwap = async () => {
    if (!userData?.id) {
      setShowTryOnModal(false);
      setSelectedOption(null);
      promptLoginForTryOn();
      return;
    }

    if (!userData?.profilePhoto) {
      setProfilePhotoModalContext('video_face_swap');
      setShowProfilePhotoModal(true);
      setShowTryOnModal(false);
      setSelectedOption(null);
      return;
    }

    if (coinBalance < 25) {
      setShowLowCoinsModal(true);
      return;
    }

    const productId = productData.id;
    // Get video from first variant that has videos, or fallback to product video_urls
    const firstVariantWithVideo = variants.find((v) => v.video_urls && v.video_urls.length > 0);
    const productVideoUrl = firstVariantWithVideo?.video_urls?.[0] || productData.video_urls?.[0];

    if (!productVideoUrl) {
      Alert.alert('Error', 'Product video not available for video preview');
      return;
    }

    setShowTryOnModal(false);

    try {
      // Update coin balance (deduct 25 coins for video face swap)
      setCoinBalance((prev) => prev - 25);

      // Also update user context
      if (userData) {
        setUserData({ ...userData, coin_balance: (userData.coin_balance || 0) - 25 });
      }

      // Initiate video face swap with PiAPI
      const response = await akoolService.initiateVideoFaceSwap({
        userImageUrl: userData.profilePhoto,
        productVideoUrl: productVideoUrl,
        userId: userData.id,
        productId: productId,
      });

      if (response.success && response.taskId) {
        startVideoFaceSwapPolling(productId, response.taskId);

        Toast.show({
          type: 'success',
          text1: 'Video Face Swap Started',
          text2:
            'Processing video (auto-resize/compression if needed). Using smart polling to track progress.',
        });
      } else {
        Alert.alert('Error', response.error || 'Failed to start video face swap');
      }
    } catch (error) {
      console.error('Error starting video face swap:', error);
      Alert.alert('Error', 'Failed to start video face swap. Please try again.');
    }
  };

  const startFaceSwapPolling = (productId: string, taskId: string) => {
    let pollCount = 0;
    const maxPollAttempts = 60; // 5 minutes timeout (60 * 5 seconds)

    const interval = setInterval(async () => {
      try {
        pollCount++;
        console.log(`[ProductDetails] Polling attempt ${pollCount}/${maxPollAttempts}`);

        const status = await piAPIVirtualTryOnService.checkTaskStatus(taskId);

        if (status.status === 'completed' && status.resultImages) {
          clearInterval(interval);

          // Save results permanently
          // if (userData?.id) {
          //   await akoolService.saveFaceSwapResults(userData.id, productId, status.resultImages);
          // }

          // Add product to preview
          // Prefer API-rendered image first
          const orderedImages = (status.resultImages || []).sort((a, b) => {
            const aApi = /theapi\.app/i.test(a) ? 0 : 1;
            const bApi = /theapi\.app/i.test(b) ? 0 : 1;
            return aApi - bApi;
          });

          const personalizedProduct = {
            id: `virtual_tryon_${productId}_${Date.now()}`,
            name: productData.name,
            description: `Face Swap: ${productData.name} - See how it looks on you`,
            price: 0,
            image_urls: orderedImages,
            video_urls: [],
            featured_type: 'virtual_tryon',
            category: productData.category,
            stock_quantity: 1,
            variants: [],
            isPersonalized: true,
            originalProductImage: productData.image_urls?.[0] || productData.image || '',
            faceSwapDate: new Date().toISOString(),
            originalProductId: productId,
          };
          addToPreview(personalizedProduct);

          // Toast.show({
          //   type: 'success',
          //   text1: 'Preview Ready!',
          //   text2: 'Your personalized product has been added to Your Preview.',
          // });
          // Show custom modal instead of Alert
          setShowTryOnCompleteModal(true);
        } else if (status.status === 'failed') {
          clearInterval(interval);
          Alert.alert('Error', status.error || 'Face swap failed. Please try again.');
        } else if (pollCount >= maxPollAttempts) {
          // Timeout after 5 minutes
          clearInterval(interval);
          console.warn('[ProductDetails] Face swap polling timeout');
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

  const startVideoFaceSwapPolling = (productId: string, taskId: string) => {
    let pollCount = 0;
    const maxPollAttempts = 120; // 10 minutes timeout for video (120 * 5 seconds) - videos take longer

    const interval = setInterval(async () => {
      try {
        pollCount++;
        console.log(`[ProductDetails] Video polling attempt ${pollCount}/${maxPollAttempts}`);

        const status = await akoolService.checkTaskStatus(taskId);

        if (status.status === 'completed' && status.resultVideo) {
          clearInterval(interval);

          // Save results permanently (store video URL in result_images array)
          if (userData?.id) {
            await akoolService.saveFaceSwapResults(userData.id, productId, [status.resultVideo]);
          }

          // Add video product to preview
          const personalizedProduct = {
            id: `personalized_video_${productId}_${Date.now()}`,
            name: `${productData.name} (Video Preview)`,
            description: `Personalized video of ${productData.name} with your face`,
            price: 0,
            image_urls: [], // No images for video preview
            video_urls: [status.resultVideo],
            featured_type: 'personalized',
            category: productData.category,
            stock_quantity: 1,
            variants: [],
            isPersonalized: true,
            isVideoPreview: true,
            originalProductImage: productData.image_urls?.[0] || productData.image || '', // Required by PreviewProduct
            originalProductVideo: status.resultVideo,
            faceSwapDate: new Date().toISOString(),
            originalProductId: productId,
          };
          addToPreview(personalizedProduct);

          Toast.show({
            type: 'success',
            text1: 'Video Preview Ready!',
            text2: 'Your personalized video has been added to Your Preview.',
          });
        } else if (status.status === 'failed') {
          clearInterval(interval);
          Alert.alert('Error', status.error || 'Video face swap failed. Please try again.');
        } else if (pollCount >= maxPollAttempts) {
          // Timeout after 10 minutes
          clearInterval(interval);
          console.warn('[ProductDetails] Video face swap polling timeout');
          Alert.alert(
            'Processing Timeout',
            'Video face swap is taking longer than expected. Video processing can take up to 10 minutes. Please try again later or contact support if the issue persists.'
          );
        }
      } catch (error) {
        console.error('Error checking video face swap status:', error);
        if (pollCount >= maxPollAttempts) {
          clearInterval(interval);
        }
      }
    }, 5000); // Poll every 5 seconds
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${productData.name}\n${productData.description}\n${productData.image}`,
        url: productData.image,
        title: productData.name,
      });
    } catch (error) {
      // Optionally handle error
    }
  };

  // Get available quantity for selected combination
  const getAvailableQuantity = () => {
    if (!selectedVariant) return 0;
    return selectedVariant.quantity;
  };

  const handleImagePress = useCallback((index: number) => {
    setCurrentImageIndex(index);
  }, []);

  // Pre-load all images for faster switching
  const [imageLoadingStates, setImageLoadingStates] = useState<{ [key: string]: boolean }>({});

  // Cache for processed image URLs to avoid repeated conversions
  const processedImageCache = useRef<{ [key: string]: string[] }>({});

  // Memoized image component to prevent unnecessary re-renders
  const MemoizedImage = useMemo(() => {
    return (
      <Image
        source={{ uri: productImages[currentImageIndex] }}
        style={styles.productImage}
        resizeMode="cover"
        fadeDuration={0}
        onLoadStart={() =>
          setImageLoadingStates((prev) => ({ ...prev, [currentImageIndex]: true }))
        }
        onLoad={() => setImageLoadingStates((prev) => ({ ...prev, [currentImageIndex]: false }))}
        onError={() => setImageLoadingStates((prev) => ({ ...prev, [currentImageIndex]: false }))}
      />
    );
  }, [productImages[currentImageIndex], currentImageIndex]);

  const nextImage = useCallback(() => {
    if (currentImageIndex < mediaItems.length - 1) {
      setCurrentImageIndex((prev) => prev + 1);
    }
  }, [currentImageIndex, mediaItems.length]);

  const previousImage = useCallback(() => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex((prev) => prev - 1);
    }
  }, [currentImageIndex]);

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

  // Share handlers
  const handleSharePress = () => {
    setShareModalVisible(true);
  };

  const shareUrl = mediaItems[currentImageIndex]?.url || productData.image;
  const shareText = `${productData.name}\n${productData.description}\n${shareUrl}`;

  const shareOnWhatsApp = () => {
    const url = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
    Linking.openURL(url).catch(() => {
      ToastAndroid.show('WhatsApp not installed', ToastAndroid.SHORT);
    });
    setShareModalVisible(false);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Ionicons
        key={index}
        name={index < rating ? 'star' : 'star-outline'}
        size={16}
        color={index < rating ? '#FFD700' : '#B0B6BE'}
      />
    ));
  };

  // Calculate rating breakdown
  const calculateRatingBreakdown = () => {
    const breakdown = {
      5: 0, // Very Good
      4: 0, // Good
      3: 0, // Ok-Ok
      2: 0, // Bad
      1: 0  // Very Bad
    };

    reviews.forEach(review => {
      breakdown[review.rating as keyof typeof breakdown]++;
    });

    return breakdown;
  };

  const renderRatingBreakdown = () => {
    const breakdown = calculateRatingBreakdown();

    return (
      <View style={styles.ratingBreakdownContainer}>
        {[5, 4, 3, 2, 1].map(rating => {
          const count = breakdown[rating as keyof typeof breakdown];
          const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
          const isSelected = selectedRatingFilter === rating;

          return (
            <TouchableOpacity
              key={rating}
              style={[
                styles.ratingBreakdownRow,
                isSelected && styles.ratingBreakdownRowSelected
              ]}
              onPress={() => {
                if (selectedRatingFilter === rating) {
                  // If already selected, clear the filter
                  setSelectedRatingFilter(null);
                } else {
                  // Select this rating filter
                  setSelectedRatingFilter(rating);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.ratingBreakdownNumber,
                isSelected && styles.ratingBreakdownNumberSelected
              ]}>
                {rating}
              </Text>
              <Ionicons
                name="star"
                size={14}
                color={isSelected ? "#FF9500" : "#fcc026"}
                style={{ marginLeft: 4 }}
              />
              <View style={styles.ratingBreakdownBarContainer}>
                <View
                  style={[
                    styles.ratingBreakdownBar,
                    {
                      width: `${percentage}%`,
                      backgroundColor: isSelected ? '#FF9500' : '#FF9500'
                    }
                  ]}
                />
              </View>
              <Text style={[
                styles.ratingBreakdownCount,
                isSelected && styles.ratingBreakdownCountSelected
              ]}>
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const confirmReportReview = async () => {
    if (!reportingReviewId) return;

    try {
      // In a real app, you would make an API call here to report the review
      // await supabase.from('review_reports').insert({
      //   review_id: reportingReviewId,
      //   user_id: userData?.id,
      //   reason: 'Inappropriate content',
      //   reported_at: new Date().toISOString()
      // });

      Toast.show({
        type: 'success',
        text1: 'Review reported',
        text2: 'Thank you for your feedback',
        position: 'top',
      });

      setShowReportModal(false);
      setReportingReviewId(null);
    } catch (error) {
      console.error('Error reporting review:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to report',
        text2: 'Please try again',
        position: 'top',
      });
    }
  };

  // Function to scroll to reviews section
  const scrollToReviews = () => {
    // First set the active tab to reviews
    setActiveTab('reviews');

    // Then scroll to the reviews section after a short delay to ensure tab is active
    setTimeout(() => {
      if (scrollViewRef.current && contentHeight > 0) {
        // Calculate position to scroll to (approximately 70% down the content)
        const targetY = contentHeight * 0.7;
        scrollViewRef.current.scrollTo({
          y: targetY,
          animated: true
        });
      } else if (scrollViewRef.current) {
        // Fallback: scroll to end
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
    }, 400);
  };

  const renderReview = (review: any) => {
    const getRatingText = (rating: number) => {
      if (rating >= 5) return 'Very Good';
      if (rating >= 4) return 'Good';
      if (rating >= 3) return 'Ok-Ok';
      if (rating >= 2) return 'Bad';
      return 'Very Bad';
    };

    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) return 'Posted 1 day ago';
      if (diffDays < 7) return `Posted ${diffDays} days ago`;
      return `Posted on ${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    };

    const getHelpfulCount = () => {
      // Random helpful count for demo - in real app this would come from database
      return Math.floor(Math.random() * 10);
    };

    const helpfulCount = getHelpfulCount();

    // Review interaction handlers
    const handleHelpfulVote = async (reviewId: string) => {
      try {
        const isCurrentlyHelpful = helpfulVotes[reviewId];
        const newHelpfulState = !isCurrentlyHelpful;

        // Update local state
        setHelpfulVotes(prev => ({
          ...prev,
          [reviewId]: newHelpfulState
        }));

        // In a real app, you would make an API call here to save the vote
        // await supabase.from('review_helpful_votes').upsert({
        //   review_id: reviewId,
        //   user_id: userData?.id,
        //   is_helpful: newHelpfulState
        // });

        // Show feedback
        Toast.show({
          type: 'success',
          text1: newHelpfulState ? 'Marked as helpful!' : 'Removed helpful vote',
          position: 'top',
        });
      } catch (error) {
        console.error('Error voting on review:', error);
        Toast.show({
          type: 'error',
          text1: 'Failed to vote',
          text2: 'Please try again',
          position: 'top',
        });
      }
    };

    const handleShareReview = async (review: any) => {
      try {
        const shareMessage = `Check out this review by ${review.reviewer_name || 'Only2U User'}:\n\n"${review.comment}"\n\nRating: ${review.rating}/5 stars`;

        await Share.share({
          message: shareMessage,
          title: 'Product Review',
        });
      } catch (error) {
        console.error('Error sharing review:', error);
      }
    };

    const handleReportReview = (reviewId: string) => {
      setReportingReviewId(reviewId);
      setShowReportModal(true);
    };


    return (
      <View key={review.id} style={styles.reviewCard}>
        {/* Reviewer Info - Gray Avatar + Name */}
        <View style={styles.reviewerInfoContainerNew}>
          <View style={styles.reviewerAvatarContainer}>
            <View style={styles.reviewerAvatar}>
              <Ionicons name="person" size={18} color="#999" />
            </View>
          </View>
          <Text style={styles.reviewerNameNew}>
            {review.reviewer_name || 'Nice'}
          </Text>
        </View>

        {/* Orange Stars */}
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Ionicons
              key={star}
              name="star"
              size={16}
              color="#FF9500"
              style={styles.star}
            />
          ))}
          <Text style={styles.verifiedPurchaseText}>Verified Purchase</Text>
        </View>

        {/* Review Title - Large and Bold */}
        <Text style={styles.reviewTitleBold}>
          {review.comment || 'Very beautiful and cloth quality superb!'}
        </Text>

        {/* Review Metadata */}
        <Text style={styles.reviewMetadataText}>
          Reviewed in India on {formatDate(review.created_at)}
        </Text>

        {/* Product Specifications */}
        <Text style={styles.productSpecsText}>
          Size: XL | Colour: Rani Pink
        </Text>

        {/* Review Images & Videos - Display horizontally */}
        {((review.review_images && review.review_images.length > 0) || (review.review_videos && review.review_videos.length > 0)) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.reviewMediaScrollContainer}
            contentContainerStyle={styles.reviewImagesContainer}
          >
            {/* Display Images */}
            {review.review_images && review.review_images.map((image: string, index: number) => (
              <TouchableOpacity
                key={`review-img-${index}`}
                style={styles.reviewImageWrapper}
                activeOpacity={0.8}
                onPress={() => {
                  const reviewMedia = [
                    ...(review.review_images || []).map((img: string) => ({ type: 'image' as const, url: img })),
                    ...(review.review_videos || []).map((vid: string) => ({ type: 'video' as const, url: vid })),
                  ];
                  setReviewMediaItems(reviewMedia);
                  setReviewMediaIndex(index);
                  setShowReviewMediaViewer(true);
                }}
              >
                <Image
                  source={{ uri: image }}
                  style={styles.reviewImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}

            {/* Display Videos */}
            {review.review_videos && review.review_videos.map((video: string, idx: number) => {
              const reviewMedia = [
                ...(review.review_images || []).map((img: string) => ({ type: 'image' as const, url: img })),
                ...(review.review_videos || []).map((vid: string) => ({ type: 'video' as const, url: vid })),
              ];
              const videoIndex = (review.review_images?.length || 0) + idx;
              const thumbnailUri = videoThumbnails[video] || VIDEO_THUMB_PLACEHOLDER;

              return (
                <TouchableOpacity
                  key={`review-vid-${idx}`}
                  style={styles.reviewImageWrapper}
                  activeOpacity={0.8}
                  onPress={() => {
                    setReviewMediaItems(reviewMedia);
                    setReviewMediaIndex(videoIndex);
                    setShowReviewMediaViewer(true);
                  }}
                >
                  <View style={styles.reviewVideoContainer}>
                    <Image
                      source={{ uri: thumbnailUri }}
                      style={styles.reviewImage}
                      resizeMode="cover"
                      onError={(e) => {
                        console.error('[ProductDetails] Thumbnail image load error:', e.nativeEvent.error);
                      }}
                    />
                    <View style={styles.reviewVideoOverlay}>
                      <Ionicons name="play-circle" size={32} color="rgba(255, 255, 255, 0.95)" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Additional Review Comment */}
        <View style={styles.additionalCommentContainer}>
          <Text style={styles.additionalCommentText}>
            Very Very nice suit
          </Text>
        </View>

        {/* Helpfulness Indicator */}
        <Text style={styles.helpfulnessText}>
          {helpfulCount} people found this helpful
        </Text>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.helpfulButtonNew}
            onPress={() => handleHelpfulVote(review.id)}
          >
            <Text style={styles.helpfulButtonTextNew}>Helpful</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareButtonNew}
            onPress={() => handleShareReview(review)}
          >
            <Ionicons name="share-outline" size={14} color="#333" />
            <Text style={styles.shareButtonTextNew}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.reportButtonNew}
            onPress={() => handleReportReview(review.id)}
          >
            <Text style={styles.reportButtonTextNew}>Report</Text>
          </TouchableOpacity>
        </View>

        {/* Replacement Policy Modal */}
        {replacementPolicyVisible && (
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.35)',
              zIndex: 99999,
            }}
          >
            <View
              style={{
                width: '88%',
                maxHeight: '80%',
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 16,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#222' }}>
                  Replacement Policy
                </Text>
                <TouchableOpacity onPress={() => setReplacementPolicyVisible(false)}>
                  <Ionicons name="close" size={22} color="#333" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={true} style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 8 }}>
                  ✅ Conditions for Replacement:
                </Text>
                <Text style={{ color: '#333', marginBottom: 10 }}>
                  1. Unboxing Video Required – Customers must record a clear video while opening the
                  parcel, showing the product from start to finish.
                </Text>
                <Text style={{ color: '#333', marginBottom: 10 }}>
                  2. Dress Condition – The item must be unused, in good condition, and with the
                  original tag intact.
                </Text>
                <Text style={{ color: '#333', marginBottom: 10 }}>
                  3. Size Replacement Option – If the fitting is not right, you can request a size
                  replacement (subject to availability).
                </Text>
                <Text style={{ color: '#666', fontStyle: 'italic', marginBottom: 10 }}>
                  Note: Size replacement requests must also be made within 48 hours of receiving the
                  product.
                </Text>
                <Text style={{ color: '#333', marginBottom: 10 }}>
                  4. Report Within 48 Hours – All replacement requests (damaged/defective/size
                  issues) should be raised within 48 hours of delivery through the app.
                </Text>
                <Text style={{ color: '#333', marginBottom: 16 }}>
                  5. Original Packaging – Keep the dress in its original packaging until
                  replacement is confirmed.
                </Text>


                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 8 }}>
                  ⚡ How It Works:
                </Text>
                <Text style={{ color: '#333', marginBottom: 10 }}>
                  1. Upload your unboxing video in the My Orders section and request a replacement.
                </Text>
                <Text style={{ color: '#333', marginBottom: 10 }}>
                  2. Our team will verify and approve your request.
                </Text>
                <Text style={{ color: '#333', marginBottom: 16 }}>
                  3. A replacement product will be shipped to you at no extra cost.
                </Text>
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderImageGallery = () => {
    if (mediaItems.length === 0) {
      return (
        <View style={styles.imageContainer}>
          <View style={styles.noImagePlaceholder}>
            <Ionicons name="image-outline" size={64} color="#ccc" />
            <Text style={styles.noImageText}>{t('no_images_available')}</Text>
          </View>
          <TouchableOpacity style={styles.floatingBackButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
        </View>
      );
    }

    const currentMedia = mediaItems[currentImageIndex];
    const videoState = videoStates[currentImageIndex] || { isPlaying: true, isMuted: false };

    return (
      <View style={styles.imageContainer}>
        {/* Main Media (Image or Video) */}
        {currentMedia.type === 'video' ? (
          <TouchableOpacity
            activeOpacity={1}
            style={styles.videoContainer}
            onPress={() => handleVideoTap(currentImageIndex)}>
            <Video
              ref={(ref) => {
                if (ref) videoRefs.current[currentImageIndex] = ref;
              }}
              source={{ uri: currentMedia.url }}
              style={styles.videoBackground}
              resizeMode={ResizeMode.COVER}
              shouldPlay={videoState.isPlaying && isFocused}
              isLooping
              isMuted={videoState.isMuted}
              posterSource={{ uri: currentMedia.thumbnail }}
              posterStyle={{ resizeMode: 'cover' }}
              usePoster
              onError={(error) => {
                console.error('❌ Video error for index:', currentImageIndex, error);
                console.error('❌ Video URL:', currentMedia.url);
              }}
              onLoad={() => {
                console.log('✅ Video loaded for index:', currentImageIndex);
                console.log('✅ Video URL:', currentMedia.url);
              }}
            />

            {/* Video Controls Overlay */}
            <View style={styles.videoControlsOverlay}>
              <TouchableOpacity
                style={styles.videoControlButton}
                onPress={() => togglePlay(currentImageIndex)}>
                <Ionicons name={videoState.isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.videoControlButton}
                onPress={() => toggleMute(currentImageIndex)}>
                <Ionicons
                  name={videoState.isMuted ? 'volume-mute' : 'volume-high'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ) : (
          <>
            {/* Loading Indicator for Images - Show before image loads */}
            {imageLoadingStates[currentImageIndex] && (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator size="large" color="#F53F7A" />
              </View>
            )}
            
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={() => {
                openFullScreen('image', currentImageIndex);
              }}
              style={styles.productImageTouchable}
            >
              {currentMedia.url && 
               !currentMedia.url.includes('placeholder') && 
               !currentMedia.url.includes('placehold') &&
               !currentMedia.url.includes('via.placeholder') &&
               !currentMedia.url.includes('unsplash.com/photo-1610030469983') ? (
                <Image
                  source={{ uri: currentMedia.url }}
                  style={styles.productImage}
                  resizeMode="cover"
                  fadeDuration={0}
                  onLoadStart={() =>
                    setImageLoadingStates((prev) => ({ ...prev, [currentImageIndex]: true }))
                  }
                  onLoad={() =>
                    setImageLoadingStates((prev) => ({ ...prev, [currentImageIndex]: false }))
                  }
                  onError={() =>
                    setImageLoadingStates((prev) => ({ ...prev, [currentImageIndex]: false }))
                  }
                />
              ) : (
                <View style={[styles.productImage, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
                  {imageLoadingStates[currentImageIndex] ? (
                    <ActivityIndicator size="large" color="#F53F7A" />
                  ) : (
                    <Ionicons name="image-outline" size={64} color="#ccc" />
                  )}
                </View>
              )}
              {/* Rating Badge (on image) - Clickable */}
              <TouchableOpacity
                style={styles.expandHint}
                onPress={scrollToReviews}
                activeOpacity={0.8}
              >
                <Text style={styles.ratingBadgeText}>
                  {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
                </Text>
                <Ionicons name="star" size={13} color="#FFD700" />
                <Text style={styles.ratingCountText}>
                  {totalReviews > 0
                    ? totalReviews > 1000
                      ? `${(totalReviews / 1000).toFixed(1)}k`
                      : totalReviews.toString()
                    : '0'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </>
        )}

        {/* Navigation Arrows */}
        {mediaItems.length > 1 && (
          <>
            <TouchableOpacity
              style={[styles.navArrow, styles.leftArrow]}
              onPress={previousImage}
              disabled={currentImageIndex === 0}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navArrow, styles.rightArrow]}
              onPress={nextImage}
              disabled={currentImageIndex === mediaItems.length - 1}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        )}



        {/* Personalized Badge for face-swapped products */}
        {(productData as any).isPersonalized && (
          <View style={styles.personalizedBadge}>
            <Ionicons name="person" size={16} color="#fff" />
            <Text style={styles.personalizedBadgeText}>Personalized</Text>
          </View>
        )}

        {/* Media Dots Indicator (inside image, absolute bottom center) */}
        {mediaItems.length > 1 && (
          <View style={styles.imageDotsOverlay}>
            {mediaItems.map((media, idx) => (
              <View
                key={idx}
                style={[styles.imageDot, idx === currentImageIndex && styles.activeImageDot]}>
                {media.type === 'video' && (
                  <Ionicons name="play" size={8} color="#fff" style={styles.mediaTypeIcon} />
                )}
              </View>
            ))}
          </View>
        )}

        {/* Wishlist Icon */}
        <TouchableOpacity
          style={styles.wishlistButton}
          onPress={async () => {
            if (heartLoading) return; // Prevent rapid clicks

            setHeartLoading(true);

            try {
              if (isInWishlist(productData.id.toString())) {
                // Show collection sheet to manually remove from collections
                setSelectedProduct({
                  id: productData.id,
                  name: productData.name,
                  description: productData.description,
                  price: selectedVariant?.price || productData.price,
                  image_urls: productImages,
                  video_urls: productData.video_urls || [],
                  featured_type: productData.featured ? 'trending' : undefined,
                  category: productData.category,
                  stock_quantity: getAvailableQuantity(),
                  variants: variants,
                  selectedColor: selectedColor || null,
                  selectedSize: selectedSize || null,
                });
                setShowCollectionSheet(true);
              } else {
                // Add to "All" collection first
                const success = await addToAllCollection();
                if (success) {
                  // Set product data first
                  const productForSheet = {
                    id: productData.id,
                    name: productData.name,
                    description: productData.description,
                    price: selectedVariant?.price || productData.price,
                    image_urls: productImages,
                    video_urls: productData.video_urls || [],
                    featured_type: productData.featured ? 'trending' : undefined,
                    category: productData.category,
                    stock_quantity: getAvailableQuantity(),
                    variants: variants,
                    selectedColor: selectedColor || null,
                    selectedSize: selectedSize || null,
                  };

                  setSelectedProduct(productForSheet);

                  // Use a small delay to ensure state is updated before opening sheet
                  setTimeout(() => {
                    setShowCollectionSheet(true);
                  }, 100);
                }
              }
            } finally {
              setHeartLoading(false);
            }
          }}
          activeOpacity={0.7}
          disabled={heartLoading}>
          <Ionicons
            name={isInWishlist(productData.id.toString()) ? 'heart' : 'heart-outline'}
            size={24}
            color={isInWishlist(productData.id.toString()) ? '#F53F7A' : '#333'}
          />
        </TouchableOpacity>

        {/* Full View Button (under wishlist) */}
        <TouchableOpacity
          style={styles.fullViewButton}
          onPress={() => openFullScreen(currentMedia.type, currentImageIndex)}
          activeOpacity={0.7}
        >
          <Ionicons name="search-outline" size={20} color="#333" />
        </TouchableOpacity>

        {/* Floating Buttons */}
        <TouchableOpacity style={styles.floatingBackButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        {/* <TouchableOpacity style={styles.shareButton} onPress={handleSharePress}>
          <Ionicons name="share-outline" size={24} color="#333" />
        </TouchableOpacity> */}
      </View>
    );
  };


  const renderImageThumbnails = () => {
    if (mediaItems.length <= 1) return null;

    return (
      <View style={styles.thumbnailsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          scrollEventThrottle={16}
          overScrollMode="never"
          contentContainerStyle={{ paddingHorizontal: 2 }}>
          {mediaItems.map((media, index) => (
            <TouchableOpacity
              key={`thumb-${index}-${media.url}`}
              style={[styles.thumbnail, currentImageIndex === index && styles.selectedThumbnail]}
              onPress={() => handleImagePress(index)}>
              <Image
                source={{ uri: media.type === 'video' ? media.thumbnail || media.url : media.url }}
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

  return (
    <View style={styles.container}>
      {/* Fixed Header - Dashboard style */}
      <View style={styles.header}>
        <View style={styles.statusBarSpacer} />
        <View style={styles.headerContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Only2ULogo size="medium" />
            {productData.category ? (
              <>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#888"
                  style={{ marginHorizontal: 2 }}
                />
                <Text style={styles.categoryName}>{productData.category}</Text>
              </>
            ) : null}
          </View>
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
              onPress={() => navigation.navigate('Profile')}>
              {userData?.profilePhoto ? (
                <Image source={{ uri: userData.profilePhoto }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person-outline" size={16} color="#333" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={(contentWidth, contentHeight) => {
            setContentHeight(contentHeight);
          }}>
          {renderImageGallery()}

          {/* Product Info */}
          <View style={styles.productInfo}>
            {/* Vendor Info */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.vendorInfoRow,
                (!vendorProfile || isPersonalizedProduct) && styles.vendorInfoRowDisabled,
              ]}
              onPress={handleVendorPress}
              disabled={!vendorProfile || isPersonalizedProduct}
            >
              {vendorProfile?.profile_image_url ? (
                <Image
                  source={{ uri: vendorProfile.profile_image_url }}
                  style={styles.vendorAvatar}
                />
              ) : (
                <View style={styles.vendorAvatarPlaceholder}>
                  <Ionicons name="storefront-outline" size={18} color="#F53F7A" />
                </View>
              )}
              <View style={styles.vendorTextContainer}>
                <Text
                  style={[
                    styles.vendorNameLink,
                    (!vendorProfile || isPersonalizedProduct) && styles.vendorNameDisabled,
                  ]}
                  numberOfLines={2}
                >
                  {displayVendorName}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Vendor Name, Product Title and Share Button Row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <View style={styles.productTitleRow}>
                  <Text style={styles.productTitleText}>{productData.name}</Text>
                </View>
                {(productData as any).isPersonalized && (productData as any).faceSwapDate && (
                  <Text style={styles.personalizedDate}>
                    Created on {new Date((productData as any).faceSwapDate).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <TouchableOpacity style={styles.shareButton} onPress={handleSharePress}>
                <AntDesign name="sharealt" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Price */}
            <View style={styles.priceContainer}>
              {(() => {
                // Get the variant to use for price (selected variant or first variant)
                const variantToUse = selectedVariant || (variants.length > 0 ? variants[0] : null);
                
                // Use rsp_price or mrp_price from variant if available, otherwise use price
                const displayPrice = variantToUse?.rsp_price || variantToUse?.mrp_price || variantToUse?.price || productData.price || 0;
                const mrpPrice = variantToUse?.mrp_price || productData.originalPrice || 0;
                const discount = variantToUse?.discount_percentage || productData.discount || 0;
                const calculatedDiscount = mrpPrice > 0 && displayPrice < mrpPrice 
                  ? Math.round(((mrpPrice - displayPrice) / mrpPrice) * 100)
                  : discount;
                
                // Only show price if it's greater than 0
                if (displayPrice <= 0) {
                  return (
                    <Text style={styles.price}>Price not available</Text>
                  );
                }
                
                return (
                  <>
                    <Text style={styles.price}>
                      ₹{Math.round(displayPrice)}
                    </Text>
                    {mrpPrice > 0 && mrpPrice > displayPrice && (
                      <Text style={styles.originalPrice}>
                        MRP ₹{Math.round(mrpPrice)}
                      </Text>
                    )}
                    {calculatedDiscount > 0 && (
                      <Text style={styles.discount}>({calculatedDiscount}% OFF)</Text>
                    )}
                  </>
                );
              })()}
            </View>

            {/* Size Selection */}
            {availableSizes.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('select_size')}</Text>
                </View>
                <View style={styles.sizesContainer}>{availableSizes.map(renderSizeOption)}</View>
              </View>
            )}
            {availableColors.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('select_color')}</Text>
                </View>
                <View style={styles.colorsContainer}>{availableColors.map(renderColorOption)}</View>
              </View>
            )}

            {/* Quantity */}
            {/* <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>
              {t('quantity')} ({t('stock')}: {getAvailableQuantity()})
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10 }}>
              <TouchableOpacity
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                style={{ opacity: quantity <= 1 ? 0.5 : 1 }}>
                <Ionicons name="remove-circle-outline" size={28} color="#F53F7A" />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity
                onPress={() => setQuantity((q) => Math.min(getAvailableQuantity(), q + 1))}
                disabled={quantity >= getAvailableQuantity()}
                style={{ opacity: quantity >= getAvailableQuantity() ? 0.5 : 1 }}>
                <Ionicons name="add-circle-outline" size={28} color="#F53F7A" />
              </TouchableOpacity>
            </View>
          </View> */}

            {/* Tabs */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'details' && styles.activeTab]}
                onPress={() => setActiveTab('details')}>
                <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>
                  {t('product_details')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'reviews' && styles.activeTab]}
                onPress={() => setActiveTab('reviews')}>
                <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>
                  {t('reviews')} ({totalReviews})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab Content */}
            {activeTab === 'details' && (
              <View style={styles.tabContent}>
                <Text style={styles.descriptionTitle}>{t('description')}</Text>
                <Text style={styles.descriptionText}>{productData.description}</Text>

                <View style={styles.sectionContainer}>
                  <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => setReplacementPolicyVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sectionTitle}>Replacement Policy</Text>
                    <Ionicons name="add" size={22} color="#F53F7A" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === 'reviews' && (
              <View style={styles.tabContent}>
                {reviewsLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#F53F7A" />
                    <Text style={styles.loadingText}>{t('loading_reviews')}</Text>
                  </View>
                ) : reviews.length > 0 ? (
                  <View>
                    {/* Overall Rating Summary */}
                    <View style={styles.overallRatingSummary}>
                      <View style={styles.ratingLeftSection}>
                        <Text style={styles.overallRatingNumber}>{averageRating.toFixed(1)}</Text>
                        <Ionicons name="star" size={24} color="#fcc026" />
                        <View style={styles.ratingStats}>
                          <Text style={styles.overallRatingCountText}>{totalReviews} ratings</Text>
                          <Text style={styles.overallReviewCountText}>{totalReviews} reviews</Text>
                        </View>
                      </View>

                      {/* Filter Controls */}
                      <View style={styles.filterControlsContainer}>
                        {selectedRatingFilter && (
                          <View style={styles.activeFilterContainer}>
                            <Text style={styles.activeFilterText}>
                              Showing {selectedRatingFilter}-star reviews only
                            </Text>
                            <TouchableOpacity
                              style={styles.clearFilterButton}
                              onPress={() => setSelectedRatingFilter(null)}
                            >
                              <Text style={styles.clearFilterText}>Clear</Text>
                              <Ionicons name="close-circle" size={16} color="#F53F7A" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      <View style={styles.ratingBreakdown}>
                        {renderRatingBreakdown()}
                      </View>
                    </View>

                    {/* All Review Media Section */}
                    {(() => {
                      const allImages = reviews.flatMap(r => r.review_images || []);
                      const allVideos = reviews.flatMap(r => r.review_videos || []);
                      const hasMedia = allImages.length > 0 || allVideos.length > 0;

                      if (!hasMedia) return null;

                      // Combine all media items
                      const allMedia = [
                        ...allImages.map(img => ({ type: 'image' as const, url: img })),
                        ...allVideos.map(vid => ({ type: 'video' as const, url: vid }))
                      ];

                      return (
                        <View style={styles.allReviewMediaSection}>
                          <Text style={styles.allReviewMediaTitle}>
                            Customer Photos & Videos ({allImages.length + allVideos.length})
                          </Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.allReviewMediaScroll}
                          >
                            {/* Display all images */}
                            {allImages.map((image: string, index: number) => (
                              <TouchableOpacity
                                key={`all-img-${index}`}
                                activeOpacity={0.8}
                                onPress={() => {
                                  setReviewMediaItems(allMedia);
                                  setReviewMediaIndex(index);
                                  setShowReviewMediaViewer(true);
                                }}
                              >
                                <Image
                                  source={{ uri: image }}
                                  style={styles.allReviewMediaItem}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            ))}

                            {/* Display all videos with thumbnail */}
                            {allVideos.map((video: string, index: number) => (
                              <TouchableOpacity
                                key={`all-vid-${index}`}
                                style={styles.allReviewVideoContainer}
                                activeOpacity={0.8}
                                onPress={() => {
                                  setReviewMediaItems(allMedia);
                                  setReviewMediaIndex(allImages.length + index);
                                  setShowReviewMediaViewer(true);
                                }}
                              >
                                <Image
                                  source={{ uri: videoThumbnails[video] || video }}
                                  style={styles.allReviewMediaItem}
                                  resizeMode="cover"
                                  onError={() => setFailedVideoThumbs(prev => ({ ...prev, [video]: true }))}
                                />
                                <View style={styles.allReviewVideoOverlay}>
                                  <Ionicons name="play-circle" size={32} color="rgba(255, 255, 255, 0.95)" />
                                </View>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      );
                    })()}

                    {/* Reviews List - Show only first 5, with rating filter */}
                    <View style={styles.reviewsList}>
                      {(() => {
                        // Filter reviews by selected rating if any
                        const filteredReviews = selectedRatingFilter
                          ? reviews.filter(review => review.rating === selectedRatingFilter)
                          : reviews;

                        // Show only first 5 of filtered reviews
                        return filteredReviews.slice(0, 5).map(renderReview);
                      })()}
                    </View>

                    {/* Show More Button */}
                    {(() => {
                      const filteredReviews = selectedRatingFilter
                        ? reviews.filter(review => review.rating === selectedRatingFilter)
                        : reviews;

                      return filteredReviews.length > 5 && (
                        <TouchableOpacity
                          style={styles.showMoreReviewsButton}
                          onPress={() => {
                            (navigation as any).navigate('AllReviews', {
                              productId: productData.id,
                              productName: productData.name,
                              averageRating,
                              totalReviews: selectedRatingFilter ? filteredReviews.length : totalReviews,
                              reviews: filteredReviews,
                            });
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.showMoreReviewsText}>
                            Show All {selectedRatingFilter ? `${filteredReviews.length} ${selectedRatingFilter}-Star` : reviews.length} Reviews
                          </Text>
                          <Ionicons name="chevron-forward" size={20} color="#F53F7A" />
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                ) : (
                  <View style={styles.noReviewsContainer}>
                    <Ionicons name="chatbubble-outline" size={48} color="#ccc" />
                    <Text style={styles.noReviewsText}>{t('no_reviews_yet')}</Text>
                    <Text style={styles.noReviewsSubtext}>{t('be_first_to_review')}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
          {/* Bottom Bar with improved layout */}
          <View style={styles.bottomBar}>
            {!(productData as any).isPersonalized ? (
              <>
                {/* Top row: Try On and Add to Cart buttons */}
                <View style={styles.topButtonRow}>
                  <TouchableOpacity
                    style={styles.tryOnButton}
                    onPress={handleTryOnButtonPress}>
                    <Ionicons name="camera" size={20} color="#F53F7A" style={{ marginRight: 8 }} />
                    <Text style={styles.tryOnButtonText}>{t('try_on')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.addToCartButton,
                      { opacity: getAvailableQuantity() === 0 ? 0.5 : 1 },
                    ]}
                    onPress={handleAddToCart}
                    disabled={getAvailableQuantity() === 0 || addToCartLoading}>
                    <Ionicons name="cart-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.addToCartButtonText}>
                      {addToCartLoading ? t('adding') : t('add_to_cart')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Bottom row: Resell button (full width) */}
                {userData?.id && (
                  <TouchableOpacity
                    style={styles.resellButtonFull}
                    onPress={handleResellButtonPress}>
                    <Ionicons name="storefront" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.resellButtonFullText}>Resell</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                {/* Top row for personalized products */}
                <View style={styles.topButtonRow}>
                  <TouchableOpacity
                    style={[styles.addToCartButton, { backgroundColor: '#4CAF50' }]}
                    onPress={() => {
                      Alert.alert(
                        'Personalized Product',
                        'This is a preview product and cannot be added to cart.'
                      );
                    }}>
                    <Ionicons
                      name="information-circle"
                      size={20}
                      color="#fff"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.addToCartButtonText}>Preview Only</Text>
                  </TouchableOpacity>

                  {/* Resell Button for personalized products */}
                  {userData?.id && (
                    <TouchableOpacity
                      style={styles.resellButton}
                      onPress={handleResellButtonPress}>
                      <Ionicons name="storefront" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.resellButtonText}>Resell</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Bottom row for personalized products */}
                <TouchableOpacity
                  style={styles.tryOnButtonFull}
                  onPress={() => {
                    Alert.alert(
                      'Personalized Product',
                      'This is already a personalized product with your face!'
                    );
                  }}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.tryOnButtonText}>Personalized</Text>
                </TouchableOpacity>
              </>
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
                      // Navigate to Products screen with same category
                      const categoryData = {
                        id: (productData as any).category_id || productData.category?.id,
                        name: productData.category?.name || 'Products'
                      };
                      (navigation as any).navigate('Products', { category: categoryData });
                    }}
                  >
                    <Text style={styles.seeMoreText}>See More</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View
                style={{ position: 'relative' }}
                onStartShouldSetResponderCapture={() => true}
                {...(Platform.OS === 'android' ? suggestionsPanResponder.panHandlers : {})}
              >
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  nestedScrollEnabled
                  scrollEventThrottle={16}
                  overScrollMode="never"
                  scrollEnabled
                  ref={(ref) => { (suggestionsListRef as any).current = ref; }}
                  onScroll={(e) => {
                    (suggestionsScrollOffsetRef as any).current = e.nativeEvent.contentOffset?.x || 0;
                  }}
                  data={suggestedProducts.slice(0, 10)}
                  keyExtractor={(item: any, index: number) => String(item.id || index)}
                  contentContainerStyle={styles.suggestionsListContent}
                  renderItem={({ item: p, index }) => {
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
                      <View style={styles.suggestionCard}>
                        <TouchableOpacity
                          onPress={() => {
                            // Replace current screen with new product details
                            navigation.replace('ProductDetails', {
                              product: p
                            });
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
                          onPress={(e) => {
                            e.stopPropagation();
                            // Add to cart with default variant
                            if (firstVariant) {
                              addToCart({
                                productId: p.id,
                                variantId: firstVariant.id,
                                name: p.name,
                                price: firstVariant.price || minRspPrice,
                                image: img,
                                image_urls: p.image_urls || (img ? [img] : []),
                                size: firstVariant.size?.name || 'One Size',
                                color: firstVariant.color?.name || 'Default',
                                quantity: 1,
                                stock: firstVariant.quantity || 0,
                                category: p.category?.name || '',
                                sku: p.sku || firstVariant.sku || p.id,
                                isReseller: false,
                              });
                              Toast.show({
                                type: 'success',
                                text1: 'Added to Cart',
                                text2: p.name,
                                position: 'top',
                              });
                            } else {
                              Toast.show({
                                type: 'error',
                                text1: 'Error',
                                text2: 'Product variant not available',
                                position: 'top',
                              });
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.suggestionAddButtonText}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                />
                {/* Arrow controls */}
                <TouchableOpacity
                  style={styles.suggestionsLeftArrow}
                  onPress={() => {
                    try {
                      (suggestionsListRef as any).current?.scrollToOffset?.({
                        offset: Math.max(0, ((suggestionsScrollOffsetRef as any).current || 0) - 180),
                        animated: true,
                      });
                      (suggestionsScrollOffsetRef as any).current = Math.max(0, ((suggestionsScrollOffsetRef as any).current || 0) - 180);
                    } catch { }
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-back" size={20} color="#111" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.suggestionsRightArrow}
                  onPress={() => {
                    try {
                      (suggestionsListRef as any).current?.scrollToOffset?.({
                        offset: (((suggestionsScrollOffsetRef as any).current || 0) + 180),
                        animated: true,
                      });
                      (suggestionsScrollOffsetRef as any).current = (((suggestionsScrollOffsetRef as any).current || 0) + 180);
                    } catch { }
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-forward" size={20} color="#111" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* SaveToCollectionSheet */}
      <SaveToCollectionSheet
        visible={showCollectionSheet}
        product={selectedProduct}
        onClose={() => {
          setShowCollectionSheet(false);
          setSelectedProduct(null);
        }}
        onSaved={(product: any, collectionName: any) => {
          // Show saved popup when product is successfully saved
          setSavedProductName(product.name);
          setShowSavedPopup(true);
          // Store collection name for display
          setSavedProductName(collectionName);
        }}
      />

      {shareModalVisible && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.3)',
            zIndex: 9999,
          }}>
          <View style={styles.akoolModal}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShareModalVisible(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <View style={styles.shareModalContent}>
              <TouchableOpacity style={styles.shareModalOption} onPress={shareOnWhatsApp}>
                <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                <Text style={styles.shareModalText}>Share on WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Replacement Policy Modal */}
      <Modal
        visible={replacementPolicyVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReplacementPolicyVisible(false)}
      >
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.35)',
          }}
        >
          <View
            style={{
              width: '88%',
              maxHeight: '80%',
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 16,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#222' }}>Replacement Policy</Text>
              <TouchableOpacity onPress={() => setReplacementPolicyVisible(false)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator style={{ marginTop: 4 }}>
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
      </Modal>

      {/* Report Review Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.reportModalOverlay}>
          <View style={styles.reportModalContainer}>
            <View style={styles.reportModalIconContainer}>
              <Ionicons name="flag" size={40} color="#FF6B6B" />
            </View>

            <Text style={styles.reportModalTitle}>Report Review</Text>
            <Text style={styles.reportModalMessage}>
              Are you sure you want to report this review? This will help us improve our content quality.
            </Text>

            <View style={styles.reportModalButtons}>
              <TouchableOpacity
                style={styles.reportModalCancelButton}
                onPress={() => {
                  setShowReportModal(false);
                  setReportingReviewId(null);
                }}
              >
                <Text style={styles.reportModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.reportModalConfirmButton}
                onPress={confirmReportReview}
              >
                <Text style={styles.reportModalConfirmText}>Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Try On Modal */}
      {/* Consent Modal (must accept before showing Try On) */}
      <Modal
        visible={showConsentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConsentModal(false)}
      >
        <View style={styles.consentOverlay}>
          <View style={styles.consentModal}>
            {/* Icon */}
            <View style={styles.consentIconCircle}>
              <Ionicons name="shield-checkmark" size={40} color="#F53F7A" />
            </View>

            {/* Title */}
            <Text style={styles.consentTitle}>Privacy & Consent</Text>

            {/* Content */}
            <View style={styles.consentContent}>
              <View style={styles.consentPoint}>
                <View style={styles.consentBullet}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                </View>
                <Text style={styles.consentPointText}>
                  I have the right to use this photo
                </Text>
              </View>

              <View style={styles.consentPoint}>
                <View style={styles.consentBullet}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                </View>
                <Text style={styles.consentPointText}>
                  I consent to AI processing for face swap
                </Text>
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

            {/* Buttons */}
            <View style={styles.consentButtons}>
              <TouchableOpacity
                style={styles.consentCancelButton}
                onPress={() => setShowConsentModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.consentCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.consentAgreeButton}
                onPress={() => {
                  if (!userData?.id) {
                    setShowConsentModal(false);
                    setShowTryOnModal(false);
                    setSelectedOption(null);
                    promptLoginForTryOn();
                    return;
                  }
                  setShowConsentModal(false);
                  setShowTryOnModal(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.consentAgreeText}>I Agree</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Try On Modal */}
      <Modal
        visible={showTryOnTutorialModal}
        transparent
        animationType="fade"
        onRequestClose={handleDismissTryOnTutorial}
      >
        <View style={styles.resellTutorialOverlay}>
          <View style={styles.resellTutorialCard}>
            <View style={styles.resellTutorialHeader}>
              <View style={styles.resellTutorialIcon}>
                <Ionicons name="sparkles-outline" size={22} color="#F53F7A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resellTutorialTitle}>Virtual Try-On Guide</Text>
                <Text style={styles.resellTutorialSubtitle}>
                  Learn how to preview outfits with your face and perfect size.
                </Text>
              </View>
              <TouchableOpacity onPress={handleDismissTryOnTutorial}>
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.resellTutorialVideoWrapper}>
              <Video
                source={{ uri: TRYON_TUTORIAL_VIDEO_URL }}
                style={styles.resellTutorialVideo}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                useNativeControls
                isLooping
              />
            </View>

            <Text style={styles.resellTutorialDescription}>
              Upload a clear photo, pick your size, and instantly preview outfits. Share your looks
              with friends or save them for later!
            </Text>

            <TouchableOpacity
              style={styles.resellTutorialCheckboxRow}
              onPress={() => setTryOnTutorialDontShowAgain(!tryOnTutorialDontShowAgain)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.resellTutorialCheckbox,
                  tryOnTutorialDontShowAgain && styles.resellTutorialCheckboxChecked,
                ]}
              >
                {tryOnTutorialDontShowAgain && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </View>
              <Text style={styles.resellTutorialCheckboxText}>Do not show again</Text>
            </TouchableOpacity>

            <View style={styles.resellTutorialActions}>
              <TouchableOpacity
                style={styles.resellTutorialSecondaryBtn}
                onPress={handleDismissTryOnTutorial}
              >
                <Text style={styles.resellTutorialSecondaryText}>Maybe later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resellTutorialPrimaryBtn}
                onPress={handleContinueTryOnTutorial}
              >
                <Text style={styles.resellTutorialPrimaryText}>Try it now</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showTryOnModal && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.3)',
            zIndex: 9999,
          }}>
          <View style={styles.akoolModal}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowTryOnModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.akoolTitle}>👗 Want to see how this outfit looks on you?</Text>
            <Text style={styles.akoolSubtitle}>Try on with Only2U Face Swap AI</Text>

            {/* Photo Preview Info */}
            <View style={styles.tryOnInfoCard}>
              <View style={styles.tryOnInfoHeader}>
                <Ionicons name="sparkles" size={20} color="#F53F7A" />
                <Text style={styles.tryOnInfoTitle}>Photo Face Swap</Text>
              </View>
              <Text style={styles.tryOnInfoDesc}>See how this outfit looks on you with AI-powered face swap</Text>
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

            <TouchableOpacity
              style={styles.akoolContinueBtn}
              onPress={() => {
                // Show initial success message
                Toast.show({
                  type: 'success',
                  text1: 'Face Swap Started',
                  text2: 'We will notify you once your preview is ready',
                });

                // Perform face swap directly
                handleVirtualTryOn();
              }}>
              <Text style={styles.akoolContinueText}>Start Face Swap</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ProfilePhotoRequiredModal
        visible={showProfilePhotoModal}
        title={profilePhotoModalTitle}
        description={profilePhotoModalContent.description}
        icon={profilePhotoModalContent.icon}
        dismissLabel="Maybe Later"
        uploadLabel="Upload Photo"
        onDismiss={() => {
          setShowProfilePhotoModal(false);
          setSelectedOption(null);
        }}
        onUpload={() => {
          setShowProfilePhotoModal(false);
          setSelectedOption(null);
          setShowPhotoPickerModal(true);
        }}
      />

      <Modal
        visible={showPhotoPickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!uploadingProfilePhoto) {
            setShowPhotoPickerModal(false);
          }
        }}
      >
        <View style={styles.photoPickerOverlay}>
          <TouchableOpacity
            style={styles.photoPickerBackdrop}
            activeOpacity={1}
            onPress={() => {
              if (!uploadingProfilePhoto) {
                setShowPhotoPickerModal(false);
              }
            }}
          />
          <View style={styles.photoPickerContent}>
            <View style={styles.photoPickerHandle} />

            <View style={styles.photoPickerHeader}>
              <Text style={styles.photoPickerTitle}>Upload Profile Photo</Text>
              <Text style={styles.photoPickerSubtitle}>
                Choose how you want to add your photo
              </Text>
              {uploadingProfilePhoto && (
                <View style={styles.photoPickerUploading}>
                  <ActivityIndicator size="small" color="#F53F7A" />
                  <Text style={styles.photoPickerUploadingText}>Uploading...</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.photoPickerOption,
                uploadingProfilePhoto && styles.photoPickerOptionDisabled,
              ]}
              onPress={takeProfilePhoto}
              activeOpacity={0.7}
              disabled={uploadingProfilePhoto}
            >
              <View style={styles.photoPickerOptionIcon}>
                <Ionicons name="camera" size={22} color="#fff" />
              </View>
              <View style={styles.photoPickerOptionTextContainer}>
                <Text style={styles.photoPickerOptionTitle}>Take Photo</Text>
                <Text style={styles.photoPickerOptionSubtitle}>
                  Use your camera to capture a new photo
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.photoPickerOption,
                uploadingProfilePhoto && styles.photoPickerOptionDisabled,
              ]}
              onPress={pickProfilePhotoFromGallery}
              activeOpacity={0.7}
              disabled={uploadingProfilePhoto}
            >
              <View style={styles.photoPickerOptionIcon}>
                <Ionicons name="images-outline" size={22} color="#fff" />
              </View>
              <View style={styles.photoPickerOptionTextContainer}>
                <Text style={styles.photoPickerOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.photoPickerOptionSubtitle}>
                  Select a photo from your library
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoPickerCancelButton}
              activeOpacity={0.7}
              onPress={() => {
                if (!uploadingProfilePhoto) {
                  setShowPhotoPickerModal(false);
                }
              }}
              disabled={uploadingProfilePhoto}
            >
              <Text style={styles.photoPickerCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={permissionModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closePermissionModal}
      >
        <View style={styles.permissionOverlay}>
          <View style={styles.permissionModal}>
            <View style={styles.permissionIconCircle}>
              <Ionicons
                name={permissionModal.context === 'camera' ? 'camera' : 'images'}
                size={28}
                color="#F53F7A"
              />
            </View>
            <Text style={styles.permissionTitle}>
              {permissionModal.context === 'camera'
                ? 'Camera Access Needed'
                : 'Photo Library Access Needed'}
            </Text>
            <Text style={styles.permissionBody}>
              {permissionModal.context === 'camera'
                ? 'Allow camera access to capture a new profile photo.'
                : 'Allow photo library access to choose a profile photo from your gallery.'}
            </Text>

            <View style={styles.permissionActions}>
              <TouchableOpacity
                style={styles.permissionSecondaryButton}
                onPress={closePermissionModal}
                activeOpacity={0.8}
              >
                <Text style={styles.permissionSecondaryText}>Not Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.permissionPrimaryButton}
                onPress={openSettingsForPermissions}
                activeOpacity={0.8}
              >
                <Ionicons name="settings" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.permissionPrimaryText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
            },
          ]}>
          <View style={styles.savedPopupContent}>
            <View style={styles.savedPopupLeft}>
              <Image
                source={{ uri: getFirstSafeProductImage(selectedProduct || productData) }}
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

      {/* Margin Selection Modal */}
      <Modal
        visible={showResellTutorialModal}
        transparent
        animationType="fade"
        onRequestClose={handleDismissResellTutorial}
      >
        <View style={styles.resellTutorialOverlay}>
          <View style={styles.resellTutorialCard}>
            <View style={styles.resellTutorialHeader}>
              <View style={styles.resellTutorialIcon}>
                <Ionicons name="play-circle" size={22} color="#F53F7A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resellTutorialTitle}>How Reselling Works</Text>
                <Text style={styles.resellTutorialSubtitle}>
                  Watch this 30-second walkthrough before you start earning.
                </Text>
              </View>
              <TouchableOpacity onPress={handleDismissResellTutorial}>
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.resellTutorialVideoWrapper}>
              <Video
                source={{ uri: RESELL_TUTORIAL_VIDEO_URL }}
                style={styles.resellTutorialVideo}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                useNativeControls
                isLooping
              />
            </View>

            <Text style={styles.resellTutorialDescription}>
              Set your margin, share links on WhatsApp. We handle logistics, you enjoy the profit!
            </Text>

            <TouchableOpacity
              style={styles.resellTutorialCheckboxRow}
              onPress={() => setResellTutorialDontShowAgain(!resellTutorialDontShowAgain)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.resellTutorialCheckbox,
                  resellTutorialDontShowAgain && styles.resellTutorialCheckboxChecked,
                ]}
              >
                {resellTutorialDontShowAgain && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </View>
              <Text style={styles.resellTutorialCheckboxText}>Do not show again</Text>
            </TouchableOpacity>

            <View style={styles.resellTutorialActions}>
              <TouchableOpacity
                style={styles.resellTutorialSecondaryBtn}
                onPress={handleDismissResellTutorial}
              >
                <Text style={styles.resellTutorialSecondaryText}>Maybe later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resellTutorialPrimaryBtn}
                onPress={handleContinueResellTutorial}
              >
                <Text style={styles.resellTutorialPrimaryText}>Start Reselling</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showMarginModal && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
          }}>
          <View style={styles.marginModal}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowMarginModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
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
                        Sell at ₹{Math.round((selectedVariant?.price || productData.price) * (1 + margin / 100))}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom price input */}
              <View style={styles.customPriceContainer}>
                <Text style={styles.customPriceLabel}>Or enter a custom price</Text>
                <View style={styles.customPriceRow}>
                  <Text style={styles.customCurrency}>₹</Text>
                  <TextInput
                    value={customPrice}
                    onChangeText={(val) => {
                      setCustomPrice(val);
                      const base = selectedVariant?.price || productData.price;
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
                    placeholder={`${selectedVariant?.price || productData.price}`}
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
                  const base = selectedVariant?.price || productData.price;
                  const customNum = Number(customPrice);
                  const useCustom = !!customPrice && !isNaN(customNum) && customNum >= base;
                  const effectivePrice = useCustom ? Math.round(customNum) : Math.round(base * (1 + selectedMargin / 100));
                  const effectiveMarginPct = Math.round(((effectivePrice - base) / base) * 100);
                  const effectiveProfit = Math.round(effectivePrice - base);
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
                          ₹{effectivePrice}
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
                onPress={() => {
                  setShowMarginModal(false);
                  // Navigate to catalog share with margin info
                  (navigation as any).navigate('CatalogShare', {
                    product: {
                      ...productData,
                      variants: variants, // Include variants with video_urls
                      product_variants: variants, // Also include as product_variants for compatibility
                      availableSizes: availableSizes, // Pass available sizes array
                      resellPrice: (() => {
                        const base = selectedVariant?.price || productData.price;
                        const num = Number(customPrice);
                        if (!!customPrice && !isNaN(num) && num >= base) return Math.round(num);
                        return Math.round(base * (1 + selectedMargin / 100));
                      })(),
                      margin: (() => {
                        const base = selectedVariant?.price || productData.price;
                        const num = Number(customPrice);
                        const price = (!!customPrice && !isNaN(num) && num >= base) ? num : base * (1 + selectedMargin / 100);
                        return Math.round(((price - base) / base) * 100);
                      })(),
                      basePrice: selectedVariant?.price || productData.price
                    }
                  });
                }}>
                <Text style={styles.marginContinueText}>Continue to Share</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Face Swap Complete Modal */}
      <Modal
        visible={showTryOnCompleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTryOnCompleteModal(false)}
      >
        <View style={styles.tryOnCompleteOverlay}>
          <View style={styles.tryOnCompleteModal}>
            {/* Success Icon - Compact */}
            <View style={styles.tryOnCompleteIconCircle}>
              <Ionicons name="sparkles" size={32} color="#F53F7A" />
            </View>

            {/* Title */}
            <Text style={styles.tryOnCompleteTitle}>Try-On Ready! ✨</Text>

            {/* Subtitle */}
            <Text style={styles.tryOnCompleteSubtitle}>
              View your personalized result
            </Text>

            {/* Buttons */}
            <View style={styles.tryOnCompleteButtons}>
              <TouchableOpacity
                style={styles.tryOnCompleteCancelButton}
                onPress={() => setShowTryOnCompleteModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.tryOnCompleteCancelText}>Later</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tryOnCompleteViewButton}
                onPress={() => {
                  setShowTryOnCompleteModal(false);
                  (navigation as any).navigate('Wishlist', { preview: true });
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="eye" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.tryOnCompleteViewText}>View</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Low Coins Modal */}
      <Modal
        visible={showLowCoinsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLowCoinsModal(false)}
      >
        <View style={styles.lowCoinsOverlay}>
          <View style={styles.lowCoinsModal}>
            {/* Icon */}
            <View style={styles.lowCoinsIconCircle}>
              <Ionicons name="diamond-outline" size={48} color="#F53F7A" />
            </View>

            {/* Title */}
            <Text style={styles.lowCoinsTitle}>Need More Coins</Text>

            {/* Current Balance */}
            <View style={styles.lowCoinsBalanceCard}>
              <Text style={styles.lowCoinsBalanceLabel}>Current Balance</Text>
              <View style={styles.lowCoinsBalanceRow}>
                <Ionicons name="diamond" size={20} color="#F53F7A" />
                <Text style={styles.lowCoinsBalanceValue}>{coinBalance} coins</Text>
              </View>
            </View>

            {/* Required */}
            <Text style={styles.lowCoinsRequired}>Required: 25 coins for Face Swap</Text>

            {/* Ways to Earn */}
            <View style={styles.lowCoinsEarnSection}>
              <Text style={styles.lowCoinsEarnTitle}>Ways to Earn Coins:</Text>

              <View style={styles.lowCoinsEarnItem}>
                <View style={styles.lowCoinsEarnIcon}>
                  <Ionicons name="share-social" size={20} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lowCoinsEarnText}>Share products with friends</Text>
                  <Text style={styles.lowCoinsEarnSubtext}>Earn coins when they view</Text>
                </View>
                <Text style={styles.lowCoinsEarnCoins}>+5</Text>
              </View>

              <View style={styles.lowCoinsEarnItem}>
                <View style={styles.lowCoinsEarnIcon}>
                  <Ionicons name="cart" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lowCoinsEarnText}>Complete a purchase</Text>
                  <Text style={styles.lowCoinsEarnSubtext}>Get 25% of order value as coins</Text>
                </View>
                <Text style={styles.lowCoinsEarnCoins}>+25%</Text>
              </View>
            </View>

            {/* Buttons */}
            <TouchableOpacity
              style={styles.lowCoinsShareButton}
              onPress={() => {
                setShowLowCoinsModal(false);
                // Trigger share functionality
                setTimeout(() => {
                  setShareModalVisible(true);
                }, 300);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="share-social" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.lowCoinsShareButtonText}>Share This Product</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.lowCoinsCloseButton}
              onPress={() => setShowLowCoinsModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.lowCoinsCloseText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full Screen Media Viewer (FaceSwap-style) */}
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
                      onPress={resetFullScreenZoom}
                      style={styles.fullscreenControlButton}
                    >
                      <Ionicons name="refresh" size={22} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.fullscreenContent}>
                {fullScreenMediaType === 'video' && mediaItems[imageViewerIndex]?.type === 'video' ? (
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setIsFullScreenVideoPlaying(prev => !prev)}
                    style={styles.fullscreenMedia}
                  >
                    <Video
                      source={{ uri: mediaItems[imageViewerIndex]?.url }}
                      style={styles.fullscreenMedia}
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay={isFullScreenVideoPlaying && isFocused}
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
                              <Text style={styles.zoomIndicatorText}>
                                {currentZoom.toFixed(1)}x
                              </Text>
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

      {/* Review Media Viewer Modal */}
      <Modal
        visible={showReviewMediaViewer}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReviewMediaViewer(false)}
      >
        <View style={styles.reviewMediaViewerContainer}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.reviewMediaViewerCloseButton}
            onPress={() => setShowReviewMediaViewer(false)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>

          {/* Media Counter */}
          <View style={styles.reviewMediaViewerCounter}>
            <Text style={styles.reviewMediaViewerCounterText}>
              {reviewMediaIndex + 1} / {reviewMediaItems.length}
            </Text>
          </View>

          {/* Scrollable Media Gallery */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const newIndex = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width);
              setReviewMediaIndex(newIndex);
            }}
            scrollEventThrottle={16}
            contentOffset={{ x: reviewMediaIndex * Dimensions.get('window').width, y: 0 }}
          >
            {reviewMediaItems.map((media, index) => (
              <View key={`review-media-${index}`} style={styles.reviewMediaViewerItemContainer}>
                {media.type === 'image' ? (
                  <Image
                    source={{ uri: media.url }}
                    style={styles.reviewMediaViewerImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Video
                    source={{ uri: media.url }}
                    style={styles.reviewMediaViewerVideo}
                    resizeMode={ResizeMode.CONTAIN}
                    useNativeControls
                    shouldPlay={index === reviewMediaIndex && isFocused}
                    isLooping
                  />
                )}
              </View>
            ))}
          </ScrollView>

          {/* Navigation Arrows */}
          {reviewMediaItems.length > 1 && (
            <>
              {reviewMediaIndex > 0 && (
                <TouchableOpacity
                  style={[styles.reviewMediaViewerArrow, styles.reviewMediaViewerLeftArrow]}
                  onPress={() => setReviewMediaIndex(reviewMediaIndex - 1)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-back" size={32} color="#fff" />
                </TouchableOpacity>
              )}
              {reviewMediaIndex < reviewMediaItems.length - 1 && (
                <TouchableOpacity
                  style={[styles.reviewMediaViewerArrow, styles.reviewMediaViewerRightArrow]}
                  onPress={() => setReviewMediaIndex(reviewMediaIndex + 1)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-forward" size={32} color="#fff" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </Modal>

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
              <TouchableOpacity
                style={styles.sizeModalCloseButton}
                onPress={handleCancelSizeSelection}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={20} color="#1C1C1E" />
              </TouchableOpacity>
            </View>
            <Text style={styles.sizeModalSubtitle}>
              Choose the size you want to preview before running Face Swap.
            </Text>

            <View style={styles.sizeOptionsWrap}>
              {availableSizes.map(renderModalSizeOption)}
            </View>

            {!!sizeSelectionError && (
              <Text style={styles.sizeSelectionError}>{sizeSelectionError}</Text>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleConfirmSizeSelection}
              style={styles.sizeModalConfirmWrapper}
            >
              <LinearGradient
                colors={['#FF8FB1', '#F53F7A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sizeModalConfirmButton}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.sizeModalConfirmText}>Continue</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 1000,
    paddingTop: 0,
  },
  statusBarSpacer: {
    height: 35, // Status bar height
    backgroundColor: '#fff',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  categoryName: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
    flexShrink: 1,
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
  floatingBackButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    zIndex: 10,
  },
  scrollContent: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    height: 500,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productImageTouchable: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  zoomIconIndicator: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoomIndicatorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginLeft: 4,
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
  productInfo: {
    padding: 16,
  },
  vendorInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  vendorInfoRowDisabled: {
    opacity: 0.6,
  },
  vendorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FCE4EC',
  },
  vendorAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FCE4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorTextContainer: {
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 4,
  },
  reviewsText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
  },
  productTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  vendorNameLink: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F53F7A',
    marginRight: 4,
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 24,
  },
  vendorNameDisabled: {
    color: '#9CA3AF',
  },
  productTitleText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginLeft: 6,
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
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 8,
  },
  sectionContainer: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sizeGuide: {
    fontSize: 16,
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
    width: 100,
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
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F53F7A',
    borderRadius: 8,
    paddingHorizontal: 20,
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
    // marginBottom: 10,
    padding: 14,
  },
  thumbnail: {
    width: 80,
    height: 80,
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
  faceSwapButton: {
    // position: 'absolute',
    // bottom: 16,
    // right: 16,
    backgroundColor: '#F53F7A',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  faceSwapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  imageDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
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
  bottomBar: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    // No absolute positioning, so it scrolls with content
  },
  topButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
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
    flex: 1,
    minHeight: 52,
  },
  tryOnButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F53F7A',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  tryOnButtonText: {
    color: '#F53F7A',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  resellButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flex: 1,
    minHeight: 52,
  },
  resellButtonText: {
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
    alignSelf: 'stretch',
  },
  resellButtonFullText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
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
  ratingBadge: {
    position: 'absolute',
    top: 56,
    left: 16,
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
    color: '#fff',
  },
  ratingCountText: {
    fontSize: 12,
    color: '#fff',
  },
  productDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginTop: 4,
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
    top: 60,
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

  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  savedPopupViewText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Overall Rating Summary Styles
  overallRatingSummary: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
    borderRadius: 0,
    width: '100%',
  },
  ratingLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  overallRatingNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fcc026',
    marginRight: 8,
  },
  ratingStats: {
    marginLeft: 8,
  },
  overallRatingCountText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  overallReviewCountText: {
    fontSize: 14,
    color: '#666',
  },
  ratingBreakdown: {
    flex: 1,
  },
  ratingBreakdownContainer: {
    flex: 1,
  },
  ratingBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 20,
  },
  ratingBreakdownNumber: {
    fontSize: 14,
    color: '#333',
    width: 20,
    fontWeight: '600',
  },
  ratingBreakdownBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginLeft: 12,
    marginRight: 12,
    overflow: 'hidden',
  },
  ratingBreakdownBar: {
    height: '100%',
    borderRadius: 4,
  },
  ratingBreakdownCount: {
    fontSize: 14,
    color: '#666',
    width: 35,
    textAlign: 'right',
    fontWeight: '600',
  },

  // Individual Review Card Styles
  reviewCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 20,
    borderRadius: 8,
  },
  reviewerInfoContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  reviewerPhotoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  reviewerPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewerPhotoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  reviewRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifiedPurchase: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    lineHeight: 24,
  },
  reviewMetadata: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  reviewRatingDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewStarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewStar: {
    marginRight: 1,
  },
  reviewRatingText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  reviewDateText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 'auto',
  },
  reviewTextContainer: {
    marginBottom: 12,
  },
  reviewText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  seeMoreText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  resellTutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  resellTutorialCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  resellTutorialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  resellTutorialIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFE3EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resellTutorialTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  resellTutorialSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  resellTutorialVideoWrapper: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 12,
  },
  resellTutorialVideo: {
    width: '100%',
    height: '100%',
  },
  resellTutorialDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  resellTutorialCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  resellTutorialCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#F53F7A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  resellTutorialCheckboxChecked: {
    backgroundColor: '#F53F7A',
  },
  resellTutorialCheckboxText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  resellTutorialActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resellTutorialSecondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  resellTutorialSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  resellTutorialPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F53F7A',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  resellTutorialPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  helpfulText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  reviewMediaContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  reviewMediaItem: {
    position: 'relative',
  },
  reviewMediaImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  reviewVideoContainer: {
    position: 'relative',
  },
  reviewVideoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  reviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  helpfulButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  helpfulButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shareButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  reportButton: {
    marginLeft: 'auto',
  },
  reportButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  helpfulButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  helpfulButtonTextActive: {
    color: '#007AFF',
  },
  // Report Modal Styles
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  reportModalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  reportModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
    textAlign: 'center',
  },
  reportModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  reportModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  reportModalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  reportModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  reportModalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
  },
  reportModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Additional review styles
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  allReviewMediaSection: {
    marginTop: 16,
    marginBottom: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  allReviewMediaTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  allReviewMediaScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  allReviewMediaItem: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  allReviewVideoContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
  },
  allReviewVideoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  reviewsList: {
    marginTop: 8,
  },
  showMoreReviewsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#F53F7A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 20,
    marginHorizontal: 16,
    gap: 8,
  },
  showMoreReviewsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F53F7A',
  },
  noReviewsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noReviewsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
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
  akoolOptions: {
    marginBottom: 10,
  },
  tryOnInfoCard: {
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#FFFBFB',
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
    color: '#111827',
  },
  tryOnInfoDesc: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  tryOnInfoCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  tryOnInfoCostText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F53F7A',
  },
  akoolOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#fafbfc',
  },
  akoolOptionSelected: {
    borderColor: '#F53F7A',
    backgroundColor: '#fff0f6',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#F53F7A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F53F7A',
  },
  akoolOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  akoolCoin: {
    color: '#F53F7A',
    fontWeight: '700',
    fontSize: 15,
  },
  akoolOptionDesc: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
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
  personalizedBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 15,
  },
  personalizedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  personalizedDate: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginTop: 4,
  },
  // Margin Modal Styles
  marginModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 380,
    maxHeight: '80%',
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
  marginModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 6,
    marginTop: 8,
  },
  marginModalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  marginOptions: {
    marginBottom: 16,
  },
  marginOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  marginOptionSelected: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
  },
  marginOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  marginOptionDesc: {
    fontSize: 13,
    color: '#666',
  },
  marginSummary: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  marginSummaryTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  marginSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  marginSummaryLabel: {
    fontSize: 13,
    color: '#666',
  },
  marginSummaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  marginSummaryHighlight: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 15,
  },
  marginSummaryProfit: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 15,
  },
  marginContinueBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  marginContinueText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  // Custom price styles
  customPriceContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fafbfc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  customPriceLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '700',
    marginBottom: 8,
  },
  customPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAECF0',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'android' ? 6 : 10,
  },
  customCurrency: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
    marginRight: 6,
  },
  customPriceInput: {
    flex: 1,
    fontSize: 16,
    color: '#111',
  },
  customPriceError: {
    marginTop: 6,
    color: '#B00020',
    fontWeight: '700',
  },
  customPriceHelp: {
    marginTop: 4,
    color: '#666',
    fontSize: 12,
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
  suggestionsListContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  suggestionsLeftArrow: {
    position: 'absolute',
    left: 0,
    top: '45%',
    transform: [{ translateY: -14 }],
    backgroundColor: '#FFF',
    borderRadius: 24,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  suggestionsRightArrow: {
    position: 'absolute',
    right: 0,
    top: '45%',
    transform: [{ translateY: -14 }],
    backgroundColor: '#FFF',
    borderRadius: 24,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  suggestionAddButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  // Try-On Complete Modal Styles - Compact & Centered
  tryOnCompleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tryOnCompleteModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  tryOnCompleteIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  tryOnCompleteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  tryOnCompleteSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  tryOnCompleteButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  tryOnCompleteCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryOnCompleteCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tryOnCompleteViewButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F53F7A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tryOnCompleteViewText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  // Consent Modal Styles
  consentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  consentModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '90%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  consentIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  consentTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  consentContent: {
    width: '100%',
    marginBottom: 24,
  },
  consentPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  consentBullet: {
    marginRight: 12,
    marginTop: 2,
  },
  consentPointText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
    lineHeight: 20,
  },
  consentButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  consentCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  consentCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  consentAgreeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F53F7A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  consentAgreeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  // Low Coins Modal Styles
  lowCoinsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lowCoinsModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '92%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  lowCoinsIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  lowCoinsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  lowCoinsBalanceCard: {
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  lowCoinsBalanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  lowCoinsBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lowCoinsBalanceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F59E0B',
  },
  lowCoinsRequired: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 24,
  },
  lowCoinsEarnSection: {
    width: '100%',
    marginBottom: 24,
  },
  lowCoinsEarnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  lowCoinsEarnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  lowCoinsEarnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lowCoinsEarnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  lowCoinsEarnSubtext: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  lowCoinsEarnCoins: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F53F7A',
    marginLeft: 8,
  },
  lowCoinsShareButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F53F7A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  lowCoinsShareButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  lowCoinsCloseButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
  },
  lowCoinsCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  // Image Viewer Styles
  imageViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCounter: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageViewerCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  imageViewerZoomButton: {
    position: 'absolute',
    top: 120,
    right: 20,
    zIndex: 1000,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  zoomIconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomSymbol: {
    position: 'absolute',
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    top: 3,
    left: 7,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  imageViewerImageContainer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  imageViewerArrow: {
    position: 'absolute',
    top: '50%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  imageViewerLeftArrow: {
    left: 20,
  },
  imageViewerRightArrow: {
    right: 20,
  },
  // Review Media Viewer Styles
  reviewMediaViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewMediaViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewMediaViewerCounter: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  reviewMediaViewerCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reviewMediaViewerItemContainer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewMediaViewerImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  reviewMediaViewerVideo: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
  },
  reviewMediaViewerArrow: {
    position: 'absolute',
    top: '50%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  reviewMediaViewerLeftArrow: {
    left: 20,
  },
  reviewMediaViewerRightArrow: {
    right: 20,
  },

  // New Review Design Styles
  reviewerInfoContainerNew: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerAvatarContainer: {
    marginRight: 8,
  },
  reviewerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewerNameNew: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111',
    flex: 1,
  },
  // okGestureContainer removed
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  star: {
    marginRight: 2,
  },
  verifiedPurchaseText: {
    fontSize: 14,
    color: '#FF9500',
    marginLeft: 8,
    fontWeight: '500',
  },
  reviewTitleBold: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    lineHeight: 24,
  },
  reviewMetadataText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  productSpecsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  reviewMediaScrollContainer: {
    marginBottom: 12,
  },
  reviewImagesContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  reviewImageWrapper: {
    width: 120,
    height: 120,
  },
  reviewImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  additionalCommentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  additionalCommentText: {
    fontSize: 14,
    color: '#111',
    flex: 1,
  },
  helpfulnessText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  helpfulButtonNew: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  helpfulButtonTextNew: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  shareButtonNew: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
  },
  shareButtonTextNew: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  reportButtonNew: {
    flex: 1,
    alignItems: 'flex-end',
  },
  reportButtonTextNew: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },

  // Rating Filter Styles
  filterControlsContainer: {
    marginBottom: 16,
  },
  activeFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9500',
    marginBottom: 8,
  },
  activeFilterText: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearFilterText: {
    fontSize: 12,
    color: '#F53F7A',
    fontWeight: '500',
  },
  ratingBreakdownRowSelected: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginVertical: 2,
  },
  ratingBreakdownNumberSelected: {
    color: '#FF9500',
    fontWeight: '700',
  },
  ratingBreakdownCountSelected: {
    color: '#FF9500',
    fontWeight: '600',
  },
  photoPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  photoPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  photoPickerContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  photoPickerHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 18,
  },
  photoPickerHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  photoPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  photoPickerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  photoPickerUploading: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPickerUploadingText: {
    fontSize: 13,
    color: '#F53F7A',
    fontWeight: '600',
  },
  photoPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FDE2E7',
    backgroundColor: '#FFF7FB',
    marginBottom: 12,
    gap: 16,
  },
  photoPickerOptionDisabled: {
    opacity: 0.5,
  },
  photoPickerOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F53F7A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 3,
  },
  photoPickerOptionTextContainer: {
    flex: 1,
  },
  photoPickerOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  photoPickerOptionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  photoPickerCancelButton: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  photoPickerCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  permissionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  permissionModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 12,
  },
  permissionIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },
  permissionBody: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  permissionSecondaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  permissionPrimaryButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#F53F7A',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  permissionPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  sizeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sizeModalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  sizeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sizeModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  sizeModalCloseButton: {
    padding: 6,
  },
  sizeModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  sizeOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  sizeSelectionError: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  sizeModalConfirmWrapper: {
    marginTop: 8,
  },
  sizeModalConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 18,
    gap: 6,
  },
  sizeModalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ProductDetails;
