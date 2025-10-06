import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('🚀 Edge function delete-user called')
  console.log('📝 Request method:', req.method)
  console.log('📝 Request headers:', Object.fromEntries(req.headers.entries()))

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Log environment variables (without exposing sensitive data)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('🔧 Environment check:')
    console.log('  - SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
    console.log('  - SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅ Set' : '❌ Missing')

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing required environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client with service role key for admin operations
    console.log('🔧 Creating Supabase admin client...')
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    console.log('✅ Supabase admin client created')

    // Get the user ID from the request body
    console.log('📝 Parsing request body...')
    const requestBody = await req.json()
    console.log('📝 Request body:', requestBody)
    
    const { userId } = requestBody

    if (!userId) {
      console.error('❌ No userId provided in request body')
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`🗑️ Attempting to delete user from authentication: ${userId}`)

    // First, let's check if the user exists in auth
    console.log('🔍 Checking if user exists in auth...')
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
    
    if (getUserError) {
      console.error('❌ Error getting user from auth:', getUserError)
      if (getUserError.message.includes('User not found')) {
        console.log('ℹ️ User not found in auth (may have been deleted already)')
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'User not found in authentication (may have been deleted already)' 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    } else {
      console.log('✅ User found in auth:', {
        id: userData.user?.id,
        email: userData.user?.email || null,
        created_at: userData.user?.created_at
      })
    }

    // Delete user from authentication (requires admin privileges)
    console.log('🗑️ Deleting user from authentication...')
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('❌ Error deleting user from auth:', authError)
      console.error('❌ Error details:', {
        message: authError.message,
        status: authError.status,
        statusText: authError.statusText
      })
      
      // If user doesn't exist in auth, that's actually okay - they might have been deleted already
      if (authError.message.includes('User not found') || authError.message.includes('not found')) {
        console.log('ℹ️ User not found in auth (may have been deleted already)')
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'User not found in authentication (may have been deleted already)' 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete user from authentication',
          details: authError.message,
          status: authError.status
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ User successfully deleted from authentication')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User deleted successfully from authentication' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Unexpected error in edge function:', error)
    console.error('❌ Error stack:', error.stack)
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