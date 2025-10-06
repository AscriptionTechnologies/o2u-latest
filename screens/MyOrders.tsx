import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '~/contexts/UserContext';
import { useAuth } from '~/contexts/useAuth';
import { supabase } from '~/utils/supabase';

const MyOrders = () => {
  const navigation = useNavigation();
  const { userData } = useUser();
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleBackPress = () => {
    navigation.goBack();
  };

  // Get status color and background
  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return { color: '#4CAF50', bg: '#E8F5E8' };
      case 'shipped':
        return { color: '#2196F3', bg: '#E3F2FD' };
      case 'processing':
        return { color: '#FF9800', bg: '#FFF3E0' };
      case 'confirmed':
        return { color: '#9C27B0', bg: '#F3E5F5' };
      case 'pending':
        return { color: '#FF5722', bg: '#FFEBEE' };
      case 'cancelled':
        return { color: '#F44336', bg: '#FFEBEE' };
      default:
        return { color: '#666', bg: '#F5F5F5' };
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Fetch orders from database
  const fetchOrders = async () => {
    try {
      const userId = userData?.id || user?.id;
      if (!userId) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          created_at,
          payment_status,
          payment_method,
          shipping_address,
          order_items (
            id,
            product_name,
            product_image,
            size,
            color,
            quantity,
            unit_price,
            total_price
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        Alert.alert('Error', 'Failed to load orders. Please try again.');
        return;
      }

      // Transform data for display
      const transformedOrders = ordersData?.map(order => {
        const statusStyle = getStatusStyle(order.status);
        return {
          id: order.id,
          orderNumber: order.order_number,
          date: formatDate(order.created_at),
          status: order.status,
          statusColor: statusStyle.color,
          statusBg: statusStyle.bg,
          total: order.total_amount,
          paymentStatus: order.payment_status,
          paymentMethod: order.payment_method,
          shippingAddress: order.shipping_address,
          items: order.order_items?.map((item: any) => ({
            name: item.product_name,
            image: item.product_image,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalPrice: item.total_price,
          })) || []
        };
      }) || [];

      setOrders(transformedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      Alert.alert('Error', 'Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load orders on component mount
  useEffect(() => {
    fetchOrders();
  }, [userData, user]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
  };

  const renderOrderCard = (order: any) => (
    <View key={order.id} style={styles.orderCard}>
      {/* Order Header */}
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <View style={styles.orderIdContainer}>
            <Ionicons name="bag-outline" size={20} color="#F53F7A" />
            <Text style={styles.orderId}>{order.orderNumber}</Text>
          </View>
          <Text style={styles.orderDate}>{order.date}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: order.statusBg }]}>
          <Text style={[styles.statusText, { color: order.statusColor }]}>
            {order.status}
          </Text>
        </View>
      </View>

      {/* Order Items */}
      <View style={styles.itemsContainer}>
        {order.items.map((item: any, index: number) => (
          <View key={index} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDetails}>
                {item.size && `Size: ${item.size}`}
                {item.size && item.color && ', '}
                {item.color && `Color: ${item.color}`}
                {item.quantity > 1 && ` (Qty: ${item.quantity})`}
              </Text>
            </View>
            <Text style={styles.itemPrice}>₹{item.totalPrice}</Text>
          </View>
        ))}
      </View>

      {/* Order Total */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total Amount:</Text>
        <Text style={styles.totalAmount}>₹{order.total}</Text>
      </View>

      {/* Payment Info */}
      {order.paymentMethod && (
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentText}>
            Payment: {order.paymentMethod.toUpperCase()} • {order.paymentStatus}
          </Text>
        </View>
      )}

      {/* View Details Button */}
      <TouchableOpacity style={styles.viewDetailsButton}>
        <Text style={styles.viewDetailsText}>View Order Details</Text>
        <Ionicons name="chevron-forward" size={16} color="#F53F7A" />
      </TouchableOpacity>
    </View>
  );

  // Show login prompt if user is not logged in
  if (!userData && !user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Orders</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="bag-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Login Required</Text>
          <Text style={styles.emptySubtitle}>Please login to view your orders</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F53F7A" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bag-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Orders Yet</Text>
          <Text style={styles.emptySubtitle}>Your orders will appear here</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#F53F7A']}
              tintColor="#F53F7A"
            />
          }
        >
          {orders.map((order) => renderOrderCard(order))}
        </ScrollView>
      )}
    </View>
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
    // justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
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
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    paddingTop: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  orderInfo: {
    flex: 1,
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  orderDate: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemsContainer: {
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 14,
    color: '#666',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F53F7A',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  viewDetailsText: {
    fontSize: 16,
    color: '#F53F7A',
    fontWeight: '500',
    marginRight: 4,
  },
  // Loading and empty states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
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
    lineHeight: 22,
  },
  // Payment info
  paymentInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  paymentText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default MyOrders;
