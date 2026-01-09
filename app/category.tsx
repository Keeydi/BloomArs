import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useBouquetStore } from '@/store/bouquetStore';
import { BouquetCategory } from '@/types';
import { BackgroundGradient } from '@/components/BackgroundGradient';
import { AnimatedCard } from '@/components/AnimatedCard';

const categories: BouquetCategory[] = ['Wedding', 'Birthday', 'Anniversary', 'Valentines'];

const categoryColors: Record<BouquetCategory, string> = {
  Wedding: '#FF5C8A',
  Birthday: '#FFD166',
  Anniversary: '#118AB2',
  Valentines: '#EF476F',
};

interface CategoryIconProps {
  category: BouquetCategory;
  color: string;
}

function CategoryIcon({ category, color }: CategoryIconProps) {
  if (category === 'Wedding') {
    return (
      <View style={styles.iconContainer}>
        <View style={[styles.ring1, { borderColor: color }]}>
          <View style={[styles.ringGem, { backgroundColor: color + '40' }]} />
        </View>
        <View style={[styles.ring2, styles.ring2Overlap, { borderColor: color }]}>
          <View style={[styles.ringGem, { backgroundColor: color + '40' }]} />
        </View>
        <View style={[styles.ringBand1, { backgroundColor: color }]} />
        <View style={[styles.ringBand2, { backgroundColor: color }]} />
      </View>
    );
  }

  if (category === 'Birthday') {
    return (
      <View style={styles.iconContainer}>
        <View style={[styles.cakeBase, { backgroundColor: color }]} />
        <View style={[styles.cakeTop, { backgroundColor: color + 'CC' }]} />
        <View style={[styles.candle, { backgroundColor: '#FFFFFF' }]}>
          <View style={[styles.flame, { backgroundColor: '#FFD166' }]} />
        </View>
      </View>
    );
  }

  if (category === 'Anniversary') {
    return (
      <View style={styles.iconContainer}>
        <View style={styles.heartContainer}>
          <View style={[styles.heartLeft, { backgroundColor: color }]} />
          <View style={[styles.heartRight, { backgroundColor: color }]} />
          <View style={[styles.heartBottom, { backgroundColor: color }]} />
        </View>
        <View style={[styles.heartOutline, { borderColor: color }]} />
      </View>
    );
  }

  if (category === 'Valentines') {
    return (
      <View style={styles.iconContainer}>
        <View style={[styles.roseStem, { backgroundColor: '#06D6A0' }]} />
        <View style={[styles.roseLeaf, { backgroundColor: '#06D6A0' }]} />
        <View style={[styles.roseCenter, { backgroundColor: color }]} />
        <View style={[styles.rosePetal1, { backgroundColor: color }]} />
        <View style={[styles.rosePetal2, { backgroundColor: color }]} />
        <View style={[styles.rosePetal3, { backgroundColor: color }]} />
        <View style={[styles.rosePetal4, { backgroundColor: color }]} />
        <View style={[styles.rosePetal5, { backgroundColor: color }]} />
      </View>
    );
  }

  return null;
}

interface CategoryCardProps {
  category: BouquetCategory;
  color: string;
  index: number;
  onPress: () => void;
}

function CategoryCard({ category, color, index, onPress }: CategoryCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <AnimatedCard color={color} index={index} padding={24} style={styles.categoryCard}>
        <View style={styles.cardContent}>
          <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
            <CategoryIcon category={category} color={color} />
          </View>
          <Text style={styles.categoryName}>{category}</Text>
          <View style={[styles.accentLine, { backgroundColor: color }]} />
        </View>
      </AnimatedCard>
    </TouchableOpacity>
  );
}

export default function CategoryScreen() {
  const router = useRouter();
  const { setSelectedCategory, createBouquet, selectedCategory } = useBouquetStore();

  const handleSelectCategory = (category: BouquetCategory) => {
    setSelectedCategory(category);
    createBouquet(category);
    // Navigate to camera screen to capture flower
    router.push({
      pathname: '/camera',
      params: { category },
    });
  };

  const backgroundCircles = [
    { size: 250, color: 'rgba(255, 92, 138, 0.08)', top: -80, right: -80 },
    { size: 200, color: 'rgba(255, 209, 102, 0.06)', bottom: 150, left: -60 },
  ];

  return (
    <BackgroundGradient circles={backgroundCircles}>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Select Category</Text>
            <Text style={styles.subtitle}>
              Choose the occasion for your bouquet
            </Text>
          </View>

          <View style={styles.categoriesContainer}>
            {categories.map((category, index) => (
              <CategoryCard
                key={category}
                category={category}
                color={categoryColors[category]}
                index={index}
                onPress={() => handleSelectCategory(category)}
              />
            ))}
          </View>
        </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 22,
  },
  categoriesContainer: {
    gap: 16,
  },
  categoryCard: {
    marginBottom: 0,
  },
  cardContent: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  ring1: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 4,
    position: 'absolute',
    left: 8,
    top: 12,
  },
  ring2: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 4,
    position: 'absolute',
  },
  ring2Overlap: {
    right: 8,
    top: 12,
  },
  ringGem: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 10,
    left: 10,
  },
  ringBand1: {
    width: 28,
    height: 3,
    position: 'absolute',
    top: 28,
    left: 6,
    borderRadius: 2,
  },
  ringBand2: {
    width: 28,
    height: 3,
    position: 'absolute',
    top: 28,
    right: 6,
    borderRadius: 2,
  },
  cakeBase: {
    width: 40,
    height: 20,
    borderRadius: 4,
    position: 'absolute',
    bottom: 0,
  },
  cakeTop: {
    width: 32,
    height: 16,
    borderRadius: 4,
    position: 'absolute',
    bottom: 20,
    left: 4,
  },
  candle: {
    width: 4,
    height: 16,
    borderRadius: 2,
    position: 'absolute',
    bottom: 36,
    left: 18,
  },
  flame: {
    width: 6,
    height: 8,
    borderRadius: 3,
    position: 'absolute',
    bottom: 52,
    left: 17,
  },
  heartContainer: {
    width: 44,
    height: 40,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartLeft: {
    width: 22,
    height: 22,
    borderRadius: 11,
    position: 'absolute',
    left: 2,
    top: 0,
    transform: [{ rotate: '-45deg' }],
  },
  heartRight: {
    width: 22,
    height: 22,
    borderRadius: 11,
    position: 'absolute',
    right: 2,
    top: 0,
    transform: [{ rotate: '45deg' }],
  },
  heartBottom: {
    width: 22,
    height: 22,
    borderRadius: 11,
    position: 'absolute',
    bottom: -2,
    left: 11,
    transform: [{ rotate: '45deg' }],
  },
  heartOutline: {
    width: 40,
    height: 36,
    borderRadius: 20,
    borderWidth: 3,
    position: 'absolute',
    top: 0,
    left: 2,
  },
  roseStem: {
    width: 4,
    height: 24,
    position: 'absolute',
    bottom: 0,
    left: 28,
    borderRadius: 2,
  },
  roseLeaf: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    bottom: 8,
    left: 20,
    transform: [{ rotate: '-30deg' }],
  },
  roseCenter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    bottom: 24,
    left: 23,
    zIndex: 5,
  },
  rosePetal1: {
    width: 18,
    height: 18,
    borderRadius: 9,
    position: 'absolute',
    bottom: 22,
    left: 18,
    zIndex: 1,
  },
  rosePetal2: {
    width: 18,
    height: 18,
    borderRadius: 9,
    position: 'absolute',
    bottom: 22,
    right: 18,
    zIndex: 1,
  },
  rosePetal3: {
    width: 18,
    height: 18,
    borderRadius: 9,
    position: 'absolute',
    bottom: 26,
    left: 21,
    zIndex: 2,
  },
  rosePetal4: {
    width: 18,
    height: 18,
    borderRadius: 9,
    position: 'absolute',
    bottom: 26,
    right: 21,
    zIndex: 2,
  },
  rosePetal5: {
    width: 16,
    height: 16,
    borderRadius: 8,
    position: 'absolute',
    bottom: 30,
    left: 22,
    zIndex: 3,
  },
  categoryName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  accentLine: {
    width: 60,
    height: 3,
    borderRadius: 2,
  },
});

