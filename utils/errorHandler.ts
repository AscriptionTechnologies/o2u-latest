import Toast from 'react-native-toast-message';

export interface ErrorInfo {
  title: string;
  message: string;
  type: 'network' | 'duplicate' | 'validation' | 'timeout' | 'rate_limit' | 'auth' | 'generic';
}

/**
 * Enhanced error handling function for Supabase and network errors
 * @param error - The error object from Supabase or network request
 * @param context - Context where the error occurred (for logging)
 * @returns ErrorInfo object with title, message, and type
 */
export const handleSupabaseError = (error: any, context: string): ErrorInfo => {
  console.error(`${context} error:`, error);
  
  // Network/Connection errors - comprehensive detection
  if (error.message?.includes('fetch') || 
      error.message?.includes('network') || 
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('NetworkError') ||
      error.message?.includes('ERR_NETWORK') ||
      error.message?.includes('ERR_INTERNET_DISCONNECTED') ||
      error.message?.includes('No network connection') ||
      error.message?.includes('Connection failed') ||
      error.message?.includes('Unable to resolve host') ||
      error.message?.includes('ENOTFOUND') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ETIMEDOUT') ||
      error.code === 'NETWORK_ERROR' ||
      error.code === 'FETCH_ERROR' ||
      error.name === 'NetworkError' ||
      !navigator.onLine) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to our servers. Please check your internet connection and try again.',
      type: 'network'
    };
  }
  
  // Supabase specific errors
  if (error.message?.includes('already registered') || 
      error.message?.includes('User already registered') ||
      error.message?.includes('duplicate key')) {
    return {
      title: 'Email Already Registered',
      message: 'This email is already registered. Please try logging in instead.',
      type: 'duplicate'
    };
  }
  
  if (error.message?.includes('Invalid email') || 
      error.message?.includes('email') && error.message?.includes('invalid')) {
    return {
      title: 'Invalid Email',
      message: 'Please enter a valid email address.',
      type: 'validation'
    };
  }
  
  if (error.message?.includes('Password') || 
      error.message?.includes('password') && error.message?.includes('weak')) {
    return {
      title: 'Password Error',
      message: 'Password must be at least 6 characters long with a mix of letters and numbers.',
      type: 'validation'
    };
  }
  
  if (error.message?.includes('timeout') || 
      error.message?.includes('TIMEOUT') ||
      error.code === 'TIMEOUT') {
    return {
      title: 'Request Timeout',
      message: 'The request took too long. Please try again.',
      type: 'timeout'
    };
  }
  
  if (error.message?.includes('rate limit') || 
      error.message?.includes('Too many requests') ||
      error.message?.includes('429')) {
    return {
      title: 'Too Many Attempts',
      message: 'Please wait a moment before trying again.',
      type: 'rate_limit'
    };
  }
  
  // Database/Server errors
  if (error.code === 'PGRST116' || 
      error.message?.includes('JWT') ||
      error.message?.includes('invalid_token')) {
    return {
      title: 'Authentication Error',
      message: 'Session expired. Please try again.',
      type: 'auth'
    };
  }
  
  // Server errors
  if (error.message?.includes('500') || 
      error.message?.includes('Internal Server Error')) {
    return {
      title: 'Server Error',
      message: 'Our servers are experiencing issues. Please try again in a few moments.',
      type: 'generic'
    };
  }
  
  // Generic fallback
  return {
    title: 'Operation Failed',
    message: error.message || 'An unexpected error occurred. Please try again.',
    type: 'generic'
  };
};

/**
 * Show error toast with enhanced error handling
 * @param error - The error object
 * @param context - Context where the error occurred
 * @param customMessage - Optional custom message to override default
 */
export const showErrorToast = (error: any, context: string, customMessage?: string) => {
  const errorInfo = handleSupabaseError(error, context);
  
  Toast.show({
    type: 'error',
    text1: errorInfo.title,
    text2: customMessage || errorInfo.message,
  });
  
  return errorInfo;
};

/**
 * Show success toast with consistent styling
 * @param title - Success title
 * @param message - Success message
 */
export const showSuccessToast = (title: string, message: string) => {
  Toast.show({
    type: 'success',
    text1: title,
    text2: message,
  });
};

/**
 * Check if error is network-related
 * @param error - The error object
 * @returns boolean indicating if it's a network error
 */
export const isNetworkError = (error: any): boolean => {
  const errorInfo = handleSupabaseError(error, 'Network check');
  return errorInfo.type === 'network';
};

/**
 * Check network connectivity
 * @returns boolean indicating if online
 */
export const isOnline = (): boolean => {
  return navigator.onLine;
};

/**
 * Validate email format
 * @param email - Email string to validate
 * @returns boolean indicating if email is valid
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Validate password strength
 * @param password - Password string to validate
 * @returns object with isValid boolean and message string
 */
export const validatePassword = (password: string): { isValid: boolean; message: string } => {
  if (password.length < 6) {
    return {
      isValid: false,
      message: 'Password must be at least 6 characters long.'
    };
  }
  
  return {
    isValid: true,
    message: 'Password is strong.'
  };
};
