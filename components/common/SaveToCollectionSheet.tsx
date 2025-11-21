import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet, ActivityIndicator, Image, Modal, Alert } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { useUser } from '~/contexts/UserContext';
import { useWishlist } from '~/contexts/WishlistContext';
import { useTranslation } from 'react-i18next';
import { getFirstSafeImageUrl } from '../../utils/imageUtils';
import Toast from 'react-native-toast-message';

interface Collection {
  id: string;
  name: string;
  is_private: boolean;
  item_count?: number;
  image?: string; // Added for new collection image
}

interface SaveToCollectionSheetProps {
  visible: boolean;
  product: any | null;
  onClose: () => void;
  onSaved?: (product: any, collectionName: string) => void;
  onShowNotification?: (type: 'added' | 'removed', title: string, subtitle?: string) => void;
}

const SaveToCollectionSheet: React.FC<SaveToCollectionSheetProps> = ({ visible, product, onClose, onSaved, onShowNotification }) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['60%'], []);
  const { userData } = useUser();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [addingToCollectionId, setAddingToCollectionId] = useState<string | null>(null);
  const { addToWishlist, isInWishlist, removeFromWishlist } = useWishlist();
  const { t } = useTranslation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [productInCollections, setProductInCollections] = useState<string[]>([]);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [collectionToRemoveFrom, setCollectionToRemoveFrom] = useState<Collection | null>(null);
  const [showRemoveAllModal, setShowRemoveAllModal] = useState(false);

  // Fetch collections
  const fetchCollections = useCallback(async () => {
    if (!userData?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('collections')
      .select('id, name, is_private, collection_products(count)')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false });
    if (!error && data) {
      const collections = data.map((c: any) => ({
        id: c.id,
        name: c.name,
        is_private: c.is_private,
        item_count: c.collection_products?.[0]?.count || 0,
      }));
      
      // Sort collections to put "All" at the top
      const sortedCollections = collections.sort((a, b) => {
        if (a.name === 'All') return -1;
        if (b.name === 'All') return 1;
        return 0;
      });
      
      setCollections(sortedCollections);
    }
    setLoading(false);
  }, [userData?.id]);

  useEffect(() => {
    if (visible) {
      fetchCollections();
      fetchProductCollections();
      setNewCollectionName('');
    }
  }, [visible, fetchCollections, product?.id]);

  // Additional effect to refresh when sheet becomes visible after a delay
  useEffect(() => {
    if (visible) {
      // Refresh collections and product status after a short delay
      const refreshTimer = setTimeout(() => {
        fetchCollections();
        fetchProductCollections();
      }, 200);
      
      return () => clearTimeout(refreshTimer);
    }
  }, [visible]);

  // Fetch which collections this product is already in
  const fetchProductCollections = async () => {
    if (!product?.id || !userData?.id) return;
    
    try {
      const { data: collectionProducts } = await supabase
        .from('collection_products')
        .select('collection_id')
        .eq('product_id', product.id);

      if (collectionProducts) {
        const collectionIds = collectionProducts.map(cp => cp.collection_id);
        setProductInCollections(collectionIds);
      }
    } catch (error) {
      console.error('Error fetching product collections:', error);
    }
  };

  // Handle add to collection
  const handleAddToCollection = async (collectionId: string) => {
    if (!product?.id) return;
    setAddingToCollectionId(collectionId);
    
    // Find collection name for the alert
    const collection = collections.find(c => c.id === collectionId);
    const collectionName = collection?.name || 'Collection';
    
    // First, ensure the "All" collection exists and add product to it
    if (collectionName !== 'All' && userData?.id) {
      try {
        // Get or create "All" collection
        let allCollectionId = null;
        const { data: existingAllCollection } = await supabase
          .from('collections')
          .select('id')
          .eq('user_id', userData.id)
          .eq('name', 'All')
          .single();

        if (existingAllCollection) {
          allCollectionId = existingAllCollection.id;
        } else {
          // Create "All" collection
          const { data: newAllCollection } = await supabase
            .from('collections')
            .insert({
              user_id: userData.id,
              name: 'All',
              is_private: true,
            })
            .select()
            .single();
          
          if (newAllCollection) {
            allCollectionId = newAllCollection.id;
          }
        }

        // Add product to "All" collection if it doesn't exist there
        if (allCollectionId) {
          const { data: existingInAll } = await supabase
            .from('collection_products')
            .select('id')
            .eq('product_id', product.id)
            .eq('collection_id', allCollectionId)
            .single();

          if (!existingInAll) {
            await supabase.from('collection_products').insert({
              collection_id: allCollectionId,
              product_id: product.id,
            });
          }
        }
      } catch (error) {
        console.error('Error adding to "All" collection:', error);
      }
    }

    // Now add to the selected collection
    const { error } = await supabase.from('collection_products').insert({
      collection_id: collectionId,
      product_id: product.id,
    });
    if (!isInWishlist(product.id)) {
      addToWishlist(product);
    }
    setAddingToCollectionId(null);
    if (!error) {
      // Add collection to the list of collections this product is in
      setProductInCollections([...productInCollections, collectionId]);
      
      // Call the onSaved callback instead of showing toast
      if (onSaved) {
        onSaved(product, collectionName);
      }
      
      // Don't show toast here - the onSaved callback will handle it
    } else {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to add to collection.',
        position: 'bottom',
        visibilityTime: 2000,
      });
    }
  };

  // Handle create new collection
  const handleCreateCollection = async () => {
    if (!userData?.id || !newCollectionName?.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.from('collections').insert({
      user_id: userData.id,
      name: newCollectionName.trim(),
      is_private: true,
    }).select();
    setCreating(false);
    if (!error && data && data[0]) {
      setCollections([{
        id: data[0].id,
        name: data[0].name,
        is_private: data[0].is_private,
        item_count: 0,
      }, ...collections]);
      setNewCollectionName('');
    } else {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create collection.',
        position: 'bottom',
        visibilityTime: 2000,
      });
    }
  };

  // Handle removing from all collections
  const handleRemoveFromAllCollections = () => {
    if (!product?.id || !userData?.id) return;
    setShowRemoveAllModal(true);
  };

  // Confirm and execute removal from all collections
  const confirmRemoveFromAllCollections = async () => {
    if (!product?.id || !userData?.id) return;

    try {
      // Get all collections that contain this product
      const { data: userCollections } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', userData.id);

      if (userCollections && userCollections.length > 0) {
        const collectionIds = userCollections.map(c => c.id);

        // Delete from all collection_products entries
        const { error } = await supabase
          .from('collection_products')
          .delete()
          .eq('product_id', product.id)
          .in('collection_id', collectionIds);

        if (!error) {
          // Update local state
          setProductInCollections([]);
          
          // Remove from wishlist context
          removeFromWishlist(product.id);

          // Close the modal
          setShowRemoveAllModal(false);

          // Show custom notification if callback provided
          if (onShowNotification) {
            onShowNotification('removed', 'Removed from Wishlist', 'Item removed from all collections');
          }

          // Close the sheet
          onClose();
        } else {
          console.error('Error removing from collections:', error);
          setShowRemoveAllModal(false);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to remove from wishlist',
            position: 'bottom',
          });
        }
      }
    } catch (error) {
      console.error('Error removing from all collections:', error);
      setShowRemoveAllModal(false);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Something went wrong',
        position: 'bottom',
      });
    }
  };

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      // Reset any loading states when sheet becomes visible
      setAddingToCollectionId(null);
    }
  }, [visible]);

  // Render collection item (updated)
  const renderCollection = ({ item }: { item: Collection }) => {
    const isProductInCollection = productInCollections.includes(item.id);
    
    return (
      <View style={styles.collectionRow}>
        <Image source={{ uri: item.image || 'https://via.placeholder.com/44' }} style={styles.collectionImage} />
        <View style={{ flex: 1 }}>
          <Text style={styles.collectionName}>{item.name}</Text>
          <Text style={styles.collectionMeta}>
            {isProductInCollection ? 'Already added' : 'Private'}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={() => {
            if (isProductInCollection) {
              // Show remove confirmation modal
              setCollectionToRemoveFrom(item);
              setShowRemoveModal(true);
            } else {
              // Add to collection
              handleAddToCollection(item.id);
            }
          }} 
          disabled={addingToCollectionId === item.id}
        >
          {addingToCollectionId === item.id ? (
            <ActivityIndicator size="small" color="#F53F7A" />
          ) : isProductInCollection ? (
            <Ionicons name="checkmark-circle" size={28} color="#F53F7A" />
          ) : (
            <Ionicons name="add-circle-outline" size={28} color="#888" />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Don't render if no product data
  if (!product) {
    return null;
  }

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={visible ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
    >
      <View style={styles.sheetContent}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Image
                            source={{ uri: getFirstSafeImageUrl(product?.image_urls || [product?.image_url]) }}
            style={styles.productImage}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Wishlist</Text>
            <Text style={styles.headerSubtitle}>Private</Text>
          </View>
          <TouchableOpacity 
            onPress={handleRemoveFromAllCollections}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="heart" size={28} color="#F53F7A" />
          </TouchableOpacity>
        </View>
        {/* Collections Title Row */}
        <View style={styles.collectionsTitleRow}>
          <Text style={styles.collectionsTitle}>Collections</Text>
          <TouchableOpacity onPress={() => setShowCreateModal(true)}>
            <Text style={styles.newCollectionLink}>New collection</Text>
          </TouchableOpacity>
        </View>
        {/* Collections List */}
        {loading ? (
          <ActivityIndicator size="large" color="#F53F7A" style={{ marginVertical: 24 }} />
        ) : (
          <FlatList
            data={collections}
            renderItem={renderCollection}
            keyExtractor={item => item.id}
            ListEmptyComponent={<Text style={{ color: '#888', marginVertical: 24 }}>{t('no_collections_found')}</Text>}
            style={{ marginBottom: 16 }}
          />
        )}
        {/* Plus icon at the bottom center */}
        <TouchableOpacity style={styles.fab} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add-circle-outline" size={55} color="#888" />
        </TouchableOpacity>
        {/* Create Collection Modal */}
        <Modal
          visible={showCreateModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create New Collection</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={t('create_new_collection')}
                value={newCollectionName}
                onChangeText={setNewCollectionName}
                editable={!creating}
                onSubmitEditing={handleCreateCollection}
                returnKeyType="done"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 }}>
                <TouchableOpacity onPress={() => setShowCreateModal(false)} style={{ marginRight: 16 }}>
                  <Text style={{ color: '#888', fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={async () => { await handleCreateCollection(); setShowCreateModal(false); }} disabled={creating || !newCollectionName?.trim()}>
                  {creating ? <ActivityIndicator size="small" color="#F53F7A" /> : <Text style={{ color: '#F53F7A', fontWeight: '700', fontSize: 16 }}>Create</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Remove from Collection Confirmation Modal */}
        <Modal
          visible={showRemoveModal}
          transparent={true}
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
              {product && (
                <View style={styles.removeModalProductInfo}>
                  <Image 
                    source={{ uri: product.image_urls?.[0] || product.image_url || 'https://via.placeholder.com/80' }} 
                    style={styles.removeModalProductImage}
                  />
                  <Text style={styles.removeModalProductName} numberOfLines={2}>
                    {product.name}
                  </Text>
                </View>
              )}

              {/* Message */}
              <Text style={styles.removeModalMessage}>
                Remove this item from "{collectionToRemoveFrom?.name}" collection?
              </Text>

              {/* Buttons */}
              <View style={styles.removeModalButtons}>
                <TouchableOpacity
                  style={styles.removeModalCancelButton}
                  onPress={() => {
                    setShowRemoveModal(false);
                    setCollectionToRemoveFrom(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.removeModalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.removeModalRemoveButton}
                  onPress={async () => {
                    if (!collectionToRemoveFrom || !product) return;
                    
                    try {
                      // Remove from database
                      const { error } = await supabase
                        .from('collection_products')
                        .delete()
                        .match({
                          collection_id: collectionToRemoveFrom.id,
                          product_id: product.id,
                        });

                      if (!error) {
                        // Update local state
                        const updatedCollections = productInCollections.filter(id => id !== collectionToRemoveFrom.id);
                        setProductInCollections(updatedCollections);
                        
                        // If this was the last collection, remove from wishlist context
                        if (updatedCollections.length === 0) {
                          removeFromWishlist(product.id);
                        }

                        // Don't show toast here - will be handled by parent if needed
                      }
                    } catch (error) {
                      console.error('Error removing from collection:', error);
                    }
                    
                    setShowRemoveModal(false);
                    setCollectionToRemoveFrom(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.removeModalRemoveText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Remove from ALL Collections Confirmation Modal */}
        <Modal
          visible={showRemoveAllModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowRemoveAllModal(false)}
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
              <Text style={styles.removeModalTitle}>Remove from Wishlist?</Text>

              {/* Product Info */}
              {product && (
                <View style={styles.removeModalProductInfo}>
                  <Image 
                    source={{ uri: product.image_urls?.[0] || product.image_url || 'https://via.placeholder.com/80' }} 
                    style={styles.removeModalProductImage}
                  />
                  <Text style={styles.removeModalProductName} numberOfLines={2}>
                    {product.name}
                  </Text>
                </View>
              )}

              {/* Message */}
              <Text style={styles.removeModalMessage}>
                This will remove this item from ALL collections. Are you sure?
              </Text>

              {/* Buttons */}
              <View style={styles.removeModalButtons}>
                <TouchableOpacity
                  style={styles.removeModalCancelButton}
                  onPress={() => setShowRemoveAllModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.removeModalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.removeModalRemoveButton}
                  onPress={confirmRemoveFromAllCollections}
                  activeOpacity={0.8}
                >
                  <Text style={styles.removeModalRemoveText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  sheetContent: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  collectionsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  collectionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    flex: 1,
  },
  newCollectionLink: {
    color: '#4F6EF7',
    fontWeight: '600',
    fontSize: 16,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  collectionImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#eee',
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  collectionMeta: {
    fontSize: 13,
    color: '#888',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 15,
    padding: 6,
    color: '#222',
  },
  createBtn: {
    color: '#F53F7A',
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 24,
    zIndex: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 320,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#fafbfc',
  },
  // Remove Modal Styles
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

export default SaveToCollectionSheet; 