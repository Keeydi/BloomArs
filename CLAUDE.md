# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BloomAR** is an Expo/React Native mobile application that enables users to create custom virtual bouquets using AR technology. Users can scan real flowers with their camera, customize bouquets for different occasions (Wedding, Birthday, Anniversary, Valentines), and visualize them in augmented reality.

## Development Commands

### Starting the Development Server
```bash
npm run start:dev          # Start with LAN hosting (recommended for device testing)
npm start                  # Start with --clear flag
npm run start:tunnel       # Start with tunnel (for remote testing)
```

### Platform-Specific Commands
```bash
npm run android            # Open on Android emulator/device
npm run ios               # Open on iOS simulator/device
npm run web               # Open in web browser
```

### Build Commands
```bash
npm run prebuild          # Generate native project files
npm run prebuild:clean    # Clean prebuild and regenerate
npm run android:build     # Build and run Android app
npm run ios:build         # Build and run iOS app
```

## Architecture

### Routing & Navigation
- Uses **expo-router** (file-based routing)
- Main routes:
  - `/` - Home screen ([index.tsx](app/index.tsx))
  - `/category` - Category selection ([category.tsx](app/category.tsx))
  - `/editor` - Bouquet editor/customization ([editor.tsx](app/editor.tsx))
  - `/camera` - Camera capture screen ([camera.tsx](app/camera.tsx))
  - `/ar-preview` - AR 3D model preview ([ar-preview.tsx](app/ar-preview.tsx))
- Navigation configured in [_layout.tsx](app/_layout.tsx)
- **Flow**: Home → Category → Editor → Camera → **AR Preview** → Editor

### State Management
- **Zustand** for global state ([bouquetStore.ts](store/bouquetStore.ts))
- **AsyncStorage** for persistence (persists `savedBouquets` only)
- Main store actions:
  - `createBouquet()` - Initialize new bouquet
  - `setDetectedFlower()` - Store scanned flower data
  - `addFlower()`, `updateFlower()`, `removeFlower()` - Flower management
  - `saveBouquet()`, `loadBouquet()` - Persistence operations
  - `setRibbon()`, `setWrapper()` - Accessory management
  - `updateARSettings()` - AR positioning/scaling

### Type System
All types defined in [types/index.ts](types/index.ts):
- `BouquetCategory` - Union type for occasion categories
- `Flower` - Individual flower with color, size, position, rotation
- `DetectedFlower` - Camera-scanned flower data (includes confidence, imageUri)
- `Bouquet` - Complete bouquet with flowers, accessories, AR settings
- `CustomizationState` - UI state for editing mode

### Path Aliases
TypeScript configured with `@/*` alias mapping to project root (see [tsconfig.json](tsconfig.json))

```typescript
import { useBouquetStore } from '@/store/bouquetStore';
import { Colors } from '@/constants/Colors';
import { Flower } from '@/types';
```

### Component Structure
- **Shared Components** in [components/](components/):
  - `BackgroundGradient.tsx` - Reusable gradient background with animated circles
  - `AnimatedCard.tsx` - Fade-in card component with staggered animation
  - `SharedStyles.ts` - Common style constants
- **Screen Components** in [app/](app/):
  - Each route is a separate `.tsx` file
  - Full-screen layouts with gesture handling

## Key Features & Implementation Details

### Camera & Flower Detection
- Uses **expo-camera** for image capture
- Captured images saved to `FileSystem.documentDirectory/flowers/`
- Flow: Camera → Capture → Save to FileSystem → Store in Zustand → Navigate back
- Detected flower stored temporarily (5-second expiration in `getDetectedFlower()`)

### AR & 3D Models
- **expo-gl** for WebGL rendering
- **three.js** v0.145.0 for 3D graphics
- Metro config customized to handle:
  - 3D file extensions (.glb, .gltf, .bin)
  - three.js ES module imports
  - Special resolver for `three/examples/` imports
- Babel plugin transforms `import.meta` for React Native compatibility
- On-device AR using ARKit (iOS) / ARCore (Android) - see [FREE_SETUP.md](FREE_SETUP.md)

### Styling & Theming
- Color constants in [constants/Colors.ts](constants/Colors.ts)
- Category-specific color schemes (`CategoryColors`)
- Gradient-heavy design with `expo-linear-gradient`
- Animated components using React Native Animated API

## Important Configuration Files

### [babel.config.js](babel.config.js)
- Custom plugin to transform `import.meta` → `{}` for RN compatibility
- `react-native-reanimated/plugin` must be last

### [metro.config.js](metro.config.js)
- Custom resolver for three.js examples imports
- Asset extensions include `.glb`, `.gltf`, `.bin`
- Experimental import support enabled

### [app.json](app.json)
- Camera permissions configured for iOS/Android
- ARKit support enabled (iOS)
- Min SDK 28 (Android)
- Hermes JS engine
- Bundle identifier: `com.bloomar.app`

## Development Notes

### Package Compatibility
Current warnings (non-blocking):
- `expo-gl@15.0.5` - expected `~16.0.9`
- `react-native-worklets@0.7.1` - expected `0.5.1`

These can be updated if issues arise, but app currently works with these versions.

### File Storage Locations
- Scanned flowers: `FileSystem.documentDirectory/flowers/`
- Persistent data: AsyncStorage key `bloomar-storage`

### Navigation Patterns
When navigating with params:
```typescript
router.push({
  pathname: '/camera',
  params: { category },
});
```

Access params in target screen:
```typescript
const params = useLocalSearchParams();
const category = params.category as string;
```

### State Reset Pattern
Always reset state when starting new bouquet:
```typescript
resetCurrentBouquet(); // Clears currentBouquet, detectedFlower, selectedCategory
```

## Testing & Running

### Device Testing
1. Install **Expo Go** app on phone (iOS/Android)
2. Run `npm run start:dev`
3. Scan QR code from terminal
4. Phone must be on same WiFi network

### Emulator Storage Issues
Android emulator may have insufficient storage for Expo Go. Solutions:
1. Use web version (press `w` in terminal)
2. Increase emulator internal storage in Android Studio Device Manager
3. Use physical device instead

### Web Testing
Press `w` after starting dev server. Best for UI/logic testing; AR features require native device.
