import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

interface VendorOrder {
  id: string;
  customer: string;
  total: number;
  status: OrderStatus;
  items: number;
  orderedAt: string;
}

interface VendorProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  isActive: boolean;
  views: number;
  updatedAt: string;
}

interface VendorQuestion {
  id: string;
  product: string;
  question: string;
  askedBy: string;
  askedAt: string;
  isAnswered: boolean;
}

const mockOrders: VendorOrder[] = [
  { id: 'ORD-9241', customer: 'Ananya Sharma', total: 3499, status: 'pending', items: 2, orderedAt: '2025-11-10 13:25' },
  { id: 'ORD-9238', customer: 'Rohan Verma', total: 2199, status: 'processing', items: 1, orderedAt: '2025-11-10 10:42' },
  { id: 'ORD-9235', customer: 'Sneha Patel', total: 4899, status: 'shipped', items: 3, orderedAt: '2025-11-09 19:10' },
  { id: 'ORD-9229', customer: 'Amit Singh', total: 1899, status: 'delivered', items: 1, orderedAt: '2025-11-09 11:05' },
];

const mockProducts: VendorProduct[] = [
  { id: 'P-1452', name: 'Festive Silk Saree', price: 3499, stock: 12, isActive: true, views: 1432, updatedAt: '2 hours ago' },
  { id: 'P-1411', name: 'Designer Kurti Set', price: 1799, stock: 0, isActive: false, views: 856, updatedAt: '1 day ago' },
  { id: 'P-1320', name: 'Embroidered Lehenga', price: 5299, stock: 4, isActive: true, views: 2211, updatedAt: '4 days ago' },
];

const mockQuestions: VendorQuestion[] = [
  { id: 'QA-431', product: 'Festive Silk Saree', question: 'Does it come with a blouse piece?', askedBy: 'Priya', askedAt: '2h ago', isAnswered: false },
  { id: 'QA-429', product: 'Designer Kurti Set', question: 'Will size M be restocked soon?', askedBy: 'Neha', askedAt: '7h ago', isAnswered: true },
  { id: 'QA-418', product: 'Embroidered Lehenga', question: 'What is the return policy?', askedBy: 'Aisha', askedAt: '1d ago', isAnswered: false },
];

const statusBadgeConfig: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  processing: { label: 'Processing', color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  shipped: { label: 'Shipped', color: '#0891B2', bg: 'rgba(8,145,178,0.12)' },
  delivered: { label: 'Delivered', color: '#16A34A', bg: 'rgba(22,163,74,0.12)' },
  cancelled: { label: 'Cancelled', color: '#DC2626', bg: 'rgba(220,38,38,0.12)' },
};

const VendorDashboard: React.FC = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'questions'>('orders');
  const [refreshing, setRefreshing] = useState(false);

  const metrics = useMemo(() => {
    const totalRevenue = mockOrders.reduce((sum, order) => sum + order.total, 0);
    const activeProducts = mockProducts.filter(product => product.isActive).length;
    const openQuestions = mockQuestions.filter(q => !q.isAnswered).length;
    const pendingOrders = mockOrders.filter(order => order.status === 'pending' || order.status === 'processing').length;

    return [
      { label: 'Today\'s Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: 'cash-outline', color: '#F53F7A' },
      { label: 'Active Products', value: activeProducts.toString(), icon: 'pricetags-outline', color: '#6366F1' },
      { label: 'Pending Orders', value: pendingOrders.toString(), icon: 'cube-outline', color: '#22C55E' },
      { label: 'Open Q&A', value: openQuestions.toString(), icon: 'chatbubble-ellipses-outline', color: '#F97316' },
    ];
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const renderOrders = () => (
    <FlatList
      data={mockOrders}
      keyExtractor={item => item.id}
      style={{ marginTop: 12 }}
      renderItem={({ item }) => {
        const status = statusBadgeConfig[item.status];
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.id}</Text>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
            <View style={styles.cardRow}>
              <Ionicons name="person-circle-outline" size={18} color="#6B7280" />
              <Text style={styles.cardMeta}>{item.customer}</Text>
            </View>
            <View style={styles.cardRow}>
              <Ionicons name="bag-handle-outline" size={18} color="#6B7280" />
              <Text style={styles.cardMeta}>{item.items} items • {item.orderedAt}</Text>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.cardValue}>₹{item.total.toLocaleString()}</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Update Status</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>View Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={styles.emptyText}>No orders yet.</Text>}
    />
  );

  const renderProducts = () => (
    <FlatList
      data={mockProducts}
      keyExtractor={item => item.id}
      style={{ marginTop: 12 }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: item.isActive ? 'rgba(22,163,74,0.12)' : 'rgba(148,163,184,0.16)' }]}>
              <Text style={[
                styles.statusBadgeText,
                { color: item.isActive ? '#15803D' : '#475569' },
              ]}>
                {item.isActive ? 'Active' : 'Draft'}
              </Text>
            </View>
          </View>
          <View style={styles.cardRow}>
            <MaterialIcons name="inventory-2" size={18} color="#6B7280" />
            <Text style={styles.cardMeta}>Stock: {item.stock}</Text>
          </View>
          <View style={styles.cardRow}>
            <Ionicons name="stats-chart" size={18} color="#6B7280" />
            <Text style={styles.cardMeta}>{item.views.toLocaleString()} views • Updated {item.updatedAt}</Text>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.cardValue}>₹{item.price.toLocaleString()}</Text>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Adjust Stock</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Edit Listing</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={styles.emptyText}>No products found.</Text>}
    />
  );

  const renderQuestions = () => (
    <FlatList
      data={mockQuestions}
      keyExtractor={item => item.id}
      style={{ marginTop: 12 }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.product}</Text>
            <View style={[styles.statusBadge, { backgroundColor: item.isAnswered ? 'rgba(59,130,246,0.12)' : 'rgba(249,115,22,0.12)' }]}>
              <Text style={[
                styles.statusBadgeText,
                { color: item.isAnswered ? '#2563EB' : '#F97316' },
              ]}>
                {item.isAnswered ? 'Responded' : 'Awaiting reply'}
              </Text>
            </View>
          </View>
          <Text style={styles.questionText}>"{item.question}"</Text>
          <View style={styles.cardRow}>
            <Ionicons name="person-circle-outline" size={18} color="#6B7280" />
            <Text style={styles.cardMeta}>Asked by {item.askedBy} • {item.askedAt}</Text>
          </View>
          <View style={styles.cardFooter}>
            <View />
            <TouchableOpacity style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{item.isAnswered ? 'Update Response' : 'Respond Now'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={styles.emptyText}>No customer questions yet.</Text>}
    />
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'orders':
        return renderOrders();
      case 'products':
        return renderProducts();
      case 'questions':
        return renderQuestions();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vendor Dashboard</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.metricsRow}>
          {metrics.map(metric => (
            <View key={metric.label} style={styles.metricCard}>
              <View style={[styles.metricIcon, { backgroundColor: `${metric.color}1A` }]}>
                <Ionicons name={metric.icon as any} size={20} color={metric.color} />
              </View>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={[styles.metricValue, { color: metric.color }]}>{metric.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'orders' && styles.tabPillActive]}
            onPress={() => setActiveTab('orders')}
          >
            <Ionicons name="cube-outline" size={16} color={activeTab === 'orders' ? '#F53F7A' : '#6B7280'} />
            <Text style={[styles.tabPillText, activeTab === 'orders' && styles.tabPillTextActive]}>Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'products' && styles.tabPillActive]}
            onPress={() => setActiveTab('products')}
          >
            <Ionicons name="pricetag-outline" size={16} color={activeTab === 'products' ? '#6366F1' : '#6B7280'} />
            <Text style={[styles.tabPillText, activeTab === 'products' && styles.tabPillTextActive]}>Products</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'questions' && styles.tabPillActive]}
            onPress={() => setActiveTab('questions')}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={activeTab === 'questions' ? '#F97316' : '#6B7280'} />
            <Text style={[styles.tabPillText, activeTab === 'questions' && styles.tabPillTextActive]}>Q&A</Text>
          </TouchableOpacity>
        </View>

        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '700',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 6,
    marginTop: 20,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabPillActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  tabPillTextActive: {
    color: '#111827',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 13,
    color: '#64748B',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  questionText: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    marginTop: 24,
  },
});

export default VendorDashboard;

