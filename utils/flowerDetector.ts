/**
 * Flower type detection based on color analysis
 * Maps detected colors to available flower 3D models
 */

interface FlowerTypeResult {
  type: 'tulip' | 'rose' | 'sunflower' | 'cherry-blossom' | 'generic-flower';
  confidence: number;
  displayName: string;
}

/**
 * Detect flower type based on dominant color
 * Returns the flower type that matches available 3D models
 */
export function detectFlowerType(hexColor: string): FlowerTypeResult {
  // Convert hex to RGB
  const r = parseInt(hexColor.substring(1, 3), 16);
  const g = parseInt(hexColor.substring(3, 5), 16);
  const b = parseInt(hexColor.substring(5, 7), 16);

  // Calculate color properties
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = (r + g + b) / 3;
  const saturation = max === 0 ? 0 : (max - min) / max;

  console.log('🎨 Color Analysis:', {
    hex: hexColor,
    rgb: { r, g, b },
    brightness,
    saturation: saturation.toFixed(2)
  });

  // Detect flower type based on color characteristics
  // ORDER MATTERS! Check most specific colors first (sunflower, cherry blossom)
  // before checking generic colors (rose, tulip)

  // Pure/Bright Yellow (high R & G, low B) = Sunflower
  console.log('🌻 Sunflower check:', { r, g, b, rCheck: r > 200, gCheck: g > 160, bCheck: b < 100, diffCheck: Math.abs(r - g) < 80 });
  // Check FIRST to avoid being caught by other rules
  // Sunflowers are typically bright yellow with R and G both high, and B very low
  if (r > 200 && g > 160 && b < 100 && Math.abs(r - g) < 80) {
    console.log('✅ DETECTED: Sunflower');
    return {
      type: 'sunflower',
      confidence: 0.9,
      displayName: 'Sunflower',
    };
  }

  // Light Pink = Cherry Blossom (all three channels high, very light/bright)
  // Check BEFORE rose/tulip detection to catch light pink colors
  // Cherry blossoms are pale pink with high RGB values and high brightness
  console.log('🌸 Cherry blossom check:', { r, g, b, brightness, rCheck: r > 180, gCheck: g > 140, bCheck: b > 150, brightCheck: brightness > 170, pinkCheck: r >= g && r >= b });
  if (r > 180 && g > 140 && b > 150 && brightness > 170) {
    // Check if it's pinkish (R slightly higher than G and B)
    if (r >= g && r >= b) {
      console.log('✅ DETECTED: Cherry Blossom');
      return {
        type: 'cherry-blossom',
        confidence: 0.8,
        displayName: 'Cherry Blossom',
      };
    }
  }

  // Red/Rose detection - check if red is the dominant color
  // Handles both bright red and darker/dull red roses
  // Must NOT match cherry blossoms (which are light pink) or sunflowers (which are yellow)
  if (r >= g && r >= b) {
    // Red is the highest channel
    // Check if it's significantly more red than green AND blue
    const redAdvantage = Math.min(r - g, r - b);

    // If red is at least 10 points higher than both others, AND not too bright/light
    // (to avoid catching cherry blossoms), it's likely a rose
    if (redAdvantage >= 10 && g < 180 && b < 180 && brightness < 200) {
      return {
        type: 'rose',
        confidence: 0.85,
        displayName: 'Rose',
      };
    }
  }

  // Pink/Magenta (high R, high B, medium-low G) = Tulip (most pink flowers)
  // This catches common pink tulips like #E22AB0
  if (r > 180 && b > 100 && g < r * 0.6 && b > g) {
    return {
      type: 'tulip',
      confidence: 0.85,
      displayName: 'Tulip',
    };
  }

  // Orange (R > G, low B) = Could be Tulip or Sunflower
  if (r > 200 && g > 100 && g < 180 && b < 100) {
    // More red than yellow = Tulip
    if (r - g > 50) {
      return {
        type: 'tulip',
        confidence: 0.75,
        displayName: 'Tulip',
      };
    }
    // Balanced orange = Sunflower
    return {
      type: 'sunflower',
      confidence: 0.7,
      displayName: 'Sunflower',
    };
  }

  // Yellow with some variation = Tulip (yellow tulips common)
  if (r > 200 && g > 180 && b < 150 && b > 50) {
    return {
      type: 'tulip',
      confidence: 0.8,
      displayName: 'Tulip',
    };
  }

  // Purple/Violet = Tulip
  if (b > 120 && r > 100 && r < 220 && g < 180) {
    return {
      type: 'tulip',
      confidence: 0.75,
      displayName: 'Tulip',
    };
  }

  // White/Light colors = Cherry Blossom
  if (brightness > 200 && saturation < 0.3) {
    return {
      type: 'cherry-blossom',
      confidence: 0.7,
      displayName: 'Cherry Blossom',
    };
  }

  // Medium brightness warm colors = Tulip (default for pinks, reds, yellows)
  if (r > 100 && (r > g || g > 100) && b < 150) {
    return {
      type: 'tulip',
      confidence: 0.6,
      displayName: 'Tulip',
    };
  }

  // Default fallback = Generic flower
  console.log('⚠️ No specific match found, defaulting to generic flower');
  return {
    type: 'generic-flower',
    confidence: 0.5,
    displayName: 'Flower',
  };
}

/**
 * Get available 3D models
 * Returns list of flower types that have 3D models in assets
 */
export function getAvailableFlowerModels(): string[] {
  return ['tulip', 'rose', 'sunflower', 'cherry-blossom', 'generic-flower'];
}

/**
 * Check if a flower type has a 3D model available
 */
export function hasModelForFlowerType(flowerType: string): boolean {
  return getAvailableFlowerModels().includes(flowerType);
}
