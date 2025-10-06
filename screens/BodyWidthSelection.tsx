import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

type RootStackParamList = {
  SkinToneSelection: undefined;
  BodyWidthSelection: {
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
      skinTone: string;
    };
  };
  RegistrationSuccess: {
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
      skinTone: string;
      bustSize: number;
      waistSize: number;
      hipSize: number;
    };
  };
  TabNavigator: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const BodyWidthSelection = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { userData } = route.params as { userData: any };
  const { t } = useTranslation();

  const [bustSize, setBustSize] = useState(30);
  const [waistSize, setWaistSize] = useState(28);
  const [hipSize, setHipSize] = useState(36);

  const handleCalculateShape = () => {
    // Navigate to success screen with all collected data
    navigation.navigate('RegistrationSuccess', {
      userData: {
        ...userData,
        bustSize,
        waistSize,
        hipSize,
      },
    });
  };

  const handleAddLater = () => {
    // Skip measurements and go to success screen
    navigation.navigate('RegistrationSuccess', {
      userData: {
        ...userData,
        bustSize: 0,
        waistSize: 0,
        hipSize: 0,
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
            <Text style={styles.title}>{t('your_shape_is_your_superpower')}</Text>
            <Text style={styles.subtitle}>
              {t('your_body_is_unique_and_so_should_your_fit_be')}
            </Text>

            <View style={styles.measurementsContainer}>
              {/* Bust Size */}
              <View style={styles.measurementRow}>
                <Text style={styles.measurementLabel}>{t('bust_size')}</Text>
                <View style={styles.measurementValue}>
                  <Text style={styles.measurementNumber}>{bustSize}</Text>
                  <Text style={styles.measurementUnit}>in</Text>
                </View>
              </View>
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={24}
                  maximumValue={44}
                  value={bustSize}
                  onValueChange={setBustSize}
                  step={1}
                  minimumTrackTintColor="#4A90E2"
                  maximumTrackTintColor="#E0E0E0"
                  thumbTintColor="#4A90E2"
                />
              </View>

              {/* Waist Size */}
              <View style={styles.measurementRow}>
                <Text style={styles.measurementLabel}>{t('waist_size')}</Text>
                <View style={styles.measurementValue}>
                  <Text style={styles.measurementNumber}>{waistSize}</Text>
                  <Text style={styles.measurementUnit}>in</Text>
                </View>
              </View>
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={20}
                  maximumValue={40}
                  value={waistSize}
                  onValueChange={setWaistSize}
                  step={1}
                  minimumTrackTintColor="#4A90E2"
                  maximumTrackTintColor="#E0E0E0"
                  thumbTintColor="#4A90E2"
                />
              </View>

              {/* Hip Size */}
              <View style={styles.measurementRow}>
                <Text style={styles.measurementLabel}>{t('hip_size')}</Text>
                <View style={styles.measurementValue}>
                  <Text style={styles.measurementNumber}>{hipSize}</Text>
                  <Text style={styles.measurementUnit}>in</Text>
                </View>
              </View>
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={30}
                  maximumValue={50}
                  value={hipSize}
                  onValueChange={setHipSize}
                  step={1}
                  minimumTrackTintColor="#4A90E2"
                  maximumTrackTintColor="#E0E0E0"
                  thumbTintColor="#4A90E2"
                />
              </View>
            </View>

            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={styles.calculateButton}
                onPress={handleCalculateShape}
              >
                <Text style={styles.calculateButtonText}>{t('calculate_my_shape')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addLaterButton}
                onPress={handleAddLater}
              >
                <Ionicons name="time-outline" size={20} color="#F53F7A" />
                <Text style={styles.addLaterButtonText}>{t('add_it_later')}</Text>
              </TouchableOpacity>
            </View>
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
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 10,
    padding: 24,
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
  measurementsContainer: {
    marginBottom: 32,
  },
  measurementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  measurementLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  measurementValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  measurementNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  measurementUnit: {
    fontSize: 16,
    color: '#666',
  },
  sliderContainer: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  buttonsContainer: {
    gap: 16,
  },
  calculateButton: {
    backgroundColor: '#F53F7A',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addLaterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#F53F7A',
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
  },
  addLaterButtonText: {
    color: '#F53F7A',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BodyWidthSelection;
