export type BouquetCategory = 'Wedding' | 'Birthday' | 'Anniversary' | 'Valentines';

export interface Flower {
  id: string;
  color: string;
  quantity: number;
  size: number;
  shape?: string;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  rotation?: number;
}

export interface Ribbon {
  style: 'Silk' | 'Satin' | 'Velvet' | 'Lace';
  color: string;
}

export interface Wrapper {
  style: string;
  color: string;
}

export interface ARSettings {
  scale: number;
  rotation: number;
  position: 'center' | 'left' | 'right';
}

export interface Bouquet {
  id: string;
  category: BouquetCategory;
  flowers: Flower[];
  ribbon?: Ribbon;
  wrapper?: Wrapper;
  arSettings: ARSettings;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DetectedFlower {
  color: string;
  shape: string;
  confidence: number;
  imageUri?: string;
  detectedAt: number;
  flowerType?: string;
  flowerName?: string;
}

export interface CustomizationState {
  selectedFlowerId: string | null;
  isEditing: boolean;
  showAccessories: boolean;
}

