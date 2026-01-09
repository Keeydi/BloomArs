/**
 * Scanning utilities for multi-image capture
 * Helps users capture multiple angles for better 3D reconstruction
 */

export interface ScanProgress {
  currentImage: number;
  totalImages: number;
  angle: string;
  instructions: string;
}

export const SCAN_ANGLES = [
  { angle: 'front', instructions: 'Capture the front view' },
  { angle: 'left', instructions: 'Move left and capture' },
  { angle: 'right', instructions: 'Move right and capture' },
  { angle: 'back', instructions: 'Capture the back view' },
  { angle: 'top', instructions: 'Capture from above (if possible)' },
  { angle: 'close-up', instructions: 'Get a close-up detail shot' },
];

export const MIN_IMAGES_FOR_SCAN = 3;
export const RECOMMENDED_IMAGES_FOR_SCAN = 5;

/**
 * Get scanning instructions for current step
 */
export function getScanInstructions(currentIndex: number, totalImages: number): ScanProgress {
  const angle = SCAN_ANGLES[currentIndex] || SCAN_ANGLES[0];
  
  return {
    currentImage: currentIndex + 1,
    totalImages,
    angle: angle.angle,
    instructions: angle.instructions,
  };
}

/**
 * Validate if enough images captured for 3D generation
 */
export function validateScanImages(imageCount: number): {
  valid: boolean;
  message: string;
} {
  if (imageCount < MIN_IMAGES_FOR_SCAN) {
    return {
      valid: false,
      message: `Please capture at least ${MIN_IMAGES_FOR_SCAN} images from different angles`,
    };
  }

  if (imageCount < RECOMMENDED_IMAGES_FOR_SCAN) {
    return {
      valid: true,
      message: `Recommended: Capture ${RECOMMENDED_IMAGES_FOR_SCAN} images for better quality`,
    };
  }

  return {
    valid: true,
    message: 'Great! You have enough images for high-quality 3D generation',
  };
}

/**
 * Calculate scan quality score based on image count and angles
 */
export function calculateScanQuality(imageCount: number, capturedAngles: string[]): {
  score: number;
  level: 'poor' | 'fair' | 'good' | 'excellent';
  feedback: string;
} {
  let score = 0;
  
  // Base score from image count
  score += Math.min(imageCount * 15, 60);
  
  // Bonus for diverse angles
  const uniqueAngles = new Set(capturedAngles).size;
  score += uniqueAngles * 10;
  
  // Cap at 100
  score = Math.min(score, 100);

  let level: 'poor' | 'fair' | 'good' | 'excellent';
  let feedback: string;

  if (score < 40) {
    level = 'poor';
    feedback = 'Capture more images from different angles for better results';
  } else if (score < 60) {
    level = 'fair';
    feedback = 'Good start! A few more angles will improve quality';
  } else if (score < 80) {
    level = 'good';
    feedback = 'Great coverage! This should produce a good 3D model';
  } else {
    level = 'excellent';
    feedback = 'Excellent! This will produce a high-quality 3D model';
  }

  return { score, level, feedback };
}


