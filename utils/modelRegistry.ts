/**
 * 3D Model Registry
 * Manages available 3D flower models and their asset paths
 */

export type FlowerModelType = 'tulip' | 'rose' | 'sunflower' | 'cherry-blossom' | 'generic-flower';

interface FlowerModelInfo {
  type: FlowerModelType;
  displayName: string;
  modelPath: any; // require() result
  emoji: string;
}

/**
 * Registry of available 3D models
 * Add your GLB files to assets/models/ and register them here
 */
const FLOWER_MODELS: Record<FlowerModelType, FlowerModelInfo> = {
  'tulip': {
    type: 'tulip',
    displayName: 'Tulip',
    modelPath: require('../assets/models/tulip.glb'),
    emoji: '🌷',
  },
  'rose': {
    type: 'rose',
    displayName: 'Rose',
    modelPath: require('../assets/models/rose.glb'),
    emoji: '🌹',
  },
  'sunflower': {
    type: 'sunflower',
    displayName: 'Sunflower',
    modelPath: require('../assets/models/sunflower.glb'),
    emoji: '🌻',
  },
  'cherry-blossom': {
    type: 'cherry-blossom',
    displayName: 'Cherry Blossom',
    modelPath: require('../assets/models/cherry-blossom.glb'),
    emoji: '🌸',
  },
  'generic-flower': {
    type: 'generic-flower',
    displayName: 'Flower',
    modelPath: require('../assets/models/Flower.glb'),
    emoji: '🌼',
  },
};

/**
 * Get model info for a flower type
 */
export function getFlowerModel(flowerType: FlowerModelType): FlowerModelInfo {
  return FLOWER_MODELS[flowerType] || FLOWER_MODELS['generic-flower'];
}

/**
 * Get all available flower models
 */
export function getAllFlowerModels(): FlowerModelInfo[] {
  return Object.values(FLOWER_MODELS);
}

/**
 * Check if a model exists for a flower type
 */
export function hasFlowerModel(flowerType: string): boolean {
  return flowerType in FLOWER_MODELS;
}
