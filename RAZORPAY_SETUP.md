# Razorpay Payment Gateway Integration Guide

This guide will help you set up Razorpay payment gateway in the Only2U app.

## Prerequisites

1. **Razorpay Account**: Sign up at https://razorpay.com/
2. **Get API Keys**: From Razorpay Dashboard → Settings → API Keys
   - Key ID (starts with `rzp_`)
   - Key Secret (keep this secret, use only on backend)

## Installation

### Step 1: Install Razorpay React Native SDK

```bash
npm install react-native-razorpay
```

### Step 2: Configure for Expo

Since this is an Expo project, you have two options:

#### Option A: Use Expo Dev Client (Recommended)
```bash
npx expo install expo-dev-client
npx expo prebuild
npx expo run:android  # or run:ios
```

#### Option B: Use Razorpay Checkout Web (Alternative)
If native modules aren't available, you can use Razorpay Checkout Web:
```bash
npm install react-native-razorpay-checkout
```

### Step 3: Configure Razorpay Key

1. Open `services/razorpayService.ts`
2. Replace `YOUR_RAZORPAY_KEY_ID` with your actual Razorpay Key ID:

```typescript
const RAZORPAY_KEY_ID = 'rzp_test_xxxxxxxxxxxxx'; // Test key
// or
const RAZORPAY_KEY_ID = 'rzp_live_xxxxxxxxxxxxx'; // Live key
```

### Step 4: Backend Setup (Required for Production)

You need to create backend API endpoints for:
1. **Creating Razorpay Orders** - `POST /api/razorpay/create-order`
2. **Verifying Payment Signature** - `POST /api/razorpay/verify-payment`

#### Example Backend Endpoint (Node.js/Express):

```javascript
// Create Order
app.post('/api/razorpay/create-order', async (req, res) => {
  const Razorpay = require('razorpay');
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const { amount, currency } = req.body;
  
  const options = {
    amount: amount, // amount in paise
    currency: currency || 'INR',
    receipt: `receipt_${Date.now()}`,
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json({ order_id: order.id, id: order.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify Payment
app.post('/api/razorpay/verify-payment', async (req, res) => {
  const crypto = require('crypto');
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  
  const text = razorpay_order_id + '|' + razorpay_payment_id;
  const generated_signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(text)
    .digest('hex');

  if (generated_signature === razorpay_signature) {
    res.json({ verified: true });
  } else {
    res.status(400).json({ verified: false });
  }
});
```

### Step 5: Update Backend API URL

In `services/razorpayService.ts`, update the backend API URLs:

```typescript
// Replace these URLs with your actual backend API
const BACKEND_API_URL = 'https://your-backend-api.com';
```

Update the `createOrder` and `verifyPayment` methods to use this URL.

## Testing

1. **Test Mode**: Use test keys from Razorpay Dashboard (Test Mode)
2. **Test Cards**: Use Razorpay test cards (found in Razorpay Docs)
3. **Test Flow**: 
   - Add items to cart
   - Select "Online Payment" method
   - Place order
   - Complete payment in Razorpay checkout
   - Verify order is created with payment status "paid"

## Production Checklist

- [ ] Switch to live Razorpay keys
- [ ] Set up backend API endpoints
- [ ] Update backend API URLs in service
- [ ] Test payment flow end-to-end
- [ ] Set up webhooks for payment status updates
- [ ] Add error monitoring/logging

## Troubleshooting

### Error: "RazorpayCheckout is not a function"
- Make sure `react-native-razorpay` is installed
- Rebuild the app after installing
- Check if you're using Expo Dev Client

### Error: "Network error"
- Check internet connection
- Verify backend API is accessible
- Check Razorpay key ID is correct

### Payment succeeds but order not created
- Check order creation logic
- Verify payment ID is being saved
- Check database connection

## Additional Resources

- Razorpay React Native Docs: https://razorpay.com/docs/payments/payment-gateway/react-native-integration/
- Razorpay API Docs: https://razorpay.com/docs/api/
- Test Cards: https://razorpay.com/docs/payments/test-cards/

