import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useUser } from './UserContext';
import type { Unsubscribe } from 'firebase/firestore';
import {
  addFriend as addFriendService,
  removeFriend as removeFriendService,
  listenToFriends,
  listenToConversations,
  listenToMessages,
  markConversationAsRead,
  sendMessage as sendMessageService,
  searchUsersForChat,
  findUsersByPhoneNumbers,
  syncUserProfileToFirebase,
  getConversationIdForFriend,
  ensureConversationExists,
  type FriendRecord,
  type ConversationSummary,
  type Message,
  type ChatUserProfile,
} from '~/services/chatService';

interface ChatContextValue {
  friends: FriendRecord[];
  conversations: ConversationSummary[];
  unreadTotal: number;
  isLoading: boolean;
  addFriend: (friendId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  sendMessage: (friendId: string, text: string) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  subscribeToMessages: (
    conversationId: string,
    callback: (messages: Message[]) => void
  ) => Unsubscribe | undefined;
  searchUsers: (text: string, excludeIds?: string[]) => Promise<ChatUserProfile[]>;
  findContacts: (
    phoneNumbers: string[],
    excludeIds?: string[]
  ) => Promise<Array<ChatUserProfile & { phone?: string | null }>>;
  getConversationId: (friendId: string) => string;
  ensureConversation: (friendId: string) => Promise<string>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userData } = useUser();
  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentUserId = userData?.id || null;

  useEffect(() => {
    if (!userData) {
      setFriends([]);
      setConversations([]);
      setIsLoading(false);
      return;
    }
    syncUserProfileToFirebase(userData);
  }, [userData]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    setIsLoading(true);
    let friendsUnsub: Unsubscribe | undefined;
    let conversationsUnsub: Unsubscribe | undefined;

    friendsUnsub = listenToFriends(currentUserId, (records) => {
      setFriends(records);
    });

    conversationsUnsub = listenToConversations(currentUserId, (items) => {
      setConversations(items);
      setIsLoading(false);
    });

    return () => {
      friendsUnsub?.();
      conversationsUnsub?.();
    };
  }, [currentUserId]);

  const unreadTotal = useMemo(() => {
    if (!currentUserId) return 0;
    return conversations.reduce((total, convo) => {
      const count = convo.unreadCounts?.[currentUserId] ?? 0;
      return total + count;
    }, 0);
  }, [conversations, currentUserId]);

  const addFriend = useCallback(
    async (friendId: string) => {
      if (!currentUserId) throw new Error('Login required');
      await addFriendService(currentUserId, friendId);
    },
    [currentUserId]
  );

  const removeFriend = useCallback(
    async (friendId: string) => {
      if (!currentUserId) throw new Error('Login required');
      await removeFriendService(currentUserId, friendId);
    },
    [currentUserId]
  );

  const sendMessage = useCallback(
    async (friendId: string, text: string) => {
      if (!currentUserId) throw new Error('Login required');
      await sendMessageService(currentUserId, friendId, text);
    },
    [currentUserId]
  );

  const subscribeToMessages = useCallback(
    (
      conversationId: string,
      callback: (messages: Message[]) => void
    ): Unsubscribe | undefined => {
      if (!conversationId) return undefined;
      return listenToMessages(conversationId, callback);
    },
    []
  );

  const markAsRead = useCallback(
    async (conversationId: string) => {
      if (!currentUserId) return;
      await markConversationAsRead(conversationId, currentUserId);
    },
    [currentUserId]
  );

  const searchUsers = useCallback(
    (text: string, excludeIds: string[] = []) =>
      searchUsersForChat(text, [currentUserId ?? '', ...excludeIds]),
    [currentUserId]
  );

  const findContacts = useCallback(
    (phones: string[], excludeIds: string[] = []) =>
      findUsersByPhoneNumbers(phones, [currentUserId ?? '', ...excludeIds]),
    [currentUserId]
  );

  const getConversationId = useCallback(
    (friendId: string) => {
      if (!currentUserId) return '';
      return getConversationIdForFriend(currentUserId, friendId);
    },
    [currentUserId]
  );

  const ensureConversation = useCallback(
    async (friendId: string) => {
      if (!currentUserId) throw new Error('Login required');
      return ensureConversationExists(currentUserId, friendId);
    },
    [currentUserId]
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      friends,
      conversations,
      unreadTotal,
      isLoading,
      addFriend,
      removeFriend,
      sendMessage,
      markAsRead,
      subscribeToMessages,
      searchUsers,
      findContacts,
      getConversationId,
      ensureConversation,
    }),
    [
      friends,
      conversations,
      unreadTotal,
      isLoading,
      addFriend,
      removeFriend,
      sendMessage,
      subscribeToMessages,
      markAsRead,
      searchUsers,
      findContacts,
      getConversationId,
      ensureConversation,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = (): ChatContextValue => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

