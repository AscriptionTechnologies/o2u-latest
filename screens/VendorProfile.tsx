import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import Toast from 'react-native-toast-message';
import { useLoginSheet } from '~/contexts/LoginSheetContext';
import { useUser } from '~/contexts/UserContext';
import BottomSheet from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const { userData } = useUser();
  const { showLoginSheet } = useLoginSheet();
  const insets = useSafeAreaInsets();
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
  const [activeTab, setActiveTab] = useState<'posts' | 'products' | 'tagged' | 'collaborations'>('products');
  const [vendorProducts, setVendorProducts] = useState<any[]>([]);
  const [collaborations, setCollaborations] = useState<any[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);
  const [productsY, setProductsY] = useState(0);
  const [productRatings, setProductRatings] = useState<{ [productId: string]: { rating: number; reviews: number } }>({});
  
  // UGC Actions Sheet
  const ugcActionsSheetRef = useRef<BottomSheet>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [blockedVendorNames, setBlockedVendorNames] = useState<string[]>([]);
  const [supportsVendorNameBlocking, setSupportsVendorNameBlocking] = useState(true);

  useEffect(() => {
    if (vendorId) {
      loadVendorData();
    } else {
      // Handle new seller onboarding case
      setLoading(false);
    }
  }, [vendorId]);

  // Load blocked users and vendor names for current user
  useEffect(() => {
    const fetchBlocked = async () => {
      if (!userData?.id) return;
      try {
        const columns = supportsVendorNameBlocking ? 'blocked_user_id, blocked_vendor_name' : 'blocked_user_id';
        const { data, error } = await supabase
          .from('blocked_users')
          .select(columns)
          .eq('user_id', userData.id);
        
        if (error) {
          if (error.code === 'PGRST204' && supportsVendorNameBlocking) {
            setSupportsVendorNameBlocking(false);
            setBlockedVendorNames([]);
            return fetchBlocked();
          }
          console.error('Error loading blocked users:', error);
          return;
        }

        if (data) {
          setBlockedUserIds(data.map((r: any) => r.blocked_user_id).filter(Boolean));
          if (supportsVendorNameBlocking) {
            setBlockedVendorNames(data.map((r: any) => r.blocked_vendor_name).filter(Boolean));
          } else {
            setBlockedVendorNames([]);
          }
        }
      } catch (err) {
        console.error('Error loading blocked users:', err);
      }
    };
    fetchBlocked();
  }, [userData?.id, supportsVendorNameBlocking]);

  const loadVendorData = async () => {
    if (!vendorId) return;
    
    setLoading(true);
    try {
      // If it's a mock vendor (from trending screen), use the initial vendor data
      if (vendorId.startsWith('mock_') && initialVendor) {
        // Ensure vendor has all required fields with defaults
        const completeVendor = {
          follower_count: 0,
          following_count: 0,
          is_verified: false,
          description: '',
          location: '',
          website_url: '',
          instagram_handle: '',
          tiktok_handle: '',
          ...initialVendor,
        };
        setVendor(completeVendor as any);
        setVendorPosts([]);
        setVendorProducts([]);
        setLoading(false);
        return;
      }

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
          category:categories(name),
          image_urls,
          video_urls,
          is_active,
          updated_at,
          like_count,
          return_policy,
          featured_type,
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
            sku,
            image_urls,
            video_urls,
            size:sizes(name)
          )
        `)
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!prodErr) {
        const normalized = (prodData || []).map((p: any) => ({
          ...p,
          category: Array.isArray(p.category) ? p.category[0] : p.category,
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
      Toast.show({
        type: 'info',
        text1: 'Login Required',
      text2: 'Please login to use Face Swap.',
      });
      showLoginSheet();
      return;
    }

    // Find the product in vendorProducts
    const product = vendorProducts.find(p => p.id === productId);
    if (!product) {
      Alert.alert('Error', 'Product not found');
      return;
    }

    const productImageUrl = getFirstImage(product);
    const userImageUrl = user.user_metadata?.avatar_url || user.user_metadata?.profilePhoto || '';

    if (!userImageUrl) {
      Alert.alert('Profile Photo Required', 'Please upload a profile photo to use face swap');
      return;
    }

    try {
      Alert.alert('Face Swap', 'Starting face swap process...');
      
      const result = await piAPIVirtualTryOnService.initiateVirtualTryOn({
        userImageUrl,
        productImageUrl,
        productId,
        batchSize: 1
      });

      if (result.success) {
        Alert.alert('Success', 'Face swap started! You will be notified when ready.');
      } else {
        Alert.alert('Error', result.error || 'Failed to start face swap');
      }
    } catch (error) {
      console.error('Error starting face swap:', error);
      Alert.alert('Error', 'Failed to start face swap');
    }
  };

  const handleShopNow = (productId: string) => {
    const product = vendorProducts.find((p) => p.id === productId);
    if (!product) {
      Alert.alert('Product unavailable', 'We could not load this product right now.');
      return;
    }
    openProductDetails(product);
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

  const shareToWhatsApp = async (message: string) => {
    try {
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        Alert.alert('WhatsApp not installed', 'Please install WhatsApp to share.');
      }
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      Alert.alert('Error', 'Unable to open WhatsApp for sharing.');
    }
  };

  const handleSharePost = async (postId: string) => {
    try {
      // Build a simple share message for WhatsApp
      const post = vendorPosts.find(p => p.id === postId);
      const media = post?.media_urls?.[0] || '';
      const vendorName = vendor?.business_name || 'this vendor';
      const vendorUrl = vendor?.id ? `https://only2u.app/vendor/${vendor.id}` : 'https://only2u.app';
      const message = `Check out this post by ${vendorName} on Only2U 👇\n${media}\n${vendorUrl}`;

      await shareToWhatsApp(message);

      // Optionally notify backend about share
      try { await sharePost(postId); } catch {}
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
    const fromProduct = Array.isArray(product?.image_urls) && product.image_urls.length > 0
      ? product.image_urls[0]
      : null;
    if (fromProduct) return fromProduct;

    const fromVariant = product?.variants?.find(
      (v: any) => Array.isArray(v.image_urls) && v.image_urls.length > 0
    );
    return (
      fromVariant?.image_urls?.[0] ||
      'https://via.placeholder.com/300x400/eeeeee/999999?text=Product'
    );
  };

  const buildProductDetailsPayload = useCallback(
    (product: any) => {
      if (!product) return null;

      const variantImages =
        product?.variants?.flatMap((variant: any) =>
          Array.isArray(variant.image_urls) ? variant.image_urls : []
        ) || [];
      const productImages =
        Array.isArray(product?.image_urls) ? product.image_urls : [];
      const allImages = [...productImages, ...variantImages].filter(
        (url: string) => !!url
      );
      const uniqueImages = Array.from(new Set(allImages));

      const variantVideos =
        product?.variants?.flatMap((variant: any) =>
          Array.isArray(variant.video_urls) ? variant.video_urls : []
        ) || [];
      const productVideos =
        Array.isArray(product?.video_urls) ? product.video_urls : [];
      const allVideos = [...productVideos, ...variantVideos].filter(
        (url: string) => !!url
      );

      const variantPrices =
        product?.variants
          ?.map((variant: any) => Number(variant.price) || 0)
          .filter((price: number) => price > 0) || [];
      const price =
        variantPrices.length > 0
          ? Math.min(...variantPrices)
          : Number(product?.price) || 0;

      const variantDiscounts =
        product?.variants?.map(
          (variant: any) => Number(variant.discount_percentage) || 0
        ) || [];
      const discount =
        variantDiscounts.length > 0 ? Math.max(...variantDiscounts) : 0;

      const originalPrice =
        discount > 0 && price > 0
          ? Math.round(price / (1 - discount / 100))
          : undefined;

      const ratingData =
        productRatings[product.id] ?? { rating: 0, reviews: 0 };

      const totalStock =
        product?.variants?.reduce(
          (sum: number, variant: any) => sum + (variant.quantity || 0),
          0
        ) || 0;

      const fallbackImage = getFirstImage(product);
      const finalImages =
        uniqueImages.length > 0 ? uniqueImages : [fallbackImage];

      return {
        id: product.id,
        name: product.name,
        price,
        originalPrice,
        discount,
        rating: ratingData.rating,
        reviews: ratingData.reviews,
        image: finalImages[0],
        image_urls: finalImages,
        video_urls: allVideos,
        description: product.description,
        stock: totalStock.toString(),
        featured: !!product.featured_type,
        images: finalImages.length || 1,
        sku: product?.variants?.[0]?.sku || '',
        category: product.category?.name || '',
        vendor_name: product.vendor_name || vendor?.business_name || '',
        alias_vendor: product.alias_vendor || '',
        return_policy: product.return_policy || '',
      };
    },
    [getFirstImage, productRatings, vendor?.business_name]
  );

  const openProductDetails = useCallback(
    (product: any) => {
      const transformed = buildProductDetailsPayload(product);

      if (!transformed) {
        Alert.alert(
          'Product unavailable',
          'We could not load this product. Please try again later.'
        );
        return;
      }

      navigation.navigate(
        'ProductDetails' as never,
        { product: transformed } as never
      );
    },
    [buildProductDetailsPayload, navigation]
  );

  const renderProductCard = (product: any) => {
    const price = getSmallestPrice(product);
    const discountPct = Math.max(...(product?.variants?.map((v: any) => v.discount_percentage || 0) || [0]));
    const hasDiscount = discountPct > 0;
    const originalPrice = hasDiscount ? price / (1 - discountPct / 100) : undefined;
    const rating = productRatings[product.id]?.rating || 0;
    const reviews = productRatings[product.id]?.reviews || 0;
    const firstImage = getFirstImage(product);
    const brandLabel = product.vendor_name || vendor?.business_name || 'Only2U';

    return (
      <TouchableOpacity
        key={product.id}
        style={styles.productCard}
        activeOpacity={0.85}
        onPress={() => openProductDetails(product)}
      >
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>{Math.round(discountPct)}% OFF</Text>
          </View>
        )}
        <Image source={{ uri: firstImage }} style={styles.productImage} />
        <Text style={styles.brandName} numberOfLines={1}>{brandLabel}</Text>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <View style={styles.priceContainer}>
          <View style={styles.priceInfo}>
            {hasDiscount && (
              <Text style={styles.originalPrice}>₹{(originalPrice || 0).toFixed(0)}</Text>
            )}
            <Text style={styles.price}>₹{price?.toFixed(0)}</Text>
          </View>
          <View style={styles.discountAndRatingRow}>
            {hasDiscount && (
              <Text style={styles.discountPercentage}>{Math.round(discountPct)}% OFF</Text>
            )}
            <View style={styles.reviewsContainer}>
              <Ionicons name="star" size={12} color="#FFD600" style={{ marginRight: 2 }} />
              <Text style={styles.reviews}>{rating.toFixed(1)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
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
        <TouchableOpacity
          style={styles.postProductCard}
          activeOpacity={0.85}
          onPress={() => handleShopNow(post.product_id!)}
        >
          <Image 
            source={{ uri: post.product_images?.[0] || 'https://via.placeholder.com/120' }} 
            style={styles.postProductImage} 
          />
          <View style={styles.postProductInfo}>
            <Text style={styles.postProductName} numberOfLines={1}>{post.product_name}</Text>
            <Text style={styles.postProductPrice}>
              ₹{Number(post.price || 0).toFixed(0)}
            </Text>
          </View>
        </TouchableOpacity>
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
        <TouchableOpacity onPress={() => ugcActionsSheetRef.current?.expand()}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} ref={ref => (scrollRef.current = ref)}>
        {/* Instagram-Style Profile Header */}
        <View style={styles.profileHeader}>
          {/* Profile Info Row */}
          <View style={styles.profileInfoRow}>
            {/* Profile Picture */}
            <Image 
              source={{ uri: vendor.profile_image_url || 'https://via.placeholder.com/100' }} 
              style={styles.profileImage} 
            />
            
            {/* Stats */}
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statNumber}>{vendorPosts.length}</Text>
                <Text style={styles.statLabel}>posts</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statNumber}>{vendor.follower_count || 0}</Text>
                <Text style={styles.statLabel}>followers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statNumber}>{vendor.following_count || 0}</Text>
                <Text style={styles.statLabel}>following</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Business Name & Verification */}
          <View style={styles.nameRow}>
            <Text style={styles.businessName}>{vendor.business_name}</Text>
            {vendor.is_verified && (
              <Ionicons name="checkmark-circle" size={16} color="#1DA1F2" style={{ marginLeft: 4 }} />
            )}
          </View>

          {/* Bio/Description */}
          {vendor.description && (
            <Text style={styles.bio}>{vendor.description}</Text>
          )}

          {/* Location */}
          {vendor.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={12} color="#666" />
              <Text style={styles.locationText}>{vendor.location}</Text>
            </View>
          )}

          {/* Social Links */}
          {(vendor.website_url || vendor.instagram_handle || vendor.tiktok_handle) && (
            <View style={styles.socialLinksRow}>
              {vendor.website_url && (
                <TouchableOpacity 
                  style={styles.socialLinkChip}
                  onPress={() => handleOpenWebsite(vendor.website_url!)}
                >
                  <Ionicons name="globe-outline" size={14} color="#0095f6" />
                  <Text style={styles.socialLinkText}>Website</Text>
                </TouchableOpacity>
              )}
              {vendor.instagram_handle && (
                <TouchableOpacity 
                  style={styles.socialLinkChip}
                  onPress={() => handleOpenSocial(vendor.instagram_handle!, 'instagram')}
                >
                  <Ionicons name="logo-instagram" size={14} color="#E4405F" />
                  <Text style={styles.socialLinkText}>@{vendor.instagram_handle}</Text>
                </TouchableOpacity>
              )}
              {vendor.tiktok_handle && (
                <TouchableOpacity 
                  style={styles.socialLinkChip}
                  onPress={() => handleOpenSocial(vendor.tiktok_handle!, 'tiktok')}
                >
                  <Ionicons name="logo-tiktok" size={14} color="#000" />
                  <Text style={styles.socialLinkText}>@{vendor.tiktok_handle}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity 
              style={[
                styles.primaryActionButton,
                isFollowingVendor(vendor.id) && styles.followingButton
              ]}
              onPress={handleFollow}
            >
              <Text style={[
                styles.primaryActionButtonText,
                isFollowingVendor(vendor.id) && styles.followingButtonText
              ]}>
                {isFollowingVendor(vendor.id) ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconActionButton}
              onPress={async () => {
                const vendorName = vendor?.business_name || 'this vendor';
                const vendorUrl = vendor?.id ? `https://only2u.app/vendor/${vendor.id}` : 'https://only2u.app';
                const message = `Check out ${vendorName} on Only2U 👇\n${vendorUrl}`;
                await shareToWhatsApp(message);
              }}
            >
              <Ionicons name="share-social-outline" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Instagram-like Tab Bar */}
        <View style={styles.tabBarContainer}>
          <View style={styles.tabBarInner}>
            <TouchableOpacity 
              style={[styles.tabItem, activeTab === 'posts' && styles.activeTabItem]}
              onPress={() => setActiveTab('posts')}
            >
              <Ionicons 
                name="grid" 
                size={20} 
                color={activeTab === 'posts' ? '#000' : '#999'} 
              />
              <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>
                POSTS
              </Text>
              {activeTab === 'posts' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabItem, activeTab === 'products' && styles.activeTabItem]}
              onPress={() => setActiveTab('products')}
            >
              <Ionicons 
                name="storefront" 
                size={20} 
                color={activeTab === 'products' ? '#000' : '#999'} 
              />
              <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
                PRODUCTS
              </Text>
              {activeTab === 'products' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabItem, activeTab === 'tagged' && styles.activeTabItem]}
              onPress={() => setActiveTab('tagged')}
            >
              <Ionicons 
                name="pricetag" 
                size={20} 
                color={activeTab === 'tagged' ? '#000' : '#999'} 
              />
              <Text style={[styles.tabText, activeTab === 'tagged' && styles.activeTabText]}>
                TAGGED
              </Text>
              {activeTab === 'tagged' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabItem, activeTab === 'collaborations' && styles.activeTabItem]}
              onPress={() => setActiveTab('collaborations')}
            >
              <Ionicons 
                name="people" 
                size={20} 
                color={activeTab === 'collaborations' ? '#000' : '#999'} 
              />
              <Text style={[styles.tabText, activeTab === 'collaborations' && styles.activeTabText]}>
                COLLABS
              </Text>
              {activeTab === 'collaborations' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {/* Posts Tab - Show all product images in grid */}
          {activeTab === 'posts' && (
            <View style={styles.postsGrid}>
              {vendorProducts.length === 0 ? (
                <View style={styles.emptyTabState}>
                  <Ionicons name="images-outline" size={64} color="#ddd" />
                  <Text style={styles.emptyTabTitle}>No Products Yet</Text>
                  <Text style={styles.emptyTabSubtitle}>Product images from {vendor.business_name} will appear here</Text>
                </View>
              ) : (
                <View style={styles.gridContainer}>
                  {vendorProducts.map((product) => {
                    const firstImage = getFirstImage(product);
                    return (
                      <TouchableOpacity 
                        key={product.id} 
                        style={styles.gridItem}
                        onPress={() => openProductDetails(product)}
                      >
                        <Image 
                          source={{ uri: firstImage }} 
                          style={styles.gridImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Products Tab - Category-wise display */}
          {activeTab === 'products' && (
            <ScrollView style={styles.productsContainer} showsVerticalScrollIndicator={false}>
              {vendorProducts.length === 0 ? (
                <View style={styles.emptyTabState}>
                  <Ionicons name="cube-outline" size={64} color="#ddd" />
                  <Text style={styles.emptyTabTitle}>No Products Yet</Text>
                  <Text style={styles.emptyTabSubtitle}>Products from {vendor.business_name} will appear here</Text>
                </View>
              ) : (
                <>
                  {/* Group products by category */}
                  {Object.entries(
                    vendorProducts.reduce((acc, product) => {
                      const categoryName = product.category?.name || 'Other';
                      if (!acc[categoryName]) {
                        acc[categoryName] = [];
                      }
                      acc[categoryName].push(product);
                      return acc;
                    }, {} as { [key: string]: any[] })
                  ).map(([categoryName, categoryProducts]) => {
                    // Get category object from first product
                    const category = categoryProducts[0]?.category || { 
                      id: categoryProducts[0]?.category_id || '', 
                      name: categoryName 
                    };
                    
                    return (
                    <View key={categoryName} style={styles.categorySection}>
                      {/* Category Header */}
                      <View style={styles.categoryHeader}>
                        <Text style={styles.categoryTitle}>{categoryName}</Text>
                        <TouchableOpacity
                          style={styles.seeMoreButton}
                          onPress={() => {
                            navigation.navigate('Products' as never, { 
                              category: {
                                id: category.id || categoryProducts[0]?.category_id || '',
                                name: categoryName,
                                description: '',
                                is_active: true,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                              },
                              vendorId: vendor.id
                            } as never);
                          }}
                        >
                          <Text style={styles.seeMoreText}>See More</Text>
                          <Ionicons name="chevron-forward" size={16} color="#F53F7A" />
                        </TouchableOpacity>
                      </View>
                      
                      {/* Horizontal Product List */}
                      <FlatList
                        horizontal
                        data={categoryProducts}
                        renderItem={({ item }) => renderProductCard(item)}
                        keyExtractor={(item) => item.id}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.productsHorizontalList}
                        ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
                      />
                    </View>
                    );
                  })}
                </>
              )}
            </ScrollView>
          )}

          {/* Tagged Tab */}
          {activeTab === 'tagged' && (
            <View style={styles.taggedGrid}>
              <View style={styles.emptyTabState}>
                <Ionicons name="pricetag-outline" size={64} color="#ddd" />
                <Text style={styles.emptyTabTitle}>No Tagged Posts</Text>
                <Text style={styles.emptyTabSubtitle}>Photos and videos where {vendor.business_name} is tagged will appear here</Text>
              </View>
            </View>
          )}

          {/* Collaborations Tab */}
          {activeTab === 'collaborations' && (
            <View style={styles.collaborationsGrid}>
              <View style={styles.emptyTabState}>
                <Ionicons name="people-outline" size={64} color="#ddd" />
                <Text style={styles.emptyTabTitle}>No Collaborations Yet</Text>
                <Text style={styles.emptyTabSubtitle}>Collaborative projects and partnerships will appear here</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* UGC Actions Bottom Sheet */}
      <BottomSheet
        ref={ugcActionsSheetRef}
        index={-1}
        snapPoints={['40%', '50%']}
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: '#ccc' }}
      >
        <View style={[styles.ugcActionsContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.ugcActionsHeader}>
            <Text style={styles.ugcActionsTitle}>Actions</Text>
            <TouchableOpacity onPress={() => ugcActionsSheetRef.current?.close()}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Report Vendor */}
          <TouchableOpacity
            style={styles.ugcActionItem}
            onPress={async () => {
              try {
                if (vendor && userData?.id) {
                  await supabase.from('ugc_reports').insert({
                    reporter_id: userData.id,
                    target_user_id: vendor.user_id || null,
                    vendor_id: vendor.id,
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
              <Text style={styles.ugcActionTitle}>Report Vendor</Text>
              <Text style={styles.ugcActionSubtitle}>Report this vendor</Text>
            </View>
          </TouchableOpacity>

          {/* Not Interested */}
          <TouchableOpacity
            style={styles.ugcActionItem}
            onPress={() => {
              Toast.show({
                type: 'success',
                text1: 'Noted',
                text2: "We'll show you less like this"
              });
              ugcActionsSheetRef.current?.close();
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

          {/* Block Vendor */}
          <TouchableOpacity
            style={styles.ugcActionItem}
            onPress={async () => {
              try {
                if (vendor && userData?.id) {
                  const vendorName = vendor.business_name || 'Unknown Vendor';

                  // Try to block by vendor user_id if available
                  if (vendor.user_id) {
                    // Check if already blocked by user_id
                    const { data: existing } = await supabase
                      .from('blocked_users')
                      .select('id')
                      .eq('user_id', userData.id)
                      .eq('blocked_user_id', vendor.user_id)
                      .single();

                    if (existing) {
                      Toast.show({
                        type: 'info',
                        text1: 'Already Blocked',
                        text2: 'This vendor is already blocked'
                      });
                      ugcActionsSheetRef.current?.close();
                      return;
                    }

                    // Insert block record with user_id
                    const blockPayload: any = {
                      user_id: userData.id,
                      blocked_user_id: vendor.user_id,
                      reason: 'Blocked from vendor profile'
                    };
                    if (supportsVendorNameBlocking) {
                      blockPayload.blocked_vendor_name = vendorName;
                    }
                    const { error } = await supabase.from('blocked_users').insert(blockPayload);

                    if (error) {
                      console.error('Block error:', error);
                      throw error;
                    }

                    setBlockedUserIds([...blockedUserIds, vendor.user_id]);
                    if (supportsVendorNameBlocking) {
                      setBlockedVendorNames([...blockedVendorNames, vendorName]);
                    }
                  } else {
                    if (!supportsVendorNameBlocking) {
                      Toast.show({
                        type: 'info',
                        text1: 'Upgrade required',
                        text2: 'Vendor name blocking is not available in this build.',
                      });
                      return;
                    }
                    // Block by vendor name only
                    // Check if already blocked by vendor name
                    const { data: existing } = await supabase
                      .from('blocked_users')
                      .select('id')
                      .eq('user_id', userData.id)
                      .eq('blocked_vendor_name', vendorName)
                      .single();

                    if (existing) {
                      Toast.show({
                        type: 'info',
                        text1: 'Already Blocked',
                        text2: 'This vendor is already blocked'
                      });
                      ugcActionsSheetRef.current?.close();
                      return;
                    }

                    // Insert block record with vendor name
                    const { error } = await supabase.from('blocked_users').insert({
                      user_id: userData.id,
                      blocked_vendor_name: vendorName,
                      reason: 'Blocked from vendor profile'
                    });

                    if (error) {
                      console.error('Block error:', error);
                      throw error;
                    }

                    setBlockedVendorNames([...blockedVendorNames, vendorName]);
                  }

                  Toast.show({
                    type: 'success',
                    text1: 'Blocked',
                    text2: `You won't see content from "${vendorName}"`
                  });
                  ugcActionsSheetRef.current?.close();
                  // Navigate back after blocking
                  navigation.goBack();
                }
              } catch (error) {
                console.error('Block vendor error:', error);
                Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to block vendor' });
              }
            }}
          >
            <View style={styles.ugcActionIconContainer}>
              <Ionicons name="ban" size={22} color="#DC2626" />
            </View>
            <View style={styles.ugcActionTextContainer}>
              <Text style={styles.ugcActionTitle}>Block Vendor</Text>
              <Text style={styles.ugcActionSubtitle}>You won't see their products</Text>
            </View>
          </TouchableOpacity>

        </View>
      </BottomSheet>
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
  // Instagram-Style Profile Header Styles
  profileHeader: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileImage: {
    width: 86,
    height: 86,
    borderRadius: 43,
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  statLabel: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#666',
  },
  socialLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  socialLinkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  socialLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: '#F53F7A',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  iconActionButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  followingButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F53F7A',
  },
  followingButtonText: {
    color: '#F53F7A',
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
    paddingHorizontal: 8,
  },
  productCard: {
    width: 138,
    marginHorizontal: 2,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    position: 'relative',
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
  discountBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
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
  priceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 6,
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  discountAndRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  originalPrice: {
    fontSize: 12,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  discountPercentage: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#F53F7A',
    backgroundColor: 'rgba(245, 63, 122, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  reviewsContainer: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  reviews: {
    fontSize: 11,
    fontWeight: '700',
    color: '#333',
  },
  // Instagram-like Tab Bar Styles
  tabBarContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  tabBarInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  activeTabItem: {
    // Active state
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#000',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#000',
  },
  tabContent: {
    flex: 1,
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
  postProductCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  postProductImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 12,
  },
  postProductInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  postProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 6,
  },
  postProductPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F53F7A',
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
  // Grid Styles
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 0,
  },
  gridItem: {
    width: width / 3,
    height: width / 3,
    position: 'relative',
    borderWidth: 0.5,
    borderColor: '#fff',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  multipleIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  // Empty Tab States
  emptyTabState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTabTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyTabSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Tab Grids
  postsGrid: {
    flex: 1,
  },
  productsContainer: {
    flex: 1,
  },
  productsHorizontalList: {
    paddingHorizontal: 16,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
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
  taggedGrid: {
    flex: 1,
  },
  collaborationsGrid: {
    flex: 1,
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
  // UGC Actions Bottom Sheet Styles
  ugcActionsContainer: {
    padding: 20,
  },
  ugcActionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  ugcActionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  ugcActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  ugcActionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  ugcActionTextContainer: {
    flex: 1,
  },
  ugcActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  ugcActionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
});

export default VendorProfile;
