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
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [isCapturing, setIsCapturing] = useState(false);

  // Refs
  const viewRef = useRef<View>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(0.8);

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
    try {
      // Polyfill getShaderPrecisionFormat — can return null on some Android devices
      const _origPrecision = gl.getShaderPrecisionFormat?.bind(gl);
      if (_origPrecision) {
        gl.getShaderPrecisionFormat = (shaderType: number, precisionType: number) => {
          const result = _origPrecision(shaderType, precisionType);
          return result ?? { rangeMin: 1, rangeMax: 1, precision: 1 };
        };
      }

      // Polyfill getShaderInfoLog — returns null on some Android devices;
      // Three.js calls .trim() on the result which crashes if null
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
      const renderer = new Renderer({ gl, alpha: true } as any);
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0x000000, 0); // fully transparent clear
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

      // Determine flowers to render:
      //   - If bouquet has flowers (came from editor), use those (with customized colors)
      //   - Otherwise fall back to the freshly detected flower (came directly from camera)
      const bouquetFlowers = currentBouquet?.flowers ?? [];
      const flowersToRender = bouquetFlowers.length > 0
        ? bouquetFlowers.map(f => ({
            flowerType: f.flowerType || 'rose',
            color: f.color,
            size: f.size,
            position: f.position,
            rotation: f.rotation,
          }))
        : detectedFlower
          ? [{
              flowerType: detectedFlower.flowerType || 'rose',
              color: detectedFlower.color,
              size: 0.8,
              position: { x: 0, y: -1, z: 0 },
              rotation: 0,
            }]
          : [];

      if (flowersToRender.length === 0) {
        setIsLoading(false);
        return;
      }

      setLoadingStatus('Loading 3D models...');

      // Create loader instance (GLTFLoader is pre-imported at top)
      const loader = new GLTFLoader();

      // Helper: load a GLB model by flower type, returns a Three.Group
      const loadModel = (type: string): Promise<THREE.Group> =>
        new Promise((resolve, reject) => {
          const info = getFlowerModel(type as any);
          const asset = Asset.fromModule(info.modelPath);
          asset.downloadAsync().then(() => {
            loader.load(
              asset.localUri || asset.uri,
              (gltf: any) => resolve(gltf.scene),
              undefined,
              reject
            );
          }).catch(reject);
        });

      // Pre-load all unique flower types IN PARALLEL for faster loading
      const uniqueTypes = [...new Set(flowersToRender.map(f => f.flowerType))];
      const typeToModel: Record<string, THREE.Group> = {};

      // Load all models in parallel using Promise.all
      const modelPromises = uniqueTypes.map(async (type) => {
        try {
          const model = await loadModel(type);
          console.log('✅ Loaded model for:', type);
          return { type, model };
        } catch (e) {
          console.warn('⚠️ Failed to load model for:', type, e);
          return { type, model: null };
        }
      });

      const loadedModels = await Promise.all(modelPromises);
      loadedModels.forEach(({ type, model }) => {
        if (model) typeToModel[type] = model;
      });

      setLoadingStatus('Rendering...');

      // Instantiate each flower in the bouquet
      for (const flower of flowersToRender) {
        const baseModel = typeToModel[flower.flowerType];
        if (!baseModel) continue;

        // Clone so each instance has independent transforms/materials
        const instance = baseModel.clone();

        // Apply the flower's own color (user may have changed it in the editor)
        instance.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshBasicMaterial({
              color: flower.color,
              side: THREE.DoubleSide,
            });
          }
        });

        instance.position.set(flower.position.x, flower.position.y, flower.position.z);
        instance.scale.setScalar(flower.size * 1.0);
        instance.rotation.y = (flower.rotation * Math.PI) / 180;

        bouquetGroup.add(instance);
      }

      setIsLoading(false);
      console.log(`🌸 Rendered ${flowersToRender.length} flower(s) in bouquet`);

      // Animation loop — gestures rotate/scale the whole bouquet group
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
      <View style={styles.glOverlay} {...panResponder.panHandlers}>
        <GLView
          style={styles.glView}
          onContextCreate={onContextCreate}
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
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  glView: {
    flex: 1,
    width: '100%',
    height: '100%',
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
