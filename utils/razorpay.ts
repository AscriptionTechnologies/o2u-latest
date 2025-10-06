// Razorpay utility for handling payments
import { Alert } from 'react-native';

// Dynamic Razorpay module loading with retry mechanism
const getRazorpayModule = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Razorpay = require('react-native-razorpay');
    
    console.log('Raw Razorpay module:', {
      hasDefault: !!Razorpay.default,
      hasRazorpayCheckout: !!Razorpay.RazorpayCheckout,
      hasOpen: !!Razorpay.open,
      type: typeof Razorpay,
      keys: Object.keys(Razorpay || {})
    });
    
    // Handle different export patterns
    let module = null;
    if (Razorpay.default) {
      module = Razorpay.default;
      console.log('Using Razorpay.default');
    } else if (Razorpay.RazorpayCheckout) {
      module = Razorpay.RazorpayCheckout;
      console.log('Using Razorpay.RazorpayCheckout');
    } else if (Razorpay.open) {
      module = Razorpay;
      console.log('Using Razorpay directly');
    } else {
      module = Razorpay;
      console.log('Using Razorpay as fallback');
    }
    
    console.log('Module details:', {
      module: !!module,
      hasOpen: module ? typeof module.open : 'no module',
      openType: module ? typeof module.open : 'no module'
    });
    
    // Verify the module is properly loaded
    if (module && typeof module.open === 'function') {
      console.log('Razorpay module loaded successfully');
      return module;
    } else {
      console.log('Razorpay module loaded but open method not available');
      return null;
    }
  } catch (e: any) {
    console.log('Razorpay module not available:', e.message);
    return null;
  }
};

// Check if Razorpay is supported (dynamic check)
let isRazorpayAvailable = false;
try {
  const module = getRazorpayModule();
  isRazorpayAvailable = !!module;
} catch (e) {
  isRazorpayAvailable = false;
}

export const isRazorpaySupported = () => {
  // Dynamic check at runtime
  try {
    const module = getRazorpayModule();
    return !!module;
  } catch (e) {
    return false;
  }
};

export const openRazorpayCheckout = async (options: any): Promise<any> => {
  // Try multiple times to get a working Razorpay module
  let RazorpayModule = null;
  let attempts = 0;
  const maxAttempts = 3;
  
  while (!RazorpayModule && attempts < maxAttempts) {
    attempts++;
    console.log(`Attempting to load Razorpay module (attempt ${attempts}/${maxAttempts})`);
    
    RazorpayModule = getRazorpayModule();
    
    if (!RazorpayModule) {
      console.log('Razorpay module is null, retrying...');
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  if (!RazorpayModule) {
    throw new Error('Razorpay not available - module could not be loaded after multiple attempts');
  }

  // Double-check the module has the open method
  if (typeof RazorpayModule.open !== 'function') {
    console.log('Razorpay module loaded but open method is not a function:', typeof RazorpayModule.open);
    throw new Error('Razorpay open method not available');
  }

  try {
    console.log('Opening Razorpay with options:', {
      key: options.key,
      amount: options.amount,
      currency: options.currency
    });

    // Final check before calling open
    if (!RazorpayModule || typeof RazorpayModule.open !== 'function') {
      throw new Error('Razorpay module is null or open method is not available');
    }

    // Try to call the open method with additional error handling
    let result;
    try {
      result = await RazorpayModule.open(options);
    } catch (openError: any) {
      console.error('Error calling Razorpay.open:', openError);
      
      // If the error is about null/undefined, try to reload the module
      if (openError.message?.includes('Cannot read property') || 
          openError.message?.includes('null') ||
          openError.message?.includes('undefined')) {
        
        console.log('Attempting to reload Razorpay module...');
        const reloadedModule = getRazorpayModule();
        
        if (reloadedModule && typeof reloadedModule.open === 'function') {
          console.log('Retrying with reloaded module...');
          result = await reloadedModule.open(options);
        } else {
          throw new Error('Razorpay module failed to load properly. Please try again or use Cash on Delivery.');
        }
      } else {
        throw openError;
      }
    }
    console.log('Razorpay payment successful:', result);
    return result;
  } catch (error: any) {
    console.error('Razorpay payment error:', error);
    
    // If the error is about null module, provide a more helpful message
    if (error.message?.includes('Cannot read property') || 
        error.message?.includes('null') ||
        error.message?.includes('not available')) {
      throw new Error('Razorpay module failed to load properly. Please try again or use Cash on Delivery.');
    }
    
    throw error;
  }
};

export const getRazorpayKeyId = async (): Promise<string> => {
  try {
    // Import settings utility
    const { getRazorpayKey } = await import('~/utils/settings');
    
    // Fetch Razorpay key from settings table
    const keyId = await getRazorpayKey();
    
    if (keyId) {
      console.log('Razorpay key fetched from database');
      return keyId;
    }
    
    console.log('No Razorpay key found in database, using provided test key');
    // Use requested test key
    return 'rzp_test_RQ72pncjg9BRfW';
  } catch (error) {
    console.log('Error in getRazorpayKeyId:', error);
    // Use requested test key on error
    return 'rzp_test_RQ72pncjg9BRfW';
  }
};

export const createRazorpayOptions = async (amount: number, userData: any) => {
  const keyId = await getRazorpayKeyId();
  
  return {
    description: 'Only2U Order Payment',
    image: 'https://only2u-static.s3.ap-south-1.amazonaws.com/brand/logo.png',
    currency: 'INR',
    key: keyId,
    amount: Math.round(amount * 100), // Convert to paise
    name: 'Only2U',
    theme: { color: '#F53F7A' },
    prefill: {
      email: userData?.email || 'customer@only2u.com',
      contact: userData?.phone || '',
      name: userData?.name || 'Customer',
    },
    retry: { enabled: true, max_count: 1 },
    send_sms_hash: true,
    notes: {
      order_id: `order_${Date.now()}`,
      user_id: userData?.id || 'guest'
    }
  };
};
