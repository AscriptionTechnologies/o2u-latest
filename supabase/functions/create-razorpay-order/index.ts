import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('🚀 Edge function create-razorpay-order called')
  console.log('📝 Request method:', req.method)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Razorpay credentials from environment variables
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    
    console.log('🔧 Environment check:')
    console.log('  - RAZORPAY_KEY_ID:', razorpayKeyId ? '✅ Set' : '❌ Missing')
    console.log('  - RAZORPAY_KEY_SECRET:', razorpayKeySecret ? '✅ Set' : '❌ Missing')

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('❌ Missing Razorpay credentials')
      return new Response(
        JSON.stringify({ 
          error: 'Razorpay credentials not configured',
          message: 'Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Supabase Edge Function secrets'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const requestBody = await req.json()
    console.log('📝 Request body:', { ...requestBody, amount: requestBody.amount ? 'provided' : 'missing' })
    
    const { amount, currency = 'INR', receipt } = requestBody

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount. Amount must be greater than 0.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Razorpay order using REST API
    const orderData = {
      amount: Math.round(amount), // Amount in paise
      currency: currency,
      receipt: receipt || `receipt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    }

    console.log('🔄 Creating Razorpay order:', { ...orderData, amount: `${orderData.amount} paise` })

    // Base64 encode credentials for Basic Auth
    const credentials = btoa(`${razorpayKeyId}:${razorpayKeySecret}`)

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify(orderData),
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('❌ Razorpay API error:', responseData)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create Razorpay order',
          details: responseData.error?.description || responseData.error?.message || 'Unknown error',
          razorpayError: responseData.error
        }),
        { 
          status: response.status || 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Razorpay order created successfully:', {
      orderId: responseData.id,
      amount: responseData.amount,
      currency: responseData.currency,
    })

    return new Response(
      JSON.stringify({ 
        order_id: responseData.id,
        id: responseData.id,
        amount: responseData.amount,
        currency: responseData.currency,
        receipt: responseData.receipt,
        status: responseData.status,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Unexpected error in edge function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

