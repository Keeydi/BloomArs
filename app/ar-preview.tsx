import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useRef } from 'react';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import { useBouquetStore } from '@/store/bouquetStore';
import { LinearGradient } from 'expo-linear-gradient';
import { getFlowerModel } from '@/utils/modelRegistry';
import * as THREE from 'three';

export default function ARPreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { detectedFlower } = useBouquetStore();

  const [isLoading, setIsLoading] = useState(true);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(0.8); // Initial scale - smaller/zoomed out

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

  return (
    <View style={styles.container}>
      {/* 3D View with touch controls */}
      <GLView
        style={styles.glView}
        onContextCreate={onContextCreate}
      />


      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFD166" />
          <Text style={styles.loadingText}>Loading 3D Preview...</Text>
        </View>
      )}

      {/* Top overlay */}
      <View style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.infoBadge}>
          <Text style={styles.infoText}>AR Preview</Text>
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer} pointerEvents="none">
        <Text style={styles.instructionsText}>
          {getFlowerModel(detectedFlower?.flowerType as any || 'generic-flower').emoji} 3D {detectedFlower?.flowerName || 'Flower'} Preview
        </Text>
        <Text style={styles.instructionsSubtext}>
          View your flower in 3D
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
});
