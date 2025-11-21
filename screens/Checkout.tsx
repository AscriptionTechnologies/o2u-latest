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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCart } from '~/contexts/CartContext';
import { useUser } from '~/contexts/UserContext';
import { useTranslation } from 'react-i18next';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '~/utils/supabase';
import OrderSuccessAnimation from '~/components/OrderSuccessAnimation';
import { createDraftOrder, type DraftOrderItem } from '~/utils/draftOrders';
import Toast from 'react-native-toast-message';
import { ResellerService } from '~/services/resellerService';

type CheckoutProps = {
  embedded?: boolean;
  showOrderItems?: boolean;
  onClose?: () => void;
};

type PaymentMethod = 'cod' | 'giftcard' | null;

const Checkout: React.FC<CheckoutProps> = ({ embedded = false, showOrderItems = true, onClose }) => {
  const navigation = useNavigation();
  const { cartItems, removeFromCart, clearCart } = useCart();
  const { userData } = useUser();
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [successOrderNumber, setSuccessOrderNumber] = useState('');
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);
  
  // Default address from address book
  const [defaultAddress, setDefaultAddress] = useState<any | null>(null);
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponAppliedCode, setCouponAppliedCode] = useState<string | null>(null);
  const [couponDiscountAmount, setCouponDiscountAmount] = useState(0);
  
  // Address management state
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  
  // Phone number management state
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  // Custom alert for contact info
  const [showContactAlert, setShowContactAlert] = useState(false);
  
  // Custom alert for order failed
  const [showOrderFailedAlert, setShowOrderFailedAlert] = useState(false);
  const [orderFailedMessage, setOrderFailedMessage] = useState('');
  
  // Custom alert for shipping address
  const [showAddressRequiredAlert, setShowAddressRequiredAlert] = useState(false);
  
  // Custom alert for empty cart
  const [showEmptyCartAlert, setShowEmptyCartAlert] = useState(false);

  // Reseller calculations from cart items
  const hasResellerItems = cartItems.some(item => item.isReseller);
  const resellerItems = cartItems.filter(item => item.isReseller);
  const totalResellerProfit = resellerItems.reduce((sum, item) => {
    const originalPrice = item.price * item.quantity;
    const sellingPrice = item.resellerPrice || originalPrice;
    return sum + (sellingPrice - originalPrice);
  }, 0);

  const formatAddressForReseller = useCallback((address?: any): string | undefined => {
    if (!address) return undefined;
    const parts = [
      address.line1,
      address.line2,
      address.landmark,
      address.city,
      address.state,
      address.postal_code,
      address.pincode,
    ]
      .filter(part => typeof part === 'string' && part.trim().length > 0)
      .map((part: string) => part.trim());

    if (!parts.length) {
      return undefined;
    }

    const uniqueParts = Array.from(new Set(parts));
    return uniqueParts.join(', ');
  }, []);

  const handleBackPress = () => {
    if (embedded) {
      onClose?.();
      return;
    }
    navigation.goBack();
  };

  const isValidUUID = (uuid?: string | null): boolean => {
    if (!uuid || typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid.trim());
  };

  const productLookupSelect =
    `id, name, sku, product_variants ( id, quantity, size (name), color (name) )`;

  const matchVariantForItem = (productData: any, item: any): string | null => {
    if (!productData?.product_variants || productData.product_variants.length === 0) {
      return isValidUUID(item?.variantId) ? item.variantId : null;
    }

    const normalize = (value?: string | null) =>
      (value || '').toString().trim().toLowerCase();

    const desiredSize = normalize(item?.size);
    const desiredColor = normalize(item?.color);

    const matchedVariant = productData.product_variants.find((variant: any) => {
      const variantSize = normalize(variant?.size?.name ?? variant?.size);
      const variantColor = normalize(variant?.color?.name ?? variant?.color);

      const sizeMatches = desiredSize ? variantSize === desiredSize : true;
      const colorMatches = desiredColor ? variantColor === desiredColor : true;

      return sizeMatches && colorMatches;
    });

    if (matchedVariant?.id && isValidUUID(matchedVariant.id)) {
      return matchedVariant.id;
    }

    const fallbackVariant = productData.product_variants.find(
      (variant: any) => variant?.id && isValidUUID(variant.id)
    );

    if (fallbackVariant?.id && isValidUUID(fallbackVariant.id)) {
      return fallbackVariant.id;
    }

    return isValidUUID(item?.variantId) ? item.variantId : null;
  };

  const fetchProductByField = async (
    field: 'id' | 'sku' | 'name',
    value: string
  ) => {
    try {
      if (!value || typeof value !== 'string') {
        return null;
      }

      let query = supabase.from('products').select(productLookupSelect).limit(1);

      if (field === 'name') {
        const term = value.trim();
        if (term.length === 0) {
          return null;
        }
        query = query.ilike('name', `%${term}%`);
      } else {
        query = query.eq(field, value.trim());
      }

      const { data, error } = await query;
      if (error) {
        console.warn(`[Checkout] fetchProductByField error (${field}=${value}):`, error);
        return null;
      }

      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error(`[Checkout] fetchProductByField unexpected error`, error);
      return null;
    }
  };

  const resolveOutOfStockItemIdentifiers = async (item: any) => {
    // If we already have a valid product ID, ensure variant is aligned
    if (isValidUUID(item?.productId)) {
      if (item?.variantId && isValidUUID(item.variantId)) {
        return { productId: item.productId, variantId: item.variantId };
      }
      const product = await fetchProductByField('id', item.productId);
      if (product) {
        return {
          productId: product.id,
          variantId: matchVariantForItem(product, item),
        };
      }
      return { productId: item.productId, variantId: item.variantId ?? null };
    }

    const candidateSet = new Set<string>();

    if (typeof item?.productId === 'string') {
      candidateSet.add(item.productId);
    }
    if (typeof item?.sku === 'string') {
      candidateSet.add(item.sku);
    }
    if (typeof item?.id === 'string') {
      const parts = item.id.split('-').filter(Boolean);
      parts.forEach(part => candidateSet.add(part));
    }

    // First try UUID candidates directly via ID lookup
    for (const candidate of candidateSet) {
      if (isValidUUID(candidate)) {
        const product = await fetchProductByField('id', candidate);
        if (product) {
          return {
            productId: product.id,
            variantId: matchVariantForItem(product, item),
          };
        }
      }
    }

    // Try SKU matches
    for (const candidate of candidateSet) {
      if (!candidate) continue;
      const product = await fetchProductByField('sku', candidate);
      if (product) {
        return {
          productId: product.id,
          variantId: matchVariantForItem(product, item),
        };
      }
    }

    // Finally, attempt to match by product name
    if (item?.name && typeof item.name === 'string') {
      const product = await fetchProductByField('name', item.name);
      if (product) {
        return {
          productId: product.id,
          variantId: matchVariantForItem(product, item),
        };
      }
    }

    return { productId: null, variantId: null };
  };

  // Check if any items are out of stock
  const checkStockAvailability = async () => {
    const outOfStockItems: any[] = [];
    const inStockItems: any[] = [];

    for (const item of cartItems) {
      try {
        const identifierCandidates: string[] = [];
        if (isValidUUID(item.productId)) {
          identifierCandidates.push(item.productId);
        }
        if (isValidUUID(item.sku)) {
          identifierCandidates.push(item.sku);
        }
        if (typeof item.id === 'string') {
          const candidate = item.id.split('-')[0];
          if (isValidUUID(candidate)) {
            identifierCandidates.push(candidate);
          }
        }

        let productIdentifier: string | null = null;
        let productData: any = null;
        let queryError: any = null;

        for (const candidate of identifierCandidates) {
          const { data, error } = await supabase
            .from('products')
            .select(`
              id,
              stock_quantity,
              product_variants (
                id,
                quantity,
                size (name),
                color (name)
              )
            `)
            .eq('id', candidate)
            .single();
          if (!error && data) {
            productData = data;
            productIdentifier = data.id;
            break;
          }
          queryError = error;
        }

        if (!productData && item.sku) {
          const { data, error } = await supabase
            .from('products')
            .select(`
              id,
              stock_quantity,
              product_variants (
                id,
                quantity,
                size (name),
                color (name)
              )
            `)
            .eq('sku', item.sku)
            .single();
          if (!error && data) {
            productData = data;
            productIdentifier = data.id;
          } else {
            queryError = error;
          }
        }

        if (!productData || !productIdentifier || !isValidUUID(productIdentifier)) {
          console.warn(`Could not resolve product data for cart item ${item.id}`, queryError);
          if (item.stock && item.stock >= item.quantity) {
            inStockItems.push({ ...item });
          } else {
            outOfStockItems.push({
              ...item,
              productId: item.productId || item.sku || item.id,
              requestedQuantity: item.quantity,
              availableQuantity: item.stock || 0,
            });
          }
          continue;
        }

        let availableQuantity = productData.stock_quantity ?? item.stock ?? 0;
        let variantId = item.variantId;

        if (productData.product_variants && productData.product_variants.length > 0) {
          const variant = productData.product_variants.find((v: any) =>
            v.size?.name === item.size && v.color?.name === item.color
          );
          if (variant) {
            availableQuantity = variant.quantity;
            variantId = variant.id || variantId;
          }
        }

        const normalizedItem = {
          ...item,
          productId: productData.id,
          variantId,
        };

        if (availableQuantity >= item.quantity) {
          inStockItems.push(normalizedItem);
        } else {
          outOfStockItems.push({
            ...normalizedItem,
            requestedQuantity: item.quantity,
            availableQuantity,
          });
        }
      } catch (error) {
        console.error(`Error checking stock for item ${item.id}:`, error);
        if (item.stock && item.stock >= item.quantity) {
          inStockItems.push({ ...item });
        } else {
          outOfStockItems.push({
            ...item,
            productId: item.productId || item.sku || item.id,
            requestedQuantity: item.quantity,
            availableQuantity: 0,
          });
        }
      }
    }

    return { outOfStockItems, inStockItems };
  };

  // Create draft order for out-of-stock items
  const createDraftOrderForOutOfStock = async (outOfStockItems: any[]) => {
    if (!userData?.id) {
      throw new Error('User ID is required to create draft order');
    }

    const resolvedItems = await Promise.all(
      outOfStockItems.map(async (item) => {
        try {
          const resolution = await resolveOutOfStockItemIdentifiers(item);
          return {
            ...item,
            productId: resolution.productId ?? item.productId,
            variantId: resolution.variantId ?? item.variantId,
          };
        } catch (error) {
          console.warn('[Checkout] Failed to resolve item for draft order:', item?.id, error);
          return { ...item };
        }
      })
    );

    const validItems = resolvedItems.filter((item) => isValidUUID(item.productId));
    const skippedItems = resolvedItems.length - validItems.length;

    if (validItems.length === 0) {
      console.warn('[Checkout] No resolvable out-of-stock items for draft order.');
      return {
        processedCount: 0,
        skippedCount: resolvedItems.length,
      };
    }

    const draftOrderItems: DraftOrderItem[] = validItems.map((item) => {
      const quantity = item.requestedQuantity || item.quantity || 1;
      const lineTotal =
        item.isReseller && item.resellerPrice
          ? item.resellerPrice
          : item.price * quantity;
      const unitPrice = lineTotal / quantity;

      return {
        product_id: item.productId,
        product_variant_id: item.variantId || null,
        product_name: item.name,
        product_sku: item.sku,
        product_image: item.image,
        size: item.size,
        color: item.color,
        quantity,
        unit_price: unitPrice,
        total_price: lineTotal,
      };
    });

    const totalAmount = draftOrderItems.reduce((sum, item) => sum + item.total_price, 0);

    const draftOrderData = {
      user_id: userData.id,
      total_amount: totalAmount,
      shipping_address: defaultAddress
        ? `${defaultAddress.address_line1}, ${defaultAddress.city}, ${defaultAddress.state} - ${defaultAddress.pincode}`
        : userData.location || 'Not provided',
      billing_address: defaultAddress
        ? `${defaultAddress.address_line1}, ${defaultAddress.city}, ${defaultAddress.state} - ${defaultAddress.pincode}`
        : userData.location || 'Not provided',
      payment_method: paymentMethod || 'cod',
      payment_status: 'pending',
      status: 'pending_approval',
      notes: `Draft order for out-of-stock items. Total items: ${validItems.length}`,
      items: draftOrderItems,
    };

    const draftOrder = await createDraftOrder(draftOrderData);

    // Remove the drafted items from the cart
    validItems.forEach((item) => removeFromCart(item.id));

    return {
      ...draftOrder,
      processedCount: validItems.length,
      skippedCount: Math.max(0, skippedItems),
    };
  };

  // Process regular order for in-stock items
  const processRegularOrder = async (itemsToProcess: any[]) => {
    // Temporarily update cart items for processing
    const originalCartItems = cartItems;
    
    // Create a temporary cart context with only in-stock items
    const tempCartItems = itemsToProcess;
    
    if (!defaultAddress) {
      setShowAddressRequiredAlert(true);
      throw new Error('Address required');
    }


    // Validate reseller items
    const resellerItems = tempCartItems.filter(item => item.isReseller);
    if (resellerItems.length > 0) {
      for (const item of resellerItems) {
        const originalPrice = item.price * item.quantity;
        if (!item.resellerPrice || item.resellerPrice <= 0) {
          Alert.alert('Invalid Reseller Price', `Please enter a valid selling price for "${item.name}".`);
          throw new Error('Invalid reseller price');
        }
        if (item.resellerPrice < originalPrice) {
          Alert.alert(
            'Invalid Reseller Price', 
            `Selling price cannot be less than the original price for "${item.name}".`
          );
          throw new Error('Invalid reseller price');
        }
      }
    }

    // Process COD order
    console.log('Processing COD order...');
    const orderData = await createOrder('pending', undefined, tempCartItems);
    
    // Remove only the processed items from cart
    const processedItemIds = tempCartItems.map(item => item.id);
    const remainingItems = originalCartItems.filter(item => !processedItemIds.includes(item.id));
    
    // Clear the cart after successful order
    clearCart();
    
    setSuccessOrderNumber(orderData.order_number);
    setShowSuccessAnimation(true);
    return orderData;
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
      Toast.show({
        type: 'error',
        text1: 'Invalid Address',
        text2: 'Please enter a valid address.',
      });
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
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to save address. Please try again.',
        });
        return;
      }

      if (userData) {
        userData.location = newAddress.trim();
      }

      setShowAddressModal(false);
      setNewAddress('');
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Address saved successfully!',
      });
    } catch (error) {
      console.error('Error saving address:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save address. Please try again.',
      });
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
      Toast.show({
        type: 'error',
        text1: 'Invalid Phone',
        text2: 'Please enter a valid phone number.',
      });
      return;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    const cleanPhone = newPhone.replace(/\D/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Phone',
        text2: 'Please enter a valid 10-digit Indian phone number.',
      });
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
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to save phone number. Please try again.',
        });
        return;
      }

      if (userData) {
        userData.phone = `+91${cleanPhone}`;
      }

      setShowPhoneModal(false);
      setNewPhone('');
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Phone number saved successfully!',
      });
    } catch (error) {
      console.error('Error saving phone:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save phone number. Please try again.',
      });
    } finally {
      setSavingPhone(false);
    }
  };

  const handleCancelPhone = () => {
    setShowPhoneModal(false);
    setNewPhone('');
  };

  const createOrder = async (
    paymentStatus: 'pending' | 'paid',
    paymentId?: string,
    itemsToProcess?: any[]
  ) => {
    const orderItems = itemsToProcess || cartItems;
    const resellerOrderItems: Array<{
      productId: string | null;
      variantId?: string | null;
      quantity: number;
      baseUnitPrice: number;
      resellerUnitPrice: number;
      baseTotal: number;
      resellerTotal: number;
      marginAmount: number;
    }> = [];
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

    const totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const finalAmount = Math.max(0, totalAmount - couponDiscountAmount);
    const status = paymentStatus === 'paid' ? 'confirmed' : 'pending';

    // Calculate reseller values from order items
    const originalTotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const resellerTotal = orderItems.reduce((sum, item) => {
      return sum + (item.isReseller && item.resellerPrice ? item.resellerPrice : item.price * item.quantity);
    }, 0);
    const totalProfit = resellerTotal - originalTotal;
    const hasResellerItems = orderItems.some(item => item.isReseller);

    console.log('Creating order with:', {
      userId,
      paymentMethod,
      paymentStatus,
      totalAmount: finalAmount,
      status,
      hasResellerItems,
      totalProfit
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
          discount_amount: couponDiscountAmount,
          shipping_address: userData?.location || 'Not provided',
          customer_name: userData?.name || 'Guest',
          customer_email: userData?.email || null,
          customer_phone: userData?.phone || null,
          is_reseller_order: hasResellerItems,
          reseller_margin_percentage: hasResellerItems ? ((totalProfit / originalTotal) * 100) : null,
          reseller_margin_amount: hasResellerItems ? totalProfit : null,
          original_total: hasResellerItems ? (originalTotal - couponDiscountAmount) : null,
          reseller_profit: hasResellerItems ? totalProfit : null,
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

    const orderItemsPayload = orderItems.map((item: any) => {
      const quantity = item.quantity || 1;
      const baseUnitPrice = item.price || 0;
      const baseTotal = baseUnitPrice * quantity;
      const resellerTotalOverride =
        item.isReseller && item.resellerPrice ? item.resellerPrice : null;
      const totalPrice = resellerTotalOverride ?? baseTotal;
      const unitPrice = resellerTotalOverride ? totalPrice / quantity : baseUnitPrice;

      let productId: string | null = null;
      if (isValidUUID(item.productId)) {
        productId = item.productId;
      } else if (isValidUUID(item.sku)) {
        productId = item.sku;
      } else if (typeof item.id === 'string') {
        const candidate = item.id.split('-')[0];
        if (isValidUUID(candidate)) {
          productId = candidate;
        }
      }

      let variantId: string | null = null;
      if (isValidUUID(item.variant_id)) {
        variantId = item.variant_id;
      } else if (isValidUUID(item.variantId)) {
        variantId = item.variantId;
      } else if (item.variant && isValidUUID(item.variant.id)) {
        variantId = item.variant.id;
      }

      if (item.isReseller && productId) {
        const resellerTotal = resellerTotalOverride ?? baseTotal;
        const resellerUnitPrice = resellerTotal / quantity;
        const marginAmount = resellerTotal - baseTotal;
        resellerOrderItems.push({
          productId,
          variantId,
          quantity,
          baseUnitPrice,
          resellerUnitPrice,
          baseTotal,
          resellerTotal,
          marginAmount,
        });
      }

      return {
        order_id: orderData.id,
        product_id: productId,
        product_name: item.name || 'Unknown Product',
        product_image: item.image || null,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
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

    if (hasResellerItems && userId && resellerOrderItems.length > 0) {
      try {
        const addressString = formatAddressForReseller(defaultAddress);
        await ResellerService.logResellerOrderFromCheckout({
          userId,
          orderId: orderData.id,
          orderNumber: orderData.order_number,
          paymentMethod,
          paymentStatus,
          totals: { originalTotal, resellerTotal, totalProfit },
          items: resellerOrderItems,
          customer: {
            name: defaultAddress?.full_name || defaultAddress?.name || userData?.name || 'Customer',
            phone: defaultAddress?.phone || userData?.phone || null,
            email: userData?.email || null,
            address: addressString || userData?.location || null,
            city: defaultAddress?.city || null,
            state: defaultAddress?.state || null,
            pincode: defaultAddress?.postal_code || defaultAddress?.pincode || null,
          },
        });
      } catch (error) {
        console.error('Failed to sync reseller order data:', error);
      }
    }

    // Log coupon usage if coupon was applied
    if (couponAppliedCode && orderData?.id && userId) {
      try {
        // Fetch coupon details
        const { data: coupon } = await supabase
          .from('coupons')
          .select('id')
          .eq('code', couponAppliedCode)
          .single();

        if (coupon) {
          // Insert coupon usage record
          await supabase
            .from('coupon_usage')
            .insert({
              coupon_id: coupon.id,
              user_id: userId,
              order_id: orderData.id,
              discount_amount: couponDiscountAmount,
            });
          
          console.log('Coupon usage logged:', couponAppliedCode);
        }
      } catch (error) {
        console.error('Failed to log coupon usage:', error);
        // Don't fail the order if coupon logging fails
      }
    }

    return orderData;
  };

  const handlePayNow = async () => {
    try {
      setLoading(true);

      if (!cartItems || cartItems.length === 0) {
        setShowEmptyCartAlert(true);
        return;
      }

      // Check stock availability for all items
      const { outOfStockItems, inStockItems } = await checkStockAvailability();

      console.log('Stock check results:', { 
        outOfStockCount: outOfStockItems.length, 
        inStockCount: inStockItems.length 
      });

      let draftOrderNumber: string | null = null;
      
      if (outOfStockItems.length > 0) {
        try {
          const draftOrder = await createDraftOrderForOutOfStock(outOfStockItems);
          console.log('Draft order created:', draftOrder);
          draftOrderNumber = draftOrder.order_number;
          // No toast here - will show combined success message later
        } catch (error) {
          console.error('Error creating draft order:', error);
          // Silently fail for draft order - show success for in-stock items
        }
      }

      const itemsToProcess = inStockItems;

      if (itemsToProcess.length === 0) {
        // All items were out of stock and moved to draft
        // Show as if order was successful
        if (draftOrderNumber) {
          setSuccessOrderNumber(draftOrderNumber);
          setShowSuccessAnimation(true);
          setLoading(false);
          return;
        } else {
          Toast.show({
            type: 'success',
            text1: 'Order Placed Successfully',
            text2: 'We will process your order shortly.',
          });
          setLoading(false);
          navigation.navigate('Cart' as never);
          return;
        }
      }

      await processRegularOrder(itemsToProcess);

    } catch (error: any) {
      console.error('Checkout error:', error);
      setOrderFailedMessage(error.message || 'Something went wrong. Please try again.');
      setShowOrderFailedAlert(true);
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
  const subtotal = useMemo(() => {
    return cartItems.reduce((total, item) => {
      // Use reseller price if item is being resold, otherwise use regular price
      const itemPrice = item.isReseller && item.resellerPrice 
        ? item.resellerPrice 
        : item.price * item.quantity;
      return total + itemPrice;
    }, 0);
  }, [cartItems]);

  // Calculate MRP and RSP totals for price breakdown
  const subtotalMrp = useMemo(() => {
    return cartItems.reduce((total, item) => {
      // Assume MRP is 20% higher than price for display purposes
      // In production, this should come from item.mrp or similar field
      const itemMrp = (item.price * 1.2) * item.quantity;
      return total + itemMrp;
    }, 0);
  }, [cartItems]);

  const subtotalRsp = useMemo(() => {
    return cartItems.reduce((total, item) => {
      const itemPrice = item.price * item.quantity;
      return total + itemPrice;
    }, 0);
  }, [cartItems]);

  const productDiscount = subtotalMrp - subtotalRsp;
  
  const shippingAmount = 0;
  const totalSavings = couponDiscountAmount;
  const totalDiscount = productDiscount + totalSavings;
  const payable = useMemo(() => {
    const raw = subtotal - couponDiscountAmount + shippingAmount;
    return raw > 0 ? raw : 0;
  }, [subtotal, couponDiscountAmount]);

  const finalTotal = payable;
  const coinsEarned = Math.round(subtotal * 0.25); // 25% of order value as coins

  const tryApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      Toast.show({
        type: 'error',
        text1: 'Enter Coupon Code',
        text2: 'Please enter a coupon code',
      });
      return;
    }

    try {
      // Fetch coupon from database
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (error || !coupon) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Coupon',
          text2: 'This coupon code is not valid',
        });
        return;
      }

      // Check if coupon is within valid date range
      const now = new Date();
      if (coupon.start_date && new Date(coupon.start_date) > now) {
        Toast.show({
          type: 'error',
          text1: 'Coupon Not Active',
          text2: 'This coupon is not yet active',
        });
        return;
      }

      if (coupon.end_date && new Date(coupon.end_date) < now) {
        Toast.show({
          type: 'error',
          text1: 'Coupon Expired',
          text2: 'This coupon has expired',
        });
        return;
      }

      // Check minimum order value
      if (coupon.min_order_value && subtotal < coupon.min_order_value) {
        Toast.show({
          type: 'error',
          text1: 'Minimum Order Not Met',
          text2: `Minimum order value is ₹${coupon.min_order_value}`,
        });
        return;
      }

      // Check max uses
      if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
        Toast.show({
          type: 'error',
          text1: 'Coupon Limit Reached',
          text2: 'This coupon has reached its usage limit',
        });
        return;
      }

      // Check per user limit if user is logged in
      if (coupon.per_user_limit && userData?.id) {
        const { data: userUsage, error: usageError } = await supabase
          .from('coupon_usage')
          .select('id')
          .eq('coupon_id', coupon.id)
          .eq('user_id', userData.id);

        if (!usageError && userUsage && userUsage.length >= coupon.per_user_limit) {
          Toast.show({
            type: 'error',
            text1: 'Usage Limit Reached',
            text2: `You can only use this coupon ${coupon.per_user_limit} time(s)`,
          });
          return;
        }
      }

      // Calculate discount
      let discount = 0;
      let couponDescription = '';

      if (coupon.discount_type === 'percentage') {
        discount = Math.round((subtotal * coupon.discount_value) / 100);
        couponDescription = `${coupon.discount_value}% off`;
      } else if (coupon.discount_type === 'fixed') {
        discount = Math.min(coupon.discount_value, subtotal);
        couponDescription = `Flat ₹${coupon.discount_value} off`;
      }

      // Ensure discount doesn't exceed subtotal
      discount = Math.min(discount, subtotal);

      setCouponAppliedCode(code);
      setCouponDiscountAmount(discount);
      setCouponCode('');

      Toast.show({
        type: 'success',
        text1: 'Coupon Applied! 🎉',
        text2: `${coupon.description || couponDescription} - You saved ₹${discount}`,
      });
    } catch (error) {
      console.error('Error applying coupon:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to apply coupon. Please try again.',
      });
    }
  };

  const removeCoupon = () => {
    setCouponAppliedCode(null);
    setCouponDiscountAmount(0);
    setCouponCode('');
    Toast.show({
      type: 'info',
      text1: 'Coupon Removed',
      text2: 'You can apply a different coupon',
    });
  };


  const insets = useSafeAreaInsets();
  const footerBottomPadding = Math.max(insets.bottom, 16);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <OrderSuccessAnimation
        visible={showSuccessAnimation}
        orderNumber={successOrderNumber}
        coinsEarned={coinsEarned}
        onClose={() => {
          setShowSuccessAnimation(false);
          if (embedded) {
            onClose?.();
          } else {
            navigation.goBack();
          }
        }}
        onViewOrders={() => {
          setShowSuccessAnimation(false);
          // Navigate to MyOrders which is nested in TabNavigator > Home stack
          (navigation as any).navigate('TabNavigator', {
            screen: 'Home',
            params: {
              screen: 'MyOrders',
            },
          });
        }}
      />

      {/* Header */}
      {embedded ? (
        <View style={styles.embeddedHeader}>
          <Text style={styles.embeddedTitle}>Checkout</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.embeddedCloseButton}>
              <Ionicons name="close" size={24} color="#1a1a1a" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Secure Checkout</Text>
          <View style={styles.headerRight}>
            <Ionicons name="shield-checkmark" size={20} color="#10b981" />
          </View>
        </View>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 + footerBottomPadding }]}
      >
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
            <TouchableOpacity onPress={() => (navigation as any).navigate('AddressBook', { selectMode: true })} style={styles.changeButton}>
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
              <TouchableOpacity 
                onPress={() => (navigation as any).navigate('AddressBook', { selectMode: true })}
                style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1.5, borderColor: '#F53F7A', borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#F53F7A', fontWeight: '700', fontSize: 14 }}>Change Address</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="location-outline" size={32} color="#ccc" />
              <Text style={styles.emptyText}>No delivery address added</Text>
              <TouchableOpacity onPress={() => (navigation as any).navigate('AddressBook', { selectMode: true })} style={styles.addButton}>
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

        {/* Apply Coupon Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconBadge}>
                <Ionicons name="pricetag" size={18} color="#F53F7A" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Apply Coupon</Text>
                <Text style={styles.cardSubtitle}>Save more on your order</Text>
              </View>
            </View>
          </View>

          {couponAppliedCode ? (
            <View style={styles.appliedBox}>
              <View style={styles.appliedContent}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <View style={styles.appliedInfo}>
                  <Text style={styles.appliedCode}>Coupon: {couponAppliedCode}</Text>
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
                  returnKeyType="done"
                  onSubmitEditing={tryApplyCoupon}
                />
                <TouchableOpacity onPress={tryApplyCoupon} style={styles.applyBtn}>
                  <Text style={styles.applyBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>
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
          </View>
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
            {/* Item Count */}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Price ({cartItems.length} item{cartItems.length > 1 ? 's' : ''})</Text>
              <Text style={styles.priceValue}>₹{subtotal.toFixed(2)}</Text>
            </View>

            {/* Coupon Discount */}
            {couponDiscountAmount > 0 && (
              <View style={styles.priceRow}>
                <View style={styles.discountLabelRow}>
                  <Text style={styles.priceLabel}>Coupon Discount</Text>
                  <View style={styles.couponBadge}>
                    <Text style={styles.couponBadgeText}>{couponAppliedCode}</Text>
                  </View>
                </View>
                <Text style={styles.priceDiscount}>-₹{couponDiscountAmount.toFixed(2)}</Text>
              </View>
            )}

            {/* Delivery Charges */}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Delivery Charges</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.priceStrike}>₹50</Text>
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>FREE</Text>
                </View>
              </View>
            </View>

            {/* Total Savings Banner */}
            {totalSavings > 0 && (
              <View style={styles.savingsBox}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={styles.savingsText}>
                  You saved ₹{totalSavings.toFixed(2)} on this order! 🎉
                </Text>
              </View>
            )}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Total Payable */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Payable</Text>
              <Text style={styles.totalValue}>₹{payable.toFixed(2)}</Text>
            </View>

            {/* Coins Earned Info */}
            <View style={styles.coinsEarnedRow}>
              <Ionicons name="trophy" size={16} color="#FFB800" />
              <Text style={styles.coinsEarnedText}>
                You'll earn {coinsEarned} coins with this order
              </Text>
            </View>

            {hasResellerItems && totalResellerProfit > 0 && (
              <>
                <View style={styles.resellerMarginRow}>
                  <View style={styles.resellerMarginLabelContainer}>
                    <Ionicons name="trending-up" size={16} color="#10B981" />
                    <Text style={styles.resellerMarginLabel}>
                      Your Reseller Profit
                    </Text>
                  </View>
                  <Text style={styles.resellerMarginValue}>+₹{totalResellerProfit.toFixed(2)}</Text>
                </View>
                <View style={styles.resellerInfo}>
                  <Ionicons name="information-circle-outline" size={14} color="#10B981" />
                  <Text style={styles.resellerInfoTextSmall}>
                    {resellerItems.length} item(s) marked for reselling
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={[styles.stickyBottom, { paddingBottom: footerBottomPadding }]}>
        <TouchableOpacity 
          style={styles.footerPriceInfo}
          onPress={() => setShowPriceBreakdown(true)}
          activeOpacity={0.7}
        >
          <View style={styles.totalPriceLabelRow}>
            <Text style={styles.footerPriceLabel}>Total Price</Text>
            <Ionicons name="chevron-down" size={16} color="#666" style={{ marginLeft: 4 }} />
          </View>
          <Text style={styles.footerPriceValue}>₹{payable.toFixed(2)}</Text>
        </TouchableOpacity>
        
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
                    onChangeText={(text) => {
                      const cleaned = text.replace(/\D/g, '');
                      if (cleaned.length <= 10) {
                        setNewPhone(cleaned);
                      }
                    }}
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

      {/* Price Breakdown Modal */}
      <Modal
        visible={showPriceBreakdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPriceBreakdown(false)}>
        <View style={styles.breakdownModalOverlay}>
          <View style={styles.breakdownModalContent}>
            {/* Header */}
            <View style={styles.breakdownHeader}>
              <Text style={styles.breakdownTitle}>Price Breakdown</Text>
              <TouchableOpacity 
                onPress={() => setShowPriceBreakdown(false)}
                style={styles.breakdownCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Breakdown Items */}
            <ScrollView style={styles.breakdownScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>MRP Total ({cartItems.length} items)</Text>
                <Text style={styles.breakdownValue}>₹{subtotalMrp.toFixed(2)}</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>RSP Total</Text>
                <Text style={styles.breakdownValue}>₹{subtotalRsp.toFixed(2)}</Text>
              </View>

              {hasResellerItems && totalResellerProfit > 0 && (
                <View style={[styles.breakdownItem, styles.breakdownItemGreen]}>
                  <View style={styles.breakdownLabelWithIcon}>
                    <Ionicons name="trending-up" size={16} color="#666" />
                    <Text style={styles.breakdownLabelGreen}>Reseller Margin ({resellerItems.length} items)</Text>
                  </View>
                  <Text style={styles.breakdownValueGreen}>+₹{totalResellerProfit.toFixed(2)}</Text>
                </View>
              )}
              
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Delivery Charges</Text>
                {shippingAmount === 0 ? (
                  <View style={styles.breakdownFreeTag}>
                    <Text style={styles.breakdownFreeText}>FREE</Text>
                  </View>
                ) : (
                  <Text style={styles.breakdownValue}>₹{shippingAmount.toFixed(2)}</Text>
                )}
              </View>

              {totalDiscount > 0 && (
                <View style={[styles.breakdownItem, styles.breakdownItemSavings]}>
                  <Text style={styles.breakdownLabel}>Discount</Text>
                  <Text style={styles.breakdownValueSavings}>-₹{totalDiscount.toFixed(2)}</Text>
                </View>
              )}

              <View style={styles.breakdownDivider} />

              <View style={[styles.breakdownItem, styles.breakdownTotal]}>
                <Text style={styles.breakdownTotalLabel}>Total Amount</Text>
                <Text style={styles.breakdownTotalValue}>₹{finalTotal.toFixed(2)}</Text>
              </View>

              <View style={styles.breakdownTaxNote}>
                <Text style={styles.breakdownTaxNoteText}>
                  (Inclusive of all taxes)
                </Text>
              </View>

              {totalDiscount > 0 && (
                <View style={styles.breakdownSavingsHighlight}>
                  <Ionicons name="happy-outline" size={18} color="#666" />
                  <Text style={styles.breakdownSavingsText}>
                    You will save ₹{totalDiscount.toFixed(2)} on this order
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity 
              style={styles.breakdownDoneButton}
              onPress={() => setShowPriceBreakdown(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.breakdownDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Contact Information Required Alert */}
      <Modal
        visible={showContactAlert}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowContactAlert(false)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            {/* Title */}
            <Text style={styles.alertTitle}>Contact Information Required</Text>
            
            {/* Message */}
            <Text style={styles.alertMessage}>
              Please provide your name and phone number for online payments.
            </Text>
            
            {/* Buttons */}
            <View style={styles.alertButtonsContainer}>
              <TouchableOpacity
                style={styles.alertButtonCancel}
                onPress={() => setShowContactAlert(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.alertButtonCancelText}>CANCEL</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.alertButtonSecondary}
                onPress={() => {
                  setShowContactAlert(false);
                  setPaymentMethod('cod');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.alertButtonSecondaryText}>USE COD INSTEAD</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.alertButtonPrimary}
                onPress={() => {
                  setShowContactAlert(false);
                  handleAddPhone();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.alertButtonPrimaryText}>ADD PHONE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Order Failed Alert */}
      <Modal
        visible={showOrderFailedAlert}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOrderFailedAlert(false)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            {/* Title */}
            <Text style={styles.alertTitle}>Order Failed</Text>
            
            {/* Message */}
            <Text style={styles.alertMessage}>
              {orderFailedMessage}
            </Text>
            
            {/* Button */}
            <TouchableOpacity
              style={styles.alertButtonPrimary}
              onPress={() => setShowOrderFailedAlert(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.alertButtonPrimaryText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Shipping Address Required Alert */}
      <Modal
        visible={showAddressRequiredAlert}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddressRequiredAlert(false)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            {/* Title */}
            <Text style={styles.alertTitle}>Shipping Address Required</Text>
            
            {/* Message */}
            <Text style={styles.alertMessage}>
              Please add your shipping address before proceeding.
            </Text>
            
            {/* Buttons */}
            <View style={styles.alertButtonsContainer}>
              <TouchableOpacity
                style={styles.alertButtonCancel}
                onPress={() => setShowAddressRequiredAlert(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.alertButtonCancelText}>CANCEL</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.alertButtonPrimary}
                onPress={() => {
                  setShowAddressRequiredAlert(false);
                  (navigation as any).navigate('AddressBook', { selectMode: true });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.alertButtonPrimaryText}>ADD ADDRESS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Empty Cart Alert */}
      <Modal
        visible={showEmptyCartAlert}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEmptyCartAlert(false)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            {/* Title */}
            <Text style={styles.alertTitle}>Empty Cart</Text>
            
            {/* Message */}
            <Text style={styles.alertMessage}>
              Please add items to your cart before checking out.
            </Text>
            
            {/* Button */}
            <TouchableOpacity
              style={styles.alertButtonPrimary}
              onPress={() => {
                setShowEmptyCartAlert(false);
                navigation.goBack();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.alertButtonPrimaryText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  discountLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  couponBadge: {
    backgroundColor: '#FFF1F4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  couponBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F53F7A',
  },
  freeBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  freeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  savingsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  savingsText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#15803d',
  },
  coinsEarnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF9E6',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FFE499',
  },
  coinsEarnedText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#B8860B',
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
    paddingTop: 12,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10,
  },
  footerPriceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  totalPriceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerPriceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  footerPriceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
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
  // Reseller Styles
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#10B981',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  resellerContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  marginInputContainer: {
    marginBottom: 12,
  },
  marginLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  marginInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#f9f9f9',
  },
  marginInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 4,
    marginBottom: 8,
  },
  resellerPreview: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: '#666',
  },
  previewValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  profitValue: {
    color: '#10B981',
    fontWeight: '700',
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  previewLabelBold: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  previewValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F53F7A',
  },
  profitBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98115',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    gap: 8,
  },
  profitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  resellerInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  resellerInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  resellerMarginRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  resellerMarginLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resellerMarginLabel: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  resellerMarginValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  resellerInfoTextSmall: {
    fontSize: 12,
    color: '#10B981',
    marginLeft: 4,
  },
  // Price Breakdown Modal Styles
  breakdownModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  breakdownModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 20,
    maxHeight: '70%',
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  breakdownTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  breakdownCloseButton: {
    padding: 4,
  },
  breakdownScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  breakdownItemGreen: {
    // Remove background color
    paddingHorizontal: 0,
    marginHorizontal: 0,
  },
  breakdownItemSavings: {
    // Remove background color
    paddingHorizontal: 0,
    marginHorizontal: 0,
  },
  breakdownLabel: {
    fontSize: 15,
    color: '#000', // Black text
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: 15,
    color: '#000', // Black text
    fontWeight: '600',
  },
  breakdownLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breakdownLabelGreen: {
    fontSize: 15,
    color: '#000', // Black text instead of green
    fontWeight: '500',
  },
  breakdownValueGreen: {
    fontSize: 15,
    color: '#000', // Black text instead of green
    fontWeight: '600',
  },
  breakdownValueSavings: {
    fontSize: 15,
    color: '#000', // Black text instead of orange
    fontWeight: '600',
  },
  breakdownFreeTag: {
    backgroundColor: 'transparent', // No background
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  breakdownFreeText: {
    fontSize: 15,
    color: '#000', // Black text
    fontWeight: '600',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  breakdownTotal: {
    backgroundColor: 'transparent', // No background
    paddingHorizontal: 0,
    marginHorizontal: 0,
    borderRadius: 0,
    paddingVertical: 16,
  },
  breakdownTotalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000', // Black text
  },
  breakdownTotalValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F53F7A', // Keep pink for total
  },
  breakdownTaxNote: {
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 12,
  },
  breakdownTaxNoteText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  breakdownSavingsHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 0,
    backgroundColor: 'transparent', // No background
    borderRadius: 0,
    marginTop: 12,
    borderWidth: 0,
  },
  breakdownSavingsText: {
    fontSize: 14,
    color: '#000', // Black text instead of green
    fontWeight: '500',
    flex: 1,
  },
  breakdownDoneButton: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#F53F7A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#F53F7A',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  breakdownDoneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  // Custom Alert Styles
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  alertContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  alertMessage: {
    fontSize: 15,
    fontWeight: '400',
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  alertButtonsContainer: {
    gap: 10,
  },
  alertButtonCancel: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  alertButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 0.5,
  },
  alertButtonSecondary: {
    backgroundColor: '#FFF5F8',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F53F7A',
  },
  alertButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F53F7A',
    letterSpacing: 0.5,
  },
  alertButtonPrimary: {
    backgroundColor: '#F53F7A',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  alertButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
});

export default Checkout;