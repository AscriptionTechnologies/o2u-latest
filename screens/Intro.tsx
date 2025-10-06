import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Platform } from 'react-native';
import { useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AppIntroSlider from 'react-native-app-intro-slider';
import { markIntroAsSeen } from '~/utils/introHelper';

const slides = [
  {
    key: '1',
    title: 'Your Style, Your Story',
    subtitle:
      'Discover fashion that fits your unique body, personality, and lifestyle. Every piece is chosen just for you.',
    features: [
      { icon: 'sparkles', text: 'AI-Powered Styling' },
      { icon: 'resize', text: 'Perfect Fit Guarantee' },
      { icon: 'color-palette', text: 'Color Matching' },
      { icon: 'heart', text: 'Created Just for You' },
    ],
    button: 'Start Your Style Journey',
    buttonIcon: 'arrow-forward',
  },
  {
    key: '2',
    title: 'Try On Instantly',
    subtitle:
      'Preview outfits on your own photo with our instant face swap technology. See yourself in every style before you buy.',
    features: [
      { icon: 'camera', text: 'Virtual Try-On' },
      { icon: 'image', text: 'Realistic Previews' },
      { icon: 'flash', text: 'Instant Results' },
      { icon: 'checkmark-done', text: 'No Guesswork' },
    ],
    button: 'See How It Works',
    buttonIcon: 'arrow-forward',
  },
  {
    key: '3',
    title: 'Shop with Confidence',
    subtitle:
      'Enjoy easy returns, secure payments, and expert support. Your satisfaction is our top priority.',
    features: [
      { icon: 'shield-checkmark', text: 'Secure Payments' },
      { icon: 'refresh', text: 'Easy Returns' },
      { icon: 'headset', text: 'Expert Support' },
      { icon: 'star', text: 'Trusted by Thousands' },
    ],
    button: 'Get Started',
    buttonIcon: 'arrow-forward',
  },
];

const getIconComponent = (icon: string) => {
  // Use Ionicons for most, MaterialCommunityIcons for special cases
  const materialIcons = [
    'star-four-points-outline', 'shield-check', 'check-all', 'refresh', 'headset', 'star',
  ];
  if (materialIcons.includes(icon)) return MaterialCommunityIcons;
  return Ionicons;
};

const getIconName = (icon: string) => {
  // Map icon names to the correct library names
  const materialMap: Record<string, string> = {
    'sparkles': 'star-four-points-outline',
    'shield-checkmark': 'shield-check',
    'checkmark-done': 'check-all',
    'refresh': 'refresh',
    'headset': 'headset',
    'star': 'star',
  };
  // Only return valid icon names for each library
  if (materialMap[icon]) return materialMap[icon];
  // Fallback to Ionicons valid names
  const ioniconsValid = [
    'resize', 'heart', 'camera', 'image', 'flash', 'color-palette', 'diamond', 'bag', 'shirt',
  ];
  if (ioniconsValid.includes(icon)) return icon;
  return 'star'; // fallback
};

const Intro = ({ navigation }: any) => {
  const sliderRef = useRef<any>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const navigateToLogin = async () => {
    await markIntroAsSeen();
    navigation.replace('Login');
  };

  const RenderItem = ({ item, index }: { item: typeof slides[0]; index: number }) => (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.skipBtn} onPress={navigateToLogin} activeOpacity={0.8}>
          <Text style={styles.skipText}>Skip</Text>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.fashionIconsContainer}>
            <View style={styles.fashionIcon}>
              <Ionicons name="shirt" size={32} color="#fff" />
            </View>
            <View style={[styles.fashionIcon, styles.fashionIconDelay1]}>
              <Ionicons name="diamond" size={28} color="#fff" />
            </View>
            <View style={[styles.fashionIcon, styles.fashionIconDelay2]}>
              <MaterialCommunityIcons name="sunglasses" size={30} color="#fff" />
            </View>
            <View style={[styles.fashionIcon, styles.fashionIconDelay3]}>
              <Ionicons name="bag" size={26} color="#fff" />
            </View>
          </View>
          {/* Only show title/subtitle/features for slides after the first */}
          {index !== 0 && (
            <>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </>
          )}
        </View>
        {/* Features Grid only for slides after the first */}
        {item.features && (
          <View style={styles.featuresContainer}>
            <View style={styles.featuresGrid}>
              {item.features.map((feature: any) => {
                let iconElement = null;
                switch (feature.icon) {
                  case 'sparkles':
                    iconElement = <MaterialCommunityIcons name="star-outline" size={24} color="#F53F7A" />;
                    break;
                  case 'shield-checkmark':
                    iconElement = <MaterialCommunityIcons name="shield-check" size={24} color="#F53F7A" />;
                    break;
                  case 'checkmark-done':
                    iconElement = <MaterialCommunityIcons name="check-all" size={24} color="#F53F7A" />;
                    break;
                  case 'refresh':
                    iconElement = <MaterialCommunityIcons name="refresh" size={24} color="#F53F7A" />;
                    break;
                  case 'headset':
                    iconElement = <MaterialCommunityIcons name="headset" size={24} color="#F53F7A" />;
                    break;
                  case 'star':
                    iconElement = <MaterialCommunityIcons name="star" size={24} color="#F53F7A" />;
                    break;
                  case 'resize':
                    iconElement = <Ionicons name="resize" size={24} color="#F53F7A" />;
                    break;
                  case 'heart':
                    iconElement = <Ionicons name="heart" size={24} color="#F53F7A" />;
                    break;
                  case 'camera':
                    iconElement = <Ionicons name="camera" size={24} color="#F53F7A" />;
                    break;
                  case 'image':
                    iconElement = <Ionicons name="image" size={24} color="#F53F7A" />;
                    break;
                  case 'flash':
                    iconElement = <Ionicons name="flash" size={24} color="#F53F7A" />;
                    break;
                  case 'color-palette':
                    iconElement = <Ionicons name="color-palette" size={24} color="#F53F7A" />;
                    break;
                  case 'diamond':
                    iconElement = <Ionicons name="diamond" size={24} color="#F53F7A" />;
                    break;
                  case 'bag':
                    iconElement = <Ionicons name="bag" size={24} color="#F53F7A" />;
                    break;
                  case 'shirt':
                    iconElement = <Ionicons name="shirt" size={24} color="#F53F7A" />;
                    break;
                  default:
                    iconElement = <Ionicons name="star" size={24} color="#F53F7A" />;
                }
                return (
                  <View key={feature.text} style={styles.featureCard}>
                    <View style={styles.featureIcon}>{iconElement}</View>
                    <Text style={styles.featureText}>{feature.text}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
        {/* Inspirational Quote only on first slide */}
        {index === 0 && (
          <View style={styles.quoteContainer}>
            <Text style={styles.quoteText}>
              "Fashion is about dressing according to what's fashionable. Style is more about being
              yourself."
            </Text>
            <Text style={styles.quoteAuthor}>— Oscar de la Renta</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );

  const handleNext = () => {
    if (activeIndex < slides.length - 1) {
      sliderRef.current?.goToSlide(activeIndex + 1);
      setActiveIndex(activeIndex + 1);
    } else {
      navigateToLogin();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F53F7A' }}>
      <RenderItem item={slides[activeIndex]} index={activeIndex} />
      <View style={{ marginBottom: Platform.select({ ios: 32, android: 40 }), flexDirection: 'row', justifyContent: 'space-around', paddingBottom: Platform.OS === 'android' ? 16 : 0 }}>
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>{slides[activeIndex].button}</Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color="#F53F7A" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Platform.select({ ios: 8, android: 24 }),
    marginHorizontal: 16,
    justifyContent: 'flex-end',
    paddingTop: Platform.OS === 'android' ? 8 : 0,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingVertical: Platform.OS === 'android' ? 8 : 4,
    paddingHorizontal: Platform.OS === 'android' ? 16 : 8,
    marginRight: Platform.OS === 'android' ? 8 : 0,
    borderRadius: 20,
  },
  skipText: {
    color: '#fff',
    fontSize: Platform.OS === 'android' ? 20 : 16,
    marginRight: 2,
    fontWeight: '600',
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    // marginTop: 32,
    marginBottom: 16,
    paddingHorizontal: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    marginHorizontal: 16,
    lineHeight: 28,
    opacity: 0.9,
  },
  iconBox: {
    width: 100,
    height: 100,
    borderRadius: 5,
    resizeMode: 'contain',
    marginRight: 16,
  },
  bottomSection: {
    marginBottom: 32,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 7,
    backgroundColor: '#fff',
    opacity: 0.7,
  },
  dotBtn: {
    width: 12,
    height: 12,
    borderRadius: 7,
    marginHorizontal: 4,
    backgroundColor: '#fff',
    opacity: 0.7,
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 32,
    borderRadius: 8,
    opacity: 1,
  },
  button: {
    backgroundColor: '#fff',
    borderRadius: 25,
    width: '80%',
    paddingVertical: 18,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#F53F7A',
    fontSize: 18,
    marginRight: 10,
    fontWeight: 'bold',
  },
  roleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
    marginBottom: 18,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  roleCardActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: '#fff',
  },
  roleTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  rolePoint: {
    color: '#fff',
    marginLeft: 6,
    fontSize: 13,
    marginTop: 6,
    opacity: 0.8,
  },
  pointText: {
    color: '#fff',
    fontSize: 18,
    opacity: 0.9,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  fashionIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    flexWrap: 'wrap',
  },
  fashionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  fashionIconDelay1: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  fashionIconDelay2: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  fashionIconDelay3: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  featuresContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  quoteContainer: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  quoteText: {
    color: '#fff',
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.9,
    marginBottom: 8,
  },
  quoteAuthor: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
});

export default Intro;
