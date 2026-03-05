import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, PanResponder, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import { CameraView } from 'expo-camera';
import { useBouquetStore } from '@/store/bouquetStore';
import { LinearGradient } from 'expo-linear-gradient';
import { getFlowerModel } from '@/utils/modelRegistry';
import * as THREE from 'three';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Asset } from 'expo-asset';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export default function ARPreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { detectedFlower, currentBouquet } = useBouquetStore();

  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('Starting camera...');
  const [isCapturing, setIsCapturing] = useState(false);
  const glContextCreated = useRef(false);

  // Unique key to force GLView remount when flowers change
  const glViewKey = useRef(`gl-${Date.now()}`).current;

  // Refs
  const viewRef = useRef<View>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(0.8);

  // Timeout to handle if GL context never creates (runs only once on mount)
  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    timeoutId = setTimeout(() => {
      if (isMounted && !glContextCreated.current) {
        setLoadingStatus('Loading 3D engine...');
      }
    }, 1000);

    // Note: Removed the 20-second failsafe timeout - GLView can take longer on some devices
    // The loading overlay will be hidden when onContextCreate completes successfully

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []); // Empty dependency - only run once on mount

  // Pan responder for rotation and scaling
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {},
      onPanResponderMove: (evt, gestureState) => {
        // Single finger drag = rotate
        if (evt.nativeEvent.touches.length === 1) {
          rotationRef.current.y += gestureState.dx * 0.01;
          rotationRef.current.x += gestureState.dy * 0.01;
        }
        // Two finger pinch = scale (simplified)
        else if (evt.nativeEvent.touches.length === 2) {
          const scale = scaleRef.current + gestureState.dy * 0.001;
          scaleRef.current = Math.max(0.3, Math.min(2, scale)); // Clamp between 0.3 and 2
        }
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  const onContextCreate = async (gl: any) => {
    // Suppress THREE.GLTFLoader texture errors (React Native doesn't support Blob from ArrayBuffer)
    // We apply our own materials anyway, so textures aren't needed
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const msg = args[0]?.toString?.() || '';
      if (msg.includes('GLTFLoader') && msg.includes('texture')) {
        // Silently ignore texture loading errors
        return;
      }
      originalConsoleError.apply(console, args);
    };

    try {
      // Mark that GL context was created IMMEDIATELY
      glContextCreated.current = true;
      console.log('✅ GL context created');
      setLoadingStatus('Setting up 3D...');

      // Polyfill getShaderPrecisionFormat — can return null on some Android devices
      const _origPrecision = gl.getShaderPrecisionFormat?.bind(gl);
      if (_origPrecision) {
        gl.getShaderPrecisionFormat = (shaderType: number, precisionType: number) => {
          const result = _origPrecision(shaderType, precisionType);
          return result ?? { rangeMin: 1, rangeMax: 1, precision: 1 };
        };
      }

      // Polyfill getShaderInfoLog — returns null on some Android devices
      const _origShaderInfoLog = gl.getShaderInfoLog?.bind(gl);
      if (_origShaderInfoLog) {
        gl.getShaderInfoLog = (shader: WebGLShader) => _origShaderInfoLog(shader) ?? '';
      }

      // Polyfill getProgramInfoLog — same null issue on some Android devices
      const _origProgramInfoLog = gl.getProgramInfoLog?.bind(gl);
      if (_origProgramInfoLog) {
        gl.getProgramInfoLog = (program: WebGLProgram) => _origProgramInfoLog(program) ?? '';
      }

      // Create renderer with alpha so the camera feed shows through
      const renderer = new Renderer({
        gl,
        alpha: true,
        premultipliedAlpha: false,
        antialias: false,
      } as any);
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0x000000, 0); // fully transparent clear
      renderer.setClearAlpha(0); // Ensure alpha is 0
      rendererRef.current = renderer;

      // Create scene — no background so the live camera shows through
      const scene = new THREE.Scene();
      scene.background = null;
      sceneRef.current = scene;

      // Create camera
      const camera = new THREE.PerspectiveCamera(
        75,
        gl.drawingBufferWidth / gl.drawingBufferHeight,
        0.1,
        1000
      );
      camera.position.z = 3; // Closer to model
      cameraRef.current = camera;

      // Add lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 10, 7.5);
      scene.add(directionalLight);

      // Parent group — touch gestures rotate/scale the whole bouquet
      const bouquetGroup = new THREE.Group();
      scene.add(bouquetGroup);
      modelRef.current = bouquetGroup;

      // Determine flowers to render
      const bouquetFlowers = currentBouquet?.flowers ?? [];

      // Helper to calculate bouquet arrangement position
      const getBouquetPosition = (index: number, total: number) => {
        if (total === 1) {
          return { x: 0, y: 0, z: 0 }; // Single flower at center
        }
        // Arrange in a circular/bouquet pattern
        const angle = (index / total) * Math.PI * 2;
        const radius = 0.4 + (index % 2) * 0.15; // Varying radius for natural look
        const heightOffset = (index % 3) * 0.2 - 0.2; // Varying heights
        return {
          x: Math.cos(angle) * radius,
          y: heightOffset,
          z: Math.sin(angle) * radius - 0.3, // Slightly forward
        };
      };

      const flowersToRender = bouquetFlowers.length > 0
        ? bouquetFlowers.map((f, index) => ({
            flowerType: f.flowerType || 'rose',
            color: f.color,
            size: f.size || 0.8,
            // Use stored position if valid, otherwise calculate bouquet position
            position: (f.position && (f.position.x !== 0 || f.position.y !== 0 || f.position.z !== 0))
              ? f.position
              : getBouquetPosition(index, bouquetFlowers.length),
            rotation: f.rotation ?? (index * 45),
          }))
        : detectedFlower
          ? [{
              flowerType: detectedFlower.flowerType || 'rose',
              color: detectedFlower.color,
              size: 1.0,
              position: { x: 0, y: 0, z: 0 }, // Center position for single flower
              rotation: 0,
            }]
          : [];

      if (flowersToRender.length === 0) {
        setIsLoading(false);
        return;
      }

      setLoadingStatus('Loading models...');

      // Create loader instance
      const loader = new GLTFLoader();

      // Helper: load a GLB model with timeout
      const loadModel = (type: string): Promise<THREE.Group> =>
        new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout loading model: ${type}`));
          }, 10000); // 10 second timeout

          const info = getFlowerModel(type as any);
          const asset = Asset.fromModule(info.modelPath);

          asset.downloadAsync()
            .then(() => {
              loader.load(
                asset.localUri || asset.uri,
                (gltf: any) => {
                  clearTimeout(timeoutId);
                  resolve(gltf.scene);
                },
                undefined,
                (error) => {
                  clearTimeout(timeoutId);
                  reject(error);
                }
              );
            })
            .catch((error) => {
              clearTimeout(timeoutId);
              reject(error);
            });
        });

      // Pre-load all unique flower types IN PARALLEL
      const uniqueTypes = [...new Set(flowersToRender.map(f => f.flowerType))];
      const typeToModel: Record<string, THREE.Group> = {};

      // Load all models in parallel with Promise.allSettled for better error handling
      const modelPromises = uniqueTypes.map(async (type) => {
        try {
          console.log('⏳ Loading model:', type);
          const model = await loadModel(type);
          console.log('✅ Loaded model:', type, '- children:', model.children.length);
          return { type, model, success: true };
        } catch (e: any) {
          console.warn('⚠️ Failed to load model:', type, '- Error:', e?.message || e);
          return { type, model: null, success: false };
        }
      });

      const loadedModels = await Promise.all(modelPromises);
      loadedModels.forEach(({ type, model }) => {
        if (model) {
          // Compute bounding box to understand model's actual size
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const center = new THREE.Vector3();
          box.getCenter(center);
          console.log(`📏 Model "${type}" bounds:`, {
            size: { x: size.x.toFixed(3), y: size.y.toFixed(3), z: size.z.toFixed(3) },
            center: { x: center.x.toFixed(3), y: center.y.toFixed(3), z: center.z.toFixed(3) },
            maxDimension: Math.max(size.x, size.y, size.z).toFixed(3),
          });
          typeToModel[type] = model;
        }
      });

      // Log which models loaded successfully
      console.log('📊 Model loading summary:', {
        requested: uniqueTypes,
        loaded: Object.keys(typeToModel),
        failed: uniqueTypes.filter(t => !typeToModel[t]),
      });

      setLoadingStatus('Rendering...');

      // Check if any models loaded successfully
      const loadedCount = Object.keys(typeToModel).length;
      console.log(`📦 Loaded ${loadedCount} unique model types:`, Object.keys(typeToModel));

      // Always create visible flowers - use spheres if models fail
      for (const flower of flowersToRender) {
        console.log('🌼 Creating flower:', flower.flowerType, 'at', flower.position, 'color:', flower.color);

        const baseModel = typeToModel[flower.flowerType];

        if (baseModel) {
          // Clone so each instance has independent transforms/materials
          const instance = baseModel.clone();

          // Compute bounding box to normalize scale across different models
          const box = new THREE.Box3().setFromObject(instance);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);

          // Normalize: scale model so its largest dimension equals TARGET_SIZE
          // This ensures all models (tulip, sunflower, rose, etc.) appear at consistent size
          const TARGET_SIZE = 1.2; // Desired visible size in scene units
          const normalizeScale = maxDim > 0 ? TARGET_SIZE / maxDim : 1;
          const finalScale = normalizeScale * flower.size;

          console.log(`🔧 Scaling "${flower.flowerType}": maxDim=${maxDim.toFixed(3)}, normalizeScale=${normalizeScale.toFixed(3)}, finalScale=${finalScale.toFixed(3)}`);

          // Apply the flower's own color
          instance.traverse((child: any) => {
            if (child instanceof THREE.Mesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: flower.color,
                side: THREE.DoubleSide,
                metalness: 0.1,
                roughness: 0.8,
              });
            }
          });

          // Center the model on its bounding box center (some models have off-center origins)
          const center = new THREE.Vector3();
          box.getCenter(center);
          instance.position.set(
            flower.position.x - center.x * finalScale,
            flower.position.y - center.y * finalScale,
            flower.position.z - center.z * finalScale
          );

          // Apply normalized scale
          instance.scale.setScalar(finalScale);

          // Rotate flower to face outward from center (bouquet style)
          const angleToCenter = Math.atan2(flower.position.x, flower.position.z);
          instance.rotation.y = angleToCenter + (flower.rotation * Math.PI) / 180;
          // Slight tilt outward for natural bouquet look
          instance.rotation.x = -0.2;

          bouquetGroup.add(instance);
          console.log('✅ Added 3D model for:', flower.flowerType, 'at', flower.position, 'scale:', finalScale.toFixed(3));
        } else {
          // Fallback: create a visible colored sphere at the correct position
          console.log('⚠️ No model for', flower.flowerType, '- using sphere fallback at', flower.position);
          const geometry = new THREE.SphereGeometry(0.4, 32, 32);
          const material = new THREE.MeshStandardMaterial({
            color: flower.color,
            metalness: 0.2,
            roughness: 0.6,
          });
          const sphere = new THREE.Mesh(geometry, material);
          sphere.position.set(flower.position.x, flower.position.y, flower.position.z);
          sphere.scale.setScalar(flower.size * 1.5);
          bouquetGroup.add(sphere);
          console.log('✅ Added fallback sphere for:', flower.flowerType);
        }
      }

      console.log(`🌸 Rendered ${flowersToRender.length} flower(s) in bouquet`);

      // Start animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        if (modelRef.current) {
          modelRef.current.rotation.x = rotationRef.current.x;
          modelRef.current.rotation.y = rotationRef.current.y;
          modelRef.current.scale.set(scaleRef.current, scaleRef.current, scaleRef.current);
        }
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      animate();

      // Done loading - set this AFTER animation starts
      console.log('✅ 3D scene setup complete, hiding loading overlay');

      // Restore original console.error after loading is complete
      console.error = originalConsoleError;

      setIsLoading(false);
    } catch (error) {
      // Restore console.error before logging the error
      console.error = originalConsoleError;
      console.error('❌ Error setting up 3D scene:', error);
      setLoadingStatus('Error loading...');
      // Still hide loading after a short delay so user can see the error
      setTimeout(() => setIsLoading(false), 1500);
    }
  };

  const handleContinue = () => {
    // Navigate to editor to see color, shape, and confidence
    router.push('/editor');
  };

  const handleRetake = () => {
    // Clear detected flower and go back to camera with fresh state
    const { setDetectedFlower } = useBouquetStore.getState();
    setDetectedFlower(null);
    router.replace('/camera');
  };

  const handleCaptureAndShare = async () => {
    if (!viewRef.current) {
      Alert.alert('Error', 'Unable to capture screen');
      return;
    }

    try {
      setIsCapturing(true);

      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant permission to save photos to your library'
        );
        setIsCapturing(false);
        return;
      }

      // Capture the AR/3D view
      const uri = await captureRef(viewRef, {
        format: 'png',
        quality: 0.9,
      });

      console.log('📸 Screenshot captured:', uri);

      // Save to media library
      await MediaLibrary.saveToLibraryAsync(uri);

      // Share if available
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your BloomAR bouquet',
        });
      }

      Alert.alert('Success', 'Bouquet saved to gallery!');
    } catch (error) {
      console.error('❌ Capture error:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const flowerType = detectedFlower?.flowerType || 'generic-flower';
  const flowerName = detectedFlower?.flowerName || 'Flower';
  const modelInfo = getFlowerModel(flowerType as any);

  // Get all flowers from current bouquet (multi-flower support)
  const flowers = currentBouquet?.flowers || [];
  const hasMultipleFlowers = flowers.length > 0;

  // Use bouquet flowers if available, otherwise show single detected flower
  const flowersToRender = hasMultipleFlowers
    ? flowers.map(f => ({
        flowerType: f.flowerType || 'generic-flower',
        position: f.position,
        rotation: f.rotation,
        scale: f.size,
      }))
    : [{
        flowerType,
        position: { x: 0, y: 0, z: -1 },
        rotation: 0,
        scale: 0.3,
      }];

  return (
    <View style={styles.container} ref={viewRef} collapsable={false}>
      {/* Live camera feed as AR background - full screen */}
      <View style={styles.cameraContainer}>
        <CameraView style={styles.fullScreenCamera} facing="back" />
      </View>

      {/* 3D model overlay on top of camera - absolute positioned */}
      <View
        style={styles.glOverlay}
        {...panResponder.panHandlers}
        onLayout={(e) => console.log('📐 GL overlay laid out:', e.nativeEvent.layout)}
        pointerEvents="box-none"
      >
        <GLView
          key={glViewKey}
          style={[styles.glView, { backgroundColor: 'transparent' }]}
          onContextCreate={(gl) => {
            console.log('🎮 GLView onContextCreate triggered, gl:', !!gl);
            onContextCreate(gl);
          }}
          onLayout={(e) => console.log('📐 GLView layout:', e.nativeEvent.layout)}
          msaaSamples={0}
        />
      </View>

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#FFD166" />
            <Text style={styles.loadingText}>{loadingStatus}</Text>
            <View style={styles.loadingDots}>
              <Text style={styles.loadingDotsText}>Please wait</Text>
            </View>
          </View>
        </View>
      )}


      {/* Instructions */}
      <View style={styles.instructionsContainer} pointerEvents="none">
        <Text style={styles.instructionsText}>
          {modelInfo.emoji} 3D {hasMultipleFlowers ? 'Bouquet' : flowerName} Preview
        </Text>
        <Text style={styles.instructionsSubtext}>
          {hasMultipleFlowers && `${flowers.length} flowers • `}
          View your bouquet in 3D
        </Text>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomControls} pointerEvents="box-none">
        <View style={styles.buttonContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleRetake}
          >
            <Text style={styles.secondaryButtonText}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleContinue}
          >
            <LinearGradient
              colors={['#FFD166', '#FFB84D']}
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={styles.hintText}>
          Tap Continue to see color, shape & confidence
        </Text>
      </View>
    </View>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 0,
  },
  fullScreenCamera: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  glOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  glView: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: 'transparent',
  },
  touchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 100, // On top of everything
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingContent: {
    alignItems: 'center',
    padding: 30,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  loadingText: {
    color: '#FFD166',
    fontSize: 18,
    marginTop: 16,
    fontWeight: '700',
  },
  loadingDots: {
    marginTop: 8,
  },
  loadingDotsText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 5,
    alignItems: 'center',
  },
  infoBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 209, 102, 0.9)',
    marginBottom: 12,
  },
  infoText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  instructionsContainer: {
    position: 'absolute',
    top: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 5,
  },
  instructionsText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  instructionsSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: 24,
    paddingTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 200, // Above touch overlay so buttons work
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FFD166',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  captureButton: {
    marginTop: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 209, 102, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#FFD166',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  captureButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
