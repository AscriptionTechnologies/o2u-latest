# Only2u - AI-Powered Fashion Shopping App

<div align="center">
  <img src="assets/logo.png" alt="Only2u Logo" width="200"/>
  
  [![React Native](https://img.shields.io/badge/React%20Native-0.79.5-blue.svg)](https://reactnative.dev/)
  [![Expo](https://img.shields.io/badge/Expo-53.0.20-black.svg)](https://expo.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
  [![Supabase](https://img.shields.io/badge/Supabase-Database-green.svg)](https://supabase.com/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
</div>

## 🎯 Overview

Only2u is a revolutionary AI-powered fashion shopping app that combines personalized styling recommendations with cutting-edge virtual try-on technology. Built with React Native and Expo, it offers users a unique shopping experience where they can see themselves in outfits before making a purchase.

### Key Features
- 🤖 **AI-Powered Personalization** - Smart recommendations based on body type and style preferences
- 👗 **Virtual Try-On** - Advanced face swap technology for realistic outfit previews
- 🛍️ **Seamless Shopping** - Intuitive interface with secure payment processing
- 📱 **Cross-Platform** - Works on iOS, Android, and Web
- 🌍 **Internationalization** - Multi-language support (English, Telugu)
- 🔒 **Secure** - Built with Supabase for reliable data management

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/only2u.git
   cd only2u
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   # Create .env file (if needed for additional configs)
   cp .env.example .env
   ```

4. **Start the development server**
   ```bash
   npm start
   # or
   expo start
   ```

5. **Run on your preferred platform**
   ```bash
   # iOS
   npm run ios
   
   # Android
   npm run android
   
   # Web
   npm run web
   ```

## 🏗️ Project Structure

```
only2u/
├── assets/                 # Images, icons, and static assets
├── components/            # Reusable UI components
│   ├── common/           # Shared components (Button, Card, etc.)
│   ├── Home/             # Home screen components
│   └── Profile/          # Profile screen components
├── contexts/             # React Context providers
│   ├── CartContext.tsx   # Shopping cart state management
│   ├── UserContext.tsx   # User authentication and data
│   └── WishlistContext.tsx # Wishlist functionality
├── docs/                 # Documentation
│   ├── ERROR_HANDLING.md
│   ├── FACE_SWAP_IMPLEMENTATION.md
│   └── IMAGE_EXTRACTION_IMPLEMENTATION.md
├── locales/              # Internationalization files
│   ├── en.json          # English translations
│   └── te.json          # Telugu translations
├── navigation/           # Navigation configuration
├── screens/              # App screens
│   ├── Auth/            # Authentication screens
│   ├── Shopping/        # Shopping-related screens
│   └── Profile/         # User profile screens
├── sql/                  # Database migration files
├── types/                # TypeScript type definitions
├── utils/                # Utility functions and services
│   ├── akoolService.ts  # Face swap API integration
│   ├── supabase.ts      # Database client configuration
│   └── i18n.ts          # Internationalization setup
└── App.tsx              # Main app component
```

## 🔧 Tech Stack

### Frontend
- **React Native** (0.79.5) - Cross-platform mobile development
- **Expo** (53.0.20) - Development platform and tools
- **TypeScript** (5.8.3) - Type safety and better developer experience
- **React Navigation** (v7) - Navigation between screens

### Backend & Database
- **Supabase** - Backend-as-a-Service with PostgreSQL
- **Real-time subscriptions** for live updates
- **Row Level Security** for data protection

### AI & Image Processing
- **Akool API** - Face swap and virtual try-on technology
- **PiAPI** - Advanced image processing capabilities
- **Video compression** for optimized uploads

### State Management
- **React Context** - Global state management
- **AsyncStorage** - Local data persistence
- **Custom hooks** for reusable logic

### UI/UX
- **Expo Vector Icons** - Icon library
- **React Native Reanimated** - Smooth animations
- **Bottom Sheet** - Modal interactions
- **Linear Gradients** - Visual effects

## 🎨 Key Features Implementation

### AI-Powered Face Swap
The app integrates with Akool API for realistic virtual try-on experiences:

```typescript
// Example usage from akoolService.ts
const faceSwapResult = await akoolService.createFaceSwapTask({
  userImageUrl: userProfilePhoto,
  productImageUrl: productImage,
  userId: user.id,
  productId: product.id
});
```

### Multi-language Support
Built-in internationalization with i18next:

```typescript
// Usage in components
const { t } = useTranslation();
<Text>{t('welcome_message')}</Text>
```

### Real-time Shopping Cart
Context-based cart management with Supabase real-time updates:

```typescript
// Cart context usage
const { addToCart, removeFromCart, cartItems } = useCart();
```

## 📱 Screenshots

<div align="center">
  <img src="assets/reference.jpeg" alt="App Screenshot" width="200"/>
  <p><em>Main shopping interface with AI recommendations</em></p>
</div>

## 🚀 Deployment

### Expo Build
```bash
# Build for production
eas build --platform ios
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

### Environment Configuration
The app uses Expo's configuration system. Update `app.json` for:
- App store metadata
- Bundle identifiers
- Permissions
- Build settings

## 🧪 Testing

```bash
# Run linting
npm run lint

# Format code
npm run format

# Run tests (when implemented)
npm test
```

## 📚 Documentation

- [Error Handling Guide](docs/ERROR_HANDLING.md)
- [Face Swap Implementation](docs/FACE_SWAP_IMPLEMENTATION.md)
- [Image Extraction Guide](docs/IMAGE_EXTRACTION_IMPLEMENTATION.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write meaningful commit messages
- Add tests for new features

## 🐛 Known Issues

- Face swap processing can take 10-30 seconds depending on image quality
- Some older Android devices may experience performance issues with video processing
- Google Drive video URLs need conversion for API compatibility

<div align="center">
  <p>Built with React Native & Expo</p>
</div>
