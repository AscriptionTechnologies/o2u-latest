import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, Button, Linking, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import TabNavigator from './tab-navigator';
import { supabase } from '~/utils/supabase';
import { Provider, useAuth } from '../contexts/useAuth';
import { VendorProvider } from '../contexts/VendorContext';
import { isFirstTimeUser } from '~/utils/introHelper';

import Login from '~/screens/Login';
import Intro from '~/screens/Intro';
import UserOnboarding from '~/screens/UserOnboarding';
// Removed Register screen as signup is no longer used
import ProfilePictureUpload from '~/screens/ProfilePictureUpload';
import UserSizeSelection from '~/screens/UserSizeSelection';
import SkinToneSelection from '~/screens/SkinToneSelection';
import BodyWidthSelection from '~/screens/BodyWidthSelection';
import RegistrationSuccess from '~/screens/RegistrationSuccess';
import Notifications from '~/screens/Notification';
import MessageDetail from '~/screens/MessageDetail';
import ForgotPassword from '~/screens/ForgotPassword';
import PrivacyAndSecurity from '~/screens/PrivacyAndSecurity';
import PrivacyPolicy from '~/screens/PrivacyPolicy';
import TermsAndConditions from '~/screens/TermsAndConditions';
import RefundPolicy from '~/screens/RefundPolicy';
import General from '~/components/Profile/General';
import Account from '~/components/Profile/Account';
import Reviews from '~/components/Profile/Reviews';
import YourEarnings from '~/components/Profile/YourEarnings';
import FaceSwapScreen from '~/screens/FaceSwap';
import PersonalizedProductResult from '~/screens/PersonalizedProductResult';
import Checkout from '~/screens/Checkout';
import AddressBook from '~/screens/AddressBook';
import AddAddress from '~/screens/AddAddress';
import VendorProfile from '~/screens/VendorProfile';
import ResellerRegistration from '~/screens/ResellerRegistration';
import ResellerDashboard from '~/screens/ResellerDashboard';
import CatalogShare from '~/screens/CatalogShare';
import Products from '~/screens/Products';
import VendorDashboard from '~/screens/VendorDashboard';
import ProductDetails from '~/screens/ProductDetails';
import OrderDetails from '~/screens/OrderDetails';
import { useUser } from '~/contexts/UserContext';
import MessagesScreen from '~/screens/Messages';
import ChatThread from '~/screens/ChatThread';
import FriendSearch from '~/screens/FriendSearch';

const Stack = createNativeStackNavigator();

const Navigation = () => {
  return (
    <Stack.Navigator 
      initialRouteName="TabNavigator" 
      screenOptions={{ 
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 250,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        customAnimationOnGesture: true,
      }}
    >
      <Stack.Screen name="TabNavigator" component={TabNavigator} />
      <Stack.Screen
        name="PrivacyAndSecurity"
        component={PrivacyAndSecurity}
      />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
      <Stack.Screen name="TermsAndConditions" component={TermsAndConditions} />
      <Stack.Screen name="RefundPolicy" component={RefundPolicy} />
      <Stack.Screen name="MessageDetail" component={MessageDetail} />
      <Stack.Screen name="Notifications" component={Notifications} />
      <Stack.Screen name="General" component={General} />
      <Stack.Screen name="Account" component={Account} />
      <Stack.Screen name="Reviews" component={Reviews} />
      <Stack.Screen name="YourEarnings" component={YourEarnings} />
      <Stack.Screen name="FaceSwap" component={FaceSwapScreen} />
      <Stack.Screen name="PersonalizedProductResult" component={PersonalizedProductResult} />
      <Stack.Screen name="Checkout" component={Checkout} />
      <Stack.Screen name="AddressBook" component={AddressBook} />
      <Stack.Screen name="AddAddress" component={AddAddress} />
      <Stack.Screen name="VendorProfile" component={VendorProfile} />
      <Stack.Screen name="VendorDashboard" component={VendorDashboard} />
      <Stack.Screen name="ResellerRegistration" component={ResellerRegistration} />
      <Stack.Screen name="ResellerDashboard" component={ResellerDashboard} />
      <Stack.Screen name="CatalogShare" component={CatalogShare} />
      <Stack.Screen name="ProductDetails" component={ProductDetails} />
      <Stack.Screen name="Products" component={Products} />
      <Stack.Screen name="OrderDetails" component={OrderDetails} />
      <Stack.Screen name="Messages" component={MessagesScreen} />
      <Stack.Screen name="ChatThread" component={ChatThread} />
      <Stack.Screen name="FriendSearch" component={FriendSearch} />
    </Stack.Navigator>
  );
};

const AuthFlowScreen = () => {
  const { needsOnboarding } = useAuth();
  
  if (needsOnboarding) {
    console.log('AuthFlow: Showing onboarding');
    return <UserOnboarding />;
  }
  
  console.log('AuthFlow: Showing login');
  return <Login />;
};

const AuthNavigator = () => {
  return (
    <Stack.Navigator 
      initialRouteName="AuthFlow"
      screenOptions={{ 
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 250,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        customAnimationOnGesture: true,
      }}
    >
      <Stack.Screen name="Intro" component={Intro} />
      <Stack.Screen name="AuthFlow" component={AuthFlowScreen} />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="UserOnboarding" component={UserOnboarding} />
      {/** Signup removed */}
      <Stack.Screen name="ProfilePictureUpload" component={ProfilePictureUpload} />
      <Stack.Screen name="UserSizeSelection" component={UserSizeSelection} />
      <Stack.Screen name="SkinToneSelection" component={SkinToneSelection} />
      <Stack.Screen name="BodyWidthSelection" component={BodyWidthSelection} />
      <Stack.Screen name="RegistrationSuccess" component={RegistrationSuccess} />
      <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
      <Stack.Screen name="TermsAndConditions" component={TermsAndConditions} />
      <Stack.Screen name="RefundPolicy" component={RefundPolicy} />
    </Stack.Navigator>
  );
};

const HandleNavigation = () => {
  const { user, loading, needsOnboarding } = useAuth();
  const { setUserData } = useUser();
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);

  useEffect(() => {
    checkFirstTimeUser();
  }, []);

  const checkFirstTimeUser = async () => {
    try {
      const isFirstTimeUserResult = await isFirstTimeUser();
      setIsFirstTime(isFirstTimeUserResult);
    } catch (error) {
      console.log('Error checking first time user:', error);
      setIsFirstTime(false);
    }
  };

  // Update UserContext when auth user changes
  useEffect(() => {
    if (user) {
      setUserData(user);
      console.log('Navigation: User updated, should show main app');
    } else {
      console.log('Navigation: No user, showing auth screens');
    }
  }, [user, setUserData]);

  useEffect(() => {
    console.log('Navigation state - Loading:', loading, 'User:', !!user, 'NeedsOnboarding:', needsOnboarding);
  }, [loading, user, needsOnboarding]);

  if (loading) {
    console.log('Navigation: Showing loading screen');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F53F7A' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Guest access enabled: Always show main navigation, even without login
  if (user) {
    console.log('Navigation: Showing main app for user:', user.id);
  } else {
    console.log('Navigation: Showing main app for guest user');
  }
  return <Navigation key={user ? 'main-navigation' : 'guest-navigation'} />;
};

export default function RootStack() {
  const linking = {
    prefixes: ['only2u://', 'https://only2u.app', 'https://*.only2u.app'],
    config: {
      screens: {
        TabNavigator: {
          screens: {
            Home: {
              screens: {
                Home: 'home',
                SharedCollection: 'shared-collection/:shareToken',
                Products: 'products/:categoryId',
                CollectionDetails: 'collection/:collectionId',
              },
            },
          },
        },
        ProductDetails: {
          path: 'product/:productId',
          parse: {
            productId: (productId: string) => productId,
          },
        },
      },
    },
  };

  // Handle deep links when app is already open
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('Deep link received:', url);
      // Navigation will be handled automatically by linking config
    });

    // Handle initial URL when app is opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial deep link:', url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <Provider>
      <VendorProvider>
        <NavigationContainer 
          linking={linking}
          fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#F53F7A" /></View>}
          onReady={() => {
            console.log('Navigation is ready');
          }}
          onStateChange={(state) => {
            console.log('Navigation state changed:', state?.routes?.[0]?.name);
          }}
        >
          <HandleNavigation />
        </NavigationContainer>
      </VendorProvider>
    </Provider>
  );
}
