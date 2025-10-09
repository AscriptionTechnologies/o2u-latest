import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUser } from '~/contexts/UserContext';
import { useAuth } from '~/contexts/useAuth';
import { useWishlist } from '~/contexts/WishlistContext';
import { useLoginSheet } from '~/contexts/LoginSheetContext';
import { supabase } from '~/utils/supabase';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import { uploadProfilePhoto, validateImage } from '~/utils/profilePhotoUpload';

type RootStackParamList = {
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
  RefundPolicy: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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


  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile' as never);
  };

  const handleMyOrders = () => {
    navigation.navigate('MyOrders' as never);
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
      setShowOnboarding(false);
      setName('');
    } catch (e: any) {
      setError(e?.message || 'Failed to create profile');
    } finally {
      setCreatingProfile(false);
    }
  };

  const handleLoginPress = () => {
    showLoginSheet();
    resetSheetState();
  };

  // Profile photo upload functions
  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please grant camera permissions to take a profile picture.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const requestGalleryPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Gallery Permission Required',
        'Please grant gallery permissions to select a profile picture.',
        [{ text: 'OK' }]
      );
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

  const handlePhotoPress = () => {
    if (!userData?.id) {
      Toast.show({
        type: 'info',
        text1: 'Login Required',
        text2: 'Please log in to update your profile photo',
      });
      return;
    }
    setShowPhotoPickerModal(true);
  };

  return (
    <View style={styles.container}>
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
                >
                  <Ionicons name="log-in-outline" size={20} color="#fff" />
                  <Text style={styles.loginButtonText}>Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {/* New red actions */}
          <TouchableOpacity style={styles.menuItem} onPress={handleBecomeSeller}>
            <Ionicons name="storefront-outline" size={24} color="red" />
            <Text style={[styles.menuText, { color: 'red' }]}>Become a Seller</Text>
            <Ionicons name="chevron-forward" size={20} color="red" />
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
          <Text style={styles.footerText}>© 2025 Only2U Fashion</Text>
        </View>
      </ScrollView>

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
    </View>
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
});

export default Profile;
