import React from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';

const stories = [
  {
    id: 'you',
    name: 'You',
    avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    online: true,
    isYou: true,
  },
  {
    id: '1',
    name: 'Jhon Doe',
    avatar: 'https://randomuser.me/api/portraits/women/2.jpg',
    online: true,
  },
  {
    id: '2',
    name: 'Jhon Doe',
    avatar: 'https://randomuser.me/api/portraits/men/3.jpg',
    online: true,
  },
  {
    id: '3',
    name: 'Jhon Doe',
    avatar: 'https://randomuser.me/api/portraits/men/4.jpg',
    online: true,
  },
  {
    id: '4',
    name: 'Jhon Doe',
    avatar: 'https://randomuser.me/api/portraits/men/5.jpg',
    online: true,
  },
];

const chats = [
  {
    id: '1',
    name: 'John Doe',
    avatar: 'https://randomuser.me/api/portraits/men/6.jpg',
    lastMessage: 'Hi, How are you?',
    time: '06:41 PM',
    unread: 1,
    online: true,
  },
  {
    id: '2',
    name: 'Devon Lane',
    avatar: 'https://randomuser.me/api/portraits/men/7.jpg',
    lastMessage: "You: Okay, I'll sent the doc...",
    time: 'Yesterday',
    seen: true,
    online: true,
  },
  {
    id: '3',
    name: 'Bessie Cooper',
    avatar: 'https://randomuser.me/api/portraits/men/8.jpg',
    lastMessage: "You: I'm glad to hear that",
    time: '29 May 2025',
    seen: true,
    online: true,
  },
  {
    id: '4',
    name: 'Cody Fisher',
    avatar: 'https://randomuser.me/api/portraits/men/9.jpg',
    lastMessage: 'Why did the scarecrow wi...',
    time: '29 May 2025',
    unread: 2,
    online: true,
  },
  {
    id: '5',
    name: 'Kathryn Murphy',
    avatar: 'https://randomuser.me/api/portraits/men/10.jpg',
    lastMessage: "What's the weather like to...",
    time: '24 May 2025',
    seen: true,
    online: true,
  },
  {
    id: '6',
    name: 'Ronald Richards',
    avatar: 'https://randomuser.me/api/portraits/men/11.jpg',
    lastMessage: 'How does photosynthesis...',
    time: '21 May 2025',
    seen: true,
    online: true,
  },
];

const Messages = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#3DF45B" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>{t('messages')}</Text>
            <Text style={styles.headerSubtitle}>{t('stay_connected_with_team')}</Text>
          </View>
          <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications" size={24} color="#3DF45B" />
            <View style={styles.dot} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="add-circle" size={24} color="#3DF45B" />
          </TouchableOpacity>
        </View>
        <View style={styles.searchAndStoriesContainer}>
        {/* Search bar */}
        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={18} color="#B0B6BE" style={{ marginLeft: 16 }} />
          <TextInput
            style={styles.searchBar}
            placeholder="Search conversations..."
            placeholderTextColor="#B0B6BE"
          />
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="filter" size={18} color="#3DF45B" />
          </TouchableOpacity>
        </View>
        {/* Active Contacts */}
        <View style={styles.storiesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('active_now')}</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>{t('see_all')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 18 }}>
            {stories.map((story, idx) => (
              <TouchableOpacity key={story.id} style={styles.storyWrap}>
                <View
                  style={[
                    styles.storyAvatarWrap,
                    story.online && styles.storyOnlineWrap,
                    story.isYou && styles.storyYouWrap,
                  ]}>
                  <Image source={{ uri: story.avatar }} style={styles.storyAvatar} />
                  {story.isYou && (
                    <View style={styles.storyAddBtn}>
                      <Ionicons name="add" color="#000" size={16} />
                    </View>
                  )}
                  {story.online && !story.isYou && <View style={styles.storyOnlineDot} />}
                </View>
                <Text style={styles.storyName}>{story.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        </View>
        {/* Chat List */}
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.chatRow} onPress={() => navigation.navigate('MessageDetail', { user: item })}>
              <View style={styles.chatAvatarWrap}>
                <Image source={{ uri: item.avatar }} style={styles.chatAvatar} />
                {item.online && <View style={styles.chatOnlineDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatName}>{item.name}</Text>
                <Text style={styles.chatMsg} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>
              <View style={styles.chatMeta}>
                <Text style={styles.chatTime}>{item.time}</Text>
                {item.unread ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unread}</Text>
                  </View>
                ) : item.seen ? (
                  <Text style={styles.seenText}>{t('seen')}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181C20',
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101418',
    paddingTop: 70,
    paddingBottom: 18,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSubtitle: {
    color: '#B0B6BE',
    textAlign: 'center',
    marginTop: 2,
  },
  headerIcon: {
    marginLeft: 12,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3DF45B',
    borderWidth: 2,
    borderColor: '#101418',
  },
  backButton: {
    padding: 8,
  },
  searchAndStoriesContainer: {
    backgroundColor: 'rgba(24,28,32,0.95)',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: 8,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 22,
    margin: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    height: 48,
  },
  filterButton: {
    padding: 12,
    marginRight: 4,
  },
  storiesSection: {
    paddingHorizontal: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  seeAllText: {
    color: '#3DF45B',
    fontSize: 14,
    fontWeight: '600',
  },
  searchBar: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
  },
  storyWrap: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  storyAvatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#23272F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  storyOnlineWrap: {
    borderWidth: 3,
    borderColor: '#3DF45B',
  },
  storyYouWrap: {
    borderWidth: 0,
  },
  storyAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    resizeMode: 'cover',
  },
  storyAddBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#3DF45B',
    borderRadius: 12,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3DF45B',
  },
  storyName: {
    fontSize: 13,
    marginTop: 2,
    textAlign: 'center',
    width: 70,
    color: '#fff',
    fontWeight: '500',
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'transparent',
  },
  chatAvatarWrap: {
    marginRight: 14,
    position: 'relative',
  },
  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  chatOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3DF45B',
    borderWidth: 2,
    borderColor: '#181C20',
  },
  chatName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  chatMsg: {
    color: '#B0B6BE',
    fontSize: 15,
    marginBottom: 2,
  },
  chatMeta: {
    alignItems: 'flex-end',
    marginLeft: 10,
    minWidth: 60,
  },
  chatTime: {
    color: '#B0B6BE',
    fontSize: 13,
    marginBottom: 6,
  },
  unreadBadge: {
    backgroundColor: '#3DF45B',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  seenText: {
    color: '#B0B6BE',
    fontSize: 13,
    marginTop: 2,
  },
});

export default Messages;
