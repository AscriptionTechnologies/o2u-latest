// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: Create Razorpay Order
// Requires env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') ?? 'rzp_test_RQ72pncjg9BRfW';
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') ?? '03TwONKD3cUGLohy0tHa8kxp';

const RAZORPAY_ORDERS_URL = 'https://api.razorpay.com/v1/orders';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await req.json();
    const { amount, currency = 'INR', receipt, notes } = body || {};

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400 });
    }

    const payload = {
      amount: Math.round(Number(amount)),
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {},
    };

    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const res = await fetch(RAZORPAY_ORDERS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data?.error || 'Order creation failed' }), { status: 500 });
    }

    return new Response(JSON.stringify({ order: data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unexpected error' }), { status: 500 });
  }
}

// Export for Supabase runtime
serve(handler);

