import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bouquet, BouquetCategory, Flower, DetectedFlower, CustomizationState } from '@/types';

interface BouquetStore {
  currentBouquet: Bouquet | null;
  savedBouquets: Bouquet[];
  detectedFlower: DetectedFlower | null;
  selectedCategory: BouquetCategory | null;
  customizationState: CustomizationState;
  setSelectedCategory: (category: BouquetCategory) => void;
  setDetectedFlower: (flower: DetectedFlower | null) => void;
  clearDetectedFlower: () => void;
  getDetectedFlower: () => DetectedFlower | null;
  createBouquet: (category: BouquetCategory) => void;
  addFlower: (flower: Flower) => void;
  updateFlower: (flowerId: string, updates: Partial<Flower>) => void;
  removeFlower: (flowerId: string) => void;
  duplicateFlower: (flowerId: string) => void;
  setRibbon: (ribbon: Bouquet['ribbon']) => void;
  setWrapper: (wrapper: Bouquet['wrapper']) => void;
  updateARSettings: (settings: Partial<Bouquet['arSettings']>) => void;
  saveBouquet: () => void;
  loadBouquet: (bouquetId: string) => void;
  deleteBouquet: (bouquetId: string) => void;
  setCustomizationState: (state: Partial<CustomizationState>) => void;
  resetCurrentBouquet: () => void;
}

export const useBouquetStore = create<BouquetStore>()(
  persist(
    (set, get) => ({
      currentBouquet: null,
      savedBouquets: [],
      detectedFlower: null,
      selectedCategory: null,
      customizationState: {
        selectedFlowerId: null,
        isEditing: false,
        showAccessories: false,
      },

      setSelectedCategory: (category) => {
        set({ selectedCategory: category });
      },

      setDetectedFlower: (flower) => {
        if (flower) {
          set({ detectedFlower: { ...flower, detectedAt: Date.now() } });
        } else {
          set({ detectedFlower: null });
        }
      },
      
      clearDetectedFlower: () => {
        set({ detectedFlower: null });
      },
      
      getDetectedFlower: () => {
        const { detectedFlower } = get();
        if (!detectedFlower) return null;
        if (Date.now() - detectedFlower.detectedAt > 5000) {
          set({ detectedFlower: null });
          return null;
        }
        return detectedFlower;
      },

      createBouquet: (category) => {
        const newBouquet: Bouquet = {
          id: `BQ-${Date.now()}`,
          category,
          flowers: [],
          arSettings: {
            scale: 1.0,
            rotation: 0,
            position: 'center',
          },
          createdAt: new Date(),
        };
        set({ currentBouquet: newBouquet });
      },

      addFlower: (flower) => {
        const { currentBouquet } = get();
        if (currentBouquet) {
          set({
            currentBouquet: {
              ...currentBouquet,
              flowers: [...currentBouquet.flowers, flower],
              updatedAt: new Date(),
            },
          });
        }
      },

      updateFlower: (flowerId, updates) => {
        const { currentBouquet } = get();
        if (currentBouquet) {
          set({
            currentBouquet: {
              ...currentBouquet,
              flowers: currentBouquet.flowers.map((f) =>
                f.id === flowerId ? { ...f, ...updates } : f
              ),
              updatedAt: new Date(),
            },
          });
        }
      },

      removeFlower: (flowerId) => {
        const { currentBouquet } = get();
        if (currentBouquet) {
          set({
            currentBouquet: {
              ...currentBouquet,
              flowers: currentBouquet.flowers.filter((f) => f.id !== flowerId),
              updatedAt: new Date(),
            },
          });
        }
      },

      duplicateFlower: (flowerId) => {
        const { currentBouquet } = get();
        if (currentBouquet) {
          const flower = currentBouquet.flowers.find((f) => f.id === flowerId);
          if (flower) {
            const duplicatedFlower: Flower = {
              ...flower,
              id: `flower-${Date.now()}-${Math.random()}`,
            };
            set({
              currentBouquet: {
                ...currentBouquet,
                flowers: [...currentBouquet.flowers, duplicatedFlower],
                updatedAt: new Date(),
              },
            });
          }
        }
      },

      setRibbon: (ribbon) => {
        const { currentBouquet } = get();
        if (currentBouquet) {
          set({
            currentBouquet: {
              ...currentBouquet,
              ribbon,
              updatedAt: new Date(),
            },
          });
        }
      },

      setWrapper: (wrapper) => {
        const { currentBouquet } = get();
        if (currentBouquet) {
          set({
            currentBouquet: {
              ...currentBouquet,
              wrapper,
              updatedAt: new Date(),
            },
          });
        }
      },

      updateARSettings: (settings) => {
        const { currentBouquet } = get();
        if (currentBouquet) {
          set({
            currentBouquet: {
              ...currentBouquet,
              arSettings: {
                ...currentBouquet.arSettings,
                ...settings,
              },
              updatedAt: new Date(),
            },
          });
        }
      },

      saveBouquet: () => {
        const { currentBouquet, savedBouquets } = get();
        if (currentBouquet) {
          const existingIndex = savedBouquets.findIndex(
            (b) => b.id === currentBouquet.id
          );
          const updatedBouquet = {
            ...currentBouquet,
            updatedAt: new Date(),
          };

          if (existingIndex >= 0) {
            const updated = [...savedBouquets];
            updated[existingIndex] = updatedBouquet;
            set({ savedBouquets: updated });
          } else {
            set({ savedBouquets: [...savedBouquets, updatedBouquet] });
          }
        }
      },

      loadBouquet: (bouquetId) => {
        const { savedBouquets } = get();
        const bouquet = savedBouquets.find((b) => b.id === bouquetId);
        if (bouquet) {
          set({ currentBouquet: bouquet });
        }
      },

      deleteBouquet: (bouquetId) => {
        const { savedBouquets } = get();
        set({
          savedBouquets: savedBouquets.filter((b) => b.id !== bouquetId),
        });
      },

      setCustomizationState: (state) => {
        set({
          customizationState: {
            ...get().customizationState,
            ...state,
          },
        });
      },

      resetCurrentBouquet: () => {
        set({
          currentBouquet: null,
          detectedFlower: null,
          selectedCategory: null,
          customizationState: {
            selectedFlowerId: null,
            isEditing: false,
            showAccessories: false,
          },
        });
      },
    }),
    {
      name: 'bloomar-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        savedBouquets: state.savedBouquets,
      }),
    }
  )
);

