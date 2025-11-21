# My Orders - Amazon-like Order Management Implementation

## Overview

This document describes the complete implementation of an Amazon-like order management system for delivered items in the "My Orders" section. The system includes reviews/ratings, returns, replacements, product reports, vendor reports, and support functionality.

## Features Implemented

### 1. Order Details Screen
- **Full order information display**
  - Order number, status, and dates
  - Order items with images
  - Payment information
  - Shipping address
  - Tracking information

### 2. Product Reviews & Ratings
- **Review System**
  - 5-star rating system
  - Review title and detailed text
  - Photo uploads (up to 5 images)
  - Verified purchase badge
  - Helpful votes tracking
  - One review per product per order

### 3. Return & Replacement Requests
- **Return System**
  - Multiple return reasons
  - Detailed description
  - Photo evidence (up to 5 images)
  - Status tracking with timeline
  - Refund processing
  - Pickup scheduling

- **Replacement System**
  - Multiple replacement reasons
  - Photo evidence
  - Status tracking
  - Replacement order tracking
  - Shipping updates

### 4. Product & Vendor Reports
- **Product Reports**
  - Report counterfeit/fake products
  - Misleading information
  - Quality concerns
  - Safety issues
  - Evidence documentation

- **Vendor Reports**
  - Poor customer service
  - Delayed shipping
  - Fraudulent behavior
  - Investigation tracking
  - Action taken documentation

### 5. Support System
- **Contact Support**
  - General queries
  - Order-specific questions
  - Issue resolution tracking

## Database Schema

### Tables Created

#### 1. `product_reviews`
Stores customer reviews and ratings for products.

**Key Fields:**
- `id`: UUID primary key
- `user_id`: Reference to users table
- `product_id`: Reference to products table
- `order_id`: Reference to orders table
- `order_item_id`: Reference to order_items table
- `rating`: Integer (1-5)
- `title`: Review title
- `review_text`: Detailed review
- `review_images`: Array of image URLs
- `is_verified_purchase`: Boolean flag
- `helpful_count`: Number of helpful votes
- `status`: active/pending/hidden/removed
- `created_at`, `updated_at`: Timestamps

**Constraints:**
- One review per user per product per order item
- Rating must be between 1 and 5

#### 2. `review_helpful_votes`
Tracks which users found reviews helpful.

**Key Fields:**
- `id`: UUID primary key
- `review_id`: Reference to product_reviews
- `user_id`: Reference to users
- `created_at`: Timestamp

**Constraints:**
- One vote per user per review

#### 3. `order_return_requests`
Manages return and replacement requests.

**Key Fields:**
- `id`: UUID primary key
- `user_id`: Reference to users
- `order_id`: Reference to orders
- `order_item_id`: Reference to order_items
- `request_type`: return/replacement
- `reason`: Reason for request
- `detailed_reason`: Detailed explanation
- `issue_images`: Array of evidence images
- `status`: requested/approved/rejected/pickup_scheduled/in_transit/refund_initiated/completed/etc.
- `refund_amount`: Amount to be refunded
- `refund_method`: original_payment/wallet/bank_transfer
- `replacement_order_id`: Reference to replacement order
- `pickup_address`: Pickup location
- `pickup_scheduled_at`: Pickup date/time
- `admin_notes`: Internal notes
- `created_at`, `updated_at`: Timestamps

**Status Flow:**
- **Return**: requested → approved → pickup_scheduled → picked_up → in_transit → received_at_warehouse → inspecting → refund_initiated → refund_completed → completed
- **Replacement**: requested → approved → replacement_approved → replacement_preparing → replacement_shipped → replacement_delivered → completed

#### 4. `return_request_updates`
Timeline of status changes for return/replacement requests.

**Key Fields:**
- `id`: UUID primary key
- `return_request_id`: Reference to order_return_requests
- `status`: Status value
- `message`: Update message
- `updated_by`: Reference to users (admin/system)
- `created_at`: Timestamp

#### 5. `product_vendor_reports`
Stores reports about products or vendors.

**Key Fields:**
- `id`: UUID primary key
- `user_id`: Reference to users
- `report_type`: product/vendor
- `product_id`: Reference to products (for product reports)
- `vendor_id`: Reference to users (for vendor reports)
- `order_id`: Reference to orders
- `order_item_id`: Reference to order_items
- `reason`: Report reason
- `detailed_description`: Detailed explanation
- `evidence_images`: Array of evidence images
- `status`: submitted/under_review/investigating/action_taken/resolved/dismissed
- `priority`: low/medium/high/urgent
- `resolution_notes`: Resolution details
- `action_taken`: Actions taken by admin
- `resolved_by`: Reference to admin user
- `resolved_at`: Timestamp
- `created_at`, `updated_at`: Timestamps

#### 6. `report_updates`
Timeline of actions taken on reports.

**Key Fields:**
- `id`: UUID primary key
- `report_id`: Reference to product_vendor_reports
- `status`: Status value
- `message`: Update message
- `updated_by`: Reference to users (admin)
- `created_at`: Timestamp

### Indexes

Performance indexes created on:
- User IDs for all tables
- Product IDs
- Order IDs and Order Item IDs
- Status fields
- Created dates (DESC for recent-first queries)
- Rating values
- Report types and priorities

### Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:

**Product Reviews:**
- Users can view active reviews or their own reviews
- Users can create reviews for their purchases
- Users can update/delete their own reviews

**Review Votes:**
- Anyone can view votes
- Users can add/remove their own votes

**Return Requests:**
- Users can only view/create/update their own requests
- Users can only update pending requests

**Reports:**
- Users can only view/create their own reports

### Functions & Triggers

**Automated Updates:**
1. `update_updated_at_column()`: Automatically updates `updated_at` timestamp
2. `increment_review_helpful_count()`: Updates helpful count when vote is added
3. `decrement_review_helpful_count()`: Updates helpful count when vote is removed
4. `create_return_request_update()`: Creates timeline entry when request status changes
5. `create_report_update()`: Creates timeline entry when report status changes

**Views for Analytics:**
1. `product_rating_summary`: Aggregates ratings and counts per product
2. `return_request_summary`: Statistics on returns/replacements by date and status
3. `report_summary`: Report counts by type, status, and priority

## File Structure

```
screens/
├── MyOrders.tsx          # Main orders list with support tickets
└── OrderDetails.tsx      # New: Detailed order view with all actions

sql/
└── order_reviews_and_actions.sql  # Complete database schema

types/
└── navigation.ts         # Updated: Added OrderDetails route

navigation/
└── index.tsx            # Updated: Added OrderDetails screen
```

## Screen Flows

### 1. My Orders Screen
- Lists all user orders
- Shows order summary (number, date, status, total)
- Shows order items with support/return/replacement buttons
- Displays existing support tickets per item
- "View Order Details" button navigates to detailed view

### 2. Order Details Screen
- Comprehensive order information
- For each order item (when delivered):
  - **Review** button: Opens review modal
  - **Return** button: Opens return request modal
  - **Replace** button: Opens replacement request modal
  - **Report Product**: Opens product report modal
  - **Report Vendor**: Opens vendor report modal
- Contact Support button at the bottom

### 3. Action Modals

All modals follow the app's white and pink theme with consistent styling.

#### Review Modal
1. Star rating selector (1-5 stars)
2. Optional review title
3. Optional review text (multi-line)
4. Optional photo uploads (up to 5)
5. Submit button with loading state

#### Return/Replacement Modal
1. Reason selector (chip-based UI)
2. Additional details (multi-line text)
3. Photo uploads for evidence (up to 5)
4. Submit button with loading state

#### Report Modal (Product/Vendor)
1. Reason selector (chip-based UI)
2. Required detailed description
3. Photo uploads for evidence (up to 5)
4. Submit button with loading state

## User Experience Features

### Validations
- Reviews require at least a rating
- Returns/replacements require a reason
- Reports require both reason and detailed description
- Only delivered orders can be returned/replaced
- Reports can be filed for any order

### Feedback
- Toast notifications for all actions (success/error)
- Loading states on all buttons
- Duplicate review detection (user already reviewed)
- Clear error messages

### UI/UX
- Pink and white theme consistency
- Gradient buttons for primary actions
- Outlined buttons for secondary actions
- Image preview with remove functionality
- Smooth animations and transitions
- Safe area handling for iOS/Android
- Keyboard avoiding behavior on modals

### Photo Management
- Up to 5 photos per action
- Permission requests for camera/gallery
- Image preview before submission
- Easy removal of selected images
- Visual feedback on upload

## Integration Points

### Navigation
```typescript
// From MyOrders to OrderDetails
navigation.navigate('OrderDetails', { orderId: order.id });
```

### Data Flow
1. **Order Data**: Fetched from `orders` and `order_items` tables
2. **Reviews**: Inserted into `product_reviews` table
3. **Returns/Replacements**: Inserted into `order_return_requests` table
4. **Reports**: Inserted into `product_vendor_reports` table

### Error Handling
- Network errors: Graceful fallback with toast notification
- Permission errors: Clear messaging with settings redirect option
- Duplicate entries: Informative toast messages
- Missing data: Empty states with helpful messages

## Future Enhancements

### Potential Additions
1. **Admin Dashboard**
   - Manage return/replacement requests
   - Review and action on reports
   - Update request statuses
   - Add admin notes

2. **Email Notifications**
   - Order status updates
   - Return/replacement status changes
   - Report investigation updates

3. **In-app Notifications**
   - Real-time updates on requests
   - New messages from support

4. **Analytics**
   - Return rate by product
   - Average ratings by category
   - Report trends
   - Customer satisfaction metrics

5. **Enhanced Features**
   - Video reviews
   - Review responses from vendors
   - Return shipping label generation
   - Automated refund processing
   - Live chat support integration

## Testing Checklist

- [ ] View order details for all order statuses
- [ ] Submit a review for a delivered item
- [ ] Submit multiple reviews for different items
- [ ] Try submitting duplicate review (should show error)
- [ ] Upload photos in review
- [ ] Submit return request with all fields
- [ ] Submit replacement request with photos
- [ ] Report a product with evidence
- [ ] Report a vendor with details
- [ ] Check return/replacement buttons are disabled for non-delivered orders
- [ ] Verify navigation back to MyOrders works correctly
- [ ] Test on both iOS and Android
- [ ] Test keyboard behavior in modals
- [ ] Test image picker permissions
- [ ] Test safe area insets
- [ ] Verify data is correctly saved to Supabase
- [ ] Check RLS policies work correctly
- [ ] Test with guest users (should redirect to login)

## SQL Setup

To set up the database, run the following SQL file in your Supabase SQL editor:

```sql
-- Run this file in Supabase SQL Editor
sql/order_reviews_and_actions.sql
```

This will create all necessary tables, indexes, RLS policies, functions, triggers, and views.

## Notes

1. **Photo Upload**: Currently stores image URIs directly. In production, you should:
   - Upload images to cloud storage (Supabase Storage, Cloudinary, etc.)
   - Store the cloud URLs in the database
   - Implement image compression for better performance

2. **Vendor ID**: The current implementation uses a placeholder for vendor_id in vendor reports. You should update this to reference the actual vendor from the order/product data.

3. **Shipping Address**: The address is currently stored as a JSON string. Consider parsing and formatting it for better display.

4. **Tracking Links**: Add integration with shipping providers to show live tracking status.

5. **Refund Processing**: The refund fields are present but need integration with your payment gateway (Razorpay) for actual refund processing.

## Support

For questions or issues with this implementation, refer to:
- `/Users/nischal/Desktop/only2u-main-2/screens/OrderDetails.tsx`
- `/Users/nischal/Desktop/only2u-main-2/sql/order_reviews_and_actions.sql`
- This documentation file

## Version History

- **v1.0.0** (Current): Initial implementation with complete order management system
  - Order Details screen
  - Reviews and ratings
  - Returns and replacements
  - Product and vendor reports
  - Support integration

