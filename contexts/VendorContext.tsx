import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '~/utils/supabase';
import { useAuth } from './useAuth';

export interface Vendor {
  id: string;
  user_id: string;
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
}

export interface VendorPost {
  id: string;
  vendor_id: string;
  business_name: string;
  vendor_profile_image?: string;
  is_verified: boolean;
  product_id?: string;
  product_name?: string;
  price?: number;
  product_images?: string[];
  caption?: string;
  media_urls: string[];
  media_type: 'image' | 'video' | 'carousel';
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_featured: boolean;
  created_at: string;
  is_liked?: boolean;
}

export interface VendorStory {
  id: string;
  vendor_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  duration: number;
  is_active: boolean;
  expires_at: string;
  views_count: number;
  created_at: string;
  is_viewed?: boolean;
}

export interface VendorFollow {
  id: string;
  follower_id: string;
  vendor_id: string;
  created_at: string;
}

interface VendorContextType {
  vendors: Vendor[];
  vendorPosts: VendorPost[];
  vendorStories: VendorStory[];
  followedVendors: string[];
  loading: boolean;
  error: string | null;
  
  // Vendor actions
  fetchVendors: () => Promise<void>;
  fetchVendorById: (vendorId: string) => Promise<Vendor | null>;
  fetchVendorPosts: (vendorId?: string) => Promise<void>;
  fetchVendorStories: (vendorId?: string) => Promise<void>;
  fetchFollowedVendors: () => Promise<void>;
  
  // Follow actions
  followVendor: (vendorId: string) => Promise<boolean>;
  unfollowVendor: (vendorId: string) => Promise<boolean>;
  isFollowingVendor: (vendorId: string) => boolean;
  
  // Post actions
  likePost: (postId: string) => Promise<boolean>;
  unlikePost: (postId: string) => Promise<boolean>;
  sharePost: (postId: string) => Promise<boolean>;
  
  // Story actions
  viewStory: (storyId: string) => Promise<boolean>;
  
  // Utility functions
  getVendorByProductId: (productId: string) => Promise<Vendor | null>;
  refreshVendorData: () => Promise<void>;
}

const VendorContext = createContext<VendorContextType | undefined>(undefined);

export const useVendor = () => {
  const context = useContext(VendorContext);
  if (context === undefined) {
    throw new Error('useVendor must be used within a VendorProvider');
  }
  return context;
};

interface VendorProviderProps {
  children: ReactNode;
}

export const VendorProvider: React.FC<VendorProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorPosts, setVendorPosts] = useState<VendorPost[]>([]);
  const [vendorStories, setVendorStories] = useState<VendorStory[]>([]);
  const [followedVendors, setFollowedVendors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all vendors
  const fetchVendors = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('follower_count', { ascending: false });

      if (error) throw error;
      setVendors(data || []);
    } catch (err) {
      console.error('Error fetching vendors:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch vendors');
    } finally {
      setLoading(false);
    }
  };

  // Fetch vendor by ID
  const fetchVendorById = async (vendorId: string): Promise<Vendor | null> => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error fetching vendor:', err);
      return null;
    }
  };

  // Fetch vendor posts (feed or specific vendor)
  const fetchVendorPosts = async (vendorId?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('vendor_feed')
        .select('*')
        .order('created_at', { ascending: false });

      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Check if user has liked each post
      const postsWithLikes = await Promise.all(
        (data || []).map(async (post) => {
          if (!user) return { ...post, is_liked: false };
          
          const { data: likeData } = await supabase
            .from('vendor_post_likes')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', user.id)
            .single();

          return { ...post, is_liked: !!likeData };
        })
      );

      setVendorPosts(postsWithLikes);
    } catch (err) {
      console.error('Error fetching vendor posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  };

  // Fetch vendor stories
  const fetchVendorStories = async (vendorId?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('vendor_stories')
        .select('*')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Check if user has viewed each story
      const storiesWithViews = await Promise.all(
        (data || []).map(async (story) => {
          if (!user) return { ...story, is_viewed: false };
          
          const { data: viewData } = await supabase
            .from('vendor_story_views')
            .select('id')
            .eq('story_id', story.id)
            .eq('user_id', user.id)
            .single();

          return { ...story, is_viewed: !!viewData };
        })
      );

      setVendorStories(storiesWithViews);
    } catch (err) {
      console.error('Error fetching vendor stories:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stories');
    } finally {
      setLoading(false);
    }
  };

  // Fetch followed vendors
  const fetchFollowedVendors = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('vendor_follows')
        .select('vendor_id')
        .eq('follower_id', user.id);

      if (error) throw error;
      setFollowedVendors((data || []).map(f => f.vendor_id));
    } catch (err) {
      console.error('Error fetching followed vendors:', err);
    }
  };

  // Follow vendor
  const followVendor = async (vendorId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .from('vendor_follows')
        .insert({
          follower_id: user.id,
          vendor_id: vendorId
        });

      if (error) throw error;
      
      setFollowedVendors(prev => [...prev, vendorId]);
      return true;
    } catch (err) {
      console.error('Error following vendor:', err);
      return false;
    }
  };

  // Unfollow vendor
  const unfollowVendor = async (vendorId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .from('vendor_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('vendor_id', vendorId);

      if (error) throw error;
      
      setFollowedVendors(prev => prev.filter(id => id !== vendorId));
      return true;
    } catch (err) {
      console.error('Error unfollowing vendor:', err);
      return false;
    }
  };

  // Check if following vendor
  const isFollowingVendor = (vendorId: string): boolean => {
    return followedVendors.includes(vendorId);
  };

  // Like post
  const likePost = async (postId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .from('vendor_post_likes')
        .insert({
          user_id: user.id,
          post_id: postId
        });

      if (error) throw error;
      
      // Update local state
      setVendorPosts(prev => prev.map(post => 
        post.id === postId 
          ? { ...post, likes_count: post.likes_count + 1, is_liked: true }
          : post
      ));
      
      return true;
    } catch (err) {
      console.error('Error liking post:', err);
      return false;
    }
  };

  // Unlike post
  const unlikePost = async (postId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .from('vendor_post_likes')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', postId);

      if (error) throw error;
      
      // Update local state
      setVendorPosts(prev => prev.map(post => 
        post.id === postId 
          ? { ...post, likes_count: post.likes_count - 1, is_liked: false }
          : post
      ));
      
      return true;
    } catch (err) {
      console.error('Error unliking post:', err);
      return false;
    }
  };

  // Share post
  const sharePost = async (postId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('vendor_posts')
        .update({ shares_count: supabase.raw('shares_count + 1') })
        .eq('id', postId);

      if (error) throw error;
      
      // Update local state
      setVendorPosts(prev => prev.map(post => 
        post.id === postId 
          ? { ...post, shares_count: post.shares_count + 1 }
          : post
      ));
      
      return true;
    } catch (err) {
      console.error('Error sharing post:', err);
      return false;
    }
  };

  // View story
  const viewStory = async (storyId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .from('vendor_story_views')
        .insert({
          user_id: user.id,
          story_id: storyId
        });

      if (error) throw error;
      
      // Update local state
      setVendorStories(prev => prev.map(story => 
        story.id === storyId 
          ? { ...story, views_count: story.views_count + 1, is_viewed: true }
          : story
      ));
      
      return true;
    } catch (err) {
      console.error('Error viewing story:', err);
      return false;
    }
  };

  // Get vendor by product ID
  const getVendorByProductId = async (productId: string): Promise<Vendor | null> => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('vendor_id')
        .eq('id', productId)
        .single();

      if (error || !data?.vendor_id) return null;

      return await fetchVendorById(data.vendor_id);
    } catch (err) {
      console.error('Error getting vendor by product ID:', err);
      return null;
    }
  };

  // Refresh all vendor data
  const refreshVendorData = async () => {
    await Promise.all([
      fetchVendors(),
      fetchVendorPosts(),
      fetchVendorStories(),
      fetchFollowedVendors()
    ]);
  };

  // Initialize data when user changes
  useEffect(() => {
    if (user) {
      fetchFollowedVendors();
    } else {
      setFollowedVendors([]);
    }
  }, [user]);

  // Initial data fetch
  useEffect(() => {
    fetchVendors();
    fetchVendorPosts();
    fetchVendorStories();
  }, []);

  const value: VendorContextType = {
    vendors,
    vendorPosts,
    vendorStories,
    followedVendors,
    loading,
    error,
    fetchVendors,
    fetchVendorById,
    fetchVendorPosts,
    fetchVendorStories,
    fetchFollowedVendors,
    followVendor,
    unfollowVendor,
    isFollowingVendor,
    likePost,
    unlikePost,
    sharePost,
    viewStory,
    getVendorByProductId,
    refreshVendorData
  };

  return (
    <VendorContext.Provider value={value}>
      {children}
    </VendorContext.Provider>
  );
};
