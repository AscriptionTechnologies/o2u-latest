# Trending Screen Face Swap Implementation

## Overview
The Trending screen has been enhanced to perform face swap directly when users click "Continue with Akool" instead of navigating to a separate FaceSwap screen. The face swap results are displayed in place of the original product images, providing a seamless user experience.

## Key Features Implemented

### 1. Direct Face Swap Integration
- **Location**: `screens/Trending.tsx`
- **Trigger**: "Continue with Akool" button in the modal
- **Action**: Performs face swap directly without navigation

### 2. State Management
```typescript
// Face swap state variables
const [faceSwapResults, setFaceSwapResults] = useState<{ [id: string]: string[] }>({});
const [faceSwapProcessing, setFaceSwapProcessing] = useState<{ [id: string]: boolean }>({});
const [selectedFaceSwapImage, setSelectedFaceSwapImage] = useState<{ [id: string]: number }>({});
const [coinBalance, setCoinBalance] = useState(0);
```

### 3. Face Swap Flow
1. **Validation**: Check user profile photo and coin balance
2. **Coin Deduction**: Deduct 4 coins for Photo Preview
3. **Face Swap Initiation**: Call Akool API with user and product images
4. **Result Handling**: 
   - Immediate results: Display immediately
   - Processing: Start polling every 5 seconds
5. **UI Update**: Show results in place of original images

### 4. UI Enhancements

#### Main Image Display
- **Priority**: Face swap results > Video > Original image
- **Processing Overlay**: Shows loading indicator during face swap
- **Multiple Results**: Displays selected face swap result

#### Thumbnail Navigation
- **Original Media**: Hidden when face swap results are available
- **Face Swap Results**: Shows thumbnails for multiple results
- **Selection**: Users can tap thumbnails to switch between results

#### Processing State
- **Overlay**: Semi-transparent overlay with loading indicator
- **Text**: "Processing Face Swap..." message
- **Z-Index**: High priority to stay on top

### 5. Coin Balance Management
- **Dynamic Balance**: Fetches real-time coin balance from database
- **Auto-Update**: Updates balance after successful coin deduction
- **Validation**: Prevents face swap if insufficient coins

### 6. Error Handling
- **Profile Photo**: Alerts if user hasn't uploaded profile photo
- **Coin Balance**: Alerts if insufficient coins
- **API Errors**: Shows error messages for failed requests
- **Network Issues**: Handles connection problems gracefully

## Code Structure

### Main Functions
```typescript
// Face swap handler
const handleFaceSwap = async (product: Product) => {
  // Validation, coin deduction, API call, result handling
};

// Status polling
const startFaceSwapPolling = (productId: string, taskId: string) => {
  // Poll every 5 seconds for completion
};

// Coin balance management
const fetchUserCoinBalance = async () => {
  // Fetch and update coin balance
};
```

### UI Components
```typescript
// Main image display with face swap priority
{hasFaceSwapResults ? (
  <Image source={{ uri: faceSwapResultImages[selectedFaceSwapIdx] }} />
) : hasVideo ? (
  <Video source={{ uri: mainMedia.url }} />
) : (
  <Image source={{ uri: mainMedia.thumbnail }} />
)}

// Processing overlay
{isFaceSwapProcessing && (
  <View style={styles.faceSwapProcessingOverlay}>
    <ActivityIndicator size="large" color="#F53F7A" />
    <Text style={styles.faceSwapProcessingText}>Processing Face Swap...</Text>
  </View>
)}

// Face swap result thumbnails
{hasFaceSwapResults && faceSwapResultImages.length > 1 && (
  <View style={styles.thumbnailsRow}>
    {faceSwapResultImages.map((imageUrl, idx) => (
      <TouchableOpacity onPress={() => setSelectedFaceSwapImage(...)}>
        <Image source={{ uri: imageUrl }} />
      </TouchableOpacity>
    ))}
  </View>
)}
```

## Dependencies

### Required Services
- `akoolService`: Face swap API integration
- `Toast`: Success/error notifications
- `Alert`: User alerts for errors

### Required Methods in akoolService
- `initiateFaceSwap()`: Start face swap process
- `checkTaskStatus()`: Check task completion status
- `getUserCoinBalance()`: Get user's coin balance
- `deductCoins()`: Deduct coins for face swap

## User Experience Flow

1. **Browse Products**: User swipes through trending products
2. **Try On**: User taps "Try On" button
3. **Select Option**: User selects "Photo Preview" (4 coins)
4. **Face Swap**: System automatically:
   - Validates user profile photo
   - Checks coin balance
   - Deducts coins
   - Initiates face swap
   - Shows processing overlay
5. **Results**: Face swap results appear in place of original images
6. **Navigation**: User can tap thumbnails to view different results

## Benefits

1. **Seamless Experience**: No navigation to separate screen
2. **Immediate Feedback**: Processing state visible immediately
3. **Multiple Results**: Users can view all generated images
4. **Real-time Updates**: Automatic polling for completion
5. **Error Handling**: Comprehensive error messages
6. **Coin Management**: Automatic balance updates

## Technical Notes

- **Polling Interval**: 5 seconds for status checks
- **Coin Cost**: 4 coins per Photo Preview
- **Image Priority**: Face swap results override original media
- **State Persistence**: Face swap results stored per product
- **Memory Management**: Results cleared when component unmounts

## Future Enhancements

1. **Video Face Swap**: Support for video preview (10 coins)
2. **Result Sharing**: Share face swap results
3. **Result Saving**: Save results to user's gallery
4. **Batch Processing**: Multiple products at once
5. **Quality Settings**: Different quality options
6. **Result History**: View previous face swap results 