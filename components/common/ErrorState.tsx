import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Button from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  iconName?: string;
  onRetry?: () => void;
  retryText?: string;
  showRetryButton?: boolean;
  fullScreen?: boolean;
  type?: 'error' | 'network' | 'notFound' | 'empty';
}

const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  iconName,
  onRetry,
  retryText = 'Try Again',
  showRetryButton = true,
  fullScreen = true,
  type = 'error',
}) => {
  const getDefaultContent = () => {
    switch (type) {
      case 'network':
        return {
          title: title || 'Connection Error',
          message: message || 'Please check your internet connection and try again.',
          icon: iconName || 'wifi-off',
        };
      case 'notFound':
        return {
          title: title || 'Not Found',
          message: message || 'The content you are looking for could not be found.',
          icon: iconName || 'file-search-outline',
        };
      case 'empty':
        return {
          title: title || 'No Data',
          message: message || 'There is no data to display at the moment.',
          icon: iconName || 'inbox-outline',
        };
      default:
        return {
          title: title || 'Something went wrong',
          message: message || 'An unexpected error occurred. Please try again.',
          icon: iconName || 'alert-circle-outline',
        };
    }
  };

  const content = getDefaultContent();
  const containerStyle = fullScreen ? styles.fullScreenContainer : styles.inlineContainer;

  const ErrorContent = () => (
    <View style={styles.content}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons 
          name={content.icon as any} 
          size={64} 
          color={type === 'error' ? '#FF6B6B' : type === 'network' ? '#FFD600' : '#B0B6BE'} 
        />
      </View>
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.message}>{content.message}</Text>
      {showRetryButton && onRetry && (
        <Button
          title={retryText}
          onPress={onRetry}
          variant="primary"
          size="medium"
          icon="refresh"
          style={styles.retryButton}
        />
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <LinearGradient colors={['#181C20', '#000']} style={containerStyle}>
        <ErrorContent />
      </LinearGradient>
    );
  }

  return (
    <View style={containerStyle}>
      <ErrorContent />
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
    maxWidth: 300,
  },
  iconContainer: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    color: '#B0B6BE',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  retryButton: {
    minWidth: 140,
  },
});

export default ErrorState;
