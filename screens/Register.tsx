import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import {
  isValidEmail,
  validatePassword,
  showErrorToast,
} from '../utils/errorHandler';
import { supabase } from '../utils/supabase';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ProfilePictureUpload: {
    userData: {
      fullName: string;
      email: string;
      password: string;
      phone: string;
      countryCode: string;
      location: string;
      role: 'owner' | 'cleaner';
    };
  };
  TabNavigator: undefined;
  PrivacyPolicy: undefined;
  TermsAndConditions: undefined;
  RefundPolicy: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const Register = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToPolicies, setAgreedToPolicies] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const navigation = useNavigation<NavigationProp>();

  const validateForm = () => {
    // Check for empty fields
    if (!fullName?.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Missing Information',
        text2: 'Please enter your full name.',
      });
      return false;
    }

    if (!email?.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Missing Information',
        text2: 'Please enter your email address.',
      });
      return false;
    }

    // Enhanced email validation
    if (!isValidEmail(email)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Email',
        text2: 'Please enter a valid email address.',
      });
      return false;
    }

    if (!password?.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Missing Information',
        text2: 'Please create a password.',
      });
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    if (!agreedToPolicies) {
      Toast.show({
        type: 'error',
        text1: 'Policy Agreement Required',
        text2: 'Please agree to our policies before creating your account.',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Sign up with email and password
      const { data, error } = await supabase.auth.signUp({
        email: email?.trim().toLowerCase() || '',
        password: password,
        options: {
          data: {
            full_name: fullName?.trim() || '',
          },
        },
      });

      if (error) {
        showErrorToast(error, 'Registration');
        return;
      }

      if (data.user && !data.user.email_confirmed_at) {
        // Email confirmation required
        Toast.show({
          type: 'success',
          text1: 'Registration Successful',
          text2: 'Please check your email to verify your account.',
        });
        
        // Navigate to profile picture upload
        navigation.navigate('ProfilePictureUpload', {
          userData: {
            fullName: fullName?.trim() || '',
            email: email?.trim().toLowerCase() || '',
            password,
            phone: '',
            countryCode: '+1',
            location: '',
            role: 'owner',
          },
        });
      } else {
        // Email already confirmed or no confirmation required
        // Toast.show({
        //   type: 'success',
        //   text1: 'Registration Successful',
        //   text2: 'Your account has been created successfully.',
        // });
        
        navigation.navigate('ProfilePictureUpload', {
          userData: {
            fullName: fullName?.trim() || '',
            email: email?.trim().toLowerCase() || '',
            password,
            phone: '',
            countryCode: '+1',
            location: '',
            role: 'owner',
          },
        });
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Registration Failed',
        text2: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>Only<Text style={{ color: '#F53F7A' }}>2</Text>U</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.contentContainer}
        contentContainerStyle={{ justifyContent: 'center', flex: 1 }}
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={true}
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.logoHeading}>Only<Text style={{ color: '#F53F7A' }}>2</Text>U</Text>
          <Text style={styles.subtitle}>Create your account</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="person-outline" size={20} color="#666" style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0 }]}
                placeholder="Enter your full name"
                value={fullName}
                onChangeText={setFullName}
                placeholderTextColor="#666"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="mail-outline" size={20} color="#666" style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0 }]}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                placeholderTextColor="#666"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0 }]}
                placeholder="Create a password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                placeholderTextColor="#666"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            {/* <Text style={styles.passwordHint}>
              Password must be at least 6 characters long with one lowercase, one uppercase, and
              one number.
            </Text> */}
          </View>

          {/* Policies Agreement Row */}
          <View style={styles.termsRowCustom}>
            <TouchableOpacity
              style={styles.radioOuter}
              onPress={() => setAgreedToPolicies(a => !a)}
              activeOpacity={0.7}
            >
              <View style={[styles.radioCircle, agreedToPolicies && styles.radioCircleChecked]}>
                {agreedToPolicies ? <View style={styles.radioDot} /> : null}
              </View>
            </TouchableOpacity>
            <Text style={styles.termsTextCustom}>
              I agree to the{' '}
              <Text
                style={styles.termsLinkCustom}
                onPress={() => {
                  setShowTerms(false);
                  navigation.navigate('TermsAndConditions');
                }}
              >
                Terms & Conditions
              </Text>
              ,{' '}
              <Text
                style={styles.termsLinkCustom}
                onPress={() => {
                  setShowPrivacy(false);
                  navigation.navigate('PrivacyPolicy');
                }}
              >
                Privacy Policy
              </Text>
              , and{' '}
              <Text
                style={styles.termsLinkCustom}
                onPress={() => {
                  setShowRefund(false);
                  navigation.navigate('RefundPolicy');
                }}
              >
                Refund Policy
              </Text>
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.createButton, (isLoading || !agreedToPolicies) && styles.createButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading || !fullName?.trim() || !email?.trim() || !password?.trim() || !agreedToPolicies}
          >
            {isLoading ? (
              <Text style={styles.createButtonText}>Creating Account...</Text>
            ) : !agreedToPolicies ? (
              <Text style={styles.createButtonText}>Create Account</Text>
            ) : (
              <>
                <Text style={styles.createButtonText}>Create Account</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      {/* Policy Navigation Handlers */}
      {showTerms && (
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={() => setShowTerms(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'transparent' }} />
        </TouchableOpacity>
      )}
      {showPrivacy && (
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={() => setShowPrivacy(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'transparent' }} />
        </TouchableOpacity>
      )}
      {showRefund && (
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={() => setShowRefund(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'transparent' }} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
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
    color: '#000',
    backgroundColor: '#fff',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 30,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 24,
    marginBottom: 20,
  },
  logoHeading: {
    color: '#333',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    color: '#333',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
    minWidth: 80,
  },
  countryCodeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingRight: 12,
    backgroundColor: '#F8F8F8',
  },
  passwordHint: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
    padding: 8,
    borderRadius: 8,
  },
  roleOptionActive: {
    backgroundColor: '#F53F7A',
  },
  roleText: {
    marginLeft: 6,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  termsText: {
    color: '#666',
    fontSize: 13,
    flex: 1,
  },
  termsLink: {
    color: '#F53F7A',
    textDecorationLine: 'underline',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F53F7A',
    borderRadius: 16,
    paddingVertical: 12,
    marginBottom: 18,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3DF45B',
    borderRadius: 40,
    paddingVertical: 12,
    marginBottom: 18,
  },
  retryButtonText: {
    color: '#3DF45B',
    fontSize: 16,
    fontWeight: '600',
  },
  networkErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  networkErrorText: {
    flex: 1,
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '500',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginText: {
    color: '#666',
    fontSize: 15,
  },
  loginLink: {
    color: '#F53F7A',
    fontWeight: '600',
    fontSize: 15,
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
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 5,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  countryFlag: {
    fontSize: 24,
    marginRight: 15,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: '#23272F',
  },
  countryCode: {
    fontSize: 16,
    color: '#23272F',
    fontWeight: '500',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  termsRowCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    marginTop: 2,
  },
  radioOuter: {
    marginRight: 12,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  radioCircleChecked: {
    borderColor: '#F53F7A',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F53F7A',
  },
  termsTextCustom: {
    fontSize: 15,
    color: '#444B54',
    fontWeight: '500',
  },
  termsLinkCustom: {
    color: '#F53F7A',
    fontWeight: '500',
    fontSize: 15,
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
});

export default Register;
