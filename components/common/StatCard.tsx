import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  color: [string, string];
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
  showTrend?: boolean;
  trendValue?: string;
  trendDirection?: 'up' | 'down';
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  color,
  onPress,
  size = 'medium',
  showTrend = false,
  trendValue,
  trendDirection = 'up',
}) => {
  const getCardWidth = () => {
    switch (size) {
      case 'small':
        return (width - 60) / 3;
      case 'large':
        return width - 32;
      default:
        return (width - 48) / 2;
    }
  };

  const getCardHeight = () => {
    switch (size) {
      case 'small':
        return 100;
      case 'large':
        return 140;
      default:
        return 120;
    }
  };

  const CardContent = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <MaterialCommunityIcons name={icon as any} size={22} color="#fff" />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={[styles.value, size === 'small' && styles.smallValue]}>{value}</Text>
      {showTrend && trendValue && (
        <View style={styles.trendContainer}>
          <MaterialCommunityIcons 
            name={trendDirection === 'up' ? 'trending-up' : 'trending-down'} 
            size={16} 
            color={trendDirection === 'up' ? '#3DF45B' : '#FF6B6B'} 
          />
          <Text style={[
            styles.trendText,
            { color: trendDirection === 'up' ? '#3DF45B' : '#FF6B6B' }
          ]}>
            {trendValue}
          </Text>
        </View>
      )}
    </View>
  );

  const cardStyle = [
    styles.card,
    {
      width: getCardWidth(),
      minHeight: getCardHeight(),
    },
  ];

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress}>
        <LinearGradient
          colors={color}
          style={cardStyle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <CardContent />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <LinearGradient
      colors={color}
      style={cardStyle}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <CardContent />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  value: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  smallValue: {
    fontSize: 18,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default StatCard;
