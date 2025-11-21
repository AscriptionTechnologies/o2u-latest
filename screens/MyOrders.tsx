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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '~/types/navigation';
import { useUser } from '~/contexts/UserContext';
import { useAuth } from '~/contexts/useAuth';
import { supabase } from '~/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TicketType = 'support' | 'return' | 'replacement';
type TicketStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'requested'
  | 'pickup_scheduled'
  | 'in_transit'
  | 'refund_initiated'
  | 'completed'
  | 'approved'
  | 'preparing_shipment'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

interface SupportTicket {
  id: string;
  orderId: string;
  orderItemId: string;
  orderNumber: string;
  productName: string;
  type: TicketType;
  status: TicketStatus;
  reason: string;
  description?: string | null;
  createdAt: string;
  updates: Array<{
    timestamp: string;
    status: TicketStatus | 'note';
    message: string;
  }>;
  origin?: 'remote' | 'local';
}

interface SelectedOrderItemContext {
  orderId: string;
  orderItemId: string;
  orderNumber: string;
  productName: string;
  orderStatus: string;
}

const SUPPORT_TICKET_STORAGE_PREFIX = 'support_tickets_';

const TICKET_REASON_OPTIONS: Record<TicketType, string[]> = {
  support: [
    'Order update needed',
    'Payment related question',
    'Need help with sizing or styling',
    'Other general query',
  ],
  return: [
    'Received damaged product',
    'Wrong item delivered',
    'Quality does not match expectations',
    'Ordered by mistake',
    'Other return reason',
  ],
  replacement: [
    'Wrong size received',
    'Product arrived damaged',
    'Received different color',
    'Defective item received',
    'Other replacement reason',
  ],
};

const TICKET_STATUS_SEQUENCE: Record<TicketType, TicketStatus[]> = {
  support: ['open', 'assigned', 'in_progress', 'resolved'],
  return: ['requested', 'pickup_scheduled', 'in_transit', 'refund_initiated', 'completed'],
  replacement: ['requested', 'approved', 'preparing_shipment', 'shipped', 'delivered'],
};

const STATUS_DISPLAY_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  assigned: 'Agent Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  requested: 'Requested',
  pickup_scheduled: 'Pickup Scheduled',
  in_transit: 'In Transit',
  refund_initiated: 'Refund Initiated',
  completed: 'Completed',
  approved: 'Approved',
  preparing_shipment: 'Preparing Replacement',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

const SUPPORT_TYPE_LABELS: Record<TicketType, string> = {
  support: 'Support Ticket',
  return: 'Return Request',
  replacement: 'Replacement Request',
};

const getTicketStorageKey = (userId: string) => `${SUPPORT_TICKET_STORAGE_PREFIX}${userId}`;

const getStatusLabel = (status: TicketStatus | string) =>
  STATUS_DISPLAY_LABELS[status as TicketStatus] || status;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MyOrders = () => {
  const navigation = useNavigation<NavigationProp>();
  const { userData } = useUser();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [supportTickets, setSupportTickets] = useState<Record<string, SupportTicket[]>>({});
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [ticketType, setTicketType] = useState<TicketType>('support');
  const [ticketReason, setTicketReason] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [selectedOrderItem, setSelectedOrderItem] = useState<SelectedOrderItemContext | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  
  // Review modal states
  const [isReviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMedia, setReviewMedia] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  // Report modal states
  const [isReportModalVisible, setReportModalVisible] = useState(false);
  const [reportType, setReportType] = useState('');
  const [reportDescription, setReportDescription] = useState('');

  const getOrderItemKey = (orderId: string, orderItemId: string) => `${orderId}_${orderItemId}`;

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

  const persistTickets = async (
    userId: string,
    ticketsMap: Record<string, SupportTicket[]>
  ) => {
    try {
      await AsyncStorage.setItem(
        getTicketStorageKey(userId),
        JSON.stringify(ticketsMap)
      );
    } catch (error) {
      console.warn('Failed to persist tickets locally:', error);
    }
  };

  const loadTicketsFromStorage = async (userId: string) => {
    try {
      const raw = await AsyncStorage.getItem(getTicketStorageKey(userId));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed || {};
    } catch (error) {
      console.warn('Failed to load tickets from storage:', error);
      return {};
    }
  };

  const hydrateSupportTickets = async (userId: string, orderIds: string[]) => {
    if (!userId || orderIds.length === 0) {
      setSupportTickets({});
      return;
    }

    setTicketsLoading(true);

    try {
      const [localTicketsMap, remoteResult] = await Promise.all([
        loadTicketsFromStorage(userId),
        (async () => {
          if (!supabase) return { data: null, error: null };
          const { data, error } = await supabase
            .from('order_support_tickets')
            .select(
              `
                id,
                order_id,
                order_item_id,
                order_number,
                product_name,
                type,
                status,
                reason,
                description,
                updates,
                created_at
              `
            )
            .in('order_id', orderIds);
          return { data, error };
        })().catch((error) => {
          console.log('Support tickets fetch error:', error);
          return { data: null, error };
        }),
      ]);

      let remoteTickets: SupportTicket[] = [];
      const remoteError = remoteResult.error as any;

      if (remoteResult.data && !remoteError) {
        remoteTickets = remoteResult.data.map((ticket: any) => ({
          id: ticket.id,
          orderId: ticket.order_id,
          orderItemId: ticket.order_item_id,
          orderNumber: ticket.order_number,
          productName: ticket.product_name,
          type: ticket.type,
          status: ticket.status,
          reason: ticket.reason,
          description: ticket.description,
          createdAt: ticket.created_at,
          updates: Array.isArray(ticket.updates)
            ? ticket.updates
            : [
                {
                  timestamp: ticket.created_at,
                  status: ticket.status,
                  message: getStatusLabel(ticket.status),
                },
              ],
          origin: 'remote',
        }));
      } else if (remoteError && remoteError?.code !== '42P01') {
        console.warn('Unable to sync support tickets:', remoteError?.message || remoteError);
      }

      const combinedTicketsMap: Record<string, SupportTicket[]> = {
        ...localTicketsMap,
      };

      remoteTickets.forEach((ticket) => {
        const key = getOrderItemKey(ticket.orderId, ticket.orderItemId);
        if (!combinedTicketsMap[key]) {
          combinedTicketsMap[key] = [ticket];
        } else {
          const existingIndex = combinedTicketsMap[key].findIndex(
            (localTicket: SupportTicket) => localTicket.id === ticket.id
          );
          if (existingIndex >= 0) {
            combinedTicketsMap[key][existingIndex] = ticket;
          } else {
            combinedTicketsMap[key].push(ticket);
          }
        }
      });

      setSupportTickets(combinedTicketsMap);

      // Update local cache with merged tickets
      await persistTickets(userId, combinedTicketsMap);
    } finally {
      setTicketsLoading(false);
    }
  };

  const getNextStatusForTicket = (ticket: SupportTicket) => {
    if (ticket.status === 'cancelled' || ticket.status === 'resolved' || ticket.status === 'completed' || ticket.status === 'delivered') {
      return null;
    }
    const sequence = TICKET_STATUS_SEQUENCE[ticket.type];
    if (!sequence) return null;
    const idx = sequence.indexOf(ticket.status);
    if (idx === -1 || idx >= sequence.length - 1) {
      return null;
    }
    return sequence[idx + 1];
  };

  const recordTicketUpdate = async (
    userId: string,
    ticket: SupportTicket,
    updatedTicket: SupportTicket
  ) => {
    const key = getOrderItemKey(ticket.orderId, ticket.orderItemId);
    setSupportTickets((prev) => {
      const current = prev[key] || [];
      const index = current.findIndex((entry) => entry.id === ticket.id);
      const updatedList =
        index >= 0
          ? [
              ...current.slice(0, index),
              updatedTicket,
              ...current.slice(index + 1),
            ]
          : [updatedTicket, ...current];
      const nextMap = {
        ...prev,
        [key]: updatedList,
      };
      persistTickets(userId, nextMap);
      return nextMap;
    });

    if (!ticket.id.startsWith('local-')) {
      try {
        await supabase
          .from('order_support_tickets')
          .update({
            status: updatedTicket.status,
            updates: updatedTicket.updates,
            description: updatedTicket.description,
          })
          .eq('id', ticket.id);
      } catch (error) {
        console.warn('Failed to sync ticket update:', error);
      }
    }
  };

  const appendTicket = async (userId: string, ticket: SupportTicket) => {
    const key = getOrderItemKey(ticket.orderId, ticket.orderItemId);
    setSupportTickets((prev) => {
      const current = prev[key] || [];
      const nextMap = {
        ...prev,
        [key]: [ticket, ...current],
      };
      persistTickets(userId, nextMap);
      return nextMap;
    });
  };

  // Fetch orders from database and flatten to individual items
  const fetchOrders = async () => {
    try {
      const userId = userData?.id || user?.id;
      if (!userId) {
        setOrders([]);
        setSupportTickets({});
        setLoading(false);
        return;
      }

      // Add mock delivered order for testing (using valid UUIDs)
      const mockDeliveredOrder = {
        orderId: '00000000-0000-0000-0000-000000000001',
        orderNumber: 'ONL123456',
        date: 'Nov 5, 2025',
        status: 'delivered',
        statusColor: '#34C759',
        statusBg: '#E8F8ED',
        paymentStatus: 'paid',
        paymentMethod: 'UPI',
        shippingAddress: '123 Main St, City',
        itemId: '00000000-0000-0000-0000-000000000002',
        name: 'Premium Cotton T-Shirt',
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
        size: 'M',
        color: 'Navy Blue',
        quantity: 2,
        unitPrice: 599,
        totalPrice: 1198,
      };

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

      // Transform data to individual product items
      const flattenedItems: any[] = [mockDeliveredOrder]; // Start with mock order
      ordersData?.forEach(order => {
        const statusStyle = getStatusStyle(order.status);
        order.order_items?.forEach((item: any) => {
          flattenedItems.push({
            // Order info
            orderId: order.id,
          orderNumber: order.order_number,
          date: formatDate(order.created_at),
          status: order.status,
          statusColor: statusStyle.color,
          statusBg: statusStyle.bg,
          paymentStatus: order.payment_status,
          paymentMethod: order.payment_method,
          shippingAddress: order.shipping_address,
            // Item info
            itemId: item.id,
            name: item.product_name,
            image: item.product_image,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalPrice: item.total_price,
          });
        });
      });

      setOrders(flattenedItems);
      await hydrateSupportTickets(
        userId,
        ordersData?.map((order) => order.id) || []
      );
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

  const openTicketModal = (order: any, item: any, type: TicketType) => {
    if (type !== 'support' && order.status?.toLowerCase() !== 'delivered') {
      Toast.show({
        type: 'info',
        text1: `${type === 'return' ? 'Return' : 'Replacement'} unavailable`,
        text2: 'This option becomes available once your order is delivered.',
      });
      return;
    }

    const userId = userData?.id || user?.id;
    if (!userId) {
      Toast.show({
        type: 'info',
        text1: 'Login Required',
        text2: 'Please log in to raise a request.',
      });
      return;
    }

    setTicketType(type);
    setTicketReason('');
    setTicketDescription('');
    setTicketError(null);
    setSelectedOrderItem({
      orderId: order.id,
      orderItemId: item.id,
      orderNumber: order.orderNumber,
      productName: item.name,
      orderStatus: order.status,
    });
    setTicketModalVisible(true);
  };

  const closeTicketModal = () => {
    setTicketModalVisible(false);
    setTicketReason('');
    setTicketDescription('');
    setTicketError(null);
    setSelectedOrderItem(null);
  };

  const submitTicket = async () => {
    const userId = userData?.id || user?.id;
    if (!userId) {
      setTicketError('Please log in to continue.');
      return;
    }
    if (!selectedOrderItem) {
      setTicketError('Select an order item to continue.');
      return;
    }
    if (!ticketReason) {
      setTicketError('Choose a reason for this request.');
      return;
    }

    const nowIso = new Date().toISOString();
    const initialStatus: TicketStatus = ticketType === 'support' ? 'open' : 'requested';

    const localTicket: SupportTicket = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      orderId: selectedOrderItem.orderId,
      orderItemId: selectedOrderItem.orderItemId,
      orderNumber: selectedOrderItem.orderNumber,
      productName: selectedOrderItem.productName,
      type: ticketType,
      status: initialStatus,
      reason: ticketReason,
      description: ticketDescription.trim() ? ticketDescription.trim() : null,
      createdAt: nowIso,
      updates: [
        {
          timestamp: nowIso,
          status: initialStatus,
          message:
            ticketType === 'support'
              ? 'Support ticket created.'
              : `${SUPPORT_TYPE_LABELS[ticketType]} submitted.`,
        },
      ],
      origin: 'local',
    };

    setTicketSubmitting(true);
    setTicketError(null);

    try {
      let syncedTicket: SupportTicket | null = null;
      try {
        const { data, error } = await supabase
          .from('order_support_tickets')
          .insert({
            user_id: userId,
            order_id: localTicket.orderId,
            order_item_id: localTicket.orderItemId,
            order_number: localTicket.orderNumber,
            product_name: localTicket.productName,
            type: localTicket.type,
            status: localTicket.status,
            reason: localTicket.reason,
            description: localTicket.description,
            updates: localTicket.updates,
          })
          .select()
          .single();
        if (!error && data) {
          syncedTicket = {
            id: data.id,
            orderId: data.order_id,
            orderItemId: data.order_item_id,
            orderNumber: data.order_number,
            productName: data.product_name,
            type: data.type,
            status: data.status,
            reason: data.reason,
            description: data.description,
            createdAt: data.created_at,
            updates: Array.isArray(data.updates) ? data.updates : localTicket.updates,
            origin: 'remote',
          };
        }
      } catch (error) {
        console.log('Ticket sync skipped:', error);
      }

      const ticketToStore = syncedTicket || localTicket;
      await appendTicket(userId, ticketToStore);
      Toast.show({
        type: 'success',
        text1: 'Request submitted',
        text2: `${SUPPORT_TYPE_LABELS[ticketToStore.type]} has been created.`,
      });
      closeTicketModal();
    } catch (error) {
      console.error('Ticket submission error:', error);
      setTicketError('Unable to submit request. Please try again.');
    } finally {
      setTicketSubmitting(false);
    }
  };

  const updateTicketStatus = async (
    ticket: SupportTicket,
    nextStatus: TicketStatus,
    note?: string
  ) => {
    const userId = userData?.id || user?.id;
    if (!userId) return;

    const updateMessage = note || getStatusLabel(nextStatus);

    const updatedTicket: SupportTicket = {
      ...ticket,
      status: nextStatus,
      updates: [
        {
          timestamp: new Date().toISOString(),
          status: nextStatus,
          message: updateMessage,
        },
        ...ticket.updates,
      ],
    };

    await recordTicketUpdate(userId, ticket, updatedTicket);

    Toast.show({
      type: 'success',
      text1: 'Ticket updated',
      text2: updateMessage,
    });
  };

  const handleCancelTicket = async (ticket: SupportTicket) => {
    Alert.alert(
      'Cancel this request?',
      'This ticket will be closed and cannot be reopened.',
      [
        { text: 'Keep it open', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: () =>
            updateTicketStatus(ticket, 'cancelled', 'Request cancelled by customer.'),
        },
      ],
    );
  };

  const toggleTicketExpansion = (ticketId: string) => {
    setExpandedTicketId((prev) => (prev === ticketId ? null : ticketId));
  };

  const renderTimeline = (ticket: SupportTicket) => {
    const sequence = TICKET_STATUS_SEQUENCE[ticket.type] || [];
    const progressIndex = sequence.indexOf(ticket.status);
    return (
      <View style={styles.timelineContainer}>
        {sequence.map((statusKey, idx) => {
          const completed = progressIndex >= idx;
          return (
            <View key={`${ticket.id}_${statusKey}`} style={styles.timelineStep}>
              <View
                style={[
                  styles.timelineBullet,
                  completed && styles.timelineBulletActive,
                ]}
              >
                {completed && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
              <View style={styles.timelineStepContent}>
                <Text
                  style={[
                    styles.timelineStepLabel,
                    completed && styles.timelineStepLabelActive,
                  ]}
                >
                {getStatusLabel(statusKey)}
                </Text>
                {idx < sequence.length - 1 && <View style={styles.timelineConnector} />}
        </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderTicketCard = (ticket: SupportTicket) => {
    const nextStatus = getNextStatusForTicket(ticket);
    const isFinal =
      ticket.status === 'resolved' ||
      ticket.status === 'completed' ||
      ticket.status === 'delivered' ||
      ticket.status === 'cancelled' ||
      ticket.status === 'rejected';

    return (
      <View key={ticket.id} style={styles.ticketCard}>
        <TouchableOpacity
          onPress={() => toggleTicketExpansion(ticket.id)}
          activeOpacity={0.8}
          style={styles.ticketHeader}
        >
          <View style={styles.ticketHeaderLeft}>
            <View style={styles.ticketTypeBadge}>
              <Text style={styles.ticketTypeBadgeText}>
                {SUPPORT_TYPE_LABELS[ticket.type]}
          </Text>
        </View>
            <Text style={styles.ticketProduct}>{ticket.productName}</Text>
            <Text style={styles.ticketMeta}>
              Logged on {formatDate(ticket.createdAt)} • {ticket.reason}
            </Text>
      </View>
          <View style={styles.ticketHeaderRight}>
            <View
              style={[
                styles.ticketStatusPill,
                isFinal && styles.ticketStatusPillFinal,
              ]}
            >
              <Text
                style={[
                  styles.ticketStatusText,
                  isFinal && styles.ticketStatusTextFinal,
                ]}
              >
                {getStatusLabel(ticket.status)}
              </Text>
            </View>
            <Ionicons
              name={expandedTicketId === ticket.id ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#F53F7A"
            />
          </View>
        </TouchableOpacity>

        {expandedTicketId === ticket.id && (
          <View style={styles.ticketBody}>
            {renderTimeline(ticket)}

            {ticket.description ? (
              <View style={styles.ticketDescriptionBox}>
                <Text style={styles.ticketDescriptionLabel}>Details</Text>
                <Text style={styles.ticketDescriptionText}>{ticket.description}</Text>
              </View>
            ) : null}

            {ticket.updates?.length ? (
              <View style={styles.ticketUpdatesSection}>
                <Text style={styles.ticketUpdatesTitle}>Updates</Text>
                {ticket.updates.map((update) => (
                  <View key={update.timestamp} style={styles.ticketUpdateRow}>
                    <View style={styles.ticketUpdateDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ticketUpdateMessage}>{update.message}</Text>
                      <Text style={styles.ticketUpdateTime}>
                        {new Date(update.timestamp).toLocaleString()}
              </Text>
            </View>
          </View>
        ))}
      </View>
            ) : null}

            <View style={styles.ticketActionsRow}>
              {nextStatus && !isFinal && (
                <TouchableOpacity
                  style={styles.ticketActionPrimary}
                  onPress={() =>
                    updateTicketStatus(
                      ticket,
                      nextStatus,
                      `Progressed to ${getStatusLabel(nextStatus)}.`
                    )
                  }
                >
                  <Ionicons name="trending-up-outline" size={18} color="#fff" />
                  <Text style={styles.ticketActionPrimaryText}>
                    Mark as {getStatusLabel(nextStatus)}
                  </Text>
                </TouchableOpacity>
              )}

              {!isFinal && (
                <TouchableOpacity
                  style={styles.ticketActionSecondary}
                  onPress={() => handleCancelTicket(ticket)}
                >
                  <Ionicons name="close-circle" size={18} color="#F53F7A" />
                  <Text style={styles.ticketActionSecondaryText}>Cancel Request</Text>
                </TouchableOpacity>
              )}
      </View>
          </View>
        )}
      </View>
    );
  };

  const renderOrderCard = (item: any) => {
    return (
      <TouchableOpacity
        key={`${item.orderId}-${item.itemId}`}
        style={styles.orderCard}
        activeOpacity={0.95}
        onPress={() => navigation.navigate('OrderDetails', { orderId: item.orderId })}
      >
        {/* Product Image - Left Side */}
        <View style={styles.productImageSection}>
          <View style={styles.imageContainer}>
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={styles.productImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.productImage, styles.productImagePlaceholder]}>
                <Ionicons name="image-outline" size={28} color="#C7C7CC" />
              </View>
            )}
            {/* Quantity Badge Overlay */}
            {item.quantity > 1 && (
              <View style={styles.quantityBadgeOverlay}>
                <LinearGradient
                  colors={['rgba(245, 63, 122, 0.95)', 'rgba(233, 30, 99, 0.95)']}
                  style={styles.quantityBadgeGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.quantityBadgeText}>×{item.quantity}</Text>
                </LinearGradient>
              </View>
            )}
          </View>
        </View>

        {/* Order Content - Right Side */}
        <View style={styles.orderContent}>
          {/* Top Row: Product Name & Status */}
          <View style={styles.contentTopRow}>
            <View style={styles.orderNumberContainer}>
              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
          </Text>
              <View style={styles.orderMetaRow}>
                <Ionicons name="receipt-outline" size={11} color="#8E8E93" />
                <Text style={styles.orderNumber}>{item.orderNumber}</Text>
                <View style={styles.metaDivider} />
                <Ionicons name="calendar-outline" size={10} color="#8E8E93" />
                <Text style={styles.orderDate}>{item.date}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: item.statusBg }]}>
              <View style={[styles.statusDot, { backgroundColor: item.statusColor }]} />
              <Text style={[styles.statusText, { color: item.statusColor }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>

          {/* Star Rating for Delivered Items */}
          {item.status === 'delivered' && (
            <View style={styles.ratingRow}>
              <Text style={styles.ratingLabel}>Rate:</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleQuickRating(item, star);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Ionicons
                      name="star"
                      size={18}
                      color="#E0E0E0"
                      style={styles.starIcon}
                    />
                  </TouchableOpacity>
                ))}
              </View>
        </View>
      )}

          {/* Bottom Row: Price & Action */}
          <View style={styles.contentBottomRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.orderTotal}>₹{item.totalPrice.toLocaleString('en-IN')}</Text>
            </View>
            <TouchableOpacity
              style={styles.viewDetailsButton}
              onPress={(e) => {
                e.stopPropagation();
                navigation.navigate('OrderDetails', { orderId: item.orderId });
              }}
            >
              <LinearGradient
                colors={['#F53F7A', '#E91E63']}
                style={styles.viewDetailsGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.viewDetailsText}>View</Text>
                <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
              </LinearGradient>
      </TouchableOpacity>
    </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  // Handle quick rating from card
  const handleQuickRating = (item: any, rating: number) => {
    setSelectedItem(item);
    setReviewRating(rating);
    setReviewModalVisible(true);
  };
  
  // Handle rate and review
  const handleRateAndReview = (item: any) => {
    setSelectedItem(item);
    setReviewModalVisible(true);
  };
  
  // Handle report product
  const handleReportProduct = (item: any) => {
    setSelectedItem(item);
    setReportModalVisible(true);
  };
  
  // Pick media for review (images/videos)
  const pickReviewMedia = async () => {
    if (reviewMedia.length >= 5) {
      Toast.show({
        type: 'info',
        text1: 'Maximum Limit',
        text2: 'You can upload up to 5 images/videos',
      });
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant gallery permissions to upload media');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: false,
      quality: 0.8,
      videoMaxDuration: 30, // 30 seconds max
    });

    if (!result.canceled && result.assets[0]) {
      const mediaUri = result.assets[0].uri;
      const mediaType = result.assets[0].type;
      
      // Check video duration
      if (mediaType === 'video' && result.assets[0].duration && result.assets[0].duration > 30000) {
        Toast.show({
          type: 'info',
          text1: 'Video Too Long',
          text2: 'Videos must be 30 seconds or less',
        });
        return;
      }
      
      setReviewMedia([...reviewMedia, mediaUri]);
    }
  };

  // Take photo for review
  const takeReviewPhoto = async () => {
    if (reviewMedia.length >= 5) {
      Toast.show({
        type: 'info',
        text1: 'Maximum Limit',
        text2: 'You can upload up to 5 images/videos',
      });
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera permissions to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setReviewMedia([...reviewMedia, result.assets[0].uri]);
    }
  };

  // Remove media from review
  const removeReviewMedia = (index: number) => {
    setReviewMedia(reviewMedia.filter((_, i) => i !== index));
  };

  // Submit review
  const submitReview = async () => {
    if (!selectedItem || reviewRating === 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please provide a rating',
      });
      return;
    }
    
    try {
      const userId = userData?.id || user?.id;
      if (!userId) return;
      
      const { error } = await supabase.from('product_reviews').insert({
        user_id: userId,
        product_id: selectedItem.itemId,
        order_id: selectedItem.orderId,
        rating: reviewRating,
        title: reviewTitle,
        comment: reviewComment,
        media: reviewMedia.length > 0 ? reviewMedia : null,
      });
      
      if (error) throw error;
      
      Toast.show({
        type: 'success',
        text1: 'Review Submitted',
        text2: 'Thank you for your feedback!',
      });
      
      // Reset and close
      setReviewModalVisible(false);
      setReviewRating(0);
      setReviewTitle('');
      setReviewComment('');
      setReviewMedia([]);
      setSelectedItem(null);
    } catch (error) {
      console.error('Error submitting review:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to submit review. Please try again.',
      });
    }
  };
  
  // Submit report
  const submitReport = async () => {
    if (!selectedItem || !reportType) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select a report type',
      });
      return;
    }
    
    try {
      const userId = userData?.id || user?.id;
      if (!userId) return;
      
      const { error } = await supabase.from('product_reports').insert({
        user_id: userId,
        product_id: selectedItem.itemId,
        order_id: selectedItem.orderId,
        report_type: reportType,
        description: reportDescription,
      });
      
      if (error) throw error;
      
      Toast.show({
        type: 'success',
        text1: 'Report Submitted',
        text2: 'Our team will review your report.',
      });
      
      // Reset and close
      setReportModalVisible(false);
      setReportType('');
      setReportDescription('');
      setSelectedItem(null);
    } catch (error) {
      console.error('Error submitting report:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to submit report. Please try again.',
      });
    }
  };

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

      <Modal
        visible={ticketModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeTicketModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.ticketModalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeTicketModal}
          />
          <View style={styles.ticketModalContent}>
            <View style={styles.ticketModalHeader}>
              <View>
                <Text style={styles.ticketModalTitle}>
                  {SUPPORT_TYPE_LABELS[ticketType]}
                </Text>
                {selectedOrderItem && (
                  <Text style={styles.ticketModalSubtitle}>
                    {selectedOrderItem.productName} • {selectedOrderItem.orderNumber}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={closeTicketModal} style={styles.ticketModalClose}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.ticketModalSection}>
              <Text style={styles.ticketModalLabel}>Select a reason</Text>
              <View style={styles.ticketReasonChips}>
                {TICKET_REASON_OPTIONS[ticketType].map((reason) => {
                  const selected = reason === ticketReason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      style={[
                        styles.ticketReasonChip,
                        selected && styles.ticketReasonChipSelected,
                      ]}
                      onPress={() => setTicketReason(reason)}
                    >
                      <Text
                        style={[
                          styles.ticketReasonChipText,
                          selected && styles.ticketReasonChipTextSelected,
                        ]}
                      >
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.ticketModalSection}>
              <Text style={styles.ticketModalLabel}>Share additional details</Text>
              <TextInput
                multiline
                placeholder="Tell us more about the issue…"
                placeholderTextColor="#9CA3AF"
                style={styles.ticketDescriptionInput}
                value={ticketDescription}
                onChangeText={setTicketDescription}
              />
            </View>

            {ticketError ? (
              <Text style={styles.ticketErrorText}>{ticketError}</Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.ticketSubmitButton,
                (!ticketReason || ticketSubmitting) && styles.ticketSubmitButtonDisabled,
              ]}
              disabled={!ticketReason || ticketSubmitting}
              onPress={submitTicket}
            >
              {ticketSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color="#fff" />
                  <Text style={styles.ticketSubmitButtonText}>Submit Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
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
          {orders.map((item, index) => renderOrderCard(item))}
        </ScrollView>
      )}
      
      {/* Review Modal */}
      <Modal
        visible={isReviewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setReviewModalVisible(false)}
          />
          <View style={styles.reviewModalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rate & Review</Text>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {/* Scrollable Content */}
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Product Info */}
              {selectedItem && (
                <View style={styles.productInfoSection}>
                  <Image
                    source={{ uri: selectedItem.image }}
                    style={styles.modalProductImage}
                    resizeMode="cover"
                  />
                  <View style={styles.modalProductInfo}>
                    <Text style={styles.modalProductName} numberOfLines={2}>
                      {selectedItem.name}
                    </Text>
                    <Text style={styles.modalProductDetails}>
                      Size: {selectedItem.size} • Color: {selectedItem.color}
                    </Text>
                  </View>
                </View>
              )}
              
              {/* Star Rating */}
              <View style={styles.ratingSection}>
                <Text style={styles.sectionLabel}>Your Rating</Text>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setReviewRating(star)}
                      style={styles.starButton}
                    >
                      <Ionicons
                        name={star <= reviewRating ? 'star' : 'star-outline'}
                        size={36}
                        color={star <= reviewRating ? '#FFB800' : '#D1D1D6'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {/* Review Title */}
              <View style={styles.inputSection}>
                <Text style={styles.sectionLabel}>Review Title (Optional)</Text>
                <TextInput
                  style={styles.titleInput}
                  placeholder="Summarize your experience"
                  placeholderTextColor="#999"
                  value={reviewTitle}
                  onChangeText={setReviewTitle}
                  maxLength={100}
                />
              </View>
              
              {/* Review Comment */}
              <View style={styles.inputSection}>
                <Text style={styles.sectionLabel}>Your Review (Optional)</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Share details of your experience"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  maxLength={500}
                />
              </View>
              
              {/* Media Upload */}
              <View style={styles.mediaSection}>
                <Text style={styles.sectionLabel}>Add Photos/Videos (Optional)</Text>
                <Text style={styles.mediaSublabel}>Max 5 files • Videos up to 30 seconds</Text>
                
                {/* Media Grid */}
                {reviewMedia.length > 0 && (
                  <ScrollView
                    horizontal
                    style={styles.mediaScrollView}
                    showsHorizontalScrollIndicator={false}
                  >
                    {reviewMedia.map((uri, index) => (
                      <View key={index} style={styles.mediaItem}>
                        <Image
                          source={{ uri }}
                          style={styles.mediaPreview}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={styles.removeMediaButton}
                          onPress={() => removeReviewMedia(index)}
                        >
                          <Ionicons name="close-circle" size={24} color="#F53F7A" />
                        </TouchableOpacity>
                        {/* Video indicator */}
                        {uri.includes('video') || uri.includes('.mp4') || uri.includes('.mov') ? (
                          <View style={styles.videoIndicator}>
                            <Ionicons name="play-circle" size={32} color="#FFFFFF" />
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </ScrollView>
                )}
                
                {/* Upload Buttons */}
                {reviewMedia.length < 5 && (
                  <View style={styles.mediaButtonsRow}>
                    <TouchableOpacity
                      style={styles.mediaButton}
                      onPress={pickReviewMedia}
                    >
                      <LinearGradient
                        colors={['#FFF5F9', '#FFFFFF']}
                        style={styles.mediaButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                      >
                        <Ionicons name="images-outline" size={22} color="#F53F7A" />
                        <Text style={styles.mediaButtonText}>Gallery</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.mediaButton}
                      onPress={takeReviewPhoto}
                    >
                      <LinearGradient
                        colors={['#FFF5F9', '#FFFFFF']}
                        style={styles.mediaButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                      >
                        <Ionicons name="camera-outline" size={22} color="#F53F7A" />
                        <Text style={styles.mediaButtonText}>Camera</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              
              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitReviewButton,
                  reviewRating === 0 && styles.submitButtonDisabled
                ]}
                onPress={submitReview}
                disabled={reviewRating === 0}
              >
                <LinearGradient
                  colors={reviewRating === 0 ? ['#CCC', '#AAA'] : ['#F53F7A', '#E91E63']}
                  style={styles.submitButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Submit Review</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      
      {/* Report Modal */}
      <Modal
        visible={isReportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setReportModalVisible(false)}
          />
          <View style={styles.reportModalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report an Issue</Text>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {/* Product Info */}
            {selectedItem && (
              <View style={styles.productInfoSection}>
                <Image
                  source={{ uri: selectedItem.image }}
                  style={styles.modalProductImage}
                  resizeMode="cover"
                />
                <View style={styles.modalProductInfo}>
                  <Text style={styles.modalProductName} numberOfLines={2}>
                    {selectedItem.name}
                  </Text>
                  <Text style={styles.modalProductDetails}>
                    Order: {selectedItem.orderNumber}
                  </Text>
                </View>
              </View>
            )}
            
            {/* Report Types */}
            <View style={styles.reportTypesSection}>
              <Text style={styles.sectionLabel}>What's the issue?</Text>
              <View style={styles.reportTypesGrid}>
                {[
                  { id: 'wrong_item', label: 'Wrong Item Sent', icon: 'swap-horizontal' },
                  { id: 'damaged', label: 'Damaged Item', icon: 'warning' },
                  { id: 'defective', label: 'Defective Product', icon: 'construct' },
                  { id: 'not_as_described', label: 'Not as Described', icon: 'document-text' },
                  { id: 'poor_quality', label: 'Poor Quality', icon: 'thumbs-down' },
                  { id: 'missing_parts', label: 'Missing Parts', icon: 'cube-outline' },
                  { id: 'size_issue', label: 'Size Issue', icon: 'resize' },
                  { id: 'other', label: 'Other Issue', icon: 'ellipsis-horizontal' },
                ].map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.reportTypeChip,
                      reportType === type.id && styles.reportTypeChipSelected
                    ]}
                    onPress={() => setReportType(type.id)}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={18}
                      color={reportType === type.id ? '#F53F7A' : '#666'}
                    />
                    <Text
                      style={[
                        styles.reportTypeText,
                        reportType === type.id && styles.reportTypeTextSelected
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {/* Description */}
            <View style={styles.inputSection}>
              <Text style={styles.sectionLabel}>Describe the issue (Optional)</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Provide more details about the problem..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                value={reportDescription}
                onChangeText={setReportDescription}
                maxLength={500}
              />
            </View>
            
            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitReviewButton,
                !reportType && styles.submitButtonDisabled
              ]}
              onPress={submitReport}
              disabled={!reportType}
            >
              <LinearGradient
                colors={!reportType ? ['#CCC', '#AAA'] : ['#F53F7A', '#E91E63']}
                style={styles.submitButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Submit Report</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#DBDBDB',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#262626',
    letterSpacing: -0.5,
  },
  headerSpacer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingTop: 12,
  },
  // Enhanced Order Card - Image Left, Content Right
  orderCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F3',
  },
  // Product Image Section - Left Side
  productImageSection: {
    position: 'relative',
    marginRight: 14,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  productImage: {
    width: 75,
    height: 75,
    backgroundColor: '#F8F8F8',
  },
  productImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  quantityBadgeOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  quantityBadgeGradient: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  // Order Content - Right Side
  orderContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  // Content Rows
  contentTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderNumberContainer: {
    flex: 1,
    marginRight: 10,
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.4,
    marginBottom: 3,
    lineHeight: 18,
  },
  orderNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: -0.2,
  },
  orderDate: {
    fontSize: 11,
    fontWeight: '500',
    color: '#A8A8A8',
    letterSpacing: -0.2,
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
  contentDivider: {
    height: 1,
    backgroundColor: '#F5F5F7',
    marginVertical: 10,
  },
  contentMiddleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 6,
    marginBottom: 6,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E8E8EA',
  },
  detailChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3C3C43',
  },
  paymentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFE0EC',
  },
  paymentChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F53F7A',
    letterSpacing: 0.3,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF5F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfoText: {
    fontSize: 12,
    color: '#3C3C43',
    fontWeight: '600',
  },
  paymentBadge: {
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: '#E5E5EA',
  },
  paymentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  contentBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 0,
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 10,
    color: '#A8A8A8',
    fontWeight: '500',
    marginTop: 3,
    letterSpacing: 0.3,
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F53F7A',
    letterSpacing: -0.6,
  },
  viewDetailsButton: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#F53F7A',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  viewDetailsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  // Star Rating Row
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  ratingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3C3C43',
    marginRight: 8,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starIcon: {
    marginHorizontal: 1,
  },
  ticketList: {
    marginTop: 16,
    gap: 12,
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
  ticketCard: {
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  ticketHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  ticketTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF1F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 6,
  },
  ticketTypeBadgeText: {
    color: '#F53F7A',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ticketProduct: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  ticketMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  ticketHeaderRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  ticketStatusPill: {
    backgroundColor: '#FDF2F8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  ticketStatusPillFinal: {
    backgroundColor: '#ECFDF3',
  },
  ticketStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F53F7A',
  },
  ticketStatusTextFinal: {
    color: '#047857',
  },
  ticketBody: {
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  timelineContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginVertical: 12,
  },
  timelineStep: {
    flex: 1,
    alignItems: 'center',
  },
  timelineBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FBCFE8',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineBulletActive: {
    backgroundColor: '#F53F7A',
    borderColor: '#F53F7A',
  },
  timelineStepContent: {
    alignItems: 'center',
    marginTop: 6,
  },
  timelineStepLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  timelineStepLabelActive: {
    color: '#F53F7A',
    fontWeight: '700',
  },
  timelineConnector: {
    width: 2,
    height: 16,
    backgroundColor: '#FBCFE8',
    marginTop: 6,
    borderRadius: 999,
  },
  ticketDescriptionBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  ticketDescriptionLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  ticketDescriptionText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  ticketUpdatesSection: {
    marginBottom: 12,
  },
  ticketUpdatesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  ticketUpdateRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  ticketUpdateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F53F7A',
    marginTop: 6,
  },
  ticketUpdateMessage: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500',
  },
  ticketUpdateTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  ticketActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  ticketActionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F53F7A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  ticketActionPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  ticketActionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECDD3',
    backgroundColor: '#FFF5F8',
  },
  ticketActionSecondaryText: {
    color: '#F53F7A',
    fontWeight: '600',
    fontSize: 13,
  },
  ticketModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
  },
  ticketModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  ticketModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  ticketModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  ticketModalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  ticketModalClose: {
    padding: 4,
  },
  ticketModalSection: {
    marginBottom: 18,
  },
  ticketModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  ticketReasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ticketReasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  ticketReasonChipSelected: {
    borderColor: '#F53F7A',
    backgroundColor: '#FFE4ED',
  },
  ticketReasonChipText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  ticketReasonChipTextSelected: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  ticketDescriptionInput: {
    minHeight: 100,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
    backgroundColor: '#F9FAFB',
  },
  ticketErrorText: {
    color: '#B91C1C',
    fontWeight: '600',
    marginBottom: 12,
  },
  ticketSubmitButton: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: '#F53F7A',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ticketSubmitButtonDisabled: {
    backgroundColor: '#F8BBD0',
  },
  ticketSubmitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  // Action buttons
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F3',
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#F53F7A',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#FFE0EC',
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  reviewModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: '90%',
  },
  modalScrollView: {
    maxHeight: '100%',
  },
  modalScrollContent: {
    paddingBottom: 40,
  },
  reportModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  productInfoSection: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 20,
  },
  modalProductImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  modalProductInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  modalProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  modalProductDetails: {
    fontSize: 12,
    color: '#8E8E93',
  },
  ratingSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  starButton: {
    padding: 4,
  },
  inputSection: {
    marginBottom: 20,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1C1C1E',
    backgroundColor: '#FAFAFA',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1C1C1E',
    backgroundColor: '#FAFAFA',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitReviewButton: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reportTypesSection: {
    marginBottom: 20,
  },
  reportTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reportTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
  },
  reportTypeChipSelected: {
    backgroundColor: '#FFF5F9',
    borderColor: '#F53F7A',
  },
  reportTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  reportTypeTextSelected: {
    color: '#F53F7A',
  },
  // Media Upload Section
  mediaSection: {
    marginBottom: 20,
  },
  mediaSublabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 12,
  },
  mediaScrollView: {
    marginBottom: 12,
  },
  mediaItem: {
    position: 'relative',
    marginRight: 10,
  },
  mediaPreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  removeMediaButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  videoIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
  },
  mediaButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#F53F7A',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  mediaButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#FFE0EC',
    borderRadius: 12,
  },
  mediaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
});

export default MyOrders;
