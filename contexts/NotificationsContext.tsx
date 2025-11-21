import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from './UserContext';

export type AppNotification = {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  timeIso: string;
  unread: boolean;
  productId?: string; // For face swap notifications
  resultImages?: string[]; // For face swap result images
};

type NotificationsContextType = {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, 'id' | 'timeIso' | 'unread'> & { timeIso?: string }) => Promise<void>;
  markAllRead: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  clear: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userData } = useUser();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  // Calculate unread count
  const unreadCount = notifications.filter(n => n.unread).length;

  const storageKey = userData?.id ? `notifications_${userData.id}` : undefined;

  useEffect(() => {
    const load = async () => {
      if (!storageKey) return;
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        setNotifications(raw ? JSON.parse(raw) : []);
      } catch {
        setNotifications([]);
      }
    };
    load();
  }, [storageKey]);

  const persist = async (next: AppNotification[]) => {
    if (!storageKey) return;
    setNotifications(next);
    await AsyncStorage.setItem(storageKey, JSON.stringify(next));
  };

  const addNotification: NotificationsContextType['addNotification'] = async (n) => {
    if (!storageKey) return;
    const item: AppNotification = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      title: n.title,
      subtitle: n.subtitle,
      image: n.image,
      timeIso: n.timeIso ?? new Date().toISOString(),
      unread: true,
    };
    await persist([item, ...notifications]);
  };

  const markAllRead = async () => {
    await persist(notifications.map(n => ({ ...n, unread: false })));
  };

  const removeNotification = async (id: string) => {
    await persist(notifications.filter(n => n.id !== id));
  };

  const clear = async () => {
    await persist([]);
  };

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead, removeNotification, clear }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = (): NotificationsContextType => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
};


