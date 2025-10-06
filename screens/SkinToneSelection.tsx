import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  UserSizeSelection: undefined;
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
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const skinTones = [
  {
    id: 'fair',
    label: 'Fair',
    description: 'Pale/peach tones',
    image: require('../assets/fair.png'), // You can replace with actual skin tone images
  },
  {
    id: 'wheatish',
    label: 'Wheatish',
    description: 'Medium golden beige',
    image: require('../assets/whitish.png'),
  },
  {
    id: 'dusky',
    label: 'Dusky',
    description: 'Deep caramel/brown',
    image: require('../assets/dusky.png'),
  },
  {
    id: 'deep',
    label: 'Deep',
    description: 'Rich chocolate/deep brown',
    image: require('../assets/deep.png'),
  },
];

const SkinToneSelection = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { userData } = route.params as { userData: any };

  const [selectedTone, setSelectedTone] = useState<string | null>(null);

  const handleToneSelect = (toneId: string) => {
    setSelectedTone(toneId);
  };

  const handleNext = () => {
    if (!selectedTone) {
      return;
    }

    // Navigate to body width selection with updated userData
    navigation.navigate('BodyWidthSelection', {
      userData: {
        ...userData,
        skinTone: selectedTone,
      },
    });
  };

  return (
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Only<Text style={{ color: '#F53F7A' }}>2</Text>U</Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <View style={styles.card}>
            <Text style={styles.title}>Pick Your Tone</Text>
            <Text style={styles.subtitle}>
              We believe your skin tone is a strength—not a label. This helps us show the styles
              that shine on you. Your data stays private.
            </Text>

            <View style={styles.tonesContainer}>
              <View style={styles.tonesGrid}>
                {skinTones.map((tone) => (
                  <TouchableOpacity
                    key={tone.id}
                    style={[
                      styles.toneOption,
                      selectedTone === tone.id && styles.toneOptionSelected,
                    ]}
                    onPress={() => handleToneSelect(tone.id)}>
                    <View style={styles.imageContainer}>
                      <Image source={tone.image} style={styles.toneImage} />
                      {selectedTone === tone.id && (
                        <View style={styles.checkmark}>
                          <Ionicons name="checkmark" size={20} color="#fff" />
                        </View>
                      )}
                    </View>
                    <View style={styles.toneFooter}>
                    <Text
                      style={[
                        styles.toneLabel,
                        selectedTone === tone.id && styles.toneLabelSelected,
                      ]}>
                      {tone.label}
                    </Text>
                    <Text
                      style={[
                        styles.toneDescription,
                        selectedTone === tone.id && styles.toneDescriptionSelected,
                      ]}>
                      {tone.description}
                    </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.nextButton, !selectedTone && styles.nextButtonDisabled]}
              onPress={handleNext}
              disabled={!selectedTone}>
              <Text style={[styles.nextButtonText, !selectedTone && styles.nextButtonTextDisabled]}>
                Next
              </Text>
              <Ionicons name="arrow-forward" size={20} color={selectedTone ? '#fff' : '#ccc'} />
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
    borderRadius: 16,
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
  tonesContainer: {
    marginBottom: 24,
  },
  tonesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  toneOption: {
    width: '48%',
    marginBottom: 18,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  toneOptionSelected: {
    borderColor: '#F53F7A',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1.2,
    backgroundColor: '#eee',
    overflow: 'hidden',
    borderRadius: 18,
  },
  toneImage: {
    width: '130%',
    height: 150,
    resizeMode: 'cover',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  checkmark: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F53F7A',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  toneFooter: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    alignItems: 'center',
    minHeight: 60,
  },
  toneLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
    textAlign: 'center',
  },
  toneLabelSelected: {
    color: '#F53F7A',
  },
  toneDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  toneDescriptionSelected: {
    color: '#F53F7A',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F53F7A',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 16,
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonDisabled: {
    backgroundColor: '#f0f0f0',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  nextButtonTextDisabled: {
    color: '#ccc',
  },
});

export default SkinToneSelection;
