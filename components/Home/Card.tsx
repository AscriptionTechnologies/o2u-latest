import { MaterialIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

function Card({ icon = 'payments', title, description }: { icon: string; title: string; description: string }) {
  return (
    <Pressable style={({ pressed }) => [
      styles.card,
      pressed && styles.cardPressed
    ]}>
      <LinearGradient
        colors={['#FFFFFF', '#FFF8F9']}
        style={styles.cardGradient}
      >
        <View style={styles.row}>
          <View style={styles.contentContainer}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardDescription} numberOfLines={3}>{description}</Text>
          </View>
          <View style={styles.iconContainer}>
            <MaterialIcons name={icon} size={24} color="#FF385C" />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 280,
    marginRight: 16,
    borderRadius: 16,
    shadowColor: '#FF385C',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  cardGradient: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 56, 92, 0.1)',
  },
  contentContainer: {
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 56, 92, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    lineHeight: 24,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontWeight: '400',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
});

export default Card;
