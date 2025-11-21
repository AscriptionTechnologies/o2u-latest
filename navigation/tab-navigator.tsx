import { View, Text, Platform, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Keyboard, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, CardStyleInterpolators, TransitionSpecs } from '@react-navigation/stack';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigation as useRootNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Profile from '~/screens/Profile';
import Dashboard from '~/screens/Dashboard';
import TrendingScreen from '~/screens/Trending';
import ProductDetails from '~/screens/ProductDetails';
import Products from '~/screens/Products';
import EditProfile from '~/screens/EditProfile';
import MyOrders from '~/screens/MyOrders';
import BodyMeasurements from '~/screens/BodyMeasurements';
import HelpCenter from '~/screens/HelpCenter';
import Cart from '~/screens/Cart';
import Admin from '~/screens/Admin';
import CategoryManagement from '~/screens/CategoryManagement';
import ProductManagement from '~/screens/ProductManagement';
import ColorManagement from '~/screens/ColorManagement';
import UserManagement from '~/screens/UserManagement';
import SettingsManagement from '~/screens/SettingsManagement';
import OrderManagement from '~/screens/OrderManagement';
import Wishlist from '~/screens/Wishlist';
import CollectionDetails from '~/screens/CollectionDetails';
import SharedCollection from '~/screens/SharedCollection';
import VendorProfile from '~/screens/VendorProfile';
import JoinInfluencer from '~/screens/JoinInfluencer';
import ResellerRegistration from '~/screens/ResellerRegistration';
import ResellerDashboard from '~/screens/ResellerDashboard';
import CatalogShare from '~/screens/CatalogShare';
import AllReviews from '~/screens/AllReviews';
import { useUser } from '~/contexts/UserContext';
import { useCart } from '~/contexts/CartContext';
import { useAuth } from '~/contexts/useAuth';
import { useLoginSheet } from '~/contexts/LoginSheetContext';
import { supabase } from '~/utils/supabase';
import ChatThread from '~/screens/ChatThread';
import FriendSearch from '~/screens/FriendSearch';
import Coupons from '~/screens/Coupons';
import Toast from 'react-native-toast-message';
import { ensureNewUserReferralCoupon, ensureReferrerRewardCoupon } from '~/services/referralCouponService';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Custom smooth easing configuration
const customTransitionSpec = {
  open: {
    animation: 'spring',
    config: {
      stiffness: 1000,
      damping: 500,
      mass: 3,
      overshootClamping: true,
      restDisplacementThreshold: 0.01,
      restSpeedThreshold: 0.01,
    },
  },
  close: {
    animation: 'spring',
    config: {
      stiffness: 1000,
      damping: 500,
      mass: 3,
      overshootClamping: true,
      restDisplacementThreshold: 0.01,
      restSpeedThreshold: 0.01,
    },
  },
};

// Home Stack Navigator (Dashboard + ProductDetails + Products + Profile + Profile-related screens)
const HomeStack = () => {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        transitionSpec: customTransitionSpec,
      }}
    >
      <Stack.Screen name="Home" component={Dashboard} />
      <Stack.Screen name="ProductDetails" component={ProductDetails} />
      <Stack.Screen name="Products" component={Products} />
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="EditProfile" component={EditProfile} />
      <Stack.Screen name="MyOrders" component={MyOrders} />
      <Stack.Screen name="ChatThread" component={ChatThread} />
      <Stack.Screen name="FriendSearch" component={FriendSearch} />
      <Stack.Screen name="BodyMeasurements" component={BodyMeasurements} />
      <Stack.Screen name="HelpCenter" component={HelpCenter} />
      <Stack.Screen name="Wishlist" component={Wishlist} />
      <Stack.Screen name="CollectionDetails" component={CollectionDetails} />
      <Stack.Screen name="SharedCollection" component={SharedCollection} />
      <Stack.Screen name="AllReviews" component={AllReviews} />
      <Stack.Screen name="VendorProfile" component={VendorProfile} />
      <Stack.Screen name="JoinInfluencer" component={JoinInfluencer} />
      <Stack.Screen name="ResellerRegistration" component={ResellerRegistration} />
      <Stack.Screen name="ResellerDashboard" component={ResellerDashboard} />
      <Stack.Screen name="CatalogShare" component={CatalogShare} />
      <Stack.Screen name="Coupons" component={Coupons} />
      <Stack.Screen name="Admin" component={Admin} />
      <Stack.Screen name="UserManagement" component={UserManagement} />
      <Stack.Screen name="CategoryManagement" component={CategoryManagement} />
      <Stack.Screen name="ProductManagement" component={ProductManagement} />
      <Stack.Screen name="ColorManagement" component={ColorManagement} />
      <Stack.Screen name="SettingsManagement" component={SettingsManagement} />
      <Stack.Screen name="OrderManagement" component={OrderManagement} />
    </Stack.Navigator>
  );
};

// Admin Stack Navigator (Admin + UserManagement + CategoryManagement + ProductManagement + ColorManagement)
const AdminStack = () => {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        transitionSpec: customTransitionSpec,
      }}
    >
      <Stack.Screen name="AdminMain" component={Admin} />
      <Stack.Screen name="UserManagement" component={UserManagement} />
      <Stack.Screen name="CategoryManagement" component={CategoryManagement} />
      <Stack.Screen name="ProductManagement" component={ProductManagement} />
      <Stack.Screen name="ColorManagement" component={ColorManagement} />
    </Stack.Navigator>
  );
};

export default function TabLayout() {
  const rootNav = useRootNavigation<any>();
  const { userData } = useUser()
  const { user } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const { getCartCount } = useCart();
  const cartCount = getCartCount();
  const insets = useSafeAreaInsets();
  
  // Safe translate helper - returns plain strings without i18n
  const tt = (key: string, fallback: string): string => {
    // Just return the fallback directly to avoid any translation issues
    const result = fallback || key || 'Label';
    return String(result); // Ensure it's always a string
  };

  // Recurring login prompt for guests
  const { isLoginSheetVisible, showLoginSheet, hideLoginSheet } = useLoginSheet();
  const [hasSession, setHasSession] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  // Onboarding bottom sheet state (name-only)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [name, setName] = useState('');
  const [creatingProfile, setCreatingProfile] = useState(false);
  // Referral code state
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralCodeState, setReferralCodeState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [referralCodeMessage, setReferralCodeMessage] = useState('');
  const [appliedReferralCoupon, setAppliedReferralCoupon] = useState<{ code: string; couponId: string; referrerId?: string | null } | null>(null);
  // Track Supabase auth session directly to avoid profile-loading delays
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setHasSession(!!data.session);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Manage recurring prompt based on hasSession
  useEffect(() => {
    if (hasSession) {
      hideLoginSheet();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    // If no session, start/restart interval
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        // Only show login sheet if it's not already visible
        if (!isLoginSheetVisible) {
          showLoginSheet();
        }
      }, 20000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasSession, isLoginSheetVisible, showLoginSheet, hideLoginSheet]);

  // resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn(v => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const resetSheetState = () => {
    setCountryCode('+91');
    setPhone('');
    setOtp('');
    setError(null);
    setSending(false);
    setVerifying(false);
    setOtpSent(false);
    setResendIn(0);
    setReferralCodeInput('');
    setReferralCodeState('idle');
    setReferralCodeMessage('');
    setAppliedReferralCoupon(null);
  };

  const handleSendOtp = async () => {
    try {
      setError(null);
      const trimmed = phone.replace(/\D/g, '');
      if (!trimmed || trimmed.length < 8) {
        setError('Enter a valid phone number');
        return;
      }
      setSending(true);
      const fullPhone = `${countryCode}${trimmed}`;
      const { error: sendError } = await supabase.auth.signInWithOtp({ phone: fullPhone });
      if (sendError) {
        setError(sendError.message);
        setSending(false);
        return;
      }
      setOtpSent(true);
      setResendIn(30);
    } catch (e: any) {
      setError(e?.message || 'Failed to send OTP');
    } finally {
      setSending(false);
    }
  };

  const handleApplyReferralCodeInput = useCallback(async () => {
    const trimmed = referralCodeInput.trim().toUpperCase();
    if (!trimmed) {
      setReferralCodeState('invalid');
      setReferralCodeMessage('Enter a referral code to apply.');
      setAppliedReferralCoupon(null);
      return;
    }

    setReferralCodeState('checking');
    setReferralCodeMessage('');

    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('id, code, is_active, discount_type, discount_value, created_by')
        .eq('code', trimmed)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        setReferralCodeState('invalid');
        setReferralCodeMessage('Invalid or inactive referral code.');
        setAppliedReferralCoupon(null);
        return;
      }

      if (data.discount_type !== 'fixed' || Number(data.discount_value) < 100) {
        setReferralCodeState('invalid');
        setReferralCodeMessage('This code is not eligible for referral discount.');
        setAppliedReferralCoupon(null);
        return;
      }

      setReferralCodeState('valid');
      setReferralCodeMessage('Referral code applied! You will see ₹100 off on your first order.');
      setAppliedReferralCoupon({ 
        code: trimmed, 
        couponId: data.id,
        referrerId: data.created_by || null 
      });
    } catch (error) {
      console.error('Referral code apply error:', error);
      setReferralCodeState('invalid');
      setReferralCodeMessage('Unable to verify referral code. Please try again.');
      setAppliedReferralCoupon(null);
    }
  }, [referralCodeInput]);

  const handleVerifyOtp = async () => {
    try {
      setError(null);
      const trimmed = phone.replace(/\D/g, '');
      if (!otp || otp.trim().length < 4) {
        setError('Enter the OTP');
        return;
      }
      setVerifying(true);
      const fullPhone = `${countryCode}${trimmed}`;
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: otp.trim(),
        type: 'sms',
      });
      if (verifyError) {
        setError(verifyError.message);
        setVerifying(false);
        return;
      }
      // Success: decide whether to show onboarding
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('id')
          .eq('id', authUser.id)
          .single();

        if (!profile && profileError && (profileError.code === 'PGRST116' || profileError.details?.includes('Results contain 0 rows'))) {
          // No profile -> show onboarding sheet
          hideLoginSheet();
          setName('');
          setShowOnboarding(true);
        } else {
          // Profile exists -> close login sheet
          hideLoginSheet();
        }
      } else {
        hideLoginSheet();
      }

      resetSheetState();
      Keyboard.dismiss();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch (e: any) {
      setError(e?.message || 'OTP verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleCreateProfile = async () => {
    try {
      setCreatingProfile(true);
      setError(null);
      if (!name.trim()) {
        setError('Please enter your name');
        setCreatingProfile(false);
        return;
      }
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setError('No auth user found');
        setCreatingProfile(false);
        return;
      }
      
      // Get phone number from auth user
      const userPhone = authUser.phone || null;
      
      const newProfile = {
        id: authUser.id,
        name: name.trim(),
        phone: userPhone,
      } as any;
      const { error: insertError } = await supabase.from('users').insert([newProfile]);
      if (insertError) {
        setError(insertError.message);
        setCreatingProfile(false);
        return;
      }
      if (appliedReferralCoupon) {
        try {
          const newUserCoupon = await ensureNewUserReferralCoupon(authUser.id);

          Toast.show({
            type: 'success',
            text1: 'Referral saved',
            text2: '₹100 off coupon added to your account.',
          });

          if (appliedReferralCoupon.referrerId) {
            await ensureReferrerRewardCoupon(appliedReferralCoupon.referrerId);
          }

          console.log('[Signup] ✅ Referral coupons synced to Supabase:', {
            newUserCoupon: newUserCoupon.code,
            referrerId: appliedReferralCoupon.referrerId,
          });
        } catch (couponError) {
          console.error('[Signup] ❌ Error syncing referral coupons:', couponError);
        }
      }
      setShowOnboarding(false);
      setName('');
      setReferralCodeInput('');
      setReferralCodeState('idle');
      setReferralCodeMessage('');
      setAppliedReferralCoupon(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to create profile');
    } finally {
      setCreatingProfile(false);
    }
  };

  // Base tab bar style with safe area insets
  const baseTabBarStyle = {
          backgroundColor: '#FFFFFF',
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          height: Math.max(insets.bottom + 60, 70),
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -2 },
          elevation: 8,
  } as const;

  return (
    <>
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#FF3F6C',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: { ...baseTabBarStyle, display: isLoginSheetVisible && !hasSession ? 'none' : 'flex' },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <View style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: focused ? '#FF3F6C' : '#FFE5EC',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{
                  color: focused ? '#FFFFFF' : '#FF3F6C',
                  fontSize: 12,
                  fontWeight: '800',
                  letterSpacing: -0.2,
                }}>O<Text style={{ color: focused ? '#FFFFFF' : '#FF3F6C' }}>2</Text>U</Text>
              </View>
            </View>
          ),
        }}
      />
      {isAdmin && (
        <Tab.Screen
          name="Admin"
          component={AdminStack}
          options={{
            title: tt('admin', 'Admin'),
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <View style={{
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? '#F53F7A' : '#FFE8F0',
                borderRadius: 25,
                width: 50,
                height: 50,
                marginBottom: 50,
                shadowColor: '#F53F7A',
                shadowOpacity: focused ? 0.3 : 0.1,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }}>
                <Ionicons
                  name={focused ? "shield-checkmark" : "shield-checkmark-outline"}
                  size={28}
                  color={focused ? '#fff' : '#F53F7A'}
                />
              </View>
            ),
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
              marginTop: -5,
            },
            tabBarLabel: ({ focused }) => (
              <Text style={{ color: '#000', fontSize: 12, fontWeight: '600', marginTop: 4 }}>
                {tt('admin', 'Admin') || 'Admin'}
              </Text>
            ),
          }}
        />
      )}
      <Tab.Screen
        name="Trending"
        component={TrendingScreen}
        options={{
          title: tt('trending', 'Trending'),
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={focused ? 'flame' : 'flame-outline'} size={24} color={focused ? '#FF3F6C' : '#8E8E93'} />
            </View>
          ),
          tabBarLabel: ({ focused }) => (
            <Text style={{ color: focused ? '#FF3F6C' : '#8E8E93', fontSize: 12, fontWeight: '600', marginTop: 4 }}>
              {tt('trending', 'Trending') || 'Trending'}
            </Text>
          ),
        }}
      />
      {!isAdmin && (
        <Tab.Screen
          name="Cart"
          component={Cart}
          options={{
            title: 'Bag',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <Ionicons
                  name={focused ? "bag" : "bag-outline"}
                  size={24}
                  color={color}
                />
                {/* Cart badge */}
                {cartCount > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -2,
                    right: -6,
                    backgroundColor: '#FF3F6C',
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{cartCount}</Text>
                  </View>
                )}
              </View>
            ),
            tabBarLabel: ({ focused }) => (
              <Text style={{ color: '#000', fontSize: 12, fontWeight: '600', marginTop: 4 }}>Bag</Text>
            ),
          }}
        />
      )}
    </Tab.Navigator>

    {/* Bottom sheet style modal for OTP login */}
    <Modal visible={isLoginSheetVisible && !hasSession} transparent animationType="slide" onRequestClose={() => { hideLoginSheet(); resetSheetState(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, maxHeight: '78%' }}>
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: '#D6D6D6' }} />
            </View>

            {/* Title + subtitle */}
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#1f1f1f' }}>{tt('welcome_back', 'Welcome back')}</Text>
              <Text style={{ marginTop: 4, color: '#666', fontWeight: '500' }}>{tt('login_benefits', 'Login to track orders, wishlist, and get offers')}</Text>
            </View>

            <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={{ paddingBottom: 8 }}>
              {/* Perks */}
              <View style={{ flexDirection: 'row', marginTop: 6, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name='shield-checkmark-outline' size={16} color='#2e7d32' />
                  <Text style={{ marginLeft: 6, color: '#333', fontSize: 12, fontWeight: '600' }}>{tt('secure_otp', 'Secure OTP')}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name='heart-outline' size={16} color='#F53F7A' />
                  <Text style={{ marginLeft: 6, color: '#333', fontSize: 12, fontWeight: '600' }}>{tt('save_wishlist', 'Save Wishlist')}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name='pricetag-outline' size={16} color='#6a5acd' />
                  <Text style={{ marginLeft: 6, color: '#333', fontSize: 12, fontWeight: '600' }}>{tt('exclusive_offers', 'Exclusive Offers')}</Text>
                </View>
              </View>

              {/* Phone input */}
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: '700', letterSpacing: 0.2 }}>{tt('enter_mobile', 'Enter your mobile number')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F5F7', borderRadius: 14, paddingHorizontal: 12, paddingVertical: Platform.OS === 'android' ? 8 : 12, borderWidth: 1, borderColor: '#EAECF0' }}>
                <TextInput
                  value={countryCode}
                  onChangeText={setCountryCode}
                  style={{ width: 68, fontSize: 16, fontWeight: '800', color: '#111' }}
                  keyboardType='phone-pad'
                />
                <View style={{ width: 1, height: 22, backgroundColor: '#E0E0E0', marginHorizontal: 10 }} />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={tt('phone_placeholder', '9876543210')}
                  placeholderTextColor='#999'
                  style={{ flex: 1, fontSize: 16, color: '#111' }}
                  keyboardType='phone-pad'
                  returnKeyType='done'
                  maxLength={15}
                />
              </View>

              {/* Referral code input */}
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: '700', letterSpacing: 0.2 }}>
                  Have a referral code? (optional)
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#F4F5F7',
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor:
                      referralCodeState === 'valid'
                        ? '#A7F3D0'
                        : referralCodeState === 'invalid'
                        ? '#FECACA'
                        : '#EAECF0',
                  }}
                >
                  <TextInput
                    value={referralCodeInput}
                    onChangeText={(text) => {
                      setReferralCodeInput(text.toUpperCase());
                      if (referralCodeState !== 'idle') {
                        setReferralCodeState('idle');
                        setReferralCodeMessage('');
                        setAppliedReferralCoupon(null);
                      }
                    }}
                    placeholder="ENTER CODE"
                    placeholderTextColor="#9CA3AF"
                    style={{ flex: 1, fontSize: 14, color: '#111', paddingVertical: Platform.OS === 'android' ? 10 : 14 }}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      backgroundColor: referralCodeState === 'valid' ? '#10B981' : '#F53F7A',
                      borderRadius: 12,
                      marginLeft: 8,
                    }}
                    onPress={handleApplyReferralCodeInput}
                    disabled={referralCodeState === 'checking'}
                  >
                    {referralCodeState === 'checking' ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '700' }}>
                        {referralCodeState === 'valid' ? 'Applied' : 'Apply'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                {!!referralCodeMessage && (
                  <Text
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: referralCodeState === 'valid' ? '#047857' : '#B91C1C',
                    }}
                  >
                    {referralCodeMessage}
                  </Text>
                )}
              </View>

              {/* Primary CTA send/resend */}
              {!otpSent ? (
                <TouchableOpacity disabled={sending} onPress={handleSendOtp} style={{ marginTop: 14, backgroundColor: sending ? '#F7A3BD' : '#F53F7A', borderRadius: 14, paddingVertical: 14, alignItems: 'center', shadowColor: '#F53F7A', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{sending ? tt('sending', 'Sending...') : tt('send_otp', 'Send OTP')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#666' }}>{resendIn > 0 ? `${tt('resend_in', 'Resend in')} ${resendIn}s` : tt('you_can_resend', 'You can resend now')}</Text>
                  <TouchableOpacity disabled={resendIn > 0} onPress={handleSendOtp}>
                    <Text style={{ color: resendIn > 0 ? '#AAA' : '#F53F7A', fontWeight: '800' }}>{tt('resend_otp', 'Resend OTP')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* OTP input + Verify CTA */}
              {otpSent && (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: '700' }}>{tt('enter_otp', 'Enter OTP')}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F5F7', borderRadius: 14, paddingHorizontal: 14, paddingVertical: Platform.OS === 'android' ? 8 : 12, borderWidth: 1, borderColor: '#EAECF0' }}>
                    <Ionicons name='key-outline' size={18} color='#999' />
                    <TextInput
                      value={otp}
                      onChangeText={setOtp}
                      placeholder='123456'
                      placeholderTextColor='#999'
                      style={{ flex: 1, fontSize: 18, color: '#111', marginLeft: 10, letterSpacing: 6 }}
                      keyboardType='number-pad'
                      returnKeyType='done'
                      maxLength={6}
                    />
                  </View>
                  <TouchableOpacity disabled={verifying} onPress={handleVerifyOtp} style={{ marginTop: 14, backgroundColor: verifying ? '#F7A3BD' : '#111827', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{verifying ? tt('verifying', 'Verifying...') : tt('verify_continue', 'Verify & Continue')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!!error && (
                <View style={{ marginTop: 12, backgroundColor: '#FFF0F3', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FFD6DF' }}>
                  <Text style={{ color: '#B00020', fontWeight: '900' }}>{tt('error', 'Error')}</Text>
                  <Text style={{ color: '#B00020', marginTop: 4 }}>{error}</Text>
                </View>
              )}

              {/* Secondary CTAs */}
              <View style={{ marginTop: 16 }}>
                <TouchableOpacity onPress={() => { hideLoginSheet(); resetSheetState(); }} style={{ alignItems: 'center', paddingVertical: 10 }}>
                  <Text style={{ color: '#6B7280', fontWeight: '800' }}>{tt('continue_as_guest', 'Continue as Guest')}</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 4 }}>
                  <TouchableOpacity onPress={() => { try { rootNav.navigate('PrivacyPolicy'); } catch {} }}>
                    <Text style={{ color: '#6B7280', fontWeight: '600', textDecorationLine: 'underline' }}>{tt('privacy_policy', 'Privacy Policy')}</Text>
                  </TouchableOpacity>
                  <Text style={{ marginHorizontal: 8, color: '#9CA3AF' }}>•</Text>
                  <TouchableOpacity onPress={() => { try { rootNav.navigate('TermsAndConditions'); } catch {} }}>
                    <Text style={{ color: '#6B7280', fontWeight: '600', textDecorationLine: 'underline' }}>{tt('terms', 'Terms')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* Bottom sheet: Onboarding after OTP for new users */}
    <Modal visible={showOnboarding && hasSession} transparent animationType="slide" onRequestClose={() => setShowOnboarding(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, maxHeight: '82%' }}>
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: '#D6D6D6' }} />
            </View>

            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#1f1f1f' }}>{tt('your_name', 'Your name')}</Text>
              <Text style={{ marginTop: 4, color: '#666', fontWeight: '500' }}>{tt('enter_name_to_continue', 'Enter your name to continue')}</Text>
            </View>

            <View style={{ maxHeight: '70%' }}>
              <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={{ paddingBottom: 20 }}>
                <View style={{ backgroundColor: '#F4F5F7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'android' ? 8 : 10, borderWidth: 1, borderColor: '#EAECF0' }}>
                  <TextInput value={name} onChangeText={setName} placeholder={tt('name_placeholder', 'John Doe')} placeholderTextColor='#999' style={{ fontSize: 16, color: '#111' }} />
                </View>

                {!!error && (
                  <View style={{ marginTop: 12, backgroundColor: '#FFF0F3', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FFD6DF' }}>
                    <Text style={{ color: '#B00020', fontWeight: '900' }}>{tt('error', 'Error')}</Text>
                    <Text style={{ color: '#B00020', marginTop: 4 }}>{error}</Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
                  <TouchableOpacity disabled={creatingProfile} onPress={handleCreateProfile} style={{ backgroundColor: creatingProfile ? '#F7A3BD' : '#111827', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>{creatingProfile ? tt('saving', 'Saving...') : tt('save', 'Save')}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => setShowOnboarding(false)} style={{ alignItems: 'center', paddingVertical: 10 }}>
                  <Text style={{ color: '#6B7280', fontWeight: '800' }}>{tt('skip_for_now', 'Skip for now')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}
