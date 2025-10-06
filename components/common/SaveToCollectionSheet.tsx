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
}

const SaveToCollectionSheet: React.FC<SaveToCollectionSheetProps> = ({ visible, product, onClose, onSaved }) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['60%'], []);
  const { userData } = useUser();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [addingToCollectionId, setAddingToCollectionId] = useState<string | null>(null);
  const { addToWishlist, isInWishlist } = useWishlist();
  const { t } = useTranslation();
  const [showCreateModal, setShowCreateModal] = useState(false);

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
      setCollections(
        data.map((c: any) => ({
          id: c.id,
          name: c.name,
          is_private: c.is_private,
          item_count: c.collection_products?.[0]?.count || 0,
        }))
      );
    }
    setLoading(false);
  }, [userData?.id]);

  useEffect(() => {
    if (visible) {
      fetchCollections();
      setNewCollectionName('');
    }
  }, [visible, fetchCollections]);

  // Handle add to collection
  const handleAddToCollection = async (collectionId: string) => {
    if (!product?.id) return;
    setAddingToCollectionId(collectionId);
    
    // Find collection name for the alert
    const collection = collections.find(c => c.id === collectionId);
    const collectionName = collection?.name || 'Collection';
    
    const { error } = await supabase.from('collection_products').insert({
      collection_id: collectionId,
      product_id: product.id,
    });
    if (!isInWishlist(product.id)) {
      addToWishlist(product);
    }
    setAddingToCollectionId(null);
    if (!error) {
      // Call the onSaved callback instead of showing toast
      if (onSaved) {
        onSaved(product, collectionName);
      }
      onClose();
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

  // Open/close bottom sheet
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible]);

  // Render collection item (updated)
  const renderCollection = ({ item }: { item: Collection }) => (
    <View style={styles.collectionRow}>
      <Image source={{ uri: item.image || 'https://via.placeholder.com/44' }} style={styles.collectionImage} />
      <View style={{ flex: 1 }}>
        <Text style={styles.collectionName}>{item.name}</Text>
        <Text style={styles.collectionMeta}>Private</Text>
      </View>
      <TouchableOpacity onPress={() => handleAddToCollection(item.id)} disabled={addingToCollectionId === item.id}>
        {addingToCollectionId === item.id ? (
          <ActivityIndicator size="small" color="#F53F7A" />
        ) : (
          <Ionicons name="add-circle-outline" size={28} color="#888" />
        )}
      </TouchableOpacity>
    </View>
  );

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
          <Ionicons name="heart" size={28} color="#F53F7A" />
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
});

export default SaveToCollectionSheet; 