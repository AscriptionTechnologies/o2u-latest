import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '~/utils/supabase';
import { useUser } from '~/contexts/UserContext';
import { ResellerService } from '~/services/resellerService';

interface ResellerOrderRecord {
  id: string;
  order_number: string;
  created_at: string;
  total_amount: number;
  reseller_commission: number;
  platform_commission: number;
  payment_status: string;
  items: Array<{
    product_id?: string;
    variant_id?: string;
    quantity: number;
    unit_price?: number;
    total_price?: number;
    reseller_price?: number;
  }>;
}

type EnrichedOrder = {
  id: string;
  order_number: string;
  created_at: string;
  total_amount: number;
  original_total: number;
  reseller_margin_percentage: number;
  reseller_margin_amount: number;
  reseller_profit: number;
  payment_status: string;
  order_items: ResellerOrderRecord['items'];
};

interface EarningsStats {
  totalEarnings: number;
  totalOrders: number;
  pendingEarnings: number;
  completedEarnings: number;
}

export default function ResellerEarnings() {
  const navigation = useNavigation();
  const { userData } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<EnrichedOrder[]>([]);
  const [stats, setStats] = useState<EarningsStats>({
    totalEarnings: 0,
    totalOrders: 0,
    pendingEarnings: 0,
    completedEarnings: 0,
  });
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'paid'>('all');

  useEffect(() => {
    fetchEarningsData();
  }, [selectedFilter]);

  const fetchEarningsData = async () => {
    try {
      setLoading(true);
      
      if (!userData?.id) {
        setLoading(false);
        return;
      }

      const resellerProfile = await ResellerService.getResellerByUserId(userData.id);
      if (!resellerProfile) {
        setOrders([]);
        setStats({
          totalEarnings: 0,
          totalOrders: 0,
          pendingEarnings: 0,
          completedEarnings: 0,
        });
        setLoading(false);
        return;
      }

      let query = supabase
        .from('reseller_orders')
        .select(`
          id,
          order_number,
          created_at,
          total_amount,
          reseller_commission,
          platform_commission,
          payment_status,
          items:reseller_order_items(
            product_id,
            variant_id,
            quantity,
            unit_price,
            total_price,
            reseller_price
          )
        `)
        .eq('reseller_id', resellerProfile.id)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      const rawOrders: ResellerOrderRecord[] = (data as ResellerOrderRecord[] | null) ?? [];

      const mapOrder = (order: ResellerOrderRecord): EnrichedOrder => {
        const originalTotal = (order.items || []).reduce((sum, item) => sum + Number(item.total_price || 0), 0);
        const marginAmount = Number(order.reseller_commission || 0);
        const marginPercentage = originalTotal > 0 ? (marginAmount / originalTotal) * 100 : 0;
        return {
          id: order.id,
          order_number: order.order_number,
          created_at: order.created_at,
          total_amount: Number(order.total_amount || 0),
          original_total: originalTotal,
          reseller_margin_percentage: marginPercentage,
          reseller_margin_amount: marginAmount,
          reseller_profit: marginAmount,
          payment_status: order.payment_status,
          order_items: order.items || [],
        };
      };

      const allEnrichedOrders = rawOrders.map(mapOrder);

      const filteredOrders = selectedFilter === 'all'
        ? allEnrichedOrders
        : allEnrichedOrders.filter(o => o.payment_status === selectedFilter);

      const totalEarnings = allEnrichedOrders.reduce((sum, order) => sum + (order.reseller_profit || 0), 0);
      const pendingEarnings = allEnrichedOrders
        .filter(o => o.payment_status === 'pending')
        .reduce((sum, order) => sum + (order.reseller_profit || 0), 0);
      const completedEarnings = allEnrichedOrders
        .filter(o => o.payment_status === 'paid')
        .reduce((sum, order) => sum + (order.reseller_profit || 0), 0);

      setStats({
        totalEarnings,
        totalOrders: allEnrichedOrders.length,
        pendingEarnings,
        completedEarnings,
      });

      setOrders(filteredOrders);

    } catch (error) {
      console.error('Error in fetchEarningsData:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEarningsData();
  };

  const renderStatCard = (title: string, value: string, icon: string, color: string) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </View>
  );

  const renderOrderItem = ({ item }: { item: EnrichedOrder }) => (
    <TouchableOpacity style={styles.orderCard} activeOpacity={0.7}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderNumber}>#{item.order_number}</Text>
          <Text style={styles.orderDate}>
            {new Date(item.created_at).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.profitBadge}>
          <Text style={styles.profitLabel}>Your Profit</Text>
          <Text style={styles.profitAmount}>₹{item.reseller_profit?.toFixed(2) || '0.00'}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.orderDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Original Price:</Text>
          <Text style={styles.detailValue}>₹{item.original_total?.toFixed(2) || '0.00'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Your Margin ({item.reseller_margin_percentage || 0}%):</Text>
          <Text style={[styles.detailValue, styles.marginValue]}>
            +₹{item.reseller_margin_amount?.toFixed(2) || '0.00'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabelBold}>Selling Price:</Text>
          <Text style={styles.detailValueBold}>₹{item.total_amount?.toFixed(2) || '0.00'}</Text>
        </View>
      </View>

      {/* Delivery Dates for Pending Orders */}
      {item.payment_status === 'pending' && (item.estimated_delivery_date || item.expected_completion_date) && (
        <>
          <View style={styles.divider} />
          <View style={styles.deliveryInfoContainer}>
            {item.estimated_delivery_date && (
              <View style={styles.deliveryRow}>
                <Ionicons name="location-outline" size={18} color="#F59E0B" />
                <View style={styles.deliveryTextContainer}>
                  <Text style={styles.deliveryLabel}>Estimated Delivery</Text>
                  <Text style={styles.deliveryDate}>
                    {new Date(item.estimated_delivery_date).toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
            )}
            {item.expected_completion_date && (
              <View style={styles.deliveryRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                <View style={styles.deliveryTextContainer}>
                  <Text style={styles.deliveryLabel}>Expected Completion</Text>
                  <Text style={styles.deliveryDate}>
                    {new Date(item.expected_completion_date).toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </>
      )}

      <View style={styles.divider} />

      <View style={styles.orderFooter}>
        <View style={styles.itemsInfo}>
          <Ionicons name="cube-outline" size={16} color="#666" />
          <Text style={styles.itemsText}>
            {item.order_items?.length || 0} item(s)
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          item.payment_status === 'paid' ? styles.statusPaid : styles.statusPending
        ]}>
          <Text style={[
            styles.statusText,
            item.payment_status === 'paid' ? styles.statusTextPaid : styles.statusTextPending
          ]}>
            {item.payment_status === 'paid' ? 'Completed' : 'Pending'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F53F7A" />
        <Text style={styles.loadingText}>Loading your earnings...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Earnings</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Statistics Cards */}
      <View style={styles.statsContainer}>
        {renderStatCard(
          'Total Earnings',
          `₹${stats.totalEarnings.toFixed(2)}`,
          'wallet',
          '#10B981'
        )}
        {renderStatCard(
          'Total Orders',
          stats.totalOrders.toString(),
          'receipt',
          '#F53F7A'
        )}
      </View>

      <View style={styles.statsContainer}>
        {renderStatCard(
          'Pending Earnings',
          `₹${stats.pendingEarnings.toFixed(2)}`,
          'time',
          '#F59E0B'
        )}
        {renderStatCard(
          'Completed Earnings',
          `₹${stats.completedEarnings.toFixed(2)}`,
          'checkmark-circle',
          '#3B82F6'
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'all' && styles.filterTabActive]}
          onPress={() => setSelectedFilter('all')}>
          <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'pending' && styles.filterTabActive]}
          onPress={() => setSelectedFilter('pending')}>
          <Text style={[styles.filterText, selectedFilter === 'pending' && styles.filterTextActive]}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'paid' && styles.filterTabActive]}
          onPress={() => setSelectedFilter('paid')}>
          <Text style={[styles.filterText, selectedFilter === 'paid' && styles.filterTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#F53F7A']}
            tintColor="#F53F7A"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="bag-handle-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Reseller Orders Yet</Text>
            <Text style={styles.emptySubtitle}>
              Start reselling products to track your earnings here
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerRight: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statContent: {
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statTitle: {
    fontSize: 13,
    color: '#666',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#F53F7A',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  orderDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  profitBadge: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'flex-end',
  },
  profitLabel: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  profitAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
  orderDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailLabelBold: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  detailValue: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  marginValue: {
    color: '#10B981',
    fontWeight: '600',
  },
  detailValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F53F7A',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemsText: {
    fontSize: 13,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusPaid: {
    backgroundColor: '#3B82F620',
  },
  statusPending: {
    backgroundColor: '#F59E0B20',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextPaid: {
    color: '#3B82F6',
  },
  statusTextPending: {
    color: '#F59E0B',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  deliveryInfoContainer: {
    gap: 12,
    backgroundColor: '#FFF9F5',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  deliveryTextContainer: {
    flex: 1,
  },
  deliveryLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 2,
  },
  deliveryDate: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '700',
  },
});
