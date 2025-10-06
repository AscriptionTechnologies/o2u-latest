import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '~/utils/supabase';

export interface UserData {
  id: string;
  name: string; // Changed from firstName/lastName to single name field
  email?: string;
  phone?: string; // Changed from phoneNumber to phone
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  profilePhoto?: string; // Changed from profilePictureUrl to profilePhoto
  role?: string; // User role (admin, user, etc.)

  // Location Information (simplified)
  location: string; // Changed from multiple address fields to single location

  // Body Measurements
  bustSize?: number; // Changed to match registration schema
  waistSize?: number;
  hipSize?: number;
  height?: string;
  weight?: string;
  size: string; // Changed from preferredSize to size

  // App Preferences
  preferredCurrency: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
  coin_balance?: number;
}

interface UserContextType {
  userData: UserData | null;
  setUserData: (data: UserData) => void;
  updateUserData: (data: Partial<UserData>, syncToSupabase?: boolean) => Promise<void>;
  loadUserData: () => Promise<void>;
  clearUserData: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  deleteUserProfile: () => Promise<void>;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const loadUserData = async () => {
    try {
      setIsLoading(true);
      const storedData = await AsyncStorage.getItem('userData');
      if (storedData) {
        setUserData(JSON.parse(storedData));
      } else {
        await AsyncStorage.setItem('userData', JSON.stringify(null));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setUserData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserData = async (newData: Partial<UserData>, syncToSupabase: boolean = true) => {
    try {
      if (!userData) return;

      const updatedData = {
        ...userData,
        ...newData,
        updatedAt: new Date().toISOString(),
      };

      // Update local state first
      setUserData(updatedData);
      await AsyncStorage.setItem('userData', JSON.stringify(updatedData));

      // Sync to Supabase if requested
      if (syncToSupabase && updatedData.id !== 'mock-user-id') {
        try {
          const supabaseData = {
            name: updatedData.name,
            email: updatedData.email,
            phone: updatedData.phone,
            // Handle empty date fields - convert empty strings to null for PostgreSQL
            dateOfBirth: updatedData.dateOfBirth && updatedData.dateOfBirth.trim() !== '' ? updatedData.dateOfBirth : null,
            gender: updatedData.gender,
            profilePhoto: updatedData.profilePhoto,
            location: updatedData.location,
            bustSize: updatedData.bustSize,
            waistSize: updatedData.waistSize,
            hipSize: updatedData.hipSize,
            height: updatedData.height,
            weight: updatedData.weight,
            size: updatedData.size,
            preferredCurrency: updatedData.preferredCurrency,
            emailVerified: updatedData.emailVerified,
            phoneVerified: updatedData.phoneVerified,
            coin_balance: updatedData.coin_balance,
          };

          const { error } = await supabase
            .from('users')
            .update(supabaseData)
            .eq('id', updatedData.id);

          if (error) {
            console.error('Error syncing user data to Supabase:', error);
          }
        } catch (error) {
          console.error('Error syncing user data to Supabase:', error);
        }
      }
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error; // Re-throw for UI error handling
    }
  };

  const clearUserData = async () => {
    try {
      // Clean up subscription first
      if (subscription) {
        supabase.removeChannel(subscription);
        setSubscription(null);
        currentUserIdRef.current = null;
      }

      setUserData(null);
      await AsyncStorage.removeItem('userData');
    } catch (error) {
      console.error('Error clearing user data:', error);
    }
  };

  const setupRealtimeSubscription = (userId: string) => {
    // Prevent duplicate subscriptions for the same user
    if (currentUserIdRef.current === userId && subscription) {
      return;
    }

    // Clean up existing subscription first
    if (subscription) {
      supabase.removeChannel(subscription);
      setSubscription(null);
    }

    currentUserIdRef.current = userId;

    // Create a unique channel name with timestamp to avoid conflicts
    const channelName = `user-${userId}-${Date.now()}`;

    const newSubscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            const updatedUserData = {
              ...payload.new,
              // Map database fields to our interface
              profilePhoto: payload.new.profilePhoto,
              phone: payload.new.phone || payload.new.phoneNumber,
              updatedAt: new Date().toISOString(),
            } as UserData;

            setUserData(updatedUserData);

            // Also update AsyncStorage
            AsyncStorage.setItem('userData', JSON.stringify(updatedUserData));
          }
        }
      )
      .subscribe((status) => {
      });

    setSubscription(newSubscription);
  };

  const refreshUserData = async () => {
    if (!userData || !userData.id || userData.id === 'mock-user-id') {
      return;
    }

    try {
      const { data: freshUserData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userData.id)
        .single();

      if (error) {
        console.error('[USER_CONTEXT] ❌ Error refreshing user data:', error);
        return;
      }

      if (freshUserData) {
        const updatedUserData = {
          ...freshUserData,
          // Map database fields to our interface
          profilePhoto: freshUserData.profilePhoto,
          phone: freshUserData.phone || freshUserData.phoneNumber,
          updatedAt: new Date().toISOString(),
        } as UserData;

        setUserData(updatedUserData);
        await AsyncStorage.setItem('userData', JSON.stringify(updatedUserData));
      }
    } catch (error) {
      console.error('[USER_CONTEXT] ❌ Error refreshing user data:', error);
    }
  };

  const deleteUserProfile = async () => {
    console.log('[USER_CONTEXT] 🚀 Starting deleteUserProfile process');
    console.log('[USER_CONTEXT] 📝 Current userData:', userData ? {
      id: userData.id,
      email: userData.email,
      name: userData.name
    } : 'null');

    if (!userData || !userData.id || userData.id === 'mock-user-id') {
      console.log('[USER_CONTEXT] ⚠️ No valid user data to delete, proceeding with cleanup');
    }

    try {
      // Clean up subscription first
      if (subscription) {
        console.log('[USER_CONTEXT] 🧹 Cleaning up subscription...');
        supabase.removeChannel(subscription);
        setSubscription(null);
        currentUserIdRef.current = null;
        console.log('[USER_CONTEXT] ✅ Subscription cleaned up');
      }

      // Try to call the edge function to delete user from authentication
      if (userData && userData.id && userData.id !== 'mock-user-id') {
        console.log('[USER_CONTEXT] 🔄 Attempting to delete user from authentication via edge function...');
        
        try {
          const { data: session } = await supabase.auth.getSession();
          console.log('[USER_CONTEXT] 📝 Session data:', session ? {
            hasSession: !!session.session,
            hasAccessToken: !!session.session?.access_token,
            userId: session.session?.user?.id
          } : 'null');

          if (session?.session?.access_token) {
            console.log('[USER_CONTEXT] 🔄 Calling edge function...');
            console.log('[USER_CONTEXT] 📝 Edge function URL:', `${SUPABASE_URL}/functions/v1/delete-user`);
            console.log('[USER_CONTEXT] 📝 User ID to delete:', userData.id);

            const response = await fetch(
              `${SUPABASE_URL}/functions/v1/delete-user`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.session.access_token}`,
                  'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ userId: userData.id }),
              }
            );

            console.log('[USER_CONTEXT] 📝 Edge function response status:', response.status);
            console.log('[USER_CONTEXT] 📝 Edge function response headers:', Object.fromEntries(response.headers.entries()));

            const result = await response.json();
            console.log('[USER_CONTEXT] 📝 Edge function response body:', result);

            if (response.ok) {
              console.log('[USER_CONTEXT] ✅ User deleted from authentication via edge function');
            } else {
              console.error('[USER_CONTEXT] ❌ Edge function error:', result);
            }
          } else {
            console.log('[USER_CONTEXT] ⚠️ No valid session found, skipping edge function call');
          }
        } catch (edgeFunctionError) {
          console.error('[USER_CONTEXT] ❌ Edge function failed:', edgeFunctionError);
          console.error('[USER_CONTEXT] ❌ Edge function error details:', {
            message: edgeFunctionError.message,
            stack: edgeFunctionError.stack
          });
        }
      }

      // Try to delete user data from the users table (if we have valid user data)
      if (userData && userData.id && userData.id !== 'mock-user-id') {
        console.log('[USER_CONTEXT] 🗑️ Deleting user data from database...');
        const { error: userDeleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', userData.id);
        
        if (userDeleteError) {
          console.error('[USER_CONTEXT] ❌ Error deleting user data:', userDeleteError);
          // Continue anyway - we'll still sign out and clear local data
        } else {
          console.log('[USER_CONTEXT] ✅ User data deleted from database');
        }
      }

      // Sign out the user (this will clear the auth session)
      console.log('[USER_CONTEXT] 🚪 Signing out user...');
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error('[USER_CONTEXT] ❌ Error signing out user:', signOutError);
        // Continue anyway
      } else {
        console.log('[USER_CONTEXT] ✅ User signed out successfully');
      }

      // Clear local data
      console.log('[USER_CONTEXT] 🧹 Clearing local data...');
      setUserData(null);
      await AsyncStorage.removeItem('userData');
      console.log('[USER_CONTEXT] ✅ Local data cleared');
      
      console.log('[USER_CONTEXT] ✅ User profile cleanup completed successfully');
    } catch (error) {
      console.error('[USER_CONTEXT] ❌ Error during cleanup:', error);
      console.error('[USER_CONTEXT] ❌ Error details:', {
        message: error.message,
        stack: error.stack
      });
      // Even if there's an error, try to clear local data and sign out
      try {
        await supabase.auth.signOut();
        setUserData(null);
        await AsyncStorage.removeItem('userData');
        console.log('[USER_CONTEXT] ✅ Emergency cleanup completed');
      } catch (cleanupError) {
        console.error('[USER_CONTEXT] ❌ Emergency cleanup failed:', cleanupError);
      }
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  // Set up real-time subscription when userData changes
  useEffect(() => {
    if (userData && userData.id && userData.id !== 'mock-user-id') {
      // Only set up subscription if we don't already have one for this user
      if (currentUserIdRef.current !== userData.id) {
        setupRealtimeSubscription(userData.id);
      }
    } else {
      // Clean up subscription if no valid user
      if (subscription) {
        supabase.removeChannel(subscription);
        setSubscription(null);
        currentUserIdRef.current = null;
      }
    }

    // Cleanup subscription on unmount or when user changes
    return () => {
      if (subscription && currentUserIdRef.current !== userData?.id) {
        supabase.removeChannel(subscription);
        setSubscription(null);
        currentUserIdRef.current = null;
      }
    };
  }, [userData?.id]); // Only depend on user ID, not the entire userData object

  const value: UserContextType = {
    userData,
    setUserData,
    updateUserData,
    loadUserData,
    clearUserData,
    refreshUserData,
    deleteUserProfile,
    isLoading,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
