import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useUser } from '~/contexts/UserContext';
import { useAuth } from '~/contexts/useAuth';
import { supabase } from '~/utils/supabase';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

interface OrderItem {
  id: string;
  product_name: string;
  product_image: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_id?: string;
}

interface OrderDetails {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  payment_status: string;
  payment_method: string;
  shipping_address: any;
  tracking_number?: string;
  shipped_at?: string;
  delivered_at?: string;
  order_items: OrderItem[];
}

type ActionType = 'review' | 'return' | 'replacement';

const OrderDetails = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userData } = useUser();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const orderId = (route.params as any)?.orderId;

  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState<ActionType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Review state
  const [rating, setRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [reviewImages, setReviewImages] = useState<string[]>([]);

  // Return/Replacement state
  const [returnReason, setReturnReason] = useState('');
  const [returnDescription, setReturnDescription] = useState('');
  const [returnImages, setReturnImages] = useState<string[]>([]);

  // Report state
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportImages, setReportImages] = useState<string[]>([]);

  const RETURN_REASONS = [
    'Received damaged product',
    'Wrong item delivered',
    'Quality does not match expectations',
    'Size issue',
    'Color different from image',
    'Ordered by mistake',
    'Other',
  ];

  const REPLACEMENT_REASONS = [
    'Wrong size received',
    'Product arrived damaged',
    'Received different color',
    'Defective item received',
    'Missing parts/accessories',
    'Other',
  ];


  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const userId = userData?.id || user?.id;

      // Check if this is a mock order
      if (orderId === '00000000-0000-0000-0000-000000000001') {
        // Return mock order details
        const mockOrderDetails: OrderDetails = {
          id: '00000000-0000-0000-0000-000000000001',
          order_number: 'ONL123456',
          status: 'delivered',
          total_amount: 1198,
          created_at: new Date('2025-11-05').toISOString(),
          payment_status: 'paid',
          payment_method: 'UPI',
          shipping_address: {
            name: 'John Doe',
            phone: '+91 98765 43210',
            address_line1: '123 Main Street',
            address_line2: 'Apartment 4B',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            country: 'India',
          },
          tracking_number: 'MOCK1234567890',
          shipped_at: new Date('2025-11-06').toISOString(),
          delivered_at: new Date('2025-11-08').toISOString(),
          order_items: [
            {
              id: '00000000-0000-0000-0000-000000000002',
              product_id: '00000000-0000-0000-0000-000000000003',
              product_name: 'Premium Cotton T-Shirt',
              product_image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
              size: 'M',
              color: 'Navy Blue',
              quantity: 2,
              unit_price: 599,
              total_price: 1198,
            },
          ],
        };
        
        setOrderDetails(mockOrderDetails);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          created_at,
          payment_status,
          payment_method,
          shipping_address,
          tracking_number,
          shipped_at,
          delivered_at,
          order_items (
            id,
            product_id,
            product_name,
            product_image,
            size,
            color,
            quantity,
            unit_price,
            total_price
          )
        `)
        .eq('id', orderId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching order details:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load order details',
        });
        navigation.goBack();
        return;
      }

      setOrderDetails(data);
    } catch (error) {
      console.error('Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Something went wrong',
      });
    } finally {
      setLoading(false);
    }
  };

  const openActionModal = (item: OrderItem, action: ActionType) => {
    // Check if order is delivered for return/replacement
    if ((action === 'return' || action === 'replacement') && orderDetails?.status?.toLowerCase() !== 'delivered') {
      Toast.show({
        type: 'info',
        text1: `${action === 'return' ? 'Return' : 'Replacement'} Unavailable`,
        text2: 'This option is only available for delivered orders',
      });
      return;
    }

    setSelectedItem(item);
    setCurrentAction(action);
    setActionModalVisible(true);
    
    // Reset form states
    setRating(0);
    setReviewTitle('');
    setReviewText('');
    setReviewImages([]);
    setReturnReason('');
    setReturnDescription('');
    setReturnImages([]);
    setReportReason('');
    setReportDescription('');
    setReportImages([]);
  };

  const closeActionModal = () => {
    setActionModalVisible(false);
    setSelectedItem(null);
    setCurrentAction(null);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions to upload images');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;
      
      // Add to appropriate image array based on current action
      if (currentAction === 'review') {
        if (reviewImages.length < 5) {
          setReviewImages([...reviewImages, imageUri]);
        } else {
          Toast.show({
            type: 'info',
            text1: 'Maximum Limit',
            text2: 'You can upload up to 5 images',
          });
        }
      } else if (currentAction === 'return' || currentAction === 'replacement') {
        if (returnImages.length < 5) {
          setReturnImages([...returnImages, imageUri]);
        } else {
          Toast.show({
            type: 'info',
            text1: 'Maximum Limit',
            text2: 'You can upload up to 5 images',
          });
        }
      }
    }
  };

  const removeImage = (index: number) => {
    if (currentAction === 'review') {
      setReviewImages(reviewImages.filter((_, i) => i !== index));
    } else if (currentAction === 'return' || currentAction === 'replacement') {
      setReturnImages(returnImages.filter((_, i) => i !== index));
    }
  };

  const submitReview = async () => {
    if (rating === 0) {
      Toast.show({
        type: 'error',
        text1: 'Rating Required',
        text2: 'Please select a rating',
      });
      return;
    }

    try {
      setSubmitting(true);
      const userId = userData?.id || user?.id;

      // Handle mock order - don't insert to database
      if (orderId === '00000000-0000-0000-0000-000000000001') {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        Toast.show({
          type: 'success',
          text1: 'Review Submitted',
          text2: 'Thank you for your feedback! (Mock Order)',
        });
        
        closeActionModal();
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from('product_reviews').insert({
        user_id: userId,
        product_id: selectedItem?.product_id,
        order_id: orderDetails?.id,
        order_item_id: selectedItem?.id,
        rating,
        title: reviewTitle.trim() || null,
        review_text: reviewText.trim() || null,
        review_images: reviewImages.length > 0 ? reviewImages : null,
        is_verified_purchase: true,
        status: 'active',
      });

      if (error) {
        throw error;
      }

      Toast.show({
        type: 'success',
        text1: 'Review Submitted',
        text2: 'Thank you for your feedback!',
      });
      closeActionModal();
    } catch (error: any) {
      console.error('Error submitting review:', error);
      if (error.code === '23505') {
        Toast.show({
          type: 'info',
          text1: 'Already Reviewed',
          text2: 'You have already reviewed this product',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to submit review',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitReturnRequest = async () => {
    if (!returnReason) {
      Toast.show({
        type: 'error',
        text1: 'Reason Required',
        text2: 'Please select a reason',
      });
      return;
    }

    try {
      setSubmitting(true);
      const userId = userData?.id || user?.id;

      // Handle mock order - don't insert to database
      if (orderId === '00000000-0000-0000-0000-000000000001') {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        Toast.show({
          type: 'success',
          text1: `${currentAction === 'return' ? 'Return' : 'Replacement'} Request Submitted`,
          text2: 'We will process your request shortly (Mock Order)',
        });
        
        closeActionModal();
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from('order_return_requests').insert({
        user_id: userId,
        order_id: orderDetails?.id,
        order_item_id: selectedItem?.id,
        order_number: orderDetails?.order_number,
        product_name: selectedItem?.product_name,
        request_type: currentAction === 'return' ? 'return' : 'replacement',
        reason: returnReason,
        detailed_reason: returnDescription.trim() || null,
        issue_images: returnImages.length > 0 ? returnImages : null,
        status: 'requested',
        pickup_address: orderDetails?.shipping_address ? JSON.stringify(orderDetails.shipping_address) : null,
      });

      if (error) {
        throw error;
      }

      Toast.show({
        type: 'success',
        text1: `${currentAction === 'return' ? 'Return' : 'Replacement'} Request Submitted`,
        text2: 'We will process your request shortly',
      });
      closeActionModal();
      fetchOrderDetails(); // Refresh order details
    } catch (error) {
      console.error('Error submitting request:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to submit request',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (currentAction === 'review') {
      submitReview();
    } else if (currentAction === 'return' || currentAction === 'replacement') {
      submitReturnRequest();
    }
  };

  const getActionTitle = () => {
    switch (currentAction) {
      case 'review':
        return 'Write a Review';
      case 'return':
        return 'Return Product';
      case 'replacement':
        return 'Request Replacement';
      default:
        return '';
    }
  };

  const getReasonOptions = () => {
    switch (currentAction) {
      case 'return':
        return RETURN_REASONS;
      case 'replacement':
        return REPLACEMENT_REASONS;
      default:
        return [];
    }
  };

  const getCurrentReason = () => {
    switch (currentAction) {
      case 'return':
      case 'replacement':
        return returnReason;
      default:
        return '';
    }
  };

  const setCurrentReason = (reason: string) => {
    switch (currentAction) {
      case 'return':
      case 'replacement':
        setReturnReason(reason);
        break;
    }
  };

  const getCurrentDescription = () => {
    switch (currentAction) {
      case 'return':
      case 'replacement':
        return returnDescription;
      default:
        return '';
    }
  };

  const setCurrentDescription = (desc: string) => {
    switch (currentAction) {
      case 'return':
      case 'replacement':
        setReturnDescription(desc);
        break;
    }
  };

  const getCurrentImages = () => {
    switch (currentAction) {
      case 'review':
        return reviewImages;
      case 'return':
      case 'replacement':
        return returnImages;
      default:
        return [];
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return { color: '#4CAF50', bg: '#E8F5E8', icon: 'checkmark-circle' };
      case 'shipped':
        return { color: '#2196F3', bg: '#E3F2FD', icon: 'airplane' };
      case 'processing':
        return { color: '#FF9800', bg: '#FFF3E0', icon: 'time' };
      case 'confirmed':
        return { color: '#9C27B0', bg: '#F3E5F5', icon: 'checkmark-done' };
      case 'pending':
        return { color: '#FF5722', bg: '#FFEBEE', icon: 'hourglass' };
      case 'cancelled':
        return { color: '#F44336', bg: '#FFEBEE', icon: 'close-circle' };
      default:
        return { color: '#666', bg: '#F5F5F5', icon: 'information-circle' };
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F53F7A" />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </View>
    );
  }

  if (!orderDetails) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Order Not Found</Text>
          <Text style={styles.emptySubtitle}>This order could not be loaded</Text>
        </View>
      </View>
    );
  }

  const statusStyle = getStatusStyle(orderDetails.status);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Header Card */}
        <View style={styles.orderHeaderCard}>
          <View style={styles.orderHeaderTop}>
            <View style={styles.orderNumberContainer}>
              <Ionicons name="bag-handle-outline" size={24} color="#F53F7A" />
              <Text style={styles.orderNumber}>{orderDetails.order_number}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Ionicons name={statusStyle.icon as any} size={16} color={statusStyle.color} />
              <Text style={[styles.statusText, { color: statusStyle.color }]}>{orderDetails.status}</Text>
            </View>
          </View>
          <Text style={styles.orderDate}>Ordered on {formatDate(orderDetails.created_at)}</Text>
          {orderDetails.delivered_at && (
            <Text style={styles.orderDate}>Delivered on {formatDate(orderDetails.delivered_at)}</Text>
          )}
        </View>

        {/* Order Items */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Items in Your Order</Text>
          {orderDetails.order_items.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemImageContainer}>
                {item.product_image ? (
                  <Image source={{ uri: item.product_image }} style={styles.itemImage} />
                ) : (
                  <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                    <Ionicons name="image-outline" size={32} color="#ccc" />
                  </View>
                )}
              </View>
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                <Text style={styles.itemMeta}>
                  {item.size && `Size: ${item.size}`}
                  {item.size && item.color && ' • '}
                  {item.color && `Color: ${item.color}`}
                </Text>
                <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
                <Text style={styles.itemPrice}>₹{item.total_price}</Text>

                {/* Action Buttons - Only show for delivered orders */}
                {orderDetails.status.toLowerCase() === 'delivered' && (
                  <View style={styles.itemActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => openActionModal(item, 'review')}
                    >
                      <Ionicons name="star-outline" size={16} color="#fff" />
                      <Text style={styles.actionButtonText}>Review</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionButtonOutline}
                      onPress={() => openActionModal(item, 'return')}
                    >
                      <Ionicons name="return-down-back-outline" size={16} color="#F53F7A" />
                      <Text style={styles.actionButtonOutlineText}>Return</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionButtonOutline}
                      onPress={() => openActionModal(item, 'replacement')}
                    >
                      <Ionicons name="swap-horizontal-outline" size={16} color="#F53F7A" />
                      <Text style={styles.actionButtonOutlineText}>Replace</Text>
                    </TouchableOpacity>
                  </View>
                )}

              </View>
            </View>
          ))}
        </View>

        {/* Payment Information */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Payment Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment Method</Text>
            <Text style={styles.infoValue}>{orderDetails.payment_method?.toUpperCase() || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment Status</Text>
            <Text style={[styles.infoValue, { color: orderDetails.payment_status === 'paid' ? '#4CAF50' : '#FF9800' }]}>
              {orderDetails.payment_status}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{orderDetails.total_amount}</Text>
          </View>
        </View>

        {/* Shipping Information */}
        {orderDetails.shipping_address && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Shipping Address</Text>
            <Text style={styles.addressText}>{JSON.stringify(orderDetails.shipping_address, null, 2)}</Text>
          </View>
        )}

        {/* Tracking Information */}
        {orderDetails.tracking_number && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Tracking Information</Text>
            <View style={styles.trackingContainer}>
              <Ionicons name="location-outline" size={20} color="#F53F7A" />
              <Text style={styles.trackingNumber}>{orderDetails.tracking_number}</Text>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Action Modal */}
      <Modal
        visible={actionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeActionModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeActionModal}
          />
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{getActionTitle()}</Text>
              <TouchableOpacity onPress={closeActionModal} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {selectedItem && (
                <View style={styles.modalProductInfo}>
                  <Text style={styles.modalProductName}>{selectedItem.product_name}</Text>
                  <Text style={styles.modalProductMeta}>
                    {selectedItem.size && `Size: ${selectedItem.size}`}
                    {selectedItem.size && selectedItem.color && ' • '}
                    {selectedItem.color && `Color: ${selectedItem.color}`}
                  </Text>
                </View>
              )}

              {/* Review Form */}
              {currentAction === 'review' && (
                <>
                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>Rating *</Text>
                    <View style={styles.ratingContainer}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star} onPress={() => setRating(star)}>
                          <Ionicons
                            name={star <= rating ? 'star' : 'star-outline'}
                            size={40}
                            color={star <= rating ? '#FFD700' : '#ccc'}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>Review Title</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Summarize your review"
                      placeholderTextColor="#999"
                      value={reviewTitle}
                      onChangeText={setReviewTitle}
                    />
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>Review</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Share your experience with this product"
                      placeholderTextColor="#999"
                      multiline
                      numberOfLines={4}
                      value={reviewText}
                      onChangeText={setReviewText}
                    />
                  </View>
                </>
              )}

              {/* Return/Replacement Form */}
              {(currentAction === 'return' || currentAction === 'replacement') && (
                <>
                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>Reason *</Text>
                    <View style={styles.reasonChips}>
                      {getReasonOptions().map((reason) => (
                        <TouchableOpacity
                          key={reason}
                          style={[
                            styles.reasonChip,
                            getCurrentReason() === reason && styles.reasonChipSelected,
                          ]}
                          onPress={() => setCurrentReason(reason)}
                        >
                          <Text
                            style={[
                              styles.reasonChipText,
                              getCurrentReason() === reason && styles.reasonChipTextSelected,
                            ]}
                          >
                            {reason}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>Additional Details</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Please provide more information"
                      placeholderTextColor="#999"
                      multiline
                      numberOfLines={4}
                      value={getCurrentDescription()}
                      onChangeText={setCurrentDescription}
                    />
                  </View>
                </>
              )}

              {/* Image Upload Section */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>
                  {currentAction === 'review' ? 'Add Photos (Optional)' : 'Add Photos (Up to 5)'}
                </Text>
                <View style={styles.imageUploadContainer}>
                  {getCurrentImages().map((uri, index) => (
                    <View key={index} style={styles.uploadedImageContainer}>
                      <Image source={{ uri }} style={styles.uploadedImage} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => removeImage(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="#F53F7A" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {getCurrentImages().length < 5 && (
                    <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                      <Ionicons name="camera-outline" size={32} color="#F53F7A" />
                      <Text style={styles.addImageText}>Add Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <LinearGradient colors={['#F53F7A', '#E91E63']} style={styles.submitButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                      <Text style={styles.submitButtonText}>Submit</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  headerSpacer: {
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  orderHeaderCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  orderHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  orderDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  itemCard: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemImageContainer: {
    marginRight: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  itemImagePlaceholder: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F53F7A',
    marginTop: 4,
  },
  itemActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F53F7A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F53F7A',
    backgroundColor: '#FFF5F8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonOutlineText: {
    color: '#F53F7A',
    fontSize: 13,
    fontWeight: '600',
  },
  reportActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reportButtonText: {
    fontSize: 12,
    color: '#666',
    textDecorationLine: 'underline',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F53F7A',
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  trackingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackingNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScroll: {
    paddingHorizontal: 20,
  },
  modalProductInfo: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalProductMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  formSection: {
    marginTop: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  reasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  reasonChipSelected: {
    borderColor: '#F53F7A',
    backgroundColor: '#FFE4ED',
  },
  reasonChipText: {
    fontSize: 13,
    color: '#666',
  },
  reasonChipTextSelected: {
    color: '#F53F7A',
    fontWeight: '600',
  },
  imageUploadContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  uploadedImageContainer: {
    position: 'relative',
  },
  uploadedImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#F53F7A',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F8',
  },
  addImageText: {
    fontSize: 11,
    color: '#F53F7A',
    marginTop: 4,
  },
  submitButton: {
    marginTop: 24,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#F53F7A',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OrderDetails;

