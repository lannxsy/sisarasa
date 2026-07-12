import { Redirect, Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { COLORS } from '@/constants/theme';
import { auth } from '../lib/firebase';

export default function TabLayout() {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(Boolean(user));
      setIsReady(true);
    });
    return unsubscribe;
  }, []);

  if (!isReady) return null;
  if (!isLoggedIn) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray400,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: 22,
          height: 64,
          paddingTop: 10,
          borderRadius: 26,
          backgroundColor: COLORS.white,
          borderTopWidth: 0,
          elevation: 14,
          shadowColor: COLORS.primaryDark,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 16,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}>
      <Tabs.Screen
        name="toko"
        options={{
          title: 'Toko',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={24} name={focused ? 'storefront' : 'storefront-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Pesanan',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={24} name={focused ? 'receipt' : 'receipt-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorit',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={24} name={focused ? 'heart' : 'heart-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={24} name={focused ? 'person' : 'person-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}