import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  gradient?: boolean;
  gradientColors?: [string, string];
  backgroundColor?: string;
  padding?: number;
  margin?: number;
  borderRadius?: number;
  shadow?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  style,
  gradient = false,
  gradientColors = ['#1e5631', '#3a8456'],
  backgroundColor = 'rgba(24,28,32,0.95)',
  padding = 20,
  margin = 16,
  borderRadius = 24,
  shadow = true,
}) => {
  const cardStyle = [
    styles.card,
    {
      backgroundColor: gradient ? 'transparent' : backgroundColor,
      padding,
      margin,
      borderRadius,
      ...(shadow && styles.shadow),
    },
    style,
  ];

  if (gradient) {
    return (
      <LinearGradient
        colors={gradientColors}
        style={cardStyle}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {children}
      </LinearGradient>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
  },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
});

export default Card;
