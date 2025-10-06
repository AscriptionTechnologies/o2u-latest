import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  showNotifications?: boolean;
  showMenu?: boolean;
  rightActions?: React.ReactNode;
  onBackPress?: () => void;
  backgroundColor?: string;
}

const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBackButton = false,
  showNotifications = false,
  showMenu = false,
  rightActions,
  onBackPress,
  backgroundColor = '#101418',
}) => {
  const navigation = useNavigation();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.header, { backgroundColor }]}>
      {showBackButton && (
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#3DF45B" />
        </TouchableOpacity>
      )}
      
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      <View style={styles.rightActions}>
        {showNotifications && (
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => navigation.navigate('Notifications' as never)}
          >
            <Ionicons name="notifications" size={24} color="#3DF45B" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        )}
        
        {showMenu && (
          <TouchableOpacity style={styles.iconButton}>
            <MaterialCommunityIcons name="menu" size={24} color="#3DF45B" />
          </TouchableOpacity>
        )}
        
        {rightActions}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'red',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#B0B6BE',
    fontSize: 14,
    marginTop: 2,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 12,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3DF45B',
    borderWidth: 2,
    borderColor: '#101418',
  },
});

export default Header;
