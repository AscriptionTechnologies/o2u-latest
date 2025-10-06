import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { UserProvider } from './contexts/UserContext';
import { CartProvider } from './contexts/CartContext';
import { WishlistProvider } from './contexts/WishlistContext';
import { PreviewProvider } from './contexts/PreviewContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { VendorProvider } from './contexts/VendorContext';
import { LoginSheetProvider } from './contexts/LoginSheetContext';
import RootStack from './navigation';
import Toast from 'react-native-toast-message';
import './utils/i18n';

// Ignore specific warnings
LogBox.ignoreLogs([
  '[Reanimated] Reading from value during component render',
  'Warning: Cannot update a component',
]);

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LoginSheetProvider>
          <UserProvider>
            <CartProvider>
              <WishlistProvider>
                <NotificationsProvider>
                  <PreviewProvider>
                    <RootStack />
                    <Toast />
                  </PreviewProvider>
                </NotificationsProvider>
              </WishlistProvider>
            </CartProvider>
          </UserProvider>
        </LoginSheetProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}