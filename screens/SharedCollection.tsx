import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '~/utils/supabase';
import { useUser } from '~/contexts/UserContext';
import { useWishlist } from '~/contexts/WishlistContext';
import { getFirstSafeProductImage, getProductImages } from '../utils/imageUtils';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

interface SharedCollectionData {
  id: string;
  name: string;
  owner_name: string;
  item_count: number;
  is_private: boolean;
}

const SharedCollection = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userData } = useUser();
  const { addToWishlist } = useWishlist();

  const shareToken = (route.params as any)?.shareToken;
  
  const [collection, setCollection] = useState<SharedCollectionData | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (shareToken) {
      fetchSharedCollection();
    }
  }, [shareToken]);

  const fetchSharedCollection = async () => {
    if (!shareToken) return;
    
    setLoading(true);
    try {
      // Increment view count and get collection ID
      const { data: collectionData, error: viewError } = await supabase
        .rpc('increment_collection_views', { 
          token: shareToken,
          viewer_id: userData?.id || null
        });

      if (viewError) {
        console.error('Error incrementing views:', viewError);
      }

      // Fetch collection details
      const { data: col, error: colError } = await supabase
        .from('collections')
        .select('id, name, user_id, is_private')
        .eq('share_token', shareToken)
        .eq('share_enabled', true)
        .single();

      if (colError || !col) {
        Alert.alert('Error', 'Collection not found or sharing is disabled');
        navigation.goBack();
        return;
      }

      // Fetch owner name
      const { data: owner } = await supabase
        .from('users')
        .select('name')
        .eq('id', col.user_id)
        .single();

      // Fetch products in this collection
      const { data: collectionProducts } = await supabase
        .from('collection_products')
        .select('product_id')
        .eq('collection_id', col.id);

      if (!collectionProducts || collectionProducts.length === 0) {
        setCollection({
          id: col.id,
          name: col.name,
          owner_name: owner?.name || 'Anonymous',
          item_count: 0,
          is_private: col.is_private,
        });
        setProducts([]);
        setLoading(false);
        return;
      }

      const productIds = collectionProducts.map((cp: any) => cp.product_id);

      // Fetch full product details with variants
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          image_urls,
          video_urls,
          vendor_name,
          alias_vendor,
          variants:product_variants(
            price,
            quantity,
            discount_percentage,
            image_urls,
            video_urls
          )
        `)
        .in('id', productIds);

      if (productsError) throw productsError;

      if (productsData) {
        const formattedProducts = productsData.map((p: any) => {
          const variants = p.variants || [];
          
          let minPrice = 0;
          let totalStock = 0;
          let maxDiscount = 0;
          
          if (variants.length > 0) {
            const prices = variants.map((v: any) => v.price || 0).filter((p: number) => p > 0);
            minPrice = prices.length > 0 ? Math.min(...prices) : 0;
            totalStock = variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0);
            const discounts = variants.map((v: any) => v.discount_percentage || 0);
            maxDiscount = Math.max(...discounts);
          }
          
          const originalPrice = maxDiscount > 0 ? minPrice / (1 - maxDiscount / 100) : minPrice;

          return {
            ...p,
            price: minPrice,
            originalPrice: originalPrice > minPrice ? originalPrice : undefined,
            discount: maxDiscount,
            stock: totalStock,
            variants: variants,
          };
        });

        setProducts(formattedProducts);
      }

      setCollection({
        id: col.id,
        name: col.name,
        owner_name: owner?.name || 'Anonymous',
        item_count: productIds.length,
        is_private: col.is_private,
      });
    } catch (error) {
      console.error('Error fetching shared collection:', error);
      Alert.alert('Error', 'Failed to load shared collection');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAllToWishlist = async () => {
    if (!userData?.id) {
      Toast.show({
        type: 'error',
        text1: 'Login Required',
        text2: 'Please log in to save this collection',
      });
      return;
    }

    setSaving(true);
    try {
      // Create a new collection for the user with the same name
      const { data: newCollection, error: createError } = await supabase
        .from('collections')
        .insert({
          user_id: userData.id,
          name: `${collection?.name} (Shared)`,
          is_private: false,
        })
        .select('id')
        .single();

      if (createError) throw createError;

      // Add all products to the new collection
      const collectionProductsToInsert = products.map(p => ({
        user_id: userData.id,
        collection_id: newCollection.id,
        product_id: p.id,
      }));

      const { error: insertError } = await supabase
        .from('collection_products')
        .insert(collectionProductsToInsert);

      if (insertError) throw insertError;

      // Also add to wishlist context
      products.forEach(product => {
        addToWishlist(product);
      });

      // Mark as saved in shared_collection_views
      await supabase
        .from('shared_collection_views')
        .update({ saved_to_wishlist: true })
        .eq('collection_id', collection?.id)
        .eq('viewer_user_id', userData.id);

      Toast.show({
        type: 'success',
        text1: 'Collection Saved!',
        text2: `${products.length} items added to your wishlist`,
      });

      // Navigate to the new collection
      setTimeout(() => {
        navigation.navigate('CollectionDetails' as never, {
          collectionId: newCollection.id,
          collectionName: `${collection?.name} (Shared)`,
        } as never);
      }, 1000);
    } catch (error) {
      console.error('Error saving collection:', error);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Failed to save collection to your wishlist',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderProductItem = ({ item }: any) => {
    const discountPercent = item.discount ? Math.round(item.discount) : 0;
    const productImage = getFirstSafeProductImage(item);
    const hasValidPrice = item.price && item.price > 0;
    
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => {
          const productForDetails = {
            id: item.id,
            name: item.name,
            price: item.price || 0,
            originalPrice: item.originalPrice,
            discount: discountPercent,
            rating: 4.5,
            reviews: 0,
            image: productImage,
            image_urls: getProductImages(item),
            description: item.description || '',
            stock: item.stock?.toString() || '0',
            images: item.image_urls?.length || 1,
            vendor_name: item.vendor_name || '',
            alias_vendor: item.alias_vendor || '',
          };
          (navigation as any).navigate('ProductDetails', { product: productForDetails });
        }}
      >
        <View style={styles.imageContainer}>
          {productImage ? (
            <Image 
              source={{ uri: productImage }} 
              style={styles.productImage}
            />
          ) : (
            <View style={[styles.productImage, styles.imagePlaceholder]}>
              <Ionicons name="image-outline" size={48} color="#ccc" />
            </View>
          )}
          {discountPercent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discountPercent}% OFF</Text>
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name || 'Product Name'}
          </Text>
          <View style={styles.priceContainer}>
            {hasValidPrice ? (
              <>
                <Text style={styles.price}>₹{item.price.toLocaleString()}</Text>
                {item.originalPrice && item.originalPrice > item.price && (
                  <Text style={styles.originalPrice}>
                    ₹{Math.round(item.originalPrice).toLocaleString()}
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.priceUnavailable}>Price unavailable</Text>
            )}
          </View>
          <View style={styles.stockBadge}>
            <Ionicons 
              name={item.stock > 0 ? 'checkmark-circle' : 'close-circle'} 
              size={14} 
              color={item.stock > 0 ? '#10b981' : '#ef4444'} 
            />
            <Text style={styles.stockText}>
              {item.stock > 0 ? 'In Stock' : 'Out of Stock'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F53F7A" />
          <Text style={styles.loadingText}>Loading shared collection...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{collection?.name || 'Shared Collection'}</Text>
          <Text style={styles.headerSubtitle}>
            Shared by {collection?.owner_name} • {collection?.item_count} items
          </Text>
        </View>
      </View>

      {/* Save Collection Button */}
      {userData?.id && products.length > 0 && (
        <View style={styles.saveContainer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSaveAllToWishlist}
            disabled={saving}
          >
            <Ionicons name="bookmark" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save All to My Wishlist'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Products Grid */}
      {products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>This collection is empty</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProductItem}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.productList}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  saveContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F53F7A',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  productList: {
    padding: 8,
  },
  productCard: {
    width: (width - 32) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  imageContainer: {
    position: 'relative',
    height: 200,
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#F53F7A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    lineHeight: 18,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginLeft: 6,
  },
  priceUnavailable: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stockText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
});

export default SharedCollection;

