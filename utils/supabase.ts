import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Using constant URL and key for reliability
export const SUPABASE_URL = 'https://ljnheixbsweamlbntwvh.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqbmhlaXhic3dlYW1sYm50d3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3NTg4MjksImV4cCI6MjA2NjMzNDgyOX0.a7aZsKPzKfK0UxuzP4Ihg7cR5tiR_1UrX4PTo08Ik90';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
