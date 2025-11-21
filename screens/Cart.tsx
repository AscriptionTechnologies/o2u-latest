import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Dimensions,
  StatusBar,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCart } from '~/contexts/CartContext';
import { useUser } from '~/contexts/UserContext';
import { SaveToCollectionSheet } from '~/components/common';
import Toast from 'react-native-toast-message';
import OrderSuccessAnimation from '~/components/OrderSuccessAnimation';
import { createDraftOrder, type DraftOrderItem } from '~/utils/draftOrders';
import { supabase } from '~/utils/supabase';
import { ResellerService } from '~/services/resellerService';
import RazorpayService from '~/services/razorpayService';

type PaymentMethod = 'cod' | 'razorpay' | 'upi' | 'card' | 'wallet' | 'paylater';

type PaymentOption = {
  key: PaymentMethod;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  available: boolean;
};

const COD_PAYMENT_OPTION: PaymentOption = {
  key: 'cod',
  title: 'COD',
  subtitle: 'Pay when your order arrives',
  icon: 'cash',
  available: true,
};

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const COIN_CONFETTI_COUNT = 50;
const COIN_STAR_COUNT = 6;
const COIN_CONFETTI_COLORS = [
  '#F59E0B',
  '#F97316',
  '#FDBA74',
  '#34D399',
  '#60A5FA',
  '#C084FC',
  '#F472B6',
];

const REFERRAL_METADATA_PREFIX = 'REFERRALS:';

const parseReferralRewardMetadata = (rawDescription?: string) => {
  if (!rawDescription) return null;
  const parts = rawDescription.split('|');
  const metaPart = parts.find(part => part.startsWith(REFERRAL_METADATA_PREFIX));
  if (!metaPart) return null;

  const [referralSection, maxSection] = metaPart.split(':MAX:');
  const referralCount = Number(referralSection.replace(REFERRAL_METADATA_PREFIX, '')) || 0;
  const maxDiscount = Number(maxSection) || 0;

  return { referralCount, maxDiscount };
};

const getCouponDescriptionText = (rawDescription?: string) => {
  if (!rawDescription) return '';
  return rawDescription.split('|')[0]?.trim() || '';
};

const Cart = () => {
  const insets = useSafeAreaInsets();
  const footerBottomPadding = Math.max(insets.bottom, 16);
  const navigation = useNavigation();
  const { cartItems, removeFromCart, updateQuantity, addToCart, toggleReseller, updateResellerPrice } = useCart();
  const { userData, setUserData } = useUser();
  
  // Reseller modal state
  const [showResellerModal, setShowResellerModal] = useState(false);
  const [selectedItemForResell, setSelectedItemForResell] = useState<any>(null);
  const [resellerPriceInput, setResellerPriceInput] = useState('');
  
  // Price breakdown modal state
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);
  
  // Size selection modal state
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [selectedItemForSize, setSelectedItemForSize] = useState<any>(null);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [selectedNewSize, setSelectedNewSize] = useState<string>('');
  
  // Collection sheet state
  const [showCollectionSheet, setShowCollectionSheet] = useState(false);
  const [productForCollection, setProductForCollection] = useState<any>(null);
  
  // Remove item modal state
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<any>(null);

  // Address state
  const [defaultAddress, setDefaultAddress] = useState<any | null>(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponAppliedCode, setCouponAppliedCode] = useState<string | null>(null);
  const [couponDiscountAmount, setCouponDiscountAmount] = useState(0);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [referralRewardSummary, setReferralRewardSummary] = useState<{
    couponId: string;
    couponCode: string;
    referralCount: number;
    maxDiscount: number;
  } | null>(null);
  const COUPONS_TO_SHOW = 3; // Number of coupons to show before "See More"

  // Coin redemption state
  const [coinDiscountAmount, setCoinDiscountAmount] = useState(0);
  const [coinsToRedeem, setCoinsToRedeem] = useState(0);
  const [showCoinCelebration, setShowCoinCelebration] = useState(false);
  const coinConfettiAnims = useRef(
    Array.from({ length: COIN_CONFETTI_COUNT }, () => ({
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;
  const coinConfettiMeta = useRef(
    Array.from({ length: COIN_CONFETTI_COUNT }, (_, idx) => ({
      direction: Math.random() > 0.5 ? 1 : -1,
      spread: 60 + Math.random() * 120,
      delay: (idx % 10) * 120 + Math.random() * 60,
      startX: (idx / COIN_CONFETTI_COUNT) * SCREEN_WIDTH,
    }))
  ).current;
  const coinStarAnims = useRef(
    Array.from({ length: COIN_STAR_COUNT }, () => ({
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
    }))
  ).current;
  const coinStarMeta = useRef(
    Array.from({ length: COIN_STAR_COUNT }, (_, idx) => {
      const angle = (idx / COIN_STAR_COUNT) * Math.PI * 2;
      const distance = 40 + Math.random() * 25;
      return {
        angle,
        distance,
        targetX: Math.cos(angle) * distance,
        targetY: -Math.abs(Math.sin(angle)) * distance - 10,
        delay: idx * 60,
      };
    })
  ).current;
  const coinBadgeScale = useRef(new Animated.Value(0)).current;
  const coinBadgeGlow = useRef(new Animated.Value(0)).current;

  // Payment & order state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [successOrderNumber, setSuccessOrderNumber] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const paymentOptions = useMemo<PaymentOption[]>(
    () => [
      COD_PAYMENT_OPTION,
      {
        key: 'razorpay',
        title: 'Online Payment',
        subtitle: 'Cards, UPI, Wallets & more',
        icon: 'card',
        available: true,
      },
      {
        key: 'upi',
        title: 'UPI (Coming soon)',
        subtitle: 'Google Pay, PhonePe, Paytm',
        icon: 'phone-portrait-outline',
        available: false,
      },
      {
        key: 'card',
        title: 'Cards (Coming soon)',
        subtitle: 'Credit / Debit cards',
        icon: 'card-outline',
        available: false,
      },
      {
        key: 'wallet',
        title: 'Wallets (Coming soon)',
        subtitle: 'Paytm, Amazon Pay',
        icon: 'wallet-outline',
        available: false,
      },
      {
        key: 'paylater',
        title: 'Pay Later (Coming soon)',
        subtitle: 'Get now, pay later',
        icon: 'time-outline',
        available: false,
      },
    ],
    []
  );
  const activePayment = useMemo(
    () => paymentOptions.find(option => option.key === paymentMethod) || paymentOptions[0] || COD_PAYMENT_OPTION,
    [paymentOptions, paymentMethod]
  );

  const hasResellerItems = useMemo(() => cartItems.some(item => item.isReseller), [cartItems]);

  const formatAddressForReseller = useCallback((address?: any): string | undefined => {
    if (!address) return undefined;
    const parts = [
      address.line1,
      address.line2,
      address.street_line1,
      address.street_line2,
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
        console.warn(`[Cart Checkout] fetchProductByField error (${field}=${value}):`, error);
        return null;
      }

      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error(`[Cart Checkout] fetchProductByField unexpected error`, error);
      return null;
    }
  };

  const resolveOutOfStockItemIdentifiers = async (item: any) => {
    if (isValidUUID(item?.productId)) {
      if (item?.variantId && isValidUUID(item.variantId)) {
        return { productId: item.productId, variantId: item.variantId };
      }

      const { data: productData } = await supabase
        .from('products')
        .select(productLookupSelect)
        .eq('id', item.productId)
        .maybeSingle();

      if (productData) {
        const matchedVariantId = matchVariantForItem(productData, item);
        return { productId: item.productId, variantId: matchedVariantId };
      }
    }

    const sku = (item?.sku || '').toString().trim();
    if (sku.length > 0) {
      const productData = await fetchProductByField('sku', sku);
      if (productData?.id) {
        const variantId = matchVariantForItem(productData, item);
        return { productId: productData.id, variantId };
      }
    }

    if (typeof item?.name === 'string' && item.name.trim().length > 0) {
      const productData = await fetchProductByField('name', item.name);
      if (productData?.id) {
        const variantId = matchVariantForItem(productData, item);
        return { productId: productData.id, variantId };
      }
    }

    return {
      productId: isValidUUID(item?.productId) ? item.productId : null,
      variantId: isValidUUID(item?.variantId) ? item.variantId : null,
    };
  };

  const fetchProductAndVariant = async (item: any) => {
    const identifiers = await resolveOutOfStockItemIdentifiers(item);

    if (identifiers.productId) {
      const { data: productData } = await supabase
        .from('products')
        .select(productLookupSelect)
        .eq('id', identifiers.productId)
        .maybeSingle();

      if (productData) {
        if (!identifiers.variantId) {
          identifiers.variantId = matchVariantForItem(productData, item);
        }

        if (identifiers.variantId) {
          const targetVariant = productData.product_variants?.find(
            (variant: any) => variant?.id === identifiers.variantId
          );
          if (targetVariant) {
            return { product: productData, variant: targetVariant };
          }
        }

        const fallbackVariant = productData.product_variants?.find(
          (variant: any) => variant?.quantity && variant.quantity > 0
        );
        if (fallbackVariant) {
          return { product: productData, variant: fallbackVariant };
        }
      }
    }

    return { product: null, variant: null };
  };

  const checkStockAvailability = useCallback(async () => {
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
  }, [cartItems]);

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
          console.warn('[Cart Checkout] Failed to resolve item for draft order:', item?.id, error);
          return { ...item };
        }
      })
    );

    const validItems = resolvedItems.filter((item) => isValidUUID(item.productId));
    const skippedItems = resolvedItems.length - validItems.length;

    if (validItems.length === 0) {
      console.warn('[Cart Checkout] No resolvable out-of-stock items for draft order.');
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
        ? `${defaultAddress.address_line1 || defaultAddress.street_line1}, ${defaultAddress.city}, ${defaultAddress.state} - ${defaultAddress.postal_code || defaultAddress.pincode}`
        : userData?.location || 'Not provided',
      billing_address: defaultAddress
        ? `${defaultAddress.address_line1 || defaultAddress.street_line1}, ${defaultAddress.city}, ${defaultAddress.state} - ${defaultAddress.postal_code || defaultAddress.pincode}`
        : userData?.location || 'Not provided',
      payment_method: paymentMethod || 'cod',
      payment_status: 'pending',
      status: 'pending_approval',
      notes: `Draft order for out-of-stock items. Total items: ${validItems.length}`,
      items: draftOrderItems,
    };

    const draftOrder = await createDraftOrder(draftOrderData);

    validItems.forEach((item) => removeFromCart(item.id));

    return {
      ...draftOrder,
      processedCount: validItems.length,
      skippedCount: Math.max(0, skippedItems),
    };
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

    let userId: string | null = null;

    if (userData?.id) {
      const rawId = String(userData.id).trim();

      if (
        rawId === 'mock-user-id' ||
        rawId.toLowerCase() === 'n/a' ||
        rawId === 'undefined' ||
        rawId === 'null' ||
        !isValidUUID(rawId)
      ) {
        console.warn('Invalid user ID detected, setting to null:', rawId);
        userId = null;
      } else {
        userId = rawId;
      }
    }

    const orderItemSubtotal = orderItems.reduce((sum, item) => {
      if (item.isReseller && item.resellerPrice) {
        return sum + item.resellerPrice;
      }
      const { rsp } = getItemPricing(item);
      return sum + (rsp * (item.quantity || 1));
    }, 0);

    const finalAmount = Math.max(0, orderItemSubtotal - couponDiscountAmount - coinDiscountAmount);
    const status = paymentStatus === 'paid' ? 'confirmed' : 'pending';

    const originalTotal = orderItems.reduce((sum, item) => {
      const { rsp } = getItemPricing(item);
      return sum + (rsp * (item.quantity || 1));
    }, 0);
    const resellerTotal = orderItems.reduce((sum, item) => {
      if (item.isReseller && item.resellerPrice) {
        return sum + item.resellerPrice;
      }
      const { rsp } = getItemPricing(item);
      return sum + (rsp * (item.quantity || 1));
    }, 0);
    const totalProfit = resellerTotal - originalTotal;
    const hasResellerInOrder = orderItems.some(item => item.isReseller);

    const shippingAddressString = defaultAddress
      ? `${defaultAddress.street_line1 || defaultAddress.address_line1 || ''}, ${defaultAddress.city || ''}, ${defaultAddress.state || ''} - ${defaultAddress.postal_code || defaultAddress.pincode || ''}`.trim()
      : userData?.location || 'Not provided';

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          user_id: userId,
          status,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          payment_id: paymentId || null,
          total_amount: finalAmount,
          subtotal: originalTotal,
          shipping_amount: 0,
          tax_amount: 0,
          discount_amount: couponDiscountAmount + coinDiscountAmount,
          shipping_address: shippingAddressString,
          customer_name: defaultAddress?.full_name || userData?.name || 'Guest',
          customer_email: userData?.email || null,
          customer_phone: defaultAddress?.phone || userData?.phone || null,
          is_reseller_order: hasResellerInOrder,
          reseller_margin_percentage: hasResellerInOrder && originalTotal > 0 ? ((totalProfit / originalTotal) * 100) : null,
          reseller_margin_amount: hasResellerInOrder ? totalProfit : null,
          original_total: hasResellerInOrder ? (originalTotal - couponDiscountAmount) : null,
          reseller_profit: hasResellerInOrder ? totalProfit : null,
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

    const orderItemsPayload = orderItems.map((item: any) => {
      const quantity = item.quantity || 1;
      const { rsp } = getItemPricing(item);
      const baseUnitPrice = rsp || 0;
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
        const resellerTotalLine = resellerTotalOverride ?? baseTotal;
        const resellerUnitPrice = resellerTotalLine / quantity;
        const marginAmount = resellerTotalLine - baseTotal;
        resellerOrderItems.push({
          productId,
          variantId,
          quantity,
          baseUnitPrice,
          resellerUnitPrice,
          baseTotal,
          resellerTotal: resellerTotalLine,
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

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsPayload);

    if (itemsError) {
      console.error('Order items creation error:', itemsError);
      await supabase.from('orders').delete().eq('id', orderData.id);
      throw new Error(itemsError.message || 'Failed to create order items');
    }

    if (hasResellerInOrder && userId && resellerOrderItems.length > 0) {
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

    if (couponAppliedCode && orderData?.id && userId) {
      try {
        // Find the coupon that was used
        const { data: coupon, error: couponError } = await supabase
          .from('coupons')
          .select('id, code, created_by')
          .eq('code', couponAppliedCode)
          .single();

        if (couponError || !coupon) {
          console.error('Failed to find coupon:', couponError);
          return orderData;
        }

        // Log usage for the coupon that was used
        const { error: usageError } = await supabase
          .from('coupon_usage')
          .insert({
            coupon_id: coupon.id,
            user_id: userId,
            order_id: orderData.id,
            discount_amount: couponDiscountAmount,
          });

        if (usageError) {
          console.error('Failed to log coupon usage:', usageError);
        }

        // If this is a referral coupon code, also log usage on the referrer's referral coupon
        // The referrer has a coupon with the same code (created when they accessed referral feature)
        // Find all coupons with this code that were created by other users (referrers)
        const { data: referrerCoupons, error: referrerCouponsError } = await supabase
          .from('coupons')
          .select('id, created_by')
          .eq('code', couponAppliedCode)
          .neq('created_by', userId)
          .not('created_by', 'is', null);

        if (!referrerCouponsError && referrerCoupons && referrerCoupons.length > 0) {
          // Log usage on the referrer's coupon(s) for their analytics
          // Typically there should be only one referrer coupon per code
          for (const refCoupon of referrerCoupons) {
            if (refCoupon.created_by && refCoupon.id !== coupon.id) {
              const { error: refUsageError } = await supabase
                .from('coupon_usage')
                .insert({
                  coupon_id: refCoupon.id,
                  user_id: userId, // The user who used the coupon (the referred user)
                  order_id: orderData.id,
                  discount_amount: couponDiscountAmount,
                });

              if (!refUsageError) {
                console.log('📊 Referral coupon usage logged for referrer analytics:', {
                  referrerId: refCoupon.created_by,
                  referredUserId: userId,
                  couponCode: couponAppliedCode,
                  referrerCouponId: refCoupon.id,
                });
              } else {
                console.error('Failed to log referrer coupon usage:', refUsageError);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to log coupon usage:', error);
      }
    }

    return orderData;
  };

  const processRazorpayOrder = async (itemsToProcess: any[]) => {
    if (!defaultAddress) {
      Alert.alert('Address Required', 'Please add a delivery address to continue.');
      throw new Error('Address required');
    }

    const resellerItemsForValidation = itemsToProcess.filter(item => item.isReseller);
    if (resellerItemsForValidation.length > 0) {
      for (const item of resellerItemsForValidation) {
        const { rsp } = getItemPricing(item);
        const originalPrice = rsp * (item.quantity || 1);
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

    // Calculate order total
    const orderItemSubtotal = itemsToProcess.reduce((sum, item) => {
      if (item.isReseller && item.resellerPrice) {
        return sum + item.resellerPrice;
      }
      const { rsp } = getItemPricing(item);
      return sum + (rsp * (item.quantity || 1));
    }, 0);

    const finalAmount = Math.max(0, orderItemSubtotal - couponDiscountAmount - coinDiscountAmount);

    try {
      console.log('[Cart] Processing Razorpay order:', {
        finalAmount,
        itemCount: itemsToProcess.length,
        userName: defaultAddress?.full_name || userData?.name,
        email: userData?.email,
        phone: defaultAddress?.phone || userData?.phone,
      });

      // Validate final amount
      if (!finalAmount || finalAmount <= 0) {
        Alert.alert('Invalid Amount', 'Order amount must be greater than ₹0.');
        throw new Error('Invalid order amount');
      }

      // Process Razorpay payment
      const paymentResponse = await RazorpayService.processPayment(
        finalAmount,
        `Order from Only2U - ${itemsToProcess.length} item(s)`,
        {
          name: defaultAddress?.full_name || userData?.name || 'Customer',
          email: userData?.email || undefined,
          contact: defaultAddress?.phone || userData?.phone?.replace('+91', '') || undefined,
        }
      );

      console.log('[Cart] Razorpay payment successful:', paymentResponse);

      // Payment successful, create order with payment details
      const orderData = await createOrder(
        'paid',
        paymentResponse.paymentId,
        itemsToProcess
      );

      itemsToProcess.forEach(item => removeFromCart(item.id));

      setSuccessOrderNumber(orderData.order_number);
      setShowSuccessAnimation(true);
      await updateCoinBalanceAfterOrder();

      Toast.show({
        type: 'success',
        text1: 'Payment Successful',
        text2: 'Your order has been placed successfully!',
      });

      return orderData;
    } catch (error: any) {
      console.error('[Cart] Razorpay payment error:', error);
      console.error('[Cart] Error details:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        fullError: error,
      });
      
      // Payment failed or cancelled
      const errorMessage = error?.message || 'Payment failed. Please try again.';
      
      // Check if it's a setup/configuration error
      if (errorMessage.includes('not available') || errorMessage.includes('not installed') || errorMessage.includes('not configured')) {
        Alert.alert(
          'Razorpay Not Configured',
          errorMessage + '\n\nPlease check the setup instructions in RAZORPAY_SETUP.md',
          [
            { text: 'OK', style: 'default' },
            { 
              text: 'Use COD Instead', 
              onPress: () => {
                setPaymentMethod('cod');
                // Retry with COD
                setTimeout(() => handlePlaceOrder(), 100);
              },
              style: 'default'
            }
          ]
        );
      } else if (errorMessage.includes('cancelled') || errorMessage.includes('cancel')) {
        Toast.show({
          type: 'info',
          text1: 'Payment Cancelled',
          text2: 'You can try again or select a different payment method.',
        });
      } else {
        Alert.alert(
          'Payment Failed', 
          errorMessage,
          [
            { text: 'OK', style: 'default' },
            { 
              text: 'Try COD', 
              onPress: () => {
                setPaymentMethod('cod');
                // Retry with COD
                setTimeout(() => handlePlaceOrder(), 100);
              },
              style: 'default'
            }
          ]
        );
      }
      
      throw error;
    }
  };

  const processRegularOrder = async (itemsToProcess: any[]) => {
    if (!defaultAddress) {
      Alert.alert('Address Required', 'Please add a delivery address to continue.');
      throw new Error('Address required');
    }

    const resellerItemsForValidation = itemsToProcess.filter(item => item.isReseller);
    if (resellerItemsForValidation.length > 0) {
      for (const item of resellerItemsForValidation) {
        const { rsp } = getItemPricing(item);
        const originalPrice = rsp * (item.quantity || 1);
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

    const orderData = await createOrder('pending', undefined, itemsToProcess);

    itemsToProcess.forEach(item => removeFromCart(item.id));

    setSuccessOrderNumber(orderData.order_number);
    setShowSuccessAnimation(true);
    await updateCoinBalanceAfterOrder();
    return orderData;
  };

  const handlePlaceOrder = async () => {
    try {
      if (!userData) {
        Alert.alert('Login Required', 'Please login to place your order.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Login', onPress: () => navigation.navigate('Login' as never) },
        ]);
        return;
      }

      if (!defaultAddress) {
        Alert.alert('Address Required', 'Please add/select a delivery address before placing the order.');
        return;
      }

      if (cartItems.length === 0) {
        Alert.alert('Cart Empty', 'Please add items to your cart.');
        return;
      }

      setPlacingOrder(true);

      const { outOfStockItems, inStockItems } = await checkStockAvailability();

      let draftOrderNumber: string | null = null;

      if (outOfStockItems.length > 0) {
        try {
          const draftOrder = await createDraftOrderForOutOfStock(outOfStockItems);
          if (draftOrder && 'order_number' in draftOrder && draftOrder.order_number) {
            draftOrderNumber = draftOrder.order_number as string;
          }
        } catch (error) {
          console.error('Error creating draft order:', error);
        }
      }

      if (inStockItems.length === 0) {
        if (draftOrderNumber) {
          setSuccessOrderNumber(draftOrderNumber);
          setShowSuccessAnimation(true);
        } else {
          Toast.show({
            type: 'success',
            text1: 'Order Placed',
            text2: 'We will process your order shortly.',
          });
        }
        return;
      }

      // Handle Razorpay payment
      if (paymentMethod === 'razorpay') {
        await processRazorpayOrder(inStockItems);
      } else {
        // Handle COD or other payment methods
        await processRegularOrder(inStockItems);
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      Alert.alert('Order Failed', error.message || 'Something went wrong. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleAddressSelection = useCallback(() => {
    (navigation as any).navigate('AddressBook', { selectMode: true });
  }, [navigation]);

  const updateCoinBalanceAfterOrder = useCallback(async () => {
    if (!userData?.id || coinsToRedeem <= 0) {
      return;
    }
    try {
      const updatedBalance = Math.max(0, (userData.coin_balance || 0) - coinsToRedeem);
      await supabase
        .from('users')
        .update({ coin_balance: updatedBalance })
        .eq('id', userData.id);
      if (setUserData) {
        setUserData({ ...userData, coin_balance: updatedBalance });
      }
    } catch (error) {
      console.error('Failed to deduct coins after order:', error);
    } finally {
      setCoinDiscountAmount(0);
      setCoinsToRedeem(0);
    }
  }, [coinsToRedeem, userData, setUserData]);

  const renderAddressSummary = () => {
    const name = defaultAddress?.full_name || defaultAddress?.name || userData?.name || 'Customer';
    const previewParts: string[] = [];

    if (defaultAddress) {
      const line1 = defaultAddress.street_line1 || defaultAddress.address_line1 || '';
      const locality = defaultAddress.city || defaultAddress.state || '';
      if (line1) previewParts.push(line1);
      if (locality) previewParts.push(locality);
    }

    const previewText = previewParts.length > 0
      ? previewParts.join(', ')
      : 'Add an address to continue';

    return (
      <TouchableOpacity
        style={styles.addressSummaryCard}
        onPress={handleAddressSelection}
        activeOpacity={0.85}
      >
        <View style={styles.addressSummaryHeader}>
          <View style={styles.addressSummaryTitleBlock}>
            <Text style={styles.addressSummaryLabel}>Delivering to</Text>
            <View style={styles.addressSummaryRow}>
              <Text style={styles.addressSummaryName} numberOfLines={1}>
                {name}
              </Text>
              <View style={styles.addressSummaryChip}>
                <Ionicons name="swap-horizontal" size={12} color="#F53F7A" />
                <Text style={styles.addressSummaryChipText}>
                  {defaultAddress ? 'Change' : 'Add'}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.addressSummaryPreview,
                !defaultAddress && { color: '#9CA3AF' },
              ]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {previewText}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const fetchDefaultAddress = useCallback(async () => {
    if (!userData?.id) return;
    try {
      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', userData.id)
        .eq('is_default', true)
        .single();

      if (!error && data) {
        setDefaultAddress(data);
      }
    } catch (error) {
      console.error('Failed to fetch default address:', error);
    }
  }, [userData?.id]);

  useEffect(() => {
    fetchDefaultAddress();
  }, [fetchDefaultAddress]);

  useFocusEffect(
    useCallback(() => {
      fetchDefaultAddress();
    }, [fetchDefaultAddress])
  );

  // Fetch available coupons for the user
  useEffect(() => {
    const fetchAvailableCoupons = async () => {
      if (!userData?.id) {
        setAvailableCoupons([]);
        setReferralRewardSummary(null);
        return;
      }

      setLoadingCoupons(true);
      try {
        const { data: couponsData, error } = await supabase
          .from('coupons')
          .select('*')
          .eq('created_by', userData.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          throw error;
        }

        let filteredCoupons = (couponsData || []).filter(coupon => {
          const description = coupon.description?.toLowerCase() || '';
          if (
            coupon.created_by === userData.id &&
            !coupon.code?.startsWith('NEWUSER') &&
            !coupon.code?.startsWith('REF') &&
            !coupon.code?.startsWith('REFREWARD') &&
            description.includes('referral invite')
          ) {
            return false;
          }
          return true;
        });

        const newUserCoupon = filteredCoupons.find(c => c.code?.startsWith('NEWUSER'));
        const referrerRewardCoupon = filteredCoupons.find(
          c => c.code?.startsWith('REF') && !c.code?.startsWith('REFREWARD')
        );
        const referralRewardCoupon = filteredCoupons.find(c => c.code?.startsWith('REFREWARD'));

        let referralRewardSummaryData: typeof referralRewardSummary = null;
        if (referralRewardCoupon) {
          const metadata = parseReferralRewardMetadata(referralRewardCoupon.description);
          if (metadata && metadata.referralCount > 0 && metadata.maxDiscount > 0) {
            referralRewardSummaryData = {
              couponId: referralRewardCoupon.id,
              couponCode: referralRewardCoupon.code,
              referralCount: metadata.referralCount,
              maxDiscount: metadata.maxDiscount,
            };
            // Remove referral reward coupon from general list; it will be shown as a dedicated card
            filteredCoupons = filteredCoupons.filter(c => c.id !== referralRewardCoupon.id);
          }
        }
        setReferralRewardSummary(referralRewardSummaryData);

        const priorityCoupon = newUserCoupon || referrerRewardCoupon;
        if (priorityCoupon) {
          filteredCoupons = [
            priorityCoupon,
            ...filteredCoupons.filter(c => c.id !== priorityCoupon.id),
          ];
        }

        const usableCoupons: any[] = [];
        const currentSubtotal = cartItems.reduce((sum, item) => {
          if (item.isReseller && item.resellerPrice) return sum + item.resellerPrice;
          const { rsp } = getItemPricing(item);
          return sum + rsp * (item.quantity || 1);
        }, 0);

        for (const coupon of filteredCoupons) {
          const isNewUserCoupon = coupon.code?.startsWith('NEWUSER');
          const isReferrerRewardCoupon =
            coupon.code?.startsWith('REF') && !coupon.code?.startsWith('REFREWARD');
          const isReferralRewardCoupon = coupon.code?.startsWith('REFREWARD');
          const isReferralCoupon = isNewUserCoupon || isReferrerRewardCoupon || isReferralRewardCoupon;

          if (isNewUserCoupon) {
            usableCoupons.push(coupon);
            continue;
          }

          if (coupon.start_date && new Date(coupon.start_date) > new Date()) {
            if (!isReferralCoupon) continue;
          }

          if (coupon.end_date && new Date(coupon.end_date) < new Date()) {
            if (!isReferralCoupon) continue;
          }

          if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
            if (!isReferralCoupon) continue;
          }

          if (coupon.per_user_limit && userData.id) {
            const { data: userUsage } = await supabase
              .from('coupon_usage')
              .select('id')
              .eq('coupon_id', coupon.id)
              .eq('user_id', userData.id);

            if (userUsage && userUsage.length >= coupon.per_user_limit) {
              if (!isReferralCoupon) continue;
            }
          }

          if (coupon.min_order_value && currentSubtotal > 0 && currentSubtotal < coupon.min_order_value) {
            if (!isReferralCoupon) continue;
          }

          usableCoupons.push(coupon);
        }

        setAvailableCoupons(usableCoupons);
        console.log('[Cart] Available coupons loaded:', usableCoupons.length, usableCoupons.map(c => ({ code: c.code, description: c.description })));
      } catch (error) {
        console.error('[Cart] Error in fetchAvailableCoupons:', error);
        setAvailableCoupons([]);
        setReferralRewardSummary(null);
      } finally {
        setLoadingCoupons(false);
      }
    };

    fetchAvailableCoupons();
  }, [userData?.id, cartItems.length]);

  // Auto-apply the newest referral coupon for first-time users
  useEffect(() => {
    const autoApplyReferralCoupon = async () => {
      if (!userData?.id || couponAppliedCode || cartItems.length === 0) {
        return;
      }

      try {
        const { data: newUserCoupon, error } = await supabase
          .from('coupons')
          .select('id, code')
          .eq('created_by', userData.id)
          .eq('is_active', true)
          .like('code', 'NEWUSER%')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (newUserCoupon?.code) {
          const { data: usage } = await supabase
            .from('coupon_usage')
            .select('id')
            .eq('coupon_id', newUserCoupon.id)
            .eq('user_id', userData.id);

          if (!usage || usage.length === 0) {
            const applied = await tryApplyCouponForCode(newUserCoupon.code, true);
            if (applied) {
              console.log('[Cart] Auto-applied new user coupon:', newUserCoupon.code);
            }
          }
        }
      } catch (error) {
        console.error('[Cart] Error auto-applying referral coupon:', error);
      }
    };

    autoApplyReferralCoupon();
  }, [userData?.id, cartItems.length, couponAppliedCode]);

  // Helper function to apply coupon from code (shared by manual entry and auto-load)
  const tryApplyCouponForCode = async (code: string, silentMode = false): Promise<boolean> => {
    const codeToApply = code.trim().toUpperCase();
    if (!codeToApply) {
      if (!silentMode) {
        Toast.show({
          type: 'error',
          text1: 'Enter Coupon Code',
          text2: 'Please enter a coupon code',
        });
      }
      return false;
    }

    try {
      console.log('[Cart] Attempting to apply coupon:', codeToApply, 'Silent:', silentMode);
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', codeToApply)
        .eq('is_active', true)
        .single();

      if (error || !coupon) {
        if (silentMode) {
          console.warn('[Cart] Pending referral coupon not found or invalid:', codeToApply, error);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Invalid Coupon',
            text2: 'This coupon code is not valid',
          });
        }
        return false;
      }
      
      console.log('[Cart] Found coupon:', coupon.code, 'Discount:', coupon.discount_type, coupon.discount_value);

      const now = new Date();
      if (coupon.start_date && new Date(coupon.start_date) > now) {
        if (silentMode) {
          console.warn('[Cart] Pending referral coupon not yet active:', codeToApply, 'Start date:', coupon.start_date);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Coupon Not Active',
            text2: 'This coupon is not yet active',
          });
        }
        return false;
      }

      if (coupon.end_date && new Date(coupon.end_date) < now) {
        if (silentMode) {
          console.warn('[Cart] Pending referral coupon expired:', codeToApply, 'End date:', coupon.end_date);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Coupon Expired',
            text2: 'This coupon has expired',
          });
        }
        return false;
      }

      // Calculate current subtotal for validation
      const currentSubtotal = cartItems.reduce((sum, item) => {
        if (item.isReseller && item.resellerPrice) return sum + item.resellerPrice;
        const { rsp } = getItemPricing(item);
        return sum + (rsp * (item.quantity || 1));
      }, 0);

      if (coupon.min_order_value && currentSubtotal < coupon.min_order_value) {
        if (silentMode) {
          console.warn('[Cart] Minimum order value not met for pending referral coupon. Required:', coupon.min_order_value, 'Current:', currentSubtotal);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Minimum Order Not Met',
            text2: `Minimum order value is ₹${coupon.min_order_value}`,
          });
        }
        return false; // Return false so it doesn't get removed from storage
      }

      if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
        if (silentMode) {
          console.warn('[Cart] Pending referral coupon usage limit reached. Uses:', coupon.uses_count, 'Max:', coupon.max_uses);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Coupon Limit Reached',
            text2: 'This coupon has reached its usage limit',
          });
        }
        return false;
      }

      if (coupon.per_user_limit && userData?.id) {
        const { data: userUsage, error: usageError } = await supabase
          .from('coupon_usage')
          .select('id')
          .eq('coupon_id', coupon.id)
          .eq('user_id', userData.id);

        if (!usageError && userUsage && userUsage.length >= coupon.per_user_limit) {
          if (silentMode) {
            console.warn('[Cart] User usage limit reached for pending referral coupon. User uses:', userUsage.length, 'Limit:', coupon.per_user_limit);
          } else {
            Toast.show({
              type: 'error',
              text1: 'Usage Limit Reached',
              text2: `You can only use this coupon ${coupon.per_user_limit} time(s)`,
            });
          }
          return false;
        }
      }

      // Calculate current subtotal for discount calculation
      const currentSubtotalForDiscount = cartItems.reduce((sum, item) => {
        if (item.isReseller && item.resellerPrice) return sum + item.resellerPrice;
        const { rsp } = getItemPricing(item);
        return sum + (rsp * (item.quantity || 1));
      }, 0);

      let discount = 0;
      let couponDescription = '';

      if (coupon.discount_type === 'percentage') {
        discount = Math.round((currentSubtotalForDiscount * coupon.discount_value) / 100);
        couponDescription = `${coupon.discount_value}% off`;
        
        // Apply max discount cap for referral reward coupon (10% capped at referral_count * 100)
        if (coupon.code?.startsWith('REFREWARD')) {
          let maxDiscount = null;
          
          // Try to get max_discount_value from column (if it exists)
          if (coupon.max_discount_value) {
            maxDiscount = coupon.max_discount_value;
          } else {
            // Fallback: Extract from description metadata format: "REFERRALS:x:MAX:y"
            const descriptionMatch = coupon.description?.match(/MAX:(\d+)/);
            if (descriptionMatch) {
              maxDiscount = parseInt(descriptionMatch[1], 10);
            }
          }
          
          if (maxDiscount) {
            discount = Math.min(discount, maxDiscount);
            console.log('[Cart] Referral reward coupon discount capped:', {
              calculated: Math.round((currentSubtotalForDiscount * coupon.discount_value) / 100),
              capped: discount,
              maxDiscount: maxDiscount,
              cartValue: currentSubtotalForDiscount,
            });
          }
        }
      } else if (coupon.discount_type === 'fixed') {
        discount = Math.min(coupon.discount_value, currentSubtotalForDiscount);
        couponDescription = `Flat ₹${coupon.discount_value} off`;
      }

      discount = Math.min(discount, currentSubtotalForDiscount);

      setCouponAppliedCode(codeToApply);
      setCouponDiscountAmount(discount);
      setCouponCode('');

      const successMessage = silentMode ? 'Referral Coupon Applied! 🎉' : 'Coupon Applied! 🎉';
      Toast.show({
        type: 'success',
        text1: successMessage,
        text2: `${coupon.description || couponDescription} - You saved ₹${discount}`,
      });
      
      console.log('[Cart] Coupon successfully applied:', codeToApply, 'Discount:', discount);
      return true;
    } catch (error) {
      console.error('[Cart] Error applying coupon:', error);
      if (!silentMode) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to apply coupon. Please try again.',
        });
      }
      return false;
    }
  };

  const tryApplyCoupon = async () => {
    await tryApplyCouponForCode(couponCode, false);
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

  const handleApplyReferralReward = useCallback(() => {
    if (!referralRewardSummary) return;
    setCouponCode(referralRewardSummary.couponCode);
    tryApplyCouponForCode(referralRewardSummary.couponCode, false);
  }, [referralRewardSummary, tryApplyCouponForCode]);

  const handleContinueShopping = () => {
    navigation.navigate('Home' as never);
  };

  const handleResellerToggle = (item: any) => {
    if (item.isReseller) {
      // If already reselling, turn it off
      toggleReseller(item.id, false);
    } else {
      // Open modal to set price
      setSelectedItemForResell(item);
      setResellerPriceInput((item.price * item.quantity).toString());
      setShowResellerModal(true);
    }
  };

  const handleConfirmResellerPrice = () => {
    if (!selectedItemForResell) return;
    
    const price = parseFloat(resellerPriceInput);
    const originalPrice = selectedItemForResell.price * selectedItemForResell.quantity;
    
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }
    
    if (price <= originalPrice) {
      Alert.alert(
        'Invalid Price', 
        `Reseller price must be higher than ₹${originalPrice.toFixed(2)}`
      );
      return;
    }
    
    toggleReseller(selectedItemForResell.id, true);
    updateResellerPrice(selectedItemForResell.id, price);
    setShowResellerModal(false);
    setSelectedItemForResell(null);
    setResellerPriceInput('');
  };

  const handleCancelResellerModal = () => {
    setShowResellerModal(false);
    setSelectedItemForResell(null);
    setResellerPriceInput('');
  };

  const handleRemoveItem = (id: string) => {
    const item = cartItems.find(i => i.id === id);
    setItemToRemove(item || null);
    setShowRemoveModal(true);
  };

  const handleUpdateQuantity = async (id: string, newQuantity: number, currentItem: any) => {
    // If increasing quantity, show size selection modal
    if (newQuantity > currentItem.quantity) {
      // Fetch available sizes for this product from product_variants
      try {
        const { supabase } = await import('~/utils/supabase');
        
        // Get the product name to find matching product_variants
        const productName = currentItem.name;
        
        console.log('Fetching sizes for product:', productName);
        
        // Query by product name to get all available sizes
        // This is more reliable than using product_id since cart items may have generated IDs
        const { data: allVariants, error: nameError } = await supabase
          .from('product_variants')
          .select(`
            id,
            quantity,
            size_id,
            product_id,
            sizes (
              id,
              name
            ),
            products!inner (
              id,
              name
            )
          `)
          .eq('products.name', productName)
          .gt('quantity', 0);

        if (nameError || !allVariants || allVariants.length === 0) {
          console.error('Error fetching by product name:', nameError);
          // Fallback to just updating quantity
    updateQuantity(id, newQuantity);
          return;
        }

        console.log('Found variants:', allVariants.length);

        // Extract unique sizes
        const sizes = allVariants
          .filter((v: any) => v.sizes)
          .map((v: any) => v.sizes.name)
          .filter((size: string, index: number, self: string[]) => self.indexOf(size) === index) || [];

        console.log('Available sizes:', sizes);

        if (sizes.length > 0) {
          setAvailableSizes(sizes);
          setSelectedItemForSize({ ...currentItem, newQuantity });
          setSelectedNewSize('');
          setShowSizeModal(true);
        } else {
          console.log('No sizes available, just updating quantity');
          updateQuantity(id, newQuantity);
        }
      } catch (error) {
        console.error('Error:', error);
        updateQuantity(id, newQuantity);
      }
    } else {
      // Decreasing quantity, just update
      updateQuantity(id, newQuantity);
    }
  };

  const handleConfirmSizeSelection = () => {
    if (!selectedNewSize) {
      Alert.alert('Size Required', 'Please select a size for the additional item');
      return;
    }

    if (!selectedItemForSize) return;

    // Add a new cart item with the selected size
    const { id: _ignoreId, ...rest } = selectedItemForSize;
    addToCart({
      ...rest,
      size: selectedNewSize,
      quantity: 1, // Add 1 item with new size
    });

    // Close modal
    setShowSizeModal(false);
    setSelectedItemForSize(null);
    setSelectedNewSize('');
    setAvailableSizes([]);

    Alert.alert('Added', `Added 1 more item with size ${selectedNewSize}`);
  };

  // Cache variant pricing fetched from DB by SKU
  const [variantPricingBySku, setVariantPricingBySku] = useState<{ [sku: string]: { mrp: number; rsp: number; discountPct: number } } >({});

  // Helper: derive MRP/RSP/discount from cart item (prefer variant fields)
  const getItemPricing = (item: any) => {
    const cached = item?.sku ? variantPricingBySku[item.sku] : undefined;
    if (cached) return cached;

    // Try direct fields on the cart item
    let mrp = (typeof item.mrp_price === 'number' && item.mrp_price > 0) ? item.mrp_price : 0;
    let rsp = (typeof item.rsp_price === 'number' && item.rsp_price > 0) ? item.rsp_price : 0;
    let discountPct = (typeof item.discount_percentage === 'number' && item.discount_percentage > 0) ? item.discount_percentage : 0;

    // Try attached selected variant
    const selectedVariant = item.variant
      || (Array.isArray(item.variants) && (item.variants.find((v: any) => v?.size?.name === item.size) || item.variants[0]))
      || (Array.isArray(item.product_variants) && (item.product_variants.find((v: any) => v?.size?.name === item.size) || item.product_variants[0]))
      || null;

    if (!mrp && selectedVariant?.mrp_price) mrp = selectedVariant.mrp_price;
    if (!rsp) {
      if (selectedVariant?.rsp_price) rsp = selectedVariant.rsp_price;
      else if (selectedVariant?.price) rsp = selectedVariant.price;
      else if (typeof item.price === 'number') rsp = item.price;
    }
    if (!discountPct) {
      if (selectedVariant?.discount_percentage) discountPct = selectedVariant.discount_percentage;
      else if (mrp > rsp && mrp > 0) discountPct = Math.round(((mrp - rsp) / mrp) * 100);
    }

    return { mrp, rsp, discountPct };
  };

  // Enrich missing pricing from product_variants by SKU (single batched query)
  useEffect(() => {
    const loadMissingVariantPricing = async () => {
      try {
        const missingSkus = Array.from(new Set(
          cartItems
            .map((i: any) => i.sku)
            .filter((sku: any) => typeof sku === 'string' && sku.length > 0 && !variantPricingBySku[sku])
        ));
        if (missingSkus.length === 0) return;

        const { supabase } = await import('~/utils/supabase');
        const { data, error } = await supabase
          .from('product_variants')
          .select('sku, mrp_price, rsp_price, discount_percentage')
          .in('sku', missingSkus);
        if (error) {
          console.error('Error loading variant pricing:', error);
          return;
        }
        const map: { [sku: string]: { mrp: number; rsp: number; discountPct: number } } = {};
        (data || []).forEach((row: any) => {
          const mrp = Number(row.mrp_price) || 0;
          const rsp = Number(row.rsp_price) || 0;
          const discountPct = typeof row.discount_percentage === 'number' && row.discount_percentage > 0
            ? row.discount_percentage
            : (mrp > rsp && mrp > 0 ? Math.round(((mrp - rsp) / mrp) * 100) : 0);
          map[row.sku] = { mrp, rsp, discountPct };
        });
        if (Object.keys(map).length > 0) {
          setVariantPricingBySku(prev => ({ ...prev, ...map }));
        }
      } catch (e) {
        console.error('Exception loading variant pricing', e);
      }
    };
    loadMissingVariantPricing();
  }, [cartItems]);

  // Calculate totals based on variant RSP/MRP
  const subtotalMrp = cartItems.reduce((sum, item) => {
    const { mrp } = getItemPricing(item);
    return sum + (mrp * (item.quantity || 1));
  }, 0);

  const subtotalRspBase = cartItems.reduce((sum, item) => {
    const { rsp } = getItemPricing(item);
    return sum + (rsp * (item.quantity || 1));
  }, 0);

  // Include reseller override if set
  const subtotalWithReseller = cartItems.reduce((sum, item) => {
    if (item.isReseller && item.resellerPrice) return sum + item.resellerPrice;
    const { rsp } = getItemPricing(item);
    return sum + (rsp * (item.quantity || 1));
  }, 0);

  const totalResellerProfit = cartItems.reduce((sum, item) => {
    if (item.isReseller && item.resellerPrice) {
      const { rsp } = getItemPricing(item);
      const originalPrice = rsp * (item.quantity || 1);
      return sum + (item.resellerPrice - originalPrice);
    }
    return sum;
  }, 0);
  
  const resellerItemsCount = cartItems.filter(item => item.isReseller).length;

  const subtotal = subtotalWithReseller;
  const savings = Math.max(0, subtotalMrp - subtotalRspBase);
  const deliveryCharge = subtotal > 500 ? 0 : 40;
  const userCoinBalance = userData?.coin_balance || 0;
  const totalSavingsFromIncentives = couponDiscountAmount + coinDiscountAmount;
  const referralRewardPotentialDiscount = useMemo(() => {
    if (!referralRewardSummary) return 0;
    if (cartItems.length === 0 || subtotal <= 0) return 0;
    const tenPercent = Math.floor(subtotal * 0.10);
    if (tenPercent <= 0) return 0;
    return Math.min(tenPercent, referralRewardSummary.maxDiscount || tenPercent);
  }, [referralRewardSummary, subtotal, cartItems.length]);
  const isReferralRewardApplied = referralRewardSummary
    ? couponAppliedCode === referralRewardSummary.couponCode
    : false;
  const payableSubtotal = Math.max(0, subtotal - totalSavingsFromIncentives);
  const finalTotal = payableSubtotal + deliveryCharge;
  const coinsEarned = Math.round(subtotalRspBase * 0.10);
  const combinedSavings = Math.max(0, savings + totalSavingsFromIncentives);
  const eligibleCoinDiscount = useMemo(() => {
    if (cartItems.length === 0 || subtotal <= 0 || userCoinBalance <= 0) return 0;
    const unlockedBrackets = Math.floor(subtotal / 1000);
    if (unlockedBrackets <= 0) return 0;
    return Math.min(unlockedBrackets * 100, userCoinBalance);
  }, [cartItems.length, subtotal, userCoinBalance]);

  useEffect(() => {
    if (cartItems.length === 0 || eligibleCoinDiscount === 0) {
      if (coinDiscountAmount !== 0) {
        setCoinDiscountAmount(0);
        setCoinsToRedeem(0);
      }
      return;
    }

    if (coinDiscountAmount > eligibleCoinDiscount) {
      setCoinDiscountAmount(eligibleCoinDiscount);
      setCoinsToRedeem(eligibleCoinDiscount);
    }
  }, [cartItems.length, eligibleCoinDiscount, coinDiscountAmount]);

  useEffect(() => {
    if (showCoinCelebration) {
      coinBadgeScale.setValue(0.4);
      coinBadgeGlow.setValue(0);

      const confettiAnimations = coinConfettiAnims.map((anim, index) => {
        const meta = coinConfettiMeta[index];
        const travelY = SCREEN_HEIGHT * 0.7 + Math.random() * 80;
        const rotateTo = 360 + Math.random() * 360;

        anim.translateY.setValue(-SCREEN_HEIGHT * 0.4);
        anim.translateX.setValue(0);
        anim.rotate.setValue(0);
        anim.opacity.setValue(0);

        return Animated.parallel([
          Animated.timing(anim.translateY, {
            toValue: travelY,
            duration: 1600,
            delay: meta.delay,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateX, {
            toValue: meta.direction * meta.spread,
            duration: 1600,
            delay: meta.delay,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: 120,
              delay: meta.delay,
              useNativeDriver: true,
            }),
            Animated.timing(anim.opacity, {
              toValue: 0,
              duration: 400,
              delay: meta.delay + 1100,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim.rotate, {
            toValue: rotateTo,
            duration: 1600,
            delay: meta.delay,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]);
      });

      const starAnimations = coinStarAnims.map((anim, index) => {
        const meta = coinStarMeta[index];
        anim.scale.setValue(0);
        anim.opacity.setValue(0);
        anim.rotate.setValue(0);
        anim.translateX.setValue(0);
        anim.translateY.setValue(0);

        return Animated.sequence([
          Animated.delay(meta.delay),
          Animated.parallel([
            Animated.timing(anim.scale, {
              toValue: 1,
              duration: 200,
              easing: Easing.out(Easing.back(2)),
              useNativeDriver: true,
            }),
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(anim.translateX, {
              toValue: meta.targetX,
              duration: 260,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(anim.translateY, {
              toValue: meta.targetY,
              duration: 260,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(anim.scale, {
              toValue: 0,
              duration: 250,
              delay: 120,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(anim.opacity, {
              toValue: 0,
              duration: 200,
              delay: 120,
              useNativeDriver: true,
            }),
            Animated.timing(anim.translateX, {
              toValue: meta.targetX * 1.25,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(anim.translateY, {
              toValue: meta.targetY * 1.25,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(anim.rotate, {
              toValue: 360,
              duration: 350,
              useNativeDriver: true,
            }),
          ]),
        ]);
      });

      const badgeAnimation = Animated.parallel([
        Animated.spring(coinBadgeScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 5,
          tension: 160,
        }),
        Animated.sequence([
          Animated.timing(coinBadgeGlow, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(coinBadgeGlow, {
            toValue: 0,
            duration: 200,
            delay: 200,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]);

      Animated.parallel([
        ...confettiAnimations,
        ...starAnimations,
        badgeAnimation,
      ]).start(() => {
        setTimeout(() => setShowCoinCelebration(false), 300);
      });
    }
  }, [
    showCoinCelebration,
    coinConfettiAnims,
    coinConfettiMeta,
    coinStarAnims,
    coinStarMeta,
    coinBadgeScale,
    coinBadgeGlow,
  ]);

  useEffect(() => {
    return () => {};
  }, []);

  const handleApplyCoinDiscount = useCallback(() => {
    if (eligibleCoinDiscount <= 0) {
      return;
    }
    setCoinDiscountAmount(eligibleCoinDiscount);
    setCoinsToRedeem(eligibleCoinDiscount);
    setShowCoinCelebration(true);
    Toast.show({
      type: 'success',
      text1: 'Coins Applied 🎉',
      text2: `₹${eligibleCoinDiscount} discount added to this order.`,
    });
  }, [eligibleCoinDiscount]);

  const handleSelectPaymentOption = useCallback((option: PaymentOption) => {
    if (!option.available) {
      Toast.show({
        type: 'info',
        text1: 'Coming soon',
        text2: `${option.title} will be available shortly.`,
      });
      return;
    }
    setPaymentMethod(option.key);
    setShowPaymentModal(false);
  }, []);

  const handleRemoveCoinDiscount = useCallback(() => {
    setCoinDiscountAmount(0);
    setCoinsToRedeem(0);
    Toast.show({
      type: 'info',
      text1: 'Coin Discount Removed',
      text2: 'You can re-apply your coins anytime before checkout.',
    });
  }, []);

  const renderCartItem = (item: any) => {
    const { mrp, rsp, discountPct } = getItemPricing(item);
    const qty = item.quantity || 1;
    const totalMrp = mrp * qty;
    const totalRspBase = rsp * qty;
    const lineTotal = (item.isReseller && item.resellerPrice) ? item.resellerPrice : totalRspBase;
    const displayLineTotal = totalRspBase;
    const resellerProfitAmount = Math.max(0, lineTotal - totalRspBase);
    const saveAmount = Math.max(0, totalMrp - totalRspBase);
    // Transform cart item to product format for navigation
    const productForDetails = {
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      image_urls: item.image_urls || (item.image ? [item.image] : []),
      video_urls: item.video_urls || [],
      description: item.description || '',
      stock: item.stock?.toString() || '0',
      featured: item.featured || false,
      sku: item.sku || item.id,
      category: item.category || '',
      vendor_name: item.vendor_name || '',
      alias_vendor: item.alias_vendor || '',
      return_policy: item.return_policy || '',
      variants: item.variants || [],
    };

    return (
    <View key={item.id} style={styles.cartItem}>
        <View style={styles.cartItemContent}>
      <TouchableOpacity
        onPress={() => {
          (navigation as any).navigate('ProductDetails', {
            productId: item.sku || item.id,
            product: productForDetails
          });
        }}
        activeOpacity={0.9}
        style={styles.itemImageContainer}
      >
        <Image source={{ uri: item.image }} style={styles.itemImage} />
        {item.quantity > 1 && (
          <View style={styles.quantityBadge}>
            <Text style={styles.quantityBadgeText}>{item.quantity}</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.itemDetails}>
        <View style={styles.itemHeader}>
          <View style={styles.itemNameContainer}>
            <View style={styles.itemNameRow}>
              <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
              {discountPct > 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>{discountPct}% OFF</Text>
                </View>
              )}
            </View>
            <View style={styles.itemAttributes}>
              {item.size && (
                <View style={styles.attributeChip}>
                  <Text style={styles.attributeText}>Size: {item.size}</Text>
                </View>
              )}
              {item.color && (
                <View style={styles.attributeChip}>
                  <Text style={styles.attributeText}>{item.color}</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => handleRemoveItem(item.id)} 
            style={styles.removeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={22} color="#F53F7A" />
          </TouchableOpacity>
        </View>

        <View style={styles.itemFooter}>
          <View style={styles.priceContainer}>
            {mrp > rsp && (
              <Text style={styles.itemMrpStriked}>₹{totalMrp.toFixed(2)}</Text>
            )}
            <Text style={styles.itemPrice}>₹{displayLineTotal.toFixed(2)}</Text>
            {saveAmount > 0 && (
              <Text style={styles.itemSavingsText}>You save ₹{saveAmount.toFixed(0)} ({discountPct}% OFF)</Text>
            )}
          </View>

          <View style={styles.quantityContainer}>
            <TouchableOpacity 
              onPress={() => handleUpdateQuantity(item.id, Math.max(1, item.quantity - 1), item)}
              disabled={item.quantity <= 1}
              style={[styles.quantityButton, item.quantity <= 1 && styles.quantityButtonDisabled]}
            >
              <Ionicons name="remove" size={18} color={item.quantity <= 1 ? "#D1D5DB" : "#F53F7A"} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity 
              onPress={() => handleUpdateQuantity(item.id, Math.min(item.stock || 10, item.quantity + 1), item)}
              disabled={item.quantity >= (item.stock || 10)}
              style={[styles.quantityButton, item.quantity >= (item.stock || 10) && styles.quantityButtonDisabled]}
            >
              <Ionicons name="add" size={18} color={item.quantity >= (item.stock || 10) ? "#D1D5DB" : "#F53F7A"} />
            </TouchableOpacity>
          </View>
        </View>

        {item.stock && item.stock <= 5 && (
          <View style={styles.stockWarning}>
            <Ionicons name="alert-circle" size={14} color="#F59E0B" />
            <Text style={styles.stockWarningText}>Only {item.stock} left in stock</Text>
          </View>
        )}

        {/* Reseller Section - Only show checkbox if NOT yet set */}
        {!item.isReseller && (
          <View style={styles.resellerSection}>
            <TouchableOpacity 
              style={styles.resellerCheckbox}
              onPress={() => handleResellerToggle(item)}
              activeOpacity={0.7}>
              <View style={[styles.checkbox, item.isReseller && styles.checkboxActive]}>
                {item.isReseller && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
              <Ionicons name="trending-up" size={16} color="#10B981" style={{ marginLeft: 8 }} />
              <Text style={styles.resellerLabel}>Reselling this item</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>

    {/* Earnings Badge - Full Width */}
    {item.isReseller && item.resellerPrice && (
      <View style={styles.earningsBadge}>
        <View style={styles.earningsHeader}>
          <View style={styles.earningsHeaderLeft}>
            <Ionicons name="cash-outline" size={16} color="#10B981" />
            <Text style={styles.earningsHeaderTitle}>Reseller Earnings</Text>
          </View>
          <View style={styles.earningsActions}>
            <TouchableOpacity 
              style={styles.earningsEditButton}
              onPress={() => {
                setSelectedItemForResell(item);
                setResellerPriceInput(item.resellerPrice.toString());
                setShowResellerModal(true);
              }}>
              <Ionicons name="create-outline" size={14} color="#10B981" />
              <Text style={styles.earningsEditText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.earningsDeleteButton}
              onPress={() => handleResellerToggle(item)}>
              <Ionicons name="trash-outline" size={14} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.earningsBody}>
          <View style={styles.earningsColumn}>
            <Text style={styles.earningsLabel}>Selling Price</Text>
            <Text style={styles.earningsValue}>₹{lineTotal.toFixed(2)}</Text>
          </View>
          <View style={styles.earningsColumnDivider} />
          <View style={styles.earningsColumn}>
            <Text style={styles.earningsLabel}>Your Profit</Text>
            <View style={styles.profitValueRow}>
              <Ionicons name="trending-up" size={14} color="#10B981" />
              <Text style={styles.earningsProfit}>
                +₹{resellerProfitAmount.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    )}
    </View>
  );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {showCoinCelebration && (
        <View pointerEvents="none" style={styles.coinConfettiOverlay}>
          {coinConfettiAnims.map((anim, index) => {
            const meta = coinConfettiMeta[index];
            return (
              <Animated.View
                key={`coin-confetti-${index}`}
                style={[
                  styles.coinConfettiPiece,
                  {
                    backgroundColor:
                      COIN_CONFETTI_COLORS[index % COIN_CONFETTI_COLORS.length],
                    left: meta.startX,
                    transform: [
                      { translateY: anim.translateY },
                      { translateX: anim.translateX },
                      {
                        rotate: anim.rotate.interpolate({
                          inputRange: [0, 360],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                    opacity: anim.opacity,
                  },
                ]}
              />
            );
          })}
          {coinStarAnims.map((anim, index) => (
            <Animated.View
              key={`coin-star-${index}`}
              style={[
                styles.coinStarPiece,
                {
                  transform: [
                    { translateX: anim.translateX },
                    { translateY: anim.translateY },
                    {
                      rotate: anim.rotate.interpolate({
                        inputRange: [0, 360],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                    {
                      scale: anim.scale.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.2, 1],
                      }),
                    },
                  ],
                  opacity: anim.opacity,
                },
              ]}
            />
          ))}
        </View>
      )}

      <OrderSuccessAnimation
        visible={showSuccessAnimation}
        orderNumber={successOrderNumber}
        coinsEarned={coinsEarned}
        onClose={() => setShowSuccessAnimation(false)}
        onViewOrders={() => {
          setShowSuccessAnimation(false);
          (navigation as any).navigate('TabNavigator', {
            screen: 'Home',
            params: { screen: 'MyOrders' },
          });
        }}
      />

      {cartItems.length === 0 ? (
        // Empty Cart
        <ScrollView 
          contentContainerStyle={styles.emptyCartContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.addressSummaryWrapper}>
            {renderAddressSummary()}
          </View>
          <View style={styles.emptyCartContent}>
            <View style={styles.emptyCartIcon}>
              <Ionicons name="cart-outline" size={80} color="#E5E7EB" />
            </View>
            <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
            <Text style={styles.emptyCartSubtitle}>
              Add items you love to your cart and they will appear here
            </Text>
            <TouchableOpacity 
              style={styles.startShoppingButton} 
              onPress={handleContinueShopping}
            >
              <Text style={styles.startShoppingButtonText}>Start Shopping</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

        </ScrollView>
      ) : (
        // Cart with Items
        <>
          <ScrollView 
            style={styles.contentScroll} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: 140 + footerBottomPadding },
            ]}
          >
            {/* Address Summary */}
            {renderAddressSummary()}

            {/* Delivery Info Banner */}
            <View style={styles.deliveryBanner}>
              <View style={styles.deliveryBannerIcon}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              </View>
              <View style={styles.deliveryBannerTextContainer}>
                <Text style={styles.deliveryBannerText}>
                  {deliveryCharge === 0 ? (
                    <Text>
                      Yay! You get <Text style={styles.deliveryBannerHighlight}>FREE delivery</Text> on this order
                    </Text>
                  ) : (
                    <Text>
                      Add items worth ₹{Math.max(0, 500 - subtotalRspBase)} more for <Text style={styles.deliveryBannerHighlight}>FREE delivery</Text>
                    </Text>
                  )}
                </Text>
              </View>
            </View>

            {/* Cart Items */}
            <View style={styles.cartItemsSection}>
              {cartItems.map(renderCartItem)}
            </View>

            {/* Apply Coupon */}
            <View style={styles.checkoutCard}>
              <View style={styles.checkoutCardHeader}>
                <View style={styles.checkoutCardHeaderLeft}>
                  <View style={styles.checkoutIconBadge}>
                    <Ionicons name="pricetag" size={18} color="#F53F7A" />
                  </View>
                  <View>
                    <Text style={styles.checkoutCardTitle}>Apply Coupon</Text>
                    <Text style={styles.checkoutCardSubtitle}>Save more on your order</Text>
                  </View>
                </View>
              </View>

              {couponAppliedCode ? (
                <View style={styles.appliedCouponBox}>
                  <View style={styles.appliedCouponContent}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <View>
                      <Text style={styles.appliedCouponCode}>{couponAppliedCode}</Text>
                      <Text style={styles.appliedCouponSavings}>You saved ₹{couponDiscountAmount}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={removeCoupon}>
                    <Text style={styles.removeCouponText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.couponInputRow}>
                    <Ionicons name="pricetag-outline" size={16} color="#9CA3AF" />
                    <TextInput
                      style={styles.couponInput}
                      placeholder="Enter coupon"
                      value={couponCode}
                      onChangeText={setCouponCode}
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="characters"
                      returnKeyType="done"
                      onSubmitEditing={tryApplyCoupon}
                    />
                    <TouchableOpacity style={styles.applyCouponButton} onPress={tryApplyCoupon}>
                      <Text style={styles.applyCouponButtonText}>Apply</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Referral Reward Summary */}
                  {referralRewardSummary && referralRewardSummary.referralCount > 0 && (
                    <View style={styles.referralRewardCard}>
                      <View style={styles.referralRewardHeader}>
                        <View style={styles.referralRewardIcon}>
                          <Ionicons name="sparkles" size={18} color="#F59E0B" />
                        </View>
                        <View style={styles.referralRewardHeaderText}>
                          <Text style={styles.referralRewardTitle}>Referral Rewards</Text>
                          <Text style={styles.referralRewardSubtitle}>
                            You referred {referralRewardSummary.referralCount}{' '}
                            {referralRewardSummary.referralCount === 1 ? 'friend' : 'friends'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.referralRewardStats}>
                        <View style={styles.referralRewardStatBlock}>
                          <Text style={styles.referralRewardStatLabel}>10% of cart</Text>
                          <Text style={styles.referralRewardStatValue}>
                            ₹{referralRewardPotentialDiscount || 0}
                          </Text>
                        </View>
                        <View style={styles.referralRewardDivider} />
                        <View style={styles.referralRewardStatBlock}>
                          <Text style={styles.referralRewardStatLabel}>Max redeem</Text>
                          <Text style={styles.referralRewardStatValue}>
                            ₹{referralRewardSummary.maxDiscount}
                          </Text>
                          <Text style={styles.referralRewardStatHint}>
                            100 per referral
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.referralRewardButton,
                          (isReferralRewardApplied || referralRewardPotentialDiscount === 0) &&
                            styles.referralRewardButtonDisabled,
                        ]}
                        onPress={handleApplyReferralReward}
                        disabled={isReferralRewardApplied || referralRewardPotentialDiscount === 0}
                        activeOpacity={0.9}
                      >
                        <Text style={styles.referralRewardButtonText}>
                          {isReferralRewardApplied
                            ? 'Applied'
                            : referralRewardPotentialDiscount > 0
                            ? `Apply & Save ₹${referralRewardPotentialDiscount}`
                            : 'Add items to unlock'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Available Coupons List */}
                  {userData?.id && availableCoupons.length > 0 && (
                    <View style={styles.availableCouponsContainer}>
                      {availableCoupons.slice(0, COUPONS_TO_SHOW).map((coupon) => (
                        <TouchableOpacity
                          key={coupon.id}
                          style={styles.couponCard}
                          onPress={() => {
                            setCouponCode(coupon.code);
                            setTimeout(() => tryApplyCouponForCode(coupon.code, false), 100);
                          }}
                        >
                          <View style={styles.couponCardContent}>
                            <View style={styles.couponCardIcon}>
                              <Ionicons name="ticket" size={18} color="#F53F7A" />
                            </View>
                            <View style={styles.couponCardText}>
                              <Text style={styles.couponCardCode}>{coupon.code}</Text>
                              <Text style={styles.couponCardDescription} numberOfLines={1}>
                                {getCouponDescriptionText(coupon.description) || 
                                  (coupon.discount_type === 'fixed'
                                    ? `Flat ₹${coupon.discount_value} off`
                                    : `${coupon.discount_value}% off`)}
                </Text>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                      ))}

                      {/* See More Button */}
                      {availableCoupons.length > COUPONS_TO_SHOW && (
                        <TouchableOpacity
                          style={styles.seeMoreCouponsButton}
                          onPress={() => {
                            try {
                              (navigation as any).navigate('Home', { screen: 'Coupons' });
                            } catch (e) {
                              console.error('Navigation error:', e);
                            }
                          }}
                        >
                          <Text style={styles.seeMoreCouponsText}>
                            See {availableCoupons.length - COUPONS_TO_SHOW} more coupons
                    </Text>
                          <Ionicons name="chevron-forward" size={16} color="#F53F7A" />
                        </TouchableOpacity>
                      )}
                  </View>
                  )}
                </>
              )}

          {(eligibleCoinDiscount > 0 || coinDiscountAmount > 0) && (
            <View
              style={[
                styles.couponCoinRow,
                coinDiscountAmount > 0 && styles.couponCoinRowActive,
              ]}
            >
              <View style={styles.couponCoinLeft}>
                <View style={styles.couponCoinIcon}>
                  <Ionicons
                    name="wallet"
                    size={16}
                    color={coinDiscountAmount > 0 ? '#047857' : '#92400E'}
                  />
                </View>
                <View style={styles.couponCoinTextBlock}>
                  <Text style={styles.couponCoinTitle} numberOfLines={1}>
                    {coinDiscountAmount > 0
                      ? `₹${coinDiscountAmount} coin discount applied`
                      : `Extra ₹${eligibleCoinDiscount} off with coins`}
                </Text>
                  <Text style={styles.couponCoinSubtitle} numberOfLines={1}>
                    {coinDiscountAmount > 0
                      ? `Remaining coins: ${Math.max(0, userCoinBalance - coinDiscountAmount)}`
                      : `${userCoinBalance} coins available`}
                    </Text>
              </View>
                </View>
              <TouchableOpacity
                style={[
                  styles.couponCoinButton,
                  coinDiscountAmount > 0 && styles.couponCoinButtonApplied,
                ]}
                onPress={
                  coinDiscountAmount > 0 ? handleRemoveCoinDiscount : handleApplyCoinDiscount
                }
                activeOpacity={0.85}
                disabled={eligibleCoinDiscount <= 0 && coinDiscountAmount === 0}
              >
                <Text
                  style={[
                    styles.couponCoinButtonText,
                    coinDiscountAmount > 0 && styles.couponCoinButtonTextApplied,
                  ]}
                >
                  {coinDiscountAmount > 0 ? 'Applied' : 'Apply'}
                </Text>
              </TouchableOpacity>
              </View>
          )}
            </View>

            {/* Price Details */}
            <View style={styles.checkoutCard}>
              <View style={styles.checkoutCardHeader}>
                <View style={styles.checkoutCardHeaderLeft}>
                  <View style={styles.checkoutIconBadge}>
                    <Ionicons name="receipt" size={18} color="#F53F7A" />
                  </View>
                  <View>
                    <Text style={styles.checkoutCardTitle}>Price Details</Text>
                    <Text style={styles.checkoutCardSubtitle}>Bill summary</Text>
                  </View>
                </View>
              </View>

              <View style={styles.priceRows}>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Price ({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})</Text>
                  <Text style={styles.priceValue}>₹{subtotal.toFixed(2)}</Text>
                </View>

                {couponDiscountAmount > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Coupon Discount</Text>
                    <Text style={styles.priceDiscount}>-₹{couponDiscountAmount.toFixed(2)}</Text>
                  </View>
                )}

                {coinDiscountAmount > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Coin Discount</Text>
                    <View style={styles.coinDiscountValue}>
                      <Text style={styles.priceDiscount}>-₹{coinDiscountAmount.toFixed(2)}</Text>
                      <TouchableOpacity onPress={handleRemoveCoinDiscount}>
                        <Text style={styles.removeCoinText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Delivery Charges</Text>
                  {deliveryCharge === 0 ? (
                    <View style={styles.freeTag}>
                      <Text style={styles.freeTagText}>FREE</Text>
                    </View>
                  ) : (
                    <Text style={styles.priceValue}>₹{deliveryCharge.toFixed(2)}</Text>
                  )}
                </View>

                <View style={styles.priceDivider} />

                {/* <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total Payable</Text>
                  <Text style={styles.totalValue}>₹{finalTotal.toFixed(2)}</Text>
                </View> */}

                <View style={styles.coinsRow}>
                  <Ionicons name="trophy" size={16} color="#FFB800" />
                  <Text style={styles.coinsText}>
                    You'll earn {coinsEarned} coins with this order
                  </Text>
                </View>

                {hasResellerItems && totalResellerProfit > 0 && (
                  <View style={styles.resellerMarginRow}>
                    <View style={styles.resellerMarginLabelContainer}>
                      <Ionicons name="trending-up" size={16} color="#10B981" />
                      <Text style={styles.resellerMarginLabel}>Your Reseller Profit</Text>
                    </View>
                    <Text style={styles.resellerMarginValue}>+₹{totalResellerProfit.toFixed(2)}</Text>
                  </View>
                )}
              </View>
              </View>
              
            {/* Compact Price Summary */}
            <View style={styles.compactPriceSummary}>
              <View style={styles.compactPriceRow}>
                <Text style={styles.compactTotalLabel}>Total Amount</Text>
                <Text style={styles.compactTotalValue}>₹{finalTotal.toFixed(2)}</Text>
              </View>

              {combinedSavings > 0 && (
                <View style={styles.savingsTagCompact}>
                  <Ionicons name="happy-outline" size={14} color="#10B981" />
                  <Text style={styles.savingsTextCompact}>
                    You will save ₹{combinedSavings.toFixed(0)} on this order
                  </Text>
                </View>
              )}
            </View>

            {/* Trust Badges */}
            <View style={styles.trustBadges}>
              <View style={styles.trustBadge}>
                <View style={styles.trustBadgeIcon}>
                  <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                </View>
                <Text style={styles.trustBadgeText}>100% Secure Payments</Text>
              </View>
              <View style={styles.trustBadge}>
                <View style={styles.trustBadgeIcon}>
                  <Ionicons name="sync" size={20} color="#3B82F6" />
                </View>
                <Text style={styles.trustBadgeText}>Easy Returns & Refunds</Text>
              </View>
              <View style={styles.trustBadge}>
                <View style={styles.trustBadgeIcon}>
                  <Ionicons name="star" size={20} color="#F59E0B" />
                </View>
                <Text style={styles.trustBadgeText}>Quality Guaranteed</Text>
              </View>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>

          {/* Sticky Checkout Footer */}
          <View style={[styles.checkoutFooter, { paddingBottom: footerBottomPadding }]}>
            <TouchableOpacity 
              style={styles.footerPriceInfo}
              onPress={() => setShowPriceBreakdown(true)}
              activeOpacity={0.7}
            >
              <View style={styles.totalPriceLabelRow}>
                <Text style={styles.footerPriceLabel}>Total Price</Text>
                <Ionicons name="chevron-down" size={16} color="#666" style={{ marginLeft: 4 }} />
            </View>
              <Text style={styles.footerPriceValue}>₹{finalTotal.toFixed(2)}</Text>
            </TouchableOpacity>
            
            <View style={styles.footerButtonsRow}>
            <TouchableOpacity 
                style={styles.paymentSelectButton}
                onPress={() => setShowPaymentModal(true)}
                activeOpacity={0.9}
              >
                <View style={styles.paymentSelectContent}>
                  <View style={styles.paymentSelectTexts}>
                    <Text style={styles.paymentSelectLabel}>Pay using</Text>
                    <Text style={styles.paymentSelectValue}>{activePayment.title}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.checkoutButton,
                  placingOrder && { opacity: 0.7 },
                ]} 
                onPress={handlePlaceOrder}
              activeOpacity={0.8}
                disabled={placingOrder}
              >
                {placingOrder ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.checkoutButtonText}>Place Order</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
            </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Payment Method Modal */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.paymentModalOverlay}>
          <View style={styles.paymentModalContent}>
            <View style={styles.paymentModalHeader}>
              <Text style={styles.paymentModalTitle}>Choose payment method</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            {paymentOptions.map(option => {
              const isActive = option.key === paymentMethod;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.paymentOptionRow,
                    isActive && styles.paymentOptionRowActive,
                    !option.available && styles.paymentOptionRowDisabled,
                  ]}
                  onPress={() => handleSelectPaymentOption(option)}
                  activeOpacity={0.85}
                >
                  <View style={styles.paymentOptionIcon}>
                    <Ionicons
                      name={option.icon as any}
                      size={20}
                      color={option.available ? '#F53F7A' : '#9CA3AF'}
                    />
                  </View>
                  <View style={styles.paymentOptionInfo}>
                    <Text
                      style={[
                        styles.paymentOptionTitle,
                        !option.available && styles.paymentOptionTitleDisabled,
                      ]}
                    >
                      {option.title}
                    </Text>
                    <Text style={styles.paymentOptionSubtitle}>{option.subtitle}</Text>
                  </View>
                  {isActive ? (
                    <Ionicons name="checkmark-circle" size={22} color="#F53F7A" />
                  ) : (
                    <View
                      style={[
                        styles.paymentOptionRadio,
                        option.available && { borderColor: '#F53F7A' },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Reseller Price Modal */}
      <Modal
        visible={showResellerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelResellerModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBadge}>
                <Ionicons name="trending-up" size={24} color="#10B981" />
              </View>
              <Text style={styles.modalTitle}>Set Reseller Price</Text>
              <Text style={styles.modalSubtitle}>
                {selectedItemForResell?.name}
              </Text>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.originalPriceRow}>
                <Text style={styles.originalPriceLabel}>Original Price:</Text>
                <Text style={styles.originalPriceValue}>
                  ₹{selectedItemForResell ? (selectedItemForResell.price * selectedItemForResell.quantity).toFixed(2) : '0'}
                </Text>
              </View>

              <View style={styles.modalDivider} />

              <Text style={styles.inputLabel}>Your Selling Price</Text>
              <View style={styles.modalPriceInputWrapper}>
                <Text style={styles.modalCurrencySymbol}>₹</Text>
                <TextInput
                  style={styles.modalPriceInput}
                  placeholder="Enter selling price"
                  keyboardType="numeric"
                  value={resellerPriceInput}
                  onChangeText={(text) => {
                    setResellerPriceInput(text);
                  }}
                  autoFocus={true}
                      />
                    </View>

              {resellerPriceInput && selectedItemForResell && (() => {
                const enteredPrice = parseFloat(resellerPriceInput);
                const originalPrice = selectedItemForResell.price * selectedItemForResell.quantity;
                const profit = enteredPrice - originalPrice;
                
                if (!isNaN(enteredPrice)) {
                  if (enteredPrice <= originalPrice) {
                    return (
                      <View style={styles.errorPreview}>
                        <Ionicons name="alert-circle" size={18} color="#EF4444" />
                        <Text style={styles.errorPreviewText}>
                          Price must be higher than ₹{originalPrice.toFixed(2)}
                        </Text>
                      </View>
                    );
                  } else {
                    return (
                      <View style={styles.profitPreview}>
                        <Ionicons name="cash" size={18} color="#10B981" />
                        <Text style={styles.profitPreviewText}>
                          Your Profit: ₹{profit.toFixed(2)}
                        </Text>
                    </View>
                    );
                  }
                }
                return null;
              })()}

              <View style={styles.modalInfo}>
                <Ionicons name="information-circle" size={16} color="#666" />
                <Text style={styles.modalInfoText}>
                  Set a price higher than the original to earn profit when reselling
                    </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={handleCancelResellerModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={handleConfirmResellerPrice}>
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
                      </View>
          </View>
        </View>
      </Modal>

      {/* Size Selection Modal */}
      <Modal
        visible={showSizeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSizeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBadge}>
                <Ionicons name="resize" size={24} color="#F53F7A" />
              </View>
              <Text style={styles.modalTitle}>Select Size</Text>
              <Text style={styles.modalSubtitle}>
                Choose a size for the additional item
                          </Text>
                      </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Available Sizes</Text>
              <View style={styles.sizeOptionsContainer}>
                {availableSizes.map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.sizeOption,
                      selectedNewSize === size && styles.sizeOptionSelected
                    ]}
                    onPress={() => setSelectedNewSize(size)}>
                    <Text style={[
                      styles.sizeOptionText,
                      selectedNewSize === size && styles.sizeOptionTextSelected
                    ]}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalInfo}>
                <Ionicons name="information-circle" size={16} color="#666" />
                <Text style={styles.modalInfoText}>
                  This will add 1 more item with the selected size to your cart
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowSizeModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={handleConfirmSizeSelection}>
                <Text style={styles.modalConfirmText}>Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
                <Text style={styles.breakdownValue}>₹{subtotalRspBase.toFixed(2)}</Text>
              </View>

              {totalResellerProfit > 0 && (
                <View style={[styles.breakdownItem, styles.breakdownItemGreen]}>
                  <View style={styles.breakdownLabelWithIcon}>
                    <Ionicons name="trending-up" size={16} color="#666" />
                    <Text style={styles.breakdownLabelGreen}>Reseller Margin ({resellerItemsCount} items)</Text>
                  </View>
                  <Text style={styles.breakdownValueGreen}>+₹{totalResellerProfit.toFixed(2)}</Text>
                          </View>
                        )}
              
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Delivery Charges</Text>
                {deliveryCharge === 0 ? (
                  <View style={styles.breakdownFreeTag}>
                    <Text style={styles.breakdownFreeText}>FREE</Text>
                          </View>
                ) : (
                  <Text style={styles.breakdownValue}>₹{deliveryCharge.toFixed(2)}</Text>
                        )}
                      </View>

              {savings > 0 && (
                <View style={[styles.breakdownItem, styles.breakdownItemSavings]}>
                  <Text style={styles.breakdownLabel}>Discount</Text>
                  <Text style={styles.breakdownValueSavings}>-₹{savings.toFixed(2)}</Text>
                    </View>
              )}

              {couponDiscountAmount > 0 && (
                <View style={styles.breakdownItem}>
                  <View style={styles.breakdownLabelWithIcon}>
                    <Ionicons name="pricetag" size={16} color="#666" />
                    <Text style={styles.breakdownLabel}>Coupon Discount</Text>
                  </View>
                  <Text style={styles.breakdownValueSavings}>-₹{couponDiscountAmount.toFixed(2)}</Text>
                </View>
              )}

              {coinDiscountAmount > 0 && (
                <View style={styles.breakdownItem}>
                  <View style={styles.breakdownLabelWithIcon}>
                    <Ionicons name="wallet" size={16} color="#666" />
                    <Text style={styles.breakdownLabel}>Coin Discount</Text>
                  </View>
                  <Text style={styles.breakdownValueSavings}>-₹{coinDiscountAmount.toFixed(2)}</Text>
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

              {savings > 0 && (
                <View style={styles.breakdownSavingsHighlight}>
                  <Ionicons name="happy-outline" size={18} color="#666" />
                  <Text style={styles.breakdownSavingsText}>
                    You will save ₹{savings.toFixed(2)} on this order
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

      {/* SaveToCollectionSheet */}
      <SaveToCollectionSheet
        visible={showCollectionSheet}
        product={productForCollection}
        onClose={() => {
          setShowCollectionSheet(false);
          setProductForCollection(null);
        }}
        onSaved={(product: any, collectionName: string) => {
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: `Added to ${collectionName}`,
            position: 'top',
          });
        }}
      />

      {/* Remove Item Confirmation Modal */}
      <Modal
        visible={showRemoveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRemoveModal(false)}
      >
        <View style={styles.removeModalOverlay}>
          <View style={styles.removeModalContent}>
            {/* Message */}
            <Text style={styles.removeModalTitle}>Remove Item?</Text>
            {itemToRemove && (
              <Text style={styles.removeModalProductName} numberOfLines={1}>
                {itemToRemove.name}
              </Text>
            )}

            {/* Buttons with Emojis */}
            <View style={styles.removeModalButtons}>
              <TouchableOpacity
                style={styles.removeConfirmButton}
                onPress={() => {
                  if (itemToRemove) {
                    removeFromCart(itemToRemove.id);
                    setShowRemoveModal(false);
                    setItemToRemove(null);
                    Toast.show({
                      type: 'success',
                      text1: 'Removed from Cart',
                      text2: itemToRemove.name,
                      position: 'top',
                    });
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.removeConfirmEmoji}>😢</Text>
                <Text style={styles.removeConfirmText}>Yes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.removeKeepButton}
                onPress={() => {
                  setShowRemoveModal(false);
                  setItemToRemove(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.removeKeepEmoji}>😊</Text>
                <Text style={styles.removeKeepText}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  addressSummaryWrapper: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  addressSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
  },
  addressSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  addressSummaryTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  addressSummaryLabel: {
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  addressSummaryName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  addressSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  addressSummaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#F53F7A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  addressSummaryChipText: {
    color: '#F53F7A',
    fontSize: 11,
    fontWeight: '700',
  },
  addressSummaryPreview: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 4,
  },
  coinConfettiOverlay: {
    position: 'absolute',
    top: -50,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    overflow: 'hidden',
  },
  coinConfettiPiece: {
    position: 'absolute',
    width: 8,
    height: 16,
    borderRadius: 2,
    top: SCREEN_HEIGHT * 0.25,
  },
  coinStarPiece: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.25 + 10,
    left: SCREEN_WIDTH / 2 - 6,
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#FFF4D4',
  },
  coinBadgeGlow: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.25 - 30,
    left: SCREEN_WIDTH / 2 - 80,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(245, 158, 11, 0.35)',
    zIndex: -1,
  },
  coinBadge: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.25 + 20,
    left: SCREEN_WIDTH / 2 - 120,
    width: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 60,
    backgroundColor: '#0F172A',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  coinBadgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinBadgeTextBlock: {
    flex: 1,
  },
  coinBadgeTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  coinBadgeSubtitle: {
    color: '#CBD5F5',
    fontSize: 12,
    marginTop: 2,
  },
  couponCoinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    backgroundColor: '#FFF7EB',
  },
  couponCoinRowActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  couponCoinLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  couponCoinIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponCoinTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  couponCoinTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  couponCoinSubtitle: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  couponCoinButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  couponCoinButtonApplied: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  couponCoinButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
  },
  couponCoinButtonTextApplied: {
    color: '#fff',
  },
  referralRewardCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    gap: 12,
  },
  referralRewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  referralRewardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralRewardHeaderText: {
    flex: 1,
  },
  referralRewardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  referralRewardSubtitle: {
    fontSize: 13,
    color: '#B45309',
    marginTop: 2,
  },
  referralRewardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  referralRewardStatBlock: {
    flex: 1,
    alignItems: 'center',
  },
  referralRewardStatLabel: {
    fontSize: 12,
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  referralRewardStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#92400E',
    marginTop: 4,
  },
  referralRewardStatHint: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  referralRewardDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#FDE68A',
  },
  referralRewardButton: {
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    alignItems: 'center',
  },
  referralRewardButtonDisabled: {
    backgroundColor: '#FDE68A',
  },
  referralRewardButtonText: {
    color: '#7C2D12',
    fontSize: 14,
    fontWeight: '700',
  },
  deliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  deliveryBannerIcon: {
    marginRight: 10,
  },
  deliveryBannerTextContainer: {
    flex: 1,
  },
  deliveryBannerText: {
    fontSize: 13,
    color: '#047857',
    lineHeight: 18,
  },
  deliveryBannerHighlight: {
    fontWeight: '700',
  },
  coinEarningsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  coinEarningsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  coinEarningsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78350F',
  },
  coinEarningsHighlight: {
    fontWeight: '700',
    color: '#F59E0B',
    fontSize: 13,
  },
  checkoutCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  checkoutCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  checkoutCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkoutIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  checkoutCardSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  checkoutChangeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#F53F7A',
    borderRadius: 20,
  },
  checkoutChangeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F53F7A',
  },
  appliedCouponBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  appliedCouponContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appliedCouponCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
  },
  appliedCouponSavings: {
    fontSize: 12,
    color: '#047857',
  },
  removeCouponText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  couponInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  couponInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  applyCouponButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F53F7A',
  },
  applyCouponButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  availableCouponsContainer: {
    marginTop: 12,
    gap: 8,
  },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
    padding: 12,
  },
  couponCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  couponCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF0E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponCardText: {
    flex: 1,
    minWidth: 0,
  },
  couponCardCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C2410C',
    marginBottom: 2,
  },
  couponCardDescription: {
    fontSize: 11,
    color: '#9A3412',
  },
  seeMoreCouponsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  seeMoreCouponsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F53F7A',
    marginRight: 4,
  },
  paymentSelectButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 0,
    backgroundColor: '#fff',
    minHeight: 48,
  },
  paymentSelectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  paymentSelectIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF4E6',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentSelectTexts: {
    flex: 1,
  },
  paymentSelectLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#94A3B8',
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  paymentSelectValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  footerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 6,
  },
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  paymentModalContent: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 30,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  paymentModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  paymentModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  paymentOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  paymentOptionRowActive: {
    backgroundColor: '#FFF5F7',
  },
  paymentOptionRowDisabled: {
    opacity: 0.5,
  },
  paymentOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentOptionInfo: {
    flex: 1,
  },
  paymentOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  paymentOptionTitleDisabled: {
    color: '#6B7280',
  },
  paymentOptionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  paymentOptionRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  priceRows: {
    gap: 10,
  },
  priceDiscount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  freeTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
  },
  freeTagText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '700',
  },
  coinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  coinsText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  resellerMarginRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resellerMarginLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resellerMarginLabel: {
    fontSize: 13,
    color: '#065F46',
    fontWeight: '600',
  },
  resellerMarginValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  cartItemsSection: {
    marginTop: 12,
  },
  cartItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  cartItemContent: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'flex-start',
  },
  itemImageContainer: {
    position: 'relative',
    marginRight: 12,
    marginTop: 4,
  },
  itemImage: {
    width: 90,
    height: 110,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  quantityBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#F53F7A',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  quantityBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  itemDetails: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemNameContainer: {
    flex: 1,
    marginRight: 8,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 20,
    marginBottom: 6,
  },
  discountBadge: {
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  discountBadgeText: {
    color: '#F53F7A',
    fontWeight: '700',
    fontSize: 11,
  },
  itemAttributes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  attributeChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  attributeText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  priceContainer: {
    flex: 1,
  },
  itemMrpStriked: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  itemPriceUnit: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  itemSavingsText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  quantityButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  quantityButtonDisabled: {
    backgroundColor: '#F9FAFB',
  },
  quantityText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    paddingHorizontal: 16,
  },
  stockWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  stockWarningText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
  },
  priceDetails: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  priceDetailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  coinDiscountValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  resellerProfitLabelInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceLabelGreen: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  priceValueGreen: {
    fontSize: 15,
    color: '#10B981',
    fontWeight: '700',
  },
  removeCoinText: {
    fontSize: 12,
    color: '#F53F7A',
    fontWeight: '700',
  },
  priceFree: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '700',
  },
  priceSavings: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  totalRow: {
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F53F7A',
  },
  // Compact Price Summary Styles
  compactPriceSummary: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  compactPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  compactTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  compactTotalValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F53F7A',
  },
  viewBreakdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF0F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F53F7A',
    gap: 6,
    marginBottom: 12,
  },
  viewBreakdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F53F7A',
  },
  savingsTagCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B98130',
  },
  savingsTextCompact: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
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
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  breakdownDoneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  savingsTagOld: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 12,
    gap: 6,
  },
  savingsText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  trustBadges: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  trustBadgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustBadgeText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 24,
  },
  checkoutFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  footerPriceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  viewBreakdownButtonFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
    marginBottom: 10,
  },
  viewBreakdownTextFooter: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F53F7A',
    textDecorationLine: 'underline',
  },
  checkoutButton: {
    flex: 3,
    flexDirection: 'row',
    backgroundColor: '#F53F7A',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyCartContainer: {
    flexGrow: 1,
    paddingTop: 40,
  },
  emptyCartContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyCartIcon: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyCartTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyCartSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  startShoppingButton: {
    flexDirection: 'row',
    backgroundColor: '#F53F7A',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startShoppingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Reseller Styles
  resellerSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  resellerCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  resellerLabel: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 8,
  },
  earningsBadge: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#10B98140',
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F0FDF4',
    borderBottomWidth: 1,
    borderBottomColor: '#10B98120',
  },
  earningsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  earningsHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: 0.3,
  },
  earningsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  earningsEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#10B98120',
  },
  earningsEditText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  earningsDeleteButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  earningsBody: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FAFFFE',
  },
  earningsColumn: {
    flex: 1,
  },
  earningsColumnDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  earningsLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  earningsValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  profitValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  earningsProfit: {
    fontSize: 17,
    fontWeight: '700',
    color: '#10B981',
  },
  // Price Details Reseller Profit Styles
  resellerProfitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#10B98115',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#10B98130',
  },
  resellerProfitLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resellerProfitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  resellerProfitValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  resellerInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  resellerInfoBoxText: {
    fontSize: 12,
    color: '#10B981',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  modalIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B98120',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  originalPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
  },
  originalPriceLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  originalPriceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  modalPriceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  modalCurrencySymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
    marginRight: 8,
  },
  modalPriceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    paddingVertical: 14,
  },
  profitPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98120',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  profitPreviewText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  errorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  errorPreviewText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    flex: 1,
  },
  modalInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  modalInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  sizeOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  sizeOption: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    minWidth: 70,
    alignItems: 'center',
  },
  sizeOptionSelected: {
    borderColor: '#F53F7A',
    backgroundColor: '#FFF0F5',
  },
  sizeOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  sizeOptionTextSelected: {
    color: '#F53F7A',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  // Remove Modal Styles - Simple & Compact
  removeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  removeModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 300,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  removeModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  removeModalProductName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  removeModalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  removeKeepButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  removeKeepEmoji: {
    fontSize: 18,
  },
  removeKeepText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  removeConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  removeConfirmEmoji: {
    fontSize: 18,
  },
  removeConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

export default Cart;