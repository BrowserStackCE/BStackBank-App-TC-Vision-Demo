import { BSColors } from '@/constants/theme';
import { ThemeStore } from '@/store/theme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Register native FCM/APNs device token after login (auth token is available here)
async function registerPushTokenAfterLogin() {
  try {
    const Notifications = await import('expo-notifications');
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    // getDevicePushTokenAsync returns the raw FCM token on Android and APNs token on iOS
    // This is what Firebase Admin SDK expects directly
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (!token) return;
    const { api } = await import('@/store/api');
    await api.registerPushToken(token, Platform.OS);
    console.log('[PushToken] FCM device token registered:', String(token).slice(0, 40));
  } catch (e: any) {
    console.log('[PushToken] Registration failed:', e?.message);
  }
}

export default function BankingLayout() {
  const [greenMode, setGreenMode] = useState(ThemeStore.isGreenMode());
  const { bottom: bottomInset } = require('react-native-safe-area-context').useSafeAreaInsets();

  useEffect(() => {
    const unsub = ThemeStore.subscribe(() => setGreenMode(ThemeStore.isGreenMode()));
    // Register push token now that user is logged in
    registerPushTokenAfterLogin();
    return unsub;
  }, []);

  const primaryColor = greenMode ? BSColors.successDark : BSColors.accent;
  // Tab bar height = icon+label area (60) + device bottom inset + top padding (8)
  const tabBarHeight = 60 + bottomInset + 8;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: BSColors.slate300,
        tabBarStyle: {
          backgroundColor: BSColors.white,
          borderTopColor: BSColors.mediumGray,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: bottomInset + 8,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'Urbanist-SemiBold' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarButtonTestID: 'tab-home',
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={greenMode ? size + 6 : size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="transfer"
        options={{
          title: 'Transfer',
          tabBarButtonTestID: 'tab-transfer',
          tabBarAccessibilityLabel: 'Transfer',
          tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" size={greenMode ? size + 6 : size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: 'Cards',
          tabBarButtonTestID: 'tab-cards',
          tabBarAccessibilityLabel: 'Cards',
          tabBarIcon: ({ color, size }) => <Ionicons name="card" size={greenMode ? size + 6 : size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarButtonTestID: 'tab-transactions',
          tabBarAccessibilityLabel: 'Transactions',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={greenMode ? size + 6 : size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarButtonTestID: 'tab-profile',
          tabBarAccessibilityLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={greenMode ? size + 6 : size} color={color} />,
        }}
      />
      <Tabs.Screen name="payment" options={{ href: null }} />
      <Tabs.Screen name="testfeatures" options={{ href: null }} />
      <Tabs.Screen name="network" options={{ href: null }} />
      <Tabs.Screen name="shake" options={{ href: null }} />
      <Tabs.Screen name="shop" options={{ href: null }} />
      <Tabs.Screen name="receipt" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="currency" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="webview" options={{ href: null }} />
    </Tabs>
  );
}