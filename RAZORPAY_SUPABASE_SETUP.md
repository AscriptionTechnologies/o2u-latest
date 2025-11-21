# Razorpay Integration with Supabase Edge Functions

This guide explains how to set up Razorpay payment gateway using Supabase Edge Functions.

## Prerequisites

1. **Razorpay Account**: Sign up at https://razorpay.com/
2. **Get API Keys**: From Razorpay Dashboard → Settings → API Keys
   - Key ID (starts with `rzp_`)
   - Key Secret (keep this secret!)

## Setup Steps

### Step 1: Install Razorpay React Native SDK

```bash
npm install react-native-razorpay
```

### Step 2: Configure Razorpay Key ID (Client-Side)

1. Open `services/razorpayService.ts`
2. Replace `YOUR_RAZORPAY_KEY_ID` with your actual Razorpay Key ID:

```typescript
const RAZORPAY_KEY_ID: string = 'rzp_test_xxxxxxxxxxxxx'; // Test key
// or
const RAZORPAY_KEY_ID: string = 'rzp_live_xxxxxxxxxxxxx'; // Live key
```

### Step 3: Set Razorpay Secrets in Supabase (Backend)

You need to set the Razorpay credentials as secrets in Supabase Edge Functions:

#### Option A: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **Secrets**
3. Add the following secrets:
   - `RAZORPAY_KEY_ID` = Your Razorpay Key ID (e.g., `rzp_test_xxxxxxxxxxxxx`)
   - `RAZORPAY_KEY_SECRET` = Your Razorpay Key Secret

#### Option B: Using Supabase CLI

```bash
# Set Razorpay Key ID
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx

# Set Razorpay Key Secret
supabase secrets set RAZORPAY_KEY_SECRET=your_key_secret_here
```

### Step 4: Deploy Edge Functions

Deploy the new Edge Functions to Supabase:

```bash
# Deploy create-razorpay-order function
supabase functions deploy create-razorpay-order

# Deploy verify-razorpay-payment function
supabase functions deploy verify-razorpay-payment
```

Or deploy all functions:

```bash
supabase functions deploy
```

### Step 5: Test the Integration

1. Add items to cart
2. Select "Online Payment" method
3. Place order
4. Complete payment in Razorpay checkout
5. Verify order is created with payment status "paid"

## How It Works

### Flow:

1. **User places order** → Cart screen calls `RazorpayService.processPayment()`
2. **Create Razorpay Order** → Calls Supabase Edge Function `create-razorpay-order`
   - Edge function creates order via Razorpay REST API
   - Returns order ID
3. **Open Razorpay Checkout** → Uses Razorpay React Native SDK
   - Shows payment options (Cards, UPI, Wallets)
   - User completes payment
4. **Verify Payment** → Calls Supabase Edge Function `verify-razorpay-payment`
   - Verifies payment signature using HMAC-SHA256
   - Ensures payment is legitimate
5. **Create Order** → Order created in database with payment status "paid"

## Security

- ✅ **Key Secret Never Exposed**: Razorpay Key Secret is only stored in Supabase Edge Function secrets
- ✅ **Payment Verification**: All payments are verified server-side using HMAC signature
- ✅ **Order Creation**: Razorpay orders are created server-side to prevent tampering

## Edge Functions Created

### 1. `create-razorpay-order`
- **Endpoint**: `POST /functions/v1/create-razorpay-order`
- **Purpose**: Creates a Razorpay order
- **Input**: `{ amount: number, currency: string }`
- **Output**: `{ order_id: string, id: string, amount: number, ... }`

### 2. `verify-razorpay-payment`
- **Endpoint**: `POST /functions/v1/verify-razorpay-payment`
- **Purpose**: Verifies payment signature
- **Input**: `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`
- **Output**: `{ verified: boolean }`

## Troubleshooting

### Error: "Razorpay credentials not configured"
- Make sure you've set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Supabase Edge Function secrets
- Redeploy the Edge Functions after setting secrets

### Error: "Failed to create Razorpay order"
- Check Razorpay credentials are correct
- Verify Razorpay account is active
- Check Edge Function logs in Supabase dashboard

### Error: "Payment verification failed"
- This means the payment signature doesn't match (potential fraud)
- Payment will be rejected even if Razorpay shows it as successful

### Edge Function not found
- Make sure you've deployed the functions: `supabase functions deploy`
- Check function names match in `config.toml` and actual folder names

## Testing

### Test Cards (Test Mode)

Use these test cards in Razorpay test mode:
- **Success**: `4111 1111 1111 1111`
- **Failure**: `4000 0000 0000 0002`
- **CVV**: Any 3 digits
- **Expiry**: Any future date
- **Name**: Any name

### Test UPI IDs
- `success@razorpay`
- `failure@razorpay`

## Production Checklist

- [ ] Switch to live Razorpay keys
- [ ] Set production secrets in Supabase
- [ ] Deploy Edge Functions to production
- [ ] Test end-to-end payment flow
- [ ] Set up webhooks for payment status updates (optional)
- [ ] Monitor Edge Function logs
- [ ] Set up error alerting

## Additional Resources

- Razorpay React Native Docs: https://razorpay.com/docs/payments/payment-gateway/react-native-integration/
- Razorpay API Docs: https://razorpay.com/docs/api/
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Test Cards: https://razorpay.com/docs/payments/test-cards/

