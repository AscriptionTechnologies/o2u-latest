import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ResellerService } from '~/services/resellerService';
import { useUser } from '~/contexts/UserContext';
import type { ResellerDashboard, Reseller } from '~/types/reseller';

const ResellerDashboard = () => {
  const navigation = useNavigation();
  const { userData } = useUser();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<ResellerDashboard | null>(null);
  const [resellerInfo, setResellerInfo] = useState<Reseller | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    if (!userData?.id) return;
    
    try {
      setLoading(true);
      const [reseller, dashboard] = await Promise.all([
        ResellerService.getResellerByUserId(userData.id),
        ResellerService.getResellerDashboard(userData.id)
      ]);
      
      setResellerInfo(reseller);
      setDashboardData(dashboard);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const StatCard = ({ title, value, icon, color, onPress }: {
    title: string;
    value: string | number;
    icon: string;
    color: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity 
      style={[styles.statCard, onPress && styles.statCardPressable]} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.statCardContent}>
        <View style={[styles.statIcon, { backgroundColor: color }]}>
          <Ionicons name={icon as any} size={24} color="#fff" />
        </View>
        <View style={styles.statInfo}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
        </View>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color="#999" />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F53F7A" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (!resellerInfo) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reseller Dashboard</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.notResellerContainer}>
          <Ionicons name="person-add" size={64} color="#999" />
          <Text style={styles.notResellerTitle}>Not a Reseller Yet?</Text>
          <Text style={styles.notResellerSubtitle}>
            Join our reseller program and start earning by sharing amazing products with your network.
          </Text>
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => navigation.navigate('ResellerRegistration' as never)}
          >
            <Text style={styles.registerButtonText}>Become a Reseller</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reseller Dashboard</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => {
            // Navigate to reseller settings
            Alert.alert('Coming Soon', 'Reseller settings will be available soon!');
          }}>
          <Ionicons name="settings-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>
            Welcome back, {resellerInfo.business_name || userData?.name}!
          </Text>
          <Text style={styles.welcomeSubtitle}>
            {resellerInfo.is_verified ? '✅ Verified Reseller' : '⏳ Pending Verification'}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Total Products"
            value={dashboardData?.total_products || 0}
            icon="cube-outline"
            color="#4CAF50"
            onPress={() => {
              // Navigate to products management
              Alert.alert('Coming Soon', 'Product management will be available soon!');
            }}
          />
          <StatCard
            title="Active Products"
            value={dashboardData?.active_products || 0}
            icon="checkmark-circle-outline"
            color="#2196F3"
          />
          <StatCard
            title="Total Orders"
            value={dashboardData?.total_orders || 0}
            icon="receipt-outline"
            color="#FF9800"
            onPress={() => {
              // Navigate to orders
              Alert.alert('Coming Soon', 'Order management will be available soon!');
            }}
          />
          <StatCard
            title="Pending Orders"
            value={dashboardData?.pending_orders || 0}
            icon="time-outline"
            color="#F44336"
          />
        </View>

        {/* Earnings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings Overview</Text>
          <View style={styles.earningsGrid}>
            <View style={styles.earningsCard}>
              <Text style={styles.earningsLabel}>Total Earnings</Text>
              <Text style={styles.earningsValue}>₹{dashboardData?.total_earnings?.toFixed(2) || '0.00'}</Text>
            </View>
            <View style={styles.earningsCard}>
              <Text style={styles.earningsLabel}>This Month</Text>
              <Text style={styles.earningsValue}>₹{dashboardData?.this_month_earnings?.toFixed(2) || '0.00'}</Text>
            </View>
            <View style={styles.earningsCard}>
              <Text style={styles.earningsLabel}>Last Month</Text>
              <Text style={styles.earningsValue}>₹{dashboardData?.last_month_earnings?.toFixed(2) || '0.00'}</Text>
            </View>
            <View style={styles.earningsCard}>
              <Text style={styles.earningsLabel}>Pending</Text>
              <Text style={styles.earningsValue}>₹{dashboardData?.pending_earnings?.toFixed(2) || '0.00'}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => {
                // Navigate to add products
                Alert.alert('Coming Soon', 'Add products feature will be available soon!');
              }}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="add-circle" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Add Products</Text>
              <Text style={styles.actionSubtitle}>Add products to your catalog</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => {
                // Navigate to catalog sharing
                Alert.alert('Coming Soon', 'Catalog sharing will be available soon!');
              }}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="share-social" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Share Catalog</Text>
              <Text style={styles.actionSubtitle}>Share your product catalog</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => {
                // Navigate to analytics
                Alert.alert('Coming Soon', 'Analytics will be available soon!');
              }}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="analytics" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Analytics</Text>
              <Text style={styles.actionSubtitle}>View performance metrics</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => {
                // Navigate to support
                Alert.alert('Coming Soon', 'Support will be available soon!');
              }}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#9C27B0' }]}>
                <Ionicons name="help-circle" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Support</Text>
              <Text style={styles.actionSubtitle}>Get help and support</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Orders */}
        {dashboardData?.recent_orders && dashboardData.recent_orders.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            {dashboardData.recent_orders.slice(0, 3).map((order, index) => (
              <View key={order.id || index} style={styles.orderCard}>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderNumber}>{order.order_number}</Text>
                  <Text style={styles.orderCustomer}>{order.customer_name}</Text>
                  <Text style={styles.orderAmount}>₹{order.total_amount.toFixed(2)}</Text>
                </View>
                <View style={[
                  styles.orderStatus,
                  { backgroundColor: order.status === 'pending' ? '#FF9800' : '#4CAF50' }
                ]}>
                  <Text style={styles.orderStatusText}>{order.status}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Tips Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tips for Success</Text>
          <View style={styles.tipsCard}>
            <Text style={styles.tipText}>
              💡 Share your catalog regularly on social media to reach more customers
            </Text>
            <Text style={styles.tipText}>
              📱 Use WhatsApp and Telegram to share products directly with your contacts
            </Text>
            <Text style={styles.tipText}>
              🎯 Focus on products with good margins to maximize your earnings
            </Text>
            <Text style={styles.tipText}>
              📊 Check your analytics regularly to understand what's working
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  settingsButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  notResellerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  notResellerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  notResellerSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  registerButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  welcomeSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: (300 - 36) / 2,
  },
  statCardPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  statTitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  earningsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  earningsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: (300 - 36) / 2,
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  earningsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F53F7A',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    minWidth: (300 - 36) / 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  orderCustomer: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F53F7A',
    marginTop: 4,
  },
  orderStatus: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },
  tipsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
});

export default ResellerDashboard;
