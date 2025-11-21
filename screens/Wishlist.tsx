import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, Dimensions, ActivityIndicator, Linking, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useWishlist } from '~/contexts/WishlistContext';
import { usePreview } from '~/contexts/PreviewContext';
import { useNotifications } from '~/contexts/NotificationsContext';
import { supabase } from '~/utils/supabase';
import { useUser } from '~/contexts/UserContext';
import { useTranslation } from 'react-i18next';
import { getFirstSafeImageUrl, getProductImages, getFirstSafeProductImage, preferApiRenderedImageFirst, getSafeImageUrl } from '../utils/imageUtils';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

interface Collection {
  id: string;
  name: string;
  is_private: boolean;
  item_count: number;
  cover_images: string[]; // Array of up to 4 image URLs for the folder cover
}

// Notifications come from context now

const Wishlist = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { wishlist, removeFromWishlist, clearWishlist, markAllAsRead: markWishlistAsRead, unreadCount: wishlistUnreadCount } = useWishlist();
  const { previewProducts, removeFromPreview } = usePreview();
  const { notifications, removeNotification, markAllRead } = useNotifications();
  const { userData } = useUser();
  const [activeTab, setActiveTab] = React.useState(() => {
    // Set initial tab based on route params
    if ((route.params as any)?.notifications) return 'notifications';
    if ((route.params as any)?.preview) return 'preview';
    return 'wishlist';
  });
  const { t } = useTranslation();
  const [productCollections, setProductCollections] = React.useState<{ [productId: string]: string }>({});
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [loadingCollections, setLoadingCollections] = React.useState(false);
  const [showRemoveModal, setShowRemoveModal] = React.useState(false);
  const [itemToRemove, setItemToRemove] = React.useState<any>(null);
  const [refreshKey, setRefreshKey] = React.useState(0); // Force refresh trigger

  // Handle route param changes
  React.useEffect(() => {
    if ((route.params as any)?.notifications) {
      setActiveTab('notifications');
    } else if ((route.params as any)?.preview) {
      setActiveTab('preview');
    } else {
      setActiveTab('wishlist');
    }
  }, [(route.params as any)?.notifications, (route.params as any)?.preview]);

  // Fetch collections with cover images
  React.useEffect(() => {
    const fetchCollectionsWithCovers = async () => {
      if (!userData?.id) return;
      
      setLoadingCollections(true);
      try {
        // Get all collections for this user
        const { data: collectionsData, error: colError } = await supabase
          .from('collections')
          .select('id, name, is_private')
          .eq('user_id', userData.id)
          .order('created_at', { ascending: false });

        if (colError || !collectionsData) {
          setLoadingCollections(false);
          return;
        }

        // For each collection, get the first 4 product images for cover
        const collectionsWithCovers = await Promise.all(
          collectionsData.map(async (col: any) => {
            // Get total count of items in collection
            const { count: totalCount } = await supabase
              .from('collection_products')
              .select('*', { count: 'exact', head: true })
              .eq('collection_id', col.id);

            // Get first 4 product IDs for cover images
            const { data: collectionProducts } = await supabase
              .from('collection_products')
              .select('product_id')
              .eq('collection_id', col.id)
              .limit(4);

            const cover_images: string[] = [];

            if (collectionProducts && collectionProducts.length > 0) {
              const productIds = collectionProducts.map((cp: any) => cp.product_id);
              const { data: products } = await supabase
                .from('products')
                .select(`
                  image_urls,
                  video_urls,
                  variants:product_variants(
                    image_urls,
                    video_urls
                  )
                `)
                .in('id', productIds)
                .limit(4);

              if (products) {
                products.forEach((p: any) => {
                  const img = getFirstSafeProductImage(p);
                  if (img) cover_images.push(img);
                });
              }
            }

            return {
              id: col.id,
              name: col.name,
              is_private: col.is_private,
              item_count: totalCount || 0,
              cover_images: cover_images.slice(0, 4),
            };
          })
        );

        // Sort collections to put "All" at the top
        const sortedCollections = collectionsWithCovers.sort((a, b) => {
          if (a.name === 'All') return -1;
          if (b.name === 'All') return 1;
          return 0;
        });
        
        setCollections(sortedCollections);

        // Also build the product -> collection map for individual products view
        const { data: collectionProducts, error } = await supabase
          .from('collection_products')
          .select('product_id, collection_id');
        if (!error && collectionProducts) {
          const map: { [productId: string]: string } = {};
          collectionProducts.forEach((cp: any) => {
            const col = collectionsData.find((c: any) => c.id === cp.collection_id);
            if (col) map[cp.product_id] = col.name;
          });
          setProductCollections(map);
        }
      } catch (error) {
        console.error('Error fetching collections:', error);
      } finally {
        setLoadingCollections(false);
      }
    };

    fetchCollectionsWithCovers();
  }, [userData?.id, wishlist]);

  // Real counts for badges - use unread counts from contexts
  const regularWishlistItems = React.useMemo(() => 
    wishlist.filter(item => 
      !item.isPersonalized && !productCollections[item.id]
    ), [wishlist, productCollections, refreshKey]
  );
  
  // Use unreadCount from context instead of total item count
  const notificationsCount = React.useMemo(() => 
    notifications.filter(n => n.unread).length,
    [notifications, refreshKey]
  );

  const TABS = React.useMemo(() => [
    { key: 'notifications', label: 'notifications', icon: 'notifications-outline', badge: notificationsCount },
    { key: 'wishlist', label: 'wishlist', icon: 'heart-outline', badge: wishlistUnreadCount },
    { key: 'preview', label: 'your_preview', icon: 'person-outline', badge: 0 }, // Preview has no unread concept
  ], [notificationsCount, wishlistUnreadCount, refreshKey]);

  // Handle collection sharing
  const handleShareCollection = async (collection: Collection) => {
    try {
      const collectionUrl = `https://only2u.app/collection/${collection.id}`;
      const message = `Check out my ${collection.name} collection on Only2U! 🛍️\n\n${collection.item_count} amazing products curated just for you.\n\n${collectionUrl}`;
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;

      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        Alert.alert('WhatsApp not installed', 'Please install WhatsApp to share this collection.');
      }
    } catch (error) {
      console.error('Error sharing collection:', error);
      Alert.alert('Error', 'Unable to share this collection right now.');
    }
  };

  const renderTab = (tab: any) => (
    <TouchableOpacity
      key={tab.key}
      style={[styles.tab, activeTab === tab.key && styles.activeTab]}
      onPress={() => setActiveTab(tab.key)}
      activeOpacity={0.8}
    >
      <View style={styles.tabContent}>
        <Ionicons
          name={tab.icon as any}
          size={20}
          color={activeTab === tab.key ? '#F53F7A' : '#888'}
        />
        <Text style={[styles.tabLabel, activeTab === tab.key && styles.activeTabLabel]}>{t(tab.label)}</Text>
        {tab.badge !== undefined && tab.badge > 0 && (
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{tab.badge}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // Render collection folder (Instagram-style)
  const renderCollectionFolder = ({ item }: { item: Collection }) => {
    const folderSize = (width - 48) / 2; // 2 columns with padding
    
    return (
      <TouchableOpacity
        style={[styles.collectionFolder, { width: folderSize }]}
        onPress={() => {
          (navigation as any).navigate('CollectionDetails', { 
            collectionId: item.id,
            collectionName: item.name
          });
        }}
        activeOpacity={0.8}
      >
        {/* Folder Cover - Grid of up to 4 images */}
        <View style={styles.folderCover}>
          {item.cover_images.length === 0 ? (
            // Empty folder
            <View style={styles.emptyFolderCover}>
              <Ionicons name="folder-outline" size={48} color="#ccc" />
            </View>
          ) : item.cover_images.length === 1 ? (
            // Single image
            <Image source={{ uri: item.cover_images[0] }} style={styles.singleCoverImage} />
          ) : (
            // Grid of 2-4 images
            <View style={styles.gridCoverContainer}>
              {item.cover_images.slice(0, 4).map((imageUrl, index) => (
                <Image
                  key={index}
                  source={{ uri: imageUrl }}
                  style={[
                    styles.gridCoverImage,
                    item.cover_images.length === 2 && styles.gridCoverImageHalf,
                    item.cover_images.length >= 3 && styles.gridCoverImageQuarter,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Folder Info */}
        <View style={styles.folderInfo}>
          <View style={styles.folderInfoRow}>
            <View style={styles.folderTextContainer}>
              <Text style={styles.folderName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.folderCount}>
                {item.item_count} {item.item_count === 1 ? 'item' : 'items'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={async (e) => {
                e.stopPropagation();
                await handleShareCollection(item);
              }}
            >
              <Ionicons name="share-outline" size={20} color="#F53F7A" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderWishlistItem = ({ item }: any) => (
    <TouchableOpacity 
      style={styles.productCard}
      onPress={() => {
        // Transform wishlist item to match ProductDetails expected format
        const productForDetails = {
          id: item.id,
          name: item.name,
          price: item.price,
          originalPrice: item.originalPrice,
          discount: item.discount || 0,
          rating: item.rating || 4.5,
          reviews: item.reviews || 0,
          image: getFirstSafeProductImage(item),
          image_urls: getProductImages(item),
          description: item.description,
          stock: item.stock || '0',
          featured: item.featured_type !== null,
          images: item.image_urls?.length || 1,
        };
        (navigation as any).navigate('ProductDetails', { product: productForDetails });
      }}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: getFirstSafeProductImage(item) }} style={styles.productImage} />
        <TouchableOpacity 
          style={styles.wishlistButton}
          onPress={() => {
            setItemToRemove(item);
            setShowRemoveModal(true);
          }}
        >
          <Ionicons name="heart" size={20} color="#F53F7A" />
        </TouchableOpacity>
        {item.discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{item.discount}% OFF</Text>
          </View>
        )}
      </View>
      <View style={styles.productInfo}>
        {/* Show collection title if available */}
        {productCollections[item.id] && (
          <Text style={styles.collectionTitle} numberOfLines={1}>{productCollections[item.id]}</Text>
        )}
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={styles.ratingText}>{item.rating || 4.5}</Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>₹{item.price}</Text>
          {item.originalPrice && item.originalPrice > item.price && (
            <Text style={styles.originalPrice}>₹{item.originalPrice}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderNotificationsItem = ({ item }: any) => {
    const handleNotificationPress = async () => {
      // If this is a face swap notification with productId and resultImages, navigate to preview
      if (item.productId && item.resultImages) {
        // Find the preview item matching this productId
        let previewItem = previewProducts.find((p: any) => 
          p.originalProductId === item.productId || p.id.includes(item.productId)
        );

        // If preview item not found, fetch product details and create it
        if (!previewItem) {
          try {
            const { data: productData, error } = await supabase
              .from('products')
              .select(`
                id,
                name,
                image_urls,
                video_urls
              `)
              .eq('id', item.productId)
              .single();

            if (!error && productData) {
              previewItem = {
                id: `personalized_${item.productId}_${Date.now()}`,
                name: productData.name || 'Personalized Product',
                description: `Personalized ${productData.name || 'Product'} with your face`,
                price: 0,
                image_urls: item.resultImages,
                video_urls: [],
                featured_type: 'personalized',
                category: { name: 'Personalized' },
                stock_quantity: 1,
                variants: [],
                isPersonalized: true,
                originalProductImage: productData.image_urls?.[0] || item.image,
                faceSwapDate: item.timeIso,
                originalProductId: item.productId,
              };
            }
          } catch (error) {
            console.error('Error fetching product details:', error);
          }
        }

        if (previewItem) {
          // Navigate to PersonalizedProductResult screen
          (navigation as any).navigate('PersonalizedProductResult', { 
            product: {
              id: previewItem.id,
              name: previewItem.name,
              description: previewItem.description,
              image_urls: item.resultImages || previewItem.image_urls,
              video_urls: previewItem.video_urls || [],
              faceSwapDate: previewItem.faceSwapDate || item.timeIso,
              originalProductId: item.productId,
              isVideoPreview: previewItem.isVideoPreview,
              originalProductImage: previewItem.originalProductImage || item.image,
            }
          });
          
          // Mark notification as read
          markAllRead();
        } else {
          // If preview item still not found, switch to preview tab
          setActiveTab('preview');
          markAllRead();
          Toast.show({
            type: 'info',
            text1: 'Face Swap Result',
            text2: 'Tap on the preview to view your result',
          });
        }
      }
    };

    return (
      <TouchableOpacity 
        style={styles.notificationCard}
        onPress={handleNotificationPress}
        activeOpacity={item.productId ? 0.7 : 1}
      >
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.notificationImage} />
        ) : (
          <View style={[styles.notificationImage, { backgroundColor: '#eee' }]} />
        )}
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle} numberOfLines={2}>{item.title}</Text>
          {!!item.subtitle && (
            <Text style={styles.notificationSubtitle} numberOfLines={2}>{item.subtitle}</Text>
          )}
          <Text style={styles.notificationTime}>{new Date(item.timeIso).toLocaleString()}</Text>
        </View>
        <TouchableOpacity style={styles.notificationDelete} onPress={() => removeNotification(item.id)}>
          <Ionicons name="trash-outline" size={20} color="#888" />
        </TouchableOpacity>
        {item.unread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const renderPreviewItem = ({ item }: any) => {
    const isVideo = item.video_urls && item.video_urls.length > 0;
    const isVideoPreview = item.isVideoPreview;
    
    return (
      <TouchableOpacity 
        style={styles.previewCard}
        onPress={() => {
          // Navigate to PersonalizedProductResult screen
          (navigation as any).navigate('PersonalizedProductResult', { 
            product: {
              id: item.id,
              name: item.name,
              description: item.description,
              image_urls: item.image_urls || [item.image_url],
              video_urls: item.video_urls || [], // Pass video URLs
              faceSwapDate: item.faceSwapDate,
              originalProductId: item.originalProductId,
              isVideoPreview: isVideoPreview, // Pass video preview flag
              originalProductImage: item.originalProductImage, // Pass original product image for fallback
            }
          });
        }}
      >
        <View style={styles.previewImageContainer}>
          {isVideo ? (
            <>
              <Image 
                source={{ uri: item.originalProductImage || getFirstSafeImageUrl(item.image_urls || [item.image_url]) }} 
                style={styles.previewImage} 
              />
              <View style={styles.videoOverlay}>
                <Ionicons name="play-circle" size={40} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.videoLabel}>VIDEO</Text>
              </View>
            </>
          ) : (
            (() => {
              const ordered = preferApiRenderedImageFirst(item.image_urls || [item.image_url]);
              const primary = ordered && ordered.length > 1 ? ordered[0] : (ordered?.[0] || null);
              const url = getSafeImageUrl(primary || (item.image_urls?.[1] || item.image_urls?.[0] || item.image_url));
              return (
                <Image 
                  source={{ uri: url }} 
                  style={styles.previewImage} 
                />
              );
            })()
          )}
        </View>
        <View style={styles.previewContent}>
          <Text style={styles.previewTitle} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.previewSubtitle} numberOfLines={2}>{item.description}</Text>
          <View style={styles.previewMetaRow}>
            <View style={styles.previewBadge}>
              <Ionicons name="sparkles" size={12} color="#F53F7A" />
              <Text style={styles.previewBadgeText}>Personalized</Text>
            </View>
            <Text style={styles.previewTimestamp}>
              {item.faceSwapDate ? 
                new Date(item.faceSwapDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 
                new Date().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })
              }
            </Text>
            {isVideoPreview && (
              <View style={styles.videoPreviewBadge}>
                <Ionicons name="videocam" size={10} color="#3B82F6" />
                <Text style={styles.videoPreviewText}>Video</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity 
          style={styles.previewDeleteButton}
          onPress={(e) => {
            e.stopPropagation();
            removeFromPreview(item.id);
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    const wishlistSafe = Array.isArray(wishlist) ? wishlist : [];
    const previewSafe = Array.isArray(previewProducts) ? previewProducts : [];
    switch (activeTab) {
      case 'wishlist':
        // Filter out personalized items AND items that are in any collection
        const regularWishlistItems = wishlistSafe.filter(item => 
          !item.isPersonalized && !productCollections[item.id]
        );
        
        if (loadingCollections) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#F53F7A" />
              <Text style={styles.loadingText}>Loading collections...</Text>
            </View>
          );
        }
        
        if (collections.length === 0 && regularWishlistItems.length === 0) {
          return (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="heart-outline" size={80} color="#F53F7A" />
              </View>
              <Text style={styles.emptyTitle}>{t('no_wishlist_items') || 'Your wishlist is empty'}</Text>
              <Text style={styles.emptySubtitle}>{t('add_products_to_wishlist') || 'Start saving your favorite products to see them here'}</Text>
              <TouchableOpacity 
                style={styles.emptyActionButton}
                onPress={() => (navigation as any).navigate('Home', { screen: 'Dashboard' })}
              >
                <Text style={styles.emptyActionButtonText}>Start Shopping</Text>
              </TouchableOpacity>
            </View>
          );
        }
        
        return (
          <FlatList
            data={regularWishlistItems}
            renderItem={renderWishlistItem}
            keyExtractor={item => item.id}
            ListHeaderComponent={() => (
              collections.length > 0 ? (
                <View style={styles.collectionsSection}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="folder" size={20} color="#333" />
                    <Text style={styles.sectionTitle}>Collections</Text>
                    <Text style={styles.sectionCount}>({collections.length})</Text>
                  </View>
                  <FlatList
                    data={collections}
                    renderItem={renderCollectionFolder}
                    keyExtractor={item => item.id}
                    numColumns={2}
                    scrollEnabled={false}
                    contentContainerStyle={styles.collectionsList}
                  />
                  {regularWishlistItems.length > 0 && (
                    <View style={styles.allItemsHeader}>
                      <Ionicons name="grid" size={18} color="#666" />
                      <Text style={styles.allItemsTitle}>All Items</Text>
                    </View>
                  )}
                </View>
              ) : null
            )}
            contentContainerStyle={styles.productList}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            key="wishlist-grid"
          />
        );
      case 'notifications':
        return (
          <FlatList
            data={notifications}
            renderItem={renderNotificationsItem}
            keyExtractor={item => `notification-${item.id}`}
            contentContainerStyle={styles.notificationList}
            numColumns={1}
            showsVerticalScrollIndicator={false}
            key="notifications-list"
          />
        );
      case 'preview':
        return previewSafe.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="person-outline" size={80} color="#F53F7A" />
            </View>
            <Text style={styles.emptyTitle}>No Personalized Products</Text>
            <Text style={styles.emptySubtitle}>Try face swap to create personalized product previews</Text>
            <TouchableOpacity 
              style={styles.emptyActionButton}
              onPress={() => (navigation as any).navigate('Home', { screen: 'Dashboard' })}
            >
              <Text style={styles.emptyActionButtonText}>Start Face Swap</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={previewSafe}
            renderItem={renderPreviewItem}
            keyExtractor={item => `preview-${item.id}`}
            contentContainerStyle={styles.previewList}
            numColumns={1}
            showsVerticalScrollIndicator={false}
            key="preview-list"
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('your_collections')}</Text>
        <TouchableOpacity 
          style={styles.headerMarkAll}
          onPress={async () => {
            // Mark wishlist as read
            await markWishlistAsRead();
            
            // Also mark all notifications as read
            if (markAllRead) {
              await markAllRead();
            }
            
            // Force immediate re-render
            setRefreshKey(prev => prev + 1);
            
            Toast.show({
              type: 'success',
              text1: 'Success',
              text2: 'All items marked as read',
              position: 'top',
            });
          }}
        >
          <Text style={styles.headerMarkAllText}>{t('mark_all_as_read')}</Text>
        </TouchableOpacity>
      </View>
      
      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(renderTab)}
      </View>
      
      {/* Content */}
      {renderContent()}

      {/* Custom Remove Confirmation Modal */}
      <Modal
        visible={showRemoveModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRemoveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Heart Icon */}
            <View style={styles.modalIconContainer}>
              <View style={styles.modalHeartCircle}>
                <Ionicons name="heart-dislike" size={40} color="#F53F7A" />
              </View>
            </View>

            {/* Title */}
            <Text style={styles.modalTitle}>Remove from Wishlist?</Text>

            {/* Product Info */}
            {itemToRemove && (
              <View style={styles.modalProductInfo}>
                <Image 
                  source={{ uri: getFirstSafeProductImage(itemToRemove) }} 
                  style={styles.modalProductImage}
                />
                <Text style={styles.modalProductName} numberOfLines={2}>
                  {itemToRemove.name}
                </Text>
              </View>
            )}

            {/* Message */}
            <Text style={styles.modalMessage}>
              This item will be removed from all your collections
            </Text>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowRemoveModal(false);
                  setItemToRemove(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalRemoveButton}
                onPress={async () => {
                  if (!itemToRemove) return;
                  
                  // Close modal
                  setShowRemoveModal(false);
                  
                  // Remove from wishlist
                  removeFromWishlist(itemToRemove.id);
                  
                  // Remove from database
                  if (userData?.id) {
                    await supabase
                      .from('collection_products')
                      .delete()
                      .match({ product_id: itemToRemove.id });
                  }
                  
                  // Show success toast
                  Toast.show({
                    type: 'success',
                    text1: 'Removed from Wishlist',
                    text2: itemToRemove.name,
                    position: 'top',
                  });
                  
                  // Clear item
                  setItemToRemove(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalRemoveText}>Remove</Text>
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
    backgroundColor: '#f8f9fa' 
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
  headerBack: { 
    padding: 4, 
    marginRight: 8 
  },
  headerTitle: { 
    flex: 1, 
    fontSize: 22, 
    fontWeight: '700', 
    color: '#222' 
  },
  headerMarkAll: { 
    padding: 4 
  },
  headerMarkAllText: { 
    color: '#F53F7A', 
    fontWeight: '600', 
    fontSize: 15 
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#F53F7A',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    marginLeft: 6,
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#F53F7A',
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: '#F53F7A',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  tabBadgeText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 11 
  },
  
  // Product List Styles (same as Products screen)
  productList: { 
    padding: 8 
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
    height: 180,
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    resizeMode: 'cover',
  },
  wishlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 6,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#F53F7A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 18,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 2,
    fontWeight: '500',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginLeft: 6,
  },
  collectionTitle: {
    fontSize: 12,
    color: '#F53F7A',
    fontWeight: '600',
    marginBottom: 2,
  },
  
  // Notification List Styles
  notificationList: { 
    padding: 8 
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    padding: 12,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  notificationImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#eee',
  },
  notificationContent: { 
    flex: 1 
  },
  notificationTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#111', 
    marginBottom: 2 
  },
  notificationSubtitle: { 
    fontSize: 13, 
    color: '#444', 
    marginBottom: 4 
  },
  notificationTime: { 
    fontSize: 12, 
    color: '#888' 
  },
  notificationDelete: { 
    padding: 6, 
    marginLeft: 8 
  },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F53F7A',
  },
  
  // Preview List Styles
  previewList: { 
    padding: 8 
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  previewImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLabel: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
    marginTop: 2,
  },
  previewContent: { 
    flex: 1 
  },
  previewTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#111', 
    marginBottom: 2 
  },
  previewSubtitle: { 
    fontSize: 13, 
    color: '#444', 
    marginBottom: 8 
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F53F7A',
  },
  previewTimestamp: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  videoPreviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  videoPreviewText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3B82F6',
  },
  
  emptyContainer: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 32 
  },
  emptyTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#222', 
    marginTop: 16 
  },
  emptySubtitle: { 
    fontSize: 15, 
    color: '#888', 
    marginTop: 6, 
    textAlign: 'center' 
  },
  emptyIconContainer: {
    backgroundColor: '#FFF5F7',
    borderRadius: 50,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#F53F7A',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  emptyActionButton: {
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 20,
    shadowColor: '#F53F7A',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  emptyActionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  productCardContent: {
    flex: 1,
  },
  personalizedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  personalizedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 6,
    zIndex: 10,
  },
  previewDeleteButton: {
    padding: 8,
  },
  
  // Collections Section Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  collectionsSection: {
    width: '100%',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  sectionCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  collectionsList: {
    paddingHorizontal: 4,
  },
  collectionFolder: {
    margin: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  folderCover: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    backgroundColor: '#f5f5f5',
  },
  emptyFolderCover: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  singleCoverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gridCoverContainer: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCoverImage: {
    resizeMode: 'cover',
    borderWidth: 0.5,
    borderColor: '#fff', // White border between images
  },
  gridCoverImageHalf: {
    width: '50%',
    height: '100%',
  },
  gridCoverImageQuarter: {
    width: '50%',
    height: '50%',
  },
  privateBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 6,
  },
  folderInfo: {
    padding: 12,
    backgroundColor: '#fff',
    minHeight: 70, // Ensure enough space for wrapped text
  },
  folderInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Changed from 'center' to allow proper text wrapping
    justifyContent: 'space-between',
  },
  folderTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  folderName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 20, // Better spacing for multi-line text
  },
  folderCount: {
    fontSize: 13,
    color: '#666',
  },
  shareButton: {
    padding: 8,
    backgroundColor: '#FFE8F0',
    borderRadius: 20,
  },
  allItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 8,
    gap: 8,
  },
  allItemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  // Custom Remove Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
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
  modalIconContainer: {
    marginBottom: 16,
  },
  modalHeartCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#F53F7A',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalProductInfo: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  modalProductImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
  },
  modalProductName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalRemoveButton: {
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
  modalRemoveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default Wishlist; 