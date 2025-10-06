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
import { useUser } from '~/contexts/UserContext';
import { useTranslation } from 'react-i18next';
import { getFirstSafeImageUrl, getProductImages, getFirstSafeProductImage } from '../utils/imageUtils';
import type { Product, ProductVariant, Color, Size } from '~/types/product';

interface Category {
  id: string;
  name: string;
}

const ProductManagement = () => {
  const navigation = useNavigation();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    image_urls: [] as string[],
    video_urls: [] as string[],
    stock_quantity: '',
    sku: '',
    discount_percentage: '',
    is_active: true,
    featured_type: null as 'trending' | 'best_seller' | null,
  });
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideos, setUploadingVideos] = useState(false);
  const { userData } = useUser();
  const { t } = useTranslation();

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchColors();
    fetchSizes();
  }, []);

  // Update variants whenever selectedColors or selectedSizes change
  useEffect(() => {
    console.log('🔄 Variants useEffect triggered:', { selectedColors, selectedSizes, editingProduct });
    
    // Don't update variants if we're editing and already have variants loaded
    if (editingProduct && variants.length > 0) {
      console.log('⏭️ Skipping variant update - editing mode with existing variants');
      return;
    }
    
    if (selectedColors.length > 0 && selectedSizes.length > 0) {
      updateVariants(selectedColors, selectedSizes);
    } else {
      setVariants([]);
    }
  }, [selectedColors, selectedSizes, editingProduct]);

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      // Read the image file
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Create a unique filename
      const fileName = `product_${Date.now()}.jpg`;
      const filePath = `products/${fileName}`;

      // Convert base64 to Uint8Array for upload
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('productsimages')
        .upload(filePath, bytes, {
          contentType: 'image/jpeg',
        });

      if (error) {
        console.error('Upload error:', error);
        Toast.show({
          type: 'error',
          text1: 'Upload Failed',
          text2: 'Failed to upload product image. Please try again.',
        });
        return null;
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('productsimages')
        .getPublicUrl(filePath);

      console.log('Product image uploaded successfully:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload Error',
        text2: 'An error occurred while uploading the image.',
      });
      return null;
    }
  };

  const uploadVideo = async (uri: string): Promise<string | null> => {
    try {
      // Read the video file
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error('File does not exist');
      const fileName = `product_${Date.now()}.mp4`;
      const filePath = `productvideos/${fileName}`;
      const videoData = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Convert base64 to Uint8Array
      const binaryString = atob(videoData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('productvideos')
        .upload(filePath, bytes, {
          contentType: 'video/mp4',
        });
      if (error) {
        console.error('Video upload error:', error);
        Toast.show({
          type: 'error',
          text1: 'Upload Failed',
          text2: 'Failed to upload product video. Please try again.',
        });
        return null;
      }
      const { data: urlData } = supabase.storage
        .from('productvideos')
        .getPublicUrl(filePath);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Product video uploaded successfully!',
      });
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading video:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload Error',
        text2: 'An error occurred while uploading the video.',
      });
      return null;
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          category_id,
          is_active,
          featured_type,
          like_count,
          return_policy,
          vendor_name,
          alias_vendor,
          created_at,
          updated_at,
          image_urls,
          video_urls,
          category:categories(name),
          variants:product_variants(
            id,
            color_id,
            size_id,
            quantity,
            created_at,
            updated_at,
            price,
            sku,
            mrp_price,
            rsp_price,
            cost_price,
            discount_percentage,
            image_urls,
            video_urls,
            color:colors(name, hex_code),
            size:sizes(name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
        Alert.alert(t('error'), t('failed_to_fetch_products'));
        return;
      }

      // Transform data to handle the new format
      const transformedData = (data || []).map((product: any) => ({
        ...product,
        image_urls: product.image_urls || [],
        video_urls: product.video_urls || [],
      }));

      setProducts(transformedData);
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert(t('error'), t('failed_to_fetch_products'));
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching categories:', error);
        return;
      }

      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchColors = async () => {
    try {
      const { data, error } = await supabase
        .from('colors')
        .select('id, name, hex_code');

      if (error) {
        console.error('Error fetching colors:', error);
        return;
      }

      setColors(data || []);
    } catch (error) {
      console.error('Error fetching colors:', error);
    }
  };

  const fetchSizes = async () => {
    try {
      const { data, error } = await supabase
        .from('sizes')
        .select('id, name, category_id');

      if (error) {
        console.error('Error fetching sizes:', error);
        return;
      }

      setSizes(data || []);
    } catch (error) {
      console.error('Error fetching sizes:', error);
    }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      category_id: '',
      image_urls: [],
      video_urls: [],
      stock_quantity: '',
      sku: '',
      discount_percentage: '',
      is_active: true,
      featured_type: null,
    });
    setSelectedColors([]);
    setSelectedSizes([]);
    setVariants([]);
    setModalVisible(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: (getSmallestPrice(product) || 0).toString(),
      category_id: product.category_id,
      image_urls: product.image_urls || [],
      video_urls: product.video_urls || [],
      stock_quantity: (product.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0).toString(),
      sku: product.variants?.[0]?.sku || '',
      discount_percentage: product.variants?.[0]?.discount_percentage?.toString() || '',
      is_active: product.is_active,
      featured_type: (product.featured_type as 'trending' | 'best_seller' | null) || null,
    });
    
    // Load existing variants if any
    if (product.variants && product.variants.length > 0) {
      const existingColors = [...new Set(product.variants.map(v => v.color_id).filter(Boolean))] as string[];
      const existingSizes = [...new Set(product.variants.map(v => v.size_id).filter(Boolean))] as string[];
      
      // Ensure all variants have prices set
      const variantsWithPrices = product.variants.map(variant => ({
        ...variant,
        price: variant.price || getSmallestPrice(product)
      }));
      
      setSelectedColors(existingColors);
      setSelectedSizes(existingSizes);
      setVariants(variantsWithPrices);
    } else {
      setSelectedColors([]);
      setSelectedSizes([]);
      setVariants([]);
    }
    
    setModalVisible(true);
  };

  const handleColorSelection = (colorId: string) => {
    const newSelectedColors = selectedColors.includes(colorId)
      ? selectedColors.filter(id => id !== colorId)
      : [...selectedColors, colorId];
    
    console.log('🎨 Color selection:', { colorId, currentColors: selectedColors, newColors: newSelectedColors });
    setSelectedColors(newSelectedColors);
  };

  const handleSizeSelection = (sizeId: string) => {
    const newSelectedSizes = selectedSizes.includes(sizeId)
      ? selectedSizes.filter(id => id !== sizeId)
      : [...selectedSizes, sizeId];
    
    console.log('📏 Size selection:', { sizeId, currentSizes: selectedSizes, newSizes: newSelectedSizes });
    setSelectedSizes(newSelectedSizes);
  };

  const updateVariants = (colors: string[], sizes: string[]) => {
    console.log('📝 updateVariants called with:', { colors, sizes });
    setVariants(prevVariants => {
      const newVariants: ProductVariant[] = [];
      const basePrice = parseFloat(formData.price) || 0;
      
      console.log('🔍 Previous variants:', prevVariants);
      
      // Create all possible combinations of selected colors and sizes
      colors.forEach(colorId => {
        sizes.forEach(sizeId => {
          // Check if variant already exists in previous variants
          const existingVariant = prevVariants.find(v => v.color_id === colorId && v.size_id === sizeId);
          if (existingVariant) {
            console.log('✅ Found existing variant:', existingVariant);
            newVariants.push(existingVariant);
          } else {
            console.log('🆕 Creating new variant:', { colorId, sizeId, price: basePrice });
            newVariants.push({
              id: '', // Will be set by database
              product_id: '', // Will be set when product is created
              color_id: colorId,
              size_id: sizeId,
              quantity: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              price: basePrice, // Set base price for new variants
              size: (sizes.find(s => s.id === sizeId) || { id: sizeId, name: 'Unknown' }) as Size,
            });
          }
        });
      });
      
      console.log('📋 Final variants:', newVariants);
      return newVariants;
    });
  };

  const updateVariantQuantity = (colorId: string, sizeId: string, quantity: number) => {
    setVariants(prev => prev.map(variant => 
      variant.color_id === colorId && variant.size_id === sizeId
        ? { ...variant, quantity }
        : variant
    ));
  };

  const updateVariantPrice = (colorId: string, sizeId: string, price: number) => {
    setVariants(prev => prev.map(variant => 
      variant.color_id === colorId && variant.size_id === sizeId
        ? { ...variant, price }
        : variant
    ));
  };

  const handleDeleteProduct = (product: Product) => {
    Alert.alert(
      t('delete_product'),
      t('delete_product_confirm', { name: product.name }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => deleteProduct(product.id),
        },
      ]
    );
  };

  const deleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) {
        console.error('Error deleting product:', error);
        Alert.alert(t('error'), t('failed_to_delete_product'));
        return;
      }

      Alert.alert(t('success'), t('product_deleted_successfully'));
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      Alert.alert(t('error'), t('failed_to_delete_product'));
    }
  };

  const handleImagePicker = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        setUploadingImages(true);
        
        const uploadedUrls: string[] = [];
        
        for (const asset of result.assets) {
          const imageUri = asset.uri;
          console.log('Image selected:', imageUri);
          
          // Upload the image to Supabase storage
          const uploadedUrl = await uploadImage(imageUri);
          if (uploadedUrl) {
            uploadedUrls.push(uploadedUrl);
            console.log('Image uploaded successfully, URL:', uploadedUrl);
          }
        }
        
        if (uploadedUrls.length > 0) {
          setFormData({ 
            ...formData, 
            image_urls: [...formData.image_urls, ...uploadedUrls] 
          });
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: `${uploadedUrls.length} image(s) uploaded successfully!`,
          });
        }
        
        setUploadingImages(false);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      setUploadingImages(false);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const handleVideoPicker = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access media library is required!');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: 1,
      });
      
      if (!result.canceled && result.assets.length > 0) {
        setUploadingVideos(true);
        
        const uploadedUrls: string[] = [];
        
        for (const asset of result.assets) {
          const videoUri = asset.uri;
          const uploadedUrl = await uploadVideo(videoUri);
          if (uploadedUrl) {
            uploadedUrls.push(uploadedUrl);
          }
        }
        
        if (uploadedUrls.length > 0) {
          setFormData({ 
            ...formData, 
            video_urls: [...formData.video_urls, ...uploadedUrls] 
          });
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: `${uploadedUrls.length} video(s) uploaded successfully!`,
          });
        }
        
        setUploadingVideos(false);
      }
    } catch (error) {
      console.error('Error picking videos:', error);
      setUploadingVideos(false);
      Alert.alert('Error', 'Failed to pick videos');
    }
  };

  const removeImage = (index: number) => {
    const newImageUrls = formData.image_urls.filter((_, i) => i !== index);
    setFormData({ ...formData, image_urls: newImageUrls });
  };

  const removeVideo = (index: number) => {
    const newVideoUrls = formData.video_urls.filter((_, i) => i !== index);
    setFormData({ ...formData, video_urls: newVideoUrls });
  };

  const handleSubmit = async () => {
    if (!formData.name?.trim() || !formData.category_id) {
      Alert.alert(t('error'), t('fill_all_required_fields'));
      return;
    }

    if (selectedColors.length === 0 || selectedSizes.length === 0) {
      Alert.alert(t('error'), t('select_at_least_one_color_and_size'));
      return;
    }

    try {
      setSubmitting(true);

      const productData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        // price: parseFloat(formData.price),
        category_id: formData.category_id,
        image_urls: formData.image_urls,
        video_urls: formData.video_urls,
        // stock_quantity: parseInt(formData.stock_quantity) || 0,
        sku: formData.sku?.trim() || '',
        discount_percentage: formData.discount_percentage ? parseFloat(formData.discount_percentage) : null,
        is_active: formData.is_active,
        featured_type: formData.featured_type,
        updated_at: new Date().toISOString(),
      };

      let productId: string;

      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) {
          console.error('Error updating product:', error);
          Alert.alert(t('error'), t('failed_to_update_product'));
          return;
        }

        productId = editingProduct.id;
        Alert.alert(t('success'), t('product_updated_successfully'));
      } else {
        // Create new product
        const { data, error } = await supabase
          .from('products')
          .insert(productData)
          .select('id')
          .single();

        if (error) {
          console.error('Error creating product:', error);
          Alert.alert(t('error'), t('failed_to_create_product'));
          return;
        }

        productId = data.id;
        Alert.alert(t('success'), t('product_created_successfully'));
      }

      // Handle variants
      if (variants.length > 0) {
        // Delete existing variants for this product
        if (editingProduct) {
          await supabase
            .from('product_variants')
            .delete()
            .eq('product_id', productId);
        }

        // Insert new variants
        const variantData = variants.map(variant => ({
          product_id: productId,
          color_id: variant.color_id,
          size_id: variant.size_id,
          quantity: variant.quantity,
          price: variant.price || parseFloat(formData.price),
        }));

        const { error: variantError } = await supabase
          .from('product_variants')
          .insert(variantData);

        if (variantError) {
          console.error('Error saving variants:', variantError);
          Alert.alert('Warning', 'Product saved but variants failed to save');
        }
      }

      setModalVisible(false);
      fetchProducts();
    } catch (error) {
      console.error('Error submitting product:', error);
      Alert.alert(t('error'), t('failed_to_save_product'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleProductStatus = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({
          is_active: !product.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);

      if (error) {
        console.error('Error updating product status:', error);
        Alert.alert(t('error'), t('failed_to_update_product_status'));
        return;
      }

      fetchProducts();
    } catch (error) {
      console.error('Error updating product status:', error);
      Alert.alert(t('error'), t('failed_to_update_product_status'));
    }
  };

  // Function to get user-specific price for a product
  const getUserPrice = (product: Product) => {
    if (!product.variants || product.variants.length === 0) {
      return 0; // No variants available
    }

    // If user has a size preference, try to find that size
    if (userData?.size) {
      const userSizeVariant = product.variants.find(v => 
        v.size?.name === userData.size
      );
      if (userSizeVariant) {
        return userSizeVariant.price || 0;
      }
    }

    // If user size not found or no user size, return the smallest price
    const sortedVariants = [...product.variants].sort((a, b) => (a.price || 0) - (b.price || 0));
    return sortedVariants[0]?.price || 0;
  };

  // Function to get the smallest price for a product
  const getSmallestPrice = (product: Product) => {
    if (!product.variants || product.variants.length === 0) {
      return 0;
    }
    const sortedVariants = [...product.variants].sort((a, b) => (a.price || 0) - (b.price || 0));
    return sortedVariants[0]?.price || 0;
  };

  const renderProductItem = (product: Product) => (
    <View key={product.id} style={styles.productItem}>
      <View style={styles.productInfo}>
        {(() => {
          const productImages = getProductImages(product);
          return productImages.length > 0 ? (
            <View style={styles.productImages}>
              {productImages.slice(0, 2).map((imageUrl, index) => (
                <Image key={index} source={{ uri: getFirstSafeImageUrl([imageUrl]) }} style={styles.productImage} />
              ))}
              {productImages.length > 2 && (
                <View style={styles.imageCountOverlay}>
                  <Text style={styles.imageCountText}>+{productImages.length - 2}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="image-outline" size={24} color="#999" />
            </View>
          );
        })()}
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={24} color="#999" />
          </View>
        )}
        <View style={styles.productDetails}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productCategory}>
            {product.category?.name || 'No Category'}
          </Text>
          <View style={styles.priceContainer}>
            <Text style={styles.productPrice}>₹{getUserPrice(product).toFixed(2)}</Text>
            {userData?.size && product.variants?.some(v => v.size?.name === userData.size) ? (
              <Text style={styles.sizeIndicator}>Your size</Text>
            ) : (
              <Text style={styles.sizeIndicator}>From</Text>
            )}
          </View>
          {product.discount_percentage && product.discount_percentage > 0 && (
            <Text style={styles.discountText}>{product.discount_percentage}% OFF</Text>
          )}
          
          {/* Variants Information */}
          {product.variants && product.variants.length > 0 && (
            <View style={styles.variantsInfo}>
              <View style={styles.variantsRow}>
                <Text style={styles.variantsLabel}>Colors: </Text>
                <View style={styles.colorList}>
                  {[...new Set(product.variants?.map(v => v.color?.name).filter(Boolean))].slice(0, 3).map((colorName, index) => (
                    <Text key={index} style={styles.colorName}>
                      {colorName}{index < Math.min(3, [...new Set(product.variants?.map(v => v.color?.name).filter(Boolean))].length) - 1 ? ', ' : ''}
                    </Text>
                  ))}
                  {[...new Set(product.variants?.map(v => v.color?.name).filter(Boolean))].length > 3 && (
                    <Text style={styles.colorName}>+{[...new Set(product.variants?.map(v => v.color?.name).filter(Boolean))].length - 3} more</Text>
                  )}
                </View>
              </View>
              <View style={styles.variantsRow}>
                <Text style={styles.variantsLabel}>Sizes: </Text>
                <View style={styles.sizeList}>
                  {[...new Set(product.variants?.map(v => v.size?.name).filter(Boolean))].slice(0, 3).map((sizeName, index) => (
                    <Text key={index} style={styles.sizeName}>
                      {sizeName}{index < Math.min(3, [...new Set(product.variants?.map(v => v.size?.name).filter(Boolean))].length) - 1 ? ', ' : ''}
                    </Text>
                  ))}
                  {[...new Set(product.variants?.map(v => v.size?.name).filter(Boolean))].length > 3 && (
                    <Text style={styles.sizeName}>+{[...new Set(product.variants?.map(v => v.size?.name).filter(Boolean))].length - 3} more</Text>
                  )}
                </View>
              </View>
              <Text style={styles.totalStock}>
                Total Stock: {product.variants?.reduce((sum, v) => sum + v.quantity, 0) || 0}
              </Text>
            </View>
          )}
          
          <View style={styles.productMeta}>
            {/* <Text style={styles.productStock}>Stock: {product.stock_quantity}</Text> */}
            <View style={styles.badgeContainer}>
              {product.featured_type && (
                <View style={[
                  styles.featuredBadge,
                  { backgroundColor: product.featured_type === 'trending' ? '#FF9800' : '#4CAF50' }
                ]}>
                  <Text style={styles.featuredBadgeText}>
                    {product.featured_type === 'trending' ? 'Trending' : 'Best Seller'}
                  </Text>
                </View>
              )}
              <View style={[
                styles.statusBadge,
                { backgroundColor: product.is_active ? '#E8F5E8' : '#FFE8E8' }
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: product.is_active ? '#4CAF50' : '#F44336' }
                ]}>
                  {product.is_active ? t('active') : t('inactive')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.productActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => toggleProductStatus(product)}
        >
          <Ionicons
            name={product.is_active ? "pause-circle-outline" : "play-circle-outline"}
            size={20}
            color={product.is_active ? "#FF9800" : "#4CAF50"}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditProduct(product)}
        >
          <Ionicons name="pencil-outline" size={20} color="#2196F3" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteProduct(product)}
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
        <Text style={styles.headerTitle}>{t('product_management')}</Text>
        <TouchableOpacity onPress={handleAddProduct} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#F53F7A" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F53F7A" />
          <Text style={styles.loadingText}>{t('loading_products')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {products.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={64} color="#999" />
              <Text style={styles.emptyTitle}>{t('no_products_found')}</Text>
              <Text style={styles.emptySubtitle}>{t('create_first_product')}</Text>
              <TouchableOpacity style={styles.createButton} onPress={handleAddProduct}>
                <Text style={styles.createButtonText}>{t('create_product')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.productsContainer}>
              {products.map(renderProductItem)}
            </View>
          )}
        </ScrollView>
      )}

      {/* Add/Edit Product Modal */}
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
              {editingProduct ? t('edit_product') : t('add_product')}
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
            {/* Product Images */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('product_images')} *</Text>
              <TouchableOpacity 
                style={styles.imagePickerButton} 
                onPress={handleImagePicker}
                disabled={uploadingImages}
              >
                <View style={styles.imagePlaceholder}>
                  {uploadingImages ? (
                    <ActivityIndicator size="large" color="#F53F7A" />
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={32} color="#999" />
                      <Text style={styles.imagePlaceholderText}>{t('tap_to_select_images')}</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
              
              {/* Display selected images */}
              {formData.image_urls.length > 0 && (
                <View style={styles.mediaGrid}>
                  {formData.image_urls.map((imageUrl, index) => (
                    <View key={index} style={styles.mediaItem}>
                      <Image source={{ uri: getFirstSafeImageUrl([imageUrl]) }} style={styles.mediaThumbnail} />
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeImage(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="#F44336" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Product Videos (Optional) */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('product_videos_optional')}</Text>
              <TouchableOpacity
                style={styles.imagePickerButton}
                onPress={handleVideoPicker}
                disabled={uploadingVideos}
              >
                <View style={styles.imagePlaceholder}>
                  {uploadingVideos ? (
                    <ActivityIndicator size="large" color="#F53F7A" />
                  ) : (
                    <>
                      <Ionicons name="videocam-outline" size={32} color="#999" />
                      <Text style={styles.imagePlaceholderText}>{t('tap_to_select_videos')}</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
              
              {/* Display selected videos */}
              {formData.video_urls.length > 0 && (
                <View style={styles.mediaGrid}>
                  {formData.video_urls.map((videoUrl, index) => (
                    <View key={index} style={styles.mediaItem}>
                      <View style={styles.videoThumbnail}>
                        <Ionicons name="videocam-outline" size={32} color="#999" />
                        <Text style={styles.videoFileName} numberOfLines={1}>
                          {videoUrl.split('/').pop()}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeVideo(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="#F44336" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Product Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('product_name')} *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder={t('enter_product_name')}
                placeholderTextColor="#999"
              />
            </View>

            {/* Category Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('category')} *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryChip,
                      formData.category_id === category.id && styles.selectedCategoryChip
                    ]}
                    onPress={() => setFormData({ ...formData, category_id: category.id })}
                  >
                    <Text style={[
                      styles.categoryChipText,
                      formData.category_id === category.id && styles.selectedCategoryChipText
                    ]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Featured Type Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Featured Type (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
                <TouchableOpacity
                  style={[
                    styles.categoryChip,
                    formData.featured_type === null && styles.selectedCategoryChip
                  ]}
                  onPress={() => setFormData({ ...formData, featured_type: null })}
                >
                  <Text style={[
                    styles.categoryChipText,
                    formData.featured_type === null && styles.selectedCategoryChipText
                  ]}>
                    None
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.categoryChip,
                    formData.featured_type === 'trending' && styles.selectedCategoryChip
                  ]}
                  onPress={() => setFormData({ ...formData, featured_type: 'trending' })}
                >
                  <Text style={[
                    styles.categoryChipText,
                    formData.featured_type === 'trending' && styles.selectedCategoryChipText
                  ]}>
                    Trending Now
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.categoryChip,
                    formData.featured_type === 'best_seller' && styles.selectedCategoryChip
                  ]}
                  onPress={() => setFormData({ ...formData, featured_type: 'best_seller' })}
                >
                  <Text style={[
                    styles.categoryChipText,
                    formData.featured_type === 'best_seller' && styles.selectedCategoryChipText
                  ]}>
                    Best Sellers
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Color Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Available Colors *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
                {colors.map((color) => (
                  <TouchableOpacity
                    key={color.id}
                    style={[
                      styles.colorChip,
                      selectedColors.includes(color.id) && styles.selectedColorChip
                    ]}
                    onPress={() => handleColorSelection(color.id)}
                  >
                    <View style={[
                      styles.colorIndicator,
                      { backgroundColor: color.hex_code }
                    ]} />
                    {/* <Text style={[
                      styles.colorChipText,
                      selectedColors.includes(color.id) && styles.selectedColorChipText
                    ]}>
                      {color.name}
                    </Text> */}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Size Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Available Sizes *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
                {sizes.map((size) => (
                  <TouchableOpacity
                    key={size.id}
                    style={[
                      styles.sizeChip,
                      selectedSizes.includes(size.id) && styles.selectedSizeChip
                    ]}
                    onPress={() => handleSizeSelection(size.id)}
                  >
                    <Text style={[
                      styles.sizeChipText,
                      selectedSizes.includes(size.id) && styles.selectedSizeChipText
                    ]}>
                      {size.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Variants Management */}
            {variants.length > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Inventory & Pricing by Color & Size</Text>
                <Text style={styles.formDescription}>
                  Set quantity and price for each color-size combination. Different colors or sizes can have different prices.
                </Text>
                
                {/* Visual separator */}
                <View style={styles.sectionSeparator} />
                
                {/* Header row for labels */}
                <View style={styles.variantsHeader}>
                  <View style={styles.variantHeaderInfo}>
                    <Text style={styles.variantsHeaderText}>Color - Size</Text>
                  </View>
                  <View style={styles.variantInputs}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>📦 Quantity</Text>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>💰 Price (₹)</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.variantsContainer}>
                  {variants.map((variant) => {
                    const color = colors.find(c => c.id === variant.color_id);
                    const size = sizes.find(s => s.id === variant.size_id);
                    
                    return (
                      <View key={`${variant.color_id}-${variant.size_id}`} style={styles.variantItem}>
                        <View style={styles.variantHeader}>
                          <View style={styles.variantInfo}>
                            <View style={[
                              styles.colorIndicator,
                              { backgroundColor: color?.hex_code || '#ccc' }
                            ]} />
                            <Text style={styles.variantText}>
                              {color?.name} - {size?.name}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.variantInputs}>
                          <View style={styles.inputGroup}>
                            <TextInput
                              style={styles.quantityInput}
                              value={variant.quantity.toString()}
                              onChangeText={(text) => updateVariantQuantity(
                                variant.color_id,
                                variant.size_id,
                                parseInt(text) || 0
                              )}
                              placeholder="0"
                              placeholderTextColor="#999"
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={styles.inputGroup}>
                            <TextInput
                              style={styles.priceInput}
                              value={variant.price?.toString() || ''}
                              onChangeText={(text) => updateVariantPrice(
                                variant.color_id,
                                variant.size_id,
                                parseFloat(text) || 0
                              )}
                              placeholder="0.00"
                              placeholderTextColor="#999"
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Price, Discount and Stock */}
            {/* <View style={styles.rowContainer}>
              <View style={styles.thirdField}>
                <Text style={styles.label}>Price (₹) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.price}
                  onChangeText={(text) => setFormData({ ...formData, price: text })}
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.thirdField}>
                <Text style={styles.label}>Discount (%)</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.discount_percentage}
                  onChangeText={(text) => setFormData({ ...formData, discount_percentage: text })}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.thirdField}>
                <Text style={styles.label}>Stock Quantity</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.stock_quantity}
                  onChangeText={(text) => setFormData({ ...formData, stock_quantity: text })}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>
            </View> */}

            <View style={styles.formGroup}>
                <Text style={styles.label}>Discount (%)</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.discount_percentage}
                  onChangeText={(text) => setFormData({ ...formData, discount_percentage: text })}
                  placeholder={t('discount_placeholder')}
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>

            {/* SKU */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('sku')}</Text>
              <TextInput
                style={styles.textInput}
                value={formData.sku}
                onChangeText={(text) => setFormData({ ...formData, sku: text })}
                placeholder={t('enter_product_sku')}
                placeholderTextColor="#999"
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('description')}</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder={t('enter_product_description')}
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
                {formData.is_active ? t('product_is_active') : t('product_is_inactive')}
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
  productsContainer: {
    padding: 16,
  },
  productItem: {
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
  productInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImages: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 4,
  },
  placeholderImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F53F7A',
    marginBottom: 4,
  },
  sizeIndicator: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  discountText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 4,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productStock: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  productActions: {
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
  formDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
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
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  halfField: {
    width: '48%',
  },
  thirdField: {
    width: '31%',
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
  categorySelector: {
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedCategoryChip: {
    backgroundColor: '#F53F7A',
    borderColor: '#F53F7A',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedCategoryChipText: {
    color: '#fff',
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
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featuredBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#fff',
  },
  // colorChip: {
  //   padding: 2,
  //   borderRadius: '50%',
  //   // backgroundColor: '#f0f0f0',
  //   marginRight: 8,
  //   borderWidth: 1,
  //   borderColor: '#e0e0e0',
  // },
  selectedColorChip: {
    width: 44,
    height: 44,
    borderRadius: 30,
    marginRight: 8,
    borderWidth: 2,
    // backgroundColor: '#F53F7A',
    borderColor: '#F53F7A',
  },
  colorChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedColorChipText: {
    color: '#fff',
  },
  sizeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedSizeChip: {
    backgroundColor: '#F53F7A',
    borderColor: '#F53F7A',
  },
  sizeChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedSizeChipText: {
    color: '#fff',
  },
  variantsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  variantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    marginBottom: 4,
    borderRadius: 6,
  },
  variantHeader: {
    flex: 1,
  },
  variantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  variantText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  quantityInput: {
    width: 80,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fff',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  priceInput: {
    width: 90,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fff',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  variantInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputGroup: {
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  variantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 8,
  },
  variantHeaderInfo: {
    flex: 1,
  },
  variantsHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  colorIndicator: {
    width: 40,
    height: 40,
    borderRadius: 30,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  variantsInfo: {
    marginBottom: 12,
  },
  variantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  variantsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  colorList: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorName: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  sizeList: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalStock: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  sizeName: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  mediaItem: {
    width: '33.33%',
    padding: 4,
  },
  mediaThumbnail: {
    width: '100%',
    height: 100,
    borderRadius: 6,
  },
  videoThumbnail: {
    width: '100%',
    height: 100,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoFileName: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 4,
  },
  imageCountOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 2,
  },
  imageCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ProductManagement;
