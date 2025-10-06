import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '~/utils/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';

interface Category {
  id: string;
  name: string;
  description: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CategoryManagement = () => {
  const navigation = useNavigation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_url: '',
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    fetchCategories();
  }, []);

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      // Read the image file
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Create a unique filename
      const fileName = `category_${Date.now()}.jpg`;
      const filePath = `categories/${fileName}`;

      // Convert base64 to Uint8Array for upload
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('categoryimages')
        .upload(filePath, bytes, {
          contentType: 'image/jpeg',
        });

      if (error) {
        console.error('Upload error:', error);
        Toast.show({
          type: 'error',
          text1: t('upload_failed'),
          text2: t('failed_to_upload_category_image'),
        });
        return null;
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('categoryimages')
        .getPublicUrl(filePath);

      console.log('Category image uploaded successfully:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      Toast.show({
        type: 'error',
        text1: t('upload_error'),
        text2: t('error_uploading_image'),
      });
      return null;
    }
  };

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching categories:', error);
        Alert.alert(t('error'), t('failed_to_fetch_categories'));
        return;
      }

      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      Alert.alert(t('error'), t('failed_to_fetch_categories'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      image_url: '',
      is_active: true,
    });
    setModalVisible(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description,
      image_url: category.image_url || '',
      is_active: category.is_active,
    });
    setModalVisible(true);
  };

  const handleDeleteCategory = (category: Category) => {
    Alert.alert(
      t('delete_category'),
      t('delete_category_confirm', { name: category.name }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => deleteCategory(category.id),
        },
      ]
    );
  };

  const deleteCategory = async (categoryId: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) {
        console.error('Error deleting category:', error);
        Alert.alert(t('error'), t('failed_to_delete_category'));
        return;
      }

      Alert.alert(t('success'), t('category_deleted_successfully'));
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      Alert.alert(t('error'), t('failed_to_delete_category'));
    }
  };

  const handleImagePicker = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(t('permission_required'), t('permission_to_access_camera_roll_required'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        console.log('Image selected:', imageUri);
        
        // Show loading state
        setSubmitting(true);
        
        // Upload the image to Supabase storage
        const uploadedUrl = await uploadImage(imageUri);
        if (uploadedUrl) {
          console.log('Image uploaded successfully, URL:', uploadedUrl);
          setFormData({ ...formData, image_url: uploadedUrl });
          Toast.show({
            type: 'success',
            text1: t('success'),
            text2: t('category_image_uploaded_successfully'),
          });
        } else {
          console.log('Image upload failed');
        }
        
        setSubmitting(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setSubmitting(false);
      Alert.alert(t('error'), t('failed_to_pick_image'));
    }
  };

  const handleSubmit = async () => {
    if (!formData.name?.trim()) {
      Alert.alert(t('error'), t('category_name_required'));
      return;
    }

    try {
      setSubmitting(true);

      if (editingCategory) {
        // Update existing category
        const { error } = await supabase
          .from('categories')
          .update({
            name: formData.name.trim(),
            description: formData.description?.trim() || '',
            image_url: formData.image_url,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCategory.id);

        if (error) {
          console.error('Error updating category:', error);
          Alert.alert(t('error'), t('failed_to_update_category'));
          return;
        }

        Alert.alert(t('success'), t('category_updated_successfully'));
      } else {
        // Create new category
        const { error } = await supabase
          .from('categories')
          .insert({
            name: formData.name.trim(),
            description: formData.description?.trim() || '',
            image_url: formData.image_url,
            is_active: formData.is_active,
          });

        if (error) {
          console.error('Error creating category:', error);
          Alert.alert(t('error'), t('failed_to_create_category'));
          return;
        }

        Alert.alert(t('success'), t('category_created_successfully'));
      }

      setModalVisible(false);
      fetchCategories();
    } catch (error) {
      console.error('Error submitting category:', error);
      Alert.alert(t('error'), t('failed_to_save_category'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCategoryStatus = async (category: Category) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({
          is_active: !category.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', category.id);

      if (error) {
        console.error('Error updating category status:', error);
        Alert.alert(t('error'), t('failed_to_update_category_status'));
        return;
      }

      fetchCategories();
    } catch (error) {
      console.error('Error updating category status:', error);
      Alert.alert(t('error'), t('failed_to_update_category_status'));
    }
  };

  const renderCategoryItem = (category: Category) => (
    <View key={category.id} style={styles.categoryItem}>
      <View style={styles.categoryInfo}>
        {category.image_url ? (
          <Image source={{ uri: category.image_url }} style={styles.categoryImage} />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={24} color="#999" />
          </View>
        )}
        <View style={styles.categoryDetails}>
          <Text style={styles.categoryName}>{category.name}</Text>
          <Text style={styles.categoryDescription} numberOfLines={2}>
            {category.description}
          </Text>
          <View style={styles.categoryStatus}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: category.is_active ? '#E8F5E8' : '#FFE8E8' }
            ]}>
              <Text style={[
                styles.statusText,
                { color: category.is_active ? '#4CAF50' : '#F44336' }
              ]}>
                {category.is_active ? t('active') : t('inactive')}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.categoryActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => toggleCategoryStatus(category)}
        >
          <Ionicons
            name={category.is_active ? "pause-circle-outline" : "play-circle-outline"}
            size={20}
            color={category.is_active ? "#FF9800" : "#4CAF50"}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditCategory(category)}
        >
          <Ionicons name="pencil-outline" size={20} color="#2196F3" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteCategory(category)}
        >
          <Ionicons name="trash-outline" size={20} color="#F44336" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('category_management')}</Text>
        <TouchableOpacity onPress={handleAddCategory} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#F53F7A" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F53F7A" />
          <Text style={styles.loadingText}>{t('loading_categories')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {categories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={64} color="#999" />
              <Text style={styles.emptyTitle}>{t('no_categories_found')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('create_first_category')}
              </Text>
              <TouchableOpacity style={styles.createButton} onPress={handleAddCategory}>
                <Text style={styles.createButtonText}>{t('create_category')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.categoriesContainer}>
              {categories.map(renderCategoryItem)}
            </View>
          )}
        </ScrollView>
      )}

      {/* Add/Edit Category Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingCategory ? t('edit_category') : t('add_category')}
            </Text>
            <TouchableOpacity onPress={handleSubmit} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator size="small" color="#F53F7A" />
              ) : (
                <Text style={styles.saveButton}>{t('save')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Category Image */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('category_image')}</Text>
              <TouchableOpacity 
                style={styles.imagePickerButton} 
                onPress={handleImagePicker}
                disabled={submitting}
              >
                {formData.image_url ? (
                  <Image source={{ uri: formData.image_url }} style={styles.selectedImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    {submitting ? (
                      <ActivityIndicator size="large" color="#F53F7A" />
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={32} color="#999" />
                        <Text style={styles.imagePlaceholderText}>
                          {submitting ? t('uploading') : t('tap_to_select_image')}
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Category Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('category_name')} *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder={t('enter_category_name')}
                placeholderTextColor="#999"
              />
            </View>

            {/* Category Description */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('description')}</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder={t('enter_category_description')}
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Active Status */}
            <View style={styles.formGroup}>
              <View style={styles.switchContainer}>
                <Text style={styles.label}>{t('active_status')}</Text>
                <TouchableOpacity
                  style={[
                    styles.switch,
                    { backgroundColor: formData.is_active ? '#F53F7A' : '#E0E0E0' }
                  ]}
                  onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}
                >
                  <View style={[
                    styles.switchThumb,
                    { transform: [{ translateX: formData.is_active ? 20 : 0 }] }
                  ]} />
                </TouchableOpacity>
              </View>
              <Text style={styles.switchDescription}>
                {formData.is_active ? t('category_is_active') : t('category_is_inactive')}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
  addButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  categoriesContainer: {
    padding: 16,
  },
  categoryItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  categoryInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryDetails: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  categoryStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F53F7A',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f8f9fa',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  imagePickerButton: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    borderRadius: 8,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
  },
  switchDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});

export default CategoryManagement;
