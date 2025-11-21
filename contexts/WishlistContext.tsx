import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from './UserContext';

export interface WishlistProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  image_urls?: string[];
  video_urls?: string[];
  featured_type?: string;
  category?: any;
  stock_quantity?: number;
  variants?: any[];
  [key: string]: any;
}

interface WishlistContextType {
  wishlist: WishlistProduct[];
  unreadCount: number;
  addToWishlist: (product: WishlistProduct) => void;
  removeFromWishlist: (productId: string) => void;
  toggleWishlist: (product: WishlistProduct) => void;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
  markAllAsRead: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wishlist, setWishlist] = useState<WishlistProduct[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const { userData } = useUser();

  // Get user-specific wishlist key
  const getWishlistKey = () => {
    return userData?.id ? `@only2u_wishlist_${userData.id}` : null;
  };

  // Get user-specific unread count key
  const getUnreadCountKey = () => {
    return userData?.id ? `@only2u_wishlist_unread_${userData.id}` : null;
  };

  useEffect(() => {
    loadWishlist();
  }, [userData?.id]);

  useEffect(() => {
    if (wishlist.length > 0) {
      saveWishlist();
    }
  }, [wishlist, userData?.id]);

  const loadWishlist = async () => {
    if (!userData?.id) return;

    try {
      const storedWishlist = await AsyncStorage.getItem(`wishlist_${userData.id}`);
      if (storedWishlist) {
        const parsedWishlist = JSON.parse(storedWishlist);
        setWishlist(parsedWishlist);
      } else {
        setWishlist([]);
      }

      // Load unread count
      const unreadCountKey = getUnreadCountKey();
      if (unreadCountKey) {
        const storedUnreadCount = await AsyncStorage.getItem(unreadCountKey);
        setUnreadCount(storedUnreadCount ? parseInt(storedUnreadCount, 10) : 0);
      }
    } catch (error) {
      console.error('Error loading wishlist:', error);
      setWishlist([]);
      setUnreadCount(0);
    }
  };

  const saveWishlist = async () => {
    if (!userData?.id) return;

    try {
      await AsyncStorage.setItem(`wishlist_${userData.id}`, JSON.stringify(wishlist));
    } catch (error) {
      console.error('Error saving wishlist:', error);
    }
  };

  const addToWishlist = async (product: WishlistProduct) => {
    if (!userData?.id) {
      return;
    }

    if (wishlist.some(item => item.id === product.id)) {
      return;
    }

    const updatedWishlist = [...wishlist, product];
    setWishlist(updatedWishlist);
    
    // Increment unread count
    const newUnreadCount = unreadCount + 1;
    setUnreadCount(newUnreadCount);
    
    // Save both wishlist and unread count
    const unreadCountKey = getUnreadCountKey();
    if (unreadCountKey) {
      await AsyncStorage.setItem(unreadCountKey, newUnreadCount.toString());
    }
    saveWishlist();
  };

  const removeFromWishlist = (productId: string) => {
    if (!userData?.id) {
      return;
    }

    const updatedWishlist = wishlist.filter(item => item.id !== productId);
    setWishlist(updatedWishlist);
    saveWishlist();
  };

  const toggleWishlist = (product: WishlistProduct) => {
    if (!userData?.id) {
      return;
    }

    if (wishlist.some(item => item.id === product.id)) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  const isInWishlist = (productId: string): boolean => {
    return wishlist.some((p) => p.id === productId);
  };

  const clearWishlist = async () => {
    if (!userData?.id) return;

    try {
      setWishlist([]);
      await AsyncStorage.removeItem(`wishlist_${userData.id}`);
      
      // Also clear unread count
      const unreadCountKey = getUnreadCountKey();
      if (unreadCountKey) {
        setUnreadCount(0);
        await AsyncStorage.removeItem(unreadCountKey);
      }
    } catch (error) {
      console.error('Error clearing wishlist:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!userData?.id) return;

    try {
      // Clear unread count without removing items from wishlist
      setUnreadCount(0);
      const unreadCountKey = getUnreadCountKey();
      if (unreadCountKey) {
        await AsyncStorage.removeItem(unreadCountKey);
      }
    } catch (error) {
      console.error('Error marking wishlist as read:', error);
    }
  };

  const value: WishlistContextType = {
    wishlist,
    unreadCount,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    isInWishlist,
    clearWishlist,
    markAllAsRead,
  };

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = (): WishlistContextType => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}; 