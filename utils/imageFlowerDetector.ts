/**
 * Flower detection using color analysis
 * Uses TF.js decodeJpeg to properly read actual pixel data from images.
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
// Static import — dynamic require() inside async functions is unreliable with Metro bundler
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

export type FlowerType = 'rose' | 'tulip' | 'sunflower' | 'cherry-blossom' | 'generic-flower';

interface FlowerMatchResult {
  type: FlowerType;
  confidence: number;
  displayName: string;
  color: string;
}

/**
 * Convert base64 string to Uint8Array using atob (available in React Native).
 * Replaces tf.util.encodeString which is unreliable across TF.js versions.
 */
function base64ToBytes(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Extract average RGB from image using TF.js decodeJpeg.
 * This correctly reads actual pixel data unlike PNG binary parsing.
 */
async function extractPixelColor(imageUri: string): Promise<{
  r: number; g: number; b: number; brightness: number; saturation: number;
}> {
  await tf.ready();

  // Resize to 50x50 JPEG — fast to process, good enough for color averaging
  const manipResult = await manipulateAsync(
    imageUri,
    [{ resize: { width: 50, height: 50 } }],
    { base64: false, format: SaveFormat.JPEG }
  );

  // Read JPEG file as base64, then convert to raw bytes
  const imgB64 = await FileSystem.readAsStringAsync(manipResult.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const raw = base64ToBytes(imgB64);

  // Decode JPEG bytes → pixel tensor [50, 50, 3]
  const tensor = decodeJpeg(raw, 3);

  // Average all pixels → [3] mean RGB values
  const meanTensor = tensor.mean([0, 1]);
  const meanData = await meanTensor.data();

  tensor.dispose();
  meanTensor.dispose();

  const r = Math.round(meanData[0]);
  const g = Math.round(meanData[1]);
  const b = Math.round(meanData[2]);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = (r + g + b) / 3;
  const saturation = max === 0 ? 0 : (max - min) / max;

  console.log('🎨 TF.js pixel color:', { r, g, b, brightness: brightness.toFixed(1), saturation: saturation.toFixed(2) });

  return { r, g, b, brightness, saturation };
}

/**
 * Detect flower type from an image by analysing actual pixel colors.
 */
export async function detectFlowerByImage(scannedImageUri: string): Promise<FlowerMatchResult> {
  console.log('🔍 Starting pixel-based flower detection...');

  const { r, g, b, brightness, saturation } = await extractPixelColor(scannedImageUri);
  const hexColor = rgbToHex(r, g, b);

  const redAdvantage = Math.min(r - g, r - b);
  const isRedDominant = r > g && r > b;
  const isBlueDominant = b > r && b > g;
  const isGreenDominant = g > r && g > b;

  console.log('🔬 Color analysis:', {
    r, g, b, hex: hexColor,
    redAdvantage, isRedDominant, isBlueDominant,
    brightness: brightness.toFixed(1), saturation: saturation.toFixed(2),
  });

  // === SUNFLOWER — bright yellow (R ≈ G >> B) ===
  if (r > 170 && g > 120 && b < 100 && g > b * 2 && r < g * 1.65) {
    console.log('✅ DETECTED: Sunflower (bright yellow)');
    return { type: 'sunflower', confidence: 0.9, displayName: 'Sunflower', color: hexColor };
  }

  // === SUNFLOWER — golden/orange-yellow (R heavier, but B nearly absent) ===
  // Catches deeper golden sunflowers where R/G > 1.65.
  // Key discriminator vs rose: G must be > 2.5× B (roses have G ≈ B).
  if (r > 160 && g > 90 && b < 70 && g > b * 2.5 && r < g * 2.0) {
    console.log('✅ DETECTED: Sunflower (golden/orange-yellow)');
    return { type: 'sunflower', confidence: 0.85, displayName: 'Sunflower', color: hexColor };
  }

  // === CHERRY BLOSSOM — checked BEFORE rose ===
  // Key signature: R dominant, AND both G >= 120 AND B >= 120 (all channels present — "warm full pink")
  // Distinguished from:
  //   Rose:          G and B are LOW (< 120) — red is strongly dominant
  //   Magenta tulip: G is very LOW, B >> G (B > G*1.5)
  if (isRedDominant && g >= 120 && b >= 120 && b <= g * 1.5 && brightness > 140) {
    const confidence = brightness > 170 ? 0.9 : 0.82;
    console.log('✅ DETECTED: Cherry Blossom');
    return { type: 'cherry-blossom', confidence, displayName: 'Cherry Blossom', color: hexColor };
  }

  // Very pale / near-white cherry blossom
  if (brightness > 210 && saturation < 0.15) {
    console.log('✅ DETECTED: Cherry Blossom (white/pale)');
    return { type: 'cherry-blossom', confidence: 0.75, displayName: 'Cherry Blossom', color: hexColor };
  }

  // === ROSE — DARK RED ONLY ===
  // User preference: only match truly dark/deep red roses.
  // g < 110 AND b < 110 ensures it is genuinely dark red, not pink.
  // b > g*0.5 guards against orange colors (where B << G).
  if (isRedDominant && redAdvantage > 35 && g < 110 && b < 110 && b > g * 0.5) {
    console.log('✅ DETECTED: Rose (dark red)');
    return { type: 'rose', confidence: 0.92, displayName: 'Rose', color: hexColor };
  }

  // Slightly brighter but still clearly red (not pink, not orange)
  if (isRedDominant && redAdvantage > 25 && g < 130 && b < 130 && b > g * 0.5 && saturation > 0.45) {
    console.log('✅ DETECTED: Rose (deep red)');
    return { type: 'rose', confidence: 0.85, displayName: 'Rose', color: hexColor };
  }

  // === TULIP — PURPLE/BLUE/VIOLET/MAGENTA ONLY ===
  // Per user preference: tulip model only shows for purple/blue/magenta colored flowers.

  // Purple/blue (B is the dominant channel)
  if (isBlueDominant) {
    console.log('✅ DETECTED: Tulip (purple/blue)');
    return { type: 'tulip', confidence: 0.85, displayName: 'Tulip', color: hexColor };
  }

  // Magenta/violet: significant B, G is low (B >> G — unlike cherry blossom where G >= 120)
  if (b > 110 && g < 130 && r > 80) {
    console.log('✅ DETECTED: Tulip (magenta/violet)');
    return { type: 'tulip', confidence: 0.8, displayName: 'Tulip', color: hexColor };
  }

  // Hot-pink/magenta: high R, significant B, G very low relative to R
  if (r > 160 && b > 100 && g < r * 0.6) {
    console.log('✅ DETECTED: Tulip (hot-pink/magenta)');
    return { type: 'tulip', confidence: 0.75, displayName: 'Tulip', color: hexColor };
  }

  // === FALLBACKS — default to rose, NOT tulip ===
  // Any remaining red/warm/yellow color falls back to rose or sunflower, never tulip.

  // Yellow/golden → sunflower fallback
  if (r > 160 && g > 120 && b < 110 && r < g * 1.8) {
    console.log('✅ DETECTED: Sunflower (fallback yellow/golden)');
    return { type: 'sunflower', confidence: 0.65, displayName: 'Sunflower', color: hexColor };
  }

  // Everything else → rose (most common unrecognized flower color)
  console.log('⚠️ No specific match, defaulting to Rose');
  return { type: 'rose', confidence: 0.6, displayName: 'Rose', color: hexColor };
}
