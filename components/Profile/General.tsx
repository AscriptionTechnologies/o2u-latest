import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  Alert,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../utils/supabase';
import Toast from 'react-native-toast-message';
import { Header } from '../common';
import { useTranslation } from 'react-i18next';

const General = () => {
  const navigation = useNavigation();
  const { user, setUser } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    location: user?.location || '',
    bio: user?.bio || '',
  });

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: formData.name.trim(),
          phone: formData.phone?.trim() || '',
          location: formData.location?.trim() || '',
          bio: formData.bio?.trim() || '',
        })
        .eq('id', user?.id);

      if (error) throw error;

      // Update local user state
      setUser({
        ...user,
        name: formData.name.trim(),
        phone: formData.phone?.trim() || '',
        location: formData.location?.trim() || '',
        bio: formData.bio?.trim() || '',
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Profile updated successfully',
      });

      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to update profile',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#181C20', '#000']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Header
          title="General Information"
          subtitle="Update your personal details"
          showBackButton={true}
          rightActions={
            <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={loading}>
              <Text style={styles.saveButtonText}>
                {loading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          }
        />

        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('full_name')}</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Enter your full name"
                placeholderTextColor="#B0B6BE"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('email_address')}</Text>
              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={formData.email}
                editable={false}
                placeholder="Email address"
                placeholderTextColor="#B0B6BE"
              />
              <Text style={styles.helperText}>{t('email_cannot_be_changed')}</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('phone_number')}</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                placeholder="Enter your phone number"
                placeholderTextColor="#B0B6BE"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('location')}</Text>
              <TextInput
                style={styles.input}
                value={formData.location}
                onChangeText={(text) => setFormData({ ...formData, location: text })}
                placeholder="Enter your location"
                placeholderTextColor="#B0B6BE"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('bio')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.bio}
                onChangeText={(text) => setFormData({ ...formData, bio: text })}
                placeholder="Tell us about yourself"
                placeholderTextColor="#B0B6BE"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  saveButton: {
    backgroundColor: '#3DF45B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  formCard: {
    backgroundColor: 'rgba(24,28,32,0.95)',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
  },
  disabledInput: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.05)',
    color: '#B0B6BE',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  helperText: {
    color: '#B0B6BE',
    fontSize: 12,
    marginTop: 4,
  },
});

export default General;
