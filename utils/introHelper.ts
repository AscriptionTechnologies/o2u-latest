import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const INTRO_STORAGE_KEY = 'hasSeenIntro';

/**
 * Check if user has seen the intro before
 * @returns Promise<boolean> - true if first time, false if seen before
 */
export const isFirstTimeUser = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'web') {
      const hasSeenIntro = localStorage.getItem(INTRO_STORAGE_KEY);
      return hasSeenIntro === null;
    }

    const hasSeenIntro = await AsyncStorage.getItem(INTRO_STORAGE_KEY);
    return hasSeenIntro === null;
  } catch (error) {
    console.error('Error checking first time user status:', error);
    return true;
  }
};

/**
 * Mark that user has seen the intro
 */
export const markIntroAsSeen = async (): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(INTRO_STORAGE_KEY, 'true');
    } else {
      await AsyncStorage.setItem(INTRO_STORAGE_KEY, 'true');
    }
  } catch (error) {
    console.error('Error marking intro as seen:', error);
  }
};

/**
 * Reset intro status - useful for testing
 * This will make the intro show again on next app launch
 */
export const resetIntroStatus = async (): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(INTRO_STORAGE_KEY);
    } else {
      await AsyncStorage.removeItem(INTRO_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Error resetting intro status:', error);
  }
};

/**
 * Get current intro status for debugging
 */
export const getIntroStatus = async (): Promise<string> => {
  try {
    let hasSeenIntro: string | null;

    if (Platform.OS === 'web') {
      hasSeenIntro = localStorage.getItem(INTRO_STORAGE_KEY);
    } else {
      hasSeenIntro = await AsyncStorage.getItem(INTRO_STORAGE_KEY);
    }

    return hasSeenIntro || 'not_seen';
  } catch (error) {
    console.error('Error getting intro status:', error);
    return 'error';
  }
};
