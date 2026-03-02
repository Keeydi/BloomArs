/**
 * Flower detection using color analysis
 * Analyzes the dominant color of scanned flower images to identify flower type
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export type FlowerType = 'rose' | 'tulip' | 'sunflower' | 'cherry-blossom' | 'generic-flower';

interface FlowerMatchResult {
  type: FlowerType;
  confidence: number;
  displayName: string;
}

/**
 * Extract dominant color from image
 * Samples pixels from the center region and calculates average RGB
 */
async function extractDominantColor(imageUri: string): Promise<{
  r: number;
  g: number;
  b: number;
  brightness: number;
  saturation: number;
}> {
  try {
    // Resize to 100x100 for faster processing
    const manipResult = await manipulateAsync(
      imageUri,
      [{ resize: { width: 100, height: 100 } }],
      { base64: true, format: SaveFormat.PNG }
    );

    if (!manipResult.base64) {
      throw new Error('No base64 data');
    }

    const binaryString = atob(manipResult.base64);

    let totalR = 0, totalG = 0, totalB = 0;
    let pixelCount = 0;

    // Focus on center region (25% to 75% of image)
    const centerStart = Math.floor(binaryString.length * 0.25);
    const centerEnd = Math.floor(binaryString.length * 0.75);

    for (let i = centerStart; i < centerEnd - 3; i += 4) {
      const r = binaryString.charCodeAt(i) & 0xFF;
      const g = binaryString.charCodeAt(i + 1) & 0xFF;
      const b = binaryString.charCodeAt(i + 2) & 0xFF;

      // Skip very dark or very bright pixels (likely background)
      const brightness = (r + g + b) / 3;
      if (brightness > 40 && brightness < 230) {
        totalR += r;
        totalG += g;
        totalB += b;
        pixelCount++;
      }
    }

    if (pixelCount > 0) {
      const avgR = totalR / pixelCount;
      const avgG = totalG / pixelCount;
      const avgB = totalB / pixelCount;
      const brightness = (avgR + avgG + avgB) / 3;
      const max = Math.max(avgR, avgG, avgB);
      const min = Math.min(avgR, avgG, avgB);
      const saturation = max === 0 ? 0 : (max - min) / max;

      return {
        r: Math.round(avgR),
        g: Math.round(avgG),
        b: Math.round(avgB),
        brightness,
        saturation,
      };
    }

    // Default fallback
    return { r: 200, g: 100, b: 100, brightness: 133, saturation: 0.5 };
  } catch (error) {
    console.error('Error extracting color:', error);
    return { r: 200, g: 100, b: 100, brightness: 133, saturation: 0.5 };
  }
}

/**
 * Detect flower type based on color analysis
 * Uses specific color rules to identify different flower types
 */
export async function detectFlowerByImage(scannedImageUri: string): Promise<FlowerMatchResult> {
  console.log('🔍 [Flower Detection] Starting color-based detection...');

  try {
    const color = await extractDominantColor(scannedImageUri);
    const { r, g, b, brightness, saturation } = color;

    console.log('🎨 Extracted color:', { r, g, b, brightness: brightness.toFixed(1), saturation: saturation.toFixed(2) });

    // Calculate color characteristics
    const isRedDominant = r > g && r > b;
    const isBlueDominant = b > r && b > g;
    const redAdvantage = Math.min(r - g, r - b);
    const isYellowish = r > 180 && g > 150 && b < 120 && Math.abs(r - g) < 60;
    const isPink = r > 180 && brightness > 150 && saturation < 0.5;
    const isDeepRed = r > 150 && g < 100 && b < 100;
    const isLightPink = r > 200 && g > 170 && b > 180 && brightness > 190;

    console.log('🔬 Color analysis:', {
      isRedDominant,
      redAdvantage,
      isYellowish,
      isPink,
      isDeepRed,
      isLightPink,
    });

    // === SUNFLOWER ===
    // Bright yellow: high R & G, low B
    if (isYellowish && r > 200 && g > 180 && b < 100) {
      console.log('✅ DETECTED: Sunflower (bright yellow)');
      return {
        type: 'sunflower',
        confidence: 0.9,
        displayName: 'Sunflower',
      };
    }

    // === ROSE ===
    // Red roses: Red dominant with significant advantage over G and B
    // Key: roses are RED (low G, low B), NOT pink (which has higher G and B)
    if (isRedDominant && redAdvantage > 30 && g < 150 && b < 150) {
      console.log('✅ DETECTED: Rose (red dominant, redAdvantage:', redAdvantage, ')');
      return {
        type: 'rose',
        confidence: 0.9,
        displayName: 'Rose',
      };
    }

    // Deep red roses (darker lighting)
    if (isDeepRed && saturation > 0.4) {
      console.log('✅ DETECTED: Rose (deep red)');
      return {
        type: 'rose',
        confidence: 0.85,
        displayName: 'Rose',
      };
    }

    // Pink roses - still red dominant but more pink tones
    if (isRedDominant && r > 180 && g > 80 && g < 160 && b > 80 && b < 180 && redAdvantage > 15) {
      console.log('✅ DETECTED: Rose (pink rose)');
      return {
        type: 'rose',
        confidence: 0.8,
        displayName: 'Rose',
      };
    }

    // === CHERRY BLOSSOM ===
    // Very light pink / almost white: all channels high, very bright
    if (isLightPink && brightness > 200) {
      console.log('✅ DETECTED: Cherry Blossom (very light pink)');
      return {
        type: 'cherry-blossom',
        confidence: 0.85,
        displayName: 'Cherry Blossom',
      };
    }

    // Light pink with low saturation
    if (isPink && brightness > 180 && saturation < 0.35 && r > 200) {
      console.log('✅ DETECTED: Cherry Blossom (pale pink)');
      return {
        type: 'cherry-blossom',
        confidence: 0.8,
        displayName: 'Cherry Blossom',
      };
    }

    // White/cream flowers
    if (brightness > 210 && saturation < 0.2) {
      console.log('✅ DETECTED: Cherry Blossom (white/cream)');
      return {
        type: 'cherry-blossom',
        confidence: 0.7,
        displayName: 'Cherry Blossom',
      };
    }

    // === TULIP ===
    // Purple/violet tulips
    if (isBlueDominant || (b > 100 && r > 100 && r < 200 && g < 150)) {
      console.log('✅ DETECTED: Tulip (purple/violet)');
      return {
        type: 'tulip',
        confidence: 0.8,
        displayName: 'Tulip',
      };
    }

    // Orange tulips
    if (r > 200 && g > 80 && g < 160 && b < 80) {
      console.log('✅ DETECTED: Tulip (orange)');
      return {
        type: 'tulip',
        confidence: 0.8,
        displayName: 'Tulip',
      };
    }

    // Yellow tulips (less saturated yellow than sunflower)
    if (r > 200 && g > 150 && b < 130 && b > 50) {
      console.log('✅ DETECTED: Tulip (yellow)');
      return {
        type: 'tulip',
        confidence: 0.75,
        displayName: 'Tulip',
      };
    }

    // Magenta/pink tulips
    if (r > 180 && b > 100 && g < r * 0.5) {
      console.log('✅ DETECTED: Tulip (magenta/pink)');
      return {
        type: 'tulip',
        confidence: 0.75,
        displayName: 'Tulip',
      };
    }

    // === FALLBACK: Check general color categories ===

    // Any clearly red flower defaults to rose
    if (isRedDominant && r > 150 && saturation > 0.3) {
      console.log('✅ DETECTED: Rose (fallback - red dominant)');
      return {
        type: 'rose',
        confidence: 0.7,
        displayName: 'Rose',
      };
    }

    // Any clearly yellow flower defaults to sunflower
    if (r > 180 && g > 150 && b < 100) {
      console.log('✅ DETECTED: Sunflower (fallback - yellow)');
      return {
        type: 'sunflower',
        confidence: 0.65,
        displayName: 'Sunflower',
      };
    }

    // Default fallback
    console.log('⚠️ No specific match, defaulting to generic flower');
    return {
      type: 'generic-flower',
      confidence: 0.5,
      displayName: 'Flower',
    };

  } catch (error) {
    console.error('❌ Error in flower detection:', error);
    return {
      type: 'generic-flower',
      confidence: 0.5,
      displayName: 'Flower',
    };
  }
}
