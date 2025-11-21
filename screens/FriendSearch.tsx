import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { useChat } from '~/contexts/ChatContext';
import type { ChatUserProfile } from '~/services/chatService';
import * as Contacts from 'expo-contacts';

type FriendCandidate = ChatUserProfile & {
  contactName?: string;
  phone?: string | null;
};

const normalizePhone = (input?: string | null): string => {
  if (!input) return '';
  const digits = input.replace(/\D+/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  return digits;
};

const FriendSearchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { friends, searchUsers, addFriend, findContacts } = useChat();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'contacts'>('search');
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsPermission, setContactsPermission] = useState<'unknown' | 'granted' | 'denied'>(
    'unknown'
  );
  const [contactMatches, setContactMatches] = useState<FriendCandidate[]>([]);
  const [contactError, setContactError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState<string | null>(null);

  const friendIds = useMemo(() => friends.map((friend) => friend.id), [friends]);

  useEffect(() => {
    if (activeTab !== 'search') {
      setIsSearching(false);
      return;
    }
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const data = await searchUsers(query, friendIds);
        setResults(data);
      } catch (error) {
        console.warn('[FriendSearch] search error', error);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [query, searchUsers, friendIds, activeTab]);

  const handleAddFriend = async (user: ChatUserProfile) => {
    try {
      setIsAdding(user.id);
      await addFriend(user.id);
      Toast.show({
        type: 'success',
        text1: 'Friend Added',
        text2: `You can now message ${user.displayName}.`,
      });
      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Unable to add friend',
        text2: error?.message || 'Please try again later.',
      });
    } finally {
      setIsAdding(null);
    }
  };

  const renderResult = ({ item }: { item: FriendCandidate }) => {
    const alreadyFriend = friendIds.includes(item.id);
    return (
      <View style={styles.resultCard}>
        <View style={styles.resultInfo}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color="#F53F7A" />
            </View>
          )}
          <View style={styles.resultTextContainer}>
            <Text style={styles.resultName}>{item.contactName ?? item.displayName}</Text>
            <Text style={styles.resultSubtitle}>
              {item.contactName ? item.displayName : item.id}
            </Text>
          </View>
        </View>
        {alreadyFriend ? (
          <View style={styles.addedPill}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.addedPillText}>Added</Text>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.addButton}
            onPress={() => handleAddFriend(item)}
            disabled={isAdding === item.id}
          >
            {isAdding === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="person-add" size={16} color="#fff" />
                <Text style={styles.addButtonText}>Add</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const handleSyncContacts = async () => {
    try {
      setContactError(null);
      setContactsLoading(true);
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setContactsPermission('denied');
        setContactsLoading(false);
        Toast.show({
          type: 'info',
          text1: 'Permission Needed',
          text2: 'Enable contacts access to find friends from your address book.',
        });
        return;
      }
      setContactsPermission('granted');

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
        pageSize: 2000,
        pageOffset: 0,
      });

      const phoneToName = new Map<string, string>();
      const numbers: string[] = [];

      data.forEach((contact) => {
        contact.phoneNumbers?.forEach((phoneEntry) => {
          const normalized = normalizePhone(phoneEntry.number);
          if (!normalized || normalized.length < 6) return;
          numbers.push(normalized);
          phoneToName.set(normalized, contact.name || phoneEntry.number || 'Friend');
          if (normalized.length > 10) {
            const last10 = normalized.slice(-10);
            phoneToName.set(last10, contact.name || phoneEntry.number || 'Friend');
          }
        });
      });

      if (numbers.length === 0) {
        setContactMatches([]);
        setContactsLoading(false);
        setContactError('No contacts with phone numbers were found.');
        return;
      }

      const matches = await findContacts(numbers, friendIds);
      const decorated = matches.map((match) => {
        const normalized = normalizePhone(match.phone);
        const contactName =
          phoneToName.get(normalized) ||
          (normalized.length > 10 ? phoneToName.get(normalized.slice(-10)) : undefined);
        return { ...match, contactName };
      });

      setContactMatches(decorated);
    } catch (error: any) {
      console.warn('[FriendSearch] contacts sync error', error);
      setContactError(error?.message || 'Unable to load contacts.');
    } finally {
      setContactsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.searchHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.searchTitle}>Find Friends</Text>
      </View>
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segmentButton, activeTab === 'search' && styles.segmentButtonActive]}
          onPress={() => setActiveTab('search')}
        >
          <Text style={[styles.segmentLabel, activeTab === 'search' && styles.segmentLabelActive]}>
            Search
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, activeTab === 'contacts' && styles.segmentButtonActive]}
          onPress={() => setActiveTab('contacts')}
        >
          <Text
            style={[styles.segmentLabel, activeTab === 'contacts' && styles.segmentLabelActive]}
          >
            Contacts
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'search' ? (
        <>
          <View style={styles.inputWrapper}>
            <Ionicons name="search" size={18} color="#8E8E93" style={{ marginRight: 8 }} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              style={styles.input}
              placeholder="Search by name"
              placeholderTextColor="#B4B4B6"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={20} color="#C7C7CC" />
              </TouchableOpacity>
            )}
          </View>

          {isSearching ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#F53F7A" />
            </View>
          ) : results.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color="#F53F7A" />
              <Text style={styles.emptyTitle}>Search friends on Only2U</Text>
              <Text style={styles.emptySubtitle}>
                Type a name to see matching profiles you can add and start chatting with.
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={renderResult}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              contentContainerStyle={styles.resultsList}
            />
          )}
        </>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.contactInfoCard}>
            <View style={styles.contactIconCircle}>
              <Ionicons name="people-outline" size={20} color="#F53F7A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactTitle}>Add friends from contacts</Text>
              <Text style={styles.contactSubtitle}>
                We’ll show you who already uses Only2U so you can start a streak together.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.syncButton}
              activeOpacity={0.85}
              onPress={handleSyncContacts}
              disabled={contactsLoading}
            >
              {contactsLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.syncButtonText}>
                  {contactsPermission === 'granted' ? 'Refresh' : 'Sync'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {contactsPermission === 'denied' && (
            <View style={styles.permissionNotice}>
              <Text style={styles.permissionTitle}>Contacts access is off</Text>
              <Text style={styles.permissionSubtitle}>
                Enable contacts permission in settings to see friends already on Only2U.
              </Text>
              <TouchableOpacity
                style={styles.openSettingsButton}
                onPress={() => Linking.openSettings?.()}
              >
                <Text style={styles.openSettingsText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          )}

          {contactError && contactsPermission !== 'denied' && (
            <View style={styles.permissionNotice}>
              <Text style={styles.permissionTitle}>{contactError}</Text>
              <Text style={styles.permissionSubtitle}>
                Tap sync to try again after updating your contacts.
              </Text>
            </View>
          )}

          {contactsLoading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#F53F7A" />
            </View>
          ) : contactMatches.length === 0 && contactsPermission === 'granted' && !contactError ? (
            <View style={styles.emptyState}>
              <Ionicons name="sparkles-outline" size={44} color="#F53F7A" />
              <Text style={styles.emptyTitle}>No friends found yet</Text>
              <Text style={styles.emptySubtitle}>
                Invite your friends to Only2U and build your first streaks together.
              </Text>
            </View>
          ) : (
            <FlatList
              data={contactMatches}
              keyExtractor={(item) => item.id}
              renderItem={renderResult}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              contentContainerStyle={styles.resultsList}
            />
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F6',
    borderRadius: 22,
    marginBottom: 18,
    padding: 4,
    gap: 6,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 8,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  segmentLabelActive: {
    color: '#F53F7A',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  searchTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#F7F7F8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#6F6F70',
    textAlign: 'center',
  },
  resultsList: {
    paddingBottom: 24,
  },
  contactInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF6FA',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    marginBottom: 18,
    gap: 12,
  },
  contactIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE3EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  contactSubtitle: {
    fontSize: 13,
    color: '#6F6F70',
    marginTop: 2,
  },
  syncButton: {
    backgroundColor: '#F53F7A',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  permissionNotice: {
    backgroundColor: '#FFF0F4',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F53F7A',
  },
  permissionSubtitle: {
    fontSize: 13,
    color: '#6F6F70',
    marginTop: 4,
  },
  openSettingsButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  openSettingsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F53F7A',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#EFEFF0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  resultInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE5EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  resultSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  addedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9DD082',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  addedPillText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default FriendSearchScreen;

