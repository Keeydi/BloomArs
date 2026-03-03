import { Platform } from 'react-native';

export interface ARPlane {
  id: string;
  center: { x: number; y: number; z: number };
  extent: { width: number; height: number };
  normal: { x: number; y: number; z: number };
}

export interface ARHitResult {
  position: { x: number; y: number; z: number };
  plane?: ARPlane;
  distance: number;
}

// Store XR session and frame references
let xrSession: XRSession | null = null;
let xrReferenceSpace: XRReferenceSpace | null = null;

/**
 * Initialize AR session using WebXR
 * This should be called from the AR component after XR context is available
 */
export async function initializeAR(): Promise<boolean> {
  try {
    // Check if platform supports AR
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      console.warn('AR only supported on Android and iOS');
      return false;
    }

    // Check if WebXR is available
    if (typeof navigator === 'undefined' || !navigator.xr) {
      console.warn('WebXR not available');
      return false;
    }

    // Check if immersive-ar mode is supported
    const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
    if (!isSupported) {
      console.warn('immersive-ar mode not supported');
      return false;
    }

    return true;
  } catch (error) {
    console.error('AR initialization error:', error);
    return false;
  }
}

export async function initializeARCore(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return initializeAR();
}

export async function initializeARKit(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return initializeAR();
}

export async function checkARSupport(): Promise<boolean> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return false;
  }

  try {
    if (typeof navigator === 'undefined' || !navigator.xr) {
      return false;
    }
    return await navigator.xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
}

export function getARPlatform(): 'ARCore' | 'ARKit' | 'none' {
  if (Platform.OS === 'android') {
    return 'ARCore';
  } else if (Platform.OS === 'ios') {
    return 'ARKit';
  }
  return 'none';
}

/**
 * Store XR session reference for use in utility functions
 * This should be called from the XR component when session starts
 */
export function setXRSession(session: XRSession, referenceSpace: XRReferenceSpace) {
  xrSession = session;
  xrReferenceSpace = referenceSpace;
}

/**
 * Clear XR session reference when session ends
 */
export function clearXRSession() {
  xrSession = null;
  xrReferenceSpace = null;
}

/**
 * Perform hit test to find surfaces in AR
 * @param x Screen X coordinate (normalized 0-1)
 * @param y Screen Y coordinate (normalized 0-1)
 * @returns Hit result with position and plane info, or null if no hit
 */
export async function hitTest(x: number, y: number): Promise<ARHitResult | null> {
  if (!xrSession || !xrReferenceSpace) {
    console.warn('XR session not initialized');
    return null;
  }

  try {
    // Get the current frame
    const frame = await new Promise<XRFrame>((resolve) => {
      xrSession!.requestAnimationFrame((time, frame) => resolve(frame));
    });

    // Create hit test source for screen tap
    const hitTestSource = await xrSession.requestHitTestSource({
      space: xrReferenceSpace,
    });

    if (!hitTestSource) {
      return null;
    }

    // Get hit test results
    const hitTestResults = frame.getHitTestResults(hitTestSource);

    if (hitTestResults.length === 0) {
      return null;
    }

    // Get the first hit result
    const hitResult = hitTestResults[0];
    const pose = hitResult.getPose(xrReferenceSpace);

    if (!pose) {
      return null;
    }

    // Extract position from pose matrix
    const position = {
      x: pose.transform.position.x,
      y: pose.transform.position.y,
      z: pose.transform.position.z,
    };

    // Calculate distance from camera
    const distance = Math.sqrt(
      position.x * position.x +
      position.y * position.y +
      position.z * position.z
    );

    return {
      position,
      distance,
    };
  } catch (error) {
    console.error('Hit test error:', error);
    return null;
  }
}

/**
 * Get detected planes from AR session
 * Note: WebXR doesn't directly expose plane detection like ARCore/ARKit
 * This returns planes from hit test results
 */
export async function getDetectedPlanes(): Promise<ARPlane[]> {
  if (!xrSession || !xrReferenceSpace) {
    return [];
  }

  // WebXR doesn't have direct plane detection API
  // Planes are inferred from hit test results
  // For now, return empty array - planes will be detected via hit testing
  return [];
}

/**
 * Get lighting estimation from AR environment
 * @returns Lighting intensity and color correction values
 */
export async function getLightingEstimation(): Promise<{
  intensity: number;
  colorCorrection: { r: number; g: number; b: number };
}> {
  if (!xrSession) {
    return {
      intensity: 1.0,
      colorCorrection: { r: 1.0, g: 1.0, b: 1.0 },
    };
  }

  try {
    // Get the current frame
    const frame = await new Promise<XRFrame>((resolve) => {
      xrSession!.requestAnimationFrame((time, frame) => resolve(frame));
    });

    // Get light estimate if available
    const lightEstimate = frame.lightEstimate;

    if (!lightEstimate) {
      return {
        intensity: 1.0,
        colorCorrection: { r: 1.0, g: 1.0, b: 1.0 },
      };
    }

    // Extract lighting data
    const sphericalHarmonics = lightEstimate.sphericalHarmonicsCoefficients;

    // Calculate average intensity from spherical harmonics
    let intensity = 1.0;
    if (sphericalHarmonics && sphericalHarmonics.length > 0) {
      // First coefficient represents ambient light
      const ambient = Math.abs(sphericalHarmonics[0]);
      intensity = Math.max(0.5, Math.min(2.0, ambient));
    }

    // Get primary light direction color
    const colorCorrection = lightEstimate.primaryLightIntensity || { r: 1.0, g: 1.0, b: 1.0 };

    return {
      intensity,
      colorCorrection: {
        r: colorCorrection.r || 1.0,
        g: colorCorrection.g || 1.0,
        b: colorCorrection.b || 1.0,
      },
    };
  } catch (error) {
    console.error('Light estimation error:', error);
    return {
      intensity: 1.0,
      colorCorrection: { r: 1.0, g: 1.0, b: 1.0 },
    };
  }
}

