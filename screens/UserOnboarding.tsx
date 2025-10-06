import { useState } from 'react';
import {
  Text,
  View,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/useAuth';

const UserOnboarding = () => {
  const [name, setName] = useState('');
  // Simplified onboarding: only name
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setUser } = useAuth();

  const handleCompleteOnboarding = async () => {
    setLoading(true);
    setError(null);

    // Validate inputs
    if (!name.trim()) {
      setError('Please enter your name');
      setLoading(false);
      return;
    }

    // No other fields required

    try {
      // Get current authenticated user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        setError('Authentication error. Please try logging in again.');
        setLoading(false);
        return;
      }

      // Create user profile
      const newProfile = {
        id: authUser.id,
        name: name.trim(),
      };

      const { data: createdUser, error: createError } = await supabase
        .from('users')
        .insert([newProfile])
        .select()
        .single();

      if (createError) {
        setError(createError.message);
        setLoading(false);
        return;
      }

      // Set user in context to trigger navigation to main app
      setUser(createdUser);
      
      Toast.show({
        type: 'success',
        text1: 'Welcome to Only2U!',
        text2: `Profile created successfully for ${createdUser.name}`,
      });

      setLoading(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      setLoading(false);
    }
  };

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
              {/* Header */}
              <View style={styles.headerSection}>
                <View style={styles.logoContainer}>
                  <View style={styles.logoCircle}>
                    <Text style={styles.logoText}>
                      Only<Text style={{ color: '#F53F7A' }}>2</Text>U
                    </Text>
                  </View>
                </View>
                
                <View style={styles.headerTextContainer}>
                  <Text style={styles.welcomeTitle}>Almost Done!</Text>
                  <Text style={styles.welcomeSubtitle}>
                    Tell us a bit about yourself to complete your profile
                  </Text>
                </View>
              </View>

              {/* Form */}
              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>Your Name</Text>
                
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={18} color="#F53F7A" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your full name"
                      value={name}
                      onChangeText={setName}
                      placeholderTextColor="#999"
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                {/* Location and other fields removed */}

                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="warning" size={16} color="#FF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Complete Button */}
                <TouchableOpacity
                  style={[styles.completeButton, loading && styles.completeButtonDisabled]}
                  onPress={handleCompleteOnboarding}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#4FC3F7', '#29B6F6']}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <View style={styles.buttonContent}>
                        <Text style={styles.buttonText}>Save</Text>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.privacyText}>
                  Your information is secure and will only be used to enhance your experience
                </Text>
              </View>
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
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginHorizontal: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 28,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    height: 56,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  helperText: {
    fontSize: 13,
    color: '#6C757D',
    marginTop: 6,
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
  completeButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  completeButtonDisabled: {
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
  privacyText: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default UserOnboarding;
