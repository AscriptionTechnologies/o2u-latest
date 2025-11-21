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
  Share,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '~/utils/supabase';
import { useUser } from '~/contexts/UserContext';
import { useWishlist } from '~/contexts/WishlistContext';
import { getFirstSafeProductImage, getProductImages } from '../utils/imageUtils';

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

  // Get collection info from route params (either old or new format)
  const collectionId = (route.params as any)?.collectionId || (route.params as any)?.collection?.id;
  const collectionName = (route.params as any)?.collectionName || (route.params as any)?.collection?.name;
  
  const [collection, setCollection] = useState<Collection | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCustomCollection, setIsCustomCollection] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<any>(null);

  useEffect(() => {
    if (collectionId) {
      // Check if it's a custom collection (not "All" or category-based)
      const isCustom = collectionName !== 'All' && !collectionName?.startsWith('Swiped -') && !collectionName?.startsWith('Category:');
      setIsCustomCollection(isCustom);
      
      // Set collection info
      setCollection({
        id: collectionId,
        name: collectionName || 'Collection',
        is_private: false,
      });
      setNewCollectionName(collectionName || 'Collection');
      fetchCollectionProducts();
    }
  }, [collectionId, collectionName]);

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
          vendor_name,
          alias_vendor,
          variants:product_variants(
            price,
            mrp_price,
            rsp_price,
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
          
          // Calculate min RSP price, MRP, and stock from variants
          let minRspPrice = 0;
          let minMrpPrice = 0;
          let totalStock = 0;
          let maxDiscount = 0;
          
          if (variants.length > 0) {
            // Use RSP price (retail selling price) as the actual price
            const rspPrices = variants.map((v: any) => v.rsp_price || v.price || 0).filter((p: number) => p > 0);
            minRspPrice = rspPrices.length > 0 ? Math.min(...rspPrices) : 0;
            
            // Use MRP price as the original price (for strikethrough)
            const mrpPrices = variants.map((v: any) => v.mrp_price || 0).filter((p: number) => p > 0);
            minMrpPrice = mrpPrices.length > 0 ? Math.min(...mrpPrices) : 0;
            
            totalStock = variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0);
            const discounts = variants.map((v: any) => v.discount_percentage || 0);
            maxDiscount = Math.max(...discounts);
          }
          
          // Calculate discount percentage from MRP and RSP
          const calculatedDiscount = minMrpPrice > minRspPrice && minMrpPrice > 0
            ? Math.round(((minMrpPrice - minRspPrice) / minMrpPrice) * 100)
            : maxDiscount;

          // Ensure image_urls is an array
          let imageUrls = p.image_urls;
          if (!Array.isArray(imageUrls)) {
            imageUrls = imageUrls ? [imageUrls] : [];
          }

          return {
            id: p.id,
            name: p.name,
            description: p.description,
            vendor_name: p.vendor_name,
            alias_vendor: p.alias_vendor,
            price: minRspPrice, // RSP is the actual selling price
            originalPrice: minMrpPrice > minRspPrice ? minMrpPrice : undefined, // MRP as strikethrough
            discount: calculatedDiscount,
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

  const handleShareCollection = async () => {
    try {
      const collectionUrl = `https://only2u.app/collection/${collectionId}`;
      const message = `Check out my ${collection?.name || 'collection'} on Only2U! 🛍️\n\n${products.length} amazing products curated just for you.\n\n${collectionUrl}`;
      
      await Share.share({
        message: message,
        title: collection?.name || 'My Collection',
      });
    } catch (error) {
      console.error('Error sharing collection:', error);
    }
  };

  const handleRenameCollection = async () => {
    if (!newCollectionName.trim()) {
      Alert.alert('Error', 'Please enter a valid collection name');
      return;
    }

    if (newCollectionName.trim() === collection?.name) {
      setShowRenameModal(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('collections')
        .update({ name: newCollectionName.trim() })
        .eq('id', collectionId)
        .eq('user_id', userData?.id);

      if (error) throw error;

      // Update local state
      setCollection(prev => prev ? { ...prev, name: newCollectionName.trim() } : null);
      setShowRenameModal(false);
      
      Alert.alert('Success', 'Collection renamed successfully');
    } catch (error) {
      console.error('Error renaming collection:', error);
      Alert.alert('Error', 'Failed to rename collection. Please try again.');
    }
  };

  const handleDeleteCollection = async () => {
    Alert.alert(
      'Delete Collection',
      `Are you sure you want to delete "${collection?.name || 'this collection'}"? All products in this collection will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // First delete all products from this collection
              const { error: deleteProductsError } = await supabase
                .from('collection_products')
                .delete()
                .eq('collection_id', collectionId);

              if (deleteProductsError) throw deleteProductsError;

              // Then delete the collection itself
              const { error: deleteCollectionError } = await supabase
                .from('collections')
                .delete()
                .eq('id', collectionId)
                .eq('user_id', userData?.id);

              if (deleteCollectionError) throw deleteCollectionError;

              // Navigate back to Wishlist
              navigation.goBack();

              // Show success message
              Alert.alert('Success', 'Collection deleted successfully');
            } catch (error) {
              console.error('Error deleting collection:', error);
              Alert.alert('Error', 'Failed to delete collection. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleRemoveFromCollection = async () => {
    if (!itemToRemove) return;

    try {
      const { error } = await supabase
        .from('collection_products')
        .delete()
        .match({
          collection_id: collectionId,
          product_id: itemToRemove.id,
        });

      if (error) throw error;

      // Update local state
      setProducts(products.filter(p => p.id !== itemToRemove.id));
      
      // Close modal
      setShowRemoveModal(false);
      setItemToRemove(null);
      
      // Show success message
      Alert.alert('Success', 'Item removed from collection');
    } catch (error) {
      console.error('Error removing from collection:', error);
      Alert.alert('Error', 'Failed to remove item from collection');
      setShowRemoveModal(false);
      setItemToRemove(null);
    }
  };

  const renderProductItem = ({ item }: any) => {
    const discountPercent = item.discount ? Math.round(item.discount) : 0;
    const productImage = getFirstSafeProductImage(item);
    const hasValidPrice = item.price && item.price > 0;
    const hasDiscount = item.originalPrice && item.originalPrice > item.price && discountPercent > 0;
    
    // Debug logging
    console.log('Rendering product:', item.name);
    console.log('Product has variants:', item.variants?.length);
    console.log('Product image_urls:', item.image_urls);
    console.log('Resolved productImage:', productImage);
    
    return (
      <TouchableOpacity
        style={styles.productCard}
        activeOpacity={0.9}
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
        {/* Wishlist/Remove Heart Icon */}
        <TouchableOpacity
          style={styles.wishlistIcon}
          onPress={(e) => {
            e.stopPropagation();
            setItemToRemove(item);
            setShowRemoveModal(true);
          }}
          activeOpacity={0.7}>
          <Ionicons name="heart" size={22} color="#F53F7A" />
        </TouchableOpacity>

        {/* Product Image */}
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

        {/* Product Info */}
        <View style={styles.productInfo}>
          {/* Vendor Name */}
          <Text style={styles.vendorName} numberOfLines={1}>
            {item.vendor_name || item.alias_vendor || 'Only2U'}
          </Text>

          {/* Product Name */}
          <Text style={styles.productName} numberOfLines={2}>
            {item.name || 'Product Name'}
          </Text>

          {/* Price Container */}
          <View style={styles.priceContainer}>
            <View style={styles.priceInfo}>
              {hasValidPrice ? (
                <>
                  {hasDiscount && (
                    <Text style={styles.originalPrice}>
                      ₹{Math.round(item.originalPrice)}
                    </Text>
                  )}
                  <Text style={styles.price}>₹{Math.round(item.price)}</Text>
                  {hasDiscount && (
                    <View style={styles.discountBadgeInline}>
                      <Text style={styles.discountBadgeTextInline}>
                        {discountPercent}% OFF
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.priceUnavailable}>Price not available</Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
            <Ionicons name="lock-closed" size={20} color="#666" style={{ marginRight: 12 }} />
          )}
          {isCustomCollection && (
            <TouchableOpacity
              style={styles.renameButton}
              onPress={() => setShowRenameModal(true)}
            >
              <Ionicons name="create-outline" size={22} color="#3B82F6" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteCollection()}
          >
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => handleShareCollection()}
          >
            <Ionicons name="share-social" size={22} color="#F53F7A" />
          </TouchableOpacity>
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
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.productList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Rename Collection Modal */}
      <Modal
        visible={showRenameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rename Collection</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Collection Name</Text>
              <TextInput
                style={styles.textInput}
                value={newCollectionName}
                onChangeText={setNewCollectionName}
                placeholder="Enter collection name"
                placeholderTextColor="#999"
                maxLength={50}
                autoFocus
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowRenameModal(false);
                  setNewCollectionName(collection?.name || '');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleRenameCollection}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Remove Item Confirmation Modal */}
      <Modal
        visible={showRemoveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRemoveModal(false)}
      >
        <View style={styles.removeModalOverlay}>
          <View style={styles.removeModalContainer}>
            {/* Heart Icon */}
            <View style={styles.removeModalIconContainer}>
              <View style={styles.removeModalHeartCircle}>
                <Ionicons name="heart-dislike" size={40} color="#F53F7A" />
              </View>
            </View>

            {/* Title */}
            <Text style={styles.removeModalTitle}>Remove from Collection?</Text>

            {/* Product Info */}
            {itemToRemove && (
              <View style={styles.removeModalProductInfo}>
                <Image 
                  source={{ uri: getFirstSafeProductImage(itemToRemove) }} 
                  style={styles.removeModalProductImage}
                />
                <Text style={styles.removeModalProductName} numberOfLines={2}>
                  {itemToRemove.name}
                </Text>
              </View>
            )}

            {/* Message */}
            <Text style={styles.removeModalMessage}>
              This item will be removed from "{collection?.name}" collection
            </Text>

            {/* Buttons */}
            <View style={styles.removeModalButtons}>
              <TouchableOpacity
                style={styles.removeModalCancelButton}
                onPress={() => {
                  setShowRemoveModal(false);
                  setItemToRemove(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.removeModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.removeModalRemoveButton}
                onPress={handleRemoveFromCollection}
                activeOpacity={0.8}
              >
                <Text style={styles.removeModalRemoveText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  shareButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFF0F5',
  },
  renameButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EBF4FF',
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
    padding: 2, // Minimal padding for grid
  },
  columnWrapper: {
    gap: 4, // Gap between columns
  },
  productCard: {
    width: (width - 8) / 2, // Fixed width for 2 columns with gaps
    backgroundColor: '#fff',
    borderRadius: 0, // Myntra style - no rounded corners
    position: 'relative',
    marginBottom: 4,
    borderWidth: 0.5,
    borderColor: '#f0f0f0',
    // No shadows for cleaner look
  },
  productImage: {
    width: '100%',
    height: 240, // Taller image - Myntra style
    resizeMode: 'cover',
    backgroundColor: '#f9f9f9',
  },
  wishlistIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  productInfo: {
    padding: 12,
    paddingBottom: 14,
  },
  vendorName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#282c3f',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94969f', // Lighter color for product name - Myntra style
    paddingBottom: 4,
    lineHeight: 17,
    letterSpacing: 0.2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
  originalPrice: {
    fontSize: 11,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  discountBadgeInline: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  discountBadgeTextInline: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Remove Item Modal Styles
  removeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  removeModalContainer: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  removeModalIconContainer: {
    marginBottom: 16,
  },
  removeModalHeartCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#F53F7A',
  },
  removeModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  removeModalProductInfo: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  removeModalProductImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
  },
  removeModalProductName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  removeModalMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  removeModalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  removeModalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  removeModalRemoveButton: {
    flex: 1,
    backgroundColor: '#F53F7A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  removeModalRemoveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default CollectionDetails;

