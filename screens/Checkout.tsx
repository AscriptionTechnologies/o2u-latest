import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCart } from '~/contexts/CartContext';
import { useUser } from '~/contexts/UserContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '~/utils/supabase';
import OrderSuccessAnimation from '~/components/OrderSuccessAnimation';
import { isRazorpaySupported, openRazorpayCheckout, createRazorpayOptions } from '~/utils/razorpay';

type PaymentMethod = 'razorpay' | 'cod' | 'giftcard' | null;

const Checkout = () => {
  const navigation = useNavigation();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { userData } = useUser();
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const isRazorpayAvailable = isRazorpaySupported();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(isRazorpayAvailable ? 'razorpay' : 'cod');
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [successOrderNumber, setSuccessOrderNumber] = useState('');
  
  // Default address from address book
  const [defaultAddress, setDefaultAddress] = useState<any | null>(null);
  
  // Coupon & gift card state
  const [couponCode, setCouponCode] = useState('');
  const [couponAppliedCode, setCouponAppliedCode] = useState<string | null>(null);
  const [couponDiscountAmount, setCouponDiscountAmount] = useState(0);
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardAppliedCode, setGiftCardAppliedCode] = useState<string | null>(null);
  const [giftCardAmountApplied, setGiftCardAmountApplied] = useState(0);
  
  // Address management state
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  
  // Phone number management state
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  const handleBackPress = () => {
    navigation.goBack();
  };

  // Fetch default address from address book
  const fetchDefaultAddress = useCallback(async () => {
    if (!userData?.id) return;
    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', userData.id)
      .eq('is_default', true)
      .single();
    
    if (!error && data) {
      setDefaultAddress(data);
    }
  }, [userData?.id]);

  // Fetch addresses on mount
  useEffect(() => {
    fetchDefaultAddress();
  }, [fetchDefaultAddress]);

  // Refresh addresses when screen comes into focus (e.g., after adding new address)
  useFocusEffect(
    useCallback(() => {
      fetchDefaultAddress();
    }, [fetchDefaultAddress])
  );

  // Address management functions
  const handleAddAddress = () => {
    setShowAddressModal(true);
    setNewAddress(userData?.location || '');
  };

  const handleSaveAddress = async () => {
    if (!newAddress.trim()) {
      Alert.alert('Invalid Address', 'Please enter a valid address.');
      return;
    }

    try {
      setSavingAddress(true);
      
      const { error } = await supabase
        .from('users')
        .update({ location: newAddress.trim() })
        .eq('id', userData?.id);

      if (error) {
        console.error('Error updating address:', error);
        Alert.alert('Error', 'Failed to save address. Please try again.');
        return;
      }

      if (userData) {
        userData.location = newAddress.trim();
      }

      setShowAddressModal(false);
      setNewAddress('');
      Alert.alert('Success', 'Address saved successfully!');
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Failed to save address. Please try again.');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleCancelAddress = () => {
    setShowAddressModal(false);
    setNewAddress('');
  };

  // Phone number management functions
  const handleAddPhone = () => {
    setShowPhoneModal(true);
    setNewPhone(userData?.phone?.replace('+91', '') || '');
  };

  const handleSavePhone = async () => {
    if (!newPhone.trim()) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number.');
      return;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    const cleanPhone = newPhone.replace(/\D/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit Indian phone number.');
      return;
    }

    try {
      setSavingPhone(true);
      
      const { error } = await supabase
        .from('users')
        .update({ phone: `+91${cleanPhone}` })
        .eq('id', userData?.id);

      if (error) {
        console.error('Error updating phone:', error);
        Alert.alert('Error', 'Failed to save phone number. Please try again.');
        return;
      }

      if (userData) {
        userData.phone = `+91${cleanPhone}`;
      }

      setShowPhoneModal(false);
      setNewPhone('');
      Alert.alert('Success', 'Phone number saved successfully!');
    } catch (error) {
      console.error('Error saving phone:', error);
      Alert.alert('Error', 'Failed to save phone number. Please try again.');
    } finally {
      setSavingPhone(false);
    }
  };

  const handleCancelPhone = () => {
    setShowPhoneModal(false);
    setNewPhone('');
  };

  // Validate UUID format
  const isValidUUID = (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  const createOrder = async (
    paymentStatus: 'pending' | 'paid',
    paymentId?: string
  ) => {
    console.log('Raw userData:', {
      hasUserData: !!userData,
      id: userData?.id,
      idType: typeof userData?.id,
      name: userData?.name,
      email: userData?.email
    });

    let userId: string | null = null;
    
    if (userData?.id) {
      const rawId = String(userData.id).trim();
      console.log('Checking user ID:', { rawId, length: rawId.length });
      
      if (rawId === 'mock-user-id' || 
          rawId === '-m-n/a' || 
          rawId === '-M-N/A' ||
          rawId.toLowerCase() === 'n/a' ||
          rawId === 'undefined' ||
          rawId === 'null' ||
          !isValidUUID(rawId)) {
        console.warn('Invalid user ID detected, setting to null:', rawId);
        userId = null;
      } else {
        userId = rawId;
      }
    }

    const totalAmount = getCartTotal();
    const finalAmount = Math.max(0, totalAmount - couponDiscountAmount - giftCardAmountApplied);
    const status = paymentStatus === 'paid' ? 'confirmed' : 'pending';

    console.log('Creating order with:', {
      userId,
      paymentMethod,
      paymentStatus,
      totalAmount: finalAmount,
      status
    });

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          user_id: userId,
          status: status,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          payment_id: paymentId || null,
          total_amount: finalAmount,
          subtotal: totalAmount,
          shipping_amount: 0,
          tax_amount: 0,
          discount_amount: couponDiscountAmount + giftCardAmountApplied,
          shipping_address: userData?.location || 'Not provided',
          customer_name: userData?.name || 'Guest',
          customer_email: userData?.email || null,
          customer_phone: userData?.phone || null,
        },
      ])
      .select('id, order_number')
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      throw new Error(orderError.message || 'Failed to create order');
    }

    if (!orderData) {
      throw new Error('Order created but no data returned');
    }

    console.log('Order created successfully:', orderData);

    const orderItemsPayload = cartItems.map((item: any) => {
      const itemTotal = (item.price || 0) * (item.quantity || 1);
      
      let productId: string | null = null;
      if (item.id) {
        const rawProductId = String(item.id).trim();
        if (isValidUUID(rawProductId)) {
          productId = rawProductId;
        } else {
          console.warn('Invalid product ID in cart item, setting to null:', rawProductId);
        }
      }
      
      return {
        order_id: orderData.id,
        product_id: productId,
        product_name: item.name || 'Unknown Product',
        product_image: item.image || null,
        quantity: item.quantity || 1,
        unit_price: item.price || 0,
        total_price: itemTotal,
        size: item.size || null,
        color: item.color || null,
      };
    });

    console.log('Creating order items:', orderItemsPayload.length, 'items');

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsPayload);

    if (itemsError) {
      console.error('Order items creation error:', itemsError);
      await supabase.from('orders').delete().eq('id', orderData.id);
      throw new Error(itemsError.message || 'Failed to create order items');
    }

    console.log('Order items created successfully');

    return orderData;
  };

  const handlePayNow = async () => {
    try {
      setLoading(true);

      if (!cartItems || cartItems.length === 0) {
        Alert.alert('Empty Cart', 'Please add items to your cart before checking out.');
        return;
      }

      if (!defaultAddress) {
        Alert.alert(
          'Shipping Address Required',
          'Please add your shipping address before proceeding.',
          [
            {
              text: 'Add Address',
              onPress: () => (navigation as any).navigate('AddressBook')
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
        return;
      }

      if (paymentMethod === 'razorpay' && (!userData?.name || !userData?.phone)) {
        Alert.alert(
          'Contact Information Required',
          'Please provide your name and phone number for online payments.',
          [
            {
              text: 'Add Phone',
              onPress: () => handleAddPhone()
            },
            {
              text: 'Use COD Instead',
              onPress: () => setPaymentMethod('cod')
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
        return;
      }

      const totalAmount = Math.max(0, getCartTotal() - couponDiscountAmount - giftCardAmountApplied);
      if (totalAmount <= 0 && paymentMethod !== 'giftcard') {
        Alert.alert('Invalid Amount', 'Order total must be greater than zero.');
        return;
      }

      if (paymentMethod === 'cod') {
        console.log('Processing COD order...');
        const orderData = await createOrder('pending');
        
        clearCart();
        setSuccessOrderNumber(orderData.order_number);
        setShowSuccessAnimation(true);
        return;
      }

      if (paymentMethod === 'giftcard') {
        if (!giftCardAppliedCode) {
          Alert.alert('Gift Card Required', 'Apply a gift card to use this payment method.');
          return;
        }
        if (Math.max(0, getCartTotal() - couponDiscountAmount - giftCardAmountApplied) > 0) {
          Alert.alert('Insufficient Balance', 'Gift card balance does not fully cover the order amount.');
          return;
        }
        const orderData = await createOrder('paid', `GIFT-${giftCardAppliedCode}`);
        clearCart();
        setSuccessOrderNumber(orderData.order_number);
        setShowSuccessAnimation(true);
        return;
      }

      if (paymentMethod === 'razorpay') {
        if (!isRazorpayAvailable) {
          Alert.alert(
            'Payment Not Available',
            'Online payment is not available. Please use Cash on Delivery.',
            [
              {
                text: 'Switch to COD',
                onPress: () => setPaymentMethod('cod')
              },
              {
                text: 'Cancel',
                style: 'cancel'
              }
            ]
          );
          return;
        }

        console.log('Opening Razorpay checkout...');

        try {
          // Create Razorpay order on server (amount in paise)
          let orderId: string | null = null;
          try {
            const { data: orderResp, error: orderErr } = await (supabase as any).functions.invoke('create-razorpay-order', {
              body: { amount: Math.round(totalAmount * 100), currency: 'INR', notes: { user_id: userData?.id } }
            });
            if (!orderErr && orderResp?.order?.id) {
              orderId = orderResp.order.id as string;
            } else {
              console.log('invoke failed, falling back to public fetch', orderErr || orderResp);
            }
          } catch (e) {
            console.log('invoke threw, will try public fetch', e);
          }

          if (!orderId) {
            const supa: any = supabase as any;
            const baseUrl = supa?.supabaseUrl ? `https://${supa.supabaseUrl.replace(/^https?:\/\//, '')}` : '';
            const url = baseUrl ? `${baseUrl}/functions/v1/create-razorpay-order` : '';
            if (!url) throw new Error('Supabase URL not available');
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: Math.round(totalAmount * 100), currency: 'INR', notes: { user_id: userData?.id } })
            });
            const j = await res.json();
            if (res.ok && j?.order?.id) {
              orderId = j.order.id as string;
            } else {
              console.log('public fetch error', j);
              throw new Error(j?.error || 'Failed to create Razorpay order');
            }
          }

          const options = await createRazorpayOptions(totalAmount, userData);
          (options as any).order_id = orderId;
          console.log('Razorpay options ready', { key: (options as any).key, amount: (options as any).amount, order_id: (options as any).order_id });
          const result = await openRazorpayCheckout(options);
          const orderData = await createOrder('paid', result?.razorpay_payment_id);

          clearCart();
          setSuccessOrderNumber(orderData.order_number);
          setShowSuccessAnimation(true);
        } catch (razorpayError: any) {
          console.error('Razorpay payment error:', razorpayError);
          
          if (razorpayError.code === 0) {
            Alert.alert('Payment Cancelled', 'You cancelled the payment. Your cart items are still saved.');
          } else if (razorpayError.message?.includes('not available') || 
                     razorpayError.message?.includes('Cannot read property') ||
                     razorpayError.message?.includes('failed to load properly')) {
            Alert.alert(
              'Payment Not Available',
              'Online payment is not available. Please use Cash on Delivery.',
              [
                {
                  text: 'Use COD',
                  onPress: () => setPaymentMethod('cod')
                },
                {
                  text: 'Cancel',
                  style: 'cancel'
                }
              ]
            );
          } else {
            Alert.alert(
              'Payment Failed',
              razorpayError.description || razorpayError.message || 'Payment failed. Please try again.'
            );
          }
        }
        return;
      }

      Alert.alert('Select Payment Method', 'Please select a payment method to continue.');

    } catch (error: any) {
      console.error('Checkout error:', error);
      Alert.alert(
        'Order Failed',
        error.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderOrderItem = (item: any, index: number) => (
    <View 
      key={`${item.id}-${index}`} 
      style={styles.orderItem}
    >
      <Image 
        source={{ uri: item.image || 'https://via.placeholder.com/80' }} 
        style={styles.itemImage} 
      />
      <View style={styles.itemDetails}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name || 'Unknown Product'}
        </Text>
        <View style={styles.itemMeta}>
          {item.size && (
            <View style={styles.metaTag}>
              <Text style={styles.metaText}>Size: {item.size}</Text>
            </View>
          )}
          {item.color && (
            <View style={styles.metaTag}>
              <Text style={styles.metaText}>Color: {item.color}</Text>
            </View>
          )}
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.itemPrice}>₹{item.price || 0}</Text>
          <Text style={styles.itemQty}>Qty: {item.quantity || 1}</Text>
        </View>
      </View>
      <View style={styles.itemTotalContainer}>
        <Text style={styles.itemTotal}>₹{(item.price || 0) * (item.quantity || 1)}</Text>
      </View>
    </View>
  );

  // Price calculations
  const subtotal = useMemo(() => getCartTotal(), [getCartTotal, cartItems]);
  const shippingAmount = 0;
  const totalSavings = couponDiscountAmount + giftCardAmountApplied;
  const payable = useMemo(() => {
    const raw = subtotal - couponDiscountAmount - giftCardAmountApplied + shippingAmount;
    return raw > 0 ? raw : 0;
  }, [subtotal, couponDiscountAmount, giftCardAmountApplied]);

  const tryApplyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    let discount = 0;
    if (code === 'SAVE10') {
      discount = Math.min(Math.round(subtotal * 0.1), 200);
    } else if (code === 'NEW50') {
      discount = Math.min(50, subtotal);
    } else {
      Alert.alert('Invalid Coupon', 'This coupon code is not valid.');
      return;
    }
    setCouponAppliedCode(code);
    setCouponDiscountAmount(discount);
    setCouponCode('');
    Alert.alert('Coupon Applied!', `You saved ₹${discount} on this order.`);
  };

  const removeCoupon = () => {
    setCouponAppliedCode(null);
    setCouponDiscountAmount(0);
    setCouponCode('');
  };

  const tryApplyGiftCard = () => {
    const code = giftCardCode.trim().toUpperCase();
    if (!code) return;
    let balance = 0;
    if (code === 'GIFT500') {
      balance = 500;
    } else if (code === 'GIFT1000') {
      balance = 1000;
    } else {
      Alert.alert('Invalid Gift Card', 'This gift card code is not valid.');
      return;
    }
    const remainingAfterCoupon = Math.max(0, subtotal - couponDiscountAmount);
    const applied = Math.min(balance, remainingAfterCoupon);
    setGiftCardAppliedCode(code);
    setGiftCardAmountApplied(applied);
    setGiftCardCode('');
    Alert.alert('Gift Card Applied!', `₹${applied} has been applied from your gift card.`);
  };

  const removeGiftCard = () => {
    setGiftCardAppliedCode(null);
    setGiftCardAmountApplied(0);
    setGiftCardCode('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <OrderSuccessAnimation
        visible={showSuccessAnimation}
        orderNumber={successOrderNumber}
        onClose={() => {
          setShowSuccessAnimation(false);
          navigation.goBack();
        }}
        onViewOrders={() => {
          setShowSuccessAnimation(false);
          navigation.navigate('MyOrders' as never);
        }}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Secure Checkout</Text>
        <View style={styles.headerRight}>
          <Ionicons name="shield-checkmark" size={20} color="#10b981" />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Delivery Address Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconBadge}>
                <Ionicons name="location" size={18} color="#F53F7A" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Delivery Address</Text>
                <Text style={styles.cardSubtitle}>Where should we deliver?</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => (navigation as any).navigate('AddressBook')} style={styles.changeButton}>
              <Text style={styles.changeButtonText}>
                {defaultAddress ? 'Change' : 'Add'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {defaultAddress ? (
            <View style={styles.addressBox}>
              <Text style={styles.addressName}>{defaultAddress.full_name || 'Customer'}</Text>
              <Text style={styles.addressDetail}>
                {defaultAddress.street_line1}
                {defaultAddress.street_line2 ? `, ${defaultAddress.street_line2}` : ''}
              </Text>
              {defaultAddress.landmark && (
                <Text style={styles.addressDetail}>Near: {defaultAddress.landmark}</Text>
              )}
              <Text style={styles.addressDetail}>
                {defaultAddress.city}, {defaultAddress.state} {defaultAddress.postal_code}
              </Text>
              {defaultAddress.phone && (
                <Text style={styles.addressPhone}>Phone: {defaultAddress.phone}</Text>
              )}
              <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
                <TouchableOpacity 
                  onPress={() => (navigation as any).navigate('AddressBook')}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8 }}
                >
                  <Text style={{ color: '#111' }}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => (navigation as any).navigate('AddressBook')}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F53F7A', borderRadius: 8 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Manage Addresses</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="location-outline" size={32} color="#ccc" />
              <Text style={styles.emptyText}>No delivery address added</Text>
              <TouchableOpacity onPress={() => (navigation as any).navigate('AddressBook')} style={styles.addButton}>
                <Text style={styles.addButtonText}>Add Address</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Order Items */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconBadge}>
                <Ionicons name="bag-handle" size={18} color="#F53F7A" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Order Items</Text>
                <Text style={styles.cardSubtitle}>{cartItems?.length || 0} items</Text>
              </View>
            </View>
          </View>
          <View style={styles.itemsList}>
            {cartItems && cartItems.length > 0 ? (
              cartItems.map(renderOrderItem)
            ) : (
              <Text style={styles.emptyText}>No items in cart</Text>
            )}
          </View>
        </View>

        {/* Offers & Coupons */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconBadge}>
                <Ionicons name="pricetag" size={18} color="#F53F7A" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Offers & Coupons</Text>
                <Text style={styles.cardSubtitle}>Save more on this order</Text>
              </View>
            </View>
          </View>

          {couponAppliedCode ? (
            <View style={styles.appliedBox}>
              <View style={styles.appliedContent}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <View style={styles.appliedInfo}>
                  <Text style={styles.appliedCode}>{couponAppliedCode}</Text>
                  <Text style={styles.appliedSavings}>You saved ₹{couponDiscountAmount}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={removeCoupon} style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.promoBox}>
              <View style={styles.promoInput}>
                <Ionicons name="pricetag-outline" size={16} color="#999" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.promoTextInput}
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChangeText={setCouponCode}
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                />
                <TouchableOpacity onPress={tryApplyCoupon} style={styles.applyBtn}>
                  <Text style={styles.applyBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.promoHint}>Available: SAVE10, NEW50</Text>
            </View>
          )}

          {/* Gift Card Section */}
          <View style={styles.divider} />
          
          {giftCardAppliedCode ? (
            <View style={styles.appliedBox}>
              <View style={styles.appliedContent}>
                <Ionicons name="gift" size={20} color="#F53F7A" />
                <View style={styles.appliedInfo}>
                  <Text style={styles.appliedCode}>Gift Card: {giftCardAppliedCode}</Text>
                  <Text style={styles.appliedSavings}>₹{giftCardAmountApplied} applied</Text>
                </View>
              </View>
              <TouchableOpacity onPress={removeGiftCard} style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.promoBox}>
              <View style={styles.promoInput}>
                <Ionicons name="gift-outline" size={16} color="#999" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.promoTextInput}
                  placeholder="Enter gift card code"
                  value={giftCardCode}
                  onChangeText={setGiftCardCode}
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                />
                <TouchableOpacity onPress={tryApplyGiftCard} style={styles.applyBtn}>
                  <Text style={styles.applyBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.promoHint}>Try: GIFT500, GIFT1000</Text>
            </View>
          )}
        </View>

        {/* Payment Method */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconBadge}>
                <Ionicons name="card" size={18} color="#F53F7A" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Payment Method</Text>
                <Text style={styles.cardSubtitle}>Choose how to pay</Text>
              </View>
            </View>
          </View>

          <View style={styles.paymentOptions}>
            {isRazorpayAvailable && (
              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'razorpay' && styles.paymentOptionActive]}
                onPress={() => setPaymentMethod('razorpay')}
                activeOpacity={0.7}
              >
                <View style={styles.paymentOptionLeft}>
                  <View style={[styles.radio, paymentMethod === 'razorpay' && styles.radioActive]}>
                    {paymentMethod === 'razorpay' && <View style={styles.radioDot} />}
                  </View>
                  <Ionicons name="card" size={20} color={paymentMethod === 'razorpay' ? '#F53F7A' : '#666'} />
                  <View>
                    <Text style={[styles.paymentText, paymentMethod === 'razorpay' && styles.paymentTextActive]}>
                      Online Payment
                    </Text>
                    <Text style={styles.paymentSubtext}>UPI, Cards, Wallets</Text>
                  </View>
                </View>
                {paymentMethod === 'razorpay' && (
                  <Ionicons name="checkmark-circle" size={20} color="#F53F7A" />
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'cod' && styles.paymentOptionActive]}
              onPress={() => setPaymentMethod('cod')}
              activeOpacity={0.7}
            >
              <View style={styles.paymentOptionLeft}>
                <View style={[styles.radio, paymentMethod === 'cod' && styles.radioActive]}>
                  {paymentMethod === 'cod' && <View style={styles.radioDot} />}
                </View>
                <Ionicons name="cash" size={20} color={paymentMethod === 'cod' ? '#F53F7A' : '#666'} />
                <View>
                  <Text style={[styles.paymentText, paymentMethod === 'cod' && styles.paymentTextActive]}>
                    Cash on Delivery
                  </Text>
                  <Text style={styles.paymentSubtext}>Pay when you receive</Text>
                </View>
              </View>
              {paymentMethod === 'cod' && (
                <Ionicons name="checkmark-circle" size={20} color="#F53F7A" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'giftcard' && styles.paymentOptionActive]}
              onPress={() => setPaymentMethod('giftcard')}
              activeOpacity={0.7}
            >
              <View style={styles.paymentOptionLeft}>
                <View style={[styles.radio, paymentMethod === 'giftcard' && styles.radioActive]}>
                  {paymentMethod === 'giftcard' && <View style={styles.radioDot} />}
                </View>
                <Ionicons name="gift" size={20} color={paymentMethod === 'giftcard' ? '#F53F7A' : '#666'} />
                <View>
                  <Text style={[styles.paymentText, paymentMethod === 'giftcard' && styles.paymentTextActive]}>
                    Gift Card
                  </Text>
                  <Text style={styles.paymentSubtext}>Use gift card balance</Text>
                </View>
              </View>
              {paymentMethod === 'giftcard' && (
                <Ionicons name="checkmark-circle" size={20} color="#F53F7A" />
              )}
            </TouchableOpacity>
          </View>

          {paymentMethod === 'razorpay' && (
            <View style={styles.secureNote}>
              <Ionicons name="shield-checkmark" size={16} color="#10b981" />
              <Text style={styles.secureNoteText}>Secured by Razorpay • SSL Encrypted</Text>
            </View>
          )}
        </View>

        {/* Price Breakdown */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconBadge}>
                <Ionicons name="receipt" size={18} color="#F53F7A" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Price Details</Text>
                <Text style={styles.cardSubtitle}>Bill summary</Text>
              </View>
            </View>
          </View>

          <View style={styles.priceBreakdown}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Item Total</Text>
              <Text style={styles.priceValue}>₹{subtotal}</Text>
            </View>

            {couponDiscountAmount > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Coupon Discount</Text>
                <Text style={styles.priceDiscount}>-₹{couponDiscountAmount}</Text>
              </View>
            )}

            {giftCardAmountApplied > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Gift Card Applied</Text>
                <Text style={styles.priceDiscount}>-₹{giftCardAmountApplied}</Text>
              </View>
            )}

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Delivery Charges</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.priceStrike}>₹50</Text>
                <Text style={styles.priceFree}>FREE</Text>
              </View>
            </View>

            {totalSavings > 0 && (
              <View style={styles.savingsBox}>
                <Ionicons name="trending-down" size={16} color="#10b981" />
                <Text style={styles.savingsText}>
                  You're saving ₹{totalSavings} on this order
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₹{payable}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={styles.stickyBottom}>
        <View style={styles.bottomContent}>
          <View style={styles.bottomLeft}>
            <Text style={styles.bottomTotal}>₹{payable}</Text>
            <TouchableOpacity>
              <Text style={styles.viewDetails}>View details</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={[styles.checkoutButton, (loading || !paymentMethod) && styles.checkoutButtonDisabled]} 
            onPress={handlePayNow}
            disabled={loading || !paymentMethod}
            activeOpacity={0.8}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.checkoutButtonText}>Processing...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.checkoutButtonText}>
                  {paymentMethod === 'cod' ? 'Place Order' : 'Proceed to Pay'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Address Modal */}
      <Modal
        visible={showAddressModal}
        transparent
        animationType="slide"
        onRequestClose={handleCancelAddress}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Delivery Address</Text>
                <TouchableOpacity onPress={handleCancelAddress} style={styles.modalClose}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody}>
                <Text style={styles.inputLabel}>Full Address</Text>
                <TextInput
                  style={styles.textArea}
                  value={newAddress}
                  onChangeText={setNewAddress}
                  placeholder="House/Flat No., Building Name, Area, Landmark"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                
                <Text style={styles.helperText}>
                  Include complete address with street, city, state, and pincode
                </Text>
              </ScrollView>
              
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={handleCancelAddress}
                  disabled={savingAddress}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalSaveBtn, savingAddress && styles.modalSaveBtnDisabled]}
                  onPress={handleSaveAddress}
                  disabled={savingAddress}
                >
                  {savingAddress ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveText}>Save Address</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Phone Modal */}
      <Modal
        visible={showPhoneModal}
        transparent
        animationType="slide"
        onRequestClose={handleCancelPhone}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Phone Number</Text>
                <TouchableOpacity onPress={handleCancelPhone} style={styles.modalClose}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalBody}>
                <Text style={styles.inputLabel}>Mobile Number</Text>
                <View style={styles.phoneInputRow}>
                  <View style={styles.countryCodeBox}>
                    <Text style={styles.countryCode}>+91</Text>
                  </View>
                  <TextInput
                    style={styles.phoneNumberInput}
                    value={newPhone}
                    onChangeText={setNewPhone}
                    placeholder="9876543210"
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
                
                <Text style={styles.helperText}>
                  Enter your 10-digit mobile number for order updates
                </Text>
              </View>
              
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={handleCancelPhone}
                  disabled={savingPhone}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalSaveBtn, savingPhone && styles.modalSaveBtnDisabled]}
                  onPress={handleSavePhone}
                  disabled={savingPhone}
                >
                  {savingPhone ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveText}>Save Number</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerRight: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F53F7A',
  },
  changeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F53F7A',
  },
  addressBox: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  addressName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  addressDetail: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 6,
  },
  addressPhone: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    marginBottom: 12,
  },
  addButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F53F7A',
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  itemsList: {
    gap: 1,
  },
  orderItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  metaTag: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#666',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  itemQty: {
    fontSize: 13,
    color: '#666',
  },
  itemTotalContainer: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  appliedBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  appliedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  appliedInfo: {
    flex: 1,
  },
  appliedCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
  appliedSavings: {
    fontSize: 13,
    color: '#15803d',
    marginTop: 2,
  },
  removeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  promoBox: {
    gap: 8,
  },
  promoInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  promoTextInput: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
    paddingVertical: 10,
  },
  applyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F53F7A',
    borderRadius: 6,
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  promoHint: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 16,
  },
  paymentOptions: {
    gap: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    backgroundColor: '#fafafa',
  },
  paymentOptionActive: {
    borderColor: '#F53F7A',
    backgroundColor: '#FFF5F8',
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: '#F53F7A',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F53F7A',
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  paymentTextActive: {
    color: '#F53F7A',
  },
  paymentSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  secureNoteText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  priceBreakdown: {
    gap: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  priceDiscount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  priceStrike: {
    fontSize: 13,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 6,
  },
  priceFree: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
  },
  savingsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 8,
  },
  savingsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#15803d',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F53F7A',
  },
  stickyBottom: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomLeft: {
    flex: 1,
  },
  bottomTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  viewDetails: {
    fontSize: 12,
    color: '#F53F7A',
    fontWeight: '600',
    marginTop: 2,
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F53F7A',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  checkoutButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
  },
  checkoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalClose: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#f9f9f9',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F53F7A',
  },
  modalSaveBtnDisabled: {
    backgroundColor: '#ccc',
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    overflow: 'hidden',
  },
  countryCodeBox: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  countryCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  phoneNumberInput: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
});

export default Checkout;