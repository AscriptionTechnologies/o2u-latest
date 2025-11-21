import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('🚀 Edge function verify-razorpay-payment called')
  console.log('📝 Request method:', req.method)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Razorpay credentials from environment variables
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    
    console.log('🔧 Environment check:')
    console.log('  - RAZORPAY_KEY_SECRET:', razorpayKeySecret ? '✅ Set' : '❌ Missing')

    if (!razorpayKeySecret) {
      console.error('❌ Missing Razorpay secret')
      return new Response(
        JSON.stringify({ 
          error: 'Razorpay secret not configured',
          message: 'Please set RAZORPAY_KEY_SECRET in Supabase Edge Function secrets'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const requestBody = await req.json()
    console.log('📝 Request body:', {
      razorpay_order_id: requestBody.razorpay_order_id ? 'provided' : 'missing',
      razorpay_payment_id: requestBody.razorpay_payment_id ? 'provided' : 'missing',
      razorpay_signature: requestBody.razorpay_signature ? 'provided' : 'missing',
    })
    
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = requestBody

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify payment signature
    // Signature format: HMAC-SHA256(order_id + "|" + payment_id, secret)
    const text = `${razorpay_order_id}|${razorpay_payment_id}`
    
    console.log('🔍 Verifying signature:', {
      text,
      receivedSignature: razorpay_signature,
    })

    // Create HMAC-SHA256 hash using Web Crypto API
    const encoder = new TextEncoder()
    const keyData = encoder.encode(razorpayKeySecret)
    const messageData = encoder.encode(text)
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData)
    const signatureArray = Array.from(new Uint8Array(signatureBuffer))
    const generatedSignature = signatureArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    console.log('🔍 Signature comparison:', {
      generated: generatedSignature.substring(0, 20) + '...',
      received: razorpay_signature.substring(0, 20) + '...',
      match: generatedSignature === razorpay_signature,
    })

    const isVerified = generatedSignature === razorpay_signature

    if (isVerified) {
      console.log('✅ Payment signature verified successfully')
      return new Response(
        JSON.stringify({ 
          verified: true,
          message: 'Payment signature verified'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else {
      console.error('❌ Payment signature verification failed')
      return new Response(
        JSON.stringify({ 
          verified: false,
          error: 'Payment signature verification failed',
          message: 'The payment signature does not match. This payment may be fraudulent.'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

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

