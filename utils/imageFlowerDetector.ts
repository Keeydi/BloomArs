/**
 * Flower detection using color analysis
 * Uses expo-image-manipulator + jpeg-js to extract dominant color from images.
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as jpeg from 'jpeg-js';

export type FlowerType = 'rose' | 'tulip' | 'sunflower' | 'cherry-blossom' | 'generic-flower';

interface FlowerMatchResult {
  type: FlowerType;
  confidence: number;
  displayName: string;
  color: string;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Extract dominant color from image using jpeg-js decoder.
 */
async function extractPixelColor(imageUri: string): Promise<{
  r: number; g: number; b: number; brightness: number; saturation: number;
}> {
  try {
    console.log('🎨 Starting color extraction from:', imageUri);

    // Resize to small image for fast processing
    const result = await manipulateAsync(
      imageUri,
      [{ resize: { width: 20, height: 20 } }],
      { base64: true, format: SaveFormat.JPEG }
    );

    if (!result.base64) {
      throw new Error('No base64 data from image manipulator');
    }

    console.log('📊 Got JPEG base64, length:', result.base64.length);

    // Convert base64 to Uint8Array
    const jpegData = base64ToUint8Array(result.base64);
    console.log('📊 JPEG bytes:', jpegData.length);

    // Decode JPEG to raw pixel data
    const decoded = jpeg.decode(jpegData, { useTArray: true });
    console.log('📊 Decoded image:', decoded.width, 'x', decoded.height, 'pixels');

    if (!decoded.data || decoded.data.length === 0) {
      throw new Error('No pixel data from jpeg decode');
    }

    // Calculate average color from all pixels
    let totalR = 0, totalG = 0, totalB = 0;
    const pixelCount = decoded.width * decoded.height;

    // JPEG decoded data is RGBA format (4 bytes per pixel)
    for (let i = 0; i < decoded.data.length; i += 4) {
      totalR += decoded.data[i];
      totalG += decoded.data[i + 1];
      totalB += decoded.data[i + 2];
      // decoded.data[i + 3] is alpha
    }

    const r = Math.round(totalR / pixelCount);
    const g = Math.round(totalG / pixelCount);
    const b = Math.round(totalB / pixelCount);

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const brightness = (r + g + b) / 3;
    const saturation = max === 0 ? 0 : (max - min) / max;

    console.log('🎨 Extracted color:', { r, g, b, brightness: brightness.toFixed(1), saturation: saturation.toFixed(2) });

    return { r, g, b, brightness, saturation };
  } catch (error) {
    console.error('❌ extractPixelColor error:', error);
    throw error;
  }
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

  // === SUNFLOWER — yellow detection (check FIRST before other flowers) ===
  // Yellow/golden: high R and G, low B
  // Key: Sunflower has yellow petals + brown center, so average may be orange-brown-yellow
  // We need to detect BOTH pure yellow AND brownish-yellow (when whole flower is scanned)

  // Bright yellow sunflower (R ≈ G >> B) - petals only
  if (r > 150 && g > 100 && b < 120 && g > b * 1.5) {
    console.log('✅ DETECTED: Sunflower (bright yellow petals)');
    return { type: 'sunflower', confidence: 0.9, displayName: 'Sunflower', color: hexColor };
  }

  // Golden/orange-yellow sunflower (R > G >> B)
  if (r > 140 && g > 80 && b < 100 && g > b * 1.3 && r > b * 1.5) {
    console.log('✅ DETECTED: Sunflower (golden)');
    return { type: 'sunflower', confidence: 0.85, displayName: 'Sunflower', color: hexColor };
  }

  // Brown-yellow mix (whole sunflower with brown center affecting average)
  // Brown = R > G > B, with moderate values. Yellow influence keeps G relatively high.
  // This catches cases where the brown center pulls down the brightness but R > G > B pattern remains
  if (r > g && g > b && r > 100 && g > 60 && b < 100 && (r - b) > 40) {
    console.log('✅ DETECTED: Sunflower (brown-yellow whole flower)');
    return { type: 'sunflower', confidence: 0.8, displayName: 'Sunflower', color: hexColor };
  }

  // Orange-ish yellow (common when yellow petals + brown center average out)
  if (r > 120 && g > 70 && b < 90 && r > g && g > b) {
    console.log('✅ DETECTED: Sunflower (orange-yellow)');
    return { type: 'sunflower', confidence: 0.75, displayName: 'Sunflower', color: hexColor };
  }

  // === CHERRY BLOSSOM — checked BEFORE rose and tulip ===
  // Cherry blossom = PINK (soft pink, light pink, pastel pink)
  // Key: R is highest, but G and B are also present (making it pink, not red)
  // Pink signature: R > G, R > B, but G and B are relatively close to each other

  console.log('🌸 Cherry blossom check:', {
    rMinusG: r - g,
    rMinusB: r - b,
    gMinusB: Math.abs(g - b),
    isPink: r > g && r > b && Math.abs(g - b) < 50
  });

  // Bright pink cherry blossom (R dominant, G and B balanced and high)
  if (isRedDominant && g >= 120 && b >= 120 && b <= g * 1.5 && brightness > 140) {
    const confidence = brightness > 170 ? 0.9 : 0.82;
    console.log('✅ DETECTED: Cherry Blossom (bright pink)');
    return { type: 'cherry-blossom', confidence, displayName: 'Cherry Blossom', color: hexColor };
  }

  // Medium pink cherry blossom (R dominant, G and B are close to each other)
  // This catches pink where G and B are lower but balanced
  if (isRedDominant && g >= 80 && b >= 80 && Math.abs(g - b) < 50 && brightness > 100) {
    console.log('✅ DETECTED: Cherry Blossom (medium pink)');
    return { type: 'cherry-blossom', confidence: 0.85, displayName: 'Cherry Blossom', color: hexColor };
  }

  // Light/soft pink cherry blossom (high brightness, low saturation, pinkish tint)
  if (brightness > 150 && saturation < 0.4 && r > g && r > b && r > 150) {
    console.log('✅ DETECTED: Cherry Blossom (soft pink)');
    return { type: 'cherry-blossom', confidence: 0.8, displayName: 'Cherry Blossom', color: hexColor };
  }

  // Very pale / near-white cherry blossom
  if (brightness > 210 && saturation < 0.15) {
    console.log('✅ DETECTED: Cherry Blossom (white/pale)');
    return { type: 'cherry-blossom', confidence: 0.75, displayName: 'Cherry Blossom', color: hexColor };
  }

  // Pastel pink (common cherry blossom color - pinkish with balanced G and B)
  if (r > 140 && g > 100 && b > 100 && r > g && r > b && Math.abs(g - b) < 40) {
    console.log('✅ DETECTED: Cherry Blossom (pastel pink)');
    return { type: 'cherry-blossom', confidence: 0.78, displayName: 'Cherry Blossom', color: hexColor };
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

  // Yellow/golden → sunflower fallback (more relaxed conditions)
  if (r > 120 && g > 90 && b < 130 && g > b && r > b) {
    console.log('✅ DETECTED: Sunflower (fallback yellow/warm)');
    return { type: 'sunflower', confidence: 0.65, displayName: 'Sunflower', color: hexColor };
  }

  // Everything else → rose (most common unrecognized flower color)
  console.log('⚠️ No specific match, defaulting to Rose');
  return { type: 'rose', confidence: 0.6, displayName: 'Rose', color: hexColor };
}
