import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/useAuth';
import { useUser } from '../../contexts/UserContext';
import { supabase } from '../../utils/supabase';
import Toast from 'react-native-toast-message';
import { Header } from '../common';

const Account = () => {
  const navigation = useNavigation();
  const { user, setUser } = useAuth();
  const { deleteUserProfile } = useUser();
  const [settings, setSettings] = useState({
    notifications: true,
    locationTracking: true,
    dataSharing: false,
    autoBackup: true,
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUserProfile();
              setUser(null);
              
              Toast.show({
                type: 'success',
                text1: 'Account Deleted',
                text2: 'Your account has been permanently deleted',
              });
              
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to delete account. Please try again.',
              });
            }
          },
        },
      ]
    );
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'Password change functionality will be available soon.',
      [{ text: 'OK' }]
    );
  };

  const settingsOptions = [
    {
      key: 'notifications' as keyof typeof settings,
      title: 'Push Notifications',
      subtitle: 'Receive notifications about trips and updates',
      icon: 'notifications',
    },
    {
      key: 'locationTracking' as keyof typeof settings,
      title: 'Location Tracking',
      subtitle: 'Allow app to track your location for better service',
      icon: 'location',
    },
    {
      key: 'dataSharing' as keyof typeof settings,
      title: 'Data Sharing',
      subtitle: 'Share anonymous data to improve our services',
      icon: 'share',
    },
    {
      key: 'autoBackup' as keyof typeof settings,
      title: 'Auto Backup',
      subtitle: 'Automatically backup your data to cloud',
      icon: 'cloud-upload',
    },
  ];

  return (
    <LinearGradient colors={['#181C20', '#000']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Header
          title="Account Settings"
          subtitle="Manage your account preferences"
          showBackButton={true}
        />

        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {/* Account Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            <View style={styles.card}>
              <View style={styles.accountInfo}>
                <MaterialCommunityIcons name="account-circle" size={60} color="#3DF45B" />
                <View style={styles.accountDetails}>
                  <Text style={styles.accountName}>{user?.name || 'Driver Name'}</Text>
                  <Text style={styles.accountEmail}>{user?.email || 'driver@example.com'}</Text>
                  <Text style={styles.accountRole}>Role: {user?.role || 'Driver'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <View style={styles.card}>
              {settingsOptions.map((option, index) => (
                <View key={option.key}>
                  <View style={styles.settingItem}>
                    <View style={styles.settingIcon}>
                      <Ionicons name={option.icon as any} size={24} color="#3DF45B" />
                    </View>
                    <View style={styles.settingContent}>
                      <Text style={styles.settingTitle}>{option.title}</Text>
                      <Text style={styles.settingSubtitle}>{option.subtitle}</Text>
                    </View>
                    <Switch
                      value={settings[option.key]}
                      onValueChange={() => handleToggle(option.key)}
                      trackColor={{ false: '#767577', true: '#3DF45B' }}
                      thumbColor={settings[option.key] ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                  {index < settingsOptions.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>

          {/* Security */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security</Text>
            <View style={styles.card}>
              <TouchableOpacity style={styles.actionItem} onPress={handleChangePassword}>
                <View style={styles.settingIcon}>
                  <Ionicons name="key" size={24} color="#3DF45B" />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Change Password</Text>
                  <Text style={styles.settingSubtitle}>Update your account password</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#B0B6BE" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Danger Zone */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>
            <View style={styles.card}>
              <TouchableOpacity style={styles.actionItem} onPress={handleDeleteAccount}>
                <View style={[styles.settingIcon, { backgroundColor: 'rgba(255, 107, 107, 0.1)' }]}>
                  <Ionicons name="trash" size={24} color="#FF6B6B" />
                </View>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingTitle, { color: '#FF6B6B' }]}>Delete Account</Text>
                  <Text style={styles.settingSubtitle}>Permanently delete your account</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#B0B6BE" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(24,28,32,0.95)',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountDetails: {
    marginLeft: 16,
    flex: 1,
  },
  accountName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  accountEmail: {
    color: '#B0B6BE',
    fontSize: 14,
    marginBottom: 2,
  },
  accountRole: {
    color: '#3DF45B',
    fontSize: 14,
    fontWeight: '500',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(61, 244, 91, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingSubtitle: {
    color: '#B0B6BE',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 8,
  },
});

export default Account;
