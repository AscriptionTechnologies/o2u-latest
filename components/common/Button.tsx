import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  gradient?: boolean;
  gradientColors?: [string, string];
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  gradient = false,
  gradientColors = ['#3DF45B', '#2BC946'],
}) => {
  const getButtonStyle = () => {
    const baseStyle = [styles.button, styles[size]];
    
    switch (variant) {
      case 'primary':
        return [...baseStyle, styles.primary];
      case 'secondary':
        return [...baseStyle, styles.secondary];
      case 'outline':
        return [...baseStyle, styles.outline];
      case 'ghost':
        return [...baseStyle, styles.ghost];
      default:
        return [...baseStyle, styles.primary];
    }
  };

  const getTextStyle = () => {
    const baseStyle = [styles.text, styles[`${size}Text`]];
    
    switch (variant) {
      case 'primary':
        return [...baseStyle, styles.primaryText];
      case 'secondary':
        return [...baseStyle, styles.secondaryText];
      case 'outline':
        return [...baseStyle, styles.outlineText];
      case 'ghost':
        return [...baseStyle, styles.ghostText];
      default:
        return [...baseStyle, styles.primaryText];
    }
  };

  const buttonStyle = [
    ...getButtonStyle(),
    disabled && styles.disabled,
    style,
  ];

  const finalTextStyle = [
    ...getTextStyle(),
    disabled && styles.disabledText,
    textStyle,
  ];

  const renderContent = () => (
    <>
      {loading && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
      {icon && iconPosition === 'left' && (
        <MaterialCommunityIcons 
          name={icon as any} 
          size={size === 'small' ? 16 : size === 'large' ? 24 : 20} 
          color={variant === 'primary' ? '#000' : '#3DF45B'} 
          style={{ marginRight: 8 }} 
        />
      )}
      <Text style={finalTextStyle}>{title}</Text>
      {icon && iconPosition === 'right' && (
        <MaterialCommunityIcons 
          name={icon as any} 
          size={size === 'small' ? 16 : size === 'large' ? 24 : 20} 
          color={variant === 'primary' ? '#000' : '#3DF45B'} 
          style={{ marginLeft: 8 }} 
        />
      )}
    </>
  );

  if (gradient && variant === 'primary') {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled || loading}>
        <LinearGradient
          colors={gradientColors}
          style={buttonStyle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {renderContent()}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={buttonStyle} onPress={onPress} disabled={disabled || loading}>
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  // Sizes
  small: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
  },
  medium: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 48,
  },
  large: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    minHeight: 56,
  },
  // Variants
  primary: {
    backgroundColor: '#3DF45B',
  },
  secondary: {
    backgroundColor: 'rgba(61, 244, 91, 0.1)',
    borderWidth: 1,
    borderColor: '#3DF45B',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3DF45B',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  // Text styles
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  primaryText: {
    color: '#000',
  },
  secondaryText: {
    color: '#3DF45B',
  },
  outlineText: {
    color: '#3DF45B',
  },
  ghostText: {
    color: '#3DF45B',
  },
  disabledText: {
    opacity: 0.7,
  },
});

export default Button;
