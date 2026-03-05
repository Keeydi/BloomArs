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
 * Calculate saturation for a single pixel
 */
function getPixelSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/**
 * Extract dominant color from image using jpeg-js decoder.
 * Focuses on the most colorful/saturated pixels (actual flower petals)
 * instead of averaging everything including dark branches and background.
 */
async function extractPixelColor(imageUri: string): Promise<{
  r: number; g: number; b: number; brightness: number; saturation: number;
}> {
  try {
    console.log('🎨 Starting color extraction from:', imageUri);

    // Resize to small image for fast processing
    const result = await manipulateAsync(
      imageUri,
      [{ resize: { width: 30, height: 30 } }], // Slightly larger for better sampling
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

    // Collect all pixels with their saturation values
    const pixels: { r: number; g: number; b: number; sat: number; bright: number }[] = [];

    // JPEG decoded data is RGBA format (4 bytes per pixel)
    for (let i = 0; i < decoded.data.length; i += 4) {
      const pr = decoded.data[i];
      const pg = decoded.data[i + 1];
      const pb = decoded.data[i + 2];
      const sat = getPixelSaturation(pr, pg, pb);
      const bright = (pr + pg + pb) / 3;

      pixels.push({ r: pr, g: pg, b: pb, sat, bright });
    }

    // Sort pixels by saturation (most colorful first)
    pixels.sort((a, b) => b.sat - a.sat);

    // Take the top 30% most saturated pixels (these are likely the flower petals)
    const topCount = Math.max(10, Math.floor(pixels.length * 0.3));
    const topPixels = pixels.slice(0, topCount);

    // Calculate weighted average of top saturated pixels
    // Give more weight to brighter, more saturated pixels
    let totalR = 0, totalG = 0, totalB = 0, totalWeight = 0;

    for (const p of topPixels) {
      // Weight: saturation * brightness factor (avoid very dark pixels)
      const brightFactor = Math.max(0.3, p.bright / 255);
      const weight = p.sat * brightFactor;
      totalR += p.r * weight;
      totalG += p.g * weight;
      totalB += p.b * weight;
      totalWeight += weight;
    }

    // Fallback if no weighted pixels found
    if (totalWeight === 0) {
      totalWeight = topPixels.length;
      for (const p of topPixels) {
        totalR += p.r;
        totalG += p.g;
        totalB += p.b;
      }
    }

    const r = Math.round(totalR / totalWeight);
    const g = Math.round(totalG / totalWeight);
    const b = Math.round(totalB / totalWeight);

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const brightness = (r + g + b) / 3;
    const saturation = max === 0 ? 0 : (max - min) / max;

    console.log('🎨 Extracted color (from top saturated pixels):', {
      r, g, b,
      brightness: brightness.toFixed(1),
      saturation: saturation.toFixed(2),
      sampledPixels: topCount
    });

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

  // Calculate color characteristics
  // Yellow: G is high (close to R), B is low
  // Red: R dominates, G and B are both low
  const isYellowish = g > b + 20 && g > 80 && b < 120; // G significantly higher than B
  const isStrongYellow = g > 100 && b < 100 && (g - b) > 40; // Clear yellow signature
  const isStrongRed = isRedDominant && redAdvantage > 40 && g < 100 && !isYellowish;

  console.log('🔬 Color analysis:', {
    r, g, b, hex: hexColor,
    redAdvantage, isRedDominant, isBlueDominant, isStrongRed, isYellowish, isStrongYellow,
    brightness: brightness.toFixed(1), saturation: saturation.toFixed(2),
  });

  // === SUNFLOWER — CHECK FIRST for yellow/golden colors ===
  // Yellow/golden: G is high (close to R), B is low
  // Must check BEFORE rose to avoid yellow being detected as red

  // Pure bright yellow sunflower (R ≈ G >> B)
  if (r > 140 && g > 100 && b < 120 && isStrongYellow) {
    console.log('✅ DETECTED: Sunflower (bright yellow)');
    return { type: 'sunflower', confidence: 0.95, displayName: 'Sunflower', color: hexColor };
  }

  // Golden yellow sunflower
  if (r > 130 && g > 90 && b < 110 && g > b * 1.3 && isYellowish) {
    console.log('✅ DETECTED: Sunflower (golden yellow)');
    return { type: 'sunflower', confidence: 0.9, displayName: 'Sunflower', color: hexColor };
  }

  // Orange-yellow sunflower (R higher than G, but G still significant)
  if (r > 140 && g > 80 && b < 100 && g > b && (r - g) < 80) {
    console.log('✅ DETECTED: Sunflower (orange-yellow)');
    return { type: 'sunflower', confidence: 0.85, displayName: 'Sunflower', color: hexColor };
  }

  // Brown-yellow mix (whole sunflower with brown center)
  if (r > g && g > b && g > 70 && b < 90 && (g - b) > 15) {
    console.log('✅ DETECTED: Sunflower (brown-yellow)');
    return { type: 'sunflower', confidence: 0.8, displayName: 'Sunflower', color: hexColor };
  }

  // === ROSE — for strong red colors (NOT yellow) ===
  // Rose = DEEP RED. R is much higher than BOTH G and B.
  // Only match if NOT yellowish (G should be low for red)

  // Strong red rose (high saturation, R dominates, G is LOW)
  if (isStrongRed && g < 100 && b < 100) {
    console.log('✅ DETECTED: Rose (strong red)');
    return { type: 'rose', confidence: 0.95, displayName: 'Rose', color: hexColor };
  }

  // Dark red rose
  if (isRedDominant && redAdvantage > 40 && g < 100 && b < 100 && !isYellowish) {
    console.log('✅ DETECTED: Rose (dark red)');
    return { type: 'rose', confidence: 0.92, displayName: 'Rose', color: hexColor };
  }

  // Medium red rose (G must be low to distinguish from yellow/orange)
  if (isRedDominant && redAdvantage > 30 && g < 110 && b < 110 && !isYellowish && saturation > 0.4) {
    console.log('✅ DETECTED: Rose (medium red)');
    return { type: 'rose', confidence: 0.88, displayName: 'Rose', color: hexColor };
  }

  // === CHERRY BLOSSOM — PINK colors ===
  // Cherry blossom = PINK (soft pink, light pink, pastel pink)
  // Key: R is highest, but G and B are BOTH present and BALANCED (making it pink, not red)
  // Pink signature: R > G, R > B, G and B are close to each other, NOT too dark

  console.log('🌸 Cherry blossom check:', {
    rMinusG: r - g,
    rMinusB: r - b,
    gMinusB: Math.abs(g - b),
    isPink: r > g && r > b && Math.abs(g - b) < 40 && brightness > 120
  });

  // Bright pink cherry blossom (R dominant, G and B balanced and high)
  if (isRedDominant && g >= 120 && b >= 120 && Math.abs(g - b) < 40 && brightness > 140) {
    const confidence = brightness > 170 ? 0.9 : 0.82;
    console.log('✅ DETECTED: Cherry Blossom (bright pink)');
    return { type: 'cherry-blossom', confidence, displayName: 'Cherry Blossom', color: hexColor };
  }

  // Medium pink cherry blossom (R dominant, G and B are close to each other)
  // IMPORTANT: Must have low red advantage to be pink, not red
  if (isRedDominant && g >= 100 && b >= 100 && Math.abs(g - b) < 35 && redAdvantage < 50 && brightness > 130) {
    console.log('✅ DETECTED: Cherry Blossom (medium pink)');
    return { type: 'cherry-blossom', confidence: 0.85, displayName: 'Cherry Blossom', color: hexColor };
  }

  // Light/soft pink cherry blossom (high brightness, low saturation, pinkish tint)
  if (brightness > 160 && saturation < 0.35 && r > g && r > b && r > 160) {
    console.log('✅ DETECTED: Cherry Blossom (soft pink)');
    return { type: 'cherry-blossom', confidence: 0.8, displayName: 'Cherry Blossom', color: hexColor };
  }

  // Very pale / near-white cherry blossom
  if (brightness > 210 && saturation < 0.15) {
    console.log('✅ DETECTED: Cherry Blossom (white/pale)');
    return { type: 'cherry-blossom', confidence: 0.75, displayName: 'Cherry Blossom', color: hexColor };
  }

  // Pastel pink (common cherry blossom color - pinkish with balanced G and B)
  if (r > 150 && g > 110 && b > 110 && r > g && r > b && Math.abs(g - b) < 30 && brightness > 140) {
    console.log('✅ DETECTED: Cherry Blossom (pastel pink)');
    return { type: 'cherry-blossom', confidence: 0.78, displayName: 'Cherry Blossom', color: hexColor };
  }

  // === ADDITIONAL ROSE FALLBACK ===
  // Catch any remaining red-dominant colors with decent saturation
  if (isRedDominant && redAdvantage > 20 && saturation > 0.35) {
    console.log('✅ DETECTED: Rose (red fallback)');
    return { type: 'rose', confidence: 0.75, displayName: 'Rose', color: hexColor };
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
