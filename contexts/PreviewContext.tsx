import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from './UserContext';

export interface PreviewProduct {
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
  isPersonalized: boolean;
  isVideoPreview?: boolean;
  originalProductImage: string;
  originalProductVideo?: string;
  faceSwapDate: string;
  originalProductId: string;
  [key: string]: any;
}

interface PreviewContextType {
  previewProducts: PreviewProduct[];
  addToPreview: (product: PreviewProduct) => void;
  removeFromPreview: (productId: string) => void;
  isInPreview: (productId: string) => boolean;
  clearPreview: () => void;
}

const PreviewContext = createContext<PreviewContextType | undefined>(undefined);

export const PreviewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [previewProducts, setPreviewProducts] = useState<PreviewProduct[]>([]);
  const { userData } = useUser();

  // Get user-specific preview key
  const getPreviewKey = () => {
    return userData?.id ? `@only2u_preview_${userData.id}` : null;
  };

  useEffect(() => {
    loadPreview();
  }, [userData?.id]);

  useEffect(() => {
    if (previewProducts.length > 0) {
      savePreview();
    }
  }, [previewProducts, userData?.id]);

  const loadPreview = async () => {
    if (!userData?.id) return;

    try {
      const storedPreview = await AsyncStorage.getItem(`preview_${userData.id}`);
      if (storedPreview) {
        const parsedPreview = JSON.parse(storedPreview);
        setPreviewProducts(parsedPreview);
      } else {
        setPreviewProducts([]);
      }
    } catch (error) {
      console.error('Error loading preview:', error);
      setPreviewProducts([]);
    }
  };

  const savePreview = async () => {
    if (!userData?.id) return;

    try {
      await AsyncStorage.setItem(`preview_${userData.id}`, JSON.stringify(previewProducts));
    } catch (error) {
      console.error('Error saving preview:', error);
    }
  };

  const addToPreview = (product: PreviewProduct) => {
    if (!userData?.id) {
      return;
    }

    if (previewProducts.some(item => item.id === product.id)) {
      return;
    }

    const updatedPreview = [...previewProducts, product];
    setPreviewProducts(updatedPreview);
    savePreview();
  };

  const removeFromPreview = (productId: string) => {
    if (!userData?.id) {
      return;
    }

    const updatedPreview = previewProducts.filter(item => item.id !== productId);
    setPreviewProducts(updatedPreview);
    savePreview();
  };

  const isInPreview = (productId: string): boolean => {
    return previewProducts.some((p) => p.id === productId);
  };

  const clearPreview = async () => {
    if (!userData?.id) return;

    try {
      setPreviewProducts([]);
      await AsyncStorage.removeItem(`preview_${userData.id}`);
    } catch (error) {
      console.error('Error clearing preview:', error);
    }
  };

  const value: PreviewContextType = {
    previewProducts,
    addToPreview,
    removeFromPreview,
    isInPreview,
    clearPreview,
  };

  return (
    <PreviewContext.Provider value={value}>
      {children}
    </PreviewContext.Provider>
  );
};

export const usePreview = (): PreviewContextType => {
  const context = useContext(PreviewContext);
  if (!context) {
    throw new Error('usePreview must be used within a PreviewProvider');
  }
  return context;
}; 