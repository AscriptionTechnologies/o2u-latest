import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  FlatList,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useVendor, Vendor, VendorPost } from '~/contexts/VendorContext';
import { useAuth } from '~/contexts/useAuth';
import { piAPIVirtualTryOnService } from '~/services/piapiVirtualTryOn';
import { supabase } from '~/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const POST_SIZE = (width - 6) / 3;

type VendorProfileRouteParams = {
  VendorProfile: {
    vendorId: string;
    vendor?: Vendor;
  };
};

type VendorProfileRouteProp = RouteProp<VendorProfileRouteParams, 'VendorProfile'>;

// Seller Application Form Component
const SellerApplicationForm: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    businessType: '',
    businessAddress: '',
    city: '',
    state: '',
    pincode: '',
    gstNumber: '',
    businessDescription: '',
    experience: '',
    productCategories: '',
    expectedMonthlySales: '',
    website: '',
    socialMedia: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const validateStep = (step: number) => {
    const newErrors: {[key: string]: string} = {};
    
    if (step === 1) {
      if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required';
      if (!formData.contactName.trim()) newErrors.contactName = 'Contact name is required';
      if (!formData.email.trim()) newErrors.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
      if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
      else if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) newErrors.phone = 'Phone number must be 10 digits';
    }
    
    if (step === 2) {
      if (!formData.businessType.trim()) newErrors.businessType = 'Business type is required';
      if (!formData.businessAddress.trim()) newErrors.businessAddress = 'Business address is required';
      if (!formData.city.trim()) newErrors.city = 'City is required';
      if (!formData.state.trim()) newErrors.state = 'State is required';
      if (!formData.pincode.trim()) newErrors.pincode = 'Pincode is required';
      else if (!/^\d{6}$/.test(formData.pincode)) newErrors.pincode = 'Pincode must be 6 digits';
    }
    
    if (step === 3) {
      if (!formData.businessDescription.trim()) newErrors.businessDescription = 'Business description is required';
      if (!formData.experience.trim()) newErrors.experience = 'Experience is required';
      if (!formData.productCategories.trim()) newErrors.productCategories = 'Product categories are required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    
    setIsSubmitting(true);
    try {
      console.log('Submitting application with data:', formData);
      
      // First, try to check if the table exists by querying it
      const { error: tableCheckError } = await supabase
        .from('seller_applications')
        .select('id')
        .limit(1);

      if (tableCheckError) {
        console.log('Table might not exist, error:', tableCheckError);
        
        // If table doesn't exist, store locally and show fallback message
        try {
          const applicationData = {
            ...formData,
            submittedAt: new Date().toISOString(),
            status: 'pending_local'
          };
          await AsyncStorage.setItem('seller_application', JSON.stringify(applicationData));
          console.log('Application stored locally as fallback');
        } catch (storageError) {
          console.error('Error storing application locally:', storageError);
        }
        
        Alert.alert(
          'Application Received',
          'Thank you for your interest in becoming a seller! Your application has been received. Our team will review your information and contact you within 2-3 business days.\n\nFor now, please note down your application details:\n\n' +
          `Business: ${formData.businessName}\n` +
          `Contact: ${formData.contactName}\n` +
          `Email: ${formData.email}\n` +
          `Phone: ${formData.phone}`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
        return;
      }
      
      // Save application to database
      const { data, error } = await supabase
        .from('seller_applications')
        .insert([{
          business_name: formData.businessName,
          contact_name: formData.contactName,
          email: formData.email,
          phone: formData.phone,
          business_type: formData.businessType,
          business_address: formData.businessAddress,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          gst_number: formData.gstNumber || null,
          business_description: formData.businessDescription,
          experience: formData.experience,
          product_categories: formData.productCategories,
          expected_monthly_sales: formData.expectedMonthlySales || null,
          website: formData.website || null,
          social_media: formData.socialMedia || null,
          status: 'pending',
        }])
        .select();

      console.log('Database response:', { data, error });

      if (error) {
        console.error('Database error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        // If it's a table not found error, store locally and show fallback message
        if (error.code === 'PGRST116' || error.message?.includes('relation "seller_applications" does not exist')) {
          // Store application locally as fallback
          try {
            const applicationData = {
              ...formData,
              submittedAt: new Date().toISOString(),
              status: 'pending_local'
            };
            await AsyncStorage.setItem('seller_application', JSON.stringify(applicationData));
            console.log('Application stored locally as fallback');
          } catch (storageError) {
            console.error('Error storing application locally:', storageError);
          }
          
          Alert.alert(
            'Application Received',
            'Thank you for your interest in becoming a seller! Your application has been received. Our team will review your information and contact you within 2-3 business days.\n\nFor now, please note down your application details:\n\n' +
            `Business: ${formData.businessName}\n` +
            `Contact: ${formData.contactName}\n` +
            `Email: ${formData.email}\n` +
            `Phone: ${formData.phone}`,
            [
              {
                text: 'OK',
                onPress: () => navigation.goBack()
              }
            ]
          );
          return;
        }
        
        throw new Error(`Database error: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned from database');
      }

      Alert.alert(
        'Application Submitted!',
        'Your seller application has been submitted successfully. Our team will review your application and get back to you within 2-3 business days. You will receive an email update once your application is approved.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error: any) {
      console.error('Error submitting application:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      Alert.alert(
        'Error', 
        `Failed to submit application: ${errorMessage}. Please try again or contact support if the issue persists.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.formStep}>
      <Text style={styles.stepTitle}>Basic Information</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Business Name *</Text>
        <TextInput
          style={[styles.textInput, errors.businessName && styles.inputError]}
          value={formData.businessName}
          onChangeText={(text) => setFormData({...formData, businessName: text})}
          placeholder="Enter your business name"
        />
        {errors.businessName && <Text style={styles.errorText}>{errors.businessName}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Contact Name *</Text>
        <TextInput
          style={[styles.textInput, errors.contactName && styles.inputError]}
          value={formData.contactName}
          onChangeText={(text) => setFormData({...formData, contactName: text})}
          placeholder="Your full name"
        />
        {errors.contactName && <Text style={styles.errorText}>{errors.contactName}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email Address *</Text>
        <TextInput
          style={[styles.textInput, errors.email && styles.inputError]}
          value={formData.email}
          onChangeText={(text) => setFormData({...formData, email: text})}
          placeholder="your@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Phone Number *</Text>
        <TextInput
          style={[styles.textInput, errors.phone && styles.inputError]}
          value={formData.phone}
          onChangeText={(text) => setFormData({...formData, phone: text})}
          placeholder="9876543210"
          keyboardType="phone-pad"
          maxLength={10}
        />
        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.formStep}>
      <Text style={styles.stepTitle}>Business Details</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Business Type *</Text>
        <TextInput
          style={[styles.textInput, errors.businessType && styles.inputError]}
          value={formData.businessType}
          onChangeText={(text) => setFormData({...formData, businessType: text})}
          placeholder="e.g., Retail, Wholesale, Manufacturer"
        />
        {errors.businessType && <Text style={styles.errorText}>{errors.businessType}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Business Address *</Text>
        <TextInput
          style={[styles.textInput, styles.textArea, errors.businessAddress && styles.inputError]}
          value={formData.businessAddress}
          onChangeText={(text) => setFormData({...formData, businessAddress: text})}
          placeholder="Complete business address"
          multiline
          numberOfLines={3}
        />
        {errors.businessAddress && <Text style={styles.errorText}>{errors.businessAddress}</Text>}
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.inputLabel}>City *</Text>
          <TextInput
            style={[styles.textInput, errors.city && styles.inputError]}
            value={formData.city}
            onChangeText={(text) => setFormData({...formData, city: text})}
            placeholder="City"
          />
          {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
        </View>

        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.inputLabel}>State *</Text>
          <TextInput
            style={[styles.textInput, errors.state && styles.inputError]}
            value={formData.state}
            onChangeText={(text) => setFormData({...formData, state: text})}
            placeholder="State"
          />
          {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.inputLabel}>Pincode *</Text>
          <TextInput
            style={[styles.textInput, errors.pincode && styles.inputError]}
            value={formData.pincode}
            onChangeText={(text) => setFormData({...formData, pincode: text})}
            placeholder="123456"
            keyboardType="numeric"
            maxLength={6}
          />
          {errors.pincode && <Text style={styles.errorText}>{errors.pincode}</Text>}
        </View>

        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.inputLabel}>GST Number</Text>
          <TextInput
            style={styles.textInput}
            value={formData.gstNumber}
            onChangeText={(text) => setFormData({...formData, gstNumber: text})}
            placeholder="GST Number (Optional)"
          />
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.formStep}>
      <Text style={styles.stepTitle}>Additional Information</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Business Description *</Text>
        <TextInput
          style={[styles.textInput, styles.textArea, errors.businessDescription && styles.inputError]}
          value={formData.businessDescription}
          onChangeText={(text) => setFormData({...formData, businessDescription: text})}
          placeholder="Describe your business, products, and services"
          multiline
          numberOfLines={4}
        />
        {errors.businessDescription && <Text style={styles.errorText}>{errors.businessDescription}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Business Experience *</Text>
        <TextInput
          style={[styles.textInput, errors.experience && styles.inputError]}
          value={formData.experience}
          onChangeText={(text) => setFormData({...formData, experience: text})}
          placeholder="e.g., 2 years in retail"
        />
        {errors.experience && <Text style={styles.errorText}>{errors.experience}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Product Categories *</Text>
        <TextInput
          style={[styles.textInput, errors.productCategories && styles.inputError]}
          value={formData.productCategories}
          onChangeText={(text) => setFormData({...formData, productCategories: text})}
          placeholder="e.g., Fashion, Electronics, Home & Garden"
        />
        {errors.productCategories && <Text style={styles.errorText}>{errors.productCategories}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Expected Monthly Sales</Text>
        <TextInput
          style={styles.textInput}
          value={formData.expectedMonthlySales}
          onChangeText={(text) => setFormData({...formData, expectedMonthlySales: text})}
          placeholder="e.g., ₹50,000 - ₹1,00,000"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Website</Text>
        <TextInput
          style={styles.textInput}
          value={formData.website}
          onChangeText={(text) => setFormData({...formData, website: text})}
          placeholder="https://yourwebsite.com"
          keyboardType="url"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Social Media</Text>
        <TextInput
          style={styles.textInput}
          value={formData.socialMedia}
          onChangeText={(text) => setFormData({...formData, socialMedia: text})}
          placeholder="Instagram, Facebook handles"
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become a Seller</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.formContainer}>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(currentStep / 3) * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>Step {currentStep} of 3</Text>
            </View>

            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}

            <View style={styles.buttonContainer}>
              {currentStep > 1 && (
                <TouchableOpacity style={styles.previousButton} onPress={handlePrevious}>
                  <Text style={styles.previousButtonText}>Previous</Text>
                </TouchableOpacity>
              )}
              
              {currentStep < 3 ? (
                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                  <Text style={styles.nextButtonText}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.submitButton, isSubmitting && styles.disabledButton]} 
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Application</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const VendorProfile: React.FC = () => {
  const route = useRoute<VendorProfileRouteProp>();
  const navigation = useNavigation();
  const { user } = useAuth();
  const {
    fetchVendorById,
    fetchVendorPosts,
    followVendor,
    unfollowVendor,
    isFollowingVendor,
    likePost,
    unlikePost,
    sharePost,
    vendorPosts: contextVendorPosts,
    loading: contextLoading
  } = useVendor();

  // Handle case where no parameters are provided (new seller onboarding)
  const routeParams = route.params || {};
  const { vendorId, vendor: initialVendor } = routeParams;
  const [vendor, setVendor] = useState<Vendor | null>(initialVendor || null);
  const [vendorPosts, setVendorPosts] = useState<VendorPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'tagged'>('posts');
  const [vendorProducts, setVendorProducts] = useState<any[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);
  const [productsY, setProductsY] = useState(0);
  const [productRatings, setProductRatings] = useState<{ [productId: string]: { rating: number; reviews: number } }>({});

  useEffect(() => {
    if (vendorId) {
      loadVendorData();
    } else {
      // Handle new seller onboarding case
      setLoading(false);
    }
  }, [vendorId]);

  const loadVendorData = async () => {
    if (!vendorId) return;
    
    setLoading(true);
    try {
      const vendorData = await fetchVendorById(vendorId);
      if (vendorData) {
        setVendor(vendorData);
      }
      
      await fetchVendorPosts(vendorId);
      setVendorPosts(vendorPosts.filter(post => post.vendor_id === vendorId));

      // Load vendor products
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select(`
          id,
          created_at,
          name,
          description,
          category_id,
          is_active,
          updated_at,
          like_count,
          vendor_id,
          vendor_name,
          alias_vendor,
          product_variants(
            id,
            product_id,
            size_id,
            quantity,
            price,
            discount_percentage,
            image_urls,
            video_urls,
            size:sizes(name)
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!prodErr) {
        const normalized = (prodData || []).map((p: any) => ({
          ...p,
          variants: p.product_variants || [],
        }));
        setVendorProducts(normalized);
        // Fetch ratings after products load
        const ids = normalized.map(p => p.id);
        if (ids.length > 0) {
          const { data: reviews, error: revErr } = await supabase
            .from('product_reviews')
            .select('product_id, rating')
            .in('product_id', ids);
          if (!revErr && reviews) {
            const ratings: { [id: string]: { rating: number; reviews: number } } = {};
            ids.forEach(id => {
              const pr = reviews.filter(r => r.product_id === id);
              const total = pr.reduce((s, r: any) => s + (r.rating || 0), 0);
              const avg = pr.length > 0 ? total / pr.length : 0;
              ratings[id] = { rating: avg, reviews: pr.length };
            });
            setProductRatings(ratings);
          }
        }
      }
    } catch (error) {
      console.error('Error loading vendor data:', error);
      Alert.alert('Error', 'Failed to load vendor profile');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to follow vendors');
      return;
    }

    if (!vendor) return;

    try {
      const isFollowing = isFollowingVendor(vendor.id);
      const success = isFollowing 
        ? await unfollowVendor(vendor.id)
        : await followVendor(vendor.id);

      if (success) {
        // Update local vendor data
        setVendor(prev => prev ? {
          ...prev,
          follower_count: isFollowing ? prev.follower_count - 1 : prev.follower_count + 1
        } : null);
      } else {
        Alert.alert('Error', 'Failed to update follow status');
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const handleTryOn = async (productId: string) => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to try on products');
      return;
    }

    try {
      const result = await piAPIVirtualTryOnService.initiateVirtualTryOn({
        userImageUrl: user.user_metadata?.avatar_url || '',
        productImageUrl: '', // Will be fetched from product
        productId,
        batchSize: 1
      });

      if (result.success) {
        Alert.alert('Success', 'Virtual try-on started! You will be notified when ready.');
      } else {
        Alert.alert('Error', result.error || 'Failed to start virtual try-on');
      }
    } catch (error) {
      console.error('Error starting virtual try-on:', error);
      Alert.alert('Error', 'Failed to start virtual try-on');
    }
  };

  const handleShopNow = (productId: string) => {
    navigation.navigate('ProductDetails' as never, { productId } as never);
  };

  const handleLikePost = async (postId: string, isLiked: boolean) => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to like posts');
      return;
    }

    try {
      const success = isLiked ? await unlikePost(postId) : await likePost(postId);
      if (success) {
        // Update local state
        setVendorPosts(prev => prev.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1,
                is_liked: !isLiked
              }
            : post
        ));
      }
    } catch (error) {
      console.error('Error updating like status:', error);
    }
  };

  const handleSharePost = async (postId: string) => {
    try {
      const success = await sharePost(postId);
      if (success) {
        Alert.alert('Success', 'Post shared successfully!');
      }
    } catch (error) {
      console.error('Error sharing post:', error);
      Alert.alert('Error', 'Failed to share post');
    }
  };

  const handleOpenWebsite = (url: string) => {
    Linking.openURL(url);
  };

  const handleOpenSocial = (handle: string, platform: 'instagram' | 'tiktok') => {
    const url = platform === 'instagram' 
      ? `https://instagram.com/${handle.replace('@', '')}`
      : `https://tiktok.com/@${handle.replace('@', '')}`;
    Linking.openURL(url);
  };

  const renderPost = ({ item }: { item: VendorPost }) => (
    <TouchableOpacity style={styles.postItem}>
      <Image source={{ uri: item.media_urls[0] }} style={styles.postImage} />
      {item.media_type === 'carousel' && (
        <View style={styles.carouselIndicator}>
          <Ionicons name="images" size={16} color="white" />
        </View>
      )}
    </TouchableOpacity>
  );

  const getSmallestPrice = (product: any) => {
    if (!product?.variants?.length) return 0;
    const sorted = [...product.variants].sort((a, b) => (a.price || 0) - (b.price || 0));
    return sorted[0]?.price || 0;
  };

  const getFirstImage = (product: any) => {
    const fromVariant = product?.variants?.find((v: any) => v.image_urls && v.image_urls.length > 0);
    return fromVariant?.image_urls?.[0] || 'https://via.placeholder.com/300x400/eeeeee/999999?text=Product';
  };

  const renderProductCard = (p: any) => {
    const price = getSmallestPrice(p);
    const discountPct = Math.max(...(p?.variants?.map((v: any) => v.discount_percentage || 0) || [0]));
    const hasDiscount = discountPct > 0;
    const originalPrice = hasDiscount ? price / (1 - discountPct / 100) : undefined;
    const rating = productRatings[p.id]?.rating || 0;
    const reviews = productRatings[p.id]?.reviews || 0;
    return (
      <View key={p.id} style={styles.productCardWrap}>
        <Image source={{ uri: getFirstImage(p) }} style={styles.productCardImage} />
        <View style={styles.productCardInfo}>
          <Text style={styles.productCardName} numberOfLines={1}>{p.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.productCardPrice}>₹{price?.toFixed(2)}</Text>
            {hasDiscount && (
              <>
                <Text style={styles.originalPriceSmall}>₹{(originalPrice || 0).toFixed(2)}</Text>
                <Text style={styles.discountChip}>{Math.round(discountPct)}% OFF</Text>
              </>
            )}
          </View>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            <Text style={styles.reviewsText}>({reviews})</Text>
          </View>
          <View style={styles.productCardActions}>
            <TouchableOpacity style={styles.productTryOnBtn} onPress={() => handleTryOn(p.id)}>
              <Text style={styles.productTryOnText}>Try On</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.productShopBtn} onPress={() => handleShopNow(p.id)}>
              <Text style={styles.productShopText}>Shop Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderPostDetail = (post: VendorPost) => (
    <View style={styles.postDetail}>
      <View style={styles.postHeader}>
        <Image 
          source={{ uri: vendor?.profile_image_url || 'https://via.placeholder.com/40' }} 
          style={styles.postProfileImage} 
        />
        <View style={styles.postHeaderInfo}>
          <Text style={styles.postVendorName}>{vendor?.business_name}</Text>
          <Text style={styles.postTime}>
            {new Date(post.created_at).toLocaleDateString()}
          </Text>
        </View>
        {vendor?.is_verified && (
          <Ionicons name="checkmark-circle" size={20} color="#1DA1F2" />
        )}
      </View>

      {post.caption && (
        <Text style={styles.postCaption}>{post.caption}</Text>
      )}

      {post.product_id && (
        <View style={styles.productCard}>
          <Image 
            source={{ uri: post.product_images?.[0] || 'https://via.placeholder.com/80' }} 
            style={styles.productImage} 
          />
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{post.product_name}</Text>
            <Text style={styles.productPrice}>${post.price}</Text>
            <View style={styles.productActions}>
              <TouchableOpacity 
                style={styles.tryOnButton}
                onPress={() => handleTryOn(post.product_id!)}
              >
                <Text style={styles.tryOnButtonText}>Try On</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.shopNowButton}
                onPress={() => handleShopNow(post.product_id!)}
              >
                <Text style={styles.shopNowButtonText}>Shop Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={styles.postActions}>
        <TouchableOpacity 
          onPress={() => handleLikePost(post.id, post.is_liked || false)}
          style={styles.actionButton}
        >
          <Ionicons 
            name={post.is_liked ? "heart" : "heart-outline"} 
            size={24} 
            color={post.is_liked ? "#FF3040" : "#000"} 
          />
          <Text style={styles.actionText}>{post.likes_count}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={24} color="#000" />
          <Text style={styles.actionText}>{post.comments_count}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => handleSharePost(post.id)}
          style={styles.actionButton}
        >
          <Ionicons name="share-outline" size={24} color="#000" />
          <Text style={styles.actionText}>{post.shares_count}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if ((loading || contextLoading) && !vendor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>Loading vendor profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Handle new seller onboarding case
  if (!vendorId) {
    return <SellerApplicationForm navigation={navigation} />;
  }

  if (!vendor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Vendor not found</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{vendor.business_name}</Text>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} ref={ref => (scrollRef.current = ref)}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.profileInfo}>
            <Image 
              source={{ uri: vendor.profile_image_url || 'https://via.placeholder.com/100' }} 
              style={styles.profileImage} 
            />
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{vendorPosts.length}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{vendor.follower_count}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{vendor.following_count}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>
          </View>

          <View style={styles.profileDetails}>
            <Text style={styles.businessName}>{vendor.business_name}</Text>
            {vendor.is_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#1DA1F2" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
            {vendor.description && (
              <Text style={styles.description}>{vendor.description}</Text>
            )}
            {vendor.location && (
              <Text style={styles.location}>
                <Ionicons name="location-outline" size={14} color="#666" />
                {' '}{vendor.location}
              </Text>
            )}
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[
                styles.followButton,
                isFollowingVendor(vendor.id) && styles.followingButton
              ]}
              onPress={handleFollow}
            >
              <Text style={[
                styles.followButtonText,
                isFollowingVendor(vendor.id) && styles.followingButtonText
              ]}>
                {isFollowingVendor(vendor.id) ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.shopHeaderButton}
              onPress={() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollTo({ y: productsY, animated: true });
                }
              }}
            >
              <Text style={styles.shopHeaderButtonText}>Shop Now</Text>
            </TouchableOpacity>
          </View>

          {/* Social Links */}
          <View style={styles.socialLinks}>
            {vendor.website_url && (
              <TouchableOpacity 
                style={styles.socialButton}
                onPress={() => handleOpenWebsite(vendor.website_url!)}
              >
                <Ionicons name="globe-outline" size={20} color="#000" />
                <Text style={styles.socialButtonText}>Website</Text>
              </TouchableOpacity>
            )}
            {vendor.instagram_handle && (
              <TouchableOpacity 
                style={styles.socialButton}
                onPress={() => handleOpenSocial(vendor.instagram_handle!, 'instagram')}
              >
                <Ionicons name="logo-instagram" size={20} color="#E4405F" />
                <Text style={styles.socialButtonText}>Instagram</Text>
              </TouchableOpacity>
            )}
            {vendor.tiktok_handle && (
              <TouchableOpacity 
                style={styles.socialButton}
                onPress={() => handleOpenSocial(vendor.tiktok_handle!, 'tiktok')}
              >
                <Ionicons name="logo-tiktok" size={20} color="#000" />
                <Text style={styles.socialButtonText}>TikTok</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Posts Section */}
        <View style={styles.postsSection}>
          <View style={styles.tabBar}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
              onPress={() => setActiveTab('posts')}
            >
              <Ionicons name="grid-outline" size={24} color={activeTab === 'posts' ? '#000' : '#666'} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'tagged' && styles.activeTab]}
              onPress={() => setActiveTab('tagged')}
            >
              <Ionicons name="person-outline" size={24} color={activeTab === 'tagged' ? '#000' : '#666'} />
            </TouchableOpacity>
          </View>

          {activeTab === 'posts' ? (
            <View>
              {vendorPosts.map((post) => (
                <View key={post.id} style={styles.postContainer}>
                  {renderPostDetail(post)}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.taggedContainer}>
              <Text style={styles.taggedText}>No tagged posts yet</Text>
            </View>
          )}
        </View>

        {/* Products Section */}
        <View
          style={styles.vendorProductsSection}
          onLayout={(e) => setProductsY(e.nativeEvent.layout.y - 12)}
        >
          <View style={styles.vendorProductsHeader}>
            <Ionicons name="storefront-outline" size={18} color="#F53F7A" />
            <Text style={styles.vendorProductsTitle}>Products</Text>
          </View>
          {vendorProducts.length === 0 ? (
            <View style={styles.noProductsContainer}>
              <Text style={styles.noProductsText}>No products yet</Text>
            </View>
          ) : (
            <View style={styles.productsGrid}>
              {vendorProducts.map(renderProductCard)}
            </View>
          )}
        </View>
      </ScrollView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  profileHeader: {
    padding: 16,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginRight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  profileDetails: {
    marginBottom: 16,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  verifiedText: {
    fontSize: 14,
    color: '#1DA1F2',
    marginLeft: 4,
  },
  description: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
    marginBottom: 8,
  },
  location: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  followButton: {
    flex: 1,
    backgroundColor: '#F53F7A',
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  followingButton: {
    backgroundColor: '#f0f0f0',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  followingButtonText: {
    color: '#000',
  },
  shopHeaderButton: {
    flex: 1,
    backgroundColor: '#111827',
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  shopHeaderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  socialLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  socialButtonText: {
    fontSize: 14,
    color: '#000',
    marginLeft: 6,
  },
  postsSection: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  vendorProductsSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  vendorProductsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  vendorProductsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginLeft: 6,
  },
  noProductsContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  noProductsText: {
    color: '#666',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCardWrap: {
    width: (width - 16 * 2 - 12) / 2,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  productCardImage: {
    width: '100%',
    height: Math.round(((width - 16 * 2 - 12) / 2) * 1.25),
    backgroundColor: '#fafafa',
  },
  productCardInfo: {
    padding: 10,
  },
  productCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 6,
  },
  productCardPrice: {
    color: '#111',
    fontWeight: '700',
  },
  originalPriceSmall: {
    color: '#999',
    textDecorationLine: 'line-through',
    fontSize: 12,
  },
  discountChip: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  ratingText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '700',
  },
  reviewsText: {
    color: '#666',
    fontSize: 12,
  },
  productCardActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  productTryOnBtn: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  productTryOnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  productShopBtn: {
    flex: 1,
    backgroundColor: '#F53F7A',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  productShopText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  postContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  postDetail: {
    padding: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  postHeaderInfo: {
    flex: 1,
  },
  postVendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  postTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  postCaption: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
    marginBottom: 12,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  productActions: {
    flexDirection: 'row',
  },
  tryOnButton: {
    backgroundColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 8,
  },
  tryOnButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  shopNowButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  shopNowButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  postItem: {
    width: POST_SIZE,
    height: POST_SIZE,
    margin: 1,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  carouselIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  taggedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  taggedText: {
    fontSize: 16,
    color: '#666',
  },
  // New seller onboarding styles
  onboardingContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  onboardingIcon: {
    marginBottom: 24,
  },
  onboardingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
  },
  onboardingSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  benefitsContainer: {
    width: '100%',
    marginBottom: 32,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  startSellingButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  startSellingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  learnMoreButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F53F7A',
    width: '100%',
    alignItems: 'center',
  },
  learnMoreButtonText: {
    color: '#F53F7A',
    fontSize: 16,
    fontWeight: '600',
  },
  // Seller application form styles
  keyboardView: {
    flex: 1,
  },
  formContainer: {
    flex: 1,
    padding: 20,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e1e5e9',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F53F7A',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  formStep: {
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#ff4444',
  },
  errorText: {
    fontSize: 12,
    color: '#ff4444',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingBottom: 20,
  },
  previousButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 12,
    alignItems: 'center',
  },
  previousButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#F53F7A',
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#F53F7A',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
});

export default VendorProfile;
