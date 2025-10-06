import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '~/utils/supabase';
import { useTranslation } from 'react-i18next';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  location?: string;
  profilePhoto?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const UserManagement = () => {
  const navigation = useNavigation();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'user',
    location: '',
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, selectedRole]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        Alert.alert(t('error'), t('failed_to_fetch_users'));
        return;
      }

      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert(t('error'), t('failed_to_fetch_users'));
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    // Filter by search query
    if (searchQuery?.trim()) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.phone && user.phone.includes(searchQuery))
      );
    }

    // Filter by role
    if (selectedRole !== 'all') {
      filtered = filtered.filter(user => user.role === selectedRole);
    }

    setFilteredUsers(filtered);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      location: user.location || '',
      is_active: user.is_active,
    });
    setModalVisible(true);
  };

  const handleDeleteUser = (user: User) => {
    Alert.alert(
      t('delete_user'),
      t('delete_user_confirm', { name: user.name }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => deleteUser(user.id),
        },
      ]
    );
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Error deleting user:', error);
        Alert.alert(t('error'), t('failed_to_delete_user'));
        return;
      }

      Alert.alert(t('success'), t('user_deleted_successfully'));
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      Alert.alert(t('error'), t('failed_to_delete_user'));
    }
  };

  const handleSubmit = async () => {
    if (!formData.name?.trim() || !formData.email?.trim()) {
      Alert.alert(t('error'), t('name_and_email_required'));
      return;
    }

    try {
      setSubmitting(true);

      if (editingUser) {
        // Update existing user
        const { error } = await supabase
          .from('users')
          .update({
            name: formData.name.trim(),
            email: formData.email.trim(),
            phone: formData.phone?.trim() || '',
            role: formData.role,
            location: formData.location?.trim() || '',
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingUser.id);

        if (error) {
          console.error('Error updating user:', error);
          Alert.alert(t('error'), t('failed_to_update_user'));
          return;
        }

        Alert.alert(t('success'), t('user_updated_successfully'));
      }

      setModalVisible(false);
      fetchUsers();
    } catch (error) {
      console.error('Error submitting user:', error);
      Alert.alert(t('error'), t('failed_to_save_user'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserStatus = async (user: User) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_active: !user.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating user status:', error);
        Alert.alert(t('error'), t('failed_to_update_user_status'));
        return;
      }

      fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      Alert.alert(t('error'), t('failed_to_update_user_status'));
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return '#F53F7A';
      case 'moderator':
        return '#2196F3';
      default:
        return '#4CAF50';
    }
  };

  const renderUserItem = (user: User) => (
    <View key={user.id} style={styles.userItem}>
      <View style={styles.userInfo}>
        {user.profilePhoto ? (
          <Image source={{ uri: user.profilePhoto }} style={styles.userAvatar} />
        ) : (
          <View style={styles.placeholderAvatar}>
            <Ionicons name="person" size={24} color="#999" />
          </View>
        )}
        <View style={styles.userDetails}>
          <View style={styles.userHeader}>
            <Text style={styles.userName}>{user.name}</Text>
            <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) }]}>
              <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.userEmail}>{user.email}</Text>
          {user.phone && <Text style={styles.userPhone}>{user.phone}</Text>}
          {user.location && <Text style={styles.userLocation}>{user.location}</Text>}
          <View style={styles.userMeta}>
            <View style={styles.verificationBadges}>
              {user.emailVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="mail" size={12} color="#4CAF50" />
                </View>
              )}
              {user.phoneVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="call" size={12} color="#4CAF50" />
                </View>
              )}
            </View>
            <View style={[
              styles.statusBadge,
              { backgroundColor: user.is_active ? '#E8F5E8' : '#FFE8E8' }
            ]}>
              <Text style={[
                styles.statusText,
                { color: user.is_active ? '#4CAF50' : '#F44336' }
              ]}>
                {user.is_active ? t('active') : t('inactive')}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.userActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => toggleUserStatus(user)}
        >
          <Ionicons
            name={user.is_active ? "pause-circle-outline" : "play-circle-outline"}
            size={20}
            color={user.is_active ? "#FF9800" : "#4CAF50"}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditUser(user)}
        >
          <Ionicons name="pencil-outline" size={20} color="#2196F3" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteUser(user)}
        >
          <Ionicons name="trash-outline" size={20} color="#F44336" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('user_management')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('search_users')}
            placeholderTextColor="#999"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          {['all', 'admin', 'moderator', 'user'].map((role) => (
            <TouchableOpacity
              key={role}
              style={[
                styles.filterChip,
                selectedRole === role && styles.selectedFilterChip
              ]}
              onPress={() => setSelectedRole(role)}
            >
              <Text style={[
                styles.filterChipText,
                selectedRole === role && styles.selectedFilterChipText
              ]}>
                {role === 'all' ? t('all_users') : t(role)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* User Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{users.length}</Text>
          <Text style={styles.statLabel}>{t('total_users')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{users.filter(u => u.is_active).length}</Text>
          <Text style={styles.statLabel}>{t('active')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{users.filter(u => u.role === 'admin').length}</Text>
          <Text style={styles.statLabel}>{t('admins')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{users.filter(u => u.emailVerified).length}</Text>
          <Text style={styles.statLabel}>{t('verified')}</Text>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F53F7A" />
          <Text style={styles.loadingText}>{t('loading_users')}</Text>
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
          {filteredUsers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#999" />
              <Text style={styles.emptyTitle}>{t('no_users_found')}</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || selectedRole !== 'all' 
                  ? t('try_adjusting_search_or_filter')
                  : t('no_users_available')
                }
              </Text>
            </View>
          ) : (
            <View style={styles.usersContainer}>
              {filteredUsers.map(renderUserItem)}
            </View>
          )}
        </ScrollView>
      )}

      {/* Edit User Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('edit_user')}</Text>
            <TouchableOpacity onPress={handleSubmit} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator size="small" color="#F53F7A" />
              ) : (
                <Text style={styles.saveButton}>{t('save')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* User Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('full_name')} *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder={t('enter_full_name')}
                placeholderTextColor="#999"
              />
            </View>

            {/* Email */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('email_address')} *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                placeholder={t('enter_email_address')}
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Phone */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('phone_number')}</Text>
              <TextInput
                style={styles.textInput}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                placeholder={t('enter_phone_number')}
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>

            {/* Location */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('location')}</Text>
              <TextInput
                style={styles.textInput}
                value={formData.location}
                onChangeText={(text) => setFormData({ ...formData, location: text })}
                placeholder={t('enter_location')}
                placeholderTextColor="#999"
              />
            </View>

            {/* Role Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('user_role')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleSelector}>
                {['user', 'moderator', 'admin'].map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleChip,
                      formData.role === role && styles.selectedRoleChip
                    ]}
                    onPress={() => setFormData({ ...formData, role })}
                  >
                    <Text style={[
                      styles.roleChipText,
                      formData.role === role && styles.selectedRoleChipText
                    ]}>
                      {t(role)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Active Status */}
            <View style={styles.formGroup}>
              <View style={styles.switchContainer}>
                <Text style={styles.label}>{t('account_status')}</Text>
                <TouchableOpacity
                  style={[
                    styles.switch,
                    { backgroundColor: formData.is_active ? '#F53F7A' : '#E0E0E0' }
                  ]}
                  onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}
                >
                  <View style={[
                    styles.switchThumb,
                    { transform: [{ translateX: formData.is_active ? 20 : 0 }] }
                  ]} />
                </TouchableOpacity>
              </View>
              <Text style={styles.switchDescription}>
                {formData.is_active ? t('account_is_active') : t('account_is_suspended')}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedFilterChip: {
    backgroundColor: '#F53F7A',
    borderColor: '#F53F7A',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedFilterChipText: {
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
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
  },
  usersContainer: {
    padding: 16,
  },
  userItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  placeholderAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  userLocation: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verificationBadges: {
    flexDirection: 'row',
  },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F53F7A',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f8f9fa',
  },
  roleSelector: {
    flexDirection: 'row',
  },
  roleChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedRoleChip: {
    backgroundColor: '#F53F7A',
    borderColor: '#F53F7A',
  },
  roleChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedRoleChipText: {
    color: '#fff',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
  },
  switchDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});

export default UserManagement;
