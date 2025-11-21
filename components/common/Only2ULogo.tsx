import React from 'react';
import { Text, StyleSheet, ViewStyle, TextStyle, Platform } from 'react-native';

interface Only2ULogoProps {
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const Only2ULogo: React.FC<Only2ULogoProps> = ({ 
  size = 'medium', 
  style,
  textStyle 
}) => {
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { fontSize: 16, letterSpacing: -0.3 };
      case 'medium':
        return { fontSize: 24, letterSpacing: -0.4 };
      case 'large':
        return { fontSize: 32, letterSpacing: -0.5 };
      case 'xlarge':
        return { fontSize: 40, letterSpacing: -0.6 };
      default:
        return { fontSize: 24, letterSpacing: -0.4 };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <Text style={[styles.logo, sizeStyles, textStyle, style]}>
      <Text style={[styles.textOnly, sizeStyles]}>Only</Text>
      <Text style={[styles.number2, sizeStyles]}>2</Text>
      <Text style={[styles.textU, sizeStyles]}>U</Text>
    </Text>
  );
};

const styles = StyleSheet.create({
  logo: {
    fontFamily: 'Riccione-Serial-Bold',
    fontWeight: 'normal', // Custom font handles the weight
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  textOnly: {
    color: '#1a1a1a', // Black
    fontFamily: 'Riccione-Serial-Bold',
    fontWeight: 'normal',
  },
  number2: {
    color: '#F53F7A', // Pink
    fontFamily: 'Riccione-Serial-Bold',
    fontWeight: 'normal',
    textShadowColor: 'rgba(245, 63, 122, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  textU: {
    color: '#1a1a1a', // Black
    fontFamily: 'Riccione-Serial-Bold',
    fontWeight: 'normal',
  },
});

export default Only2ULogo;
