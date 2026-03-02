# 🌻 AR Sunflower Setup Guide

## ✅ What's Already Done

1. **AR Preview Screen** created at [app/ar-preview.tsx](app/ar-preview.tsx)
2. **Navigation flow** updated:
   ```
   Camera → Capture → AR Preview (3D) → Continue → Editor (Color/Shape/Confidence)
   ```
3. **Three.js setup** with WebGL rendering
4. **Placeholder sphere** showing with detected flower color

---

## 📦 How to Add Your Sunflower 3D Model

### Step 1: Prepare Your 3D Model

Your sunflower model should be in **GLB** or **GLTF** format.

**Recommended specs:**
- Format: `.glb` (preferred) or `.gltf`
- Polygon count: < 10,000 triangles (for mobile performance)
- Textures: Max 1024x1024px
- File size: < 5MB

### Step 2: Add Model to Assets

1. Create an assets folder for 3D models:
   ```
   mkdir -p assets/models
   ```

2. Place your sunflower model:
   ```
   assets/models/sunflower.glb
   ```

### Step 3: Update app.json

Add the model to asset bundle patterns in [app.json](app.json):

```json
{
  "expo": {
    "assetBundlePatterns": [
      "**/*",
      "assets/models/**/*.glb"
    ]
  }
}
```

### Step 4: Update AR Preview Screen

Edit [app/ar-preview.tsx](app/ar-preview.tsx) and replace the placeholder code:

#### Find this section (around line 57-65):
```typescript
// Create placeholder 3D object (will be replaced with sunflower model)
const geometry = new THREE.SphereGeometry(1, 32, 32);
const material = new THREE.MeshStandardMaterial({
  color: flowerColor,
  metalness: 0.2,
  roughness: 0.8,
});
const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);
```

#### Replace with:
```typescript
// Load sunflower GLB model
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
const loader = new GLTFLoader();

// Load the model
const asset = require('../assets/models/sunflower.glb');
const gltf = await new Promise((resolve, reject) => {
  loader.load(
    asset,
    (gltf) => resolve(gltf),
    undefined,
    (error) => reject(error)
  );
});

// Add model to scene
const sunflowerModel = gltf.scene;
sunflowerModel.scale.set(2, 2, 2); // Adjust scale as needed
scene.add(sunflowerModel);

// Store reference for animation
const modelRef = sunflowerModel;
```

#### Update the animation loop (around line 74):
```typescript
// Animation loop
const animate = () => {
  requestAnimationFrame(animate);

  // Rotate the sunflower model
  if (modelRef) {
    modelRef.rotation.y += 0.01;
  }

  renderer.render(scene, camera);
  gl.endFrameEXP();
};
```

---

## 🎨 Customization Options

### Adjust Model Size
```typescript
sunflowerModel.scale.set(1.5, 1.5, 1.5); // Make smaller/larger
```

### Change Position
```typescript
sunflowerModel.position.set(0, -1, 0); // Move down
sunflowerModel.position.set(0, 0.5, 0); // Move up
```

### Adjust Lighting
```typescript
// Make brighter
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);

// Add more directional light
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(10, 20, 15);
```

### Apply Detected Color to Model
```typescript
// Tint the sunflower with detected color
sunflowerModel.traverse((child) => {
  if (child instanceof THREE.Mesh) {
    child.material.color.set(flowerColor);
  }
});
```

---

## 🎯 Current Flow

### 1. Scan Flower
- Camera captures image
- Color extracted from image

### 2. AR Preview (NEW!)
- Shows 3D sunflower model
- Rotates automatically
- Uses detected flower color
- **"Continue" button** → Goes to Editor

### 3. Editor
- Shows detected **color**, **shape**, **confidence**
- Add to bouquet
- Scan more flowers

---

## 🐛 Troubleshooting

### Model not loading?
1. Check file path is correct
2. Verify GLB file is valid (open in Blender or online viewer)
3. Check console logs for errors

### Model too big/small?
```typescript
sunflowerModel.scale.set(X, Y, Z); // Adjust numbers
```

### Model wrong orientation?
```typescript
sunflowerModel.rotation.x = Math.PI / 2; // Rotate 90 degrees
sunflowerModel.rotation.z = Math.PI; // Rotate 180 degrees
```

### Performance issues?
- Reduce polygon count in Blender
- Compress textures
- Use smaller texture sizes (512x512)

---

## 📱 Testing

1. **Rebuild app** after adding model:
   ```bash
   npm run start:dev
   ```

2. **Test flow**:
   - Select category
   - Open editor
   - Click "Scan Another Flower"
   - Capture flower
   - **AR Preview should show** with 3D model
   - Click "Continue"
   - See color/shape/confidence in editor

---

## 🚀 Next Steps

After adding your sunflower model, you can:

1. Add more flower models (rose, tulip, etc.)
2. Match model to detected flower type
3. Add AR placement (place in real world)
4. Add gesture controls (pinch to scale, rotate)
5. Add multiple flowers in AR scene

Let me know when you're ready to add your GLB file! 🌻
