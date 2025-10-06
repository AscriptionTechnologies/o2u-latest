import React, { useState, useEffect } from 'react';
import { supabase } from '~/utils/supabase';

interface AuthContextType {
  user: any | null;
  setUser: (user: any | null) => void;
  loading: boolean;
  needsOnboarding: boolean;
  setNeedsOnboarding: (needs: boolean) => void;
}

const AuthContext = React.createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function Provider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Fetch user profile data
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (userData) {
          setUser(userData);
          setNeedsOnboarding(false);
        } else if (error && error.code === 'PGRST116') {
          // User profile doesn't exist, needs onboarding
          setNeedsOnboarding(true);
          setUser(null);
        } else if (error && error.code === '42P17') {
          // RLS infinite recursion error - treat as new user needing onboarding
          console.log('RLS recursion error on initial session - treating as new user');
          setNeedsOnboarding(true);
          setUser(null);
        } else if (error) {
          console.error('Unexpected error on initial session:', error);
          // For other errors, also treat as needing onboarding to avoid blocking the user
          setNeedsOnboarding(true);
          setUser(null);
        }
      }
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        
        if (event === 'SIGNED_IN' && session?.user) {
          // Fetch user profile data
          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          console.log('User data fetch result:', userData, error);
          
          if (userData) {
            setUser(userData);
            setNeedsOnboarding(false);
            console.log('User set in context:', userData);
          } else if (error && error.code === 'PGRST116') {
            // User profile doesn't exist, needs onboarding
            console.log('User needs onboarding - no profile found');
            setNeedsOnboarding(true);
            setUser(null);
          } else if (error && error.code === '42P17') {
            // RLS infinite recursion error - treat as new user needing onboarding
            console.log('RLS recursion error - treating as new user needing onboarding');
            setNeedsOnboarding(true);
            setUser(null);
          } else if (error) {
            console.error('Unexpected error fetching user data:', error);
            // For other errors, also treat as needing onboarding to avoid blocking the user
            setNeedsOnboarding(true);
            setUser(null);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setNeedsOnboarding(false);
          console.log('User signed out');
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        needsOnboarding,
        setNeedsOnboarding,
      }}>
      {props.children}
    </AuthContext.Provider>
  );
}
