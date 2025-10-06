import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
  Dimensions,
  StatusBar,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '~/contexts/CartContext';
import { useUser } from '~/contexts/UserContext';
import { useTranslation } from 'react-i18next';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const Cart = () => {
  const navigation = useNavigation();
  const { cartItems, removeFromCart, updateQuantity, getCartTotal } = useCart();
  const [suggested, setSuggested] = useState<any[]>([]);
  const [quickViewVisible, setQuickViewVisible] = useState(false);
  const [quickViewItem, setQuickViewItem] = useState<any | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { userData } = useUser();
  const { t } = useTranslation();

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleContinueShopping = () => {
    navigation.navigate('Home' as never);
  };

  const handleRemoveItem = (id: string) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeFromCart(id) }
      ]
    );
  };

  const handleUpdateQuantity = (id: string, newQuantity: number) => {
    updateQuantity(id, newQuantity);
  };

  const handleCheckout = () => {
    if (!userData) {
      Alert.alert('Login Required', 'Please login to proceed with checkout', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigation.navigate('Login' as never) }
      ]);
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to your cart');
      return;
    }

    navigation.navigate('Checkout' as never);
  };

  const subtotal = getCartTotal();
  const savings = Math.floor(subtotal * 0.15); // Mock savings
  const deliveryCharge = subtotal > 500 ? 0 : 40;
  const finalTotal = subtotal + deliveryCharge;

  const renderCartItem = (item: any) => (
    <View key={item.id} style={styles.cartItem}>
      <TouchableOpacity
        onPress={() => {
          setQuickViewItem(item);
          setQuickViewVisible(true);
        }}
        activeOpacity={0.9}
        style={styles.itemImageContainer}
      >
        <Image source={{ uri: item.image }} style={styles.itemImage} />
        {item.quantity > 1 && (
          <View style={styles.quantityBadge}>
            <Text style={styles.quantityBadgeText}>{item.quantity}</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.itemDetails}>
        <View style={styles.itemHeader}>
          <View style={styles.itemNameContainer}>
            <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
            <View style={styles.itemAttributes}>
              {item.size && (
                <View style={styles.attributeChip}>
                  <Text style={styles.attributeText}>Size: {item.size}</Text>
                </View>
              )}
              {item.color && (
                <View style={styles.attributeChip}>
                  <Text style={styles.attributeText}>{item.color}</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => handleRemoveItem(item.id)} 
            style={styles.removeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={22} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={styles.itemFooter}>
          <View style={styles.priceContainer}>
            <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
            <Text style={styles.itemPriceUnit}>₹{item.price} each</Text>
          </View>

          <View style={styles.quantityContainer}>
            <TouchableOpacity 
              onPress={() => handleUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
              disabled={item.quantity <= 1}
              style={[styles.quantityButton, item.quantity <= 1 && styles.quantityButtonDisabled]}
            >
              <Ionicons name="remove" size={18} color={item.quantity <= 1 ? "#D1D5DB" : "#F53F7A"} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity 
              onPress={() => handleUpdateQuantity(item.id, Math.min(item.stock || 10, item.quantity + 1))}
              disabled={item.quantity >= (item.stock || 10)}
              style={[styles.quantityButton, item.quantity >= (item.stock || 10) && styles.quantityButtonDisabled]}
            >
              <Ionicons name="add" size={18} color={item.quantity >= (item.stock || 10) ? "#D1D5DB" : "#F53F7A"} />
            </TouchableOpacity>
          </View>
        </View>

        {item.stock && item.stock <= 5 && (
          <View style={styles.stockWarning}>
            <Ionicons name="alert-circle" size={14} color="#F59E0B" />
            <Text style={styles.stockWarningText}>Only {item.stock} left in stock</Text>
          </View>
        )}
      </View>
    </View>
  );

  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const { data, error } = await (await import('~/utils/supabase')).supabase
          .from('products')
          .select(`
            id,
            name,
            image_urls,
            product_variants(id, price, image_urls)
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(8);
        if (!error && data) {
          setSuggested(data as any);
        }
      } catch (e) {
        // no-op
      }
    };
    loadSuggestions();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Shopping Cart</Text>
          <Text style={styles.headerSubtitle}>{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {cartItems.length === 0 ? (
        // Empty Cart
        <ScrollView 
          contentContainerStyle={styles.emptyCartContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.emptyCartContent}>
            <View style={styles.emptyCartIcon}>
              <Ionicons name="cart-outline" size={80} color="#E5E7EB" />
            </View>
            <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
            <Text style={styles.emptyCartSubtitle}>
              Add items you love to your cart and they will appear here
            </Text>
            <TouchableOpacity 
              style={styles.startShoppingButton} 
              onPress={handleContinueShopping}
            >
              <Text style={styles.startShoppingButtonText}>Start Shopping</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Show suggestions even on empty cart */}
          {suggested.length > 0 && (
            <View style={styles.suggestedSection}>
              <Text style={styles.suggestedTitle}>Trending Now</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestedScroller}
              >
                {suggested.map((p: any) => {
                  const firstVariant = (p.product_variants || [])[0];
                  const price = firstVariant?.price || 0;
                  const img = (firstVariant?.image_urls && firstVariant.image_urls[0]) || (p.image_urls && p.image_urls[0]);
                  return (
                    <TouchableOpacity 
                      key={p.id} 
                      style={styles.suggestedCard}
                      onPress={handleContinueShopping}
                    >
                      <Image 
                        source={{ uri: img || 'https://via.placeholder.com/160x160.png?text=Only2U' }} 
                        style={styles.suggestedImage} 
                      />
                      <View style={styles.suggestedInfo}>
                        <Text style={styles.suggestedName} numberOfLines={2}>{p.name}</Text>
                        <Text style={styles.suggestedPrice}>₹{price}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      ) : (
        // Cart with Items
        <>
          <ScrollView 
            style={styles.contentScroll} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Delivery Info Banner */}
            <View style={styles.deliveryBanner}>
              <View style={styles.deliveryBannerIcon}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              </View>
              <View style={styles.deliveryBannerTextContainer}>
                <Text style={styles.deliveryBannerText}>
                  {deliveryCharge === 0 ? (
                    <Text>
                      Yay! You get <Text style={styles.deliveryBannerHighlight}>FREE delivery</Text> on this order
                    </Text>
                  ) : (
                    <Text>
                      Add items worth ₹{500 - subtotal} more for <Text style={styles.deliveryBannerHighlight}>FREE delivery</Text>
                    </Text>
                  )}
                </Text>
              </View>
            </View>

            {/* Cart Items */}
            <View style={styles.cartItemsSection}>
              {cartItems.map(renderCartItem)}
            </View>

            {/* Offers Section */}
            <View style={styles.offersSection}>
              <View style={styles.offersSectionHeader}>
                <Ionicons name="pricetag" size={18} color="#F53F7A" />
                <Text style={styles.offersSectionTitle}>Apply Coupon</Text>
              </View>
              <TouchableOpacity style={styles.couponButton}>
                <Text style={styles.couponButtonText}>Select or enter coupon code</Text>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Price Details */}
            <View style={styles.priceDetails}>
              <Text style={styles.priceDetailsTitle}>Price Details</Text>
              
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Price ({cartItems.length} items)</Text>
                <Text style={styles.priceValue}>₹{subtotal}</Text>
              </View>
              
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Delivery Charges</Text>
                {deliveryCharge === 0 ? (
                  <Text style={styles.priceFree}>FREE</Text>
                ) : (
                  <Text style={styles.priceValue}>₹{deliveryCharge}</Text>
                )}
              </View>

              {savings > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Discount</Text>
                  <Text style={styles.priceSavings}>-₹{savings}</Text>
                </View>
              )}

              <View style={styles.priceDivider} />

              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>₹{finalTotal - savings}</Text>
              </View>

              {savings > 0 && (
                <View style={styles.savingsTag}>
                  <Ionicons name="happy-outline" size={16} color="#10B981" />
                  <Text style={styles.savingsText}>You will save ₹{savings} on this order</Text>
                </View>
              )}
            </View>

            {/* Trust Badges */}
            <View style={styles.trustBadges}>
              <View style={styles.trustBadge}>
                <View style={styles.trustBadgeIcon}>
                  <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                </View>
                <Text style={styles.trustBadgeText}>100% Secure Payments</Text>
              </View>
              <View style={styles.trustBadge}>
                <View style={styles.trustBadgeIcon}>
                  <Ionicons name="sync" size={20} color="#3B82F6" />
                </View>
                <Text style={styles.trustBadgeText}>Easy Returns & Refunds</Text>
              </View>
              <View style={styles.trustBadge}>
                <View style={styles.trustBadgeIcon}>
                  <Ionicons name="star" size={20} color="#F59E0B" />
                </View>
                <Text style={styles.trustBadgeText}>Quality Guaranteed</Text>
              </View>
            </View>

            {/* Suggested Products */}
            {suggested.length > 0 && (
              <View style={styles.suggestedSection}>
                <Text style={styles.suggestedTitle}>You may also like</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestedScroller}
                >
                  {suggested.map((p: any) => {
                    const firstVariant = (p.product_variants || [])[0];
                    const price = firstVariant?.price || 0;
                    const img = (firstVariant?.image_urls && firstVariant.image_urls[0]) || (p.image_urls && p.image_urls[0]);
                    return (
                      <TouchableOpacity 
                        key={p.id} 
                        style={styles.suggestedCard}
                        onPress={handleContinueShopping}
                      >
                        <Image 
                          source={{ uri: img || 'https://via.placeholder.com/160x160.png?text=Only2U' }} 
                          style={styles.suggestedImage} 
                        />
                        <View style={styles.suggestedInfo}>
                          <Text style={styles.suggestedName} numberOfLines={2}>{p.name}</Text>
                          <Text style={styles.suggestedPrice}>₹{price}</Text>
                          <View style={styles.suggestedAddButton}>
                            <Ionicons name="add" size={16} color="#F53F7A" />
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>

          {/* Sticky Checkout Footer */}
          <View style={styles.checkoutFooter}>
            <View style={styles.footerPriceInfo}>
              <Text style={styles.footerPriceLabel}>Total</Text>
              <Text style={styles.footerPriceValue}>₹{finalTotal - savings}</Text>
            </View>
            <TouchableOpacity 
              style={styles.checkoutButton} 
              onPress={handleCheckout}
              activeOpacity={0.8}
            >
              <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Quick View Modal - Image Gallery */}
      <Modal
        visible={quickViewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setQuickViewVisible(false);
          setCurrentImageIndex(0);
        }}
      >
        <View style={styles.galleryModalOverlay}>
          {/* Close button */}
          <TouchableOpacity 
            style={styles.galleryCloseButton}
            onPress={() => {
              setQuickViewVisible(false);
              setCurrentImageIndex(0);
            }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {quickViewItem && (() => {
            // Get all images - handle both image_urls array and single image
            const images = quickViewItem.image_urls && Array.isArray(quickViewItem.image_urls) && quickViewItem.image_urls.length > 0
              ? quickViewItem.image_urls
              : [quickViewItem.image || 'https://via.placeholder.com/400'];

            return (
              <>
                {/* Image Gallery */}
                <FlatList
                  data={images}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    setCurrentImageIndex(index);
                  }}
                  renderItem={({ item }) => (
                    <View style={styles.galleryImageContainer}>
                      <Image
                        source={{ uri: item }}
                        style={styles.galleryImage}
                        resizeMode="contain"
                      />
                    </View>
                  )}
                  keyExtractor={(item, index) => `${item}-${index}`}
                />

                {/* Image counter and product info */}
                <View style={styles.galleryBottomInfo}>
                  {/* Page indicator */}
                  {images.length > 1 && (
                    <View style={styles.pageIndicatorContainer}>
                      <View style={styles.pageIndicator}>
                        <Text style={styles.pageIndicatorText}>
                          {currentImageIndex + 1} / {images.length}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Product details */}
                  <View style={styles.galleryProductInfo}>
                    <Text style={styles.galleryProductName} numberOfLines={2}>
                      {quickViewItem.name}
                    </Text>
                    
                    <View style={styles.galleryDetailsRow}>
                      <View style={styles.galleryPriceContainer}>
                        <Text style={styles.galleryPrice}>₹{quickViewItem.price * quickViewItem.quantity}</Text>
                        {quickViewItem.quantity > 1 && (
                          <Text style={styles.galleryQtyInfo}>
                            ₹{quickViewItem.price} × {quickViewItem.quantity}
                          </Text>
                        )}
                      </View>

                      <View style={styles.galleryAttributes}>
                        {quickViewItem.size && (
                          <View style={styles.galleryAttributeChip}>
                            <Text style={styles.galleryAttributeText}>Size: {quickViewItem.size}</Text>
                          </View>
                        )}
                        {quickViewItem.color && (
                          <View style={styles.galleryAttributeChip}>
                            <Text style={styles.galleryAttributeText}>Color: {quickViewItem.color}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </View>

                {/* Navigation dots */}
                {images.length > 1 && (
                  <View style={styles.dotContainer}>
                    {images.map((_: string, index: number) => (
                      <View
                        key={index}
                        style={[
                          styles.dot,
                          index === currentImageIndex && styles.activeDot,
                        ]}
                      />
                    ))}
                  </View>
                )}
              </>
            );
          })()}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  deliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  deliveryBannerIcon: {
    marginRight: 10,
  },
  deliveryBannerTextContainer: {
    flex: 1,
  },
  deliveryBannerText: {
    fontSize: 13,
    color: '#047857',
    lineHeight: 18,
  },
  deliveryBannerHighlight: {
    fontWeight: '700',
  },
  cartItemsSection: {
    marginTop: 12,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  itemImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  itemImage: {
    width: 90,
    height: 110,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  quantityBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#F53F7A',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  quantityBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  itemDetails: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemNameContainer: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 20,
    marginBottom: 6,
  },
  itemAttributes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  attributeChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  attributeText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  priceContainer: {
    flex: 1,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  itemPriceUnit: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  quantityButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  quantityButtonDisabled: {
    backgroundColor: '#F9FAFB',
  },
  quantityText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    paddingHorizontal: 16,
  },
  stockWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  stockWarningText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
  },
  offersSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  offersSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  offersSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  couponButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderStyle: 'dashed',
  },
  couponButtonText: {
    fontSize: 13,
    color: '#9A3412',
    fontWeight: '500',
  },
  priceDetails: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  priceDetailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  priceFree: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '700',
  },
  priceSavings: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  totalRow: {
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F53F7A',
  },
  savingsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 12,
    gap: 6,
  },
  savingsText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  trustBadges: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  trustBadgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustBadgeText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  suggestedSection: {
    marginTop: 20,
    paddingBottom: 16,
  },
  suggestedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  suggestedScroller: {
    paddingHorizontal: 12,
  },
  suggestedCard: {
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  suggestedImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#F9FAFB',
  },
  suggestedInfo: {
    padding: 10,
  },
  suggestedName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 18,
    marginBottom: 6,
  },
  suggestedPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F53F7A',
  },
  suggestedAddButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSpacer: {
    height: 20,
  },
  checkoutFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10,
  },
  footerPriceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  footerPriceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  footerPriceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  checkoutButton: {
    flexDirection: 'row',
    backgroundColor: '#F53F7A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyCartContainer: {
    flexGrow: 1,
    paddingTop: 40,
  },
  emptyCartContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyCartIcon: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyCartTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyCartSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  startShoppingButton: {
    flexDirection: 'row',
    backgroundColor: '#F53F7A',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startShoppingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.75,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalContent: {
    flex: 1,
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: '#F9FAFB',
  },
  modalInfo: {
    padding: 20,
  },
  modalProductName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 28,
    marginBottom: 12,
  },
  modalPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 16,
  },
  modalPrice: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F53F7A',
  },
  modalQtyInfo: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  modalAttributes: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  modalAttribute: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalAttributeLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  modalAttributeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  modalCloseButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  // Gallery Modal Styles
  galleryModalOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  galleryCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  galleryBottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  pageIndicatorContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  pageIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pageIndicatorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  galleryProductInfo: {
    gap: 12,
  },
  galleryProductName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 28,
  },
  galleryDetailsRow: {
    gap: 12,
  },
  galleryPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  galleryPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F53F7A',
  },
  galleryQtyInfo: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  galleryAttributes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  galleryAttributeChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  galleryAttributeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  dotContainer: {
    position: 'absolute',
    bottom: 180,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  activeDot: {
    backgroundColor: '#F53F7A',
    width: 24,
  },
});

export default Cart;