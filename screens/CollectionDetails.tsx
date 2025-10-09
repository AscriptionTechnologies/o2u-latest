import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '~/utils/supabase';
import { useUser } from '~/contexts/UserContext';
import { useWishlist } from '~/contexts/WishlistContext';
import { getFirstSafeProductImage, getProductImages } from '../utils/imageUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface Collection {
  id: string;
  name: string;
  is_private: boolean;
}

const CollectionDetails = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userData } = useUser();
  const { removeFromWishlist } = useWishlist();
  const insets = useSafeAreaInsets();

  // Get collection info from route params (either old or new format)
  const collectionId = (route.params as any)?.collectionId || (route.params as any)?.collection?.id;
  const collectionName = (route.params as any)?.collectionName || (route.params as any)?.collection?.name;
  
  const [collection, setCollection] = useState<Collection | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (collectionId) {
      // Set collection info
      setCollection({
        id: collectionId,
        name: collectionName || 'Collection',
        is_private: false,
      });
      fetchCollectionProducts();
    }
  }, [collectionId]);

  const fetchCollectionProducts = async () => {
    if (!collectionId || !userData?.id) return;
    
    setLoading(true);
    try {
      // Fetch products in this collection
      const { data: collectionProducts, error: cpError } = await supabase
        .from('collection_products')
        .select('product_id')
        .eq('collection_id', collectionId);

      if (cpError) throw cpError;

      if (!collectionProducts || collectionProducts.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const productIds = collectionProducts.map((cp: any) => cp.product_id);

      // Fetch full product details with variants for pricing and images
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          image_urls,
          video_urls,
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
          // Get pricing from variants
          const variants = p.variants || [];
          
          // Calculate min price and stock from variants
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
          
          // Calculate original price from discount
          const originalPrice = maxDiscount > 0 ? minPrice / (1 - maxDiscount / 100) : minPrice;

          // Ensure image_urls is an array
          let imageUrls = p.image_urls;
          if (!Array.isArray(imageUrls)) {
            imageUrls = imageUrls ? [imageUrls] : [];
          }

          return {
            id: p.id,
            name: p.name,
            description: p.description,
            price: minPrice,
            originalPrice: originalPrice > minPrice ? originalPrice : undefined,
            discount: maxDiscount,
            image_urls: imageUrls,
            video_urls: p.video_urls || [],
            variants: variants,  // Include variants so getFirstSafeProductImage can access variant images
            stock: totalStock,
          };
        });

        console.log('Formatted products:', formattedProducts.length, 'products loaded');
        if (formattedProducts.length > 0) {
          console.log('Sample product:', JSON.stringify(formattedProducts[0], null, 2));
          console.log('Sample product image_urls:', formattedProducts[0].image_urls);
          console.log('Sample product variants:', formattedProducts[0].variants?.length);
          if (formattedProducts[0].variants?.[0]) {
            console.log('Sample variant image_urls:', formattedProducts[0].variants[0].image_urls);
          }
        }
        setProducts(formattedProducts);
      }
    } catch (error) {
      console.error('Error fetching collection products:', error);
      Alert.alert('Error', 'Failed to load collection products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromCollection = async (productId: string) => {
    Alert.alert(
      'Remove from Collection',
      'Are you sure you want to remove this item from the collection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('collection_products')
                .delete()
                .match({
                  collection_id: collectionId,
                  product_id: productId,
                });

              if (error) throw error;

              // Update local state
              setProducts(products.filter(p => p.id !== productId));
            } catch (error) {
              console.error('Error removing from collection:', error);
              Alert.alert('Error', 'Failed to remove item from collection');
            }
          },
        },
      ]
    );
  };

  const renderProductItem = ({ item }: any) => {
    const discountPercent = item.discount ? Math.round(item.discount) : 0;
    const productImage = getFirstSafeProductImage(item);
    const hasValidPrice = item.price && item.price > 0;
    
    // Debug logging
    console.log('Rendering product:', item.name);
    console.log('Product has variants:', item.variants?.length);
    console.log('Product image_urls:', item.image_urls);
    console.log('Resolved productImage:', productImage);
    
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
          <TouchableOpacity
            style={styles.removeButton}
            onPress={(e) => {
              e.stopPropagation();
              handleRemoveFromCollection(item.id);
            }}
          >
            <Ionicons name="close-circle" size={24} color="#F53F7A" />
          </TouchableOpacity>
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
              <Text style={styles.priceUnavailable}>Price not available</Text>
            )}
          </View>
          {item.stock > 0 ? (
            <View style={styles.stockBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
              <Text style={styles.stockText}>{item.stock} in stock</Text>
            </View>
          ) : hasValidPrice && (
            <View style={[styles.stockBadge, { opacity: 0.6 }]}>
              <Ionicons name="close-circle" size={12} color="#FF3B30" />
              <Text style={[styles.stockText, { color: '#FF3B30' }]}>Out of stock</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{collection?.name || 'Collection'}</Text>
          <Text style={styles.headerSubtitle}>{products.length} items</Text>
        </View>
        <View style={styles.headerRight}>
          {collection?.is_private && (
            <Ionicons name="lock-closed" size={20} color="#666" />
          )}
        </View>
      </View>

      {/* Products Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F53F7A" />
          <Text style={styles.loadingText}>Loading collection...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No items yet</Text>
          <Text style={styles.emptySubtitle}>
            Products you save to this collection will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.productList}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  productList: {
    padding: 8,
  },
  productCard: {
    width: (width - 24) / 2,
    margin: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: (width - 24) / 2,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    lineHeight: 18,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F53F7A',
  },
  originalPrice: {
    fontSize: 13,
    color: '#999',
    textDecorationLine: 'line-through',
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
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  stockText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
  imagePlaceholder: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceUnavailable: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
});

export default CollectionDetails;

