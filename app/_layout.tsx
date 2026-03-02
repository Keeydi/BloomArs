import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
        <Stack.Screen
          name="ar-preview"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="editor"
          options={{
            headerShown: true,
            title: 'Edit Bouquet',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

