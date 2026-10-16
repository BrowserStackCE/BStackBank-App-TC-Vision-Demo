import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BSColors } from '@/constants/theme';
import { AuthStore } from '@/store/auth';
import { applyDefaultFont } from '@/utils/default-font';
import {
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
  Urbanist_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/urbanist';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { LogBox, Platform } from 'react-native';
import 'react-native-reanimated';

SplashScreen.preventAutoHideAsync().catch(() => {});
applyDefaultFont();

// Suppress known third-party library warnings that are not actionable
LogBox.ignoreLogs([
  'animations-in-inline-styling',
  "It looks like you might be using shared value's .value inside reanimated inline style",
]);

const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PK ?? 'pk_test_YOUR_PUBLISHABLE_KEY_HERE';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Urbanist-Regular':   Urbanist_400Regular,
    'Urbanist-Medium':    Urbanist_500Medium,
    'Urbanist-SemiBold':  Urbanist_600SemiBold,
    'Urbanist-Bold':      Urbanist_700Bold,
    'Urbanist-ExtraBold': Urbanist_800ExtraBold,
  });
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);
  const notifListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  // Persistent login — restore the saved session before the first screen shows.
  // The login screen redirects to the dashboard when a session exists.
  useEffect(() => {
    (async () => {
      try {
        await Promise.all([AuthStore.loadBiometricEnabled(), AuthStore.restoreSession()]);
      } catch { /* fall through to login screen */ }
      setSessionChecked(true);
    })();
  }, []);

  useEffect(() => {
    if (fontsLoaded && sessionChecked) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, sessionChecked]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const Notifications = await import('expo-notifications');

        // Show banners when app is foregrounded
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: BSColors.primary,
          });
        }

        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing !== 'granted') await Notifications.requestPermissionsAsync();

        // Token registration is handled in (banking)/_layout.tsx after login
        notifListener.current = Notifications.addNotificationReceivedListener(() => {});
        responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
          const data = response?.notification?.request?.content?.data;
          if (data?.type === 'chat' && mounted) {
            router.push('/(banking)/chat' as any);
          }
        });
      } catch { /* expo-notifications not available (Expo Go / web) */ }
    })();

    // Deep-link handler: demobankingapp://verified → profile verified state
    const { Linking } = require('react-native') as typeof import('react-native');
    const openVerified = () =>
      router.push({ pathname: '/(banking)/profile' as any, params: { deeplink_verified: '1' } });
    const linkingSub = Linking.addEventListener('url', ({ url }: { url: string }) => {
      if (mounted && url.startsWith('demobankingapp://verified')) openVerified();
    });
    Linking.getInitialURL().then((url: string | null) => {
      if (url && url.startsWith('demobankingapp://verified') && mounted) openVerified();
    }).catch(() => {});

    return () => {
      mounted = false;
      notifListener.current?.remove?.();
      responseListener.current?.remove?.();
      linkingSub.remove();
    };
  }, []);

  if (!fontsLoaded || !sessionChecked) return null;

  return (
    <ErrorBoundary>
      <StripeProvider publishableKey={STRIPE_PK} merchantIdentifier="merchant.com.browserstackbank" urlScheme="demobankingapp">
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="(banking)" />
        </Stack>
        <StatusBar style="light" />
      </StripeProvider>
    </ErrorBoundary>
  );
}