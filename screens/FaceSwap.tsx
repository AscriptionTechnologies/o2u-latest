import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useUser } from '~/contexts/UserContext';
import { usePreview } from '~/contexts/PreviewContext';
import { akoolService, FaceSwapTaskStatus } from '~/utils/akoolService';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');

interface FaceSwapRouteParams {
  productId: string;
  productImageUrl: string;
  productName: string;
}

const FaceSwap = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { productId, productImageUrl, productName } = route.params as FaceSwapRouteParams;
  const { userData } = useUser();
  const { addToPreview } = usePreview();
  const { t } = useTranslation();

  const [isProcessing, setIsProcessing] = useState(false);
  const [taskStatus, setTaskStatus] = useState<FaceSwapTaskStatus | null>(null);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [coinBalance, setCoinBalance] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const statusCheckInterval = useRef<NodeJS.Timeout | null>(null);

  const PHOTO_PREVIEW_COST = 25;

  useEffect(() => {
    if (userData?.id) {
      fetchCoinBalance();
    }
  }, [userData?.id]);

  useEffect(() => {
    // Cleanup interval on unmount
    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
    };
  }, []);

  const fetchCoinBalance = async () => {
    if (!userData?.id) return;
    
    try {
      const balance = await akoolService.getUserCoinBalance(userData.id);
      setCoinBalance(balance);
    } catch (error) {
      console.error('Error fetching coin balance:', error);
    }
  };

  const handleStartFaceSwap = async () => {
    if (!userData?.id || !userData?.profilePhoto) {
      Alert.alert(t('error'), t('please_upload_profile_photo_first'));
      return;
    }

    if (coinBalance < PHOTO_PREVIEW_COST) {
      Alert.alert(t('insufficient_coins'), t('please_purchase_more_coins'));
      return;
    }

    setIsProcessing(true);
    setTaskStatus({ status: 'pending' });

    try {
      // Update local coin balance
      setCoinBalance(prev => prev - PHOTO_PREVIEW_COST);

      // Initiate face swap
      const response = await akoolService.initiateFaceSwap({
        userImageUrl: userData.profilePhoto,
        productImageUrl: productImageUrl,
        userId: userData.id,
        productId: productId,
      });

      if (response.success && response.taskId) {
        setTaskId(response.taskId);
        setTaskStatus({ status: 'processing' });
        
        // Start polling for status updates
        startStatusPolling(response.taskId);
        
        Toast.show({
          type: 'success',
          text1: t('face_swap_started'),
          text2: t('face_swap_is_being_processed'),
        });
      } else {
        Alert.alert(t('error'), response.error || t('failed_to_start_face_swap'));
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error starting face swap:', error);
      Alert.alert(t('error'), t('failed_to_start_face_swap'));
      setIsProcessing(false);
    }
  };

  const startStatusPolling = (taskId: string) => {
    // Poll every 5 seconds
    statusCheckInterval.current = setInterval(async () => {
      try {
        const status = await akoolService.checkTaskStatus(taskId);
        setTaskStatus(status);

        if (status.status === 'completed' && status.resultImages) {
          // Prefer second image (API-rendered) if present; otherwise keep order
          const imgs = Array.isArray(status.resultImages) ? [...status.resultImages] : [];
          const ordered = imgs.length > 1 ? [imgs[1], ...imgs.slice(0,1), ...imgs.slice(2)] : imgs;
          setResultImages(ordered);
          setSelectedImageIndex(0);
          setIsProcessing(false);
          if (statusCheckInterval.current) {
            clearInterval(statusCheckInterval.current);
          }
          
          // Add product to preview with personalized images
          const personalizedProduct = {
            id: `personalized_${productId}_${Date.now()}`, // Unique ID for personalized version
            name: productName,
            description: `Personalized ${productName} with your face`,
            price: 0, // You can set actual price if needed
            image_urls: ordered,
            video_urls: [],
            featured_type: 'personalized',
            category: { name: 'Personalized' },
            stock_quantity: 1,
            variants: [],
            isPersonalized: true,
            originalProductImage: productImageUrl,
            faceSwapDate: new Date().toISOString(),
            originalProductId: productId, // Keep reference to original product
          };
          
          addToPreview(personalizedProduct);
          
          Toast.show({
            type: 'success',
            text1: t('face_swap_complete'),
            text2: t('personalized_images_are_ready'),
          });
        } else if (status.status === 'failed') {
          setIsProcessing(false);
          if (statusCheckInterval.current) {
            clearInterval(statusCheckInterval.current);
          }
          
          Alert.alert(t('error'), status.error || t('face_swap_failed'));
        }
      } catch (error) {
        console.error('Error checking task status:', error);
      }
    }, 5000);
  };

  const handleSaveImage = async (imageUrl: string) => {
    // TODO: Implement image saving functionality
    Alert.alert(t('success'), t('image_saved_to_gallery'));
  };

  const handleShareImage = async (imageUrl: string) => {
    // TODO: Implement image sharing functionality
    Alert.alert(t('share'), t('sharing_functionality_will_be_implemented_soon'));
  };

  const renderProcessingState = () => (
    <View style={styles.processingContainer}>
      <ActivityIndicator size="large" color="#F53F7A" />
      <Text style={styles.processingTitle}>{t('processing_your_face_swap')}</Text>
      <Text style={styles.processingSubtitle}>
        {t('this_may_take_a_few_minutes')}
      </Text>
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={styles.progressFill} />
        </View>
        <Text style={styles.progressText}>{t('processing')}</Text>
      </View>
    </View>
  );

  const renderResults = () => (
    <View style={styles.resultsContainer}>
      <Text style={styles.resultsTitle}>Your Face Swap Result</Text>
      <Text style={styles.resultsSubtitle}>
        Here's your personalized product image
      </Text>

      {/* Single Image Display */}
      <View style={styles.mainImageContainer}>
        <Image 
          source={{ uri: resultImages[0] }} 
          style={styles.mainImage}
          resizeMode="cover"
        />
      </View>

      {/* Action Buttons - Share and Shop Now */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryButton]}
          onPress={() => handleShareImage(resultImages[0])}
        >
          <Ionicons name="share-outline" size={20} color="#fff" />
          <Text style={[styles.actionButtonText, styles.primaryButtonText]}>Share</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryButton]}
          onPress={() => {
            (navigation as any).navigate('ProductDetails', { productId });
          }}
        >
          <Ionicons name="cart-outline" size={20} color="#fff" />
          <Text style={[styles.actionButtonText, styles.primaryButtonText]}>Shop Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderInitialState = () => (
    <View style={styles.initialContainer}>
      <View style={styles.productPreview}>
        <Image source={{ uri: productImageUrl }} style={styles.productImage} />
        <Text style={styles.productName}>{productName}</Text>
      </View>

      <View style={styles.userPreview}>
        {userData?.profilePhoto ? (
          <Image source={{ uri: userData.profilePhoto }} style={styles.userImage} />
        ) : (
          <View style={styles.noUserImage}>
            <Ionicons name="person" size={40} color="#ccc" />
            <Text style={styles.noUserImageText}>{t('no_profile_photo')}</Text>
          </View>
        )}
        <Text style={styles.userLabel}>{t('your_face')}</Text>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>{t('photo_preview')}</Text>
        {/* <Text style={styles.infoSubtitle}>
          {t('get_3_styled_product_images_with_your_face_swapped_in')}
        </Text> */}
        
        <View style={styles.costContainer}>
          <Ionicons name="logo-bitcoin" size={20} color="#F53F7A" />
          <Text style={styles.costText}>{PHOTO_PREVIEW_COST} {t('coins')}</Text>
        </View>

        <View style={styles.balanceContainer}>
          <Text style={styles.balanceText}>
            {t('your_balance')}: <Text style={styles.balanceAmount}>{coinBalance} {t('coins')}</Text>
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[
          styles.startButton,
          (!userData?.profilePhoto || coinBalance < PHOTO_PREVIEW_COST) && styles.startButtonDisabled
        ]}
        onPress={handleStartFaceSwap}
        disabled={!userData?.profilePhoto || coinBalance < PHOTO_PREVIEW_COST}
      >
        <Text style={styles.startButtonText}>
          {!userData?.profilePhoto 
            ? t('upload_profile_photo_first') 
            : coinBalance < PHOTO_PREVIEW_COST 
              ? t('insufficient_coins') 
              : t('start_face_swap')
          }
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('face_swap')}</Text>
        <View style={styles.headerRight}>
          <View style={styles.coinContainer}>
            <Ionicons name="logo-bitcoin" size={16} color="#F53F7A" />
            <Text style={styles.coinText}>{coinBalance}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isProcessing ? (
          renderProcessingState()
        ) : resultImages.length > 0 ? (
          renderResults()
        ) : (
          renderInitialState()
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coinText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F53F7A',
  },
  content: {
    flex: 1,
  },
  initialContainer: {
    padding: 20,
  },
  productPreview: {
    alignItems: 'center',
    marginBottom: 30,
  },
  productImage: {
    width: 200,
    height: 250,
    borderRadius: 12,
    marginBottom: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  userPreview: {
    alignItems: 'center',
    marginBottom: 30,
  },
  userImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 8,
  },
  noUserImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  noUserImageText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  userLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  costContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  costText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F53F7A',
  },
  balanceContainer: {
    marginBottom: 20,
  },
  balanceText: {
    fontSize: 14,
    color: '#666',
  },
  balanceAmount: {
    color: '#F53F7A',
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#F53F7A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#ccc',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  processingSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F53F7A',
    borderRadius: 4,
    width: '60%', // Animated progress
  },
  progressText: {
    fontSize: 14,
    color: '#666',
  },
  resultsContainer: {
    padding: 20,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  resultsSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  mainImageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  mainImage: {
    width: '100%',
    height: 400,
    borderRadius: 12,
  },
  imageCounter: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  thumbnailsContainer: {
    marginBottom: 30,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedThumbnail: {
    borderColor: '#F53F7A',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f8f8',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F53F7A',
  },
  primaryButton: {
    backgroundColor: '#F53F7A',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#fff',
  },
});

export default FaceSwap; 