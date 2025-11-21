import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUser } from '~/contexts/UserContext';
import { useAuth } from '~/contexts/useAuth';
import { useWishlist } from '~/contexts/WishlistContext';
import { useLoginSheet } from '~/contexts/LoginSheetContext';
import { supabase } from '~/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureNewUserReferralCoupon, ensureReferrerRewardCoupon } from '~/services/referralCouponService';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { uploadProfilePhoto, validateImage, deleteProfilePhoto as deleteProfilePhotoFromStorage } from '~/utils/profilePhotoUpload';

type RootStackParamList = {
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
  RefundPolicy: undefined;
  VendorDashboard: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PROFILE_PHOTO_TUTORIAL_KEY = 'ONLY2U_PROFILE_PHOTO_TUTORIAL_SEEN';
const PROFILE_PHOTO_TUTORIAL_VIDEO =
  'https://res.cloudinary.com/dtt75ypdv/video/upload/v1763566959/productvideos/profile-photo-tips.mp4';

const Profile = () => {
  const navigation = useNavigation<NavigationProp>();
  const { userData, clearUserData, refreshUserData, setUserData, deleteUserProfile } = useUser();
  const { setUser, user } = useAuth();
  const { clearWishlist } = useWishlist();
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { t } = useTranslation();

  // OTP Login state
  const { isLoginSheetVisible, showLoginSheet, hideLoginSheet } = useLoginSheet();
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [name, setName] = useState('');
  const [creatingProfile, setCreatingProfile] = useState(false);
  
  // Profile photo upload state
  const [showPhotoPickerModal, setShowPhotoPickerModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [permissionModal, setPermissionModal] = useState<{ visible: boolean; context: 'camera' | 'gallery' }>({
    visible: false,
    context: 'camera',
  });
  const [showDeletePhotoModal, setShowDeletePhotoModal] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralCouponId, setReferralCouponId] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState<{
    totalFriends: number;
    totalDiscount: number;
    lastUsedAt: string | null;
  }>({
    totalFriends: 0,
    totalDiscount: 0,
    lastUsedAt: null,
  });
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralCodeState, setReferralCodeState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [referralCodeMessage, setReferralCodeMessage] = useState('');
  const [appliedReferralCoupon, setAppliedReferralCoupon] = useState<{ code: string; couponId: string; referrerId?: string | null } | null>(null);
  const [showPhotoTutorialModal, setShowPhotoTutorialModal] = useState(false);
  const [photoTutorialDontShowAgain, setPhotoTutorialDontShowAgain] = useState(false);
  const [hasSeenPhotoTutorial, setHasSeenPhotoTutorial] = useState(false);

  // Sync user data from useAuth to useUser if userData is null but user has data
  useEffect(() => {
    if (userData) {
      setUserData(userData);
    }
  }, [userData]);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn(v => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    const loadPhotoTutorialFlag = async () => {
      try {
        const stored = await AsyncStorage.getItem(PROFILE_PHOTO_TUTORIAL_KEY);
        setHasSeenPhotoTutorial(stored === 'true');
      } catch (error) {
        console.warn('Failed to load profile photo tutorial preference', error);
      }
    };
    loadPhotoTutorialFlag();
  }, []);


  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile' as never);
  };

  const handleMyOrders = () => {
    navigation.navigate('MyOrders' as never);
  };

  const handleResellerEarnings = () => {
    navigation.navigate('ResellerDashboard' as never);
  };

  const handleAdminPanel = () => {
    navigation.navigate('Admin' as never);
  };

  const handleBodyMeasurements = () => {
    navigation.navigate('BodyMeasurements' as never);
  };

  const handleHelpCenter = () => {
    navigation.navigate('HelpCenter' as never);
  };

  const handleTermsAndConditions = () => {
    navigation.navigate('TermsAndConditions');
  };

  const handlePrivacyPolicy = () => {
    navigation.navigate('PrivacyPolicy');
  };

  const handleRefundPolicy = () => {
    navigation.navigate('RefundPolicy');
  };

  const handleBecomeSeller = () => {
    // Navigate to VendorProfile (seller onboarding/profile)
    navigation.navigate('VendorProfile' as never);
  };

  const handleVendorDashboard = () => {
    navigation.navigate('VendorDashboard' as never);
  };

  const handleJoinInfluencer = () => {
    navigation.navigate('JoinInfluencer' as never);
  };

  const handleShareProducts = () => {
    Alert.alert(
      'Share Products',
      'You can share any product by clicking the green share button on product cards. No registration needed!',
      [{ text: 'OK' }]
    );
  };

  const generateReferralCode = useCallback(() => {
    if (!userData?.id) return '';
    const namePart = (userData?.name || 'ONLY2U')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase() || 'ONLY2U';
    const idPart = userData.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
    return `${namePart}${idPart}`;
  }, [userData?.id, userData?.name]);

  const parseReferralRewardMetadata = (description?: string | null) => {
    if (!description) return { referralCount: 0, maxDiscount: 0 };
    const parts = description.split('|');
    const metaPart = parts.find((part) => part.startsWith('REFERRALS:'));
    if (!metaPart) return { referralCount: 0, maxDiscount: 0 };
    const [referralSection, maxSection] = metaPart.split(':MAX:');
    const referralCount = Number(referralSection.replace('REFERRALS:', '')) || 0;
    const maxDiscount = Number(maxSection) || 0;
    return { referralCount, maxDiscount };
  };

  const loadReferralData = useCallback(async () => {
    if (!userData?.id) return;

    setReferralLoading(true);
    try {
      const code = generateReferralCode();
      setReferralCode(code);

      const { data: existingCoupon, error: couponFetchError } = await supabase
        .from('coupons')
        .select('id, code, is_active')
        .eq('code', code)
        .maybeSingle();

      if (couponFetchError) {
        throw couponFetchError;
      }

      let couponId = existingCoupon?.id ?? null;

      if (!couponId) {
        const { data: newCoupon, error: couponInsertError } = await supabase
          .from('coupons')
          .insert({
            code,
            description: `Referral invite from ${userData.name || 'Only2U customer'}`,
            discount_type: 'fixed',
            discount_value: 100,
            max_uses: null,
            per_user_limit: 1,
            min_order_value: 0,
            is_active: true,
            created_by: userData.id,
          })
          .select('id')
          .single();

        if (couponInsertError) {
          throw couponInsertError;
        }

        couponId = newCoupon.id;
      }

      setReferralCouponId(couponId);

      const { data: usageData, error: usageError } = await supabase
        .from('coupon_usage')
        .select('id, discount_amount, used_at')
        .eq('coupon_id', couponId)
        .order('used_at', { ascending: false });

      if (usageError) {
        throw usageError;
      }

      console.log('📊 Referral stats loaded:', {
        couponCode: code,
        couponId,
        usageCount: usageData?.length || 0,
        usageData: usageData,
      });

      const totalDiscount =
        usageData?.reduce((sum, usage) => sum + Number(usage.discount_amount || 0), 0) || 0;

      const referralInviteUses = usageData?.length || 0;

      const referralRewardCode = `REFREWARD${userData.id.slice(-8).toUpperCase()}`;
      const { data: referralRewardCoupon } = await supabase
        .from('coupons')
        .select('id, description, max_discount_value')
        .eq('code', referralRewardCode)
        .maybeSingle();

      const referralMetadata = parseReferralRewardMetadata(referralRewardCoupon?.description);
      const totalFriends =
        referralMetadata.referralCount > 0
          ? referralMetadata.referralCount
          : referralInviteUses;

      setReferralStats({
        totalFriends,
        totalDiscount,
        lastUsedAt: usageData && usageData.length > 0 ? usageData[0].used_at : null,
      });
    } catch (error) {
      console.error('Error loading referral data:', error);
      Toast.show({
        type: 'error',
        text1: 'Unable to load referral info',
        text2: 'Please try again in a moment.',
      });
    } finally {
      setReferralLoading(false);
    }
  }, [generateReferralCode, userData?.id, userData?.name]);

  // Refresh referral stats whenever the referral modal becomes visible
  useEffect(() => {
    if (showReferralModal && userData?.id) {
      loadReferralData();
    }
  }, [showReferralModal, userData?.id, loadReferralData]);

  const handleReferAndEarnPress = async () => {
    if (!userData?.id) {
      Toast.show({
        type: 'info',
        text1: 'Login Required',
        text2: 'Please log in to access referral rewards.',
      });
      handleLoginPress();
      return;
    }
    setShowReferralModal(true);
    await loadReferralData();
  };

  const handleShareReferral = async () => {
    if (!referralCode) {
      Toast.show({
        type: 'info',
        text1: 'Generating Code',
        text2: 'Please wait while we prepare your referral code.',
      });
      return;
    }

    const message = `Hey! 🎁 Shop the latest trends on Only2U and get ₹100 off your first order.\nUse my referral code: ${referralCode}\n\nDownload the app: only2u.app and apply the code at checkout.`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    const whatsappWebUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

    try {
      await Linking.openURL(whatsappUrl);
    } catch {
      try {
        await Linking.openURL(whatsappWebUrl);
      } catch {
        await Share.share({ message });
      }
    }
  };

  const handleCopyReferralCode = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    Toast.show({
      type: 'success',
      text1: 'Copied to clipboard',
      text2: 'Referral code ready to share!',
    });
  };

  const formatReferralDate = (value: string | null) => {
    if (!value) return 'No usage yet';
    try {
      const date = new Date(value);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'Recently used';
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUserData();
    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error during logout:', error);
        return;
      }

      await AsyncStorage.removeItem('userData');
      setUser(null);
      await clearWishlist();
      
      Toast.show({
        type: 'success',
        text1: 'Logged out successfully',
        text2: 'You have been logged out of your account'
      });
    } catch (error) {
      console.error('Error during logout:', error);
      Toast.show({
        type: 'error',
        text1: 'Logout Failed',
        text2: 'Please try again'
      });
    }
  };

  const handleDeleteProfile = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteProfile = async () => {
    setIsDeleting(true);
    try {
      await deleteUserProfile();
    } catch (error) {
      console.error('Error during delete profile:', error);
      // Continue anyway - we'll still clear everything
    }
    
    // Always clear everything and navigate, regardless of errors
    try {
      await clearWishlist();
      setUser(null);
      
      Toast.show({
        type: 'success',
        text1: t('profile_deleted_successfully'),
        text2: 'Your account has been deleted'
      });
    } catch (error) {
      console.error('Error during cleanup:', error);
      // Still show success and navigate
      Toast.show({
        type: 'success',
        text1: 'Profile Deleted',
        text2: 'You have been signed out'
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const cancelDeleteProfile = () => {
    setShowDeleteModal(false);
  };

  // OTP Login functions
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
          await ensureNewUserReferralCoupon(authUser.id);

          Toast.show({
            type: 'success',
            text1: 'Referral saved',
            text2: '₹100 off coupon added to your account.',
          });

          if (appliedReferralCoupon.referrerId) {
            await ensureReferrerRewardCoupon(appliedReferralCoupon.referrerId);
          }
        } catch (couponError) {
          console.error('Error syncing referral coupons:', couponError);
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

  const handleLoginPress = () => {
    console.log('Login button pressed');
    try {
      showLoginSheet();
      resetSheetState();
      console.log('Login sheet should be visible now:', isLoginSheetVisible);
    } catch (error) {
      console.error('Error showing login sheet:', error);
    }
  };

  // Profile photo upload functions
  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setPermissionModal({ visible: true, context: 'camera' });
      return false;
    }
    return true;
  };

  const requestGalleryPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setPermissionModal({ visible: true, context: 'gallery' });
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await handlePhotoUpload(result.assets[0].uri);
    }
    setShowPhotoPickerModal(false);
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestGalleryPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await handlePhotoUpload(result.assets[0].uri);
    }
    setShowPhotoPickerModal(false);
  };

  const closePermissionModal = () => setPermissionModal(prev => ({ ...prev, visible: false }));

  const openSettingsForPermissions = async () => {
    closePermissionModal();
    try {
      if (Linking.openSettings) {
        await Linking.openSettings();
      } else {
        await Linking.openURL('app-settings:');
      }
    } catch (error) {
      console.warn('Unable to open settings:', error);
    }
  };

  const removeProfilePhoto = async () => {
    if (!userData?.id || !userData?.profilePhoto) return false;

    try {
      setDeletingPhoto(true);

      const deleted = await deleteProfilePhotoFromStorage(userData.profilePhoto);
      if (!deleted) {
        throw new Error('Failed to remove photo from storage');
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ profilePhoto: null })
        .eq('id', userData.id);

      if (updateError) {
        throw updateError;
      }

      setUserData({ ...userData, profilePhoto: null });
      await refreshUserData();

      Toast.show({
        type: 'success',
        text1: 'Photo Removed',
        text2: 'Your profile photo has been deleted.',
      });

      return true;
    } catch (error) {
      console.error('Error deleting profile photo:', error);
      Toast.show({
        type: 'error',
        text1: 'Unable to Delete',
        text2: 'Something went wrong while removing your photo. Please try again.',
      });
      return false;
    } finally {
      setDeletingPhoto(false);
    }
  };

  const handleDeleteProfilePhoto = () => {
    if (!userData?.profilePhoto) {
      Toast.show({
        type: 'info',
        text1: 'No Photo Found',
        text2: 'You do not have a profile photo to remove.',
      });
      return;
    }

    setShowPhotoPickerModal(false);
    setShowDeletePhotoModal(true);
  };

  const handlePhotoUpload = async (uri: string) => {
    if (!userData?.id) {
      Toast.show({
        type: 'error',
        text1: 'Not Logged In',
        text2: 'Please log in to update your profile photo',
      });
      return;
    }

    try {
      setUploadingPhoto(true);

      // Validate the image first
      const validation = await validateImage(uri);
      if (!validation.valid) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Image',
          text2: validation.error || 'Please select a valid image file.',
        });
        return;
      }

      // Upload the image
      const result = await uploadProfilePhoto(uri);

      if (result.success && result.url) {
        // Update user profile in database
        const { error: updateError } = await supabase
          .from('users')
          .update({ profilePhoto: result.url })
          .eq('id', userData.id);

        if (updateError) {
          throw updateError;
        }

        // Refresh user data to show new photo
        await refreshUserData();

        Toast.show({
          type: 'success',
          text1: 'Photo Updated',
          text2: 'Your profile photo has been updated successfully!',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Upload Failed',
          text2: result.error || 'Failed to upload profile picture. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload Error',
        text2: 'An error occurred while uploading your picture.',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoPress = async () => {
    if (!userData?.id) {
      Toast.show({
        type: 'info',
        text1: 'Login Required',
        text2: 'Please log in to update your profile photo',
      });
      return;
    }

    if (!hasSeenPhotoTutorial) {
      setShowPhotoTutorialModal(true);
      return;
    }

    setShowPhotoPickerModal(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#F53F7A']}
            tintColor="#F53F7A"
          />
        }
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          {userData || user ? (
            <>
              <View style={styles.avatarContainer}>
                {userData?.profilePhoto ? (
                  <Image source={{ uri: userData.profilePhoto }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={40} color="#F53F7A" />
                  </View>
                )}
                {/* Camera/Edit Button */}
                <TouchableOpacity
                  style={styles.cameraButton}
                  onPress={handlePhotoPress}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="camera" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.profileTextContainer}>
                <Text style={styles.userName}>
                  {userData?.name || user?.name || 'User'}
                </Text>
                <Text style={styles.userEmail}>
                  {userData?.email || user?.email || 'No email'}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.loginPromptContainer}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Ionicons name="person-outline" size={40} color="#ccc" />
                </View>
              </View>
              <View style={styles.profileTextContainer}>
                <Text style={styles.loginPromptTitle}>Welcome to Only2U</Text>
                <Text style={styles.loginPromptSubtitle}>Login to access your profile, orders, and wishlist</Text>
                <TouchableOpacity 
                  style={styles.loginButton}
                  onPress={handleLoginPress}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="log-in-outline" size={20} color="#fff" />
                  <Text style={styles.loginButtonText}>Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Refer & Earn */}
        <TouchableOpacity
          style={styles.referCard}
          onPress={handleReferAndEarnPress}
          activeOpacity={0.85}
        >
          <View style={styles.referIconCircle}>
            <Ionicons name="gift" size={22} color="#F53F7A" />
          </View>
          <View style={styles.referTextBlock}>
            <Text style={styles.referCardTitle}>Refer & Earn</Text>
            <Text style={styles.referCardSubtitle}>
              Share your code, friends get ₹100 off
            </Text>
          </View>
          <View style={styles.referRewardPill}>
            <Ionicons name="share-social-outline" size={16} color="#F53F7A" />
            <Text style={styles.referRewardText}>Invite</Text>
          </View>
        </TouchableOpacity>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {/* New red actions */}
          <TouchableOpacity style={styles.menuItem} onPress={handleBecomeSeller}>
            <Ionicons name="storefront-outline" size={24} color="red" />
            <Text style={[styles.menuText, { color: 'red' }]}>Become a Seller</Text>
            <Ionicons name="chevron-forward" size={20} color="red" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleVendorDashboard}>
            <Ionicons name="bar-chart-outline" size={24} color="#F53F7A" />
            <Text style={[styles.menuText, { color: '#F53F7A' }]}>Vendor Dashboard</Text>
            <Ionicons name="chevron-forward" size={20} color="#F53F7A" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleJoinInfluencer}>
            <Ionicons name="megaphone-outline" size={24} color="red" />
            <Text style={[styles.menuText, { color: 'red' }]}>Join as Influencer</Text>
            <Ionicons name="chevron-forward" size={20} color="red" />
          </TouchableOpacity>

          {/* Share Products Option */}
          <TouchableOpacity style={styles.menuItem} onPress={handleShareProducts}>
            <Ionicons name="share-social" size={24} color="#4CAF50" />
            <Text style={[styles.menuText, { color: '#4CAF50' }]}>Share Products & Earn</Text>
            <Ionicons name="chevron-forward" size={20} color="#4CAF50" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleEditProfile}>
            <Ionicons name="person-outline" size={24} color="#333" />
            <Text style={styles.menuText}>{t('edit_profile')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleBodyMeasurements}>
            <Ionicons name="add-outline" size={24} color="#333" />
            <View style={styles.menuContent}>
              <Text style={styles.menuText}>{t('body_measurements')}</Text>
              <Text style={styles.menuSubtext}>
                {userData || user ? 
                  `${t('height')}: ${(userData || user)?.height || t('na')} cm, ${t('size')}: ${(userData || user)?.size || t('na')}` 
                  : t('loading')
                }
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleMyOrders}>
            <Ionicons name="bag-outline" size={24} color="#333" />
            <Text style={styles.menuText}>{t('my_orders')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleResellerEarnings}>
            <View style={styles.menuItemIconCircle}>
              <MaterialCommunityIcons name="currency-inr" size={20} color="#F53F7A" />
            </View>
            <View style={styles.menuItemTextContainer}>
              <Text style={styles.menuItemTitle}>Reseller Earnings</Text>
              <Text style={styles.menuItemSubtitle}>
                View commissions and payouts from reseller orders
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>

          {/* Admin Panel - Only visible for admin users */}
          {((userData || user)?.user_type === 'admin') && (
            <TouchableOpacity style={styles.menuItem} onPress={handleAdminPanel}>
              <Ionicons name="settings-outline" size={24} color="#FF6B35" />
              <Text style={[styles.menuText, { color: '#FF6B35' }]}>Admin Panel</Text>
              <Ionicons name="chevron-forward" size={20} color="#FF6B35" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.menuItem} onPress={handleHelpCenter}>
            <Ionicons name="help-circle-outline" size={24} color="#333" />
            <Text style={styles.menuText}>{t('help_center')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleTermsAndConditions}>
            <Ionicons name="document-text-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Terms & Conditions</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handlePrivacyPolicy}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleRefundPolicy}>
            <Ionicons name="card-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Refund Policy</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleDeleteProfile}>
            <Ionicons name="trash-outline" size={24} color="red" />
            <Text style={[styles.menuText, { color: 'red' }]}>{t('delete_profile')}</Text>
            <Ionicons name="chevron-forward" size={20} color="red" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="red" />
            <Text style={[styles.menuText, { color: 'red' }]}>{t('logout')}</Text>
            <Ionicons name="chevron-forward" size={20} color="red" />
          </TouchableOpacity>
        </View>

        {/* Contact Support Button */}
        <TouchableOpacity style={styles.supportButton} onPress={handleHelpCenter}>
          <Text style={styles.supportButtonText}>{t('contact_support')}</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Only2U v1.0.2</Text>
          <Text style={styles.footerText}>© 2025 Only2U Fashion Private Limited</Text>
        </View>
      </ScrollView>

      {/* Referral Modal */}
      <Modal
        visible={showReferralModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReferralModal(false)}
      >
        <View style={styles.referralOverlay}>
          <View style={styles.referralContainer}>
            <View style={styles.referralHeader}>
              <View style={styles.referralHeaderIcon}>
                <Ionicons name="sparkles-outline" size={22} color="#F53F7A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.referralTitle}>Invite & Earn</Text>
                <Text style={styles.referralSubtitle}>Friends get ₹100 off on their first order</Text>
              </View>
              <TouchableOpacity onPress={() => setShowReferralModal(false)}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {referralLoading ? (
              <View style={styles.referralLoading}>
                <ActivityIndicator size="large" color="#F53F7A" />
                <Text style={styles.referralLoadingText}>Preparing your invite...</Text>
              </View>
            ) : (
              <>
                <View style={styles.referralCodeCard}>
                  <View>
                    <Text style={styles.referralCodeLabel}>Your code</Text>
                    <Text style={styles.referralCodeValue}>{referralCode || '— — —'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={handleCopyReferralCode}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="copy-outline" size={18} color="#F53F7A" />
                    <Text style={styles.copyButtonText}>Copy</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.referralStatsContainer}>
                  <View style={styles.referralStat}>
                    <Text style={styles.referralStatValue}>{referralStats.totalFriends}</Text>
                    <Text style={styles.referralStatLabel}>Friends Joined</Text>
                  </View>
                  <View style={styles.referralStat}>
                    <Text style={styles.referralStatValue}>₹{referralStats.totalDiscount.toFixed(0)}</Text>
                    <Text style={styles.referralStatLabel}>Total Savings Shared</Text>
                  </View>
                  <View style={styles.referralStat}>
                    <Text style={styles.referralStatValue}>
                      {formatReferralDate(referralStats.lastUsedAt)}
                    </Text>
                    <Text style={styles.referralStatLabel}>Last used</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.whatsappButton}
                  onPress={handleShareReferral}
                  activeOpacity={0.85}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                  <Text style={styles.whatsappButtonText}>Share on WhatsApp</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelDeleteProfile}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={32} color="#FF6B6B" />
              <Text style={styles.modalTitle}>{t('delete_profile')}</Text>
            </View>
            
            <Text style={styles.modalMessage}>
              {t('delete_profile_confirm')}
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cancelDeleteProfile}
                disabled={isDeleting}
              >
                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.deleteButton,
                  isDeleting && styles.disabledButton
                ]}
                onPress={confirmDeleteProfile}
                disabled={isDeleting}
              >
                <Text style={styles.deleteButtonText}>
                  {isDeleting ? t('processing') : t('delete')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* OTP Login Modal */}
      <Modal visible={isLoginSheetVisible} transparent animationType="slide" onRequestClose={() => { hideLoginSheet(); resetSheetState(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, maxHeight: '78%' }}>
              <View style={{ alignItems: 'center', marginBottom: 10 }}>
                <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: '#D6D6D6' }} />
              </View>

              {/* Title + subtitle */}
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#1f1f1f' }}>Welcome back</Text>
                <Text style={{ marginTop: 4, color: '#666', fontWeight: '500' }}>Login to track orders, wishlist, and get offers</Text>
              </View>

              <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={{ paddingBottom: 8 }}>
                {/* Perks */}
                <View style={{ flexDirection: 'row', marginTop: 6, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name='shield-checkmark-outline' size={16} color='#2e7d32' />
                    <Text style={{ marginLeft: 6, color: '#333', fontSize: 12, fontWeight: '600' }}>Secure OTP</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name='heart-outline' size={16} color='#F53F7A' />
                    <Text style={{ marginLeft: 6, color: '#333', fontSize: 12, fontWeight: '600' }}>Save Wishlist</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name='pricetag-outline' size={16} color='#6a5acd' />
                    <Text style={{ marginLeft: 6, color: '#333', fontSize: 12, fontWeight: '600' }}>Exclusive Offers</Text>
                  </View>
                </View>

                {/* Phone input */}
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: '700', letterSpacing: 0.2 }}>Enter your mobile number</Text>
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
                    placeholder='9876543210'
                    placeholderTextColor='#999'
                    style={{ flex: 1, fontSize: 16, color: '#111' }}
                    keyboardType='phone-pad'
                    returnKeyType='done'
                    maxLength={15}
                  />
                </View>

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
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{sending ? 'Sending...' : 'Send OTP'}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#666' }}>{resendIn > 0 ? `Resend in ${resendIn}s` : 'You can resend now'}</Text>
                    <TouchableOpacity disabled={resendIn > 0} onPress={handleSendOtp}>
                      <Text style={{ color: resendIn > 0 ? '#AAA' : '#F53F7A', fontWeight: '800' }}>Resend OTP</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* OTP input + Verify CTA */}
                {otpSent && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: '700' }}>Enter OTP</Text>
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
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{verifying ? 'Verifying...' : 'Verify & Continue'}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!!error && (
                  <View style={{ marginTop: 12, backgroundColor: '#FFF0F3', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FFD6DF' }}>
                    <Text style={{ color: '#B00020', fontWeight: '900' }}>Error</Text>
                    <Text style={{ color: '#B00020', marginTop: 4 }}>{error}</Text>
                  </View>
                )}

                {/* Secondary CTAs */}
                <View style={{ marginTop: 16 }}>
                  <TouchableOpacity onPress={() => { hideLoginSheet(); resetSheetState(); }} style={{ alignItems: 'center', paddingVertical: 10 }}>
                    <Text style={{ color: '#6B7280', fontWeight: '800' }}>Continue as Guest</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Onboarding Modal */}
      <Modal visible={showOnboarding} transparent animationType="slide" onRequestClose={() => setShowOnboarding(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, maxHeight: '82%' }}>
              <View style={{ alignItems: 'center', marginBottom: 10 }}>
                <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: '#D6D6D6' }} />
              </View>

              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#1f1f1f' }}>Your name</Text>
                <Text style={{ marginTop: 4, color: '#666', fontWeight: '500' }}>Enter your name to continue</Text>
              </View>

              <View style={{ maxHeight: '70%' }}>
                <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={{ paddingBottom: 20 }}>
                  <View style={{ backgroundColor: '#F4F5F7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'android' ? 8 : 10, borderWidth: 1, borderColor: '#EAECF0' }}>
                    <TextInput value={name} onChangeText={setName} placeholder='John Doe' placeholderTextColor='#999' style={{ fontSize: 16, color: '#111' }} />
                  </View>

                  {!!error && (
                    <View style={{ marginTop: 12, backgroundColor: '#FFF0F3', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FFD6DF' }}>
                      <Text style={{ color: '#B00020', fontWeight: '900' }}>Error</Text>
                      <Text style={{ color: '#B00020', marginTop: 4 }}>{error}</Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
                    <TouchableOpacity disabled={creatingProfile} onPress={handleCreateProfile} style={{ backgroundColor: creatingProfile ? '#F7A3BD' : '#111827', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
                      <Text style={{ color: '#fff', fontWeight: '800' }}>{creatingProfile ? 'Saving...' : 'Save'}</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={() => setShowOnboarding(false)} style={{ alignItems: 'center', paddingVertical: 10 }}>
                    <Text style={{ color: '#6B7280', fontWeight: '800' }}>Skip for now</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Photo Picker Modal */}
      <Modal
        visible={showPhotoTutorialModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoTutorialModal(false)}
      >
        <View style={styles.photoTutorialOverlay}>
          <View style={styles.photoTutorialCard}>
            <View style={styles.photoTutorialHeader}>
              <View style={styles.photoTutorialIcon}>
                <Ionicons name="sparkles-outline" size={22} color="#F53F7A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoTutorialTitle}>Perfect Profile Photo Tips</Text>
                <Text style={styles.photoTutorialSubtitle}>
                  Follow these simple steps for a clear, beautiful profile picture.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowPhotoTutorialModal(false)}>
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.photoTutorialVideoWrapper}>
              <Video
                source={{ uri: PROFILE_PHOTO_TUTORIAL_VIDEO }}
                style={styles.photoTutorialVideo}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                useNativeControls
                isLooping
              />
            </View>

            <Text style={styles.photoTutorialDescription}>
              Use good lighting, keep your face centered, and avoid heavy filters. This helps us
              match you with the right products and virtual try-ons.
            </Text>

            <TouchableOpacity
              style={styles.photoTutorialCheckboxRow}
              onPress={() => setPhotoTutorialDontShowAgain(!photoTutorialDontShowAgain)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.photoTutorialCheckbox,
                  photoTutorialDontShowAgain && styles.photoTutorialCheckboxChecked,
                ]}
              >
                {photoTutorialDontShowAgain && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </View>
              <Text style={styles.photoTutorialCheckboxText}>Do not show again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoTutorialPrimaryBtn}
              onPress={async () => {
                try {
                  if (photoTutorialDontShowAgain) {
                    await AsyncStorage.setItem(PROFILE_PHOTO_TUTORIAL_KEY, 'true');
                    setHasSeenPhotoTutorial(true);
                  }
                } catch (error) {
                  console.warn('Failed to save tutorial preference', error);
                } finally {
                  setShowPhotoTutorialModal(false);
                  setPhotoTutorialDontShowAgain(false);
                  setTimeout(() => setShowPhotoPickerModal(true), 200);
                }
              }}
            >
              <Text style={styles.photoTutorialPrimaryText}>Start Upload</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPhotoPickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhotoPickerModal(false)}
      >
        <View style={styles.photoPickerOverlay}>
          <TouchableOpacity 
            style={styles.photoPickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowPhotoPickerModal(false)}
          />
          <View style={styles.photoPickerContent}>
            {/* Drag Handle */}
            <View style={styles.dragHandle} />
            
            <View style={styles.photoPickerHeader}>
              <Text style={styles.photoPickerTitle}>Update Profile Photo</Text>
              <Text style={styles.photoPickerSubtitle}>Choose how you want to upload your photo</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.photoPickerOption}
              onPress={takePhoto}
              activeOpacity={0.7}
            >
              <View style={styles.photoPickerOptionIcon}>
                <Ionicons name="camera" size={24} color="#fff" />
              </View>
              <View style={styles.photoPickerOptionTextContainer}>
                <Text style={styles.photoPickerOptionTitle}>Take Photo</Text>
                <Text style={styles.photoPickerOptionSubtitle}>Use camera to capture a new photo</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.photoPickerOption}
              onPress={pickFromGallery}
              activeOpacity={0.7}
            >
              <View style={styles.photoPickerOptionIcon}>
                <Ionicons name="images" size={24} color="#fff" />
              </View>
              <View style={styles.photoPickerOptionTextContainer}>
                <Text style={styles.photoPickerOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.photoPickerOptionSubtitle}>Select from your photo library</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            {userData?.profilePhoto && (
              <TouchableOpacity 
                style={styles.photoPickerOption}
                onPress={handleDeleteProfilePhoto}
                activeOpacity={0.7}
                disabled={deletingPhoto}
              >
                <View style={styles.photoPickerOptionIcon}>
                  <Ionicons name="trash" size={24} color="#fff" />
                </View>
                <View style={styles.photoPickerOptionTextContainer}>
                  <Text style={styles.photoPickerOptionTitle}>
                    {deletingPhoto ? 'Removing...' : 'Remove Photo'}
                  </Text>
                  <Text style={styles.photoPickerOptionSubtitle}>
                    Revert to your default avatar
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#F53F7A" />
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowPhotoPickerModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={permissionModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closePermissionModal}
      >
        <View style={styles.permissionOverlay}>
          <View style={styles.permissionModal}>
            <View style={styles.permissionIconCircle}>
              <Ionicons
                name={permissionModal.context === 'camera' ? 'camera' : 'images'}
                size={28}
                color="#F53F7A"
              />
            </View>
            <Text style={styles.permissionTitle}>
              {permissionModal.context === 'camera'
                ? 'Camera Access Needed'
                : 'Photo Library Access Needed'}
            </Text>
            <Text style={styles.permissionBody}>
              {permissionModal.context === 'camera'
                ? 'Allow Only2U to use your camera to capture a fresh profile photo.'
                : 'Allow Only2U to access your library so you can pick a profile photo.'}
            </Text>
            <View style={styles.permissionActions}>
              <TouchableOpacity
                style={styles.permissionSecondaryButton}
                onPress={closePermissionModal}
                activeOpacity={0.8}
              >
                <Text style={styles.permissionSecondaryText}>Not Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.permissionPrimaryButton}
                onPress={openSettingsForPermissions}
                activeOpacity={0.8}
              >
                <Ionicons name="settings" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.permissionPrimaryText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeletePhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingPhoto) setShowDeletePhotoModal(false);
        }}
      >
        <View style={styles.permissionOverlay}>
          <View style={styles.permissionModal}>
            <View style={[styles.permissionIconCircle, { backgroundColor: '#FEE2F2' }]}>
              <Ionicons name="trash" size={26} color="#F53F7A" />
            </View>
            <Text style={styles.permissionTitle}>Remove Profile Photo?</Text>
            <Text style={styles.permissionBody}>
              This will reset your avatar to the default placeholder. You can upload a new photo anytime.
            </Text>
            <View style={styles.permissionActions}>
              <TouchableOpacity
                style={styles.permissionSecondaryButton}
                onPress={() => {
                  if (!deletingPhoto) setShowDeletePhotoModal(false);
                }}
                activeOpacity={0.8}
                disabled={deletingPhoto}
              >
                <Text style={styles.permissionSecondaryText}>Keep Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.permissionPrimaryButton}
                onPress={async () => {
                  if (deletingPhoto) return;
                  const success = await removeProfilePhoto();
                  if (success) {
                    setShowDeletePhotoModal(false);
                  }
                }}
                activeOpacity={0.8}
                disabled={deletingPhoto}
              >
                {deletingPhoto ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.permissionPrimaryText}>Remove Photo</Text>
                  </>
                )}
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    // justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 24,
    marginBottom: 1,
  },
  avatarContainer: {
    marginRight: 20,
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 50,
    backgroundColor: '#FFE8F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F53F7A',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#F53F7A',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F53F7A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  profileTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
    textAlign: 'left',
  },
  userEmail: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'left',
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
  },
  verificationText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 4,
  },
  menuContainer: {
    backgroundColor: '#fff',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
    flex: 1,
  },
  menuContent: {
    marginLeft: 16,
    flex: 1,
  },
  menuSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  supportButton: {
    backgroundColor: '#F53F7A',
    marginHorizontal: 16,
    marginVertical: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  supportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6B6B',
    marginTop: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  deleteButton: {
    backgroundColor: '#F53F7A',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Login prompt styles
  loginPromptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 24,
    marginBottom: 1,
  },
  loginPromptTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
    textAlign: 'left',
  },
  loginPromptSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'left',
    marginBottom: 16,
  },
  referCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: '#FFF7FB',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#FFE4EF',
  },
  referIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE1EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  referTextBlock: {
    flex: 1,
  },
  referCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  referCardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  referRewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FECFE3',
  },
  referRewardText: {
    color: '#F53F7A',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F53F7A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Photo Picker Modal styles
  photoPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  photoPickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  photoPickerContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  photoPickerHeader: {
    marginBottom: 24,
  },
  photoPickerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  photoPickerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  photoPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  photoPickerOptionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F53F7A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  photoPickerOptionTextContainer: {
    flex: 1,
  },
  photoPickerOptionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
    marginBottom: 3,
  },
  photoPickerOptionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  photoTutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  photoTutorialCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
  photoTutorialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  photoTutorialIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFE3EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoTutorialTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  photoTutorialSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  photoTutorialVideoWrapper: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 12,
  },
  photoTutorialVideo: {
    width: '100%',
    height: '100%',
  },
  photoTutorialDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  photoTutorialCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  photoTutorialCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#F53F7A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  photoTutorialCheckboxChecked: {
    backgroundColor: '#F53F7A',
  },
  photoTutorialCheckboxText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  photoTutorialPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F53F7A',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  photoTutorialPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  permissionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  permissionModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 12,
  },
  permissionIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },
  permissionBody: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  permissionSecondaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  permissionPrimaryButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#F53F7A',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  permissionPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  referralOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  referralContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  referralHeaderIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFE7F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  referralSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  referralLoading: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  referralLoadingText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  referralCodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#FBCFE8',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF8FB',
    marginBottom: 16,
  },
  referralCodeLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  referralCodeValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F53F7A',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FECFE3',
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  copyButtonText: {
    color: '#F53F7A',
    fontWeight: '700',
    fontSize: 12,
  },
  referralStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  referralStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    backgroundColor: '#FDF2F8',
  },
  referralStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  referralStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    borderRadius: 16,
    paddingVertical: 14,
  },
  whatsappButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default Profile;
