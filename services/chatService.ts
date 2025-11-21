import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where,
  limit,
  addDoc,
  getDoc,
  runTransaction,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { firebaseDb } from './firebase';
import { supabase } from '~/utils/supabase';
import type { UserData } from '~/contexts/UserContext';




export interface ChatUserProfile {
  id: string;
  displayName: string;
  avatar?: string | null;
}

export interface FriendRecord extends ChatUserProfile {
  createdAt: Date;
}

export interface ConversationSummary {
  id: string;
  participants: string[];
  participantProfiles: Record<string, ChatUserProfile>;
  lastMessage?: {
    text: string;
    senderId: string;
    createdAt: Date;
  };
  updatedAt?: Date;
  unreadCounts: Record<string, number>;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: Date;
  status: 'sent' | 'delivered' | 'read';
}

const USERS_COLLECTION = 'users';
const FRIENDS_SUBCOLLECTION = 'friends';
const CONVERSATIONS_COLLECTION = 'conversations';
const MESSAGES_SUBCOLLECTION = 'messages';

const conversationIdForUsers = (userA: string, userB: string) =>
  [userA, userB].sort((a, b) => a.localeCompare(b)).join('_');

const supabaseProfileToChatProfile = (row: any): ChatUserProfile => ({
  id: row.id,
  displayName: row.name || row.email || 'Only2U User',
  avatar: row.profilePhoto ?? row.avatar_url ?? null,
});

export const syncUserProfileToFirebase = async (userData: UserData | null) => {
  if (!userData?.id) return;
  const userRef = doc(firebaseDb, USERS_COLLECTION, userData.id);
  await setDoc(
    userRef,
    {
      displayName: userData.name,
      avatar: userData.profilePhoto ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const fetchUserProfileSummary = async (userId: string): Promise<ChatUserProfile | null> => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('users')
    .select('id, name, profilePhoto, email')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) {
    console.warn('[ChatService] Unable to fetch user profile from Supabase', error);
    return null;
  }
  return supabaseProfileToChatProfile(data);
};

export const normalizePhoneNumber = (input?: string | null): string => {
  if (!input) return '';
  const digits = input.replace(/\D+/g, '');
  if (digits.startsWith('00')) {
    return digits.slice(2);
  }
  return digits;
};

export const searchUsersForChat = async (
  queryText: string,
  excludeIds: string[] = [],
  limitCount = 20
): Promise<ChatUserProfile[]> => {
  const trimmed = queryText.trim();
  if (trimmed.length === 0) return [];

  const { data, error } = await supabase
    .from('users')
    .select('id, name, profilePhoto, email')
    .ilike('name', `%${trimmed}%`)
    .limit(limitCount);

  if (error || !data) {
    console.warn('[ChatService] search users error', error);
    return [];
  }

  return data
    .filter((row) => !excludeIds.includes(row.id))
    .map(supabaseProfileToChatProfile);
};

export const findUsersByPhoneNumbers = async (
  phoneNumbers: string[],
  excludeIds: string[] = []
): Promise<Array<ChatUserProfile & { phone?: string | null }>> => {
  const normalizedSet = new Set<string>();
  phoneNumbers.forEach((phone) => {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) return;
    normalizedSet.add(normalized);
    if (normalized.length > 10) {
      normalizedSet.add(normalized.slice(-10));
    }
  });

  if (normalizedSet.size === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, name, profilePhoto, phone')
    .not('phone', 'is', null)
    .limit(500);

  if (error || !data) {
    console.warn('[ChatService] findUsersByPhoneNumbers error', error);
    return [];
  }

  return data
    .filter((row) => {
      if (!row || excludeIds.includes(row.id)) return false;
      const normalized = normalizePhoneNumber(row.phone);
      if (!normalized) return false;
      if (normalizedSet.has(normalized)) return true;
      if (normalized.length > 10 && normalizedSet.has(normalized.slice(-10))) return true;
      return false;
    })
    .map((row) => ({ ...supabaseProfileToChatProfile(row), phone: row.phone ?? null }));
};

export const addFriend = async (currentUserId: string, friendId: string) => {
  if (currentUserId === friendId) {
    throw new Error('You cannot add yourself as a friend.');
  }

  const [currentProfile, friendProfile] = await Promise.all([
    fetchUserProfileSummary(currentUserId),
    fetchUserProfileSummary(friendId),
  ]);

  if (!currentProfile || !friendProfile) {
    throw new Error('User profile not found.');
  }

  const batch = writeBatch(firebaseDb);
  const now = serverTimestamp();

  const currentFriendRef = doc(
    firebaseDb,
    USERS_COLLECTION,
    currentUserId,
    FRIENDS_SUBCOLLECTION,
    friendId
  );
  batch.set(currentFriendRef, {
    friendId,
    displayName: friendProfile.displayName,
    avatar: friendProfile.avatar ?? null,
    createdAt: now,
  });

  const friendFriendRef = doc(
    firebaseDb,
    USERS_COLLECTION,
    friendId,
    FRIENDS_SUBCOLLECTION,
    currentUserId
  );
  batch.set(friendFriendRef, {
    friendId: currentUserId,
    displayName: currentProfile.displayName,
    avatar: currentProfile.avatar ?? null,
    createdAt: now,
  });

  const conversationRef = doc(
    firebaseDb,
    CONVERSATIONS_COLLECTION,
    conversationIdForUsers(currentUserId, friendId)
  );

  batch.set(
    conversationRef,
    {
      participants: [currentUserId, friendId],
      participantProfiles: {
        [currentUserId]: currentProfile,
        [friendId]: friendProfile,
      },
      unreadCounts: {
        [currentUserId]: 0,
        [friendId]: 0,
      },
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await batch.commit();
};

export const removeFriend = async (currentUserId: string, friendId: string) => {
  if (!currentUserId || !friendId) return;
  const batch = writeBatch(firebaseDb);
  batch.delete(
    doc(firebaseDb, USERS_COLLECTION, currentUserId, FRIENDS_SUBCOLLECTION, friendId)
  );
  batch.delete(doc(firebaseDb, USERS_COLLECTION, friendId, FRIENDS_SUBCOLLECTION, currentUserId));

  await batch.commit();
};

export const listenToFriends = (
  currentUserId: string,
  callback: (friends: FriendRecord[]) => void
): Unsubscribe => {
  const friendsRef = collection(
    firebaseDb,
    USERS_COLLECTION,
    currentUserId,
    FRIENDS_SUBCOLLECTION
  );

  const friendsQuery = query(friendsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(friendsQuery, (snapshot) => {
    const records: FriendRecord[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const createdAt =
        data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
      return {
        id: data.friendId,
        displayName: data.displayName || 'Only2U User',
        avatar: data.avatar ?? null,
        createdAt,
      };
    });
    callback(records);
  });
};

export const listenToConversations = (
  currentUserId: string,
  callback: (conversations: ConversationSummary[]) => void
): Unsubscribe => {
  const conversationsRef = collection(firebaseDb, CONVERSATIONS_COLLECTION);
  const conversationsQuery = query(
    conversationsRef,
    where('participants', 'array-contains', currentUserId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(conversationsQuery, (snapshot) => {
    const conversations: ConversationSummary[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const updatedAt =
        data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;
      let lastMessage;
      if (data.lastMessage) {
        const createdAt =
          data.lastMessage.createdAt instanceof Timestamp
            ? data.lastMessage.createdAt.toDate()
            : new Date();
        lastMessage = {
          text: data.lastMessage.text || '',
          senderId: data.lastMessage.senderId,
          createdAt,
        };
      }

      return {
        id: docSnap.id,
        participants: data.participants || [],
        participantProfiles: data.participantProfiles || {},
        lastMessage,
        updatedAt,
        unreadCounts: data.unreadCounts || {},
      };
    });

    callback(conversations);
  });
};

export const listenToMessages = (
  conversationId: string,
  callback: (messages: Message[]) => void,
  limitCount = 50
): Unsubscribe => {
  const messagesRef = collection(
    firebaseDb,
    CONVERSATIONS_COLLECTION,
    conversationId,
    MESSAGES_SUBCOLLECTION
  );
  const messagesQuery = query(messagesRef, orderBy('createdAt', 'desc'), limit(limitCount));

  return onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const createdAt =
        data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
      return {
        id: docSnap.id,
        senderId: data.senderId,
        text: data.text,
        createdAt,
        status: data.status || 'sent',
      } as Message;
    });
    callback(messages.reverse());
  });
};

export const sendMessage = async (
  senderId: string,
  recipientId: string,
  text: string
) => {
  if (!text.trim()) return;

  const messageText = text.trim();
  const conversationId = conversationIdForUsers(senderId, recipientId);
  const conversationRef = doc(firebaseDb, CONVERSATIONS_COLLECTION, conversationId);
  const messagesRef = collection(conversationRef, MESSAGES_SUBCOLLECTION);

  const [senderProfile, recipientProfile] = await Promise.all([
    fetchUserProfileSummary(senderId),
    fetchUserProfileSummary(recipientId),
  ]);

  const senderProfileData: ChatUserProfile = senderProfile ?? {
    id: senderId,
    displayName: 'Only2U User',
    avatar: null,
  };
  const recipientProfileData: ChatUserProfile = recipientProfile ?? {
    id: recipientId,
    displayName: 'Only2U User',
    avatar: null,
  };

  await runTransaction(firebaseDb, async (transaction) => {
    const conversationSnapshot = await transaction.get(conversationRef);
    const now = serverTimestamp();

    if (!conversationSnapshot.exists()) {
      transaction.set(conversationRef, {
        participants: [senderId, recipientId],
        participantProfiles: {
          [senderId]: senderProfileData,
          [recipientId]: recipientProfileData,
        },
        createdAt: now,
        updatedAt: now,
        unreadCounts: {
          [senderId]: 0,
          [recipientId]: 1,
        },
        lastMessage: {
          text: messageText,
          senderId,
          createdAt: now,
        },
      });
    } else {
      const data = conversationSnapshot.data() || {};
      const unreadCounts = { ...(data.unreadCounts || {}) };
      unreadCounts[recipientId] = (unreadCounts[recipientId] || 0) + 1;

      transaction.update(conversationRef, {
        participantProfiles: {
          ...(data.participantProfiles || {}),
          [senderId]: senderProfileData,
          [recipientId]: recipientProfileData,
        },
        updatedAt: now,
        unreadCounts,
        lastMessage: {
          text: messageText,
          senderId,
          createdAt: now,
        },
      });
    }

    const newMessageRef = doc(messagesRef);
    transaction.set(newMessageRef, {
      senderId,
      text: messageText,
      createdAt: now,
      status: 'sent',
    });
  });
};

export const markConversationAsRead = async (
  conversationId: string,
  userId: string
) => {
  if (!conversationId || !userId) return;
  const conversationRef = doc(firebaseDb, CONVERSATIONS_COLLECTION, conversationId);
  await updateDoc(conversationRef, {
    [`unreadCounts.${userId}`]: 0,
    [`lastRead.${userId}`]: serverTimestamp(),
  });
};

export const getConversationIdForFriend = (currentUserId: string, friendId: string) =>
  conversationIdForUsers(currentUserId, friendId);

export const ensureConversationExists = async (
  currentUserId: string,
  friendId: string
): Promise<string> => {
  const conversationId = conversationIdForUsers(currentUserId, friendId);
  const conversationRef = doc(firebaseDb, CONVERSATIONS_COLLECTION, conversationId);
  const snap = await getDoc(conversationRef);
  if (!snap.exists()) {
    const [currentProfile, friendProfile] = await Promise.all([
      fetchUserProfileSummary(currentUserId),
      fetchUserProfileSummary(friendId),
    ]);
    await setDoc(conversationRef, {
      participants: [currentUserId, friendId],
      participantProfiles: {
        [currentUserId]: currentProfile ?? {
          id: currentUserId,
          displayName: 'Only2U User',
          avatar: null,
        },
        [friendId]: friendProfile ?? {
          id: friendId,
          displayName: 'Only2U User',
          avatar: null,
        },
      },
      unreadCounts: {
        [currentUserId]: 0,
        [friendId]: 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return conversationId;
};

