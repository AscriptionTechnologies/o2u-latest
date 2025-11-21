import { useState, useEffect, useRef } from 'react';
import {
  Text,
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/useAuth';
import { Only2ULogo } from '../components/common';

const Login = () => {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation: any = useNavigation();
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSendOtp = async () => {
    setLoading(true);
    setError(null);

    const trimmedPhone = phone.replace(/\D/g, '');
    if (!trimmedPhone || trimmedPhone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      setLoading(false);
      return;
    }
    
    const fullPhone = `${countryCode}${trimmedPhone}`;
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    if (error) {
      setError(error.message);
      Toast.show({ type: 'error', text1: 'Failed to send OTP', text2: error.message });
      setLoading(false);
      return;
    }
    
    setIsOtpSent(true);
    Toast.show({ 
      type: 'success', 
      text1: 'OTP Sent Successfully', 
      text2: `Verification code sent to ${fullPhone}` 
    });
    setResendTimer(30);
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError(null);
    
    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      setLoading(false);
      return;
    }
    
    const trimmedPhone = phone.replace(/\D/g, '');
    const fullPhone = `${countryCode}${trimmedPhone}`;
    
    const { data, error } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: otp.trim(),
      type: 'sms',
    });
    
    if (error) {
      setError(error.message);
      Toast.show({ type: 'error', text1: 'Verification Failed', text2: error.message });
      setLoading(false);
      return;
    }
    
    Toast.show({ 
      type: 'success', 
      text1: 'Login Successful', 
      text2: 'Welcome to Only2U!' 
    });
    setLoading(false);
    
    // Auth context will handle user profile creation and navigation automatically
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || loading) return;
    await handleSendOtp();
  };

  useEffect(() => {
    if (!isOtpSent || resendTimer <= 0) return;
    const id = setInterval(() => setResendTimer((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [isOtpSent, resendTimer]);

  // Navigation is now handled by AuthFlowScreen automatically

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#F53F7A" />
      <LinearGradient
        colors={['#FF6EA6', '#F53F7A', '#E91E63']}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <SafeAreaView style={styles.safeArea}>
            <ScrollView 
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header Section */}
              <Animated.View 
                style={[
                  styles.headerSection,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  }
                ]}
              >
                <View style={styles.logoContainer}>
                  <View style={styles.logoCircle}>
                    <Text style={styles.logoText}>
                      <Only2ULogo size="large" />
                    </Text>
                  </View>
                </View>
                
                <View style={styles.headerTextContainer}>
                  <Text style={styles.welcomeTitle}>Welcome Back!</Text>
                  <Text style={styles.welcomeSubtitle}>
                    Sign in with your phone number to continue
                  </Text>
                </View>
              </Animated.View>

              {/* Form Section */}
              <Animated.View 
                style={[
                  styles.formSection,
                  {
                    opacity: fadeAnim,
                    transform: [
                      { translateY: slideAnim },
                      { scale: scaleAnim }
                    ],
                  }
                ]}
              >
                <View style={styles.formCard}>
                  <Text style={styles.formTitle}>
                    {!isOtpSent ? 'Enter Phone Number' : 'Verify OTP'}
                  </Text>
                  
                  {!isOtpSent ? (
                    <View style={styles.phoneSection}>
                      <Text style={styles.inputLabel}>Mobile Number</Text>
                      <View style={styles.phoneInputContainer}>
                        <View style={styles.countryCodeContainer}>
                          <Text style={styles.countryCodeText}>{countryCode}</Text>
                          <Ionicons name="chevron-down" size={16} color="#666" />
                        </View>
                        <View style={styles.phoneDivider} />
                        <TextInput
                          style={styles.phoneInput}
                          placeholder="Enter 10-digit number"
                          value={phone}
                          onChangeText={setPhone}
                          keyboardType="phone-pad"
                          maxLength={10}
                          placeholderTextColor="#999"
                        />
                      </View>
                      <Text style={styles.helperText}>
                        We'll send a 6-digit verification code
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.otpSection}>
                      <Text style={styles.inputLabel}>Verification Code</Text>
                      <TextInput
                        style={styles.otpInput}
                        placeholder="Enter 6-digit OTP"
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholderTextColor="#999"
                        textAlign="center"
                      />
                      <Text style={styles.otpSentText}>
                        Code sent to {countryCode} {phone}
                      </Text>
                      
                      <View style={styles.resendContainer}>
                        <Text style={styles.resendText}>Didn't receive code? </Text>
                        <TouchableOpacity 
                          onPress={handleResendOtp} 
                          disabled={resendTimer > 0}
                        >
                          <Text style={[
                            styles.resendButton,
                            resendTimer > 0 && styles.resendButtonDisabled
                          ]}>
                            {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {error && (
                    <View style={styles.errorContainer}>
                      <Ionicons name="warning" size={16} color="#FF4444" />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  {/* Action Button */}
                  <TouchableOpacity
                    style={[styles.actionButton, loading && styles.actionButtonDisabled]}
                    onPress={!isOtpSent ? handleSendOtp : handleVerifyOtp}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={!isOtpSent ? ['#FF6EA6', '#F53F7A'] : ['#4FC3F7', '#29B6F6']}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <View style={styles.buttonContent}>
                          <Text style={styles.buttonText}>
                            {!isOtpSent ? 'Send OTP' : 'Verify & Continue'}
                          </Text>
                          <Ionicons 
                            name={!isOtpSent ? "arrow-forward" : "checkmark-circle"} 
                            size={20} 
                            color="#fff" 
                          />
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {isOtpSent && (
                    <TouchableOpacity 
                      style={styles.backButton}
                      onPress={() => {
                        setIsOtpSent(false);
                        setOtp('');
                        setError(null);
                        setResendTimer(0);
                      }}
                    >
                      <Ionicons name="arrow-back" size={18} color="#F53F7A" />
                      <Text style={styles.backButtonText}>Change Phone Number</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.termsText}>
                  By continuing, you agree to our{' '}
                  <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </Animated.View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 20,
  },
  headerSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 35,
    paddingHorizontal: 24,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333',
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  formSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 28,
  },
  phoneSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    height: 56,
    paddingHorizontal: 16,
  },
  countryCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 4,
  },
  phoneDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#E9ECEF',
    marginRight: 12,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  helperText: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 8,
    textAlign: 'center',
  },
  otpSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  otpInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    height: 56,
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    letterSpacing: 8,
    paddingHorizontal: 20,
    width: '100%',
  },
  otpSentText: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 12,
    textAlign: 'center',
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  resendText: {
    fontSize: 14,
    color: '#6C757D',
  },
  resendButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F53F7A',
  },
  resendButtonDisabled: {
    color: '#999',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE6E6',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#FF4444',
    marginLeft: 8,
    flex: 1,
  },
  actionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginRight: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#F53F7A',
    fontWeight: '600',
    marginLeft: 6,
  },
  termsText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  termsLink: {
    color: '#fff',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default Login;