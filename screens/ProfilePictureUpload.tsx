import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  SafeAreaView,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../utils/supabase';
import { Only2ULogo } from '../components/common';
import { uploadProfilePhoto, validateImage } from '../utils/profilePhotoUpload';
import Toast from 'react-native-toast-message';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

type RootStackParamList = {
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
  UserSizeSelection: {
    userData: {
      fullName: string;
      email: string;
      password: string;
      phone: string;
      countryCode: string;
      location: string;
      role: 'owner' | 'cleaner';
      profilePhoto?: string;
    };
  };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ProfilePictureUpload = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { userData } = route.params as { userData: any };
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const { t } = useTranslation();

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
      setSelectedImage(result.assets[0].uri);
    }
    setShowImagePickerModal(false);
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
      setSelectedImage(result.assets[0].uri);
    }
    setShowImagePickerModal(false);
  };

  const showImagePickerOptions = () => {
    setShowImagePickerModal(true);
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      setUploading(true);

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
      setUploading(false);
    }
  };

  const handleContinue = async () => {
    let profilePhotoUrl = null;
    
    if (selectedImage) {
      profilePhotoUrl = await uploadImage(selectedImage);
      if (!profilePhotoUrl) {
        return; // Upload failed, don't continue
      }
    }

    // Navigate to user size selection with updated userData
    navigation.navigate('UserSizeSelection', {
      userData: {
        ...userData,
        profilePhoto: profilePhotoUrl,
      },
    });
  };

  const handleSkip = () => {
    // Navigate to user size selection without profile photo
    navigation.navigate('UserSizeSelection', {
      userData: {
        ...userData,
        profilePhoto: null,
      },
    });
  };

  return (
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Only2ULogo size="large" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <View style={styles.card}>
            <Text style={styles.title}>{t('upload_profile_picture')}</Text>
            <Text style={styles.subtitle}>
              {t('please_upload_a_clear_hd_picture_with_a_white_background_for_the_best_personalized_experience')}
            </Text>

            <View style={styles.imageSection}>
              {/* Reference Image */}
              <View style={styles.referenceContainer}>
                <Image
                  source={require('../assets/reference.jpeg')}
                  style={styles.referenceImage}
                />
                <Text style={styles.referenceLabel}>{t('reference_image')}</Text>
              </View>

              {/* Upload Area */}
              <TouchableOpacity 
                style={styles.uploadContainer}
                onPress={showImagePickerOptions}
                disabled={uploading}
              >
                {selectedImage ? (
                  <Image source={{ uri: selectedImage }} style={styles.uploadedImage} />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Ionicons name="camera" size={40} color="#F53F7A" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.uploadButton}
              onPress={showImagePickerOptions}
              disabled={uploading}
            >
              <Ionicons name="cloud-upload-outline" size={20} color="#F53F7A" />
              <Text style={styles.uploadButtonText}>
                {uploading ? t('uploading') : t('upload')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.continueButton}
              onPress={handleContinue}
              disabled={uploading}
            >
              <Text style={styles.continueButtonText}>{t('continue')}</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>

            {/* <TouchableOpacity 
              style={styles.skipButton}
              onPress={handleSkip}
              disabled={uploading}
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity> */}
          </View>
        </View>

        <Modal
          visible={showImagePickerModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowImagePickerModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowImagePickerModal(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('upload_profile_picture')}</Text>
                <TouchableOpacity onPress={() => setShowImagePickerModal(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity 
                style={styles.modalOption}
                onPress={takePhoto}
              >
                <View style={styles.modalOptionIcon}>
                  <Ionicons name="camera" size={28} color="#F53F7A" />
                </View>
                <View style={styles.modalOptionTextContainer}>
                  <Text style={styles.modalOptionTitle}>{t('take_photo')}</Text>
                  <Text style={styles.modalOptionSubtitle}>Use camera to take a new photo</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalOption}
                onPress={pickFromGallery}
              >
                <View style={styles.modalOptionIcon}>
                  <Ionicons name="images" size={28} color="#F53F7A" />
                </View>
                <View style={styles.modalOptionTextContainer}>
                  <Text style={styles.modalOptionTitle}>{t('choose_from_gallery')}</Text>
                  <Text style={styles.modalOptionSubtitle}>Select from your photo library</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
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
  backButton: {
    padding: 8,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    marginRight: 40, // Compensate for back button
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    backgroundColor: '#fff',
    color: 'black',
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
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  imageSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 32,
  },
  referenceContainer: {
    alignItems: 'center',
    flex: 1,
  },
  referenceImage: {
    width: 130,
    height: 120,
    borderRadius: 12,
    marginBottom: 8,
  },
  referenceLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  uploadContainer: {
    flex: 1,
    alignItems: 'center',
    marginLeft: 20,
  },
  uploadPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f8f8f8',
    borderWidth: 2,
    borderColor: '#F53F7A',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadedImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 24,
    gap: 8,
  },
  uploadButtonText: {
    color: '#F53F7A',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F53F7A',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 16,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipButtonText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#eee',
  },
  modalOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalOptionTextContainer: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  modalOptionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  modalOptionText: {
    marginLeft: 15,
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
});

export default ProfilePictureUpload;
