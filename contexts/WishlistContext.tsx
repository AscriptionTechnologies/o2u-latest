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
  addToWishlist: (product: WishlistProduct) => void;
  removeFromWishlist: (productId: string) => void;
  toggleWishlist: (product: WishlistProduct) => void;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wishlist, setWishlist] = useState<WishlistProduct[]>([]);
  const { userData } = useUser();

  // Get user-specific wishlist key
  const getWishlistKey = () => {
    return userData?.id ? `@only2u_wishlist_${userData.id}` : null;
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
    } catch (error) {
      console.error('Error loading wishlist:', error);
      setWishlist([]);
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

  const addToWishlist = (product: WishlistProduct) => {
    if (!userData?.id) {
      return;
    }

    if (wishlist.some(item => item.id === product.id)) {
      return;
    }

    const updatedWishlist = [...wishlist, product];
    setWishlist(updatedWishlist);
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
    } catch (error) {
      console.error('Error clearing wishlist:', error);
    }
  };

  const value: WishlistContextType = {
    wishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    isInWishlist,
    clearWishlist,
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