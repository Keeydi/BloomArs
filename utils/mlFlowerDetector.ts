import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { extractDominantColor } from './colorExtractor';

// Flower class mappings from ImageNet/MobileNet classes to our flower types
// MobileNet can recognize these flower-related classes
const FLOWER_CLASS_MAPPINGS: Record<string, string> = {
  // Rose-related classes
  'rose': 'rose',
  'rosehip': 'rose',

  // Tulip-related classes
  'tulip': 'tulip',

  // Sunflower-related classes
  'sunflower': 'sunflower',
  'daisy': 'sunflower', // Similar appearance

  // Cherry blossom / similar flowers
  'chrysanthemum': 'cherry-blossom',
  'geranium': 'cherry-blossom',
  'carnation': 'cherry-blossom',
  'oxeye daisy': 'cherry-blossom',

  // Generic flowers
  'flower': 'generic-flower',
  'blossom': 'generic-flower',
  'petal': 'generic-flower',
  'bouquet': 'generic-flower',
};

let model: mobilenet.MobileNet | null = null;
let tfReady = false;

/**
 * Initialize TensorFlow and load MobileNet model
 */
export async function loadFlowerModel(): Promise<void> {
  try {
    if (!tfReady) {
      console.log('🤖 Initializing TensorFlow.js...');
      await tf.ready();
      tfReady = true;
      console.log('✅ TensorFlow.js ready');
    }

    if (!model) {
      console.log('🤖 Loading MobileNet model...');
      model = await mobilenet.load({
        version: 2,
        alpha: 1.0,
      });
      console.log('✅ MobileNet model loaded');
    }
  } catch (error) {
    console.error('❌ Error loading ML model:', error);
    throw error;
  }
}

/**
 * Map MobileNet prediction to our flower types
 */
function mapPredictionToFlowerType(className: string): {
  flowerType: string;
  flowerName: string;
} {
  const lowerClassName = className.toLowerCase();

  // Check for direct matches
  for (const [key, value] of Object.entries(FLOWER_CLASS_MAPPINGS)) {
    if (lowerClassName.includes(key)) {
      return {
        flowerType: value,
        flowerName: value.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      };
    }
  }

  // Default to generic flower
  return {
    flowerType: 'generic-flower',
    flowerName: 'Flower',
  };
}

/**
 * Detect flower type from image using ML
 * @param imageUri Path to the captured image
 * @returns Detected flower information with confidence
 */
export async function detectFlowerML(imageUri: string): Promise<{
  flowerType: string;
  flowerName: string;
  confidence: number;
  color: string;
  shape: string;
  imageUri: string;
  detectedAt: number;
}> {
  try {
    // Ensure model is loaded
    if (!model) {
      await loadFlowerModel();
    }

    if (!model) {
      throw new Error('Model failed to load');
    }

    console.log('🌸 Running ML inference on image:', imageUri);

    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
    const { decodeJpeg } = await import('@tensorflow/tfjs-react-native');
    // Use legacy import - same as camera.tsx - to get EncodingType enum
    const FileSystem = await import('expo-file-system/legacy');

    // Resize image to 224x224 for MobileNet
    const manipResult = await manipulateAsync(
      imageUri,
      [{ resize: { width: 224, height: 224 } }],
      { format: SaveFormat.JPEG, base64: false }
    );

    // Read the image file as binary data using the legacy module (has EncodingType)
    const imgB64 = await FileSystem.readAsStringAsync(manipResult.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const imgBuffer = tf.util.encodeString(imgB64, 'base64');
    const raw = new Uint8Array(imgBuffer);

    // Decode JPEG to tensor using React Native method
    const imageTensor = decodeJpeg(raw);

    console.log('🖼️ Image tensor shape:', imageTensor.shape);

    // Run MobileNet classification directly on the tensor
    const predictions = await model.classify(imageTensor as any);

    console.log('🤖 ML Predictions:', predictions);

    // Clean up tensor
    imageTensor.dispose();

    // Find best flower-related prediction
    let bestFlowerPrediction = predictions[0];
    let flowerFound = false;

    for (const prediction of predictions) {
      const mapped = mapPredictionToFlowerType(prediction.className);
      if (mapped.flowerType !== 'generic-flower') {
        bestFlowerPrediction = prediction;
        flowerFound = true;
        break;
      }
    }

    // Map prediction to our flower type
    const { flowerType, flowerName } = mapPredictionToFlowerType(
      bestFlowerPrediction.className
    );

    // Extract dominant color from image
    console.log('🎨 Extracting color from image...');
    const dominantColor = await extractDominantColor(imageUri);

    const result = {
      flowerType,
      flowerName,
      confidence: bestFlowerPrediction.probability,
      color: dominantColor,
      shape: 'round',
      imageUri,
      detectedAt: Date.now(),
    };

    console.log('✅ ML Detection result:', result);

    return result;
  } catch (error) {
    console.error('❌ ML detection error:', error);
    // Re-throw so camera.tsx can use its proper color-based fallback
    throw error;
  }
}

/**
 * Preload the ML model during app initialization
 */
export async function preloadMLModel(): Promise<void> {
  try {
    await loadFlowerModel();
    console.log('✅ ML model preloaded successfully');
  } catch (error) {
    console.warn('⚠️ Failed to preload ML model:', error);
  }
}

/**
 * Check if ML model is ready
 */
export function isMLModelReady(): boolean {
  return model !== null && tfReady;
}

/**
 * Get model info
 */
export function getMLModelInfo(): {
  loaded: boolean;
  tfReady: boolean;
  version: string;
} {
  return {
    loaded: model !== null,
    tfReady,
    version: 'MobileNetV2',
  };
}
