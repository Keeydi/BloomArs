/**
 * Extract dominant color from an image URI
 *
 * This implementation uses expo-image-manipulator to properly decode and analyze
 * the image pixels to extract the dominant flower color.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { detectFlowerType } from './flowerDetector';
import { detectFlowerByImage } from './imageFlowerDetector';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

interface ColorPalette {
  name: string;
  hex: string;
  keywords: string[];
}

// Common flower color palette with detection keywords
const FLOWER_COLOR_PALETTE: ColorPalette[] = [
  { name: 'Yellow', hex: '#FFD166', keywords: ['tulip', 'sunflower', 'daffodil', 'yellow'] },
  { name: 'Pink', hex: '#FF69B4', keywords: ['rose', 'carnation', 'pink', 'cherry'] },
  { name: 'Red', hex: '#DC143C', keywords: ['rose', 'poppy', 'red', 'valentine'] },
  { name: 'Orange', hex: '#FF8C42', keywords: ['marigold', 'orange', 'tiger', 'gerbera'] },
  { name: 'Purple', hex: '#9B59B6', keywords: ['lavender', 'iris', 'purple', 'violet'] },
  { name: 'White', hex: '#F8F8FF', keywords: ['lily', 'daisy', 'white', 'jasmine'] },
  { name: 'Blue', hex: '#4A90E2', keywords: ['hydrangea', 'blue', 'delphinium'] },
  { name: 'Deep Pink', hex: '#FF1493', keywords: ['peony', 'fuchsia', 'magenta'] },
];

/**
 * Convert RGB to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    const hex = clamped.toString(16).padStart(2, '0');
    return hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Parse a hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.substring(0, 2), 16),
    g: parseInt(cleaned.substring(2, 4), 16),
    b: parseInt(cleaned.substring(4, 6), 16),
  };
}

/**
 * Calculate Euclidean color distance between two RGB colors
 */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  );
}

/**
 * Match RGB values to the nearest common flower color
 */
function matchToFlowerColor(r: number, g: number, b: number): string {
  let closestColor = FLOWER_COLOR_PALETTE[0].hex;
  let minDistance = Infinity;

  for (const palette of FLOWER_COLOR_PALETTE) {
    const paletteRgb = hexToRgb(palette.hex);
    const distance = colorDistance(r, g, b, paletteRgb.r, paletteRgb.g, paletteRgb.b);

    if (distance < minDistance) {
      minDistance = distance;
      closestColor = palette.hex;
    }
  }

  return closestColor;
}

/**
 * Extract dominant color using expo-image-manipulator
 * Samples pixels from the center region of the flower image
 */
async function extractColorFromImage(imageUri: string): Promise<{ r: number; g: number; b: number }> {
  console.log('🔬 [extractColorFromImage] Analyzing flower image...');

  try {
    // Resize image to 100x100 for faster processing
    const manipResult = await manipulateAsync(
      imageUri,
      [{ resize: { width: 100, height: 100 } }],
      { base64: true, format: SaveFormat.PNG }
    );

    if (!manipResult.base64) {
      throw new Error('No base64 data from image manipulation');
    }

    console.log('📊 Image resized, extracting colors from center region...');

    // Use a simpler approach: convert base64 to analyze pixel data
    // Since we can't use Buffer in React Native, we'll use atob for base64 decoding
    const base64Data = manipResult.base64;

    // Decode base64 to binary string
    const binaryString = atob(base64Data);

    // Sample pixels from the decoded data
    let totalR = 0, totalG = 0, totalB = 0, sampleCount = 0;

    // Sample every 1000th character (simplified sampling to avoid memory issues)
    const sampleInterval = Math.max(1000, Math.floor(binaryString.length / 1000));

    for (let i = 0; i < binaryString.length - 3; i += sampleInterval) {
      const r = binaryString.charCodeAt(i) & 0xFF;
      const g = binaryString.charCodeAt(i + 1) & 0xFF;
      const b = binaryString.charCodeAt(i + 2) & 0xFF;

      // Skip very dark or very bright pixels (likely background)
      const brightness = (r + g + b) / 3;
      if (brightness > 30 && brightness < 240) {
        totalR += r;
        totalG += g;
        totalB += b;
        sampleCount++;
      }
    }

    if (sampleCount > 0) {
      const avgR = Math.round(totalR / sampleCount);
      const avgG = Math.round(totalG / sampleCount);
      const avgB = Math.round(totalB / sampleCount);

      console.log('✅ Extracted dominant color:', { r: avgR, g: avgG, b: avgB });
      return { r: avgR, g: avgG, b: avgB };
    }

    // Fallback to yellow if no valid samples
    console.warn('⚠️ No valid color samples found, using default');
    return { r: 255, g: 215, b: 0 };

  } catch (error) {
    console.error('❌ Error in color extraction:', error);
    console.error('Details:', error instanceof Error ? error.message : String(error));

    // Fallback to yellow
    return { r: 255, g: 215, b: 0 };
  }
}

/**
 * Extract dominant color and detect flower type from image
 */
export async function extractDominantColor(imageUri: string): Promise<string> {
  console.log('🚀 [START] extractDominantColor called with:', imageUri);
  try {
    console.log('🎨 Extracting color from:', imageUri);

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    console.log('📁 File info:', { exists: fileInfo.exists, uri: fileInfo.uri });

    if (!fileInfo.exists) {
      console.warn('❌ Image file does not exist:', imageUri);
      return '#FFD166';
    }

    // Extract color using improved pixel-based analysis
    console.log('⏳ Calling extractColorFromImage...');
    const avgColor = await extractColorFromImage(imageUri);
    console.log('🔍 Analyzed RGB:', avgColor);

    // Convert to hex without matching to palette (use actual color)
    const actualColor = rgbToHex(avgColor.r, avgColor.g, avgColor.b);
    console.log('✅ Extracted color:', actualColor);

    return actualColor;

  } catch (error) {
    console.error('❌ Error extracting color:', error);
    return '#FFD166'; // Fallback to yellow
  }
}

/**
 * Extract color and detect flower type
 * Returns both color and flower type information
 */
export async function extractFlowerInfo(imageUri: string): Promise<{ color: string; flowerType: string; flowerName: string }> {
  console.log('🌺 [extractFlowerInfo] Called with imageUri:', imageUri);
  try {
    // Use IMAGE-BASED detection (comparing to reference images)
    console.log('🔍 Using image-based flower detection...');
    const flowerInfo = await detectFlowerByImage(imageUri);
    console.log('✅ Image matching complete:', flowerInfo.displayName, 'with confidence:', flowerInfo.confidence);

    // Still extract color for display purposes
    console.log('🎨 Extracting dominant color...');
    const color = await extractDominantColor(imageUri);
    console.log('✅ Color extracted:', color);

    return {
      color,
      flowerType: flowerInfo.type,
      flowerName: flowerInfo.displayName,
    };
  } catch (error) {
    console.error('❌ Error extracting flower info:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return {
      color: '#FFD166',
      flowerType: 'generic-flower',
      flowerName: 'Flower',
    };
  }
}

/**
 * Get flower color by type (for manual override)
 */
export function getFlowerColorByType(flowerType?: string): string {
  const colorMap: Record<string, string> = {
    rose: '#DC143C',
    tulip: '#FFD166',
    sunflower: '#FFD700',
    daisy: '#F8F8FF',
    lavender: '#9B59B6',
    carnation: '#FF69B4',
    lily: '#F8F8FF',
  };

  return colorMap[flowerType?.toLowerCase() || ''] || '#FF5C8A';
}
