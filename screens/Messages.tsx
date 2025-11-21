import React from 'react';
import {
  FlatList,
  Image,
  ImageBackground,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import Toast from 'react-native-toast-message';

interface MockConversation {
  id: string;
  friendId: string;
  displayName: string;
  avatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  streak: number;
  isTyping?: boolean;
  snapImage?: string;
}

const mockConversations: MockConversation[] = [
  {
    id: 'chat-1',
    friendId: 'friend-1',
    displayName: 'Alicia Blue',
    avatar:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=200&q=60',
    lastMessage: 'Sent a new face swap 🔥',
    lastMessageTime: moment().subtract(12, 'minutes').toISOString(),
    unreadCount: 2,
    streak: 36,
    isTyping: true,
    snapImage:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'chat-2',
    friendId: 'friend-2',
    displayName: 'Noah Park',
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=60',
    lastMessage: 'That pink dress looked so good on you! 💖',
    lastMessageTime: moment().subtract(1, 'hours').toISOString(),
    unreadCount: 0,
    streak: 24,
    snapImage:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'chat-3',
    friendId: 'friend-3',
    displayName: 'Sofia Chen',
    avatar:
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&q=60',
    lastMessage: 'Let’s try the new shimmer filter tonight ✨',
    lastMessageTime: moment().subtract(3, 'hours').toISOString(),
    unreadCount: 1,
    streak: 12,
    snapImage:
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'chat-4',
    friendId: 'friend-4',
    displayName: 'Jordan Miles',
    avatar:
      'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=200&q=60',
    lastMessage: 'Delivered a streak pic 🔥',
    lastMessageTime: moment().subtract(14, 'hours').toISOString(),
    unreadCount: 0,
    streak: 7,
    snapImage:
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'chat-5',
    friendId: 'friend-5',
    displayName: 'Priya Patel',
    avatar:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=60',
    lastMessage: 'Face swap ready – check it out! 😍',
    lastMessageTime: moment().subtract(1, 'days').toISOString(),
    unreadCount: 0,
    streak: 3,
    snapImage:
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
  },
];

const MessagesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [search, setSearch] = React.useState('');
  const [conversations, setConversations] = React.useState(mockConversations);
  const [activeSnap, setActiveSnap] = React.useState<MockConversation | null>(null);

  const handleOpenThread = (friendId: string) => {
    navigation.navigate('ChatThread', { friendId });
  };

  const filteredConversations = React.useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return conversations;
    return conversations.filter((conversation) => {
      const nameMatch = conversation.displayName.toLowerCase().includes(trimmed);
      const messageMatch = conversation.lastMessage.toLowerCase().includes(trimmed);
      return nameMatch || messageMatch;
    });
  }, [search, conversations]);

  const handleConversationPress = (conversation: MockConversation) => {
    if (conversation.unreadCount > 0 && conversation.snapImage) {
      setActiveSnap(conversation);
    } else {
      handleOpenThread(conversation.friendId);
    }
  };

  const markSnapViewed = (conversationId: string) => {
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0, isTyping: false }
          : conversation
      )
    );
  };

  const renderConversation = ({ item }: { item: MockConversation }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => handleConversationPress(item)}
      style={styles.conversationRow}
    >
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={styles.conversationAvatar} />
      ) : (
        <View style={styles.conversationAvatarFallback}>
          <Ionicons name="person" size={30} color="#F53F7A" />
        </View>
      )}

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text style={styles.conversationTime}>
            {moment(item.lastMessageTime).fromNow()}
          </Text>
        </View>
        <View style={styles.conversationPreviewRow}>
          {item.isTyping ? (
            <Text style={styles.typingText}>typing…</Text>
          ) : item.unreadCount > 0 ? (
            <View style={styles.previewUnreadRow}>
              <Ionicons name="square" size={18} color="#F53F7A" />
              <Text style={styles.conversationPreviewNew}>Tap to view</Text>
              <Text style={styles.previewUnreadHint}>• New</Text>
            </View>
          ) : (
            <Text style={styles.conversationPreviewOpened}>Opened • Tap to view</Text>
          )}
        </View>
      </View>

      <View style={styles.conversationMeta}>
        <View style={styles.streakChip}>
          <Ionicons name="flame" size={14} color="#F53F7A" />
          <Text style={styles.streakChipText}>{item.streak}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Chats</Text>
          <Text style={styles.headerSubtitle}>Stay in touch with your streaks</Text>
          </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('FriendSearch')}
          style={styles.addButton}
        >
          <Ionicons name="person-add" size={20} color="#F53F7A" />
          </TouchableOpacity>
        </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#8E8E93" style={{ marginRight: 8 }} />
          <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search chats"
          placeholderTextColor="#B4B4B6"
          autoCorrect={false}
          autoCapitalize="none"
          />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.conversationList}
        renderItem={renderConversation}
        ListEmptyComponent={
          search.trim() ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={44} color="#F53F7A" />
              <Text style={styles.emptyText}>No chats found</Text>
              <Text style={styles.emptySubtext}>
                Try searching by name or a message keyword.
              </Text>
        </View>
          ) : null
        }
      />

      <Modal visible={!!activeSnap} animationType="fade" transparent>
        <View style={styles.snapOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1 }}
            onPress={() => {
              if (activeSnap) {
                markSnapViewed(activeSnap.id);
              }
              setActiveSnap(null);
            }}
          >
            {activeSnap?.snapImage ? (
              <ImageBackground
                source={{ uri: activeSnap.snapImage }}
                style={styles.snapImage}
                resizeMode="cover"
              >
                <View style={styles.snapTopBar}>
                  <View style={styles.snapTimer}>
                    <Ionicons name="timer" size={14} color="#fff" />
                    <Text style={styles.snapTimerText}>3s</Text>
          </View>
                  <View style={styles.snapNameBubble}>
                    <Text style={styles.snapName}>{activeSnap.displayName}</Text>
                    <Text style={styles.snapSubtitle}>sent you a snap</Text>
                    </View>
                </View>
                <View style={styles.snapFooter}>
                  <View style={styles.reactionsRow}>
                    {['😍', '🔥', '😂', '👏', '🤯'].map((reaction) => (
                      <TouchableOpacity
                        key={reaction}
                        style={styles.reactionChip}
                        activeOpacity={0.85}
                        onPress={() => {
                          Toast.show({
                            type: 'success',
                            text1: 'Reaction sent',
                            text2: `${reaction} reaction shared with ${activeSnap.displayName}.`,
                          });
                          markSnapViewed(activeSnap.id);
                          setActiveSnap(null);
                        }}
                      >
                        <Text style={styles.reactionText}>{reaction}</Text>
              </TouchableOpacity>
            ))}
                  </View>
                  <Text style={styles.snapHint}>Tap to close</Text>
                </View>
              </ImageBackground>
            ) : (
              <View style={styles.snapFallback}>
                <Ionicons name="image" size={48} color="#fff" />
              </View>
            )}
            </TouchableOpacity>
    </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  addButton: {
    height: 40,
    width: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 63, 122, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF4F9',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F8',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
  },
  conversationList: {
    paddingBottom: 24,
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#F2F2F2',
  },
  conversationAvatar: {
    width: 60,
    height: 60,
    borderRadius: 24,
    marginRight: 14,
  },
  conversationAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 24,
    backgroundColor: '#FFE1EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    flex: 1,
    marginRight: 12,
  },
  conversationTime: {
    fontSize: 12,
    color: '#B0B3C0',
    fontWeight: '600',
  },
  conversationPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  conversationPreview: {
    fontSize: 14,
    color: '#666A7B',
  },
  conversationPreviewNew: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F53F7A',
  },
  conversationPreviewOpened: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  typingText: {
    fontSize: 14,
    color: '#F53F7A',
    fontWeight: '600',
  },
  conversationMeta: {
    alignItems: 'flex-end',
    marginLeft: 12,
    gap: 8,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFE8F1',
    borderWidth: 1,
    borderColor: 'rgba(245, 63, 122, 0.2)',
  },
  streakChipText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#F53F7A',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  emptySubtext: {
    marginTop: 6,
    fontSize: 14,
    color: '#6F6F70',
    textAlign: 'center',
  },
  previewUnreadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewUnreadHint: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
  },
  snapOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  snapImage: {
    flex: 1,
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  snapTopBar: {
    paddingHorizontal: 20,
    paddingTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  snapTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 14,
  },
  snapTimerText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  snapNameBubble: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  snapName: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  snapSubtitle: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
    opacity: 0.9,
  },
  snapFooter: {
    paddingBottom: 32,
    alignItems: 'center',
  },
  snapHint: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  snapFallback: {
    flex: 1,
    width: '100%',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  reactionChip: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionText: {
    fontSize: 22,
  },
});

export default MessagesScreen;
