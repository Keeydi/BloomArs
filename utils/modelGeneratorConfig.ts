/**
 * Configuration for 3D Model Generation Services
 * 
 * FREE SOLUTIONS ONLY:
 * 
 * 1. ARKit/ARCore (On-Device - 100% FREE)
 *    - Native iOS/Android AR scanning
 *    - Real-time processing
 *    - No server needed
 *    - Medium quality, good for AR
 * 
 * 2. Local Processing (Advanced - 100% FREE)
 *    - Process on device
 *    - Complete privacy
 *    - Very slow, battery intensive
 */

export interface ModelGeneratorConfig {
  provider: 'arkit' | 'arcore';
  apiKey?: string; // Not needed for free solutions
  baseUrl?: string; // Not used for on-device solutions
  defaultQuality: 'low' | 'medium' | 'high';
  defaultFormat: 'glb' | 'gltf' | 'obj';
  enabled: boolean;
}

// Default configuration - On-device AR
export const defaultModelGeneratorConfig: ModelGeneratorConfig = {
  provider: 'arkit', // On-device AR scanning
  apiKey: undefined, // Not needed for free solutions
  baseUrl: undefined, // Not used for on-device
  defaultQuality: 'high',
  defaultFormat: 'glb', // GLB is best for React Native/Three.js
  enabled: true,
};

/**
 * Get configuration from environment or defaults
 */
export function getModelGeneratorConfig(): ModelGeneratorConfig {
  // You can override with environment variables
  return {
    provider: (process.env.EXPO_PUBLIC_MODEL_PROVIDER as any) || defaultModelGeneratorConfig.provider,
    apiKey: undefined, // Not needed for on-device solutions
    baseUrl: undefined, // Not used for on-device
    defaultQuality: (process.env.EXPO_PUBLIC_MODEL_QUALITY as any) || defaultModelGeneratorConfig.defaultQuality,
    defaultFormat: (process.env.EXPO_PUBLIC_MODEL_FORMAT as any) || defaultModelGeneratorConfig.defaultFormat,
    enabled: process.env.EXPO_PUBLIC_MODEL_GENERATION_ENABLED !== 'false',
  };
}

