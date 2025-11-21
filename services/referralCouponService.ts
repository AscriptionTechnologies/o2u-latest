import { supabase } from '~/utils/supabase';

const sanitizeUserIdForCode = (userId: string, takeFromEnd = false) => {
  const sanitized = (userId || '').replace(/-/g, '').toUpperCase();
  return takeFromEnd ? sanitized.slice(-8) : sanitized.slice(0, 8);
};

const buildTimestampSuffix = () => Date.now().toString().slice(-4);

const REFERRAL_METADATA_PREFIX = 'REFERRALS:';

const buildReferralRewardDescription = (referralCount: number, maxDiscount: number) => {
  const peopleLabel = referralCount === 1 ? 'person' : 'people';
  const summary = `You have referred ${referralCount} ${peopleLabel}. Redeem 10% of your cart value (up to ₹${maxDiscount})`;
  return `${summary}|${REFERRAL_METADATA_PREFIX}${referralCount}:MAX:${maxDiscount}`;
};

const parseReferralRewardMetadata = (description?: string | null) => {
  if (!description) return { referralCount: 0, maxDiscount: 0 };
  const parts = description.split('|');
  const metaPart = parts.find((part) => part.startsWith(REFERRAL_METADATA_PREFIX));
  if (!metaPart) return { referralCount: 0, maxDiscount: 0 };
  const [referralSection, maxSection] = metaPart.split(':MAX:');
  const referralCount = Number(referralSection.replace(REFERRAL_METADATA_PREFIX, '')) || 0;
  const maxDiscount = Number(maxSection) || 0;
  return { referralCount, maxDiscount };
};

const getReferralRewardCode = (userId: string) => `REFREWARD${(userId || '').slice(-8).toUpperCase()}`;

export const ensureNewUserReferralCoupon = async (userId: string) => {
  if (!userId) {
    throw new Error('User ID is required to create referral coupon');
  }

  // Check if a new-user coupon already exists
  const { data: existingCoupon, error: existingError } = await supabase
    .from('coupons')
    .select('id, code')
    .eq('created_by', userId)
    .eq('is_active', true)
    .like('code', 'NEWUSER%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    throw existingError;
  }

  if (existingCoupon) {
    return existingCoupon;
  }

  const code = `NEWUSER${sanitizeUserIdForCode(userId)}${buildTimestampSuffix()}`;

  const { data, error } = await supabase
    .from('coupons')
    .insert({
      code,
      description: 'Welcome gift — ₹100 off your first order',
      discount_type: 'fixed',
      discount_value: 100,
      max_uses: 1,
      per_user_limit: 1,
      min_order_value: 0,
      is_active: true,
      created_by: userId,
    })
    .select('id, code')
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const ensureReferrerRewardCoupon = async (referrerId?: string | null) => {
  if (!referrerId) {
    return null;
  }

  const referralRewardCode = getReferralRewardCode(referrerId);

  const { data: existingCoupon, error: existingError } = await supabase
    .from('coupons')
    .select('id, description, max_discount_value')
    .eq('code', referralRewardCode)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    throw existingError;
  }

  const currentMetadata = parseReferralRewardMetadata(existingCoupon?.description);
  const newReferralCount = currentMetadata.referralCount + 1;
  const maxDiscount = newReferralCount * 100;
  const description = buildReferralRewardDescription(newReferralCount, maxDiscount);

  if (existingCoupon) {
    await supabase
      .from('coupons')
      .update({
        description,
        discount_type: 'percentage',
        discount_value: 10,
        max_discount_value: maxDiscount,
        max_uses: null,
        per_user_limit: null,
        min_order_value: 0,
        is_active: true,
      })
      .eq('id', existingCoupon.id);

    return {
      id: existingCoupon.id,
      code: referralRewardCode,
      referralCount: newReferralCount,
      maxDiscount,
    };
  }

  const { data, error } = await supabase
    .from('coupons')
    .insert({
      code: referralRewardCode,
      description,
      discount_type: 'percentage',
      discount_value: 10,
      max_discount_value: maxDiscount,
      max_uses: null,
      per_user_limit: null,
      min_order_value: 0,
      is_active: true,
      created_by: referrerId,
    })
    .select('id, code')
    .single();

  if (error) {
    throw error;
  }

  return {
    ...data,
    referralCount: newReferralCount,
    maxDiscount,
  };
};

