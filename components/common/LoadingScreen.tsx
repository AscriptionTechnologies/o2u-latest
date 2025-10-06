import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface LoadingScreenProps {
  message?: string;
  showIcon?: boolean;
  iconName?: string;
  fullScreen?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading...',
  showIcon = true,
  iconName = 'truck-fast',
  fullScreen = true,
}) => {
  const containerStyle = fullScreen ? styles.fullScreenContainer : styles.inlineContainer;

  const LoadingContent = () => (
    <View style={styles.content}>
      {showIcon && (
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name={iconName as any} size={48} color="#3DF45B" />
          <View style={styles.iconGlow} />
        </View>
      )}
      <ActivityIndicator size="large" color="#3DF45B" style={styles.spinner} />
      <Text style={styles.message}>{message}</Text>
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dot1]} />
        <View style={[styles.dot, styles.dot2]} />
        <View style={[styles.dot, styles.dot3]} />
      </View>
    </View>
  );

  if (fullScreen) {
    return (
      <LinearGradient colors={['#181C20', '#000']} style={containerStyle}>
        <LoadingContent />
      </LinearGradient>
    );
  }

  return (
    <View style={containerStyle}>
      <LoadingContent />
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(24,28,32,0.95)',
    borderRadius: 24,
    margin: 16,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  iconGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#3DF45B',
    borderRadius: 24,
    opacity: 0.2,
    transform: [{ scale: 1.5 }],
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3DF45B',
    marginHorizontal: 4,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
});

export default LoadingScreen;
