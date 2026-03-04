import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, PanResponder, Modal, ScrollView, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { useBouquetStore } from '@/store/bouquetStore';
import { BackgroundGradient } from '@/components/BackgroundGradient';
import { extractDominantColor } from '@/utils/colorExtractor';
import { getFlowerModel, FLOWER_MODELS } from '@/utils/modelRegistry';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { LinearGradient } from 'expo-linear-gradient';
import { detectFlowerML, preloadMLModel, isMLModelReady } from '@/utils/mlFlowerDetector';
import { detectFlowerByImage } from '@/utils/imageFlowerDetector';

// Simple color-based flower detection
function detectFlowerByColor(hexColor: string) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return { flowerType: 'rose', flowerName: 'Rose', color: hexColor, shape: 'round', confidence: 0.8 };

  const { r, g, b } = rgb;

  console.log(`🎨 RGB values: R=${r}, G=${g}, B=${b}`);

  // Purple/Lavender tulips (CHECK FIRST - your tulip is #86708C = RGB(134, 112, 140))
  if (b > 120 && b > r && b > g) {
    return { flowerType: 'tulip', flowerName: 'Tulip', color: hexColor, shape: 'round', confidence: 0.85 };
  }

  // Pink tulips
  if (r > 150 && b > 120 && Math.abs(r - b) < 60 && g > 80 && g < 150) {
    return { flowerType: 'tulip', flowerName: 'Tulip', color: hexColor, shape: 'round', confidence: 0.8 };
  }

  // Yellow/Orange flowers (sunflowers)
  if (r > 200 && g > 150 && b < 120) {
    return { flowerType: 'sunflower', flowerName: 'Sunflower', color: hexColor, shape: 'round', confidence: 0.85 };
  }

  // Red flowers (roses)
  if (r > 150 && r > g + 50 && r > b + 50) {
    return { flowerType: 'rose', flowerName: 'Rose', color: hexColor, shape: 'round', confidence: 0.85 };
  }

  // Pink flowers (cherry blossoms)
  if (r > 180 && g > 100 && b > 100 && r > b && r > g) {
    return { flowerType: 'cherry-blossom', flowerName: 'Cherry Blossom', color: hexColor, shape: 'round', confidence: 0.8 };
  }

  // Default to tulip (since most flower photos will be colorful)
  return { flowerType: 'tulip', flowerName: 'Tulip', color: hexColor, shape: 'round', confidence: 0.7 };
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export default function CameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const category = params.category as string;
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showARModel, setShowARModel] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [showFlowerSelection, setShowFlowerSelection] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [extractedColor, setExtractedColor] = useState<string>('#FF5C8A');
  const [mlDetectionResult, setMlDetectionResult] = useState<any>(null);
  const [tfReady, setTfReady] = useState(false);
  const { setDetectedFlower, detectedFlower } = useBouquetStore();

  // Pre-initialize TF.js on mount so it's ready when the user takes a photo
  useEffect(() => {
    import('@tensorflow/tfjs').then(tf => {
      tf.ready().then(() => {
        setTfReady(true);
        console.log('✅ TF.js ready');
      }).catch(err => {
        console.warn('⚠️ TF.js init failed:', err);
        setTfReady(true); // still allow detection attempt
      });
    });
  }, []);

  // Available flower types for selection
  const flowerOptions = [
    { type: 'rose', name: 'Rose', emoji: '🌹', color: '#DC143C' },
    { type: 'tulip', name: 'Tulip', emoji: '🌷', color: '#FF69B4' },
    { type: 'sunflower', name: 'Sunflower', emoji: '🌻', color: '#FFD700' },
    { type: 'cherry-blossom', name: 'Cherry Blossom', emoji: '🌸', color: '#FFB7C5' },
  ];

  const modelRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0, y: 0 });
  const lastTouchRef = useRef({ x: 0, y: 0 });

  // Pan responder for 3D model rotation
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: (evt) => {
      const touch = evt.nativeEvent;
      lastTouchRef.current = { x: touch.pageX, y: touch.pageY };
    },
    onPanResponderMove: (evt) => {
      if (!showARModel) return;
      const touch = evt.nativeEvent;
      const deltaX = touch.pageX - lastTouchRef.current.x;
      const deltaY = touch.pageY - lastTouchRef.current.y;

      rotationRef.current.y += deltaX * 0.01;
      rotationRef.current.x += deltaY * 0.01;
      rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x));

      lastTouchRef.current = { x: touch.pageX, y: touch.pageY };
    },
  });

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF5C8A" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <BackgroundGradient circles={[]}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            BloomAR needs access to your camera to scan flowers and generate 3D models.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </BackgroundGradient>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || isProcessing) return;

    try {
      setIsProcessing(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        throw new Error('Failed to capture image');
      }

      // Save image to accessible location
      const fileName = `flower_${Date.now()}.jpg`;
      const flowersDir = `${FileSystem.documentDirectory}flowers/`;
      const dirInfo = await FileSystem.getInfoAsync(flowersDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(flowersDir, { intermediates: true });
      }

      const savedPath = `${flowersDir}${fileName}`;
      await FileSystem.copyAsync({
        from: photo.uri,
        to: savedPath,
      });

      // Try ML-based detection first
      let flowerResult;

      // Always use image-based detection (correctly reads actual pixel colors via TF.js)
      // ML (MobileNet) is skipped — it can't distinguish roses from tulips (not in ImageNet classes)
      console.log('🌸 Running pixel-based flower detection...');
      try {
        const imageResult = await detectFlowerByImage(savedPath);
        flowerResult = {
          flowerType: imageResult.type,
          flowerName: imageResult.displayName,
          confidence: imageResult.confidence,
          color: imageResult.color,
          shape: 'round',
        };
        console.log(`✅ Detected: ${flowerResult.flowerName} (confidence: ${flowerResult.confidence.toFixed(2)}, color: ${flowerResult.color})`);
      } catch (detectionError) {
        console.warn('⚠️ Detection failed, using default:', detectionError);
        flowerResult = { flowerType: 'rose', flowerName: 'Rose', color: '#DC143C', shape: 'round', confidence: 0.5 };
      }

      // Automatically navigate to AR preview
      setDetectedFlower({
        ...flowerResult,
        imageUri: savedPath,
        detectedAt: Date.now(),
      });

      router.push('/ar-preview');
      return;

      // Store the image URI and color, then show selection modal
      setCapturedImageUri(savedPath);
      setExtractedColor(color);
      setShowFlowerSelection(true);

    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert(
        'Capture Error',
        'Failed to capture image. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle flower type selection from modal
  const handleFlowerSelect = (flowerType: string, flowerName: string) => {
    if (!capturedImageUri) return;

    console.log('🌸 User selected:', flowerName);

    // Store detected flower info with user-selected type
    setDetectedFlower({
      color: extractedColor,
      flowerType: flowerType,
      flowerName: flowerName,
      shape: 'round',
      confidence: 1.0, // 100% confidence because user selected it
      imageUri: capturedImageUri,
      detectedAt: Date.now(),
    });

    // Hide selection modal
    setShowFlowerSelection(false);

    // Navigate to AR preview screen to view in AR/3D
    console.log('📱 Navigating to AR preview screen...');
    router.push('/ar-preview');
  };

  const handleContinue = () => {
    // Navigate to editor with the detected flower
    router.push('/editor');
  };

  const handleRetake = () => {
    // Hide AR model and allow retaking
    setShowARModel(false);
    setShowFlowerSelection(false);
    setCapturedImageUri(null);
    rotationRef.current = { x: 0, y: 0 };
  };

  // 3D model loading function
  const onGLContextCreate = async (gl: any) => {
    try {
      setIsLoadingModel(true);

      const renderer = new Renderer({ gl }) as any;
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);

      const scene = new THREE.Scene();
      scene.background = null; // Transparent background to see camera

      const camera = new THREE.PerspectiveCamera(
        75,
        gl.drawingBufferWidth / gl.drawingBufferHeight,
        0.1,
        1000
      );
      camera.position.z = 5;

      // Add lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLight.position.set(5, 10, 7.5);
      scene.add(directionalLight);

      // Load GLB model based on detected flower type
      const Asset = await import('expo-asset');
      // @ts-ignore - GLTFLoader types are not available in React Native
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();

      // Get the appropriate model for detected flower type
      const flowerType = detectedFlower?.flowerType || 'generic-flower';
      const modelInfo = getFlowerModel(flowerType as any);

      console.log('🌸 Loading 3D model for:', modelInfo.displayName);

      const modelAsset = Asset.Asset.fromModule(modelInfo.modelPath);
      await modelAsset.downloadAsync();

      // Suppress texture errors
      const originalError = console.error;
      console.error = (...args: any[]) => {
        if (args[0]?.includes?.('THREE.GLTFLoader: Couldn\'t load texture')) {
          return;
        }
        originalError(...args);
      };

      loader.load(
        modelAsset.localUri || modelAsset.uri,
        (gltf: any) => {
          console.error = originalError;
          const flowerModel = gltf.scene;

          flowerModel.scale.set(1.5, 1.5, 1.5);
          flowerModel.position.set(0, -0.5, 0);

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
          setIsLoadingModel(false);

          const animate = () => {
            requestAnimationFrame(animate);

            if (modelRef.current) {
              modelRef.current.rotation.x = rotationRef.current.x;
              modelRef.current.rotation.y = rotationRef.current.y;
            }

            renderer.render(scene, camera);
            gl.endFrameEXP();
          };

          animate();
        },
        undefined,
        (error: any) => {
          console.error = originalError;
          console.error('Error loading GLB model:', error);
          setIsLoadingModel(false);
        }
      );
    } catch (error) {
      console.error('Error setting up 3D scene:', error);
      setIsLoadingModel(false);
    }
  };


  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
      >
        {/* Overlay with capture rectangle */}
        <View style={styles.overlay} pointerEvents="box-none">
          {/* AR 3D Model Overlay - appears after capture */}
          {showARModel && (
            <View style={styles.arOverlay} pointerEvents="box-none">
              <GLView
                style={styles.glView}
                onContextCreate={onGLContextCreate}
              />
            </View>
          )}
          {/* Rotation touch area - only in center */}
          {showARModel && (
            <View style={styles.rotationArea} {...panResponder.panHandlers} />
          )}
          {/* Top section */}
          <View style={styles.topSection}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{showARModel ? 'AR View' : category}</Text>
            </View>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer} pointerEvents="none">
            <Text style={styles.instructionsText}>
              {showARModel
                ? `${getFlowerModel(detectedFlower?.flowerType as any || 'generic-flower').emoji} 3D ${detectedFlower?.flowerName || 'Flower'} AR View`
                : 'Position the flower in the frame'}
            </Text>
            {showARModel && (
              <Text style={styles.instructionsSubtext}>
                Drag to rotate the model
              </Text>
            )}
          </View>

          {/* Capture rectangle - only show when not in AR mode */}
          {!showARModel && (
            <View style={styles.captureArea} pointerEvents="none">
              <View style={styles.captureRectangle}>
                {/* Corner indicators */}
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
            </View>
          )}

          {/* Bottom section with capture/continue buttons */}
          <View style={styles.bottomSection}>
            {showARModel ? (
              // AR mode buttons
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleRetake}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryButtonText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleContinue}
                  activeOpacity={0.7}
                >
                  <Text style={styles.primaryButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Capture mode button
              <>
                <TouchableOpacity
                  style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
                  onPress={handleCapture}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  ) : (
                    <View style={styles.captureButtonInner} />
                  )}
                </TouchableOpacity>
                <Text style={styles.captureHint}>
                  {isProcessing ? 'Processing...' : 'Tap to capture'}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Loading overlay for 3D model */}
        {isLoadingModel && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFD166" />
            <Text style={styles.loadingText}>Loading AR Model...</Text>
          </View>
        )}
      </CameraView>

      {/* Flower Selection Modal */}
      <Modal
        visible={showFlowerSelection}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFlowerSelection(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header with captured image preview */}
            <View style={styles.modalHeader}>
              {capturedImageUri && (
                <Image
                  source={{ uri: capturedImageUri }}
                  style={styles.capturedPreview}
                  resizeMode="cover"
                />
              )}
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>What flower is this?</Text>
                <Text style={styles.modalSubtitle}>Select the correct flower type</Text>
              </View>
            </View>

            {/* Flower Options */}
            <ScrollView style={styles.flowerOptionsContainer} showsVerticalScrollIndicator={false}>
              {flowerOptions.map((flower) => (
                <TouchableOpacity
                  key={flower.type}
                  style={styles.flowerOption}
                  onPress={() => handleFlowerSelect(flower.type, flower.name)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={[flower.color + '40', flower.color + '20']}
                    style={styles.flowerOptionGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.flowerEmoji}>{flower.emoji}</Text>
                    <Text style={styles.flowerName}>{flower.name}</Text>
                    <View style={[styles.flowerColorDot, { backgroundColor: flower.color }]} />
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleRetake}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Retake Photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  categoryBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 92, 138, 0.9)',
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  instructionsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  instructionsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  captureArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  captureRectangle: {
    width: '100%',
    aspectRatio: 1,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 20,
    backgroundColor: 'transparent',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#FF5C8A',
    borderWidth: 4,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 20,
  },
  topRight: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 20,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 20,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 20,
  },
  bottomSection: {
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 6,
    borderColor: '#FF5C8A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF5C8A',
  },
  captureHint: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#FF5C8A',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // AR overlay styles
  arOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  rotationArea: {
    position: 'absolute',
    top: '20%',
    bottom: '20%',
    left: '10%',
    right: '10%',
    zIndex: 2,
  },
  arTouchableArea: {
    flex: 1,
  },
  glView: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  instructionsSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
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
    backgroundColor: '#FFD166',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#FFD166',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
  // Flower Selection Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  capturedPreview: {
    width: 70,
    height: 70,
    borderRadius: 12,
    marginRight: 16,
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  flowerOptionsContainer: {
    maxHeight: 300,
  },
  flowerOption: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  flowerOptionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  flowerEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  flowerName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  flowerColorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
});

