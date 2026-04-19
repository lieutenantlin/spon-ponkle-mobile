import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { SamplesProvider } from "@/providers/SamplesProvider";
import { DeviceProvider } from "@/providers/DeviceProvider";
import { ScanDraftProvider } from "@/providers/ScanDraftProvider";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "login";
    if (!user && !inAuth) {
      router.replace("/login");
    } else if (user && inAuth) {
      router.replace("/(tabs)/(home)");
    }
  }, [user, loading, segments, router]);

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: Colors.light.background },
        headerTitleStyle: { color: Colors.light.text, fontWeight: "700" },
        headerTintColor: Colors.light.tint,
        contentStyle: { backgroundColor: Colors.light.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen
        name="scan/capture"
        options={{ title: "Capture Sample", presentation: "card" }}
      />
      <Stack.Screen
        name="scan/metadata"
        options={{ title: "Sample Details" }}
      />
      <Stack.Screen
        name="scan/processing"
        options={{ title: "Analyzing", gestureEnabled: false, headerBackVisible: false }}
      />
      <Stack.Screen
        name="scan/result"
        options={{ title: "Result", headerBackVisible: false }}
      />
      <Stack.Screen
        name="sample/[id]"
        options={{ title: "Sample Detail" }}
      />
      <Stack.Screen
        name="device"
        options={{ title: "UNO Q Setup" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <DeviceProvider>
            <SamplesProvider>
              <ScanDraftProvider>
                <StatusBar style="dark" />
                <AuthGate>
                  <RootLayoutNav />
                </AuthGate>
              </ScanDraftProvider>
            </SamplesProvider>
          </DeviceProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
