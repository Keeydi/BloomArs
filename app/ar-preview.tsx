import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import { useBouquetStore } from '@/store/bouquetStore';
import { LinearGradient } from 'expo-linear-gradient';
import { getFlowerModel } from '@/utils/modelRegistry';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { XR, createXRStore } from '@react-three/xr';
import { checkARSupport, initializeAR, setXRSession, clearXRSession, hitTest } from '@/utils/arUtils';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

// XR Store for managing AR session
const xrStore = createXRStore();

// Component for visualizing detected ground planes
function GroundPlane({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[2, 2]} />
      <meshStandardMaterial
        color="#00ff00"
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Component for rendering 3D flower model in AR
function FlowerModel({ flowerType }: { flowerType: string }) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadModel = async () => {
      try {
        const Asset = await import('expo-asset');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const loader = new GLTFLoader();

        const modelInfo = getFlowerModel(flowerType as any);
        console.log('🌸 Loading AR model for:', modelInfo.displayName);

        const modelAsset = Asset.Asset.fromModule(modelInfo.modelPath);
        await modelAsset.downloadAsync();

        loader.load(
          modelAsset.localUri || modelAsset.uri,
          (gltf: any) => {
            const flowerModel = gltf.scene;

            // Scale and position for AR
            flowerModel.scale.set(0.3, 0.3, 0.3); // Smaller for real-world scale
            flowerModel.position.set(0, 0, -1); // 1 meter in front

            // Ensure materials render correctly
            flowerModel.traverse((child: any) => {
              if (child instanceof THREE.Mesh) {
                if (child.material) {
                  child.material.needsUpdate = true;
                  child.castShadow = true;
                  child.receiveShadow = true;
                }
              }
            });

            setModel(flowerModel);
            setLoading(false);
          },
          undefined,
          (error) => {
            console.error('Error loading AR model:', error);
            setLoading(false);
          }
        );
      } catch (error) {
        console.error('Error setting up AR model:', error);
        setLoading(false);
      }
    };

    loadModel();
  }, [flowerType]);

  if (loading || !model) {
    return null;
  }

  return <primitive object={model} />;
}

export default function ARPreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { detectedFlower, currentBouquet } = useBouquetStore();

  const [isLoading, setIsLoading] = useState(true);
  const [arSupported, setArSupported] = useState(false);
  const [useARMode, setUseARMode] = useState(true); // Toggle between AR and 3D preview
  const [arError, setArError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showPlanes, setShowPlanes] = useState(false); // Toggle plane visualization

  // Refs
  const viewRef = useRef<View>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(0.8);

  // Check AR support on mount
  useEffect(() => {
    const checkSupport = async () => {
      try {
        const supported = await checkARSupport();
        setArSupported(supported);

        if (!supported) {
          console.warn('AR not supported on this device, falling back to 3D preview');
          setUseARMode(false);
          setArError('AR not supported on this device');
        } else {
          const initialized = await initializeAR();
          if (!initialized) {
            console.warn('AR initialization failed, falling back to 3D preview');
            setUseARMode(false);
            setArError('AR initialization failed');
          }
        }
      } catch (error) {
        console.error('Error checking AR support:', error);
        setUseARMode(false);
        setArError('Error checking AR support');
      }
    };

    checkSupport();

    // Cleanup XR session on unmount
    return () => {
      clearXRSession();
    };
  }, []);

  // Monitor XR session state
  useEffect(() => {
    const unsubscribe = xrStore.subscribe((state) => {
      if (state.session) {
        console.log('AR session started');
        state.session.requestReferenceSpace('local').then((referenceSpace) => {
          setXRSession(state.session!, referenceSpace);
          setIsLoading(false);
        });
      } else {
        console.log('AR session ended');
        clearXRSession();
      }
    });

    return () => unsubscribe();
  }, []);

  const onContextCreate = async (gl: any) => {
    try {
      // Create renderer
      const renderer = new Renderer({ gl });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      rendererRef.current = renderer;

      // Create scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000); // Black background
      sceneRef.current = scene;

      // Create camera
      const camera = new THREE.PerspectiveCamera(
        75,
        gl.drawingBufferWidth / gl.drawingBufferHeight,
        0.1,
        1000
      );
      camera.position.z = 5;
      cameraRef.current = camera;

      // Add lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 10, 7.5);
      scene.add(directionalLight);

      // Load the GLB model based on detected flower type
      const Asset = await import('expo-asset');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();

      // Get the appropriate model for detected flower type
      const flowerType = detectedFlower?.flowerType || 'generic-flower';
      const modelInfo = getFlowerModel(flowerType as any);

      console.log('🌸 Loading 3D model for:', modelInfo.displayName);

      const modelAsset = Asset.Asset.fromModule(modelInfo.modelPath);
      await modelAsset.downloadAsync();

      // Suppress console errors for texture loading (we're using our own textures)
      const originalError = console.error;
      console.error = (...args: any[]) => {
        if (args[0]?.includes?.('THREE.GLTFLoader: Couldn\'t load texture')) {
          return; // Suppress this specific error
        }
        originalError(...args);
      };

      loader.load(
        modelAsset.localUri || modelAsset.uri,
        (gltf: any) => {
          // Restore console.error
          console.error = originalError;
          // Model loaded successfully
          const flowerModel = gltf.scene;

          // Scale and position the model - smaller initial scale
          flowerModel.scale.set(0.8, 0.8, 0.8);
          flowerModel.position.set(0, -1, 0);

          // Ensure materials render correctly with textures
          flowerModel.traverse((child: any) => {
            if (child instanceof THREE.Mesh) {
              if (child.material) {
                child.material.needsUpdate = true;
                child.castShadow = true;
                child.receiveShadow = true;
              }
            }
          });

          scene.add(flowerModel);
          modelRef.current = flowerModel;
          setIsLoading(false);

          // Animation loop with manual rotation and scale control
          const animate = () => {
            requestAnimationFrame(animate);

            // Apply rotation and scale from touch gestures
            if (modelRef.current) {
              modelRef.current.rotation.x = rotationRef.current.x;
              modelRef.current.rotation.y = rotationRef.current.y;
              modelRef.current.scale.set(scaleRef.current, scaleRef.current, scaleRef.current);
            }

            renderer.render(scene, camera);
            gl.endFrameEXP();
          };

          animate();
        },
        (progress) => {
          // Loading progress
          console.log('Loading model:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
        },
        (error) => {
          // Restore console.error
          console.error = originalError;
          console.error('Error loading GLB model:', error);
          setIsLoading(false);

          // Fallback: create a simple placeholder if model fails to load
          const geometry = new THREE.SphereGeometry(1, 32, 32);
          const material = new THREE.MeshStandardMaterial({
            color: detectedFlower?.color || '#FFD166',
          });
          const sphere = new THREE.Mesh(geometry, material);
          scene.add(sphere);

          const animate = () => {
            requestAnimationFrame(animate);
            sphere.rotation.y += 0.01;
            renderer.render(scene, camera);
            gl.endFrameEXP();
          };
          animate();
        }
      );
    } catch (error) {
      console.error('Error setting up 3D scene:', error);
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    // Navigate to editor to see color, shape, and confidence
    router.push('/editor');
  };

  const handleRetake = () => {
    // Go back to camera
    router.back();
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
      {/* Render AR mode or fallback 3D preview */}
      {useARMode && arSupported ? (
        <>
          {/* WebXR AR View */}
          <Canvas
            style={styles.glView}
            gl={{ alpha: true }}
          >
            <XR store={xrStore}>
              {/* Lighting */}
              <ambientLight intensity={0.6} />
              <directionalLight position={[5, 10, 7.5]} intensity={0.8} castShadow />

              {/* Ground plane visualization (optional) */}
              <GroundPlane visible={showPlanes} />

              {/* Render all flowers in AR */}
              {flowersToRender.map((flower, index) => (
                <group
                  key={index}
                  position={[flower.position.x, flower.position.y, flower.position.z]}
                  rotation={[0, (flower.rotation * Math.PI) / 180, 0]}
                  scale={[flower.scale, flower.scale, flower.scale]}
                >
                  <FlowerModel flowerType={flower.flowerType} />
                </group>
              ))}
            </XR>
          </Canvas>

          {/* AR Entry Button */}
          <View style={styles.arEntryContainer}>
            <TouchableOpacity
              style={styles.arEntryButton}
              onPress={() => xrStore.enterAR()}
            >
              <LinearGradient
                colors={['#FFD166', '#FFB84D']}
                style={styles.primaryButtonGradient}
              >
                <Text style={styles.primaryButtonText}>Enter AR Mode</Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.arEntryHint}>
              Place your flower in the real world
            </Text>
          </View>
        </>
      ) : (
        <>
          {/* Fallback: Traditional 3D View */}
          <GLView
            style={styles.glView}
            onContextCreate={onContextCreate}
          />

          {arError && (
            <View style={styles.warningBadge}>
              <Text style={styles.warningText}>
                {arError} - Using 3D preview mode
              </Text>
            </View>
          )}
        </>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFD166" />
          <Text style={styles.loadingText}>
            {useARMode ? 'Initializing AR...' : 'Loading 3D Preview...'}
          </Text>
        </View>
      )}

      {/* Top overlay */}
      <View style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.infoBadge}>
          <Text style={styles.infoText}>
            {useARMode && arSupported ? 'AR Preview' : '3D Preview'}
          </Text>
        </View>

        {/* Capture button */}
        <TouchableOpacity
          style={styles.captureButton}
          onPress={handleCaptureAndShare}
          disabled={isCapturing}
        >
          <Text style={styles.captureButtonText}>
            {isCapturing ? '📸 Saving...' : '📸 Capture & Share'}
          </Text>
        </TouchableOpacity>

        {/* Plane toggle (only in AR mode) */}
        {useARMode && arSupported && (
          <TouchableOpacity
            style={styles.planeToggleButton}
            onPress={() => setShowPlanes(!showPlanes)}
          >
            <Text style={styles.planeToggleText}>
              {showPlanes ? '🟢 Hide Surfaces' : '⚪ Show Surfaces'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer} pointerEvents="none">
        <Text style={styles.instructionsText}>
          {modelInfo.emoji} {useARMode ? 'AR' : '3D'} {hasMultipleFlowers ? 'Bouquet' : flowerName} Preview
        </Text>
        <Text style={styles.instructionsSubtext}>
          {hasMultipleFlowers && `${flowers.length} flowers • `}
          {useARMode && arSupported
            ? 'Tap "Enter AR" to place in real world'
            : 'View your bouquet in 3D'}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 1)', // Solid black, gestures handled here
  },
  glView: {
    flex: 1,
  },
  touchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 100, // On top of everything
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
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
  },
  infoBadge: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 209, 102, 0.9)',
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
  arEntryContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 150,
  },
  arEntryButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FFD166',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  arEntryHint: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  warningBadge: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 165, 0, 0.9)',
    zIndex: 5,
  },
  warningText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
  planeToggleButton: {
    marginTop: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  planeToggleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
