import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, Button } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

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
import FaceSwapScreen from '~/screens/FaceSwap';
import PersonalizedProductResult from '~/screens/PersonalizedProductResult';
import Checkout from '~/screens/Checkout';
import AddressBook from '~/screens/AddressBook';
import VendorProfile from '~/screens/VendorProfile';
import ResellerRegistration from '~/screens/ResellerRegistration';
import ResellerDashboardSimple from '~/screens/ResellerDashboardSimple';
import CatalogShare from '~/screens/CatalogShare';
import { useUser } from '~/contexts/UserContext';

const Stack = createNativeStackNavigator();

const Navigation = () => {
  const { t } = useTranslation();
  return (
    <Stack.Navigator initialRouteName="TabNavigator" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TabNavigator" component={TabNavigator} />
      <Stack.Screen
        name="PrivacyAndSecurity"
        component={PrivacyAndSecurity}
        options={{ title: t('privacy_and_security'), headerBackTitle: t('profile') }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicy}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TermsAndConditions"
        component={TermsAndConditions}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RefundPolicy"
        component={RefundPolicy}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MessageDetail"
        component={MessageDetail}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Notifications"
        component={Notifications}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="General" component={General} options={{ headerShown: false }} />
      <Stack.Screen name="Account" component={Account} options={{ headerShown: false }} />
      <Stack.Screen name="Reviews" component={Reviews} options={{ headerShown: false }} />
      <Stack.Screen name="FaceSwap" component={FaceSwapScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PersonalizedProductResult" component={PersonalizedProductResult} options={{ headerShown: false }} />
      <Stack.Screen name="Checkout" component={Checkout} options={{ headerShown: false }} />
      <Stack.Screen name="AddressBook" component={AddressBook} options={{ headerShown: false }} />
      <Stack.Screen name="VendorProfile" component={VendorProfile} options={{ headerShown: false }} />
      <Stack.Screen name="ResellerRegistration" component={ResellerRegistration} options={{ headerShown: false }} />
      <Stack.Screen name="ResellerDashboard" component={ResellerDashboardSimple} options={{ headerShown: false }} />
      <Stack.Screen name="CatalogShare" component={CatalogShare} options={{ headerShown: false }} />
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
    <Stack.Navigator initialRouteName="AuthFlow">
      <Stack.Screen name="Intro" component={Intro} options={{ headerShown: false }} />
      <Stack.Screen name="AuthFlow" component={AuthFlowScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
      <Stack.Screen name="UserOnboarding" component={UserOnboarding} options={{ headerShown: false }} />
      {/** Signup removed */}
      <Stack.Screen
        name="ProfilePictureUpload"
        component={ProfilePictureUpload}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="UserSizeSelection"
        component={UserSizeSelection}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SkinToneSelection"
        component={SkinToneSelection}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BodyWidthSelection"
        component={BodyWidthSelection}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RegistrationSuccess"
        component={RegistrationSuccess}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPassword}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicy}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TermsAndConditions"
        component={TermsAndConditions}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RefundPolicy"
        component={RefundPolicy}
        options={{ headerShown: false }}
      />
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
  return (
    <Provider>
      <VendorProvider>
        <NavigationContainer>
          <HandleNavigation />
        </NavigationContainer>
      </VendorProvider>
    </Provider>
  );
}
