import 'react-native-reanimated';
import React, { useState } from 'react';
import { LogBox, ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { UserProvider } from './contexts/UserContext';
import { CartProvider } from './contexts/CartContext';
import { WishlistProvider } from './contexts/WishlistContext';
import { PreviewProvider } from './contexts/PreviewContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { VendorProvider } from './contexts/VendorContext';
import { LoginSheetProvider } from './contexts/LoginSheetContext';
import { ChatProvider } from './contexts/ChatContext';
import RootStack from './navigation';
import Toast from 'react-native-toast-message';
import { toastConfig } from './utils/toastConfig';
import AnimatedSplash from './components/AnimatedSplash';
import './utils/i18n';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

// Ignore specific warnings
LogBox.ignoreLogs([
  '[Reanimated] Reading from value during component render',
  'Warning: Cannot update a component',
  'Reading from',
  'a shared value while React is rendering',
  'Reanimated',
  'Text strings must be rendered within a <Text> component',
  'Warning: useInsertionEffect must not schedule updates',
]);

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'Riccione-Serial-Bold': require('./assets/fonts/Riccione-Serial Bold.ttf'),
  });
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  React.useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null; // Let splash screen show while loading
  }

  // Show animated splash screen
  if (showAnimatedSplash) {
    return <AnimatedSplash onFinish={() => setShowAnimatedSplash(false)} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LoginSheetProvider>
          <UserProvider>
            <ChatProvider>
            <CartProvider>
              <WishlistProvider>
                <NotificationsProvider>
                  <PreviewProvider>
                    <RootStack />
                    <Toast config={toastConfig} />
                  </PreviewProvider>
                </NotificationsProvider>
              </WishlistProvider>
            </CartProvider>
            </ChatProvider>
          </UserProvider>
        </LoginSheetProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}