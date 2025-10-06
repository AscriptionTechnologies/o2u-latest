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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '~/utils/supabase';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';

interface Color {
  id: string;
  name: string;
  hex_code: string;
  created_at: string;
  updated_at: string;
}

const ColorManagement = () => {
  const navigation = useNavigation();
  const [colors, setColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingColor, setEditingColor] = useState<Color | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    hex_code: '#000000',
  });
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    fetchColors();
  }, []);

  const fetchColors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('colors')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching colors:', error);
        Alert.alert(t('error'), t('failed_to_fetch_colors'));
        return;
      }

      setColors(data || []);
    } catch (error) {
      console.error('Error fetching colors:', error);
      Alert.alert(t('error'), t('failed_to_fetch_colors'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddColor = () => {
    setEditingColor(null);
    setFormData({
      name: '',
      hex_code: '#000000',
    });
    setModalVisible(true);
  };

  const handleEditColor = (color: Color) => {
    setEditingColor(color);
    setFormData({
      name: color.name,
      hex_code: color.hex_code,
    });
    setModalVisible(true);
  };

  const handleDeleteColor = (color: Color) => {
    Alert.alert(
      t('delete_color'),
      t('delete_color_confirm', { name: color.name }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => deleteColor(color.id),
        },
      ]
    );
  };

  const deleteColor = async (colorId: string) => {
    try {
      const { error } = await supabase
        .from('colors')
        .delete()
        .eq('id', colorId);

      if (error) {
        console.error('Error deleting color:', error);
        Alert.alert(t('error'), t('failed_to_delete_color'));
        return;
      }

      Toast.show({
        type: 'success',
        text1: t('success'),
        text2: t('color_deleted_successfully'),
      });
      fetchColors();
    } catch (error) {
      console.error('Error deleting color:', error);
      Alert.alert(t('error'), t('failed_to_delete_color'));
    }
  };

  const handleSubmit = async () => {
    if (!formData.name?.trim()) {
      Alert.alert(t('error'), t('please_enter_color_name'));
      return;
    }

    if (!formData.hex_code?.trim() || !formData.hex_code.startsWith('#')) {
      Alert.alert(t('error'), t('please_enter_valid_hex_color_code'));
      return;
    }

    try {
      setSubmitting(true);

      const colorData = {
        name: formData.name.trim(),
        hex_code: formData.hex_code.trim().toUpperCase(),
        updated_at: new Date().toISOString(),
      };

      if (editingColor) {
        // Update existing color
        const { error } = await supabase
          .from('colors')
          .update(colorData)
          .eq('id', editingColor.id);

        if (error) {
          console.error('Error updating color:', error);
          Alert.alert(t('error'), t('failed_to_update_color'));
          return;
        }

        Toast.show({
          type: 'success',
          text1: t('success'),
          text2: t('color_updated_successfully'),
        });
      } else {
        // Create new color
        const { error } = await supabase
          .from('colors')
          .insert(colorData);

        if (error) {
          console.error('Error creating color:', error);
          Alert.alert(t('error'), t('failed_to_create_color'));
          return;
        }

        Toast.show({
          type: 'success',
          text1: t('success'),
          text2: t('color_created_successfully'),
        });
      }

      setModalVisible(false);
      fetchColors();
    } catch (error) {
      console.error('Error submitting color:', error);
      Alert.alert(t('error'), t('failed_to_save_color'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderColorItem = (color: Color) => (
    <View key={color.id} style={styles.colorItem}>
      <View style={styles.colorInfo}>
        <View style={[styles.colorIndicator, { backgroundColor: color.hex_code }]} />
        <View style={styles.colorDetails}>
          <Text style={styles.colorName}>{color.name}</Text>
          <Text style={styles.colorHex}>{color.hex_code}</Text>
        </View>
      </View>
      <View style={styles.colorActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditColor(color)}
        >
          <Ionicons name="pencil-outline" size={20} color="#2196F3" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteColor(color)}
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
        <Text style={styles.headerTitle}>{t('color_management')}</Text>
        <TouchableOpacity onPress={handleAddColor} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#F53F7A" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F53F7A" />
          <Text style={styles.loadingText}>{t('loading_colors')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {colors.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="color-palette-outline" size={64} color="#999" />
              <Text style={styles.emptyTitle}>{t('no_colors_found')}</Text>
              <Text style={styles.emptySubtitle}>{t('create_first_color')}</Text>
              <TouchableOpacity style={styles.createButton} onPress={handleAddColor}>
                <Text style={styles.createButtonText}>{t('create_color')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.colorsContainer}>
              {colors.map(renderColorItem)}
            </View>
          )}
        </ScrollView>
      )}

      {/* Add/Edit Color Modal */}
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
              {editingColor ? t('edit_color') : t('add_color')}
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
            {/* Color Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('color_name')} *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder={t('enter_color_name')}
                placeholderTextColor="#999"
              />
            </View>

            {/* Color Hex Code */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('hex_color_code')} *</Text>
              <View style={styles.hexInputContainer}>
                <View style={[styles.colorPreview, { backgroundColor: formData.hex_code }]} />
                <TextInput
                  style={styles.hexInput}
                  value={formData.hex_code}
                  onChangeText={(text) => setFormData({ ...formData, hex_code: text })}
                  placeholder={t('hex_color_code_placeholder')}
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                  maxLength={7}
                />
              </View>
              <Text style={styles.helpText}>{t('enter_valid_hex_color_code_example')}</Text>
            </View>

            {/* Color Preview */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('color_preview')}</Text>
              <View style={styles.colorPreviewContainer}>
                <View style={[styles.largeColorPreview, { backgroundColor: formData.hex_code }]} />
                <View style={styles.previewInfo}>
                  <Text style={styles.previewName}>{formData.name || t('color_name')}</Text>
                  <Text style={styles.previewHex}>{formData.hex_code}</Text>
                </View>
              </View>
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
  colorsContainer: {
    padding: 16,
  },
  colorItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  colorInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  colorDetails: {
    flex: 1,
  },
  colorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  colorHex: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  colorActions: {
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
  hexInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: 8,
    margin: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  hexInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    fontFamily: 'monospace',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  colorPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
  },
  largeColorPreview: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  previewHex: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
});

export default ColorManagement; 