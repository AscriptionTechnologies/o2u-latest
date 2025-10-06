import { supabase } from './supabase';

/**
 * Test Supabase connection and database schema
 */
export const testSupabaseConnection = async () => {
  console.log('🧪 Testing Supabase connection...');
  
  try {
    // Test 1: Check if we can connect to Supabase
    const { data: healthCheck, error: healthError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (healthError) {
      console.error('❌ Supabase connection failed:', healthError);
      return { success: false, error: healthError };
    }
    
    console.log('✅ Supabase connection successful');
    
    // Test 2: Check users table schema
    const { data: schemaData, error: schemaError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (schemaError) {
      console.error('❌ Users table schema check failed:', schemaError);
      return { success: false, error: schemaError };
    }
    
    console.log('✅ Users table accessible');
    console.log('📋 Sample schema (if data exists):', schemaData);
    
    // Test 3: Check auth
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error('❌ Auth check failed:', authError);
    } else {
      console.log('✅ Auth system accessible');
      console.log('👤 Current session:', authData.session ? 'Active' : 'None');
    }
    
    return { success: true, data: { healthCheck, schemaData, authData } };
    
  } catch (error) {
    console.error('❌ Supabase test failed with exception:', error);
    return { success: false, error };
  }
};

/**
 * Test user creation with minimal data
 */
export const testUserCreation = async (testEmail: string = 'test@example.com') => {
  console.log('🧪 Testing user creation process...');
  
  try {
    // Test auth signup
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!'
    });
    
    if (authError) {
      console.error('❌ Auth signup test failed:', authError);
      return { success: false, step: 'auth', error: authError };
    }
    
    console.log('✅ Auth signup test successful');
    
    if (!authData.user) {
      console.error('❌ No user returned from auth signup');
      return { success: false, step: 'auth', error: 'No user returned' };
    }
    
    // Test user profile creation
    const testUserObject = {
      id: authData.user.id,
      email: testEmail,
      name: 'Test User',
      role: 'owner',
      location: 'Test Location',
      bio: '',
      phone: '+1234567890',
      profilePhoto: null,
      created_at: new Date().toISOString(),
      payment_method: '',
      latitude: 40,
      longitude: 40,
      search_radius: 10,
    };
    
    const { error: profileError } = await supabase
      .from('users')
      .insert(testUserObject);
    
    if (profileError) {
      console.error('❌ Profile creation test failed:', profileError);
      return { success: false, step: 'profile', error: profileError };
    }
    
    console.log('✅ Profile creation test successful');
    
    // Cleanup: Delete test user profile
    await supabase.from('users').delete().eq('id', authData.user.id);
    console.log('🧹 Test data cleaned up');
    
    return { success: true, data: { authData, testUserObject } };
    
  } catch (error) {
    console.error('❌ User creation test failed with exception:', error);
    return { success: false, step: 'exception', error };
  }
};

/**
 * Analyze common registration errors
 */
export const analyzeRegistrationError = (error: any) => {
  console.log('🔍 Analyzing registration error...');
  
  const analysis = {
    errorType: 'unknown',
    possibleCauses: [] as string[],
    suggestions: [] as string[]
  };
  
  if (error.message?.includes('duplicate key')) {
    analysis.errorType = 'duplicate';
    analysis.possibleCauses.push('User already exists in database');
    analysis.suggestions.push('Check if user is already registered');
    analysis.suggestions.push('Implement proper duplicate handling');
  }
  
  if (error.message?.includes('column') && error.message?.includes('does not exist')) {
    analysis.errorType = 'schema_mismatch';
    analysis.possibleCauses.push('Database schema mismatch');
    analysis.possibleCauses.push('Missing columns in users table');
    analysis.suggestions.push('Check database schema');
    analysis.suggestions.push('Update table structure or user object');
  }
  
  if (error.message?.includes('permission') || error.message?.includes('RLS')) {
    analysis.errorType = 'permissions';
    analysis.possibleCauses.push('Row Level Security (RLS) blocking insert');
    analysis.possibleCauses.push('Insufficient permissions');
    analysis.suggestions.push('Check RLS policies');
    analysis.suggestions.push('Verify user permissions');
  }
  
  if (error.message?.includes('null value') || error.message?.includes('NOT NULL')) {
    analysis.errorType = 'null_constraint';
    analysis.possibleCauses.push('Required field is null');
    analysis.possibleCauses.push('Missing required data');
    analysis.suggestions.push('Check for null values in user object');
    analysis.suggestions.push('Ensure all required fields are provided');
  }
  
  if (error.message?.includes('foreign key') || error.message?.includes('violates')) {
    analysis.errorType = 'constraint_violation';
    analysis.possibleCauses.push('Foreign key constraint violation');
    analysis.possibleCauses.push('Invalid reference data');
    analysis.suggestions.push('Check foreign key relationships');
    analysis.suggestions.push('Verify referenced data exists');
  }
  
  console.log('📊 Error analysis:', analysis);
  return analysis;
};

/**
 * Get detailed error information for debugging
 */
export const getDetailedErrorInfo = (error: any) => {
  return {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    stack: error.stack,
    name: error.name,
    cause: error.cause,
    // Supabase specific
    statusCode: error.statusCode,
    statusText: error.statusText,
  };
};
