# BloomAR - Quick Start Guide

## 🚀 Running the App

### Step 1: Clear Cache and Start Dev Server
```bash
npm start -- --clear
# Or alternatively:
npx expo start --clear
```

### Step 2: Connect Your Device

#### Option A: Physical Device (Recommended for AR)
1. Install **Expo Go** app from App Store (iOS) or Google Play (Android)
2. Make sure your phone is on the **same WiFi** network as your computer
3. Scan the QR code shown in terminal

#### Option B: Web Browser (Testing Only - No AR)
- Press `w` in the terminal after dev server starts
- Opens in browser at `http://localhost:8081`

#### Option C: Emulator
- Press `a` for Android emulator
- Press `i` for iOS simulator
- **Note:** AR features won't work in emulators!

---

## 🐛 Troubleshooting

### Error: "Failed to download remote update"
**Fixed!** Updates are now disabled in development mode via `app.json`.

### Port 8081 Already in Use
```bash
# Windows:
taskkill //F //PID <PID>

# Or start on different port:
npx expo start --port 8082
```

### Module Not Found Errors
```bash
npm install
npx expo start --clear
```

### TensorFlow/ML Model Issues
If ML detection fails, the app will gracefully fall back to manual flower selection.

---

## ✅ Testing the New Features

### Phase 2: ML Flower Detection
1. Open app → Tap category (e.g., Wedding)
2. Capture a flower photo with camera
3. **Watch:** ML model automatically detects flower type
4. If confidence > 60%, navigates directly to AR preview
5. If confidence < 60%, shows manual selection modal

### Phase 3: Multi-Flower AR
1. After detecting a flower, tap "Continue" to editor
2. Tap "Add Flower" to add more flowers to bouquet
3. Navigate to AR preview
4. **See:** All flowers rendered in radial arrangement

### Phase 4: Export & Share
1. In AR/3D preview screen
2. Tap **"📸 Capture & Share"** button (top)
3. Grant photo library permission
4. Screenshot saved to gallery + share dialog opens

### Phase 5: Ground Plane Detection
1. In AR mode, tap **"Enter AR Mode"**
2. Tap **"⚪ Show Surfaces"** toggle
3. **See:** Green semi-transparent plane visualization

---

## 📱 Device Requirements

### For AR Features:
- **iOS:** iPhone 6S or newer (ARKit support)
- **Android:** Android 7.0+ with ARCore support

### Check AR Support:
```javascript
// The app automatically checks and falls back to 3D mode if AR unsupported
console.log('AR Platform:', getARPlatform());
```

---

## 🎨 New Dependencies Installed

```json
{
  "@react-three/fiber": "^9.5.0",      // React renderer for Three.js
  "@react-three/xr": "^6.6.29",        // WebXR/AR support
  "@tensorflow/tfjs": "^4.22.0",       // ML framework
  "@tensorflow-models/mobilenet": "^2.1.1", // Pre-trained model
  "react-native-view-shot": "^4.0.3",  // Screenshot capture
  "expo-sharing": "^55.0.11"           // Native share dialog
}
```

---

## 🔥 Known Issues

### WebXR Browser Compatibility
- React Native WebXR support is experimental
- AR works best on native mobile devices
- Web browser AR requires WebXR-compatible browser (Chrome Android)

### ML Model Loading
- First load downloads ~5MB MobileNet model
- Subsequent runs use cached model
- Inference takes 1-2 seconds per image

### Performance
- Testing with 5+ flowers may impact FPS on older devices
- Disable shadows if performance is poor

---

## 📊 Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Camera Capture | ✅ Working | Uses expo-camera |
| ML Detection | ✅ Working | MobileNet classification |
| Manual Selection | ✅ Working | Fallback when ML confidence low |
| 3D Preview | ✅ Working | Three.js rendering |
| AR Mode | ⚠️ Needs Testing | Requires physical device |
| Multi-Flower | ✅ Working | Radial auto-positioning |
| Export/Share | ✅ Working | Screenshot + native share |
| Plane Visualization | ✅ Working | Toggle-able green plane |

---

## 🎯 Testing Checklist

- [ ] Capture flower photo
- [ ] Verify ML detection accuracy
- [ ] Navigate to AR preview
- [ ] Add multiple flowers to bouquet
- [ ] Test "Enter AR Mode" button
- [ ] Toggle surface visualization
- [ ] Capture and share screenshot
- [ ] Verify photo saved to gallery

---

## 💡 Pro Tips

1. **Better ML Accuracy:** Take clear, well-lit photos of flowers
2. **AR Placement:** Move phone slowly to help plane detection
3. **Performance:** Reduce number of flowers if FPS drops
4. **Debugging:** Check Metro bundler logs for errors

---

## 🆘 Need Help?

Check the console logs:
```bash
# Metro bundler shows all console.log output
# Look for these markers:
🤖 # ML-related logs
🌸 # Flower detection logs
📸 # Screenshot/capture logs
✅ # Success messages
❌ # Error messages
```

---

**Happy Testing! 🌸**
