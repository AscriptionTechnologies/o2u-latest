import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '~/contexts/UserContext';
import { useTranslation } from 'react-i18next';

const BodyMeasurements = () => {
  const navigation = useNavigation();
  const { userData, updateUserData } = useUser();
  const { t } = useTranslation();

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [clothingSize, setClothingSize] = useState('M');
  const [bustSize, setBustSize] = useState('');
  const [waistSize, setWaistSize] = useState('');
  const [hipSize, setHipSize] = useState('');

  // Load user data when component mounts
  useEffect(() => {
    if (userData) {
      setHeight(userData.height || '');
      setWeight(userData.weight || '');
      setClothingSize(userData.size);
      setBustSize(userData.bustSize ? userData.bustSize.toString() : '');
      setWaistSize(userData.waistSize ? userData.waistSize.toString() : '');
      setHipSize(userData.hipSize ? userData.hipSize.toString() : '');
    }
  }, [userData]);

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleSave = async () => {
    await handleSaveMeasurements();
  };

  const handleSizeSelection = () => {
    const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...sizes],
          cancelButtonIndex: 0,
          title: 'Select Clothing Size',
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setClothingSize(sizes[buttonIndex - 1]);
          }
        }
      );
    } else {
      // For Android, show an Alert with options
      Alert.alert(
        'Select Clothing Size',
        'Choose your preferred clothing size',
        [
          { text: 'Cancel', style: 'cancel' },
          ...sizes.map(size => ({
            text: size,
            onPress: () => setClothingSize(size)
          }))
        ]
      );
    }
  };

  const handleSaveMeasurements = async () => {
    try {
      // Update user data with body measurements and sync to Supabase
      await updateUserData({
        height: height?.trim() || '',
        weight: weight?.trim() || '',
        size: clothingSize,
        bustSize: bustSize ? parseInt(bustSize) : undefined,
        waistSize: waistSize ? parseInt(waistSize) : undefined,
        hipSize: hipSize ? parseInt(hipSize) : undefined,
      }, true); // Enable Supabase sync

      Alert.alert('Success', 'Body measurements updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error updating measurements:', error);
      Alert.alert('Error', 'Failed to update measurements. Please try again.');
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
        <Text style={styles.headerTitle}>{t('body_measurements')}</Text>
        </View>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>{t('save')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          {/* Basic Measurements */}
          <View style={styles.rowContainer}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>{t('height_cm')}</Text>
              <TextInput
                style={styles.textInput}
                value={height}
                onChangeText={setHeight}
                placeholder={t('enter_value')}
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>{t('weight_kg')}</Text>
              <TextInput
                style={styles.textInput}
                value={weight}
                onChangeText={setWeight}
                placeholder={t('enter_value')}
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Clothing Size */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{t('clothing_size')}</Text>
            <TouchableOpacity style={styles.sizeSelector} onPress={handleSizeSelection}>
              <Text style={styles.sizeText}>{clothingSize}</Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Detailed Measurements Section */}
          <Text style={styles.sectionTitle}>Detailed Measurements</Text>

          <View style={styles.rowContainer}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>{t('bust_size')}</Text>
              <TextInput
                style={styles.textInput}
                value={bustSize}
                onChangeText={setBustSize}
                placeholder={t('enter_value')}
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>{t('waist_size')}</Text>
              <TextInput
                style={styles.textInput}
                value={waistSize}
                onChangeText={setWaistSize}
                placeholder={t('enter_value')}
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{t('hip_size')}</Text>
            <TextInput
              style={styles.textInput}
              value={hipSize}
              onChangeText={setHipSize}
              placeholder={t('enter_value')}
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity style={styles.saveMeasurementsButton} onPress={handleSaveMeasurements}>
            <Text style={styles.saveMeasurementsButtonText}>{t('save_measurements')}</Text>
          </TouchableOpacity>
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
  scrollView: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 6,
  },
  formContainer: {
    // backgroundColor: '#fff',
    margin: 16,
    // borderRadius: 16,
    // padding: 20,
    // shadowColor: '#000',
    // shadowOpacity: 0.05,
    // shadowRadius: 8,
    // shadowOffset: { width: 0, height: 2 },
    // elevation: 2,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  halfField: {
    flex: 1,
    marginRight: 8,
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  sizeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  sizeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    marginTop: 8,
  },
  saveMeasurementsButton: {
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveMeasurementsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BodyMeasurements;
