import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Animated, KeyboardAvoidingView, TextInput } from 'react-native';
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
  Clipboard,
  Platform,
  ActionSheetIOS,
  Modal,
  Pressable,
  ToastAndroid,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';
import { AntDesign } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '~/types/navigation';
import { useUser } from '~/contexts/UserContext';
import { useCart } from '~/contexts/CartContext';
import { useWishlist } from '~/contexts/WishlistContext';
import { usePreview } from '~/contexts/PreviewContext';
import { SaveToCollectionSheet } from '~/components/common';
import { supabase } from '~/utils/supabase';
import { akoolService } from '~/utils/akoolService';
import piAPIVirtualTryOnService from '~/services/piapiVirtualTryOn';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import i18n from '../utils/i18n';
import {
  getSafeImageUrls,
  getFirstSafeImageUrl,
  getProductImages,
  getFirstSafeProductImage,
} from '../utils/imageUtils';
import type { Product, ProductVariant, LegacyProduct } from '~/types/product';
import { akool } from '~/services/akoolApi';

const { width } = Dimensions.get('window');

type ProductDetailsNavigationProp = StackNavigationProp<RootStackParamList>;
type ProductDetailsRouteProp = RouteProp<RootStackParamList, 'ProductDetails'>;

const ProductDetails = () => {
  const navigation = useNavigation<ProductDetailsNavigationProp>();
  const route = useRoute<ProductDetailsRouteProp>();
  const { product } = route.params || {};

  const { userData, setUserData } = useUser();
  const { addToCart } = useCart();
  const { wishlist, toggleWishlist, isInWishlist, removeFromWishlist } = useWishlist();
  const { addToPreview } = usePreview();

  // State for variants and available options
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [availableColors, setAvailableColors] = useState<
    { id: string; name: string; hex_code: string }[]
  >([]);
  const [availableSizes, setAvailableSizes] = useState<{ id: string; name: string }[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
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
  const [showCollectionSheet, setShowCollectionSheet] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showSavedPopup, setShowSavedPopup] = useState(false);
  const [savedProductName, setSavedProductName] = useState('');
  const popupAnimation = useRef(new Animated.Value(0)).current;

  // Try on modal state
  const [showTryOnModal, setShowTryOnModal] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'photo' | 'video' | null>(null);
  const [replacementPolicyVisible, setReplacementPolicyVisible] = useState(false);
  const [coinBalance, setCoinBalance] = useState(0);

  // Reviews state
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

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

  const productData = useMemo(
    () => ({
      ...sampleProduct,
      ...product,
      sku: (product as any)?.sku ?? sampleProduct.sku,
      category: (product as any)?.category?.name ?? sampleProduct.category,
      stock: Number((product as any)?.stock ?? sampleProduct.stock),
      image_urls: (product as any)?.image_urls ?? sampleProduct.image_urls,
      video_urls: (product as any)?.video_urls ?? sampleProduct.video_urls,
    }),
    [product, sampleProduct]
  );

  // Vendor info from product data
  const vendorName = (productData as any).vendor_name || 'Unknown Vendor';
  const vendorAlias = (productData as any).alias_vendor;
  const returnPolicy = (productData as any).return_policy;

  // Use user's size as default
  const defaultSize = userData?.size || '';
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('details');
  const [addToCartLoading, setAddToCartLoading] = useState(false);
  const [showMarginModal, setShowMarginModal] = useState(false);
  const [selectedMargin, setSelectedMargin] = useState(15); // Default 15% margin
  const [customPrice, setCustomPrice] = useState<string>('');
  const [customPriceError, setCustomPriceError] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const { t } = useTranslation();
  const [langMenuVisible, setLangMenuVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // Fetch product variants
  useEffect(() => {
    if (productData.id && String(productData.id) !== '1') {
      fetchProductVariants();
      fetchProductReviews();
    }
  }, [productData.id]);

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

      // Priority 1: Check for images from selected variant
      if (selectedVariant && selectedVariant.image_urls && selectedVariant.image_urls.length > 0) {
        const cacheKey = `variant_${selectedVariant.id}`;
        if (processedImageCache.current[cacheKey]) {
          const cachedImages = processedImageCache.current[cacheKey];
          unifiedMediaItems = cachedImages.map((url) => ({ type: 'image' as const, url }));
          console.log('✅ Using cached images from selected variant:', cachedImages);
        } else {
          // Use raw URLs for faster processing, let Image component handle errors
          const images = selectedVariant.image_urls.filter((url) => url && typeof url === 'string');
          unifiedMediaItems = images.map((url) => ({ type: 'image' as const, url }));
          processedImageCache.current[cacheKey] = images;
          console.log('✅ Using raw images from selected variant:', images);
        }
      }
      // Priority 2: Check for images in product variants first
      else {
        const productImages = getProductImages(productData);
        if (productImages.length > 0) {
          const cacheKey = `product_${productData.id}`;
          if (processedImageCache.current[cacheKey]) {
            const cachedImages = processedImageCache.current[cacheKey];
            unifiedMediaItems = cachedImages.map((url) => ({ type: 'image' as const, url }));
            console.log('✅ Using cached images from product variants:', cachedImages);
          } else {
            // Use raw URLs for faster processing
            const images = productImages.filter((url) => url && typeof url === 'string');
            unifiedMediaItems = images.map((url) => ({ type: 'image' as const, url }));
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
            const cachedImages = processedImageCache.current[cacheKey];
            unifiedMediaItems = cachedImages.map((url) => ({ type: 'image' as const, url }));
            console.log('✅ Using cached image_urls array:', cachedImages);
          } else {
            // Use raw URLs for faster processing
            const images = productData.image_urls.filter((url) => url && typeof url === 'string');
            unifiedMediaItems = images.map((url) => ({ type: 'image' as const, url }));
            processedImageCache.current[cacheKey] = images;
            console.log('✅ Using raw image_urls array:', images);
          }
        }
        // Priority 4: Fallback to old image field
        else if (productData.image) {
          // Old format: single image from image field
          unifiedMediaItems = [{ type: 'image' as const, url: productData.image }];
          console.log('✅ Using image field:', productData.image);
        }
      }

      // Add videos if available (from selected variant first, then product)
      let videoItems: MediaItem[] = [];
      if (selectedVariant && selectedVariant.video_urls && selectedVariant.video_urls.length > 0) {
        videoItems = selectedVariant.video_urls
          .filter((url) => url && typeof url === 'string')
          .map((url) => ({
            type: 'video' as const,
            url: convertGoogleDriveVideoUrl(url),
            thumbnail: unifiedMediaItems[0]?.url, // Use first image as thumbnail
          }));
        console.log('✅ Using videos from selected variant:', selectedVariant.video_urls);
      } else if (
        productData.video_urls &&
        Array.isArray(productData.video_urls) &&
        productData.video_urls.length > 0
      ) {
        videoItems = productData.video_urls
          .filter((url) => url && typeof url === 'string')
          .map((url) => ({
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
  }, [productData.image_urls, productData.video_urls, productData.image, selectedVariant]);

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
      onPress={() => setSelectedSize(size.id)}>
      <Text style={[styles.sizeText, selectedSize === size.id && styles.selectedSizeText]}>
        {size.name}
      </Text>
    </TouchableOpacity>
  );

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
      name: productData.name,
      price: selectedVariant?.price || productData.price,
      image: productData.image,
      image_urls: productData.image_urls || (productData.image ? [productData.image] : []),
      size: selectedSizeData?.name || selectedSize,
      color: selectedColorData?.name || selectedColor || 'N/A',
      quantity,
      stock: selectedVariant.quantity,
      category: productData.category,
      sku: productData.sku,
    });

    setAddToCartLoading(false);
    Alert.alert('Success', 'Added to cart!');
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

  const handleVirtualTryOn = async () => {
    try {
      if (!userData?.id || !userData?.profilePhoto) {
        Alert.alert('Profile Photo Required', 'Please upload a profile photo first to use Virtual Try-On feature.');
        return;
      }

      if (coinBalance < 25) {
        Alert.alert(
          'Insufficient Coins',
          'You need at least 25 coins for Virtual Try-On. Please purchase more coins to continue.'
        );
        return;
      }

      if (!productData?.id) {
        Alert.alert('Product Error', 'Product information is not available. Please try again.');
        return;
      }

      const productId = productData.id;
      // Get image from first variant that has images, or fallback to product image_urls
      const firstVariantWithImage = variants.find((v) => v.image_urls && v.image_urls.length > 0);
      const productImageUrl =
        firstVariantWithImage?.image_urls?.[0] || productData.image_urls?.[0] || productData.image;

      if (!productImageUrl) {
        Alert.alert('Product Image Error', 'Product image is not available for Virtual Try-On. Please try a different product.');
        return;
      }

      setShowTryOnModal(false);

      // Update coin balance (deduct 25 coins for virtual try-on)
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
        
        Alert.alert('Service Unavailable', 'Virtual Try-On service is currently unavailable. Please try again later.');
        return;
      }

      // Initiate virtual try-on with PiAPI
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
          text1: 'Virtual Try-On Started',
          text2: 'Your virtual try-on is being processed. This may take a few minutes.',
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

        Alert.alert('Try-On Failed', response?.error || 'Failed to start virtual try-on. Your coins have been refunded.');
      }
    } catch (error) {
      console.error('Error starting virtual try-on:', error);
      
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
    if (!userData?.id || !userData?.profilePhoto) {
      Alert.alert('Error', 'Please upload a profile photo first');
      return;
    }

    if (coinBalance < 25) {
      Alert.alert(
        'Insufficient Coins',
        'You need at least 25 coins for Video Preview. Please purchase more coins.'
      );
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
            description: `Virtual Try-On: ${productData.name} - See how it looks on you`,
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
          Alert.alert(
            'Virtual Try-On Ready!',
            'Your virtual try-on result has been added to Your Preview.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'View Now',
                onPress: () => (navigation as any).navigate('Wishlist', { preview: true }),
              },
            ]
          );
        } else if (status.status === 'failed') {
          clearInterval(interval);
          Alert.alert('Error', status.error || 'Virtual try-on failed. Please try again.');
        } else if (pollCount >= maxPollAttempts) {
          // Timeout after 5 minutes
          clearInterval(interval);
          console.warn('[ProductDetails] Virtual try-on polling timeout');
          Alert.alert(
            'Processing Timeout',
            'Virtual try-on is taking longer than expected. Please try again later or contact support if the issue persists.'
          );
        }
      } catch (error) {
        console.error('Error checking virtual try-on status:', error);
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

  // Get total stock for the product
  const getTotalStock = () => {
    if (variants.length > 0) {
      return variants.reduce((sum, variant) => sum + variant.quantity, 0);
    }
    return productData.stock || 0;
  };

  const isLowStock = getTotalStock() < 5;

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
      if (Platform.OS === 'android')
        ToastAndroid.show('WhatsApp not installed', ToastAndroid.SHORT);
    });
    setShareModalVisible(false);
  };

  const copyUrl = () => {
    Clipboard.setString(shareUrl);
    if (Platform.OS === 'android') ToastAndroid.show('Copied to clipboard', ToastAndroid.SHORT);
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

  const renderReview = (review: any) => (
    <View key={review.id} style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          {review.profile_image_url ? (
            <Image source={{ uri: review.profile_image_url }} style={styles.reviewerAvatar} />
          ) : (
            <View style={styles.reviewerAvatarPlaceholder}>
              <Ionicons name="person" size={16} color="#666" />
            </View>
          )}
          <View style={styles.reviewerDetails}>
            <Text style={styles.reviewerName}>{review.reviewer_name}</Text>
            {review.is_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
                <Text style={styles.verifiedText}>{t('verified_purchase')}</Text>
              </View>
            )}
          </View>
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
        <View style={styles.reviewRating}>{renderStars(review.rating)}</View>
      </View>
      {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
      <Text style={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString()}</Text>
    </View>
  );

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
              shouldPlay={videoState.isPlaying}
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

            {/* Loading Indicator for Images */}
            {imageLoadingStates[currentImageIndex] && (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator size="large" color="#F53F7A" />
              </View>
            )}
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

        {/* Rating Badge (bottom right) */}
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingBadgeText}>
            {averageRating > 0 ? averageRating.toFixed(1) : productData.rating}
          </Text>
          <Ionicons name="star" size={13} color="#FFD700" />
          <Text style={styles.ratingCountText}>
            {totalReviews > 0
              ? totalReviews > 1000
                ? `${(totalReviews / 1000).toFixed(1)}k`
                : totalReviews.toString()
              : productData.reviews > 1000
                ? `${(productData.reviews / 1000).toFixed(1)}k`
                : productData.reviews.toString()}
          </Text>
        </View>

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
            if (isInWishlist(productData.id.toString())) {
              removeFromWishlist(productData.id.toString());
              // Remove from all collections in Supabase
              if (userData?.id) {
                await supabase
                  .from('collection_products')
                  .delete()
                  .match({ product_id: productData.id.toString() });
              }
            } else {
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
            }
          }}
          activeOpacity={0.7}>
          <Ionicons
            name={isInWishlist(productData.id.toString()) ? 'heart' : 'heart-outline'}
            size={24}
            color={isInWishlist(productData.id.toString()) ? '#F53F7A' : '#333'}
          />
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {mediaItems.map((media, index) => (
            <TouchableOpacity
              key={index}
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
            <Text style={styles.logo}>
              Only<Text style={{ color: '#F53F7A' }}>2</Text>U
            </Text>
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
          style={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {renderImageGallery()}

          {/* Product Info */}
          <View style={styles.productInfo}>
            {/* Stock Indicator above product title */}
            {/* <View style={styles.stockIndicator}>
            <Ionicons 
              name="cube-outline" 
              size={16} 
              color="#fff" 
              style={{ marginRight: 6 }}
            />
            <Text style={styles.stockIndicatorText}>
              {getTotalStock()} {t('left')}
            </Text>
          </View> */}

            {/* Vendor Name, Product Title and Share Button Row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.productName}>
                  {(productData as any).isPersonalized ? 'Personalized ' : vendorName + ' '}
                  <Text style={{ fontSize: 18, color: '#666', fontWeight: '400' }}>
                    {' '}
                    {productData.name}
                  </Text>
                </Text>
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

            {/* <View style={styles.stockIndicator}>
              <Ionicons 
                name="cube-outline" 
                size={16} 
                color="#FF3B30" 
                style={{ marginRight: 6 }}
              />
              <Text style={styles.stockIndicatorText}>
                {getTotalStock()} {t('left')}!
              </Text>
            </View> */}

            {/* Price */}
            <View style={styles.priceContainer}>
              <Text style={styles.price}>
                ₹{Math.round(selectedVariant?.price || productData.price)}
              </Text>
              {productData.originalPrice && (
                <Text style={styles.originalPrice}>
                  MRP ₹{Math.round(productData.originalPrice)}
                </Text>
              )}
              {productData.discount > 0 && (
                <Text style={styles.discount}>({Math.round(productData.discount)}% OFF)</Text>
              )}
            </View>
            <View style={styles.stockIndicator}>
              <Ionicons name="cube-outline" size={16} color="#FF3B30" style={{ marginRight: 6 }} />
              <Text style={styles.stockIndicatorText}>
                {getTotalStock()} {t('left')}!
              </Text>
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
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#F53F7A" />
                    <Text style={styles.loadingText}>{t('loading_reviews')}</Text>
                  </View>
                ) : reviews.length > 0 ? (
                  <View>
                    {/* Reviews Summary */}
                    <View style={styles.reviewsSummary}>
                      <View style={styles.ratingOverview}>
                        <Text style={styles.averageRatingText}>{averageRating.toFixed(1)}</Text>
                        <View style={styles.starsContainer}>
                          {renderStars(Math.round(averageRating))}
                        </View>
                        <Text style={styles.totalReviewsText}>
                          {totalReviews} {totalReviews === 1 ? t('review') : t('reviews')}
                        </Text>
                      </View>
                    </View>

                    {/* Reviews List */}
                    <View style={styles.reviewsList}>{reviews.map(renderReview)}</View>
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
                {/* Top row: Add to Cart and Resell buttons */}
                <View style={styles.topButtonRow}>
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
                  
                  {/* Resell Button with margin feature */}
                  {userData?.id && (
                    <TouchableOpacity
                      style={styles.resellButton}
                      onPress={() => {
                        // Show margin selection modal
                        setShowMarginModal(true);
                      }}>
                      <Ionicons name="storefront" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.resellButtonText}>Resell</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* Bottom row: Try On button (full width) */}
                <TouchableOpacity
                  style={styles.tryOnButtonFull}
                  onPress={() => {
                    // Require Kling AI consent before proceeding
                    setShowConsentModal(true);
                  }}>
                  <Ionicons name="camera" size={20} color="#F53F7A" />
                  <Text style={styles.tryOnButtonText}>{t('try_on')}</Text>
                </TouchableOpacity>
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
                      onPress={() => {
                        setShowMarginModal(true);
                      }}>
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
        onSaved={(product, collectionName) => {
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
                <Ionicons
                  name="logo-whatsapp"
                  size={30}
                  color="#25D366"
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.shareModalText}>{t('share_on_whatsapp')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareModalOption} onPress={copyUrl}>
                <Ionicons name="copy-outline" size={22} color="#333" style={{ marginRight: 10 }} />
                <Text style={styles.shareModalText}>{t('copy_url')}</Text>
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

      {/* Try On Modal */}
      {/* Consent Modal (must accept before showing Try On) */}
      {showConsentModal && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.3)',
            zIndex: 10000,
          }}>
          <View style={styles.akoolModal}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowConsentModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.akoolTitle}>Kling AI Consent</Text>
            <Text style={styles.akoolSubtitle}>
              By proceeding, you confirm you have the right to use your image and consent to
              processing by Kling AI to generate virtual try-on previews. Generated previews may
              be stored to improve your experience.
            </Text>
            <View style={{ height: 8 }} />
            <TouchableOpacity
              style={[styles.akoolContinueBtn, { backgroundColor: '#111827' }]}
              onPress={() => {
                setShowConsentModal(false);
                setShowTryOnModal(true);
              }}
            >
              <Text style={styles.akoolContinueText}>I Agree</Text>
            </TouchableOpacity>
            <View style={{ height: 10 }} />
            <TouchableOpacity
              style={[styles.akoolContinueBtn, { backgroundColor: '#f0f0f0' }]}
              onPress={() => setShowConsentModal(false)}
            >
              <Text style={[styles.akoolContinueText, { color: '#111' }]}>Cancel</Text>
            </TouchableOpacity>
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
          }}>
          <View style={styles.akoolModal}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowTryOnModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.akoolTitle}>👗 Want to see how this outfit looks on you?</Text>
            <Text style={styles.akoolSubtitle}>Try on with Virtual Try-On AI</Text>
            <View style={styles.akoolOptions}>
              <TouchableOpacity
                style={[
                  styles.akoolOption,
                  selectedOption === 'photo' && styles.akoolOptionSelected,
                ]}
                onPress={() => setSelectedOption('photo')}>
                <View style={styles.radioCircle}>
                  {selectedOption === 'photo' && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.akoolOptionTitle}>
                    Virtual Try-On <Text style={styles.akoolCoin}>25 {t('coins')}</Text>
                  </Text>
                  <Text style={styles.akoolOptionDesc}>See how this outfit looks on you</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.akoolOption,
                  selectedOption === 'video' && styles.akoolOptionSelected,
                ]}
                onPress={() => setSelectedOption('video')}>
                <View style={styles.radioCircle}>
                  {selectedOption === 'video' && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.akoolOptionTitle}>
                    {t('video_preview')} <Text style={styles.akoolCoin}>35 {t('coins')}</Text>
                  </Text>
                  <Text style={styles.akoolOptionDesc}>{t('get_short_hd_reel')}</Text>
                </View>
              </TouchableOpacity>
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
                if (selectedOption === 'photo') {
                  // Show initial success message
                  Toast.show({
                    type: 'success',
                    text1: 'Virtual Try-On Started',
                    text2: 'We will notify you once your try-on is ready',
                  });

                  // Perform virtual try-on directly
                  handleVirtualTryOn();
                } else if (selectedOption === 'video') {
                  // Show initial success message for video
                  Toast.show({
                    type: 'success',
                    text1: 'Video Face Swap Started',
                    text2: 'Video processing may take several minutes',
                  });

                  // Perform video face swap
                  handleVideoFaceSwap();
                }
              }}>
              <Text style={styles.akoolContinueText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
  productInfo: {
    padding: 16,
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
  productName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
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
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#F53F7A',
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginRight: 12,
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
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flex: 1,
    justifyContent: 'center',
  },
  resellButtonText: {
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
    bottom: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
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
  lowStockIndicator: {
    backgroundColor: '#FF3B30',
  },
  lowStockText: {
    color: '#fff',
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
  // Review styles
  reviewCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F53F7A',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
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
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  reviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewComment: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
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
  reviewsSummary: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  ratingOverview: {
    alignItems: 'center',
  },
  averageRatingText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  totalReviewsText: {
    fontSize: 14,
    color: '#666',
  },
  reviewsList: {
    marginTop: 8,
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
});

export default ProductDetails;
