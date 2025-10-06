import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useUser } from '~/contexts/UserContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '~/utils/supabase';
import { uploadProfilePhoto, validateImage } from '~/utils/profilePhotoUpload';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';

const EditProfile = () => {
  const navigation = useNavigation();
  const { userData, updateUserData } = useUser();
  const { t } = useTranslation();

  // const [firstName, setFirstName] = useState('');
  // const [lastName, setLastName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say'>('prefer_not_to_say');
  const [location, setLocation] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const initialStateRef = useRef<{ name: string; email: string; phone: string; dateOfBirth: string; gender: typeof gender; location: string; profilePhoto: string } | null>(null);

  // Load user data when component mounts
  useEffect(() => {
    if (userData) {
      setName(userData.name);
      setEmail(userData.email || '');
      setPhone(userData.phone);
      setDateOfBirth(userData.dateOfBirth);
      setGender(userData.gender);
      setLocation(userData.location);
      setProfilePhoto(userData.profilePhoto || '');

      // capture initial snapshot to detect unsaved changes
      initialStateRef.current = {
        name: userData.name,
        email: userData.email || '',
        phone: userData.phone || '',
        dateOfBirth: userData.dateOfBirth || '',
        gender: userData.gender,
        location: userData.location || '',
        profilePhoto: userData.profilePhoto || ''
      };
      setIsDirty(false);
    }
  }, [userData]);

  // Track dirty state
  useEffect(() => {
    if (!initialStateRef.current) return;
    const dirty = (
      name !== initialStateRef.current.name ||
      (email || '') !== (initialStateRef.current.email || '') ||
      (phone || '') !== (initialStateRef.current.phone || '') ||
      (dateOfBirth || '') !== (initialStateRef.current.dateOfBirth || '') ||
      gender !== initialStateRef.current.gender ||
      (location || '') !== (initialStateRef.current.location || '') ||
      (profilePhoto || '') !== (initialStateRef.current.profilePhoto || '')
    );
    setIsDirty(dirty);
  }, [name, email, phone, dateOfBirth, gender, location, profilePhoto]);

  // Intercept back navigation if there are unsaved changes
  useEffect(() => {
    const beforeRemove = navigation.addListener('beforeRemove', (e: any) => {
      if (!isDirty || isSaving || isUploading) {
        return;
      }
      e.preventDefault();
      Alert.alert(
        t('unsaved_changes') || 'Unsaved changes',
        t('save_profile_photo_before_exit') || 'You have unsaved changes. Please save your profile before leaving.',
        [
          { text: t('cancel') || 'Cancel', style: 'cancel' },
          {
            text: t('discard') || 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
          {
            text: t('save') || 'Save',
            onPress: () => handleSave(),
          },
        ]
      );
    });
    return beforeRemove;
  }, [navigation, isDirty, isSaving, isUploading, name, email, phone, dateOfBirth, gender, location, profilePhoto]);

  const handleBackPress = () => {
    if (isDirty && !isSaving && !isUploading) {
      Alert.alert(
        t('unsaved_changes') || 'Unsaved changes',
        t('save_profile_photo_before_exit') || 'You have unsaved changes. Please save your profile before leaving.',
        [
          { text: t('cancel') || 'Cancel', style: 'cancel' },
          { text: t('discard') || 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
          { text: t('save') || 'Save', onPress: () => handleSave() },
        ]
      );
      return;
    }
    navigation.goBack();
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      setIsUploading(true);

      // Validate the image first
      const validation = await validateImage(uri);
      if (!validation.valid) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Image',
          text2: validation.error || 'Please select a valid image file.',
        });
        return null;
      }

      // Upload the image using the new service
      const result = await uploadProfilePhoto(uri);

      if (result.success && result.url) {
        console.log('Image uploaded successfully:', result.url);
        Toast.show({
          type: 'success',
          text1: 'Upload Success',
          text2: 'Profile picture uploaded successfully!',
        });
        return result.url;
      } else {
        console.error('Upload failed:', result.error);
        Toast.show({
          type: 'error',
          text1: 'Upload Failed',
          text2: result.error || 'Failed to upload profile picture. Please try again.',
        });
        return null;
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload Error',
        text2: 'An error occurred while uploading your picture.',
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleImagePicker = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        console.log('Image selected:', imageUri);
        
        // Upload the image to Supabase storage
        const uploadedUrl = await uploadImage(imageUri);
        if (uploadedUrl) {
          console.log('Image uploaded successfully, URL:', uploadedUrl);
          setProfilePhoto(uploadedUrl);
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'Profile picture uploaded successfully!',
          });
        } else {
          console.log('Image upload failed');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      // Validate required fields
      if (!name?.trim() || !email?.trim()) {
        Alert.alert(t('error'), t('fill_required_fields'));
        return;
      }

      console.log('Saving profile with data:', {
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim() || '',
        dateOfBirth: dateOfBirth?.trim() || '',
        gender,
        location: location?.trim() || '',
        profilePhoto: profilePhoto,
      });

      // Update user data with Supabase sync
      await updateUserData({
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim() || '',
        // Handle empty date fields - pass null instead of empty string
        dateOfBirth: dateOfBirth?.trim() || null,
        gender,
        location: location?.trim() || '',
        profilePhoto: profilePhoto,
      }, true); // Enable Supabase sync

      // Reset dirty snapshot post-save
      initialStateRef.current = {
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim() || '',
        dateOfBirth: (dateOfBirth?.trim() || '') as string,
        gender,
        location: location?.trim() || '',
        profilePhoto: profilePhoto || ''
      };
      setIsDirty(false);

      console.log('Profile updated successfully');

      Alert.alert(t('success'), t('profile_updated'), [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert(t('error'), t('profile_update_failed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('edit_profile')}</Text>
        </View>
        <TouchableOpacity 
          onPress={handleSave} 
          style={styles.saveButton}
          disabled={isUploading || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FF6B9D" />
          ) : (
            <Text style={[styles.saveButtonText, (isUploading || isSaving) && styles.saveButtonTextDisabled]}>
              {t('save')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Photo Section */}
        <View style={styles.photoSection}>
          <View style={styles.avatarContainer}>
            {isUploading ? (
              <View style={styles.avatar}>
                <ActivityIndicator size="large" color="#FF6B9D" />
              </View>
            ) : profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Ionicons name="person" size={40} color="#F53F7A" />
              </View>
            )}
            <TouchableOpacity 
              style={[styles.cameraButton, isUploading && styles.cameraButtonDisabled]} 
              onPress={handleImagePicker}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.changePhotoButton} 
            onPress={handleImagePicker}
            disabled={isUploading}
          >
            <Text style={[styles.changePhotoText, isUploading && styles.changePhotoTextDisabled]}>
              {isUploading ? t('uploading') : t('change_photo')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={styles.formContainer}>
          {/* Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{t('name')} *</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder={t('enter_name')}
              placeholderTextColor="#999"
            />
          </View>

          {/* Email Address */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{t('email_address')} *</Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder={t('enter_email')}
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Phone Number */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{t('phone_number')}</Text>
            <TextInput
              style={styles.textInput}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('enter_phone')}
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>

          {/* Date of Birth */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{t('date_of_birth')}</Text>
            <TextInput
              style={styles.textInput}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder={t('yyyy_mm_dd')}
              placeholderTextColor="#999"
            />
          </View>

          {/* Gender */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{t('gender')}</Text>
            <View style={styles.genderContainer}>
              {['male', 'female', 'other', 'prefer_not_to_say'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.genderOption,
                    gender === option && styles.selectedGenderOption
                  ]}
                  onPress={() => setGender(option as any)}
                >
                  <Text style={[
                    styles.genderText,
                    gender === option && styles.selectedGenderText
                  ]}>
                    {option === 'prefer_not_to_say' ? t('prefer_not_to_say') : t(option)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{t('location_information')}</Text>

          {/* Location */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{t('location')}</Text>
            <TextInput
              style={styles.textInput}
              value={location}
              onChangeText={setLocation}
              placeholder={t('enter_location')}
              placeholderTextColor="#999"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F53F7A',
  },
  saveButtonTextDisabled: {
    color: '#999',
  },
  scrollView: {
    flex: 1,
  },
  photoSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFE8F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#F53F7A',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
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
    borderWidth: 3,
    borderColor: '#fff',
  },
  cameraButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  changePhotoButton: {
    paddingVertical: 8,
  },
  changePhotoText: {
    fontSize: 16,
    color: '#F53F7A',
    fontWeight: '500',
  },
  changePhotoTextDisabled: {
    color: '#999',
  },
  formContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 24,
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  genderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  selectedGenderOption: {
    borderColor: '#F53F7A',
    backgroundColor: '#F53F7A',
  },
  genderText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedGenderText: {
    color: '#fff',
  },
});

export default EditProfile;
