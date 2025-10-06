import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  Share,
  Linking,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useUser } from '~/contexts/UserContext';
import type { Product } from '~/types/product';
import { getProductImages } from '~/utils/imageUtils';

const { width: screenWidth } = Dimensions.get('window');

interface RouteParams {
  product: Product & {
    resellPrice?: number;
    margin?: number;
    basePrice?: number;
  };
}

const CatalogShare = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const { userData } = useUser();
  const { product } = route.params as RouteParams;
  
  const [loading, setLoading] = useState(false);
  const [downloadingImages, setDownloadingImages] = useState(false);
  const [downloadedImages, setDownloadedImages] = useState<string[]>([]);
  const [shareMethod, setShareMethod] = useState<'whatsapp' | 'telegram' | 'instagram' | 'facebook' | 'direct_link' | 'email'>('whatsapp');
  const [customMessage, setCustomMessage] = useState('');

  const shareMethods = [
    { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
    { key: 'telegram', label: 'Telegram', icon: 'paper-plane', color: '#0088cc' },
    { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#E4405F' },
    { key: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
    { key: 'direct_link', label: 'Direct Link', icon: 'link', color: '#666' },
    { key: 'email', label: 'Email', icon: 'mail', color: '#EA4335' },
  ];

  const productImages = getProductImages(product);
  const availableSizes = product.variants?.map(v => v.size?.name).filter(Boolean).join(', ') || 'N/A';
  const availableColors = product.variants?.map(v => v.color?.name).filter(Boolean).join(', ') || 'N/A';

  // Download product images
  const downloadProductImages = async () => {
    if (downloadedImages.length > 0) return downloadedImages; // Already downloaded
    
    setDownloadingImages(true);
    const downloadedPaths: string[] = [];
    
    try {
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access to save product images.');
        return [];
      }

      // Download each product image
      for (let i = 0; i < Math.min(productImages.length, 5); i++) { // Limit to 5 images for better sharing
        const imageUrl = productImages[i];
        if (!imageUrl) continue;

        try {
          // Create unique filename with proper extension
          const filename = `product_${product.id}_${i + 1}_${Date.now()}.jpg`;
          const fileUri = `${FileSystem.documentDirectory}${filename}`;
          
          console.log('Downloading image:', imageUrl, 'to:', fileUri);
          
          // Download the image with proper options
          const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri, {
            headers: {
              'Accept': 'image/*',
            },
          });
          
          if (downloadResult.status === 200) {
            console.log('Successfully downloaded image:', downloadResult.uri);
            
            // Verify the file exists and is readable
            const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
            if (fileInfo.exists && fileInfo.size > 0) {
              downloadedPaths.push(downloadResult.uri);
            } else {
              console.log('Downloaded file is empty or doesn\'t exist');
            }
          } else {
            console.log('Download failed with status:', downloadResult.status);
          }
        } catch (error) {
          console.log(`Failed to download image ${i + 1}:`, error);
        }
      }
      
      console.log('Total downloaded images:', downloadedPaths.length);
      setDownloadedImages(downloadedPaths);
      return downloadedPaths;
    } catch (error) {
      console.log('Error downloading images:', error);
      Alert.alert('Error', 'Failed to download product images. Sharing will continue without images.');
      return [];
    } finally {
      setDownloadingImages(false);
    }
  };


  const generateShareContent = () => {
    let content = `🛍️ *${product.name}*\n\n`;
    content += `📝 ${product.description || 'Premium quality product'}\n\n`;
    
    if (product.resellPrice) {
      content += `💰 *Price: ₹${product.resellPrice}*\n`;
    } else {
      content += `💰 *Price: ₹${product.price}*\n`;
    }
    
    content += `📏 *Available Sizes: ${availableSizes}*\n`;
    content += `🎨 *Available Colors: ${availableColors}*\n\n`;
    
    if (customMessage) {
      content += `💬 *Message:* ${customMessage}\n\n`;
    }
    
    content += `🛒 Order now and get the best deals!\n`;
    content += `📱 Contact me for more details`;

    return content;
  };

  const handleShare = async () => {
    if (!userData?.id) {
      Alert.alert('Error', 'Please login to share products');
      return;
    }

    setLoading(true);
    try {
      const shareContent = generateShareContent();
      
      // Download images first (only for methods that support images)
      let imagesToShare: string[] = [];
      if (['whatsapp', 'telegram', 'direct_link', 'email'].includes(shareMethod)) {
        imagesToShare = await downloadProductImages();
        
        // For WhatsApp, also save images to gallery for manual attachment
        if (shareMethod === 'whatsapp' && imagesToShare.length > 0) {
          try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === 'granted') {
              for (const imagePath of imagesToShare) {
                try {
                  await MediaLibrary.createAssetAsync(imagePath);
                } catch (error) {
                  console.log('Failed to save image to gallery:', error);
                }
              }
            }
          } catch (error) {
            console.log('Failed to save images to gallery:', error);
          }
        }
      }

      // Perform actual sharing based on method
      switch (shareMethod) {
        case 'whatsapp':
          await shareViaWhatsApp(shareContent, imagesToShare);
          break;
        case 'telegram':
          await shareViaTelegram(shareContent, imagesToShare);
          break;
        case 'instagram':
          await shareViaInstagram();
          break;
        case 'facebook':
          await shareViaFacebook();
          break;
        case 'direct_link':
          await shareViaDirectLink(shareContent, imagesToShare);
          break;
        case 'email':
          await shareViaEmail(shareContent, imagesToShare);
          break;
      }

      if (shareMethod === 'whatsapp' && imagesToShare.length > 0) {
        Alert.alert(
          'Sharing Complete!', 
          `Your product has been shared to WhatsApp with ${imagesToShare.length} image${imagesToShare.length > 1 ? 's' : ''}. The images should appear attached to your message. If they don't appear, you can manually attach them from your gallery.`,
          [
            { text: 'OK' },
            { 
              text: 'Open Gallery', 
              onPress: () => {
                // Open gallery to help user manually attach images
                if (Platform.OS === 'ios') {
                  Linking.openURL('photos-redirect://');
                } else {
                  Linking.openURL('content://media/external/images/media/');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Success', 'Product catalog shared successfully!');
      }
    } catch (error: any) {
      console.error('Share error:', error);
      Alert.alert('Error', error.message || 'Failed to share catalog');
    } finally {
      setLoading(false);
    }
  };

  const shareViaWhatsApp = async (content: string, images: string[] = []) => {
    if (images.length > 0) {
      try {
        console.log('Sharing with images:', images.length, 'images');
        console.log('First image path:', images[0]);
        
        // Method 1: Try using the system share sheet with proper image attachment
        const shareOptions = {
          message: content,
          url: images[0],
          title: product.name,
          type: 'image/jpeg', // Explicitly specify the type
        };
        
        const shareResult = await Share.share(shareOptions, {
          dialogTitle: 'Share to WhatsApp',
          subject: product.name,
          UTI: 'public.jpeg', // iOS specific
          excludedActivityTypes: Platform.OS === 'ios' ? ['com.apple.UIKit.activity.Mail', 'com.apple.UIKit.activity.Message'] : undefined,
        });
        
        if (shareResult.action === Share.dismissedAction) {
          return;
        }
        
        // Method 2: If first method didn't work, try sharing images one by one with WhatsApp specifically
        if (images.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          for (let i = 1; i < Math.min(images.length, 3); i++) {
            try {
              await Share.share({
                message: '',
                url: images[i],
                title: product.name,
                type: 'image/jpeg',
              }, {
                dialogTitle: 'Share additional image to WhatsApp',
                subject: product.name,
                UTI: 'public.jpeg',
              });
              
              if (i < Math.min(images.length, 3) - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500));
              }
            } catch (error) {
              console.log(`Failed to share additional image ${i + 1}:`, error);
            }
          }
        }
      } catch (error) {
        console.log('Error sharing with images, trying alternative method:', error);
        
        // Method 3: Alternative approach - try to open WhatsApp directly with images
        try {
          // First, share the text message
          const url = `whatsapp://send?text=${encodeURIComponent(content)}`;
          const canOpen = await Linking.canOpenURL(url);
          
          if (canOpen) {
            await Linking.openURL(url);
            
            // Wait for WhatsApp to open, then try to share images
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Try to share images using the system share sheet again
            for (let i = 0; i < Math.min(images.length, 3); i++) {
              try {
                await Share.share({
                  message: '',
                  url: images[i],
                  title: product.name,
                  type: 'image/jpeg',
                });
                
                if (i < Math.min(images.length, 3) - 1) {
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
              } catch (imgError) {
                console.log(`Failed to share image ${i + 1}:`, imgError);
              }
            }
          } else {
            // Final fallback to web WhatsApp
            const webUrl = `https://wa.me/?text=${encodeURIComponent(content)}`;
            await Linking.openURL(webUrl);
          }
        } catch (fallbackError) {
          console.log('All methods failed, using text-only');
          // Final fallback to text-only
          const url = `whatsapp://send?text=${encodeURIComponent(content)}`;
          const canOpen = await Linking.canOpenURL(url);
          
          if (canOpen) {
            await Linking.openURL(url);
          } else {
            const webUrl = `https://wa.me/?text=${encodeURIComponent(content)}`;
            await Linking.openURL(webUrl);
          }
        }
      }
    } else {
      // Text-only sharing
      const url = `whatsapp://send?text=${encodeURIComponent(content)}`;
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        const webUrl = `https://wa.me/?text=${encodeURIComponent(content)}`;
        await Linking.openURL(webUrl);
      }
    }
  };

  const shareViaTelegram = async (content: string, images: string[] = []) => {
    if (images.length > 0) {
      // Share multiple images with Telegram
      try {
        // For multiple images, we'll share them one by one
        for (let i = 0; i < Math.min(images.length, 5); i++) { // Telegram can handle more images
          await Share.share({
            message: i === 0 ? content : '', // Only include message with first image
            url: images[i],
            title: product.name,
          });
          // Small delay between shares to avoid overwhelming the system
          if (i < Math.min(images.length, 5) - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } catch (error) {
        console.log('Error sharing multiple images, falling back to single image');
        await Share.share({
          message: content,
          url: images[0],
          title: product.name,
        });
      }
    } else {
      // Fallback to URL scheme
      const url = `tg://msg?text=${encodeURIComponent(content)}`;
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback to web Telegram
        const webUrl = `https://t.me/share/url?url=&text=${encodeURIComponent(content)}`;
        await Linking.openURL(webUrl);
      }
    }
  };

  const shareViaInstagram = async () => {
    const url = 'instagram://camera';
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Instagram not installed', 'Please install Instagram to share');
    }
  };

  const shareViaFacebook = async () => {
    const url = 'fb://facewebmodal/f?href=';
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      // Fallback to web Facebook
      await Linking.openURL('https://www.facebook.com');
    }
  };

  const shareViaDirectLink = async (content: string, images: string[] = []) => {
    if (images.length > 0) {
      // Share multiple images with Direct Link
      try {
        // For multiple images, we'll share them one by one
        for (let i = 0; i < images.length; i++) {
          await Share.share({
            message: i === 0 ? content : '', // Only include message with first image
            url: images[i],
            title: product.name,
          });
          // Small delay between shares to avoid overwhelming the system
          if (i < images.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } catch (error) {
        console.log('Error sharing multiple images, falling back to single image');
        await Share.share({
          message: content,
          url: images[0],
          title: product.name,
        });
      }
    } else {
      // Share text only
      await Share.share({
        message: content,
        title: product.name,
      });
    }
  };

  const shareViaEmail = async (content: string, images: string[] = []) => {
    if (images.length > 0) {
      // Share multiple images with Email
      try {
        // For multiple images, we'll share them one by one
        for (let i = 0; i < images.length; i++) {
          await Share.share({
            message: i === 0 ? content : '', // Only include message with first image
            url: images[i],
            title: `Check out this product: ${product.name}`,
          });
          // Small delay between shares to avoid overwhelming the system
          if (i < images.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } catch (error) {
        console.log('Error sharing multiple images, falling back to single image');
        await Share.share({
          message: content,
          url: images[0],
          title: `Check out this product: ${product.name}`,
        });
      }
    } else {
      // Fallback to mailto URL
      const subject = `Check out this product: ${product.name}`;
      const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(content)}`;
      await Linking.openURL(url);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Product</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Product Preview */}
        <View style={styles.productPreview}>
          <Text style={styles.previewTitle}>Product Preview</Text>
          <View style={styles.productCard}>
            <Image
              source={{ uri: productImages[0] || product.image }}
              style={styles.productImage}
              resizeMode="cover"
            />
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {product.name}
              </Text>
              
              {/* Price Display with Margin Information */}
              <View style={styles.priceContainer}>
                {product.resellPrice ? (
                  <>
                    <Text style={styles.resellPrice}>₹{product.resellPrice}</Text>
                    <View style={styles.marginInfo}>
                      <Text style={styles.basePrice}>Base: ₹{product.basePrice || product.price}</Text>
                      <Text style={styles.marginText}>+{product.margin}% margin</Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.productPrice}>₹{product.price}</Text>
                )}
              </View>
              
              <Text style={styles.productDescription} numberOfLines={3}>
                {product.description || 'Premium quality product'}
              </Text>
              <View style={styles.productDetails}>
                <Text style={styles.detailText}>Sizes: {availableSizes}</Text>
                <Text style={styles.detailText}>Colors: {availableColors}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Share Method Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Share Method</Text>
          <View style={styles.shareMethodGrid}>
            {shareMethods.map((method) => (
              <TouchableOpacity
                key={method.key}
                style={[
                  styles.shareMethodButton,
                  shareMethod === method.key && styles.shareMethodButtonSelected,
                ]}
                onPress={() => setShareMethod(method.key as any)}
              >
                <Ionicons
                  name={method.icon as any}
                  size={24}
                  color={shareMethod === method.key ? '#fff' : method.color}
                />
                <Text
                  style={[
                    styles.shareMethodLabel,
                    shareMethod === method.key && styles.shareMethodLabelSelected,
                  ]}
                >
                  {method.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Custom Message */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Message (Optional)</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Add a personal message to your catalog..."
            value={customMessage}
            onChangeText={setCustomMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>


        {/* Share Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Share Preview</Text>
          <View style={styles.sharePreview}>
            <Text style={styles.sharePreviewText}>{generateShareContent()}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Share Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.shareButton, (loading || downloadingImages) && styles.shareButtonDisabled]}
          onPress={handleShare}
          disabled={loading || downloadingImages}
        >
          {loading || downloadingImages ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.shareButtonText}>
                {downloadingImages ? 'Downloading Images...' : 
                 shareMethod === 'whatsapp' ? 'Sharing to WhatsApp...' : 'Sharing...'}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="share-social" size={20} color="#fff" />
              <Text style={styles.shareButtonText}>Share Product</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  productPreview: {
    marginTop: 16,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  productCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F53F7A',
    marginBottom: 8,
  },
  priceContainer: {
    marginBottom: 8,
  },
  resellPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 4,
  },
  marginInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  basePrice: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'line-through',
  },
  marginText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  productDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  productDetails: {
    gap: 2,
  },
  detailText: {
    fontSize: 12,
    color: '#999',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  shareMethodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  shareMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    gap: 8,
    minWidth: (screenWidth - 56) / 2,
  },
  shareMethodButtonSelected: {
    backgroundColor: '#F53F7A',
    borderColor: '#F53F7A',
  },
  shareMethodLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  shareMethodLabelSelected: {
    color: '#fff',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    height: 100,
  },
  sharePreview: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F53F7A',
  },
  sharePreviewText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  bottomContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default CatalogShare;
