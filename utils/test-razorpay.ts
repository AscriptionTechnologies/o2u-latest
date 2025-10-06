// Test script to verify Razorpay integration
import { isRazorpaySupported, getRazorpayKeyId } from './razorpay';

export const testRazorpayIntegration = () => {
  console.log('=== Razorpay Integration Test ===');
  
  // Test 1: Check if Razorpay is supported
  const isSupported = isRazorpaySupported();
  console.log('✓ Razorpay supported:', isSupported);
  
  // Test 2: Check key ID
  const keyId = getRazorpayKeyId();
  console.log('✓ Razorpay Key ID:', keyId);
  
  // Test 3: Check if key is production
  const isProduction = keyId.startsWith('rzp_live_');
  console.log('✓ Production key:', isProduction);
  
  if (!isSupported) {
    console.log('❌ Razorpay module not available - will fallback to COD');
  } else if (!isProduction) {
    console.log('⚠️  Using test key - replace with production key for live payments');
  } else {
    console.log('✅ Razorpay integration ready for production');
  }
  
  return {
    supported: isSupported,
    keyId,
    isProduction
  };
};
