import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useBouquetStore } from '@/store/bouquetStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useEffect, useRef } from 'react';
import { BackgroundGradient } from '@/components/BackgroundGradient';
import { AnimatedCard } from '@/components/AnimatedCard';

interface FeatureCardProps {
  title: string;
  description: string;
  color: string;
  index: number;
}

function FeatureCard({ title, description, color, index }: FeatureCardProps) {
  return (
    <AnimatedCard color={color} index={index}>
      <View style={styles.featureHeader}>
        <View style={[styles.featureIconContainer, { backgroundColor: color + '20' }]}>
          <View style={[styles.featureIconDot, { backgroundColor: color }]} />
        </View>
        <Text style={styles.featureTitle}>{title}</Text>
      </View>
      <Text style={styles.featureDescription}>{description}</Text>
    </AnimatedCard>
  );
}

function AnimatedFlower() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const containerStyle = {
    transform: [{ scale }],
    opacity,
  };

  return (
    <Animated.View style={[styles.flowerContainer, containerStyle]}>
      <View style={styles.petal1}>
        <LinearGradient
          colors={['#FF5C8A', '#FF8FA3']}
          style={styles.simplePetal}
        />
      </View>
      <View style={styles.petal2}>
        <LinearGradient
          colors={['#FF5C8A', '#FF8FA3']}
          style={styles.simplePetal}
        />
      </View>
      <View style={styles.petal3}>
        <LinearGradient
          colors={['#FF5C8A', '#FF8FA3']}
          style={styles.simplePetal}
        />
      </View>
      <View style={styles.petal4}>
        <LinearGradient
          colors={['#FF5C8A', '#FF8FA3']}
          style={styles.simplePetal}
        />
      </View>
      <View style={styles.petal5}>
        <LinearGradient
          colors={['#FF5C8A', '#FF8FA3']}
          style={styles.simplePetal}
        />
      </View>
      <View style={styles.petal6}>
        <LinearGradient
          colors={['#FF5C8A', '#FF8FA3']}
          style={styles.simplePetal}
        />
      </View>
      <View style={styles.flowerCenter}>
        <LinearGradient
          colors={['#FFFFFF', '#FFE5F1']}
          style={styles.centerGradient}
        />
      </View>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { resetCurrentBouquet } = useBouquetStore();

  const handleNavigateToCategory = () => {
    resetCurrentBouquet();
    router.push('/category');
  };

  const features = [
    {
      title: 'Real Flower Detection',
      description: 'Scan real flowers with your camera to extract colors and shapes',
      color: Colors.primary,
    },
    {
      title: 'Full Customization',
      description: 'Add, remove, resize, and customize every element of your bouquet',
      color: Colors.secondary,
    },
    {
      title: 'AR Visualization',
      description: 'Preview your bouquet in augmented reality with real-time adjustments',
      color: Colors.accent,
    },
    {
      title: 'Save & Export',
      description: 'Save your designs and export high-quality images',
      color: Colors.info,
    },
  ];

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(headerSlide, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const backgroundCircles = [
    { size: 300, color: 'rgba(255, 92, 138, 0.1)', top: -100, right: -100 },
    { size: 200, color: 'rgba(255, 209, 102, 0.08)', bottom: 100, left: -50 },
    { size: 150, color: 'rgba(6, 214, 160, 0.1)', top: '40%', right: -30 },
  ];

  return (
    <BackgroundGradient circles={backgroundCircles}>

        <View style={styles.content}>
          <Animated.View
            style={[
              styles.header,
              {
                opacity: headerFade,
                transform: [{ translateY: headerSlide }],
              },
            ]}
          >
            <View style={styles.logoContainer}>
              <AnimatedFlower />
            </View>
            <Text style={styles.title}>BloomAR</Text>
            <Text style={styles.subtitle}>
              Craft stunning bouquets with augmented reality
            </Text>
          </Animated.View>

          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleNavigateToCategory}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#FF5C8A', '#FF8FA3']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.primaryButtonText}>Create New Bouquet</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.featuresSection}>
            <Text style={styles.sectionTitle}>Capabilities</Text>
            <View style={styles.featuresGrid}>
              {features.map((feature, index) => (
                <FeatureCard
                  key={index}
                  title={feature.title}
                  description={feature.description}
                  color={feature.color}
                  index={index}
                />
              ))}
            </View>
          </View>
        </View>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    maxHeight: 260,
  },
  logoContainer: {
    marginBottom: 24,
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flowerContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  simplePetal: {
    width: 28,
    height: 40,
    borderRadius: 14,
  },
  petal1: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -14,
    transform: [{ rotate: '0deg' }],
  },
  petal2: {
    position: 'absolute',
    top: 8,
    right: 8,
    transform: [{ rotate: '60deg' }],
  },
  petal3: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    transform: [{ rotate: '120deg' }],
  },
  petal4: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    marginLeft: -14,
    transform: [{ rotate: '180deg' }],
  },
  petal5: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    transform: [{ rotate: '240deg' }],
  },
  petal6: {
    position: 'absolute',
    top: 8,
    left: 8,
    transform: [{ rotate: '300deg' }],
  },
  flowerCenter: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 10,
    shadowColor: '#FF5C8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  centerGradient: {
    flex: 1,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.5,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
    paddingHorizontal: 30,
    letterSpacing: 0.2,
  },
  actionSection: {
    marginBottom: 24,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF5C8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  featuresSection: {
    flex: 1,
    justifyContent: 'flex-end',
    minHeight: 180,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  featuresGrid: {
    gap: 12,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureIconDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    flex: 1,
  },
  featureDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 18,
    letterSpacing: 0.1,
  },
});

