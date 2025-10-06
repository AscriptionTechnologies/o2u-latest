import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ResellerService } from '~/services/resellerService';
import type { ResellerRegistrationForm } from '~/types/reseller';

const ResellerRegistration = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ResellerRegistrationForm>({
    business_name: '',
    business_type: 'individual',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gst_number: '',
    pan_number: '',
    bank_account_number: '',
    ifsc_code: '',
    account_holder_name: '',
  });

  const [errors, setErrors] = useState<Partial<ResellerRegistrationForm>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<ResellerRegistrationForm> = {};

    if (!formData.business_name.trim()) {
      newErrors.business_name = 'Business name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid 10-digit phone number';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }

    if (!formData.pincode.trim()) {
      newErrors.pincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(formData.pincode)) {
      newErrors.pincode = 'Please enter a valid 6-digit pincode';
    }

    if (formData.gst_number && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gst_number)) {
      newErrors.gst_number = 'Please enter a valid GST number';
    }

    if (formData.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan_number)) {
      newErrors.pan_number = 'Please enter a valid PAN number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await ResellerService.registerReseller(formData);
      
      Alert.alert(
        'Registration Successful',
        'Your reseller account has been created successfully. It will be reviewed and verified soon.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Registration error:', error);
      Alert.alert(
        'Registration Failed',
        error.message || 'Something went wrong. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: keyof ResellerRegistrationForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become a Reseller</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>Join Our Reseller Program</Text>
          <Text style={styles.introSubtitle}>
            Start your own business by reselling our products. Earn commissions on every sale!
          </Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Business Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Business Name *</Text>
            <TextInput
              style={[styles.input, errors.business_name && styles.inputError]}
              placeholder="Enter your business name"
              value={formData.business_name}
              onChangeText={(value) => updateFormData('business_name', value)}
            />
            {errors.business_name && (
              <Text style={styles.errorText}>{errors.business_name}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Business Type *</Text>
            <View style={styles.radioGroup}>
              {[
                { value: 'individual', label: 'Individual' },
                { value: 'business', label: 'Business' },
                { value: 'retailer', label: 'Retailer' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.radioOption}
                  onPress={() => updateFormData('business_type', option.value)}
                >
                  <View style={styles.radioButton}>
                    {formData.business_type === option.value && (
                      <View style={styles.radioButtonSelected} />
                    )}
                  </View>
                  <Text style={styles.radioLabel}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="Enter your phone number"
              value={formData.phone}
              onChangeText={(value) => updateFormData('phone', value)}
              keyboardType="phone-pad"
              maxLength={10}
            />
            {errors.phone && (
              <Text style={styles.errorText}>{errors.phone}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="Enter your email address"
              value={formData.email}
              onChangeText={(value) => updateFormData('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Address Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={[styles.input, styles.textArea, errors.address && styles.inputError]}
              placeholder="Enter your complete address"
              value={formData.address}
              onChangeText={(value) => updateFormData('address', value)}
              multiline
              numberOfLines={3}
            />
            {errors.address && (
              <Text style={styles.errorText}>{errors.address}</Text>
            )}
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>City *</Text>
              <TextInput
                style={[styles.input, errors.city && styles.inputError]}
                placeholder="City"
                value={formData.city}
                onChangeText={(value) => updateFormData('city', value)}
              />
              {errors.city && (
                <Text style={styles.errorText}>{errors.city}</Text>
              )}
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>State *</Text>
              <TextInput
                style={[styles.input, errors.state && styles.inputError]}
                placeholder="State"
                value={formData.state}
                onChangeText={(value) => updateFormData('state', value)}
              />
              {errors.state && (
                <Text style={styles.errorText}>{errors.state}</Text>
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pincode *</Text>
            <TextInput
              style={[styles.input, errors.pincode && styles.inputError]}
              placeholder="Enter 6-digit pincode"
              value={formData.pincode}
              onChangeText={(value) => updateFormData('pincode', value)}
              keyboardType="numeric"
              maxLength={6}
            />
            {errors.pincode && (
              <Text style={styles.errorText}>{errors.pincode}</Text>
            )}
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Tax & Banking Information (Optional)</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>GST Number</Text>
            <TextInput
              style={[styles.input, errors.gst_number && styles.inputError]}
              placeholder="Enter GST number (if applicable)"
              value={formData.gst_number}
              onChangeText={(value) => updateFormData('gst_number', value.toUpperCase())}
              autoCapitalize="characters"
            />
            {errors.gst_number && (
              <Text style={styles.errorText}>{errors.gst_number}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PAN Number</Text>
            <TextInput
              style={[styles.input, errors.pan_number && styles.inputError]}
              placeholder="Enter PAN number"
              value={formData.pan_number}
              onChangeText={(value) => updateFormData('pan_number', value.toUpperCase())}
              autoCapitalize="characters"
              maxLength={10}
            />
            {errors.pan_number && (
              <Text style={styles.errorText}>{errors.pan_number}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bank Account Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter bank account number"
              value={formData.bank_account_number}
              onChangeText={(value) => updateFormData('bank_account_number', value)}
              keyboardType="numeric"
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>IFSC Code</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter IFSC code"
              value={formData.ifsc_code}
              onChangeText={(value) => updateFormData('ifsc_code', value.toUpperCase())}
              autoCapitalize="characters"
              maxLength={11}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Account Holder Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter account holder name"
              value={formData.account_holder_name}
              onChangeText={(value) => updateFormData('account_holder_name', value)}
            />
          </View>
        </View>

        <View style={styles.termsSection}>
          <Text style={styles.termsText}>
            By registering as a reseller, you agree to our Terms & Conditions and 
            understand that your account will be reviewed before approval.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>Register as Reseller</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  introSection: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#F53F7A',
  },
  errorText: {
    fontSize: 12,
    color: '#F53F7A',
    marginTop: 4,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 20,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F53F7A',
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
  },
  termsSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  termsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 32,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ResellerRegistration;
