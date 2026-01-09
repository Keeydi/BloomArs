import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { GRADIENT_COLORS } from './SharedStyles';

interface BackgroundGradientProps {
  children: ReactNode;
  circles?: Array<{ size: number; color: string; top?: number | string; right?: number | string; bottom?: number | string; left?: number | string }>;
}

export function BackgroundGradient({ children, circles = [] }: BackgroundGradientProps) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={GRADIENT_COLORS}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {circles.map((circle, index) => (
          <View
            key={index}
            style={[
              styles.circle,
              {
                width: circle.size,
                height: circle.size,
                borderRadius: circle.size / 2,
                backgroundColor: circle.color,
                top: circle.top,
                right: circle.right,
                bottom: circle.bottom,
                left: circle.left,
              },
            ]}
          />
        ))}
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    position: 'relative',
  },
  circle: {
    position: 'absolute',
  },
});

