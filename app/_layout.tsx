import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: true,
          headerTransparent: true,
          headerTintColor: '#FFFFFF',
          headerBackTitleVisible: false,
          title: '',
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'BloomAR',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="category"
          options={{
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="camera"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
          }}
        />
      </Stack>
    </>
  );
}

