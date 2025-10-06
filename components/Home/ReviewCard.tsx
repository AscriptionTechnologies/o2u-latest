import { FontAwesome5 } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';

const ReviewCard = ({
  rating,
  text,
  userName,
  userRole,
}: {
  rating: number;
  text: string;
  userName: string;
  userRole: string;
}) => {
  return (
    <View style={styles.testimonialCard}>
      <View style={styles.ratingContainer}>
        {[...Array(rating)].map((s, index ) => (
          <FontAwesome5 key={index} name="star" size={18} color="#FFD700" solid />
        ))}
      </View>
      <Text style={styles.testimonialText}>{text}</Text>
      <View style={styles.userInfo}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar} />
        </View>
        <View>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userRole} numberOfLines={1}>{userRole}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  testimonialCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 12,
    width: 250,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  testimonialText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 15,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E5E5',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userRole: {
    fontSize: 14,
    color: '#666',
    width: 160,
    marginTop: 2,
  },
});

export default ReviewCard;
