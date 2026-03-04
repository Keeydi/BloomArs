import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useBouquetStore } from '@/store/bouquetStore';
import { BackgroundGradient } from '@/components/BackgroundGradient';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, PresetColors } from '@/constants/Colors';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Ribbon } from '@/types';
import { getFlowerModel } from '@/utils/modelRegistry';

const RIBBON_STYLES: Ribbon['style'][] = ['Silk', 'Satin', 'Velvet', 'Lace'];
const WRAPPER_STYLES = ['Classic', 'Modern', 'Rustic', 'Elegant'];

export default function EditorScreen() {
  const router = useRouter();
  const {
    currentBouquet,
    detectedFlower,
    addFlower,
    clearDetectedFlower,
    saveBouquet,
    duplicateFlower,
    removeFlower,
    updateFlower,
    setRibbon,
    setWrapper,
  } = useBouquetStore();

  const [localDetectedFlower, setLocalDetectedFlower] = useState(detectedFlower);
  const [expandedFlowerId, setExpandedFlowerId] = useState<string | null>(null);
  const [showAccessories, setShowAccessories] = useState(false);

  useEffect(() => {
    const flower = detectedFlower;
    if (flower) {
      console.log('🌸 New flower detected:', flower);
      setLocalDetectedFlower(flower);
    }
  }, [detectedFlower]);

  const handleAddFlower = () => {
    if (!localDetectedFlower) {
      Alert.alert('No Flower', 'Please scan a flower first.');
      return;
    }

    const newFlower = {
      id: `flower-${Date.now()}-${Math.random()}`,
      flowerType: localDetectedFlower.flowerType || 'rose',
      color: localDetectedFlower.color,
      quantity: 1,
      size: 1.0,
      shape: localDetectedFlower.shape,
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
      rotation: 0,
    };

    addFlower(newFlower);
    clearDetectedFlower();
    setLocalDetectedFlower(null);

    Alert.alert(
      'Flower Added!',
      'Your flower has been added to the bouquet.',
      [{ text: 'OK' }]
    );
  };

  const handleScanAnother = () => {
    router.push({
      pathname: '/camera',
      params: { category: currentBouquet?.category || 'Wedding' },
    });
  };

  const handleSaveBouquet = () => {
    if (!currentBouquet?.flowers.length) {
      Alert.alert('Empty Bouquet', 'Please add at least one flower to your bouquet.');
      return;
    }

    saveBouquet();
    Alert.alert(
      'Bouquet Saved!',
      'Your bouquet has been saved successfully.',
      [
        {
          text: 'OK',
          onPress: () => router.push('/'),
        },
      ]
    );
  };

  const handleDuplicateFlower = (flowerId: string) => {
    duplicateFlower(flowerId);
  };

  const handleDeleteFlower = (flowerId: string) => {
    Alert.alert(
      'Delete Flower',
      'Are you sure you want to remove this flower?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (expandedFlowerId === flowerId) {
              setExpandedFlowerId(null);
            }
            removeFlower(flowerId);
          },
        },
      ]
    );
  };

  const handleFlowerPress = (flowerId: string) => {
    setExpandedFlowerId(expandedFlowerId === flowerId ? null : flowerId);
  };

  const handleColorChange = (flowerId: string, color: string) => {
    updateFlower(flowerId, { color });
  };

  const handleSizeChange = (flowerId: string, currentSize: number, delta: number) => {
    const newSize = Math.max(0.5, Math.min(2.0, currentSize + delta));
    updateFlower(flowerId, { size: newSize });
  };

  const handleRotationChange = (flowerId: string, currentRotation: number, delta: number) => {
    let newRotation = currentRotation + delta;
    if (newRotation >= 360) newRotation -= 360;
    if (newRotation < 0) newRotation += 360;
    updateFlower(flowerId, { rotation: newRotation });
  };

  const handleQuantityChange = (flowerId: string, currentQuantity: number, delta: number) => {
    const newQuantity = Math.max(1, Math.min(10, currentQuantity + delta));
    updateFlower(flowerId, { quantity: newQuantity });
  };

  const handleRibbonStyleChange = (style: Ribbon['style']) => {
    setRibbon({
      style,
      color: currentBouquet?.ribbon?.color || '#FF5C8A',
    });
  };

  const handleRibbonColorChange = (color: string) => {
    setRibbon({
      style: currentBouquet?.ribbon?.style || 'Silk',
      color,
    });
  };

  const handleWrapperStyleChange = (style: string) => {
    setWrapper({
      style,
      color: currentBouquet?.wrapper?.color || '#FFFFFF',
    });
  };

  const handleWrapperColorChange = (color: string) => {
    setWrapper({
      style: currentBouquet?.wrapper?.style || 'Classic',
      color,
    });
  };

  const handleARPreview = () => {
    if (!currentBouquet?.flowers.length) {
      Alert.alert('Empty Bouquet', 'Please add at least one flower to preview in AR.');
      return;
    }
    router.push('/ar-preview');
  };

  const backgroundCircles = [
    { size: 200, color: 'rgba(255, 92, 138, 0.08)', top: -50, right: -50 },
    { size: 150, color: 'rgba(255, 209, 102, 0.06)', bottom: 100, left: -40 },
  ];

  return (
    <BackgroundGradient circles={backgroundCircles}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Bouquet Editor</Text>
          <Text style={styles.subtitle}>
            {currentBouquet?.category || 'Custom'} Bouquet
          </Text>
        </View>

        {/* Detected Flower Section */}
        {localDetectedFlower && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scanned Flower</Text>
            <View style={styles.detectedFlowerCard}>
              {localDetectedFlower.imageUri && (
                <Image
                  source={{ uri: localDetectedFlower.imageUri }}
                  style={styles.flowerImage}
                  resizeMode="cover"
                />
              )}
              <View style={styles.flowerInfo}>
                <View style={styles.flowerInfoRow}>
                  <Text style={styles.flowerInfoLabel}>Color:</Text>
                  <View style={styles.colorPreview}>
                    <View
                      style={[
                        styles.colorCircle,
                        { backgroundColor: localDetectedFlower.color },
                      ]}
                    />
                    <Text style={styles.flowerInfoValue}>
                      {localDetectedFlower.color}
                    </Text>
                  </View>
                </View>
                <View style={styles.flowerInfoRow}>
                  <Text style={styles.flowerInfoLabel}>Shape:</Text>
                  <Text style={styles.flowerInfoValue}>
                    {localDetectedFlower.shape}
                  </Text>
                </View>
                <View style={styles.flowerInfoRow}>
                  <Text style={styles.flowerInfoLabel}>Confidence:</Text>
                  <Text style={styles.flowerInfoValue}>
                    {(localDetectedFlower.confidence * 100).toFixed(0)}%
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddFlower}
              >
                <LinearGradient
                  colors={['#FF5C8A', '#FF8FA3']}
                  style={styles.addButtonGradient}
                >
                  <Text style={styles.addButtonText}>Add to Bouquet</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Current Bouquet Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Bouquet Flowers ({currentBouquet?.flowers.length || 0})
          </Text>
          {currentBouquet?.flowers && currentBouquet.flowers.length > 0 ? (
            <View style={styles.flowersGrid}>
              {currentBouquet.flowers.map((flower, index) => (
                <View key={flower.id}>
                  <TouchableOpacity
                    style={[
                      styles.flowerItem,
                      expandedFlowerId === flower.id && styles.flowerItemExpanded,
                    ]}
                    onPress={() => handleFlowerPress(flower.id)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.flowerColorDot,
                        { backgroundColor: flower.color },
                      ]}
                    />
                    <View style={styles.flowerItemInfo}>
                      <Text style={styles.flowerItemText}>
                        {getFlowerModel(flower.flowerType as any).emoji} {getFlowerModel(flower.flowerType as any).displayName}
                      </Text>
                      <Text style={styles.flowerItemSubtext}>
                        Size: {flower.size.toFixed(1)}x • Qty: {flower.quantity}
                      </Text>
                    </View>
                    <View style={styles.flowerActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDuplicateFlower(flower.id)}
                      >
                        <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDeleteFlower(flower.id)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#FF5C8A" />
                      </TouchableOpacity>
                      <Ionicons
                        name={expandedFlowerId === flower.id ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="rgba(255, 255, 255, 0.6)"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Customization Panel */}
                  {expandedFlowerId === flower.id && (
                    <View style={styles.customizationPanel}>
                      {/* Color Picker */}
                      <View style={styles.customizationRow}>
                        <Text style={styles.customizationLabel}>Color</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.colorPickerScroll}
                        >
                          <View style={styles.colorPickerRow}>
                            {PresetColors.map((color) => (
                              <TouchableOpacity
                                key={color}
                                style={[
                                  styles.colorOption,
                                  { backgroundColor: color },
                                  flower.color === color && styles.colorOptionSelected,
                                ]}
                                onPress={() => handleColorChange(flower.id, color)}
                              />
                            ))}
                          </View>
                        </ScrollView>
                      </View>

                      {/* Size Stepper */}
                      <View style={styles.customizationRow}>
                        <Text style={styles.customizationLabel}>Size</Text>
                        <View style={styles.stepperContainer}>
                          <TouchableOpacity
                            style={styles.stepperButton}
                            onPress={() => handleSizeChange(flower.id, flower.size, -0.1)}
                          >
                            <Ionicons name="remove-circle" size={28} color="#FF5C8A" />
                          </TouchableOpacity>
                          <Text style={styles.stepperValue}>{flower.size.toFixed(1)}x</Text>
                          <TouchableOpacity
                            style={styles.stepperButton}
                            onPress={() => handleSizeChange(flower.id, flower.size, 0.1)}
                          >
                            <Ionicons name="add-circle" size={28} color="#FF5C8A" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Rotation Stepper */}
                      <View style={styles.customizationRow}>
                        <Text style={styles.customizationLabel}>Rotation</Text>
                        <View style={styles.stepperContainer}>
                          <TouchableOpacity
                            style={styles.stepperButton}
                            onPress={() => handleRotationChange(flower.id, flower.rotation || 0, -15)}
                          >
                            <Ionicons name="remove-circle" size={28} color="#FF5C8A" />
                          </TouchableOpacity>
                          <Text style={styles.stepperValue}>{flower.rotation || 0}°</Text>
                          <TouchableOpacity
                            style={styles.stepperButton}
                            onPress={() => handleRotationChange(flower.id, flower.rotation || 0, 15)}
                          >
                            <Ionicons name="add-circle" size={28} color="#FF5C8A" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Quantity Stepper */}
                      <View style={styles.customizationRow}>
                        <Text style={styles.customizationLabel}>Quantity</Text>
                        <View style={styles.stepperContainer}>
                          <TouchableOpacity
                            style={styles.stepperButton}
                            onPress={() => handleQuantityChange(flower.id, flower.quantity, -1)}
                          >
                            <Ionicons name="remove-circle" size={28} color="#FF5C8A" />
                          </TouchableOpacity>
                          <Text style={styles.stepperValue}>{flower.quantity}</Text>
                          <TouchableOpacity
                            style={styles.stepperButton}
                            onPress={() => handleQuantityChange(flower.id, flower.quantity, 1)}
                          >
                            <Ionicons name="add-circle" size={28} color="#FF5C8A" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No flowers yet. Scan a flower to get started!
              </Text>
            </View>
          )}
        </View>

        {/* Accessories Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.accessoriesHeader}
            onPress={() => setShowAccessories(!showAccessories)}
            activeOpacity={0.8}
          >
            <Text style={styles.sectionTitle}>Accessories</Text>
            <Ionicons
              name={showAccessories ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          {showAccessories && (
            <View style={styles.accessoriesContent}>
              {/* Ribbon Section */}
              <View style={styles.accessoryGroup}>
                <Text style={styles.accessoryTitle}>Ribbon</Text>

                <Text style={styles.accessorySubtitle}>Style</Text>
                <View style={styles.styleOptionsRow}>
                  {RIBBON_STYLES.map((style) => (
                    <TouchableOpacity
                      key={style}
                      style={[
                        styles.styleOption,
                        currentBouquet?.ribbon?.style === style && styles.styleOptionSelected,
                      ]}
                      onPress={() => handleRibbonStyleChange(style)}
                    >
                      <Text
                        style={[
                          styles.styleOptionText,
                          currentBouquet?.ribbon?.style === style && styles.styleOptionTextSelected,
                        ]}
                      >
                        {style}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.accessorySubtitle}>Color</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.colorPickerScroll}
                >
                  <View style={styles.colorPickerRow}>
                    {PresetColors.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorOption,
                          { backgroundColor: color },
                          currentBouquet?.ribbon?.color === color && styles.colorOptionSelected,
                        ]}
                        onPress={() => handleRibbonColorChange(color)}
                      />
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Wrapper Section */}
              <View style={styles.accessoryGroup}>
                <Text style={styles.accessoryTitle}>Wrapper</Text>

                <Text style={styles.accessorySubtitle}>Style</Text>
                <View style={styles.styleOptionsRow}>
                  {WRAPPER_STYLES.map((style) => (
                    <TouchableOpacity
                      key={style}
                      style={[
                        styles.styleOption,
                        currentBouquet?.wrapper?.style === style && styles.styleOptionSelected,
                      ]}
                      onPress={() => handleWrapperStyleChange(style)}
                    >
                      <Text
                        style={[
                          styles.styleOptionText,
                          currentBouquet?.wrapper?.style === style && styles.styleOptionTextSelected,
                        ]}
                      >
                        {style}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.accessorySubtitle}>Color</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.colorPickerScroll}
                >
                  <View style={styles.colorPickerRow}>
                    {PresetColors.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorOption,
                          { backgroundColor: color },
                          currentBouquet?.wrapper?.color === color && styles.colorOptionSelected,
                        ]}
                        onPress={() => handleWrapperColorChange(color)}
                      />
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleScanAnother}
          >
            <Text style={styles.secondaryButtonText}>Scan Another Flower</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.arPreviewButton}
            onPress={handleARPreview}
          >
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED']}
              style={styles.arPreviewButtonGradient}
            >
              <Ionicons name="cube-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.arPreviewButtonText}>Preview in AR</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSaveBouquet}
          >
            <LinearGradient
              colors={['#06D6A0', '#04AA7F']}
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>Save Bouquet</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.2,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  detectedFlowerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  flowerImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  flowerInfo: {
    gap: 12,
    marginBottom: 16,
  },
  flowerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flowerInfoLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  flowerInfoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  colorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  addButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  addButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  flowersGrid: {
    gap: 12,
  },
  flowerItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  flowerItemExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  flowerColorDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  flowerItemInfo: {
    flex: 1,
  },
  flowerItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  flowerItemSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  flowerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 92, 138, 0.15)',
    borderColor: 'rgba(255, 92, 138, 0.3)',
  },
  customizationPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 16,
  },
  customizationRow: {
    gap: 8,
  },
  customizationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  colorPickerScroll: {
    marginHorizontal: -4,
  },
  colorPickerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  colorOptionSelected: {
    borderColor: '#FFFFFF',
    borderWidth: 3,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepperButton: {
    padding: 4,
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 50,
    textAlign: 'center',
  },
  emptyState: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 22,
  },
  accessoriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accessoriesContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 20,
    gap: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  accessoryGroup: {
    gap: 12,
  },
  accessoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  accessorySubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  styleOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  styleOptionSelected: {
    backgroundColor: '#FF5C8A',
    borderColor: '#FF5C8A',
  },
  styleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  styleOptionTextSelected: {
    color: '#FFFFFF',
  },
  actionsSection: {
    gap: 12,
    marginTop: 8,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  arPreviewButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  arPreviewButtonGradient: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arPreviewButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#06D6A0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
