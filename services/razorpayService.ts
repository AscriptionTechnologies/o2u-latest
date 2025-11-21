/**
 * Razorpay Payment Gateway Service
 * 
 * NOTE: This requires react-native-razorpay package and may need Expo Dev Client
 * Install: npm install react-native-razorpay
 * 
 * Backend: Uses Supabase Edge Functions
 * - create-razorpay-order: Creates Razorpay orders
 * - verify-razorpay-payment: Verifies payment signatures
 * 
 * Configuration:
 * - Replace RAZORPAY_KEY_ID with your Razorpay Key ID from dashboard
 * - Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Supabase Edge Function secrets
 * - Deploy Edge Functions: supabase functions deploy
 */

// Try to import Razorpay SDK at module level first
let RazorpayCheckout: any = null;
let isRazorpayAvailable = false;
let razorpayImportError: string | null = null;

// Function to load Razorpay SDK
function loadRazorpaySDK() {
  if (RazorpayCheckout && isRazorpayAvailable) {
    return RazorpayCheckout; // Already loaded and available
  }

  try {
    // Try different import patterns for react-native-razorpay
    const razorpayModule = require('react-native-razorpay');
    
    console.log('[Razorpay] Module loaded:', {
      hasModule: !!razorpayModule,
      moduleType: typeof razorpayModule,
      isNull: razorpayModule === null,
      isUndefined: razorpayModule === undefined,
      keys: razorpayModule ? Object.keys(razorpayModule) : [],
    });

    if (!razorpayModule) {
      throw new Error('Razorpay module is null or undefined');
    }
    
    // Check various export patterns
    // Pattern 1: Direct export with open method
    if (typeof razorpayModule.open === 'function') {
      RazorpayCheckout = razorpayModule;
      isRazorpayAvailable = true;
      razorpayImportError = null;
      console.log('[Razorpay] ✅ SDK loaded successfully (direct export)');
      return RazorpayCheckout;
    }
    
    // Pattern 2: Default export
    if (razorpayModule.default) {
      if (typeof razorpayModule.default.open === 'function') {
        RazorpayCheckout = razorpayModule.default;
        isRazorpayAvailable = true;
        razorpayImportError = null;
        console.log('[Razorpay] ✅ SDK loaded successfully (default export)');
        return RazorpayCheckout;
      }
      // Sometimes default is an object with the actual SDK
      if (razorpayModule.default.default && typeof razorpayModule.default.default.open === 'function') {
        RazorpayCheckout = razorpayModule.default.default;
        isRazorpayAvailable = true;
        razorpayImportError = null;
        console.log('[Razorpay] ✅ SDK loaded successfully (default.default export)');
        return RazorpayCheckout;
      }
    }
    
    // Pattern 3: Named export RazorpayCheckout
    if (razorpayModule.RazorpayCheckout && typeof razorpayModule.RazorpayCheckout.open === 'function') {
      RazorpayCheckout = razorpayModule.RazorpayCheckout;
      isRazorpayAvailable = true;
      razorpayImportError = null;
      console.log('[Razorpay] ✅ SDK loaded successfully (named export)');
      return RazorpayCheckout;
    }

    // Pattern 4: Try to find any object with open method
    const moduleKeys = Object.keys(razorpayModule);
    console.log('[Razorpay] 🔍 Searching module keys:', moduleKeys);
    
    for (const key of moduleKeys) {
      const value = razorpayModule[key];
      if (value && typeof value === 'object' && typeof value.open === 'function') {
        RazorpayCheckout = value;
        isRazorpayAvailable = true;
        razorpayImportError = null;
        console.log('[Razorpay] ✅ SDK loaded successfully (found as key:', key, ')');
        return RazorpayCheckout;
      }
    }

    // If we get here, SDK was loaded but open method not found
    razorpayImportError = 'SDK module loaded but open method not found. Module structure: ' + JSON.stringify(moduleKeys);
    console.error('[Razorpay] ❌ SDK loaded but open method not found');
    console.error('[Razorpay] Module structure:', Object.keys(razorpayModule).reduce((acc, key) => {
      const value = razorpayModule[key];
      acc[key] = {
        type: typeof value,
        hasOpen: value && typeof value === 'object' ? typeof value.open : 'N/A',
        isNull: value === null,
        isUndefined: value === undefined,
      };
      return acc;
    }, {} as any));
    
  } catch (error: any) {
    razorpayImportError = error?.message || String(error);
    console.error('[Razorpay] ❌ Failed to load react-native-razorpay');
    console.error('[Razorpay] Error:', razorpayImportError);
    console.error('[Razorpay] Error stack:', error?.stack);
    isRazorpayAvailable = false;
    RazorpayCheckout = null;
  }

  return RazorpayCheckout;
}

// Try to load SDK immediately when module is loaded
try {
  loadRazorpaySDK();
} catch (error) {
  console.warn('[Razorpay] Failed to preload SDK:', error);
}

// Razorpay configuration - Replace with your actual Key ID
const RAZORPAY_KEY_ID: string = 'rzp_test_RiHGHb2fqfFhEd'; // Get this from Razorpay Dashboard

interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  created_at: number;
}

interface RazorpayPaymentOptions {
  amount: number; // Amount in paise (e.g., 10000 for ₹100)
  currency: string;
  order_id?: string;
  description: string;
  name: string;
  email?: string;
  contact?: string;
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
  theme?: {
    color: string;
  };
}

interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export class RazorpayService {
  /**
   * Initialize Razorpay with key ID
   */
  static initialize(keyId: string): void {
    // Razorpay is initialized via the checkout method
    // This method is kept for future initialization if needed
  }

  /**
   * Create a Razorpay order via Supabase Edge Function
   */
  static async createOrder(amount: number, currency: string = 'INR'): Promise<string> {
    try {
      // Import Supabase URL - using dynamic import to avoid circular dependencies
      const supabaseModule = await import('~/utils/supabase');
      const SUPABASE_URL = supabaseModule.SUPABASE_URL;
      const SUPABASE_ANON_KEY = supabaseModule.SUPABASE_ANON_KEY;
      
      console.log('[Razorpay] Creating order via Supabase Edge Function:', {
        amount: amount * 100,
        currency,
        url: `${SUPABASE_URL}/functions/v1/create-razorpay-order`,
      });

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/create-razorpay-order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            amount: amount * 100, // Convert to paise
            currency: currency,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('[Razorpay] Order creation failed:', data);
        throw new Error(data.error || data.message || data.details || 'Failed to create Razorpay order');
      }

      console.log('[Razorpay] Order created successfully:', data);
      return data.order_id || data.id;
    } catch (error: any) {
      console.error('[Razorpay] Error creating order:', error);
      if (error.message) {
        throw error;
      }
      throw new Error('Failed to create Razorpay order: ' + (error?.toString() || 'Unknown error'));
    }
  }

  /**
   * Verify Razorpay payment signature via Supabase Edge Function
   */
  static async verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): Promise<boolean> {
    try {
      // Import Supabase URL - using require to avoid circular dependencies
      const { SUPABASE_URL, SUPABASE_ANON_KEY } = require('~/utils/supabase');
      
      console.log('[Razorpay] Verifying payment via Supabase Edge Function:', {
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature ? 'provided' : 'missing',
      });

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/verify-razorpay-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: razorpayPaymentId,
            razorpay_signature: razorpaySignature,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('[Razorpay] Payment verification failed:', data);
        return false;
      }

      const isVerified = data.verified === true;
      console.log('[Razorpay] Payment verification result:', isVerified);
      return isVerified;
    } catch (error) {
      console.error('[Razorpay] Error verifying payment:', error);
      return false;
    }
  }

  /**
   * Open Razorpay checkout and process payment
   */
  static async openCheckout(options: RazorpayPaymentOptions): Promise<RazorpayPaymentResponse> {
    // Try to load SDK if not already loaded
    const checkout = loadRazorpaySDK();

    console.log('[Razorpay] Opening checkout with options:', {
      amount: options.amount,
      currency: options.currency,
      description: options.description,
      keyId: RAZORPAY_KEY_ID ? `${RAZORPAY_KEY_ID.substring(0, 8)}...` : 'NOT SET',
      isRazorpayAvailable,
      hasCheckout: !!checkout,
    });

    if (!checkout || !isRazorpayAvailable) {
      const errorMsg = razorpayImportError || 'SDK not properly initialized';
      console.error('[Razorpay] SDK not available:', errorMsg);
      console.error('[Razorpay] Please ensure:');
      console.error('[Razorpay] 1. Package is installed: npm install react-native-razorpay');
      console.error('[Razorpay] 2. For Expo: Rebuild with: npx expo run:android or npx expo run:ios');
      console.error('[Razorpay] 3. For bare RN: Run: cd ios && pod install && cd ..');
      console.error('[Razorpay] 4. Rebuild the app completely (not just reload)');
      console.error('[Razorpay] 5. Make sure you are using Expo Dev Client, not Expo Go');
      throw new Error(
        'Razorpay SDK not available: ' + errorMsg + '\n\n' +
        'Solutions:\n' +
        '1. Install: npm install react-native-razorpay\n' +
        '2. For Expo: Rebuild with: npx expo run:android or npx expo run:ios\n' +
        '3. For bare React Native: cd ios && pod install && cd ..\n' +
        '4. Fully rebuild the app (not just reload)\n' +
        '5. Make sure you are using Expo Dev Client, not Expo Go'
      );
    }

    if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID === 'YOUR_RAZORPAY_KEY_ID') {
      console.error('[Razorpay] Key ID not configured');
      console.error('[Razorpay] Please set your Razorpay Key ID in services/razorpayService.ts');
      throw new Error(
        'Razorpay Key ID not configured.\n' +
        'Please set your Razorpay Key ID in services/razorpayService.ts\n' +
        'Get your Key ID from: https://dashboard.razorpay.com/app/keys'
      );
    }

    return new Promise((resolve, reject) => {
      const paymentOptions = {
        description: options.description,
        image: 'https://your-logo-url.com/logo.png', // Your app logo URL
        currency: options.currency || 'INR',
        key: RAZORPAY_KEY_ID,
        amount: options.amount, // Amount in paise
        name: options.name || 'Only2U',
        order_id: options.order_id, // Optional: if you have order_id from backend
        prefill: {
          email: options.prefill?.email || options.email,
          contact: options.prefill?.contact || options.contact,
          name: options.prefill?.name || options.name,
        },
        theme: options.theme || {
          color: '#F53F7A', // Only2U brand color
        },
      };

      console.log('[Razorpay] Attempting to open checkout...');
      
      try {
        // Validate that checkout.open is a function
        if (!checkout || typeof checkout.open !== 'function') {
          console.error('[Razorpay] checkout.open is not a function');
          console.error('[Razorpay] checkout object:', checkout);
          console.error('[Razorpay] checkout type:', typeof checkout);
          console.error('[Razorpay] checkout keys:', checkout ? Object.keys(checkout) : 'null');
          reject(new Error('Razorpay SDK not properly initialized. Please rebuild the app after installing react-native-razorpay.'));
          return;
        }

        console.log('[Razorpay] Calling checkout.open with options:', {
          ...paymentOptions,
          key: RAZORPAY_KEY_ID ? `${RAZORPAY_KEY_ID.substring(0, 10)}...` : 'NOT SET',
        });

        checkout.open(paymentOptions)
          .then((data: RazorpayPaymentResponse) => {
            console.log('[Razorpay] Payment successful:', {
              paymentId: data.razorpay_payment_id,
              orderId: data.razorpay_order_id,
            });
            resolve(data);
          })
          .catch((error: any) => {
            console.error('[Razorpay] Payment error details:', {
              error,
              errorType: typeof error,
              errorString: String(error),
              code: error?.code,
              description: error?.description,
              message: error?.message,
              fullError: JSON.stringify(error, null, 2),
            });

            // Handle payment failure
            if (error?.code === 'BAD_REQUEST_ERROR') {
              reject(new Error('Invalid payment details. Please check your Razorpay configuration and Key ID.'));
            } else if (error?.code === 'NETWORK_ERROR') {
              reject(new Error('Network error. Please check your internet connection.'));
            } else if (error?.code === 'SERVER_ERROR') {
              reject(new Error('Server error. Please try again later.'));
            } else if (error?.description) {
              reject(new Error(error.description));
            } else if (error?.message) {
              reject(new Error(error.message));
            } else if (error?.toString && error.toString() !== '[object Object]') {
              reject(new Error(error.toString()));
            } else {
              // Provide more helpful error message
              const errorStr = error ? JSON.stringify(error) : 'Unknown error';
              reject(new Error(`Payment failed. ${errorStr}. Please check if Razorpay SDK is installed and Key ID is configured.`));
            }
          });
      } catch (error: any) {
        console.error('[Razorpay] Exception opening checkout:', error);
        console.error('[Razorpay] Exception type:', typeof error);
        console.error('[Razorpay] Exception string:', String(error));
        reject(new Error('Failed to open payment gateway: ' + (error?.message || error?.toString() || 'Unknown error') + '. Please check if react-native-razorpay is installed.'));
      }
    });
  }

  /**
   * Process payment with Razorpay
   * This is the main method to be called from cart screen
   */
  static async processPayment(
    amount: number,
    description: string,
    userDetails: {
      name: string;
      email?: string;
      contact?: string;
    }
  ): Promise<{ paymentId: string; orderId?: string; signature?: string }> {
    try {
      console.log('[Razorpay] Processing payment:', {
        amount,
        description,
        userDetails,
      });

      // Validate amount
      if (!amount || amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      // Validate minimum amount (Razorpay requires minimum ₹1)
      if (amount < 1) {
        throw new Error('Minimum payment amount is ₹1');
      }

      // Step 1: Create Razorpay order first (recommended for better tracking)
      let orderId: string | undefined;
      try {
        orderId = await this.createOrder(amount);
        console.log('[Razorpay] Order created:', orderId);
      } catch (orderError: any) {
        console.error('[Razorpay] Failed to create order:', orderError);
        // If order creation fails, we can still proceed without order_id
        // Razorpay will create an order automatically
        console.warn('[Razorpay] Proceeding without order_id - Razorpay will create order automatically');
      }
      
      // Step 2: Open Razorpay checkout with order ID (if available)
      const amountInPaise = Math.round(amount * 100);
      console.log('[Razorpay] Opening checkout with amount:', amountInPaise, 'paise (₹' + amount + ')', orderId ? `orderId: ${orderId}` : 'no orderId');
      
      const paymentResponse = await this.openCheckout({
        amount: amountInPaise, // Convert to paise
        currency: 'INR',
        description: description,
        name: userDetails.name,
        email: userDetails.email,
        contact: userDetails.contact,
        order_id: orderId, // Use order ID from backend if available
        prefill: {
          email: userDetails.email,
          contact: userDetails.contact,
          name: userDetails.name,
        },
      });

      console.log('[Razorpay] Payment response received:', paymentResponse);

      // Step 3: Verify payment signature (required for security)
      if (paymentResponse.razorpay_signature) {
        const isVerified = await this.verifyPayment(
          paymentResponse.razorpay_order_id,
          paymentResponse.razorpay_payment_id,
          paymentResponse.razorpay_signature
        );

        if (!isVerified) {
          console.error('[Razorpay] Payment verification failed - payment may be fraudulent');
          throw new Error('Payment verification failed. Please contact support if you completed the payment.');
        }

        console.log('[Razorpay] Payment verified successfully');
      } else {
        console.warn('[Razorpay] No signature in payment response - skipping verification');
      }

      return {
        paymentId: paymentResponse.razorpay_payment_id,
        orderId: paymentResponse.razorpay_order_id,
        signature: paymentResponse.razorpay_signature,
      };
    } catch (error: any) {
      console.error('[Razorpay] Payment processing error:', {
        error,
        message: error?.message,
        stack: error?.stack,
      });
      throw error;
    }
  }
}

export default RazorpayService;

