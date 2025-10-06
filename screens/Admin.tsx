import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '~/contexts/useAuth';
import { supabase } from '~/utils/supabase';
import { useTranslation } from 'react-i18next';

interface AdminStats {
  totalUsers: number;
  totalProducts: number;
  ordersToday: number;
  totalRevenue: number;
}

const Admin = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalProducts: 0,
    ordersToday: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    fetchAdminStats();
  }, []);

  const fetchAdminStats = async () => {
    try {
      setLoading(true);

      // Fetch total users
      const { count: usersCount, error: usersError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (usersError) {
        console.error('Error fetching users count:', usersError);
      }

      // Fetch total products
      const { count: productsCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      if (productsError) {
        console.error('Error fetching products count:', productsError);
      }

      // Fetch orders for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: ordersCount, error: ordersError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      if (ordersError) {
        console.error('Error fetching orders count:', ordersError);
      }

      // Fetch total revenue (sum of all order amounts)
      const { data: ordersData, error: revenueError } = await supabase
        .from('orders')
        .select('total_amount');

      let totalRevenue = 0;
      if (!revenueError && ordersData) {
        totalRevenue = ordersData.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      }

      setStats({
        totalUsers: usersCount || 0,
        totalProducts: productsCount || 0,
        ordersToday: ordersCount || 0,
        totalRevenue: totalRevenue,
      });

    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const adminMenuItems = [
    {
      id: 1,
      title: t('user_management'),
      subtitle: t('manage_users_and_permissions'),
      icon: 'people-outline',
      onPress: () => navigation.navigate('UserManagement' as never),
    },
    {
      id: 2,
      title: t('category_management'),
      subtitle: t('add_edit_and_manage_categories'),
      icon: 'folder-outline',
      onPress: () => navigation.navigate('CategoryManagement' as never),
    },
    {
      id: 3,
      title: t('product_management'),
      subtitle: t('add_edit_and_manage_products'),
      icon: 'cube-outline',
      onPress: () => navigation.navigate('ProductManagement' as never),
    },
    {
      id: 4,
      title: t('color_management'),
      subtitle: t('add_edit_and_manage_colors'),
      icon: 'color-palette-outline',
      onPress: () => navigation.navigate('ColorManagement' as never),
    },
    {
      id: 5,
      title: t('order_management'),
      subtitle: t('view_and_manage_all_orders'),
      icon: 'receipt-outline',
      onPress: () => console.log('Order Management'),
    },
    {
      id: 6,
      title: t('analytics'),
      subtitle: t('view_sales_and_user_analytics'),
      icon: 'analytics-outline',
      onPress: () => console.log('Analytics'),
    },
    {
      id: 7,
      title: t('settings'),
      subtitle: t('app_configuration_and_settings'),
      icon: 'settings-outline',
      onPress: () => console.log('Settings'),
    },
  ];

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_panel')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={32} color="#F53F7A" />
          </View>
          <Text style={styles.welcomeTitle}>{t('welcome_admin')}</Text>
          <Text style={styles.welcomeSubtitle}>
            {user?.name || user?.email || t('administrator')}
          </Text>
          <Text style={styles.welcomeDescription}>
            {t('manage_platform_from_admin_panel')}
          </Text>
        </View>

        {/* Admin Menu */}
        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>{t('admin_functions')}</Text>
          
          {adminMenuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name={item.icon as any} size={24} color="#F53F7A" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>{t('quick_stats')}</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#F53F7A" />
              <Text style={styles.loadingText}>{t('loading_statistics')}</Text>
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="people" size={24} color="#4CAF50" />
                <Text style={styles.statNumber}>{stats.totalUsers.toLocaleString()}</Text>
                <Text style={styles.statLabel}>{t('total_users')}</Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="cube" size={24} color="#2196F3" />
                <Text style={styles.statNumber}>{stats.totalProducts.toLocaleString()}</Text>
                <Text style={styles.statLabel}>{t('products')}</Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="receipt" size={24} color="#FF9800" />
                <Text style={styles.statNumber}>{stats.ordersToday.toLocaleString()}</Text>
                <Text style={styles.statLabel}>{t('orders_today')}</Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="trending-up" size={24} color="#9C27B0" />
                <Text style={styles.statNumber}>{formatCurrency(stats.totalRevenue)}</Text>
                <Text style={styles.statLabel}>{t('total_revenue')}</Text>
              </View>
            </View>
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  welcomeSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 1,
  },
  adminBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFE8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#F53F7A',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  welcomeDescription: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  menuContainer: {
    backgroundColor: '#fff',
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  statsContainer: {
    backgroundColor: '#fff',
    marginTop: 1,
    paddingBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    marginHorizontal: '1%',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginLeft: 8,
  },
});

export default Admin;
