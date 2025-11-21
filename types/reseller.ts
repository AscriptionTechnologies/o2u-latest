// Reseller System TypeScript interfaces

export interface Reseller {
  id: string;
  user_id: string;
  business_name?: string;
  business_type: 'individual' | 'business' | 'retailer';
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gst_number?: string;
  pan_number?: string;
  bank_account_number?: string;
  ifsc_code?: string;
  account_holder_name?: string;
  is_verified: boolean;
  is_active: boolean;
  commission_rate: number; // Default commission rate
  total_earnings: number;
  total_orders: number;
  rating: number;
  created_at: string;
  updated_at: string;
  
  // Related data
  user?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    profilePhoto?: string;
  };
}

export interface ResellerProduct {
  id: string;
  reseller_id: string;
  product_id: string;
  variant_id?: string;
  base_price: number;
  margin_percentage: number;
  selling_price: number;
  commission_percentage: number;
  is_active: boolean;
  stock_quantity: number;
  minimum_order_quantity: number;
  maximum_order_quantity: number;
  catalog_images: string[];
  custom_description?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  
  // Related data
  product?: {
    id: string;
    name: string;
    description?: string;
    image_urls?: string[];
    video_urls?: string[];
    category?: {
      name: string;
    };
    variants?: ProductVariant[];
  };
  variant?: ProductVariant;
  reseller?: Reseller;
}

export interface ResellerCatalogShare {
  id: string;
  reseller_id: string;
  product_id: string;
  share_method: 'whatsapp' | 'telegram' | 'instagram' | 'facebook' | 'direct_link' | 'email';
  share_content: string;
  share_metadata?: any;
  recipient_count: number;
  views: number;
  clicks: number;
  created_at: string;
}

export interface ResellerOrder {
  id: string;
  order_number: string;
  reseller_id: string;
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_address: string;
  customer_city: string;
  customer_state: string;
  customer_pincode: string;
  total_amount: number;
  reseller_commission: number;
  platform_commission: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_method?: 'cod' | 'online' | 'upi' | 'card';
  notes?: string;
  tracking_number?: string;
  shipped_at?: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
  
  // Related data
  reseller?: Reseller;
  items?: ResellerOrderItem[];
}

export interface ResellerOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  reseller_price: number;
  margin_amount: number;
  created_at: string;
  
  // Related data
  product?: {
    id: string;
    name: string;
    image_urls?: string[];
  };
  variant?: ProductVariant;
}

export interface ResellerEarning {
  id: string;
  reseller_id: string;
  order_id?: string;
  earning_type: 'commission' | 'bonus' | 'referral';
  amount: number;
  description?: string;
  status: 'pending' | 'paid' | 'cancelled';
  paid_at?: string;
  created_at: string;
}

export interface ResellerAnalytics {
  id: string;
  reseller_id: string;
  date: string;
  products_viewed: number;
  catalogs_shared: number;
  orders_received: number;
  revenue_generated: number;
  commission_earned: number;
  created_at: string;
}

// Form interfaces for creating/updating reseller data
export interface ResellerRegistrationForm {
  business_name: string;
  business_type: 'individual' | 'business' | 'retailer';
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gst_number?: string;
  pan_number?: string;
  bank_account_number?: string;
  ifsc_code?: string;
  account_holder_name?: string;
}




export interface ResellerProductForm {
  product_id: string;
  variant_id?: string;
  margin_percentage: number;
  stock_quantity: number;
  minimum_order_quantity: number;
  maximum_order_quantity: number;
  catalog_images: string[];
  custom_description?: string;
  tags: string[];
}




export interface CatalogShareForm {
  product_id: string;
  share_method: 'whatsapp' | 'telegram' | 'instagram' | 'facebook' | 'direct_link' | 'email';
  recipient_contacts?: string[];
  custom_message?: string;
}

// Import ProductVariant from product types
import { ProductVariant } from './product';

// Dashboard data interfaces
export interface ResellerDashboard {
  total_products: number;
  active_products: number;
  total_orders: number;
  pending_orders: number;
  total_earnings: number;
  pending_earnings: number;
  this_month_earnings: number;
  last_month_earnings: number;
  recent_orders: ResellerOrder[];
  top_products: ResellerProduct[];
  analytics: {
    daily_revenue: Array<{ date: string; revenue: number }>;
    weekly_orders: Array<{ week: string; orders: number }>;
    monthly_earnings: Array<{ month: string; earnings: number }>;
  };
}

// API response interfaces
export interface ResellerApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface ResellerListResponse {
  resellers: Reseller[];
  total: number;
  page: number;
  limit: number;
}

export interface ResellerProductListResponse {
  products: ResellerProduct[];
  total: number;
  page: number;
  limit: number;
}

export interface ResellerOrderListResponse {
  orders: ResellerOrder[];
  total: number;
  page: number;
  limit: number;
}
