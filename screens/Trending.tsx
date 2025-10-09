import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Animated } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Clipboard } from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '~/types/navigation';
import { supabase } from '~/utils/supabase';
import { useWishlist } from '~/contexts/WishlistContext';
import { usePreview } from '~/contexts/PreviewContext';
import { useUser } from '~/contexts/UserContext';
import { useVendor } from '~/contexts/VendorContext';
import { akoolService } from '~/utils/akoolService';
import piAPIVirtualTryOnService from '~/services/piapiVirtualTryOn';
import Toast from 'react-native-toast-message';
import { SaveToCollectionSheet, ProductDetailsBottomSheet } from '~/components/common';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@gorhom/bottom-sheet';
import { getProductImages, getFirstSafeProductImage } from '../utils/imageUtils';


const { width, height } = Dimensions.get('window');

type TrendingNavigationProp = StackNavigationProp<RootStackParamList>;

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

// Add Comment type
interface Comment {
  id: string;
  user_id: string;
  product_id: string;
  content: string;
  created_at: string;
  user_name?: string;
}

const TrendingScreen = () => {
  let navigation;
  try {
    navigation = useNavigation<TrendingNavigationProp>();
  } catch (error) {
    console.error('Navigation error:', error);
    // Fallback navigation object
    navigation = {
      goBack: () => {},
      navigate: () => {},
    } as any;
  }
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const pagerRef = useRef<PagerView>(null);
  const insets = useSafeAreaInsets();
  const [selectedVideoIndexes, setSelectedVideoIndexes] = useState<{ [id: string]: number }>({});
  const [videoStates, setVideoStates] = useState<{ [id: string]: { isPlaying: boolean; isMuted: boolean } }>({});
  const videoRefs = useRef<{ [key: string]: any }>({});
  const [showTryOnModal, setShowTryOnModal] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'photo' | 'video' | null>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { addToPreview } = usePreview();
  const { userData, setUserData, refreshUserData } = useUser();
  const [swipeCount, setSwipeCount] = useState(0);
  const [hasShownSwipeNotification, setHasShownSwipeNotification] = useState(false);
  const [showSwipeNotification, setShowSwipeNotification] = useState(false);
  const notificationAnimation = useRef(new Animated.Value(-100)).current;

  // Hide tab bar when on trending screen
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: { display: 'none' },
    });

    return () => {
      navigation.setOptions({
        tabBarStyle: undefined,
      });
    };
  }, [navigation]);
  const { 
    vendors, 
    getVendorByProductId, 
    followVendor, 
    unfollowVendor, 
    isFollowingVendor 
  } = useVendor();
  const [likeStates, setLikeStates] = useState<{ [id: string]: boolean }>({});
  const [likeCounts, setLikeCounts] = useState<{ [id: string]: number }>({});
  const [productVendors, setProductVendors] = useState<{ [productId: string]: any }>({});
  const [mockFollowStates, setMockFollowStates] = useState<{ [vendorId: string]: boolean }>({});



  const isFocused = useIsFocused();

  const [showCollectionSheet, setShowCollectionSheet] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDetailsSheet, setShowProductDetailsSheet] = useState(false);
  const [productForDetails, setProductForDetails] = useState<Product | null>(null);
  const [showSavedPopup, setShowSavedPopup] = useState(false);
  const [savedProductName, setSavedProductName] = useState('');
  const [showUGCActionsSheet, setShowUGCActionsSheet] = useState(false);
  const [ugcActionProductId, setUGCActionProductId] = useState<string | null>(null);
  const popupAnimation = useRef(new Animated.Value(0)).current;

  const { t } = useTranslation();

  const [commentsProductId, setCommentsProductId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsRealtimeSub, setCommentsRealtimeSub] = useState<any>(null);
  const [commentCounts, setCommentCounts] = useState<{ [productId: string]: number }>({});
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [productRatings, setProductRatings] = useState<{ [productId: string]: { rating: number; reviews: number } }>({});
  const [videoLoadingStates, setVideoLoadingStates] = useState<{ [productId: string]: boolean }>({});

  const commentsSheetRef = useRef<BottomSheet>(null);
  const ugcActionsSheetRef = useRef<BottomSheet>(null);
  const shareSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '70%'], []);

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

  const getSmallestPrice = (product: Product) => {
    if (!product.variants || product.variants.length === 0) {
      return 0;
    }
    const sortedVariants = [...product.variants].sort((a, b) => a.price - b.price);
    return sortedVariants[0]?.price || 0;
  };

  useEffect(() => {
    fetchTrendingProducts();
  }, []);

  // Fetch vendor information for products
  useEffect(() => {
    if (products.length > 0) {
      fetchProductVendors();
    }
  }, [products]);

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

      productIds.forEach(productId => {
        const productReviews = data?.filter(review => review.product_id === productId) || [];
        const totalRating = productReviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = productReviews.length > 0 ? totalRating / productReviews.length : 0;

        ratings[productId] = {
          rating: averageRating,
          reviews: productReviews.length
        };
      });

      setProductRatings(prev => ({ ...prev, ...ratings }));
    } catch (error) {
      console.error('Error fetching product ratings:', error);
    }
  };

  useEffect(() => {
    if (userData?.id && products.length > 0) {
      fetchUserLikes();
    }
  }, [userData?.id, products]);

  useEffect(() => {
    if (userData?.id) {
      fetchUserCoinBalance();
    }
  }, [userData?.id]);

  // Load blocked users for current user
  useEffect(() => {
    const fetchBlocked = async () => {
      if (!userData?.id) return;
      try {
        const { data, error } = await supabase
          .from('blocked_users')
          .select('blocked_user_id')
          .eq('user_id', userData.id);
        if (!error && data) {
          setBlockedUserIds(data.map((r: any) => r.blocked_user_id).filter(Boolean));
        }
      } catch {}
    };
    fetchBlocked();
  }, [userData?.id]);



  // Fetch all comment counts when products are loaded
  useEffect(() => {
    if (products.length > 0) {
      fetchAllCommentCounts(products.map(p => p.id));
    }
  }, [products]);

  // Track swipes and show notification after 5 swipes
  useEffect(() => {
    console.log('Current index:', currentIndex, 'Has shown notification:', hasShownSwipeNotification);
    if (currentIndex >= 4 && !hasShownSwipeNotification) {
      setHasShownSwipeNotification(true);
      setShowSwipeNotification(true);
      console.log('Showing 5 products swiped notification');
      
      // Animate in
      Animated.spring(notificationAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();

      // Auto-hide after 5 seconds
      setTimeout(() => {
        Animated.timing(notificationAnimation, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowSwipeNotification(false);
        });
      }, 5000);
    }
  }, [currentIndex, hasShownSwipeNotification, notificationAnimation]);

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

  const fetchUserCoinBalance = async () => {
    if (!userData?.id) return;

    try {
      const balance = await akoolService.getUserCoinBalance(userData.id);
      setCoinBalance(balance);
      
      // Also update the user context with the latest coin balance
      if (userData && balance !== userData.coin_balance) {
        setUserData({ ...userData, coin_balance: balance });
      }
    } catch (error) {
      console.error('Error fetching coin balance:', error);
    }
  };

  const fetchProductVendors = async () => {
    try {
      const vendorPromises = products.map(async (product) => {
        const vendor = await getVendorByProductId(product.id);
        return { productId: product.id, vendor };
      });
      
      const vendorResults = await Promise.all(vendorPromises);
      const vendorMap: { [productId: string]: any } = {};
      
      vendorResults.forEach(({ productId, vendor }) => {
        if (vendor) {
          vendorMap[productId] = vendor;
        }
      });
      
      setProductVendors(vendorMap);
    } catch (error) {
      console.error('Error fetching product vendors:', error);
    }
  };

  // Helpers for mock vendor fallback and username formatting
  const slugifyName = (name: string) =>
    (name || 'vendor')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '.');

  const generateMockVendor = (product: Product) => {
    const baseName = product.alias_vendor || product.vendor_name || product.name || 'Vendor';
    const handle = slugifyName(baseName);
    return {
      id: `mock_${product.id}`,
      business_name: baseName,
      profile_image_url: 'https://via.placeholder.com/100',
      follower_count: Math.floor(100 + Math.random() * 900),
      following_count: Math.floor(10 + Math.random() * 200),
      is_verified: false,
      username: `@${handle}`,
    };
  };

  const isFollowingVendorSafe = (vendorId: string) => {
    if (vendorId?.startsWith('mock_')) {
      return !!mockFollowStates[vendorId];
    }
    return isFollowingVendor(vendorId);
  };

  const fetchTrendingProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          created_at,
          name,
          description,
          category_id,
          is_active,
          updated_at,
          featured_type,
          like_count,
          return_policy,
          vendor_name,
          alias_vendor,
          vendor_id,
          category:categories(name),
          product_variants(
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
            size:sizes(name)
          )
        `)
        .eq('featured_type', 'trending')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching trending products:', error);
        return;
      }

      // Fix: category comes as array, map to object
      const fixedData = (data || []).map((item: any) => ({
        ...item,
        category: Array.isArray(item.category) ? item.category[0] : item.category,
        variants: item.product_variants || [],
      })).filter(product => {
        // Only show products with featured_type = 'trending' and have videos (not just images)
        const hasVideos = product.variants.some((variant: any) =>
          variant.video_urls && variant.video_urls.length > 0
        );
        const isTrending = product.featured_type === 'trending';
        return isTrending && hasVideos;
      });

      setProducts(fixedData);

      // Fetch ratings for products
      const productIds = fixedData.map(product => product.id);
      await fetchProductRatings(productIds);

      // Initialize like counts
      const initialLikeCounts = fixedData.reduce((acc: { [id: string]: number }, product) => {
        acc[product.id] = product.like_count || 0;
        return acc;
      }, {});
      setLikeCounts(initialLikeCounts);
    } catch (error) {
      console.error('Error fetching trending products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserLikes = async () => {
    if (!userData?.id) return;

    try {
      const { data, error } = await supabase
        .from('product_likes')
        .select('product_id')
        .eq('user_id', userData.id);

      if (error) {
        console.error('Error fetching user likes:', error);
        return;
      }

      // Create a map of liked product IDs
      const likedProductIds = (data || []).reduce((acc: { [id: string]: boolean }, like: any) => {
        acc[like.product_id] = true;
        return acc;
      }, {});

      setLikeStates(likedProductIds);
    } catch (error) {
      console.error('Error fetching user likes:', error);
    }
  };

  const toggleLikeInSupabase = async (productId: string, isLiked: boolean) => {
    if (!userData?.id) return;

    try {
      if (isLiked) {
        // Remove like
        const { error } = await supabase
          .from('product_likes')
          .delete()
          .eq('user_id', userData.id)
          .eq('product_id', productId);

        if (error) {
          console.error('Error removing like:', error);
          return false;
        }
      } else {
        // Add like
        const { error } = await supabase
          .from('product_likes')
          .insert({
            user_id: userData.id,
            product_id: productId,
          });

        if (error) {
          console.error('Error adding like:', error);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Error toggling like:', error);
      return false;
    }
  };

  const handleSelectVideo = (itemId: string, videoIdx: number) => {
    setSelectedVideoIndexes((prev) => ({ ...prev, [itemId]: videoIdx }));
  };

  const togglePlay = (itemId: string) => {
    setVideoStates((prev) => {
      const prevState = prev[itemId] || { isPlaying: true, isMuted: true };
      const newState = { ...prevState, isPlaying: !prevState.isPlaying };
      const ref = videoRefs.current[itemId];
      if (ref) {
        if (newState.isPlaying) ref.playAsync();
        else ref.pauseAsync();
      }
      return { ...prev, [itemId]: newState };
    });
  };

  const toggleMute = (itemId: string) => {
    setVideoStates((prev) => {
      const prevState = prev[itemId] || { isPlaying: true, isMuted: false };
      const newState = { ...prevState, isMuted: !prevState.isMuted };
      const ref = videoRefs.current[itemId];
      if (ref) ref.setIsMutedAsync(newState.isMuted);
      return { ...prev, [itemId]: newState };
    });
  };

  const handleShopNow = (product: Product) => {
    console.log(product.video_urls, 'product video urls');
    const userPrice = getUserPrice(product);

    // Get discount from first variant that has it
    const firstVariantWithDiscount = product.variants.find(v => v.discount_percentage && v.discount_percentage > 0);
    const discountPercentage = firstVariantWithDiscount?.discount_percentage || 0;
    const hasDiscount = discountPercentage > 0;
    const originalPrice = hasDiscount ? userPrice / (1 - discountPercentage / 100) : userPrice;
    const discountedPrice = userPrice;

    // const productForDetails = {
    //       id: product.id,
    //       name: product.name,
    //       price: discountedPrice,
    //       originalPrice: hasDiscount ? originalPrice : undefined,
    //       discount: discountPercentage,
    //       rating: 4.5, // Default rating
    //       reviews: 0, // Default reviews
    //       image: getFirstSafeProductImage(product),
    //       image_urls: getProductImages(product),
    //       description: product.description,
    //       stock_quantity: product.variants.reduce((sum, v) => sum + v.quantity, 0),
    //       variants: product.variants,
    //       featured: product.featured_type !== null,
    //       images: 1,

    //     };

    const productForDetails = {
      id: product.id,
      name: product.name,
      price: discountedPrice,
      originalPrice: hasDiscount ? originalPrice : undefined,
      discount: Math.max(...(product.variants?.map(v => v.discount_percentage || 0) || [0])),
      rating: productRatings[product.id]?.rating || 0, // Real rating from product_reviews
      reviews: productRatings[product.id]?.reviews || 0, // Real review count from product_reviews
      image: getFirstSafeProductImage(product),
      image_urls: getProductImages(product),
      video_urls: product.video_urls || [],
      description: product.description,
      featured: product.featured_type !== null,
      images: 1,
      sku: product.variants?.[0]?.sku || '',
      category: product.category?.name || '',
      vendor_name: product.vendor_name || '',
      alias_vendor: product.alias_vendor || '',
      return_policy: product.return_policy || '',
    };

    setProductForDetails(productForDetails as any);
    setShowProductDetailsSheet(true);
    console.log('✅ ProductDetailsBottomSheet should now be visible');
  };

  const handleWishlist = (product: Product) => {
    const wishlistProduct = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: productPrices[product.id] || 0,
      image_url: getFirstSafeProductImage(product),
      image_urls: getProductImages(product),
      video_urls: [], // Get from variants if needed
      featured_type: product.featured_type || undefined,
      category: product.category,
      stock_quantity: product.variants.reduce((sum, v) => sum + v.quantity, 0),
      variants: product.variants,
    };
    toggleWishlist({ ...wishlistProduct, price: productPrices[product.id] || 0 });
  };

  const handleLike = async (productId: string) => {
    const currentLikeState = likeStates[productId] || false;
    const newLikeState = !currentLikeState;
    const currentLikeCount = likeCounts[productId] || 0;

    // Optimistically update UI
    setLikeStates((prev) => ({ ...prev, [productId]: newLikeState }));
    setLikeCounts((prev) => ({
      ...prev,
      [productId]: newLikeState ? currentLikeCount + 1 : Math.max(0, currentLikeCount - 1)
    }));

    // Update in Supabase
    const success = await toggleLikeInSupabase(productId, currentLikeState);

    if (!success) {
      // Revert UI if Supabase update failed
      setLikeStates((prev) => ({ ...prev, [productId]: currentLikeState }));
      setLikeCounts((prev) => ({ ...prev, [productId]: currentLikeCount }));
    }
  };

  const handleVideoTap = (productId: string) => {
    setVideoStates((prev) => {
      const prevState = prev[productId] || { isPlaying: true, isMuted: false };
      const newState = { ...prevState, isMuted: !prevState.isMuted };
      const ref = videoRefs.current[productId];
      if (ref) {
        ref.setIsMutedAsync(newState.isMuted);
      }
      return { ...prev, [productId]: newState };
    });
  };

  const handleFollowVendor = async (vendorId: string) => {
    if (!userData?.id) {
      Alert.alert('Login Required', 'Please login to follow vendors');
      return;
    }

    try {
      if (vendorId.startsWith('mock_')) {
        const currentlyFollowing = !!mockFollowStates[vendorId];
        setMockFollowStates(prev => ({ ...prev, [vendorId]: !currentlyFollowing }));
        Toast.show({
          type: 'success',
          text1: currentlyFollowing ? 'Unfollowed' : 'Following',
          text2: currentlyFollowing ? 'You unfollowed this vendor' : 'You are now following this vendor',
        });
        return;
      }

      const isFollowing = isFollowingVendor(vendorId);
      const success = isFollowing
        ? await unfollowVendor(vendorId)
        : await followVendor(vendorId);

      if (success) {
        Toast.show({
          type: 'success',
          text1: isFollowing ? 'Unfollowed' : 'Following',
          text2: isFollowing ? 'You unfollowed this vendor' : 'You are now following this vendor',
        });
      } else {
        Alert.alert('Error', 'Failed to update follow status');
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const handleVendorProfile = (vendor: any) => {
    navigation.navigate('VendorProfile' as never, { 
      vendorId: vendor.id, 
      vendor 
    } as never);
  };

  const handleVirtualTryOn = async (product: Product) => {
    await (refreshUserData?.() as any)?.catch?.(() => {});
    if (!userData?.id || !userData?.profilePhoto) {
      Alert.alert('Error', 'Please upload a profile photo first');
      return;
    }

    if (coinBalance < 25) {
      Alert.alert('Insufficient Coins', 'You need at least 25 coins for Virtual Try-On. Please purchase more coins.');
      return;
    }

    const productId = product.id;
    // Get image from first variant that has images, or fallback to product image_urls
    const firstVariantWithImage = product.variants?.find(v => v.image_urls && v.image_urls.length > 0);
    const productImageUrl = firstVariantWithImage?.image_urls?.[0] || product.image_urls?.[0];

    console.log('👗 Virtual Try-On - Product:', {
      id: productId,
      name: product.name,
      variants: product.variants?.map(v => ({ id: v.id, image_urls: v.image_urls })),
      firstVariantWithImage: firstVariantWithImage?.image_urls,
      productImageUrl
    });

    if (!productImageUrl) {
      Alert.alert('Error', 'Product image not available');
      return;
    }

    setShowTryOnModal(false);

    try {
      // Update coin balance (deduct 25 coins for virtual try-on)
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

      // Initiate virtual try-on with PiAPI
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
          text1: 'Virtual Try-On Started',
          text2: 'Your virtual try-on is being processed. This may take a few minutes.',
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

        Alert.alert('Error', response.error || 'Failed to start virtual try-on');
      }
    } catch (error) {
      console.error('Error starting virtual try-on:', error);
      Alert.alert('Error', 'Failed to start virtual try-on. Please try again.');
    }
  };

  const handleVideoFaceSwap = async (product: Product) => {
    if (!userData?.id || !userData?.profilePhoto) {
      Alert.alert('Error', 'Please upload a profile photo first');
      return;
    }

    if (coinBalance < 25) {
      Alert.alert('Insufficient Coins', 'You need at least 25 coins for Video Preview. Please purchase more coins.');
      return;
    }

    const productId = product.id;
    // Get video from first variant that has videos, or fallback to product video_urls
    const firstVariantWithVideo = product.variants?.find(v => v.video_urls && v.video_urls.length > 0);
    const productVideoUrl = firstVariantWithVideo?.video_urls?.[0] || product.video_urls?.[0];

    console.log('🎬 Video face swap - Product:', {
      id: productId,
      name: product.name,
      variants: product.variants?.map(v => ({ id: v.id, video_urls: v.video_urls })),
      firstVariantWithVideo: firstVariantWithVideo?.video_urls,
      productVideoUrl
    });

    if (!productVideoUrl) {
      Alert.alert('Error', 'Product video not available for video preview');
      return;
    }

    setShowTryOnModal(false);

    try {
      // Update coin balance (deduct 25 coins for video face swap)
      setCoinBalance(prev => prev - 25);
      
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
        // PiAPI always processes asynchronously - start polling
        startVideoFaceSwapPolling(productId, response.taskId);

        Toast.show({
          type: 'success',
          text1: 'Video Face Swap Started',
          text2: 'Processing video (auto-resize/compression if needed). Using smart polling to track progress.',
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
        console.log(`[Trending] Polling attempt ${pollCount}/${maxPollAttempts}`);
        
        const status = await piAPIVirtualTryOnService.checkTaskStatus(taskId);

        if (status.status === 'completed' && status.resultImages) {
          clearInterval(interval);

          // Save results permanently
          if (userData?.id) {
            await akoolService.saveFaceSwapResults(userData.id, productId, status.resultImages);
          }

          // Add product to preview
          const currentProduct = products.find(p => p.id === productId);
          if (currentProduct) {
            const orderedImages = (status.resultImages || []).sort((a, b) => {
              const aApi = /theapi\.app/i.test(a) ? 0 : 1;
              const bApi = /theapi\.app/i.test(b) ? 0 : 1;
              return aApi - bApi;
            });
            const personalizedProduct = {
              id: `personalized_${productId}_${Date.now()}`,
              name: currentProduct.name,
              description: `Personalized ${currentProduct.name} with your face`,
              price: 0,
              image_urls: orderedImages,
              video_urls: [],
              featured_type: 'personalized',
              category: currentProduct.category,
              stock_quantity: 1,
              variants: [],
              isPersonalized: true,
              originalProductImage: currentProduct.variants?.[0]?.image_urls?.[0] || currentProduct.image_urls?.[0] || '',
              faceSwapDate: new Date().toISOString(),
              originalProductId: productId,
            };
            addToPreview(personalizedProduct);
          }

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
          console.warn('[Trending] Face swap polling timeout');
          Alert.alert(
            'Processing Timeout', 
            'Face swap is taking longer than expected. Please try again later or contact support if the issue persists.'
          );
        }
      } catch (error) {
        console.error('Error checking face swap status:', error);
      }
    }, 5000); // Poll every 5 seconds
  };

  const startVideoFaceSwapPolling = (productId: string, taskId: string) => {
    let pollCount = 0;
    const maxPollAttempts = 120; // 10 minutes timeout for video (120 * 5 seconds) - videos take longer
    
    const interval = setInterval(async () => {
      try {
        pollCount++;
        console.log(`[Trending] Video polling attempt ${pollCount}/${maxPollAttempts}`);
        
        const status = await piAPIVirtualTryOnService.checkTaskStatus(taskId);

        if (status.status === 'completed' && (status as any).resultVideo) {
          clearInterval(interval);

          // Save results permanently (store video URL in result_images array)
          if (userData?.id) {
            await akoolService.saveFaceSwapResults(userData.id, productId, [(status as any).resultVideo]);
          }

          // Add video product to preview
          const currentProduct = products.find(p => p.id === productId);
          if (currentProduct) {
            const personalizedProduct = {
              id: `personalized_video_${productId}_${Date.now()}`,
              name: `${currentProduct.name} (Video Preview)`,
              description: `Personalized video of ${currentProduct.name} with your face`,
              price: 0,
              image_urls: [], // No images for video preview
              video_urls: [(status as any).resultVideo],
              featured_type: 'personalized',
              category: currentProduct.category,
              stock_quantity: 1,
              variants: [],
              isPersonalized: true,
              isVideoPreview: true,
              originalProductImage: currentProduct.variants?.[0]?.image_urls?.[0] || currentProduct.image_urls?.[0] || '',
              originalProductVideo: (status as any).resultVideo,
              faceSwapDate: new Date().toISOString(),
              originalProductId: productId,
            };
            addToPreview(personalizedProduct);
          }

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
          console.warn('[Trending] Video face swap polling timeout');
          Alert.alert(
            'Processing Timeout', 
            'Video face swap is taking longer than expected. Video processing can take up to 10 minutes. Please try again later or contact support if the issue persists.'
          );
        }
      } catch (error) {
        console.error('Error checking video face swap status:', error);
      }
    }, 5000); // Poll every 5 seconds
  };



  const renderVideoItem = (product: Product, index: number) => {
    const selectedIdx = selectedVideoIndexes[product.id] || 0;
    const videoState = videoStates[product.id] || { isPlaying: true, isMuted: false };
    const isActive = index === currentIndex;

    // Get media from variants
    const firstVariant = product.variants[0];

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

    // Helper function to check if URL is a video
    const isVideoUrl = (url: string) => {
      if (!url) return false;
      const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
      const lowerUrl = url.toLowerCase();
      return videoExtensions.some(ext => lowerUrl.includes(ext)) ||
        lowerUrl.includes('video') ||
        lowerUrl.includes('mp4') ||
        lowerUrl.includes('drive.google.com'); // Assume Google Drive URLs are videos
    };

    // Get all video URLs from variants and product
    const allVideoUrls: string[] = [];

    // Check variants for videos
    product.variants.forEach(variant => {
      if (variant.video_urls && Array.isArray(variant.video_urls)) {
        variant.video_urls.forEach(url => {
          if (isVideoUrl(url)) {
            const convertedUrl = convertGoogleDriveVideoUrl(url);
            allVideoUrls.push(convertedUrl);
          }
        });
      }
    });

    // Check product level video_urls
    if (product.video_urls && Array.isArray(product.video_urls)) {
      product.video_urls.forEach(url => {
        if (isVideoUrl(url)) {
          const convertedUrl = convertGoogleDriveVideoUrl(url);
          allVideoUrls.push(convertedUrl);
        }
      });
    }

    const hasVideo = allVideoUrls.length > 0;
    const hasImage = !!(firstVariant?.image_urls?.[0] || product.image_urls?.[0]);

    const isLiked = likeStates[product.id] || false;
    const inWishlist = isInWishlist(product.id);
    const vendor = productVendors[product.id] || generateMockVendor(product);
    // Use demo usernames for all products (not product-derived)
    const demoHandles = [
      '@style.hub',
      '@trend.house',
      '@urban.outfits',
      '@daily.fit',
      '@shop.boutique',
      '@couture.club',
      '@lookbook.now',
      '@vogue.vault',
      '@wearwave',
      '@the.drape'
    ];
    const vendorHandle = demoHandles[index % demoHandles.length];

    // Face swap state
    // const isFaceSwapProcessing = faceSwapProcessing[product.id] || false;

    // Create video array for consistency (single video or image)
    const mediaItems = hasVideo && allVideoUrls.length > 0 ? [{ url: allVideoUrls[0], thumbnail: firstVariant.image_urls?.[0] || product.image_urls?.[0] }] :
      hasImage ? [{ url: null, thumbnail: firstVariant.image_urls?.[0] || product.image_urls?.[0] }] :
        [{ url: null, thumbnail: 'https://via.placeholder.com/400x600/cccccc/999999?text=No+Image' }];

    if (mediaItems.length === 0) {
      return null;
    }

    const mainMedia = mediaItems[selectedIdx];

    const commentCount = commentCounts[product.id] || 0;

    // Calculate total stock from variants
    const totalStock = product.variants?.reduce((sum, variant) => sum + (variant.quantity || 0), 0) || product.stock_quantity || 0;
    const isLowStock = totalStock < 5;

    return (
      <View key={product.id} style={styles.videoContainer}>
        {/* Video/Image Background */}
        {hasVideo ? (
          <TouchableOpacity
            activeOpacity={1}
            style={styles.videoBackground}
            onPress={() => handleVideoTap(product.id)}
          >
            {/* Always show image as background/fallback */}
            <Image
              source={{ uri: mainMedia.thumbnail }}
              style={styles.videoBackground}
              resizeMode="cover"
            />

            {/* Video component - overlays image when loaded */}
            {mainMedia.url && (
              <Video
                ref={ref => { if (ref) videoRefs.current[product.id] = ref; }}
                source={{ uri: mainMedia.url }}
                style={[
                  styles.videoBackground,
                  {
                    opacity: videoLoadingStates[product.id] === true ? 1 : 0,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0
                  }
                ]}
                resizeMode={ResizeMode.COVER}
                shouldPlay={isActive && videoLoadingStates[product.id] === true}
                isLooping
                isMuted={videoState.isMuted}
                onLoadStart={() => {
                }}
                onLoad={() => {
                  setVideoLoadingStates(prev => ({ ...prev, [product.id]: true }));
                }}
                onError={(error) => {
                  setVideoLoadingStates(prev => ({ ...prev, [product.id]: false }));
                }}
              />
            )}

            {/* Gradient overlay for better readability */}
            <View style={styles.gradientOverlay} />
          </TouchableOpacity>
        ) : (
          <View>
          <Image
            source={{ uri: mainMedia.thumbnail }}
            style={styles.videoBackground}
            resizeMode="cover"
          />
            <View style={styles.gradientOverlay} />
          </View>
        )}

        {/* Top Bar Controls */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.topBarButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

          <View style={styles.topBarRight}>
            {hasVideo && (
              <TouchableOpacity
                style={styles.topBarButton}
                onPress={() => toggleMute(product.id)}
              >
                <Ionicons
                  name={videoState.isMuted ? 'volume-mute' : 'volume-high'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>
            )}
            
            {/* Wishlist button in top bar */}
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={async (e) => {
                e.stopPropagation && e.stopPropagation();
                if (isInWishlist(product.id)) {
                  toggleWishlist({
                    ...product,
                    price: productPrices[product.id] || 0,
                    featured_type: product.featured_type || undefined
                  });
                  if (userData?.id) {
                    await supabase
                      .from('collection_products')
                      .delete()
                      .match({ product_id: product.id });
                  }
                } else {
                  setSelectedProduct({
                    ...product,
                    price: productPrices[product.id] || 0,
                    featured_type: product.featured_type || undefined
                  } as any);
                  setShowCollectionSheet(true);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isInWishlist(product.id) ? 'heart' : 'heart-outline'}
                size={24}
                color={isInWishlist(product.id) ? '#F53F7A' : '#fff'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Right Side Actions with improved design */}
        <View style={styles.rightActions}>
          {/* Like button */}
          <TouchableOpacity
            style={styles.modernActionButton}
            onPress={async () => {
              // Toggle like for the product
              const currentLikeState = likeStates[product.id] || false;
              if (currentLikeState) {
                await handleLike(product.id);
                Toast.show({ type: 'info', text1: 'Removed from likes' });
              } else {
                await handleLike(product.id);
                Toast.show({ type: 'success', text1: 'Added to likes' });
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons
                name={likeStates[product.id] ? 'thumbs-up' : 'thumbs-up-outline'}
                size={28}
                color={likeStates[product.id] ? '#F53F7A' : '#fff'}
              />
            </View>
            <Text style={styles.modernActionText}>Like</Text>
          </TouchableOpacity>

          {/* Q&A button - replaced comments */}
          <TouchableOpacity 
            style={styles.modernActionButton} 
            onPress={() => openComments(product.id)}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="help-circle-outline" size={28} color="#fff" />
            </View>
            <Text style={styles.modernActionText}>Q&A</Text>
          </TouchableOpacity>

          {/* Share button */}
          <TouchableOpacity
            style={styles.modernActionButton}
            onPress={() => {
              setUGCActionProductId(product.id);
              shareSheetRef.current?.expand();
            }}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="paper-plane-outline" size={24} color="#fff" />
            </View>
            <Text style={styles.modernActionText}>Share</Text>
          </TouchableOpacity>

          {/* 3-dot menu for UGC actions */}
          <TouchableOpacity
            style={styles.modernActionButton}
            onPress={() => {
              setUGCActionProductId(product.id);
              ugcActionsSheetRef.current?.expand();
            }}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
            </View>
            <Text style={styles.modernActionText}>More</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom content with improved layout */}
        <View style={[styles.modernBottomContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Vendor Info */}
          <View style={styles.modernVendorRow}>
            <TouchableOpacity 
              style={styles.modernVendorInfo} 
              onPress={() => handleVendorProfile(vendor)}
              activeOpacity={0.8}
            >
                  <Image
                source={{ uri: vendor?.profile_image_url || 'https://via.placeholder.com/40' }}
                style={styles.modernVendorAvatar}
              />
              <View style={styles.modernVendorTextCol}>
                <View style={styles.vendorNameFollowRow}>
                  <Text style={styles.modernVendorHandle}>{vendorHandle}</Text>
              {vendor && (
                <TouchableOpacity
                  style={[
                        styles.compactFollowButton,
                        isFollowingVendorSafe(vendor.id) && styles.compactFollowingButton
                  ]}
                  onPress={() => handleFollowVendor(vendor.id)}
                      activeOpacity={0.8}
                >
                      <Text style={styles.compactFollowText}>
                    {isFollowingVendorSafe(vendor.id) ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
                <Text style={styles.modernProductName} numberOfLines={1}>{product.name}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Price Row */}
          <View style={styles.modernPriceRow}>
            <View style={styles.modernPriceGroup}>
              <Text style={styles.modernPrice}>₹{productPrices[product.id]?.toFixed(2) || '0.00'}</Text>
              {(() => {
                const maxDiscount = Math.max(...(product.variants?.map(v => v.discount_percentage || 0) || [0]));
                const hasDiscount = maxDiscount > 0;
                if (hasDiscount) {
                  const originalPrice = productPrices[product.id] / (1 - maxDiscount / 100);
                  return (
                    <View style={styles.modernDiscountRow}>
                      <Text style={styles.modernOriginalPrice}>₹{originalPrice.toFixed(2)}</Text>
                      <View style={styles.modernDiscountBadge}>
                        <Text style={styles.modernDiscountText}>{Math.round(maxDiscount)}% OFF</Text>
                      </View>
                    </View>
                  );
                }
                return null;
              })()}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.modernActionButtons}>
            <TouchableOpacity 
              style={styles.modernTryOnButton} 
              onPress={() => setShowTryOnModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="camera-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.modernTryOnText}>{t('try_on')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modernShopButton}
              onPress={() => {
                console.log(product, 'product');
                handleShopNow(product);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="cart-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.modernShopText}>{t('shop_now')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Memoize product prices to prevent unnecessary recalculations
  const productPrices = useMemo(() => {
    const prices: { [key: string]: number } = {};
    products.forEach(product => {
      prices[product.id] = getUserPrice(product);
    });
    return prices;
  }, [products, getUserPrice]);



  // Add this function to pause all videos except the current
  const pauseAllVideosExcept = (currentProductId: string | null) => {
    Object.entries(videoRefs.current).forEach(([id, ref]) => {
      if (currentProductId === null || id !== currentProductId) {
        if (ref && ref.pauseAsync) ref.pauseAsync();
      } else if (id === currentProductId && ref && ref.playAsync) {
        ref.playAsync();
      }
    });
  };

  // Pause all videos when screen loses focus
  useEffect(() => {
    if (!isFocused) {
      pauseAllVideosExcept(null);
    }
  }, [isFocused]);

  // Fetch comments for a product
  const fetchComments = async (productId: string) => {
    setCommentsLoading(true);
    const { data, error } = await supabase
      .from('comments')
      .select('*, users(name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });
    if (!error && data) {
      const mapped = data.map((c: any) => ({
          ...c,
          user_name: c.users?.name || 'User',
      }));
      const filtered = mapped.filter((c: any) => !blockedUserIds.includes(c.user_id));
      setComments(filtered);
      setCommentCounts(prev => ({ ...prev, [productId]: data.length }));
    }
    setCommentsLoading(false);
  };

  // Fetch comment counts for all products
  const fetchAllCommentCounts = async (productIds: string[]) => {
    if (productIds.length === 0) return;
    const { data, error } = await supabase
      .from('comments')
      .select('product_id, id');
    if (!error && data) {
      const counts: { [productId: string]: number } = {};
      productIds.forEach(pid => {
        counts[pid] = 0;
      });
      data.forEach((c: any) => {
        if (c.product_id && counts.hasOwnProperty(c.product_id)) {
          counts[c.product_id]++;
        }
      });
      setCommentCounts(counts);
    }
  };

  // Subscribe to realtime comments
  const subscribeToComments = (productId: string) => {
    if (commentsRealtimeSub) {
      supabase.removeChannel(commentsRealtimeSub);
    }
    const sub = supabase
      .channel('realtime:comments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `product_id=eq.${productId}` },
        (payload) => {
          fetchComments(productId);
          // Update comment count for this product
          setCommentCounts(prev => ({
            ...prev,
            [productId]: (prev[productId] || 0) + (payload.eventType === 'INSERT' ? 1 : payload.eventType === 'DELETE' ? -1 : 0)
          }));
        }
      )
      .subscribe();
    setCommentsRealtimeSub(sub);
  };

  // Open comments sheet
  const openComments = (productId: string) => {
    setCommentsProductId(productId);
    commentsSheetRef.current?.expand();
    fetchComments(productId);
    subscribeToComments(productId);
  };

  // Close comments sheet
  const closeComments = () => {
    commentsSheetRef.current?.close();
    setCommentsProductId(null);
    setComments([]);
    if (commentsRealtimeSub) {
      supabase.removeChannel(commentsRealtimeSub);
      setCommentsRealtimeSub(null);
    }
  };

  // Add new comment
  const handleAddComment = async () => {
    if (!userData?.id || !commentsProductId || !newComment?.trim()) return;
    // Simple profanity filter
    const banned = ['abuse', 'hate', 'violence', 'porn', 'nsfw'];
    const lowered = newComment.toLowerCase();
    if (banned.some(w => lowered.includes(w))) {
      Alert.alert('Content Not Allowed', 'Your comment contains objectionable content.');
      return;
    }
    const { data, error } = await supabase
      .from('comments')
      .insert({
        user_id: userData.id,
        product_id: commentsProductId,
        content: newComment.trim(),
      })
      .select('*, users(name)');
    if (!error && data && data.length > 0) {
      setNewComment('');
      setComments(prev => [
        ...prev,
        {
          ...data[0],
          user_name: data[0].users?.name || 'User',
        },
      ]);
      setCommentCounts(prev => ({
        ...prev,
        [commentsProductId]: (prev[commentsProductId] || 0) + 1
      }));
    }
  };

  if (loading && !hasError) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          {/* Skeleton Loading */}
          <View style={styles.skeletonContainer}>
            <View style={styles.skeletonVideoContainer}>
              <View style={styles.skeletonVideo} />
              <View style={styles.skeletonOverlay}>
                <View style={styles.skeletonBackButton} />
                <View style={styles.skeletonRightActions}>
                  <View style={styles.skeletonActionButton} />
                  <View style={styles.skeletonActionButton} />
                  <View style={styles.skeletonActionButton} />
                </View>
                <View style={styles.skeletonBottomContent}>
                  <View style={styles.skeletonTitle} />
                  <View style={styles.skeletonPrice} />
                  <View style={styles.skeletonButtons}>
                    <View style={styles.skeletonButton} />
                    <View style={styles.skeletonButton} />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (hasError) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <Ionicons name="cloud-offline-outline" size={64} color="#999" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>Failed to load trending products</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setHasError(false);
              fetchTrendingProducts();
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (products.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButtonTopLeft} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={32} color="#fff" style={styles.iconShadow} />
        </TouchableOpacity>
        
        {/* Debug Button */}
        <TouchableOpacity 
          style={styles.debugButton}
          onPress={() => {
            setLoading(true);
            fetchTrendingProducts();
          }}
        >
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.emptyContainer}>
          <Ionicons name="trending-up-outline" size={64} color="#999" />
          <Text style={styles.emptyTitle}>{t('no_trending_products_available')}</Text>
          <Text style={styles.emptySubtitle}>{t('check_back_later')}</Text>
          
          {/* Debug Info */}
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>Loading: {loading ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Has Error: {hasError ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Products Count: {products.length}</Text>

          </View>
          
          {/* Retry Button */}
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              fetchTrendingProducts();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        orientation="vertical"
        onPageSelected={(e) => {
          setCurrentIndex(e.nativeEvent.position);
          const product = products[e.nativeEvent.position];
          if (product) pauseAllVideosExcept(product.id);
        }}
        initialPage={0}
      >
        {products.map((product, index) => renderVideoItem(product, index))}
      </PagerView>
      {showTryOnModal && (
        <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 9999 }}>
          <View style={styles.akoolModal}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowTryOnModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.akoolTitle}>👗 Want to see how this outfit looks on you?</Text>
            <Text style={styles.akoolSubtitle}>Try on with Virtual Try-On AI</Text>
            <View style={styles.akoolOptions}>
              <TouchableOpacity
                style={[styles.akoolOption, selectedOption === 'photo' && styles.akoolOptionSelected]}
                onPress={() => setSelectedOption('photo')}
              >
                <View style={styles.radioCircle}>
                  {selectedOption === 'photo' && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.akoolOptionTitle}>{t('photo_preview')} <Text style={styles.akoolCoin}>25 {t('coins')}</Text></Text>
                  <Text style={styles.akoolOptionDesc}>{t('get_3_styled_images')}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.akoolOption, selectedOption === 'video' && styles.akoolOptionSelected]}
                onPress={() => setSelectedOption('video')}
              >
                <View style={styles.radioCircle}>
                  {selectedOption === 'video' && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.akoolOptionTitle}>{t('video_preview')} <Text style={styles.akoolCoin}>25 {t('coins')}</Text></Text>
                  <Text style={styles.akoolOptionDesc}>{t('get_short_hd_reel')}</Text>
                </View>
              </TouchableOpacity>
            </View>
            <Text style={styles.akoolBalance}>{t('available_balance')}: <Text style={{ color: '#F53F7A', fontWeight: 'bold' }}>{coinBalance} {t('coins')}</Text></Text>
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
                  const currentProduct = products[currentIndex];
                  if (currentProduct) {
                    handleVirtualTryOn(currentProduct);
                  }
                } else if (selectedOption === 'video') {
                  // Show initial success message for video
                  Toast.show({
                    type: 'success',
                    text1: 'Video Face Swap Started',
                    text2: 'Video processing may take several minutes',
                  });

                  // Perform video face swap
                  const currentProduct = products[currentIndex];
                  if (currentProduct) {
                    handleVideoFaceSwap(currentProduct);
                  }
                }
              }}
            >
              <Text style={styles.akoolContinueText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <SaveToCollectionSheet
        visible={showCollectionSheet}
        product={selectedProduct}
        onClose={() => setShowCollectionSheet(false)}
        onSaved={(product, collectionName) => {
          // Show saved popup when product is successfully saved
          setSavedProductName(product.name);
          setShowSavedPopup(true);
          // Store collection name for display
          setSavedProductName(collectionName);
        }}
      />
      <ProductDetailsBottomSheet
        visible={showProductDetailsSheet}
        product={productForDetails as any}
        onClose={() => setShowProductDetailsSheet(false)}
      />

      {/* Q&A Bottom Sheet */}
      <BottomSheet
        ref={commentsSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        onClose={closeComments}
        backgroundStyle={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18 }}
        handleIndicatorStyle={{ backgroundColor: '#ccc' }}
        style={{ padding: 20, }}
      >
        <View style={styles.commentsHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="help-circle" size={24} color="#F53F7A" style={{ marginRight: 8 }} />
            <Text style={styles.commentsTitle}>Questions & Answers</Text>
          </View>
          <TouchableOpacity onPress={closeComments}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        {commentsLoading ? (
          <ActivityIndicator size="large" color="#F53F7A" style={{ marginTop: 32 }} />
        ) : comments.length === 0 ? (
          <View style={styles.noCommentsContainer}>
            <Ionicons name="help-circle-outline" size={48} color="#ccc" />
            <Text style={styles.noCommentsTitle}>No questions yet</Text>
            <Text style={styles.noCommentsSubtitle}>Be the first to ask about this product!</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.qaItem}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <Ionicons name="person-circle" size={20} color="#666" style={{ marginRight: 6 }} />
                <Text style={styles.commentUser}>{item.user_name || 'User'}</Text>
                      <Text style={styles.qaDate}> • {new Date(item.created_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.questionBubble}>
                      <Text style={styles.qaQuestion}>Q: {item.content}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', marginLeft: 8 }}>
                    <TouchableOpacity
                      style={{ marginRight: 12 }}
                      onPress={async () => {
                        try {
                          await supabase.from('ugc_reports').insert({
                            reporter_id: userData?.id || null,
                            target_user_id: item.user_id,
                            product_id: commentsProductId,
                            comment_id: item.id,
                            reason: 'inappropriate',
                          });
                          Toast.show({ type: 'success', text1: 'Reported', text2: 'Thanks for keeping Only2U safe.' });
                        } catch {}
                      }}
                    >
                      <Ionicons name="flag-outline" size={16} color="#999" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => {
                        if (!userData?.id) return;
                        try {
                          await supabase.from('blocked_users').insert({ user_id: userData.id, blocked_user_id: item.user_id });
                          setBlockedUserIds(prev => [...prev, item.user_id]);
                          setComments(prev => prev.filter(c => c.user_id !== item.user_id));
                          Toast.show({ type: 'success', text1: 'User blocked' });
                        } catch {}
                      }}
                    >
                      <Ionicons name="ban-outline" size={16} color="#999" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 16 }}
            style={{ flex: 1 }}
          />
        )}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={10}
        >
          <View style={styles.commentInputBar}>
            <TextInput
              style={styles.commentInput}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Ask a question about this product..."
              placeholderTextColor="#999"
              multiline
            />
            <TouchableOpacity style={styles.sendCommentBtn} onPress={handleAddComment}>
              <Ionicons name="send" size={24} color="#F53F7A" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>

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
          ]}
        >
          <View style={styles.savedPopupContent}>
            <View style={styles.savedPopupLeft}>
              <Image
                source={{ uri: getFirstSafeProductImage(selectedProduct) }}
                style={styles.savedPopupImage}
              />
            </View>
            <View style={styles.savedPopupText}>
              <Text style={styles.savedPopupTitle}>Saved!</Text>
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
              }}
            >
              <Text style={styles.savedPopupViewText}>View</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* UGC Actions Bottom Sheet */}
      <BottomSheet
        ref={ugcActionsSheetRef}
        index={-1}
        snapPoints={['40%', '50%']}
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: '#ccc' }}
      >
        <View style={styles.ugcActionsContainer}>
          <View style={styles.ugcActionsHeader}>
            <Text style={styles.ugcActionsTitle}>Actions</Text>
            <TouchableOpacity onPress={() => ugcActionsSheetRef.current?.close()}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Report */}
          <TouchableOpacity
            style={styles.ugcActionItem}
            onPress={async () => {
              try {
                if (ugcActionProductId) {
                  await supabase.from('ugc_reports').insert({
                    reporter_id: userData?.id || null,
                    product_id: ugcActionProductId,
                    reason: 'inappropriate',
                  });
                  Toast.show({ 
                    type: 'success', 
                    text1: 'Reported', 
                    text2: 'Thanks for keeping Only2U safe.' 
                  });
                  ugcActionsSheetRef.current?.close();
                }
              } catch (error) {
                Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to report' });
              }
            }}
          >
            <View style={styles.ugcActionIconContainer}>
              <Ionicons name="flag" size={22} color="#EF4444" />
            </View>
            <View style={styles.ugcActionTextContainer}>
              <Text style={styles.ugcActionTitle}>Report</Text>
              <Text style={styles.ugcActionSubtitle}>Report this content</Text>
            </View>
          </TouchableOpacity>

          {/* Not Interested */}
          <TouchableOpacity
            style={styles.ugcActionItem}
            onPress={() => {
              if (ugcActionProductId) {
                Toast.show({ 
                  type: 'success', 
                  text1: 'Noted', 
                  text2: "We'll show you less like this" 
                });
                ugcActionsSheetRef.current?.close();
              }
            }}
          >
            <View style={styles.ugcActionIconContainer}>
              <Ionicons name="eye-off" size={22} color="#6B7280" />
            </View>
            <View style={styles.ugcActionTextContainer}>
              <Text style={styles.ugcActionTitle}>Not Interested</Text>
              <Text style={styles.ugcActionSubtitle}>See fewer posts like this</Text>
            </View>
          </TouchableOpacity>

          {/* Block User */}
          <TouchableOpacity
            style={styles.ugcActionItem}
            onPress={async () => {
              try {
                const product = products.find(p => p.id === ugcActionProductId);
                if (product && userData?.id) {
                  const vendor = productVendors[product.id];
                  if (vendor) {
                    await supabase.from('blocked_users').insert({
                      blocker_id: userData.id,
                      blocked_id: vendor.id,
                    });
                    setBlockedUserIds([...blockedUserIds, vendor.id]);
                    Toast.show({ 
                      type: 'success', 
                      text1: 'Blocked', 
                      text2: 'You won\'t see content from this user' 
                    });
                    ugcActionsSheetRef.current?.close();
                  }
                }
              } catch (error) {
                Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to block user' });
              }
            }}
          >
            <View style={styles.ugcActionIconContainer}>
              <Ionicons name="ban" size={22} color="#DC2626" />
            </View>
            <View style={styles.ugcActionTextContainer}>
              <Text style={styles.ugcActionTitle}>Block User</Text>
              <Text style={styles.ugcActionSubtitle}>Block this vendor</Text>
            </View>
          </TouchableOpacity>

          {/* Share to... */}
          <TouchableOpacity
            style={styles.ugcActionItem}
            onPress={async () => {
              try {
                const product = products.find(p => p.id === ugcActionProductId);
                if (product) {
                  const shareUrl = product.image_urls?.[0] || '';
                  if (shareUrl) {
                    Clipboard.setString(shareUrl);
                    Toast.show({ 
                      type: 'success', 
                      text1: 'Link Copied', 
                      text2: 'Share link copied to clipboard' 
                    });
                  }
                  ugcActionsSheetRef.current?.close();
                }
              } catch (error) {
                Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to copy link' });
              }
            }}
          >
            <View style={styles.ugcActionIconContainer}>
              <Ionicons name="share-social" size={22} color="#3B82F6" />
            </View>
            <View style={styles.ugcActionTextContainer}>
              <Text style={styles.ugcActionTitle}>Share to...</Text>
              <Text style={styles.ugcActionSubtitle}>Share via other apps</Text>
            </View>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Share Bottom Sheet */}
      <BottomSheet
        ref={shareSheetRef}
        index={-1}
        snapPoints={['30%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#fff' }}
      >
        <View style={styles.ugcActionsContainer}>
          <View style={styles.ugcActionsHeader}>
            <Text style={styles.ugcActionsTitle}>Share Product</Text>
            <TouchableOpacity onPress={() => shareSheetRef.current?.close()}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Share Options Row */}
          <View style={styles.shareOptionsRow}>
            {/* WhatsApp */}
            <TouchableOpacity
              style={styles.shareOptionCard}
              onPress={async () => {
                try {
                  const product = products.find(p => p.id === ugcActionProductId);
                  if (product) {
                    const firstVariant = product.variants?.[0];
                    const shareUrl = firstVariant?.image_urls?.[0] || product.image_urls?.[0] || '';
                    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(`Check out this product: ${shareUrl}`)}`;
                    
                    const canOpen = await Linking.canOpenURL(whatsappUrl);
                    if (canOpen) {
                      await Linking.openURL(whatsappUrl);
                      
                      // Award coins after 10 seconds
                      setTimeout(async () => {
                        if (userData?.id) {
                          await akoolService.awardReferralCoins(userData.id, product.id, 'share_button', 2);
                          setCoinBalance((prev) => prev + 2);
                          Toast.show({ 
                            type: 'success', 
                            text1: t('coins_awarded') || 'Coins awarded', 
                            text2: '+2 coins for sharing' 
                          });
                        }
                      }, 10000);
                    } else {
                      Toast.show({ 
                        type: 'error', 
                        text1: 'WhatsApp not installed', 
                        text2: 'Please install WhatsApp to share' 
                      });
                    }
                    shareSheetRef.current?.close();
                  }
                } catch (error) {
                  Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to share via WhatsApp' });
                }
              }}
            >
              <View style={styles.shareOptionIconCircle}>
                <Ionicons name="logo-whatsapp" size={32} color="#25D366" />
              </View>
              <Text style={styles.shareOptionTitle}>WhatsApp</Text>
              <Text style={styles.shareOptionSubtitle}>Share via app</Text>
            </TouchableOpacity>

            {/* Copy Link */}
            <TouchableOpacity
              style={styles.shareOptionCard}
              onPress={async () => {
                try {
                  const product = products.find(p => p.id === ugcActionProductId);
                  if (product) {
                    const firstVariant = product.variants?.[0];
                    const shareUrl = firstVariant?.image_urls?.[0] || product.image_urls?.[0] || '';
                    if (shareUrl) {
                      Clipboard.setString(shareUrl);
                      Toast.show({ 
                        type: 'success', 
                        text1: 'Link Copied', 
                        text2: 'Share link copied to clipboard' 
                      });
                      
                      // Award coins after 10 seconds
                      setTimeout(async () => {
                        if (userData?.id) {
                          await akoolService.awardReferralCoins(userData.id, product.id, 'share_button', 2);
                          setCoinBalance((prev) => prev + 2);
                          Toast.show({ 
                            type: 'success', 
                            text1: t('coins_awarded') || 'Coins awarded', 
                            text2: '+2 coins for sharing' 
                          });
                        }
                      }, 10000);
                    }
                    shareSheetRef.current?.close();
                  }
                } catch (error) {
                  Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to copy link' });
                }
              }}
            >
              <View style={styles.shareOptionIconCircle}>
                <Ionicons name="link" size={32} color="#3B82F6" />
              </View>
              <Text style={styles.shareOptionTitle}>Copy Link</Text>
              <Text style={styles.shareOptionSubtitle}>Copy to clipboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      {/* Custom Swipe Notification */}
      {showSwipeNotification && (
        <Animated.View 
          style={[
            styles.swipeNotification,
            {
              transform: [{ translateY: notificationAnimation }]
            }
          ]}
        >
          <View style={styles.notificationContent}>
            <View style={styles.notificationIconContainer}>
              <Ionicons name="sparkles" size={24} color="#F53F7A" />
            </View>
            <View style={styles.notificationTextContainer}>
              <Text style={styles.notificationTitle}>🎉 Keep Exploring!</Text>
              <Text style={styles.notificationSubtitle}>You've swiped through 5 products</Text>
            </View>
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => {
                Animated.timing(notificationAnimation, {
                  toValue: -100,
                  duration: 300,
                  useNativeDriver: true,
                }).start(() => {
                  setShowSwipeNotification(false);
                });
              }}
            >
              <Text style={styles.notificationButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
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
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
  },
  pagerView: {
    flex: 1,
  },
  videoContainer: {
    width: width,
    height: height,
    position: 'relative',
  },
  videoBackground: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'transparent',
    // Simulate gradient from transparent to black
    opacity: 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -100 },
    shadowOpacity: 1,
    shadowRadius: 100,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    zIndex: 100,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBarButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: Platform.OS === 'android' ? 140 : 160,
    alignItems: 'center',
    gap: 18,
    zIndex: 50,
  },
  modernActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconCircleActive: {
    backgroundColor: 'rgba(245, 63, 122, 0.2)',
  },
  modernActionText: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  modernBottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  modernVendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modernVendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modernVendorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: '#fff',
    marginRight: 10,
  },
  modernVendorTextCol: {
    flex: 1,
    marginRight: 12,
  },
  modernVendorHandle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.3,
  },
  modernProductName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    opacity: 0.9,
  },
  modernFollowButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F53F7A',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  modernFollowingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  modernFollowText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  vendorNameFollowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactFollowButton: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F53F7A',
  },
  compactFollowingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  compactFollowText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modernPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modernPriceGroup: {
    flex: 1,
  },
  priceAndRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  modernPrice: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  modernDiscountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  modernOriginalPrice: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textDecorationLine: 'line-through',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modernDiscountBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  modernDiscountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modernRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  modernRatingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modernReviewsText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '500',
  },
  modernActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  modernTryOnButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  modernTryOnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modernShopButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F53F7A',
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  modernShopText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '35%',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  actionButton: {
    alignItems: 'center',
    marginVertical: 16,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  bottomContent: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 60 : 120,
    left: 16,
    right: 80,
  },
  productInfo: {
    marginBottom: 16,
  },
  titleRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // justifyContent: 'space-between',
    marginBottom: 8,
  },
  productTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    // flex: 1,
    marginRight: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 4,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  price: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  originalPrice: {
    color: '#ccc',
    fontSize: 14,
    textDecorationLine: 'line-through',
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  discount: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  tryOnButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tryOnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  shopNowButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  shopNowText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  thumbnailsRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  thumbnailWrapper: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  selectedThumbnailWrapper: {
    borderColor: '#F53F7A',
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  playPauseButtonTop: {
    position: 'absolute',
    top: 24,
    left: 24,
    zIndex: 20,
  },
  muteButtonTop: {
    position: 'absolute',
    top: 24,
    right: 24,
    zIndex: 20,
  },
  iconShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
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
  backButtonTopLeft: {
    position: 'absolute',
    top: 24,
    left: 24,
    zIndex: 20,
    backgroundColor: 'rgba(69, 67, 67, 0.7)',
    borderRadius: 24,
    padding: 8,
  },
  muteButton: {
    position: 'absolute',
    top: 80,
    right: 26,
    zIndex: 20,
    backgroundColor: 'rgba(69, 67, 67, 0.7)',
    borderRadius: 24,
    padding: 8,
  },
  previewScrollContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 1000,
    maxWidth: 200,
  },
  previewScrollContent: {
    paddingVertical: 8,
  },
  previewItem: {
    marginBottom: 8,
    alignItems: 'center',
  },
  previewImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#F53F7A',
  },
  previewLabel: {
    marginTop: 2,
    color: '#fff',
    fontSize: 7,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  selectedPreviewItem: {
    borderColor: '#F53F7A',
    borderWidth: 3,
    borderRadius: 8,
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  imageLoadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  // backButtonBox: {
  //   position: 'absolute',
  //   top: 16,
  //   left: 16,
  //   backgroundColor: 'rgba(0,0,0,0.7)',
  //   borderRadius: 24,
  //   padding: 8,
  //   zIndex: 30,
  //   shadowColor: '#000',
  //   shadowOpacity: 0.25,
  //   shadowRadius: 8,
  //   shadowOffset: { width: 0, height: 2 },
  //   elevation: 8,
  // },
  wishlistIcon: {
    position: 'absolute',
    top: 24,
    right: 24,
    zIndex: 20,
    backgroundColor: 'rgba(69, 67, 67, 0.7)',
    borderRadius: 24,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  faceSwapProcessingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  faceSwapProcessingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  commentIcon: {
    position: 'absolute',
    top: 24,
    right: 70,
    zIndex: 20,
    padding: 8,
  },
  commentsSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    minHeight: 320,
    maxHeight: '70%',
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  commentsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  noCommentsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noCommentsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  noCommentsSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  commentItem: {
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
  },
  qaItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  questionBubble: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F53F7A',
  },
  qaQuestion: {
    color: '#222',
    fontSize: 15,
    lineHeight: 22,
  },
  qaDate: {
    color: '#999',
    fontSize: 12,
  },
  commentUser: {
    fontWeight: '600',
    color: '#F53F7A',
    fontSize: 14,
  },
  commentContent: {
    color: '#222',
    fontSize: 15,
    marginBottom: 2,
  },
  commentDate: {
    color: '#888',
    fontSize: 11,
    textAlign: 'right',
  },
  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginBottom: 45
    // marginTop: 8,
  },
  commentInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 80,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#222',
  },
  sendCommentBtn: {
    marginLeft: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stockIndicator: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginTop: 4,
  },
  lowStockIndicator: {
    backgroundColor: 'rgba(255,59,48,0.9)',
  },
  stockText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  lowStockText: {
    color: '#fff',
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
  // Skeleton Loading Styles
  skeletonContainer: {
    flex: 1,
    width: '100%',
  },
  skeletonVideoContainer: {
    width: width,
    height: height,
    position: 'relative',
  },
  skeletonVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e0e0e0',
  },
  skeletonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  skeletonBackButton: {
    position: 'absolute',
    top: 24,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  skeletonRightActions: {
    position: 'absolute',
    right: 16,
    bottom: '8%',
    alignItems: 'center',
  },
  skeletonActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    marginVertical: 16,
  },
  skeletonBottomContent: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 80,
  },
  skeletonTitle: {
    height: 24,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
    width: '80%',
  },
  skeletonPrice: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 16,
    width: '40%',
  },
  skeletonButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonButton: {
    height: 44,
    backgroundColor: '#e0e0e0',
    borderRadius: 22,
    flex: 1,
  },
  // Error State Styles
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugButton: {
    position: 'absolute',
    top: 24,
    right: 80,
    zIndex: 30,
    backgroundColor: 'rgba(69, 67, 67, 0.7)',
    borderRadius: 24,
    padding: 8,
  },
  loadMoreContainer: {
    width: width,
    height: height,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadMoreText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  debugInfo: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    marginHorizontal: 20,
  },
  debugText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
    textAlign: 'center',
  },
  // UGC Actions Bottom Sheet Styles
  ugcActionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  ugcActionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  ugcActionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  ugcActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  ugcActionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  ugcActionTextContainer: {
    flex: 1,
  },
  ugcActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  ugcActionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  // Share Options Row Styles
  shareOptionsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 8,
  },
  shareOptionCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  shareOptionIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  shareOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  shareOptionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  // Vendor styles
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 12,
  },
  vendorProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vendorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  vendorAvatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#666',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)'
  },
  vendorHeaderTap: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  vendorHeaderHandle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  vendorHeaderTextCol: {
    marginLeft: 10,
    maxWidth: width * 0.5,
  },
  vendorHeaderProduct: {
    color: '#eee',
    fontSize: 12,
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  minimalFollowButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginLeft: 12,
  },
  vendorDetails: {
    flex: 1,
  },
  vendorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vendorHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vendorName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  vendorFollowers: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  vendorUsername: {
    color: '#ddd',
    fontSize: 12,
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // duplicate removed: minimalFollowButton now defined above
  minimalFollowingButton: {
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  minimalFollowText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  minimalFollowingText: {
    color: '#fff',
  },
  followButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  followingButtonText: {
    color: '#fff',
  },
  // Custom Swipe Notification Styles
  swipeNotification: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 10,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F53F7A',
  },
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  notificationSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  notificationButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  notificationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default TrendingScreen;
