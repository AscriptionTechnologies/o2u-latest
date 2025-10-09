import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
  Animated,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '~/types/navigation';
import { supabase } from '~/utils/supabase';
import { useWishlist } from '~/contexts/WishlistContext';
import { useUser } from '~/contexts/UserContext';
import { useTranslation } from 'react-i18next';
import i18n from '../utils/i18n';
import { getFirstSafeImageUrl, getProductImages, getFirstSafeProductImage } from '../utils/imageUtils';
import type { Product, Category } from '~/types/product';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';

type DashboardNavigationProp = StackNavigationProp<RootStackParamList>;

const HEADER_HEIGHT = 64;

interface Address {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  created_at?: string;
}

const Dashboard = () => {
  const navigation = useNavigation<DashboardNavigationProp>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [bestSellerProducts, setBestSellerProducts] = useState<Product[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<{ [categoryId: string]: Product[] }>({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { wishlist } = useWishlist();
  const { userData, updateUserData } = useUser();
  const [searchText, setSearchText] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const searchBarAnim = useRef(new Animated.Value(0)).current; // 0: header, 1: search bar
  const scrollY = useRef(new Animated.Value(0)).current;
  const { t } = useTranslation();
  const [langMenuVisible, setLangMenuVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [addressSheetVisible, setAddressSheetVisible] = useState(false);
  const addressSheetRef = useRef<BottomSheet>(null);
  const [productRatings, setProductRatings] = useState<{ [productId: string]: { rating: number; reviews: number } }>({});
  const [imageLoadingStates, setImageLoadingStates] = useState<{ [productId: string]: 'loading' | 'loaded' | 'error' }>({});
  const [pincode, setPincode] = useState('');
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [pincodeAvailable, setPincodeAvailable] = useState<boolean | null>(null);
  const shimmerAnimation = useRef(new Animated.Value(0)).current;
  
  // Cache for data
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
  
  // Cache keys
  const CACHE_KEYS = {
    CATEGORIES: 'dashboard_categories',
    TRENDING_PRODUCTS: 'dashboard_trending_products',
    BEST_SELLER_PRODUCTS: 'dashboard_best_seller_products',
    CATEGORY_PRODUCTS: 'dashboard_category_products',
    LAST_FETCH_TIME: 'dashboard_last_fetch_time',
    PRODUCT_RATINGS: 'dashboard_product_ratings',
  };

  useEffect(() => {
    loadDashboardData();
    // Attempt to capture GPS and city on first mount
    captureLocationIfMissing();
    // Load user addresses
    if (userData?.id) {
      fetchAddresses();
    }
    
    // Fallback: turn off loading after 10 seconds to prevent infinite loading
    const timeout = setTimeout(() => {
      if (isInitialLoading) {
        setIsInitialLoading(false);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [userData?.id]);

  // Fetch user addresses
  const fetchAddresses = async () => {
    if (!userData?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', userData.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching addresses:', error);
        return;
      }
      
      setAddresses(data || []);
      const defaultAddr = data?.find((addr: Address) => addr.is_default);
      if (defaultAddr) {
        setSelectedAddress(defaultAddr);
      } else if (data && data.length > 0) {
        setSelectedAddress(data[0]);
      }
    } catch (error) {
      console.error('Error in fetchAddresses:', error);
    }
  };

  // Handle address selection
  const handleAddressSelect = async (address: Address) => {
    setSelectedAddress(address);
    setAddressSheetVisible(false);
    addressSheetRef.current?.close();
  };

  // Check pincode availability
  const handleCheckPincode = async () => {
    if (!pincode || pincode.length !== 6) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Pincode',
        text2: 'Please enter a valid 6-digit pincode',
      });
      return;
    }

    setCheckingPincode(true);
    try {
      // Simulated pincode check - in production, call your logistics API
      // For now, we'll accept most pincodes but reject some for demo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const unavailablePincodes = ['000000', '111111', '999999'];
      const isAvailable = !unavailablePincodes.includes(pincode);
      
      setPincodeAvailable(isAvailable);
      
      if (isAvailable) {
        Toast.show({
          type: 'success',
          text1: 'Delivery Available! ✓',
          text2: `We deliver to pincode ${pincode}`,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Not Serviceable',
          text2: `Sorry, we don't deliver to pincode ${pincode} yet`,
        });
      }
    } catch (error) {
      console.error('Error checking pincode:', error);
      Toast.show({
        type: 'error',
        text1: 'Check Failed',
        text2: 'Could not verify pincode availability',
      });
    } finally {
      setCheckingPincode(false);
    }
  };

  const captureLocationIfMissing = async () => {
    try {
      // Only attempt if user is logged in and we don't have a location saved
      if (!userData || !userData.id || (userData.location && userData.location.trim() !== '')) return;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return; // silently skip if denied
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geocode = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const first = geocode && geocode.length > 0 ? geocode[0] : null;
      const city = first?.city || first?.subregion || first?.region || '';
      if (city && userData?.id) {
        // Update local context (and DB)
        await updateUserData({ location: city }, true);
        // Also persist minimal field to Supabase directly in case mapping differs
        await supabase.from('users').update({ location: city }).eq('id', userData.id);
      }
    } catch (err) {
      // ignore errors; do not block dashboard
    }
  };


  // Load cached data from AsyncStorage
  const loadCachedData = async () => {
    try {
      const [
        cachedCategories,
        cachedTrendingProducts,
        cachedBestSellerProducts,
        cachedCategoryProducts,
        cachedLastFetchTime,
        cachedProductRatings,
      ] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEYS.CATEGORIES),
        AsyncStorage.getItem(CACHE_KEYS.TRENDING_PRODUCTS),
        AsyncStorage.getItem(CACHE_KEYS.BEST_SELLER_PRODUCTS),
        AsyncStorage.getItem(CACHE_KEYS.CATEGORY_PRODUCTS),
        AsyncStorage.getItem(CACHE_KEYS.LAST_FETCH_TIME),
        AsyncStorage.getItem(CACHE_KEYS.PRODUCT_RATINGS),
      ]);

      if (cachedCategories) setCategories(JSON.parse(cachedCategories));
      if (cachedTrendingProducts) setTrendingProducts(JSON.parse(cachedTrendingProducts));
      if (cachedBestSellerProducts) setBestSellerProducts(JSON.parse(cachedBestSellerProducts));
      if (cachedCategoryProducts) setCategoryProducts(JSON.parse(cachedCategoryProducts));
      if (cachedLastFetchTime) setLastFetchTime(JSON.parse(cachedLastFetchTime));
      if (cachedProductRatings) setProductRatings(JSON.parse(cachedProductRatings));

      const hasCachedData = !!(cachedCategories && cachedTrendingProducts);
      const lastFetchTime = cachedLastFetchTime ? JSON.parse(cachedLastFetchTime) : 0;

      return {
        hasCachedData,
        lastFetchTime,
      };
    } catch (error) {
      console.error('Error loading cached data:', error);
      return { hasCachedData: false, lastFetchTime: 0 };
    }
  };

  // Save data to AsyncStorage
  const saveDataToCache = async () => {
    try {
      await Promise.all([
        AsyncStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(categories)),
        AsyncStorage.setItem(CACHE_KEYS.TRENDING_PRODUCTS, JSON.stringify(trendingProducts)),
        AsyncStorage.setItem(CACHE_KEYS.BEST_SELLER_PRODUCTS, JSON.stringify(bestSellerProducts)),
        AsyncStorage.setItem(CACHE_KEYS.CATEGORY_PRODUCTS, JSON.stringify(categoryProducts)),
        AsyncStorage.setItem(CACHE_KEYS.LAST_FETCH_TIME, JSON.stringify(lastFetchTime)),
        AsyncStorage.setItem(CACHE_KEYS.PRODUCT_RATINGS, JSON.stringify(productRatings)),
      ]);
    } catch (error) {
      console.error('Error saving data to cache:', error);
    }
  };

  // Clear all cached data
  const clearCache = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(CACHE_KEYS.CATEGORIES),
        AsyncStorage.removeItem(CACHE_KEYS.TRENDING_PRODUCTS),
        AsyncStorage.removeItem(CACHE_KEYS.BEST_SELLER_PRODUCTS),
        AsyncStorage.removeItem(CACHE_KEYS.CATEGORY_PRODUCTS),
        AsyncStorage.removeItem(CACHE_KEYS.LAST_FETCH_TIME),
        AsyncStorage.removeItem(CACHE_KEYS.PRODUCT_RATINGS),
      ]);
      setLastFetchTime(0);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  const handleDebugReload = async () => {
    await clearCache();
    setIsInitialLoading(true);
    setHasError(false);
    setErrorMessage('');
    loadDashboardData();
  };

  // Unified data loading function with persistent caching
  const loadDashboardData = async (forceRefresh = false) => {
    const now = Date.now();
    
    if (!forceRefresh) {
      // Try to load cached data first
      const { hasCachedData, lastFetchTime: cachedLastFetchTime } = await loadCachedData();
      const shouldUseCache = hasCachedData && (now - cachedLastFetchTime) < CACHE_DURATION;
      
      if (shouldUseCache) {
        setIsInitialLoading(false); // Make sure loading is turned off
        return;
      }
    }

    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsInitialLoading(true);
    }

    try {
      setHasError(false);
      setErrorMessage('');
      
      // Fetch all data in parallel
      await Promise.all([
        fetchCategories(),
        fetchFeaturedProducts(),
      ]);
      
      setLastFetchTime(now);
      
      // Save to cache after a short delay to ensure state is updated
      setTimeout(() => {
        saveDataToCache();
      }, 100);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setHasError(true);
      setErrorMessage('Failed to load dashboard data. Please try again.');
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  };

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
      
      // Save updated ratings to cache
      setTimeout(() => {
        AsyncStorage.setItem(CACHE_KEYS.PRODUCT_RATINGS, JSON.stringify({ ...productRatings, ...ratings }));
      }, 100);
    } catch (error) {
      console.error('Error fetching product ratings:', error);
    }
  };

  useEffect(() => {
    if (categories.length > 0) {
      fetchCategoryProducts();
    }
  }, [categories]);

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

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching categories:', error);
        return;
      }

      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchFeaturedProducts = async () => {
    try {
      // Fetch trending products
      const { data: trendingData, error: trendingError } = await supabase
        .from('products')
        .select(`
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
        `)
        .eq('featured_type', 'trending')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (trendingError) {
        console.error('Error fetching trending products:', trendingError);
      } else {
        // Fix: category comes as array, map to object and get images from variants
        const fixedTrendingData = (trendingData || []).map((item: any) => ({
          ...item,
          image_urls: getProductImages(item),
          category: Array.isArray(item.category) ? item.category[0] : item.category,
          variants: item.product_variants || [],
        }));
        setTrendingProducts(fixedTrendingData);

        // Fetch ratings for trending products
        const trendingProductIds = fixedTrendingData.map(product => product.id);
        await fetchProductRatings(trendingProductIds);
      }

      // Fetch best seller products
      const { data: bestSellerData, error: bestSellerError } = await supabase
        .from('products')
        .select(`
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
        `)
        .eq('featured_type', 'best_seller')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (bestSellerError) {
        console.error('Error fetching best seller products:', bestSellerError);
      } else {
        // Fix: category comes as array, map to object and get images from variants
        const fixedBestSellerData = (bestSellerData || []).map((item: any) => ({
          ...item,
          image_urls: getProductImages(item),
          category: Array.isArray(item.category) ? item.category[0] : item.category,
          variants: item.product_variants || [],
        }));
        setBestSellerProducts(fixedBestSellerData);

        // Fetch ratings for best seller products
        const bestSellerProductIds = fixedBestSellerData.map(product => product.id);
        await fetchProductRatings(bestSellerProductIds);
      }
    } catch (error) {
      console.error('Error fetching featured products:', error);
    }
  };

  const fetchCategoryProducts = async () => {
    try {
      // Fetch products for each category
      const categoryProductsData: { [categoryId: string]: Product[] } = {};

      for (const category of categories) {
        try {
          const { data, error } = await supabase
            .from('products')
            .select(`
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
            `)
            .eq('category_id', category.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(6); // Limit to 6 products per category

          if (error) {
            console.error(`Error fetching products for category ${category.name}:`, error);
            categoryProductsData[category.id] = [];
          } else {
            // Fix: category comes as array, map to object and get images from variants
            const fixedData = (data || []).map((item: any) => ({
              ...item,
              image_urls: getProductImages(item),
              category: Array.isArray(item.category) ? item.category[0] : item.category,
              variants: item.product_variants || [],
            }));
            categoryProductsData[category.id] = fixedData;

            // Fetch ratings for category products
            const categoryProductIds = fixedData.map(product => product.id);
            await fetchProductRatings(categoryProductIds);
          }
        } catch (error) {
          console.error(`Error fetching products for category ${category.name}:`, error);
          categoryProductsData[category.id] = [];
        }
      }

      setCategoryProducts(categoryProductsData);
    } catch (error) {
      console.error('Error fetching category products:', error);
    }
  };

  // Function to get user-specific price for a product
  const getUserPrice = (product: Product) => {
    if (!product.variants || product.variants.length === 0) {
      return 0; // No variants available
    }

    // If user has a size preference, try to find that size
    if (userData?.size) {
      const userSizeVariant = product.variants.find(v =>
        v.size?.name === userData.size
      );
      if (userSizeVariant) {
        return userSizeVariant.price;
      }
    }

    // If user size not found or no user size, return the smallest price
    const sortedVariants = [...product.variants].sort((a, b) => a.price - b.price);
    return sortedVariants[0]?.price || 0;
  };

  // Function to get the smallest price for a product
  const getSmallestPrice = (product: Product) => {
    if (!product.variants || product.variants.length === 0) {
      return 0;
    }
    const sortedVariants = [...product.variants].sort((a, b) => a.price - b.price);
    return sortedVariants[0]?.price || 0;
  };

  // Function to calculate real discount percentage
  const getDiscountPercentage = (product: Product) => {
    if (!product.variants || product.variants.length === 0) {
      return 0;
    }

    // Find the maximum discount percentage among all variants
    const maxDiscount = Math.max(...product.variants.map(v => v.discount_percentage || 0));
    return maxDiscount;
  };

  // Function to get original price (MRP) for discount calculation
  const getOriginalPrice = (product: Product) => {
    const userPrice = getUserPrice(product);
    const discountPercentage = getDiscountPercentage(product);

    if (discountPercentage > 0) {
      return userPrice / (1 - discountPercentage / 100);
    }
    return userPrice;
  };

  const renderRating = (product: Product) => {
    const productRating = productRatings[product.id];
    const rating = productRating?.rating || 0;
    const reviews = productRating?.reviews || 0;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingBottom: 8 }}>
        <Ionicons name="star" size={14} color="#FFD600" style={{ marginRight: 2 }} />
        <Text style={{ color: '#FFD600', fontWeight: 'bold', fontSize: 12, marginRight: 2 }}>{rating.toFixed(1)}</Text>
        <Text style={{ color: '#6B7280', fontSize: 11 }}>({reviews})</Text>
      </View>
    );
  };

  const renderProductCard = (product: Product) => {
    // Calculate total stock from variants
    const totalStock = product.variants?.reduce((sum, variant) => sum + (variant.quantity || 0), 0) || product.stock_quantity || 0;

    return (
      <TouchableOpacity
        key={product.id}
        style={styles.productCard}
        onPress={() => {
          // Transform Product to match ProductDetails expected format
          const userPrice = getUserPrice(product);
          const hasDiscount = product.variants?.some(v => v.discount_percentage && v.discount_percentage > 0) || false;
          const originalPrice = hasDiscount ? userPrice / (1 - (Math.max(...(product.variants?.map(v => v.discount_percentage || 0) || [0])) / 100)) : userPrice;
          const discountedPrice = userPrice;
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
        }}
      >
        {product.featured_type && (
          <View style={[
            styles.featuredBadge,
            { backgroundColor: product.featured_type === 'trending' ? '#FF9800' : '#4CAF50' }
          ]}>
            {/* <Text style={styles.featuredBadgeText}>
            {product.featured_type === 'trending' ? t('trending') : t('best_seller')}
          </Text> */}
          </View>
        )}

        {imageLoadingStates[product.id] === 'error' ? (
          // Show skeleton when image failed to load
          <View style={[styles.productImage, styles.imageSkeleton]}>
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
            <Ionicons name="image-outline" size={24} color="#ccc" />
          </View>
        ) : (
          <Image
            source={{ uri: getFirstSafeProductImage(product) }}
            style={styles.productImage}
            onLoadStart={() => {
              setImageLoadingStates(prev => ({ ...prev, [product.id]: 'loading' }));
            }}
            onLoad={() => {
              setImageLoadingStates(prev => ({ ...prev, [product.id]: 'loaded' }));
            }}
            onError={(error) => {
              setImageLoadingStates(prev => ({ ...prev, [product.id]: 'error' }));
            }}
          />
        )}
        <Text style={styles.brandName} numberOfLines={1}>
          {product.name}
        </Text>

        <View style={styles.priceContainer}>
          <View style={styles.priceInfo}>
            {getDiscountPercentage(product) > 0 && (
              <Text style={styles.originalPrice}>₹{getOriginalPrice(product).toFixed(0)}</Text>
            )}
            <Text style={styles.price}>₹{getUserPrice(product).toFixed(0)}</Text>
          </View>
          <View style={styles.discountAndRatingRow}>
            {getDiscountPercentage(product) > 0 && (
              <Text style={styles.discountPercentage}>{getDiscountPercentage(product).toFixed(0)}% OFF</Text>
            )}
            <View style={styles.reviewsContainer}>
              <Ionicons name="star" size={12} color="#FFD600" style={{ marginRight: 2 }} />
              <Text style={styles.reviews}>{productRatings[product.id]?.rating?.toFixed(1) || '0.0'}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Filtered products
  const filteredTrendingProducts = trendingProducts.filter(p =>
    p.name.toLowerCase().includes(searchText.toLowerCase())
  );
  const filteredBestSellerProducts = bestSellerProducts.filter(p =>
    p.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // Filtered category products
  const getFilteredCategoryProducts = (categoryId: string) => {
    const products = categoryProducts[categoryId] || [];
    return products.filter(p =>
      p.name.toLowerCase().includes(searchText.toLowerCase())
    );
  };

  // Scroll handler to show/hide search bar
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const y = event.nativeEvent.contentOffset.y;
        if (y > 20 && !showSearchBar) {
          setShowSearchBar(true);
          Animated.timing(searchBarAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: false,
          }).start();
        } else if (y <= 20 && showSearchBar) {
          setShowSearchBar(false);
          Animated.timing(searchBarAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: false,
          }).start();
        }
      },
    }
  );

  const renderCategorySection = (category: Category) => {
    const products = getFilteredCategoryProducts(category.id);

    return (
      <View key={category.id} style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{category.name}</Text>
          <TouchableOpacity
            style={styles.seeMoreButton}
            onPress={() => navigation.navigate('Products', { category })}
          >
            <Text style={styles.seeMoreText}>{t('see_more')}</Text>
            <Ionicons name="chevron-forward" size={16} color="#F53F7A" />
          </TouchableOpacity>
        </View>
        {products.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="shirt-outline" size={48} color="#999" />
            <Text style={styles.emptyText}>{t('no_products_available')}</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productScrollView}>
            {products.map((product) => renderProductCard(product))}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderSearchBar = () => (
    <View style={styles.searchBarContainer}>
      <Ionicons name="search-outline" size={20} color="#888" style={{ marginRight: 8 }} />
      <TextInput
        style={styles.searchInput}
        placeholder={t('search')}
        placeholderTextColor="#888"
        value={searchText}
        onChangeText={setSearchText}
        returnKeyType="search"
        autoFocus={false}
      />
      <TouchableOpacity style={styles.micButton} onPress={() => {
        Alert.alert(
          'Voice Search',
          'Voice search feature is coming soon! For now, you can use the text search above.',
          [{ text: 'OK', style: 'default' }]
        );
      }}>
        <Ionicons name="mic-outline" size={20} color="#F53F7A" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Enhanced Header with Integrated Search */}
      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.header}>
          {/* Top Row: Logo + Actions */}
          <View style={styles.headerTopRow}>
            <View style={styles.logoContainer}>
              <Text style={styles.logo}>
                <Text>Only</Text>
                <Text style={{ color: '#F53F7A' }}>2</Text>
                <Text>U</Text>
              </Text>
              <TouchableOpacity 
                style={styles.locationRow}
                onPress={() => {
                  setAddressSheetVisible(true);
                  addressSheetRef.current?.expand();
                }}
              >
                <Ionicons name="location" size={12} color="#F53F7A" />
                <Text style={styles.cityText}>
                  {selectedAddress 
                    ? `${selectedAddress.city}, ${selectedAddress.state}` 
                    : userData?.location || 'Select location'}
                </Text>
                <Ionicons name="chevron-down" size={12} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.headerRight}>
              <View style={styles.languageContainer}>
                <TouchableOpacity 
                  onPress={() => setLangMenuVisible(v => !v)} 
                  style={styles.langButton}
                >
                  <Ionicons name="globe-outline" size={16} color="#8f5be8" />
                  <Text style={styles.languageText}>{i18n.language === 'te' ? 'TE' : 'EN'}</Text>
                </TouchableOpacity>
                {langMenuVisible && (
                  <View style={styles.langMenuDropdown}>
                    <TouchableOpacity
                      style={[styles.langMenuItem, i18n.language === 'en' && styles.langMenuItemActive]}
                      onPress={() => { i18n.changeLanguage('en'); setLangMenuVisible(false); }}
                    >
                      <Text style={styles.langMenuText}>{t('english')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.langMenuItem, i18n.language === 'te' && styles.langMenuItemActive]}
                      onPress={() => { i18n.changeLanguage('te'); setLangMenuVisible(false); }}
                    >
                      <Text style={styles.langMenuText}>{t('telugu')} (Telugu)</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <View style={styles.coinBadge}>
                <MaterialCommunityIcons name="face-man-shimmer" size={16} color="#F53F7A" />
                <Text style={styles.coinText}>{userData?.coin_balance || 0}</Text>
              </View>
              <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Wishlist')}>
                <Ionicons name="heart-outline" size={22} color="#333" />
                {wishlist.length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{wishlist.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.profileButton}
                onPress={() => navigation.navigate('Profile')}
              >
                {userData?.profilePhoto ? (
                  <Image source={{ uri: userData.profilePhoto }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person-outline" size={16} color="#333" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Row: Integrated Search Bar */}
          <View style={styles.searchBarIntegrated}>
            <Ionicons name="search-outline" size={20} color="#888" />
            <TextInput
              style={styles.searchInput}
              placeholder={t('search')}
              placeholderTextColor="#888"
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
            />
          </View>
        </View>
      </SafeAreaView>

      {/* Initial Loading Screen */}
      {isInitialLoading && !hasError ? (
        <View style={styles.fullScreenLoading}>
          <ScrollView 
            style={styles.skeletonScrollView}
            contentContainerStyle={styles.skeletonContentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Skeleton */}
            <View style={styles.skeletonHeader}>
              <Animated.View 
                style={[
                  styles.skeletonLogo,
                  {
                    opacity: shimmerAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.7],
                    }),
                  },
                ]} 
              />
              <View style={styles.skeletonHeaderRight}>
                {[1, 2, 3, 4].map((item) => (
                  <Animated.View 
                    key={item}
                    style={[
                      styles.skeletonIcon,
                      {
                        opacity: shimmerAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 0.7],
                        }),
                      },
                    ]} 
                  />
                ))}
              </View>
            </View>

            {/* Search Bar Skeleton */}
            <Animated.View 
              style={[
                styles.skeletonSearchBar,
                {
                  opacity: shimmerAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 0.7],
                  }),
                },
              ]} 
            />

            {/* Categories Skeleton */}
            <View style={styles.skeletonSection}>
              <View style={styles.skeletonSectionHeader}>
                <View style={styles.skeletonTitle} />
                <View style={styles.skeletonSeeMore} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[1, 2, 3, 4, 5].map((item) => (
                  <View key={item} style={styles.skeletonCategoryCard}>
                    <View style={styles.skeletonCategoryImage} />
                    <View style={styles.skeletonCategoryTitle} />
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Trending Products Skeleton */}
            <View style={styles.skeletonSection}>
              <View style={styles.skeletonSectionHeader}>
                <View style={styles.skeletonTitle} />
                <View style={styles.skeletonSeeMore} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[1, 2, 3, 4].map((item) => (
                  <View key={item} style={styles.skeletonProductCard}>
                    <View style={styles.skeletonProductImage} />
                    <View style={styles.skeletonProductTitle} />
                    <View style={styles.skeletonProductPrice} />
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Best Sellers Skeleton */}
            <View style={styles.skeletonSection}>
              <View style={styles.skeletonSectionHeader}>
                <View style={styles.skeletonTitle} />
                <View style={styles.skeletonSeeMore} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[1, 2, 3, 4].map((item) => (
                  <View key={item} style={styles.skeletonProductCard}>
                    <View style={styles.skeletonProductImage} />
                    <View style={styles.skeletonProductTitle} />
                    <View style={styles.skeletonProductPrice} />
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Category Section Skeleton */}
            <View style={styles.skeletonSection}>
              <View style={styles.skeletonSectionHeader}>
                <View style={styles.skeletonTitle} />
                <View style={styles.skeletonSeeMore} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[1, 2, 3, 4].map((item) => (
                  <View key={item} style={styles.skeletonProductCard}>
                    <View style={styles.skeletonProductImage} />
                    <View style={styles.skeletonProductTitle} />
                    <View style={styles.skeletonProductPrice} />
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      ) : hasError ? (
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color="#999" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setHasError(false);
              setErrorMessage('');
              setIsInitialLoading(true);
              loadDashboardData(true);
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadDashboardData(true)}
              colors={['#F53F7A']}
              tintColor="#F53F7A"
            />
          }
        >
        {/* Shop by Category Section */}
        <View style={styles.sectionContainer}>
          {categories.length === 0 && !isInitialLoading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={48} color="#999" />
              <Text style={styles.emptyText}>{t('no_categories_available')}</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScrollView}>
              {categories.map((category) => (

                <TouchableOpacity
                  key={category.id}
                  style={styles.categoryCard}
                  onPress={() => navigation.navigate('Products', { category })}
                >
                  {/* <View style={styles.categoryOverlay}> */}
                  <Image
                    source={{
                      uri: category.image_url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300&h=200&fit=crop'
                    }}
                    style={styles.categoryImage}
                  />
                  {/* </View> */}
                  <Text style={styles.categoryTitle}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Pattu Saree Collection */}
        {/* <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{t('pattu_saree_collection') || 'Pattu Saree Collection'}</Text>
          <View style={styles.noVideosContainer}>
            <Text style={styles.noVideosText}>{t('videos')}</Text>
          </View>
        </View> */}

        {/* Trending Now */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('trending_now') || 'Trending Now'}</Text>
            <TouchableOpacity
              style={styles.seeMoreButton}
              onPress={() => navigation.navigate('Products', {
                category: {
                  id: 'trending',
                  name: 'Trending Products',
                  description: 'Trending products',
                  is_active: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                },
                featuredType: 'trending'
              })}
            >
              <Text style={styles.seeMoreText}>{t('see_more')}</Text>
              <Ionicons name="chevron-forward" size={16} color="#F53F7A" />
            </TouchableOpacity>
          </View>
          {filteredTrendingProducts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="trending-up-outline" size={48} color="#999" />
              <Text style={styles.emptyText}>{t('no_trending_products_available')}</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productScrollView}>
              {filteredTrendingProducts.map((product) => renderProductCard(product))}
            </ScrollView>
          )}
        </View>

        {/* Best Sellers */}
        <View style={[styles.sectionContainer, { marginBottom: Platform.OS === 'android' ? 45 : 0 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('best_sellers') || 'Best Sellers'}</Text>
            <TouchableOpacity
              style={styles.seeMoreButton}
              onPress={() => navigation.navigate('Products', {
                category: {
                  id: 'best_sellers',
                  name: 'Best Sellers',
                  description: 'Best selling products',
                  is_active: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                },
                featuredType: 'best_seller'
              })}
            >
              <Text style={styles.seeMoreText}>{t('see_more')}</Text>
              <Ionicons name="chevron-forward" size={16} color="#F53F7A" />
            </TouchableOpacity>
          </View>
          {filteredBestSellerProducts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="star-outline" size={48} color="#999" />
              <Text style={styles.emptyText}>{t('no_best_sellers_available')}</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productScrollView}>
              {filteredBestSellerProducts.map((product) => renderProductCard(product))}
            </ScrollView>
          )}
        </View>

        {/* Category Sections */}
        {categories.map((category) => renderCategorySection(category))}

        {/* Policies Footer */}
        <View style={styles.policiesFooter}>
          <Text style={styles.policiesFooterText}>Legal & Policies</Text>
          <View style={styles.policiesFooterLinks}>
            <TouchableOpacity 
              style={styles.policyFooterLink}
              onPress={() => navigation.navigate('TermsAndConditions' as any)}
            >
              <Text style={styles.policyFooterLinkText}>Terms</Text>
            </TouchableOpacity>
            <Text style={styles.policyFooterSeparator}>•</Text>
            <TouchableOpacity 
              style={styles.policyFooterLink}
              onPress={() => navigation.navigate('PrivacyPolicy' as any)}
            >
              <Text style={styles.policyFooterLinkText}>Privacy</Text>
            </TouchableOpacity>
            <Text style={styles.policyFooterSeparator}>•</Text>
            <TouchableOpacity 
              style={styles.policyFooterLink}
              onPress={() => navigation.navigate('RefundPolicy' as any)}
            >
              <Text style={styles.policyFooterLinkText}>Refund</Text>
            </TouchableOpacity>
          </View>
        </View>

        </ScrollView>
      )}

      {/* Address Selection Bottom Sheet */}
      {addressSheetVisible && (
        <BottomSheet
          ref={addressSheetRef}
          index={0}
          snapPoints={['70%']}
          enablePanDownToClose
          onClose={() => setAddressSheetVisible(false)}
        >
          <BottomSheetScrollView style={styles.addressSheetContent}>
            <View style={styles.addressSheetHeader}>
              <Text style={styles.addressSheetTitle}>Select Delivery Address</Text>
              <TouchableOpacity
                style={styles.addNewAddressButton}
                onPress={() => {
                  setAddressSheetVisible(false);
                  addressSheetRef.current?.close();
                  navigation.navigate('AddressBook' as never);
                }}
              >
                <Ionicons name="add-circle" size={20} color="#F53F7A" />
                <Text style={styles.addNewAddressText}>Add New</Text>
              </TouchableOpacity>
            </View>

            {/* Pincode Availability Checker */}
            <View style={styles.pincodeChecker}>
              <Text style={styles.pincodeCheckerTitle}>Check Delivery Availability</Text>
              <View style={styles.pincodeInputRow}>
                <TextInput
                  style={styles.pincodeInput}
                  placeholder="Enter Pincode"
                  value={pincode}
                  onChangeText={setPincode}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  style={[styles.checkButton, checkingPincode && styles.checkButtonDisabled]}
                  onPress={handleCheckPincode}
                  disabled={checkingPincode}
                >
                  {checkingPincode ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.checkButtonText}>Check</Text>
                  )}
                </TouchableOpacity>
              </View>
              {pincodeAvailable !== null && (
                <View style={[styles.availabilityResult, pincodeAvailable ? styles.availableResult : styles.unavailableResult]}>
                  <Ionicons 
                    name={pincodeAvailable ? 'checkmark-circle' : 'close-circle'} 
                    size={18} 
                    color={pincodeAvailable ? '#10b981' : '#ef4444'} 
                  />
                  <Text style={[styles.availabilityText, pincodeAvailable ? styles.availableText : styles.unavailableText]}>
                    {pincodeAvailable ? 'Delivery available to this location' : 'Currently not serviceable'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.dividerLine} />

            {addresses.length === 0 ? (
              <View style={styles.emptyAddressContainer}>
                <Ionicons name="location-outline" size={48} color="#999" />
                <Text style={styles.emptyAddressText}>No addresses added yet</Text>
                <TouchableOpacity
                  style={styles.addFirstAddressButton}
                  onPress={() => {
                    setAddressSheetVisible(false);
                    addressSheetRef.current?.close();
                    navigation.navigate('AddressBook' as never);
                  }}
                >
                  <Text style={styles.addFirstAddressText}>Add Your First Address</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.addressList}>
                {addresses.map((address) => (
                  <TouchableOpacity
                    key={address.id}
                    style={[
                      styles.addressCard,
                      selectedAddress?.id === address.id && styles.selectedAddressCard
                    ]}
                    onPress={() => handleAddressSelect(address)}
                  >
                    <View style={styles.addressCardHeader}>
                      <View style={styles.addressCardNameRow}>
                        <Text style={styles.addressCardName}>{address.full_name}</Text>
                        {address.is_default && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      {selectedAddress?.id === address.id && (
                        <Ionicons name="checkmark-circle" size={24} color="#F53F7A" />
                      )}
                    </View>
                    <Text style={styles.addressCardPhone}>{address.phone}</Text>
                    <Text style={styles.addressCardAddress}>
                      {address.address_line1}
                      {address.address_line2 && `, ${address.address_line2}`}
                    </Text>
                    <Text style={styles.addressCardCity}>
                      {address.city}, {address.state} - {address.pincode}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </BottomSheetScrollView>
        </BottomSheet>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  safeHeader: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 1000,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoContainer: {
    gap: 4,
  },
  logo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cityText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  languageContainer: {
    position: 'relative',
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  languageText: {
    fontSize: 12,
    color: '#2d334d',
    fontWeight: '700',
  },
  langMenuDropdown: {
    position: 'absolute',
    top: 38,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
    minWidth: 120,
    zIndex: 1001,
    overflow: 'hidden',
  },
  langMenuItem: {
    padding: 12,
  },
  langMenuItemActive: {
    backgroundColor: '#f1f2f4',
  },
  langMenuText: {
    color: '#222',
    fontSize: 14,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF5F7',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  coinText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F53F7A',
  },
  profileButton: {
    backgroundColor: 'lightgray',
    borderRadius: 20,
    padding: 7,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarIntegrated: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  scrollContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContentContainer: {
    paddingBottom: 24,
    paddingTop: 12,
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
    padding: 4,
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
  categoryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },

  shopButton: {
    alignItems: 'center',
    backgroundColor: '#F53F7A',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 25,
    shadowColor: '#F53F7A',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  categoryScrollView: {
    paddingLeft: 0,
    paddingHorizontal: 0,
  },
  categoryCard: {
    width: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  categoryImage: {
    width: '100%',
    height: 60,
    resizeMode: 'cover',
    // add opacity to image
    // borderRadius: 8,
  },
  categoryOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTitle: {
    color: '#333',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  sectionContainer: {
    backgroundColor: '#fff',
    // marginHorizontal: 16,
    // marginTop: 10,
    borderRadius: 16,
    padding: 8,
    // shadowColor: '#000',
    // shadowOpacity: 0.04,
    // shadowRadius: 8,
    // shadowOffset: { width: 0, height: 2 },
    // elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  seeMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F53F7A',
    marginRight: 2,
  },
  noVideosContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginTop: 8,
  },
  noVideosText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  productScrollView: {
    paddingLeft: 0,
    paddingHorizontal: 0,
    paddingBottom: 16,
  },
  productCard: {
    width: 138,
    marginHorizontal: 2,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#eee',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  discountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  offText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  productImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  brandName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1a1a1a',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
    textTransform: 'uppercase',
  },
  productName: {
    fontSize: 13,
    fontWeight: '400',
    color: '#666',
    paddingHorizontal: 12,
    paddingTop: 2,
    lineHeight: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  ratingText: {
    fontSize: 11,
    color: '#1a1a1a',
    marginLeft: 3,
    fontWeight: '600',
  },
  reviewsText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 3,
  },
  priceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  discountAndRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  sizeIndicator: {
    fontSize: 10,
    color: '#999',
    marginLeft: 4,
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  discountPercentage: {
    fontSize: 11,
    // color: '#F53F7A',
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 4,
    backgroundColor: '#F53F7A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  reviewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor: '#FFD600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 6,
  },
  reviews: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
    // marginLeft: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginTop: 8,
  },
  loadingText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
    marginTop: 12,
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
  productCategory: {
    fontSize: 11,
    color: '#999',
    paddingHorizontal: 12,
    paddingTop: 2,
  },
  avatarImage: {
    width: 30,
    height: 30,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#F53F7A',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'android' ? 2 : 6,
    // marginLeft: 2,
    marginTop: 5,
    // flex: 1,
    // marginRight: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#222',
    paddingVertical: 0,
  },
  micButton: {
    padding: 4,
  },
  searchBarOnlyHeader: {
    paddingTop: 0, // or Platform.OS === 'ios' ? 35 : 0, if you want to account for status bar
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchBarBeforeCategory: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 1,
    marginTop: 16, // <-- Add this line for extra space above
  },
  stockIndicator: {
    backgroundColor: '#fff',
    paddingHorizontal: 5,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'flex-start',
    // marginBottom: 6,
    marginTop: 4,
    // marginLeft: 6,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3B30',
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
  fullScreenLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingTop: HEADER_HEIGHT,
  },
  fullScreenLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  debugButton: {
    padding: 4,
    marginLeft: 4,
  },
  // Skeleton Loading Styles
  skeletonScrollView: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  skeletonContentContainer: {
    paddingTop: HEADER_HEIGHT,
    paddingBottom: 24,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  skeletonLogo: {
    width: 80,
    height: 24,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  skeletonHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skeletonIcon: {
    width: 24,
    height: 24,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
  },
  skeletonSearchBar: {
    height: 40,
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    marginHorizontal: 20,
    marginVertical: 16,
  },
  skeletonSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    marginBottom: 16,
  },
  skeletonSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  skeletonTitle: {
    width: 120,
    height: 24,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  skeletonSeeMore: {
    width: 60,
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  skeletonCategoryCard: {
    width: 80,
    marginHorizontal: 3,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  skeletonCategoryImage: {
    width: '100%',
    height: 60,
    backgroundColor: '#e0e0e0',
  },
  skeletonCategoryTitle: {
    height: 12,
    backgroundColor: '#e0e0e0',
    margin: 6,
    borderRadius: 2,
  },
  skeletonProductCard: {
    width: 138,
    marginHorizontal: 2,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  skeletonProductImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#e0e0e0',
  },
  skeletonProductTitle: {
    height: 14,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 2,
  },
  skeletonProductPrice: {
    height: 16,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 2,
    width: '60%',
  },
  // Error State Styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingTop: HEADER_HEIGHT,
    paddingHorizontal: 32,
  },
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
  // Policies Footer Styles
  policiesFooter: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  policiesFooterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  policiesFooterLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  policyFooterLink: {
    paddingHorizontal: 8,
  },
  policyFooterLinkText: {
    fontSize: 13,
    color: '#F53F7A',
    fontWeight: '500',
  },
  policyFooterSeparator: {
    fontSize: 13,
    color: '#999',
    marginHorizontal: 4,
  },
  // Address Bottom Sheet Styles
  addressSheetContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  addressSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  addressSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  addNewAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF5F7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addNewAddressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F53F7A',
  },
  emptyAddressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyAddressText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 24,
  },
  addFirstAddressButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addFirstAddressText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  addressList: {
    gap: 12,
    paddingBottom: 20,
  },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  selectedAddressCard: {
    borderColor: '#F53F7A',
    backgroundColor: '#FFF5F7',
  },
  addressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  addressCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  addressCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  defaultBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  addressCardPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  addressCardAddress: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  addressCardCity: {
    fontSize: 14,
    color: '#666',
  },
  // Pincode Checker Styles
  pincodeChecker: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  pincodeCheckerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  pincodeInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pincodeInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
  },
  checkButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  checkButtonDisabled: {
    backgroundColor: '#ccc',
  },
  checkButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  availabilityResult: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  availableResult: {
    backgroundColor: '#ECFDF5',
  },
  unavailableResult: {
    backgroundColor: '#FEF2F2',
  },
  availabilityText: {
    fontSize: 13,
    fontWeight: '600',
  },
  availableText: {
    color: '#10b981',
  },
  unavailableText: {
    color: '#ef4444',
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 16,
  },
});

export default Dashboard;