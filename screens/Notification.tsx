import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';


const notifications = [
  {
    id: '1',
    icon: 'truck-check',
    iconType: 'MaterialCommunityIcons',
    title: 'Driver James Sullivan has arrived at pickup location',
    subtitle: 'Load #TRK-2024-001 • Chicago, IL',
    time: '2 min ago',
    group: 'New',
    unread: true,
    type: 'success',
  },
  {
    id: '2',
    icon: 'check-circle',
    iconType: 'MaterialCommunityIcons',
    title: 'Delivery completed successfully',
    subtitle: 'Driver John Doe • Load #TRK-2024-002',
    time: '5 min ago',
    group: 'New',
    unread: true,
    type: 'success',
  },
  {
    id: '3',
    icon: 'map-marker',
    iconType: 'MaterialCommunityIcons',
    title: 'Driver Marshall Leveton has arrived at shipper',
    subtitle: 'Load #TRK-2024-003 • Detroit, MI',
    time: '2 hr ago',
    group: 'Today',
    unread: false,
    type: 'info',
  },
  {
    id: '4',
    icon: 'gas-station',
    iconType: 'MaterialCommunityIcons',
    title: 'Fuel stop in progress',
    subtitle: 'Driver Marshall Leveton • I-75 Rest Area',
    time: '4 hr ago',
    group: 'Today',
    unread: false,
    type: 'info',
  },
  {
    id: '5',
    icon: 'clock-alert',
    iconType: 'MaterialCommunityIcons',
    title: 'Delivery delay notification',
    subtitle: 'Driver Jeffery Laneson • Traffic congestion',
    time: 'Yesterday',
    group: 'Yesterday',
    unread: false,
    type: 'warning',
  },
  {
    id: '6',
    icon: 'cash',
    iconType: 'MaterialCommunityIcons',
    title: 'Payment processed',
    subtitle: 'Load #TRK-2024-004 • $2,450.00',
    time: 'Yesterday',
    group: 'Yesterday',
    unread: false,
    type: 'success',
  },
];

const grouped = [
  { label: 'New', data: notifications.filter((n) => n.group === 'New') },
  { label: 'Today', data: notifications.filter((n) => n.group === 'Today') },
  { label: 'Yesterday', data: notifications.filter((n) => n.group === 'Yesterday') },
];

const Notification = () => {
  const navigation = useNavigation();
  const [filter, setFilter] = useState('All');

  const getIconColor = (type: string) => {
    switch (type) {
      case 'success': return '#3DF45B';
      case 'warning': return '#FFD600';
      case 'error': return '#FF6B6B';
      default: return '#2196F3';
    }
  };

  return (
    <LinearGradient colors={['#181C20', '#000']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#3DF45B" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>Stay updated with your fleet</Text>
          </View>
          <TouchableOpacity style={styles.headerRightIconWrap}>
            <MaterialCommunityIcons name="bell-check" size={24} color="#3DF45B" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerRightIconWrap}>
            <MaterialCommunityIcons name="filter-variant" size={24} color="#3DF45B" />
          </TouchableOpacity>
        </View>
        {/* Promo Card */}
        <View style={styles.promoCard}>
          <Image
            source={require('../assets/banner.png')}
            style={styles.promoBg}
            resizeMode="contain"
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity style={styles.quickActionBtn}>
            <MaterialCommunityIcons name="check-all" size={20} color="#3DF45B" />
            <Text style={styles.quickActionText}>Mark All Read</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn}>
            <MaterialCommunityIcons name="filter" size={20} color="#3DF45B" />
            <Text style={styles.quickActionText}>Filter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn}>
            <MaterialCommunityIcons name="cog" size={20} color="#3DF45B" />
            <Text style={styles.quickActionText}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Notification Groups */}
        <FlatList
          data={grouped}
          keyExtractor={(item) => item.label}
          renderItem={({ item }) => (
            <View>
              <View style={styles.groupHeader}>
                <Text style={styles.groupLabel}>{item.label}</Text>
                <Text style={styles.groupCount}>{item.data.length} notifications</Text>
              </View>
              {item.data.map((notif, idx) => (
                <TouchableOpacity key={notif.id} style={[
                  styles.notifRow,
                  notif.unread && styles.notifRowUnread
                ]}>
                  <View style={[styles.notifIconWrap, { backgroundColor: `${getIconColor(notif.type)}15` }]}>
                    <MaterialCommunityIcons
                      name={notif.icon as any}
                      size={24}
                      color={getIconColor(notif.type)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifTitle}>{notif.title}</Text>
                    <Text style={styles.notifSubtitle}>{notif.subtitle}</Text>
                    <Text style={styles.notifTime}>{notif.time}</Text>
                  </View>
                  {notif.unread && <View style={styles.notifDot} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101418',
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#B0B6BE',
    fontSize: 14,
    marginTop: 2,
  },
  headerRightIconWrap: {
    marginLeft: 12,
    padding: 8,
  },
  headerDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF385C',
    borderWidth: 2,
    borderColor: '#181C20',
  },
  promoCard: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  promoBg: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(24,28,32,0.95)',
    borderRadius: 16,
    paddingVertical: 16,
  },
  quickActionBtn: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 8,
  },
  groupCount: {
    color: '#B0B6BE',
    fontSize: 14,
    fontWeight: '500',
  },
  groupLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    marginLeft: 18,
    marginTop: 18,
    marginBottom: 8,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(24,28,32,0.95)',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  notifRowUnread: {
    borderLeftWidth: 4,
    borderLeftColor: '#3DF45B',
    backgroundColor: 'rgba(61, 244, 91, 0.05)',
  },
  notifIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  notifTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 22,
  },
  notifSubtitle: {
    color: '#B0B6BE',
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
  },
  notifTime: {
    color: '#B0B6BE',
    fontSize: 12,
    fontWeight: '500',
  },
  notifDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3DF45B',
    marginLeft: 12,
    marginTop: 4,
  },
});

export default Notification;
