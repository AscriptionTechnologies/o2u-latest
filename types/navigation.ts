export type RootStackParamList = {
  Dashboard: undefined;
  ProductDetails: {
    product?: {
      id: string;
      name: string;
      price: number;
      originalPrice?: number;
      discount: number;
      rating: number;
      reviews: number;
      image: string;
      image_urls?: string[];
      description?: string;
      stock?: string;
      featured?: boolean;
      images?: number;
    };
    productId?: string; // Alternative: fetch product by ID
  };
  Products: {
    category: {
      id: string;
      name: string;
      description: string;
      image_url?: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    };
    featuredType?: 'trending' | 'best_seller';
  };
  Profile: undefined;
  EditProfile: undefined;
  MyOrders: undefined;
  OrderDetails: {
    orderId: string;
  };
  BodyMeasurements: undefined;
  HelpCenter: undefined;
  Wishlist: undefined;
  FaceSwap: {
    productId: string;
    productImageUrl: string;
    productName: string;
  };
  Messages: undefined;
  ChatThread: {
    friendId: string;
    conversationId?: string;
  };
  FriendSearch: undefined;
  PersonalizedProductResult: {
    product: {
      id: string;
      name: string;
      description: string;
      image_urls: string[];
      faceSwapDate?: string;
      originalProductId?: string;
    };
  };
  Checkout: undefined;
  VendorProfile: {
    vendorId: string;
    vendor?: {
      id: string;
      business_name: string;
      description?: string;
      profile_image_url?: string;
      cover_image_url?: string;
      website_url?: string;
      instagram_handle?: string;
      tiktok_handle?: string;
      location?: string;
      is_verified: boolean;
      follower_count: number;
      following_count: number;
      product_count: number;
      created_at: string;
      updated_at: string;
    };
  };
  VendorDashboard: undefined;
  PrivacyPolicy: undefined;
  TermsAndConditions: undefined;
  RefundPolicy: undefined;
  AllReviews: {
    productId: string;
    productName: string;
    averageRating: number;
    totalReviews: number;
    reviews: any[];
  };
};

export type TabParamList = {
  Home: undefined;
  Trending: undefined;
  Cart: undefined;
  Messages: undefined;
};
