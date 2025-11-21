// Settings utility for managing app configuration
import { supabase } from './supabase';

export interface Setting {
  id: string;
  key: string;
  value: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const getSetting = async (key: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .eq('is_active', true)
      .single();
    
    if (error) {
      console.log(`Error fetching setting ${key}:`, error.message);
      return null;
    }
    
    return data?.value || null;
  } catch (error) {
    console.log(`Error in getSetting for ${key}:`, error);
    return null;
  }
};

export const setSetting = async (key: string, value: string, description?: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('settings')
      .upsert({
        key,
        value,
        description,
        is_active: true,
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.log(`Error setting ${key}:`, error.message);
      return false;
    }
    
    return true;
  } catch (error) {
    console.log(`Error in setSetting for ${key}:`, error);
    return false;
  }
};

export const getAllSettings = async (): Promise<Setting[]> => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('is_active', true)
      .order('key');
    
    if (error) {
      console.log('Error fetching settings:', error.message);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.log('Error in getAllSettings:', error);
    return [];
  }
};

// Google Places API Key (stored in Supabase settings table)
export const getGooglePlacesApiKey = async (): Promise<string | null> => {
  return await getSetting('google_places_api_key');
};
