// Product-related TypeScript interfaces based on actual database schema

export interface Product {
  id: string;
  created_at: string;
  name: string;
  description: string;
  category_id: string;
  is_active: boolean;
  updated_at: string;
  featured_type?: 'trending' | 'best_seller' | null;
  like_count?: number;
  return_policy?: string;
  vendor_name?: string;
  alias_vendor?: string;
  // Legacy fields that might still be used in some places
  image_urls?: string[];
  video_urls?: string[];
  stock_quantity?: number;
  sku?: string;
  discount_percentage?: number;
  rating?: number;
  reviews?: number;
  // Computed fields
  category?: {
    name: string;
  };
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  color_id?: string;
  size_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  price: number;
  sku?: string;
  mrp_price?: number;
  rsp_price?: number;
  cost_price?: number;
  discount_percentage?: number;
  image_urls?: string[];
  video_urls?: string[];
  // Related data
  color?: {
    id: string;
    name: string;
    hex_code: string;
  };
  size: {
    id: string;
    name: string;
  };
}

export interface Category {
  id: string;
  name: string;
  description: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Color {
  id: string;
  name: string;
  hex_code: string;
}

export interface Size {
  id: string;
  name: string;
  category_id?: string;
}

// Legacy interface for backward compatibility
export interface LegacyProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  discount: number;
  rating: number;
  reviews: number;
  image: string;
  image_urls?: string[];
  video_urls?: string[];
  description?: string;
  stock?: string;
  featured?: boolean;
  images?: number;
  sku?: string;
  category?: string;
} 