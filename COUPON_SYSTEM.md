# Coupon System Documentation

## Overview
The coupon system allows admins to create and manage promotional discount codes that users can apply during checkout.

## Database Schema

### Tables

#### `coupons`
Stores coupon information and configuration.

**Columns:**
- `id` (UUID): Primary key
- `code` (TEXT): Unique coupon code (e.g., "SAVE20")
- `description` (TEXT): Human-readable description
- `discount_type` (TEXT): Either 'percentage' or 'fixed'
- `discount_value` (NUMERIC): Percentage (e.g., 20) or fixed amount (e.g., 100)
- `max_uses` (INTEGER): Maximum total uses (NULL = unlimited)
- `uses_count` (INTEGER): Current usage count (auto-incremented)
- `per_user_limit` (INTEGER): Maximum uses per user (NULL = unlimited)
- `min_order_value` (NUMERIC): Minimum order value required (NULL = no minimum)
- `start_date` (TIMESTAMPTZ): When coupon becomes active (NULL = immediately)
- `end_date` (TIMESTAMPTZ): When coupon expires (NULL = never)
- `is_active` (BOOLEAN): Whether coupon is currently active
- `created_by` (UUID): Admin who created the coupon
- `created_at` (TIMESTAMPTZ): Creation timestamp
- `updated_at` (TIMESTAMPTZ): Last update timestamp

#### `coupon_usage`
Tracks individual coupon usage by users.

**Columns:**
- `id` (UUID): Primary key
- `coupon_id` (UUID): Reference to coupons table
- `user_id` (UUID): User who used the coupon
- `order_id` (UUID): Order where coupon was applied
- `discount_amount` (NUMERIC): Actual discount amount applied
- `used_at` (TIMESTAMPTZ): When coupon was used

## Setup Instructions

### 1. Run the SQL Migration

Execute the SQL file to create the tables:

```bash
# Connect to your Supabase database and run:
psql -h <your-db-host> -U postgres -d postgres -f sql/coupons_schema.sql
```

Or run directly in Supabase SQL Editor:
- Go to Supabase Dashboard → SQL Editor
- Open `sql/coupons_schema.sql`
- Click "Run"

### 2. Sample Coupons

The migration automatically creates 8 sample coupons:

| Code | Type | Value | Min Order | Max Uses | Per User | Description |
|------|------|-------|-----------|----------|----------|-------------|
| SAVE10 | percentage | 10% | ₹0 | Unlimited | Unlimited | 10% off on all orders |
| SAVE20 | percentage | 20% | ₹500 | Unlimited | 3 times | 20% off on orders above ₹500 |
| NEW50 | fixed | ₹50 | ₹0 | Unlimited | 1 time | Flat ₹50 off for new users |
| NEW100 | fixed | ₹100 | ₹300 | Unlimited | 1 time | Flat ₹100 off on first order |
| FIRST200 | fixed | ₹200 | ₹500 | 100 | 1 time | First order special - ₹200 off |
| FLAT300 | fixed | ₹300 | ₹1000 | Unlimited | Unlimited | Flat ₹300 off on orders above ₹1000 |
| MEGA500 | fixed | ₹500 | ₹2000 | 50 | Unlimited | Mega sale - ₹500 off on orders above ₹2000 |
| WELCOME15 | percentage | 15% | ₹200 | Unlimited | 2 times | 15% off welcome offer |

## How It Works

### User Flow

1. **Enter Coupon Code**: User types coupon code in checkout screen
2. **Validation**: System checks:
   - Coupon exists and is active
   - Within valid date range
   - Meets minimum order value
   - Not exceeded max uses
   - User hasn't exceeded per-user limit
3. **Apply Discount**: 
   - Percentage: `discount = (subtotal × percentage) / 100`
   - Fixed: `discount = min(fixed_amount, subtotal)`
4. **Complete Order**: Coupon usage is logged in `coupon_usage` table
5. **Auto Increment**: `uses_count` automatically increments via trigger

### Validation Rules

The system performs the following validations:

```typescript
// 1. Coupon exists and is active
WHERE code = 'SAVE20' AND is_active = true

// 2. Date range check
start_date <= NOW() AND (end_date IS NULL OR end_date >= NOW())

// 3. Minimum order value
min_order_value IS NULL OR subtotal >= min_order_value

// 4. Maximum uses check
max_uses IS NULL OR uses_count < max_uses

// 5. Per user limit check
COUNT(coupon_usage WHERE user_id = current_user) < per_user_limit
```

## Admin Management

### Creating a Coupon

```sql
INSERT INTO coupons (
  code, 
  description, 
  discount_type, 
  discount_value, 
  max_uses, 
  per_user_limit, 
  min_order_value, 
  start_date, 
  end_date, 
  is_active
) VALUES (
  'SUMMER25',
  'Summer sale - 25% off',
  'percentage',
  25,
  NULL,  -- Unlimited total uses
  5,     -- 5 uses per user
  500,   -- Min order ₹500
  '2025-06-01 00:00:00+00',
  '2025-08-31 23:59:59+00',
  TRUE
);
```

### Updating a Coupon

```sql
-- Deactivate a coupon
UPDATE coupons SET is_active = FALSE WHERE code = 'SAVE20';

-- Extend expiry date
UPDATE coupons 
SET end_date = '2025-12-31 23:59:59+00' 
WHERE code = 'MEGA500';

-- Increase discount value
UPDATE coupons 
SET discount_value = 30 
WHERE code = 'SAVE20';
```

### Viewing Coupon Usage

```sql
-- Total uses per coupon
SELECT 
  c.code,
  c.uses_count,
  c.max_uses,
  COUNT(cu.id) as actual_uses
FROM coupons c
LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id
GROUP BY c.id, c.code, c.uses_count, c.max_uses;

-- Usage by user
SELECT 
  u.name,
  u.email,
  c.code,
  cu.discount_amount,
  cu.used_at
FROM coupon_usage cu
JOIN users u ON cu.user_id = u.id
JOIN coupons c ON cu.coupon_id = c.id
ORDER BY cu.used_at DESC;

-- Most popular coupons
SELECT 
  code,
  description,
  uses_count,
  discount_type,
  discount_value
FROM coupons
WHERE is_active = TRUE
ORDER BY uses_count DESC
LIMIT 10;
```

## Features

### ✅ Implemented Features

- Database-driven coupon system
- Percentage and fixed discount types
- Minimum order value validation
- Maximum usage limits (total and per-user)
- Date range validation (start and end dates)
- Active/inactive status
- Automatic usage tracking
- Usage count auto-increment via trigger
- Toast notifications for all validation states
- Coupon usage history per order

### 🎯 Validation Messages

| Scenario | Message |
|----------|---------|
| Empty input | "Enter Coupon Code" |
| Invalid code | "Invalid Coupon" |
| Not yet active | "Coupon Not Active" |
| Expired | "Coupon Expired" |
| Min order not met | "Minimum Order Not Met" |
| Max uses reached | "Coupon Limit Reached" |
| User limit reached | "Usage Limit Reached" |
| Success | "Coupon Applied! 🎉" |

## Technical Implementation

### Frontend (Checkout.tsx)

```typescript
// Apply coupon function
const tryApplyCoupon = async () => {
  // 1. Fetch coupon from database
  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .single();

  // 2. Validate date range, min order, limits
  // 3. Calculate discount
  // 4. Apply to order
};

// After order creation
// Log usage in coupon_usage table
await supabase.from('coupon_usage').insert({
  coupon_id: coupon.id,
  user_id: userId,
  order_id: orderId,
  discount_amount: discount,
});
```

### Backend (SQL)

```sql
-- Auto-increment trigger
CREATE TRIGGER trigger_increment_coupon_usage
AFTER INSERT ON coupon_usage
FOR EACH ROW
EXECUTE FUNCTION increment_coupon_usage();
```

## Security & Permissions

### Row Level Security (RLS)

Add RLS policies for production:

```sql
-- Users can only view active coupons
CREATE POLICY "Users can view active coupons"
ON coupons FOR SELECT
TO authenticated
USING (is_active = TRUE);

-- Only admins can manage coupons
CREATE POLICY "Admins can manage coupons"
ON coupons FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Users can only view their own usage
CREATE POLICY "Users can view own usage"
ON coupon_usage FOR SELECT
TO authenticated
USING (user_id = auth.uid());
```

## Testing

### Test Cases

1. **Valid Coupon**: Apply "SAVE10" on any order
2. **Minimum Order**: Try "FLAT300" on ₹500 order (should fail)
3. **Date Range**: Create expired coupon and try to use
4. **Max Uses**: Use "FIRST200" (max 100 uses)
5. **Per User Limit**: Use "SAVE20" 4 times (limit is 3)
6. **Inactive Coupon**: Deactivate and try to use

### Sample Test Data

```sql
-- Create test coupon
INSERT INTO coupons (code, discount_type, discount_value, max_uses, is_active)
VALUES ('TEST10', 'percentage', 10, 10, TRUE);

-- Check usage
SELECT * FROM coupon_usage WHERE coupon_id = (
  SELECT id FROM coupons WHERE code = 'TEST10'
);
```

## Future Enhancements

- [ ] Category-specific coupons
- [ ] Product-specific coupons
- [ ] User-specific coupons
- [ ] Bulk coupon generation
- [ ] Coupon stacking rules
- [ ] Admin dashboard for coupon management
- [ ] Analytics and reporting
- [ ] Email coupon campaigns
- [ ] Referral coupons
- [ ] Auto-apply best coupon

## Support

For issues or questions:
- Check database logs: `SELECT * FROM coupons WHERE code = 'YOUR_CODE'`
- Check usage: `SELECT * FROM coupon_usage WHERE coupon_id = 'UUID'`
- Console logs: Check browser console for validation errors

