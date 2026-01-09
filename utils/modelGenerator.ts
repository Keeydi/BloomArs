/**
 * 3D Model Generation Service
 * FREE solutions for converting scanned images to 3D models
 * 
 * Note: Backend server has been removed. Use on-device solutions like ARKit/ARCore
 * or integrate with external APIs if needed.
 */

export type ModelGeneratorProvider = 'luma' | 'polycam' | 'realitycapture' | 'kaedim';

export interface ModelGenerationOptions {
  provider?: ModelGeneratorProvider;
  apiKey?: string;
  baseUrl?: string;
  quality?: 'low' | 'medium' | 'high';
  format?: 'glb' | 'gltf' | 'obj';
}

export interface ModelGenerationResult {
  success: boolean;
  modelUrl?: string;
  modelPath?: string;
  error?: string;
  processingTime?: number;
  metadata?: {
    vertices?: number;
    faces?: number;
    textureSize?: string;
  };
}

/**
 * Generate 3D model from multiple images using Luma AI API
 * Best for: Single or multi-image, high quality, fast processing
 */
export async function generateModelWithLuma(
  imageUris: string[],
  apiKey: string,
  options?: Partial<ModelGenerationOptions>
): Promise<ModelGenerationResult> {
  try {
    // Luma AI API endpoint
    const apiUrl = options?.baseUrl || 'https://api.lumalabs.ai/v1/captures';
    
    // Upload images and create capture
    const formData = new FormData();
    imageUris.forEach((uri, index) => {
      formData.append('images', {
        uri,
        type: 'image/jpeg',
        name: `image_${index}.jpg`,
      } as any);
    });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Luma API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Poll for completion
    const captureId = data.capture_id;
    let modelUrl = null;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (!modelUrl && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`${apiUrl}/${captureId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      
      const statusData = await statusResponse.json();
      
      if (statusData.status === 'completed') {
        modelUrl = statusData.model_url;
        break;
      } else if (statusData.status === 'failed') {
        throw new Error('Model generation failed');
      }
      
      attempts++;
    }

    if (!modelUrl) {
      throw new Error('Model generation timeout');
    }

    return {
      success: true,
      modelUrl,
      metadata: data.metadata,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to generate model with Luma',
    };
  }
}

/**
 * Generate 3D model using Polycam API
 * Best for: Professional photogrammetry, multiple images required
 */
export async function generateModelWithPolycam(
  imageUris: string[],
  apiKey: string,
  options?: Partial<ModelGenerationOptions>
): Promise<ModelGenerationResult> {
  try {
    const apiUrl = options?.baseUrl || 'https://api.polycam.com/v1/scans';
    
    const formData = new FormData();
    imageUris.forEach((uri, index) => {
      formData.append('photos', {
        uri,
        type: 'image/jpeg',
        name: `photo_${index}.jpg`,
      } as any);
    });

    formData.append('quality', options?.quality || 'high');
    formData.append('format', options?.format || 'glb');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Polycam API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      modelUrl: data.model_url,
      metadata: {
        vertices: data.vertex_count,
        faces: data.face_count,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to generate model with Polycam',
    };
  }
}

// Custom backend function removed - use on-device solutions instead

/**
 * Main function to generate 3D model
 * Automatically selects provider based on options
 */
export async function generate3DModel(
  imageUris: string[],
  options: ModelGenerationOptions
): Promise<ModelGenerationResult> {
  if (imageUris.length === 0) {
    return {
      success: false,
      error: 'No images provided',
    };
  }

  // Note: Custom backend has been removed
  const provider = options.provider || 'luma';

  switch (provider) {
    case 'luma':
      // PAID: Requires API key
      if (!options.apiKey) {
        return {
          success: false,
          error: 'Luma API key is required (paid service)',
        };
      }
      return generateModelWithLuma(imageUris, options.apiKey, options);

    case 'polycam':
      // PAID: Requires API key
      if (!options.apiKey) {
        return {
          success: false,
          error: 'Polycam API key is required (paid service)',
        };
      }
      return generateModelWithPolycam(imageUris, options.apiKey, options);

    default:
      return {
        success: false,
        error: `Unsupported provider: ${provider}`,
      };
  }
}

/**
 * Download and save 3D model locally
 */
export async function downloadModel(
  modelUrl: string,
  filename: string
): Promise<string | null> {
  try {
    const FileSystem = require('expo-file-system');
    const modelsDir = `${FileSystem.documentDirectory}models/`;
    
    // Ensure directory exists
    const dirInfo = await FileSystem.getInfoAsync(modelsDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(modelsDir, { intermediates: true });
    }

    const fileUri = `${modelsDir}${filename}`;
    const downloadResult = await FileSystem.downloadAsync(modelUrl, fileUri);

    if (downloadResult.status === 200) {
      return downloadResult.uri;
    }

    return null;
  } catch (error) {
    console.error('Error downloading model:', error);
    return null;
  }
}

