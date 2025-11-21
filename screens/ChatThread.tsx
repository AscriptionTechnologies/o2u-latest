import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { useChat } from '~/contexts/ChatContext';
import { useUser } from '~/contexts/UserContext';
import type { Message } from '~/services/chatService';
import type { RootStackParamList } from '~/types/navigation';

type ChatThreadRouteProp = RouteProp<RootStackParamList, 'ChatThread'>;

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn }) => {
  return (
    <View style={[styles.bubbleRow, isOwn ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
      <View
        style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubblePeer,
        ]}
      >
        <Text style={[styles.bubbleText, isOwn ? { color: '#fff' } : { color: '#1C1C1E' }]}>
          {message.text}
        </Text>
        <Text style={[styles.bubbleTimestamp, isOwn ? { color: '#FFE5EC' } : { color: '#8E8E93' }]}>
          {moment(message.createdAt).format('h:mm A')}
        </Text>
      </View>
    </View>
  );
};

const ChatThreadScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<ChatThreadRouteProp>();
  const { friendId, conversationId: initialConversationId } = route.params;
  const {
    conversations,
    friends,
    subscribeToMessages,
    sendMessage,
    markAsRead,
    getConversationId,
    ensureConversation,
  } = useChat();
  const { userData } = useUser();

  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId || getConversationId(friendId) || null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef<FlatList<Message>>(null);

  const friendProfile = useMemo(() => {
    const friendFromList = friends.find((friend) => friend.id === friendId);
    if (friendFromList) {
      return {
        displayName: friendFromList.displayName,
      };
    }
    const conversation = conversations.find((convo) =>
      convo.participants.includes(friendId)
    );
    const fromConversation = conversation?.participantProfiles?.[friendId];
    return {
      displayName: fromConversation?.displayName || 'Only2U User',
    };
  }, [friends, conversations, friendId]);

  useEffect(() => {
    if (conversationId) {
      return;
    }
    let isMounted = true;
    const ensure = async () => {
      try {
        const ensuredId = await ensureConversation(friendId);
        if (isMounted) {
          setConversationId(ensuredId);
        }
      } catch (error) {
        console.warn('[ChatThread] ensure conversation error', error);
      }
    };
    ensure();
    return () => {
      isMounted = false;
    };
  }, [conversationId, ensureConversation, friendId]);

  useEffect(() => {
    if (!conversationId) return;
    setIsLoading(true);
    const unsubscribe = subscribeToMessages(conversationId, (loadedMessages) => {
      setMessages(loadedMessages);
      setIsLoading(false);
    });

    return () => {
      unsubscribe?.();
    };
  }, [conversationId, subscribeToMessages]);

  useFocusEffect(
    useCallback(() => {
      if (conversationId) {
        markAsRead(conversationId);
      }
    }, [conversationId, markAsRead])
  );

  useEffect(() => {
    if (messages.length > 0) {
      markAsRead(conversationId || '');
    }
  }, [messages, conversationId, markAsRead]);

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }
    try {
      setIsSending(true);
      await sendMessage(friendId, trimmed);
      setInputValue('');
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    } catch (error) {
      console.warn('[ChatThread] send error', error);
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === userData?.id;
    return <MessageBubble message={item} isOwn={isOwn} />;
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{friendProfile.displayName}</Text>
          <Text style={styles.headerSubtitle}>Direct Message</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#F53F7A" />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={48} color="#F53F7A" />
          <Text style={styles.emptyTitle}>Say hi to {friendProfile.displayName}</Text>
          <Text style={styles.emptySubtitle}>
            Your messages will appear here. Start the conversation now!
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          value={inputValue}
          onChangeText={setInputValue}
          style={styles.textInput}
          placeholder="Message..."
          placeholderTextColor="#B4B4B6"
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, inputValue.trim() ? styles.sendButtonActive : null]}
          onPress={handleSend}
          disabled={!inputValue.trim() || isSending}
          activeOpacity={0.85}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFF0',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
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
    paddingHorizontal: 32,
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
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    backgroundColor: '#F53F7A',
    borderTopRightRadius: 4,
  },
  bubblePeer: {
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  bubbleTimestamp: {
    fontSize: 11,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFEFF0',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 130,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F7F7F8',
    fontSize: 15,
    color: '#1C1C1E',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFD4E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#F53F7A',
  },
});

export default ChatThreadScreen;

