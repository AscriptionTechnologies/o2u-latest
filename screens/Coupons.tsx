import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '~/contexts/UserContext';
import { supabase } from '~/utils/supabase';
import Toast from 'react-native-toast-message';

const Coupons = () => {
  const navigation = useNavigation();
  const { userData } = useUser();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCoupons = useCallback(async () => {
    if (!userData?.id) {
      setLoading(false);
      return;
    }

    try {
      const now = new Date().toISOString();
      
      // Fetch all active coupons
      const { data: allCoupons, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching coupons:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load coupons',
        });
        return;
      }

      if (allCoupons && allCoupons.length > 0) {
        // Filter coupons that the user can use
        const usableCoupons = [];
        const usedCoupons = [];
        const expiredCoupons = [];

        for (const coupon of allCoupons) {
          const nowDate = new Date();
          
          // Check date validity
          const startDate = coupon.start_date ? new Date(coupon.start_date) : null;
          const endDate = coupon.end_date ? new Date(coupon.end_date) : null;
          
          if (startDate && startDate > nowDate) {
            continue; // Not yet active
          }
          
          if (endDate && endDate < nowDate) {
            expiredCoupons.push({ ...coupon, status: 'expired' });
            continue;
          }

          // Check usage limits
          if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
            continue;
          }

          // Check per-user limit
          let userUsageCount = 0;
          if (coupon.per_user_limit && userData.id) {
            const { data: userUsage } = await supabase
              .from('coupon_usage')
              .select('id')
              .eq('coupon_id', coupon.id)
              .eq('user_id', userData.id);

            userUsageCount = userUsage?.length || 0;
            if (userUsageCount >= coupon.per_user_limit) {
              usedCoupons.push({ ...coupon, status: 'used', userUsageCount });
              continue;
            }
          }

          usableCoupons.push({ ...coupon, status: 'available', userUsageCount });
        }

        // Combine: available first, then used, then expired
        setCoupons([...usableCoupons, ...usedCoupons, ...expiredCoupons]);
      } else {
        setCoupons([]);
      }
    } catch (error) {
      console.error('Error in fetchCoupons:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load coupons',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userData?.id]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCoupons();
  }, [fetchCoupons]);

  const handleApplyCoupon = (coupon: any) => {
    if (coupon.status !== 'available') {
      if (coupon.status === 'used') {
        Toast.show({
          type: 'info',
          text1: 'Already Used',
          text2: 'You have already used this coupon',
        });
      } else if (coupon.status === 'expired') {
        Toast.show({
          type: 'info',
          text1: 'Expired',
          text2: 'This coupon has expired',
        });
      }
      return;
    }

    // Navigate back to Cart with coupon code
    navigation.goBack();
    // Use a callback or event to apply the coupon in Cart screen
    setTimeout(() => {
      Toast.show({
        type: 'success',
        text1: 'Coupon Selected',
        text2: `Use code: ${coupon.code} in cart`,
      });
    }, 500);
  };

  const formatDiscount = (coupon: any) => {
    if (coupon.discount_type === 'fixed') {
      return `₹${coupon.discount_value} OFF`;
    } else if (coupon.discount_type === 'percentage') {
      return `${coupon.discount_value}% OFF`;
    }
    return 'Discount';
  };

  const getCouponDescription = (coupon: any) => {
    if (coupon.description) {
      return coupon.description;
    }
    if (coupon.min_order_value) {
      return `Min. order: ₹${coupon.min_order_value}`;
    }
    return 'Valid on all orders';
  };

  const renderCouponCard = (coupon: any, index: number) => {
    const isAvailable = coupon.status === 'available';
    const isUsed = coupon.status === 'used';
    const isExpired = coupon.status === 'expired';

    return (
      <TouchableOpacity
        key={coupon.id || index}
        style={[
          styles.couponCard,
          !isAvailable && styles.couponCardDisabled,
        ]}
        onPress={() => handleApplyCoupon(coupon)}
        disabled={!isAvailable}
        activeOpacity={0.7}
      >
        <View style={styles.couponCardLeft}>
          <View
            style={[
              styles.couponIconContainer,
              isUsed && styles.couponIconUsed,
              isExpired && styles.couponIconExpired,
            ]}
          >
            <Ionicons
              name={isUsed ? 'checkmark-circle' : isExpired ? 'close-circle' : 'ticket'}
              size={24}
              color={isUsed ? '#047857' : isExpired ? '#DC2626' : '#F53F7A'}
            />
          </View>
          <View style={styles.couponCardContent}>
            <View style={styles.couponHeader}>
              <Text style={[styles.couponCode, !isAvailable && styles.couponCodeDisabled]}>
                {coupon.code}
              </Text>
              <Text style={[styles.couponDiscount, !isAvailable && styles.couponDiscountDisabled]}>
                {formatDiscount(coupon)}
              </Text>
            </View>
            <Text style={[styles.couponDescription, !isAvailable && styles.couponDescriptionDisabled]} numberOfLines={2}>
              {getCouponDescription(coupon)}
            </Text>
            {coupon.per_user_limit && (
              <Text style={styles.couponUsage}>
                {coupon.userUsageCount || 0} / {coupon.per_user_limit} uses
              </Text>
            )}
          </View>
        </View>
        {isAvailable ? (
          <Ionicons name="chevron-forward" size={20} color="#F53F7A" />
        ) : (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {isUsed ? 'Used' : 'Expired'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Coupons</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F53F7A" />
          <Text style={styles.loadingText}>Loading coupons...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Coupons</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F53F7A" />
        }
      >
        {coupons.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="ticket-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Coupons Available</Text>
            <Text style={styles.emptyText}>
              You don't have any coupons yet. Check back later for exciting offers!
            </Text>
          </View>
        ) : (
          <>
            {coupons.filter(c => c.status === 'available').length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Available Coupons</Text>
                {coupons
                  .filter(c => c.status === 'available')
                  .map((coupon, index) => renderCouponCard(coupon, index))}
              </View>
            )}

            {coupons.filter(c => c.status === 'used').length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Used Coupons</Text>
                {coupons
                  .filter(c => c.status === 'used')
                  .map((coupon, index) => renderCouponCard(coupon, index + 1000))}
              </View>
            )}

            {coupons.filter(c => c.status === 'expired').length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Expired Coupons</Text>
                {coupons
                  .filter(c => c.status === 'expired')
                  .map((coupon, index) => renderCouponCard(coupon, index + 2000))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#F53F7A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  couponCardDisabled: {
    borderColor: '#E5E7EB',
    opacity: 0.6,
  },
  couponCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  couponIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponIconUsed: {
    backgroundColor: '#ECFDF5',
  },
  couponIconExpired: {
    backgroundColor: '#FEF2F2',
  },
  couponCardContent: {
    flex: 1,
    minWidth: 0,
  },
  couponHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  couponCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.5,
  },
  couponCodeDisabled: {
    color: '#9CA3AF',
  },
  couponDiscount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F53F7A',
  },
  couponDiscountDisabled: {
    color: '#9CA3AF',
  },
  couponDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  couponDescriptionDisabled: {
    color: '#D1D5DB',
  },
  couponUsage: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
});

export default Coupons;

