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

  const collection = (route.params as any)?.collection as Collection;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCollectionProducts();
  }, [collection?.id]);

  const fetchCollectionProducts = async () => {
    if (!collection?.id || !userData?.id) return;
    
    setLoading(true);
    try {
      // Fetch products in this collection
      const { data: collectionProducts, error: cpError } = await supabase
        .from('collection_products')
        .select('product_id')
        .eq('collection_id', collection.id);

      if (cpError) throw cpError;

      if (!collectionProducts || collectionProducts.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const productIds = collectionProducts.map((cp: any) => cp.product_id);

      // Fetch full product details - simplified query to avoid relationship issues
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          price,
          image_urls,
          stock_quantity,
          discount_percentage,
          original_price
        `)
        .in('id', productIds);

      if (productsError) throw productsError;

      if (productsData) {
        const formattedProducts = productsData.map((p: any) => {
          // Use product's base price and original price for discount calculation
          const price = p.price || 0;
          const originalPrice = p.original_price || price;

          return {
            id: p.id,
            name: p.name,
            description: p.description,
            price: price,
            originalPrice: originalPrice > price ? originalPrice : undefined,
            discount: p.discount_percentage,
            image_urls: p.image_urls,
            stock: p.stock_quantity || 0,
          };
        });

        setProducts(formattedProducts);
      }
    } catch (error) {
      console.error('Error fetching collection products:', error);
      Alert.alert('Error', 'Failed to load collection products');
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
                  collection_id: collection.id,
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

  const renderProductItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => {
        const productForDetails = {
          id: item.id,
          name: item.name,
          price: item.price,
          originalPrice: item.originalPrice,
          rating: 4.5,
          reviews: 0,
          image: getFirstSafeProductImage(item),
          image_urls: getProductImages(item),
          description: item.description,
          stock: item.stock || '0',
          images: item.image_urls?.length || 1,
        };
        (navigation as any).navigate('ProductDetails', { product: productForDetails });
      }}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: getFirstSafeProductImage(item) }} style={styles.productImage} />
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveFromCollection(item.id)}
        >
          <Ionicons name="close-circle" size={24} color="#F53F7A" />
        </TouchableOpacity>
        {item.discount && item.discount > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{item.discount}% OFF</Text>
          </View>
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>₹{item.price.toLocaleString()}</Text>
          {item.originalPrice && item.originalPrice > item.price && (
            <Text style={styles.originalPrice}>₹{item.originalPrice.toLocaleString()}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

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
});

export default CollectionDetails;

