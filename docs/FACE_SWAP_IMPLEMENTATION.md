# Face Swap Implementation with Akool

## Overview

This implementation adds face swap functionality to the Only2U app using Akool's AI-powered face swap API. Users can now try on products by swapping their face onto product images.

## Features

- **Photo Preview**: Users can generate 3 styled product images with their face swapped in
- **Coin System**: Face swap operations cost coins (4 coins for Photo Preview)
- **Real-time Processing**: Shows processing status with progress indicators
- **Result Gallery**: Displays generated images with save and share options
- **User Balance Management**: Tracks and deducts coins from user accounts

## Implementation Details

### 1. Database Schema

The implementation adds a new `akool_tasks` table to track face swap operations:

```sql
CREATE TABLE akool_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  user_image_url TEXT NOT NULL,
  product_image_url TEXT NOT NULL,
  akool_task_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  task_type TEXT NOT NULL DEFAULT 'face_swap',
  result_images TEXT[],
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Akool Service (`utils/akoolService.ts`)

The service handles all interactions with the Akool API:

- `initiateFaceSwap()`: Starts a face swap operation
- `checkTaskStatus()`: Polls for task completion
- `getUserCoinBalance()`: Retrieves user's coin balance
- `deductCoins()`: Deducts coins for operations
- `getUserFaceSwapHistory()`: Gets user's face swap history

### 3. Face Swap Screen (`screens/FaceSwapScreen.tsx`)

A dedicated screen that handles the face swap workflow:

- **Initial State**: Shows product and user images with cost information
- **Processing State**: Displays progress indicators during face swap
- **Results State**: Shows generated images with navigation and action buttons

### 4. Integration Points

#### Trending Screen
- Modified the existing Akool modal to navigate to FaceSwap screen when "Photo Preview" is selected
- Passes product information to the FaceSwap screen

#### Product Details Screen
- Added a "Try On" button in the image gallery
- Allows users to start face swap directly from product details

## User Flow

1. **User selects Photo Preview** from Trending screen or Product Details
2. **System checks** user's profile photo and coin balance
3. **User confirms** the face swap operation (costs 4 coins)
4. **System initiates** face swap with Akool API
5. **Real-time updates** show processing status
6. **Results displayed** with 3 generated images
7. **User can save/share** the generated images

## Configuration

### Akool API Setup

1. Replace `YOUR_AKOOL_API_KEY` in `utils/akoolService.ts` with your actual Akool API key
2. Update the `baseUrl` to match Akool's actual API endpoint
3. Configure webhook URLs for callback handling

### Coin System

- Photo Preview: 4 coins
- Video Preview: 10 coins (future implementation)
- Default user balance: 10,000 coins

## Error Handling

The implementation includes comprehensive error handling:

- **Insufficient coins**: Shows alert and prevents operation
- **Missing profile photo**: Prompts user to upload photo first
- **API failures**: Displays user-friendly error messages
- **Network issues**: Graceful degradation with retry options

## Security Considerations

- API keys are stored securely (should be moved to environment variables)
- User authentication required for all operations
- Coin deduction happens before API call to prevent abuse
- Input validation for all user data

## Future Enhancements

1. **Video Preview**: Implement video face swap functionality
2. **Batch Processing**: Allow multiple products in one operation
3. **Advanced Filters**: Add style and effect options
4. **Social Sharing**: Direct integration with social media platforms
5. **Analytics**: Track usage patterns and popular products

## Testing

To test the face swap functionality:

1. Ensure user has a profile photo uploaded
2. Verify sufficient coin balance
3. Navigate to Trending screen or Product Details
4. Select "Photo Preview" or "Try On" button
5. Confirm the operation and wait for processing
6. Verify results are displayed correctly

## Dependencies

- React Native
- Expo
- Supabase (database and authentication)
- Akool API (face swap service)
- React Navigation (screen navigation)

## Notes

- The Akool API integration is currently using placeholder endpoints
- Coin balance management needs to be connected to a real payment system
- Image saving and sharing functionality needs to be implemented
- Webhook handling for Akool callbacks needs to be set up 