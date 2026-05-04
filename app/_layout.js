import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Disable global font scaling to lock the UI design
if (Text.defaultProps == null) Text.defaultProps = {};
Text.defaultProps.allowFontScaling = false;
if (TextInput.defaultProps == null) TextInput.defaultProps = {};
TextInput.defaultProps.allowFontScaling = false;

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Entry Point */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        {/* Main Tab Navigation */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Auth Screens */}
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
        <Stack.Screen name="signup" options={{ presentation: 'modal' }} />
        {/* Settings Screen extracted from tabs */}
        <Stack.Screen name="setting" options={{ presentation: 'card', animation: 'fade' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
        {/* Onboarding Screen */}
        <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
