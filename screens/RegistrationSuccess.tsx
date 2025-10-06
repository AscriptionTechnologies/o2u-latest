import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../utils/supabase';
import { useAuth } from '~/contexts/useAuth';
import { useUser, UserData } from '~/contexts/UserContext';
import Toast from 'react-native-toast-message';
import {
  showErrorToast,
  showSuccessToast,
  isOnline
} from '../utils/errorHandler';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

type RootStackParamList = {
  RegistrationSuccess: {
    userData: {
      fullName: string;
      email: string;
      password: string;
      phone: string;
      countryCode: string;
      location: string;
      role: 'owner' | 'cleaner';
      profilePhoto?: string;
      size: string;
      skinTone: string;
      bustSize: number;
      waistSize: number;
      hipSize: number;
    };
  };
  TabNavigator: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const RegistrationSuccess = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { setUser } = useAuth();
  const { setUserData } = useUser();
  const { userData } = route.params as { userData: any };
  
  const [loading, setLoading] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    createAccount();
  }, []);

  const createAccount = async () => {
    setLoading(true);

    try {
      // First, check if the user already exists in Supabase auth
      console.log('[REGISTER] 🔍 Checking if user already exists...');
      
      // Try to sign in to check if user exists
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.email.trim().toLowerCase(),
        password: userData.password
      });

      let userId: string;

      if (signInError) {
        // User doesn't exist, create new auth user
        if (signInError.message.includes('Invalid login credentials')) {
          console.log('[REGISTER] 📡 User does not exist, creating new auth user...');
          const { data, error } = await supabase.auth.signUp({
            email: userData.email.trim().toLowerCase(),
            password: userData.password
          });

          console.log('[REGISTER] 📡 Supabase signup response:', { data, error });

          if (error) {
            console.error('[REGISTER] ❌ Supabase Auth error:', error);
            
            if (error.message.includes('already registered')) {
              Toast.show({
                type: 'error',
                text1: 'Email Already Registered',
                text2: 'This email is already registered. Please try logging in instead.',
              });
            } else {
              showErrorToast(error, 'Registration');
            }
            return;
          }

          if (!data.user) {
            console.error('[REGISTER] ❌ No user returned:', { data });
            Toast.show({
              type: 'error',
              text1: 'Registration Failed',
              text2: 'User account could not be created. Please try again.',
            });
            return;
          }

          userId = data.user.id;
          console.log('[REGISTER] ✅ New Supabase user created:', userId);
        } else {
          // Other error occurred
          console.error('[REGISTER] ❌ Sign in check failed:', signInError);
          showErrorToast(signInError, 'Registration');
          return;
        }
      } else {
        // User already exists, use their ID
        userId = signInData.user!.id;
        console.log('[REGISTER] ✅ User already exists in auth, using ID:', userId);
        
        // Sign out since we just signed in to check
        await supabase.auth.signOut();
      }

      // Create user profile with all collected information
      const measurements = userData.bustSize > 0 
        ? `Bust: ${userData.bustSize}in, Waist: ${userData.waistSize}in, Hip: ${userData.hipSize}in`
        : 'Measurements not provided';

      const userObject = {
        id: userId,
        email: userData.email?.trim().toLowerCase() || '',
        name: userData.fullName?.trim() || '',
        role: 'user',
        size: userData.size,
        skinTone: userData.skinTone,
        bustSize: userData.bustSize,
        waistSize: userData.waistSize,
        hipSize: userData.hipSize,
        location: userData.location?.trim() || '',
        bio: `Size: ${userData.size}, Skin Tone: ${userData.skinTone}, ${measurements}`,
        phone: `${userData.countryCode}${userData.phone}`,
        profilePhoto: userData.profilePhoto,
        created_at: new Date().toISOString(),
        payment_method: '',
        latitude: 40,
        longitude: 40,
        search_radius: 10,
        is_active: true,
      };

      console.log('[REGISTER] 🧾 Inserting user profile into "users" table:', userObject);

      const { error: userError } = await supabase.from('users').insert(userObject);

      if (userError) {
        console.error('[REGISTER] ❌ User insertion failed:', userError);
        
        // Check if it's a duplicate key error (user profile already exists)
        if (userError.message.includes('duplicate key') || userError.message.includes('already exists')) {
          console.log('[REGISTER] ℹ️ User profile already exists, proceeding...');
          // Continue with the flow even if profile already exists
        } else {
          showErrorToast(userError, 'Profile Creation');
          return;
        }
      }

      // Create a UserData object for the context (with proper field mapping)
      const userDataForContext: UserData = {
        id: userId,
        name: userData.fullName?.trim() || '',
        email: userData.email?.trim().toLowerCase() || '',
        phone: `${userData.countryCode}${userData.phone}`,
        dateOfBirth: '', // Will be set later
        gender: 'prefer_not_to_say', // Default value
        profilePhoto: userData.profilePhoto,
        role: 'user',
        location: userData.location?.trim() || '',
        bustSize: userData.bustSize,
        waistSize: userData.waistSize,
        hipSize: userData.hipSize,
        height: '',
        weight: '',
        size: userData.size,
        preferredCurrency: 'USD', // Default value
        emailVerified: false,
        phoneVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      AsyncStorage.setItem('userData', JSON.stringify(userDataForContext));

      console.log('[REGISTER] ✅ User profile created successfully in Supabase');

      setUser(userObject);
      setUserData(userDataForContext);
      setAccountCreated(true);

      showSuccessToast(
        'Registration Successful!',
        `${userData?.fullName}, Welcome to Only2U! Your account has been created.`
      );

    } catch (error: any) {
      console.error('[REGISTER] ❌ Unexpected error in try/catch:', error);
      showErrorToast(error, 'Registration');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    navigation.replace('TabNavigator');
  };

  return (
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Only<Text style={{ color: '#F53F7A' }}>2</Text>U</Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <View style={styles.card}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <View style={styles.loadingSpinner}>
                  <Ionicons name="hourglass-outline" size={48} color="#F53F7A" />
                </View>
                <Text style={styles.loadingTitle}>{t('creating_your_account')}</Text>
                <Text style={styles.loadingSubtitle}>
                  {t('please_wait_while_we_set_up_your_personalized_profile')}
                </Text>
              </View>
            ) : accountCreated ? (
              <View style={styles.successContainer}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
                </View>
                <Text style={styles.successTitle}>{t('all_set')}</Text>
                <Text style={styles.successSubtitle}>
                  {t('your_account_has_been_created_successfully')}
                </Text>

                <View style={styles.summaryContainer}>
                  <Text style={styles.summaryTitle}>{t('your_profile_summary')}:</Text>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>{t('name')}:</Text>
                    <Text style={styles.summaryValue}>{userData.fullName}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>{t('size')}:</Text>
                    <Text style={styles.summaryValue}>{userData.size}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>{t('skin_tone')}:</Text>
                    <Text style={styles.summaryValue}>{userData.skinTone}</Text>
                  </View>
                  {userData.bustSize > 0 && (
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>{t('measurements')}:</Text>
                      <Text style={styles.summaryValue}>
                        {userData.bustSize}"-{userData.waistSize}"-{userData.hipSize}"
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity 
                  style={styles.continueButton}
                  onPress={handleContinue}
                >
                  <Text style={styles.continueButtonText}>{t('continue_to_app')}</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.errorContainer}>
                <View style={styles.errorIcon}>
                  <Ionicons name="alert-circle" size={80} color="#FF6B6B" />
                </View>
                <Text style={styles.errorTitle}>{t('registration_failed')}</Text>
                <Text style={styles.errorSubtitle}>
                  {t('something_went_wrong_while_creating_your_account')}
                </Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={createAccount}
                >
                  <Text style={styles.retryButtonText}>{t('try_again')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F53F7A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'black',
    backgroundColor: '#fff',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 30,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingSpinner: {
    marginBottom: 24,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  successContainer: {
    alignItems: 'center',
    width: '100%',
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  summaryContainer: {
    width: '100%',
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F53F7A',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    gap: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorContainer: {
    alignItems: 'center',
  },
  errorIcon: {
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default RegistrationSuccess;
