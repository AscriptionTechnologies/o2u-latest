import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

type RootStackParamList = {
  ProfilePictureUpload: undefined;
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
  SkinToneSelection: {
    userData: {
      fullName: string;
      email: string;
      password: string;
      phone: string;
      countryCode: string;
      location: string;
      role: 'owner' | 'cleaner';
      profilePhoto?: string;
      size: string;
    };
  };
  TabNavigator: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const sizes = [
  { id: 'xs', label: 'XS' },
  { id: 's', label: 'S' },
  { id: 'm', label: 'M' },
  { id: 'l', label: 'L' },
  { id: 'xl', label: 'XL' },
  { id: 'xxl', label: 'XXL' },
  { id: '3xl', label: '3XL' },
  { id: '4xl', label: '4XL' },
  { id: '5xl', label: '5XL' },
];

const UserSizeSelection = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { userData } = route.params as { userData: any };
  const { t } = useTranslation();

  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const handleSizeSelect = (sizeId: string) => {
    setSelectedSize(sizeId);
  };

  const handleComplete = () => {
    if (!selectedSize) {
      Toast.show({
        type: 'error',
        text1: 'Size Required',
        text2: 'Please select your size to continue.',
      });
      return;
    }

    // Navigate to skin tone selection with updated userData
    navigation.navigate('SkinToneSelection', {
      userData: {
        ...userData,
        size: selectedSize,
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
            <Text style={styles.logoText}>Only<Text style={{ color: '#F53F7A' }}>2</Text>U</Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <View style={styles.card}>
            <Text style={styles.title}>{t('let_s_get_your_fit_right')}</Text>
            <Text style={styles.subtitle}>
              {t('select_the_size_that_fits_you_best')}
            </Text>

            <ScrollView 
              style={styles.sizesContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sizesGrid}>
                {sizes.map((size) => (
                  <TouchableOpacity
                    key={size.id}
                    style={[
                      styles.sizeOption,
                      selectedSize === size.id && styles.sizeOptionSelected
                    ]}
                    onPress={() => handleSizeSelect(size.id)}
                  >
                    <Text style={[
                      styles.sizeLabel,
                      selectedSize === size.id && styles.sizeLabelSelected
                    ]}>
                      {size.label}
                    </Text>
                    {/* <Text style={[
                      styles.sizeDescription,
                      selectedSize === size.id && styles.sizeDescriptionSelected
                    ]}>
                      {size.description}
                    </Text> */}
                    {/* {selectedSize === size.id && (
                      <View style={styles.checkmark}>
                        <Ionicons name="checkmark" size={20} color="#fff" />
                      </View>
                    )} */}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.completeButton,
                !selectedSize && styles.completeButtonDisabled
              ]}
              onPress={handleComplete}
              disabled={!selectedSize}
            >
              <Text style={[
                styles.completeButtonText,
                !selectedSize && styles.completeButtonTextDisabled
              ]}>
                {t('next')}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={selectedSize ? "#fff" : "#ccc"}
              />
            </TouchableOpacity>
          </View>
        </View>
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
    color: 'black',
    backgroundColor: '#fff',
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
    borderRadius: 24,
    padding: 24,
    maxHeight: '80%',
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
  sizesContainer: {
    maxHeight: 300,
    marginBottom: 24,
  },
  sizesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    // justifyContent: 'space-between',
  },
  sizeOption: {
    width: 'auto',
    // height: 60,
    backgroundColor: '#f8f8f8',
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
    alignItems: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sizeOptionSelected: {
    backgroundColor: '#F53F7A',
    borderColor: '#F53F7A',
  },
  sizeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sizeLabelSelected: {
    color: '#fff',
  },
  sizeDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  sizeDescriptionSelected: {
    color: '#fff',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F53F7A',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 16,
    justifyContent: 'center',
    gap: 8,
  },
  completeButtonDisabled: {
    backgroundColor: '#f0f0f0',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  completeButtonTextDisabled: {
    color: '#ccc',
  },
});

export default UserSizeSelection;
