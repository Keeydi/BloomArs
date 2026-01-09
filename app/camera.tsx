import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useRef } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { useBouquetStore } from '@/store/bouquetStore';
import { BackgroundGradient } from '@/components/BackgroundGradient';

export default function CameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const category = params.category as string;
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const { setDetectedFlower } = useBouquetStore();

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

      // Save detected flower info
      const detectedFlower = {
        color: '#FF5C8A', // Default color - can be extracted later
        shape: 'round',
        confidence: 1.0,
        imageUri: savedPath,
        detectedAt: Date.now(),
      };
      
      setDetectedFlower(detectedFlower);

      Alert.alert(
        'Success!',
        'Flower image captured successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            },
          },
        ]
      );

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


  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
      >
        {/* Overlay with capture rectangle */}
        <View style={styles.overlay}>
          {/* Top section */}
          <View style={styles.topSection}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => router.back()}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{category}</Text>
            </View>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsText}>
              Position the flower in the frame
            </Text>
          </View>

          {/* Capture rectangle */}
          <View style={styles.captureArea}>
            <View style={styles.captureRectangle}>
              {/* Corner indicators */}
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>

          {/* Bottom section with capture button */}
          <View style={styles.bottomSection}>
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
          </View>
        </View>
      </CameraView>
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
    flex: 1,
    backgroundColor: 'transparent',
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
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
});

