import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/useAuth';
import { Header } from '../common';

// Mock reviews data
const mockReviews = [
  {
    id: '1',
    rating: 5,
    comment: 'Excellent driver! Very professional and on time. The truck was clean and well-maintained.',
    date: '2024-01-15',
    client: 'ABC Logistics',
    route: 'New York to Boston',
  },
  {
    id: '2',
    rating: 4,
    comment: 'Good service overall. Driver was courteous and delivered on schedule.',
    date: '2024-01-10',
    client: 'XYZ Shipping',
    route: 'Chicago to Detroit',
  },
  {
    id: '3',
    rating: 5,
    comment: 'Outstanding performance! Cargo was handled with care and delivered safely.',
    date: '2024-01-05',
    client: 'Global Transport',
    route: 'Los Angeles to Phoenix',
  },
  {
    id: '4',
    rating: 4,
    comment: 'Reliable driver with good communication throughout the journey.',
    date: '2023-12-28',
    client: 'Fast Freight',
    route: 'Miami to Orlando',
  },
];

const Reviews = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [reviews, setReviews] = useState(mockReviews);

  const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  const totalReviews = reviews.length;

  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: reviews.filter(review => review.rating === rating).length,
    percentage: (reviews.filter(review => review.rating === rating).length / totalReviews) * 100,
  }));

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Ionicons
        key={index}
        name={index < rating ? 'star' : 'star-outline'}
        size={16}
        color={index < rating ? '#FFD700' : '#B0B6BE'}
      />
    ));
  };

  const renderReview = ({ item }: { item: typeof mockReviews[0] }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewStars}>
          {renderStars(item.rating)}
        </View>
        <Text style={styles.reviewDate}>{new Date(item.date).toLocaleDateString()}</Text>
      </View>
      <Text style={styles.reviewComment}>{item.comment}</Text>
      <View style={styles.reviewFooter}>
        <Text style={styles.reviewClient}>{item.client}</Text>
        <Text style={styles.reviewRoute}>{item.route}</Text>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={['#181C20', '#000']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Header
          title="Reviews & Ratings"
          subtitle="Your performance feedback"
          showBackButton={true}
        />

        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {/* Rating Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.ratingOverview}>
              <Text style={styles.averageRating}>{averageRating.toFixed(1)}</Text>
              <View style={styles.starsContainer}>
                {renderStars(Math.round(averageRating))}
              </View>
              <Text style={styles.totalReviews}>{totalReviews} reviews</Text>
            </View>

            <View style={styles.ratingDistribution}>
              {ratingDistribution.map((item) => (
                <View key={item.rating} style={styles.distributionRow}>
                  <Text style={styles.ratingNumber}>{item.rating}</Text>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <View style={styles.progressBar}>
                    <View 
                      style={[styles.progressFill, { width: `${item.percentage}%` }]} 
                    />
                  </View>
                  <Text style={styles.ratingCount}>{item.count}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Reviews List */}
          <View style={styles.reviewsSection}>
            <Text style={styles.sectionTitle}>Recent Reviews</Text>
            <FlatList
              data={reviews}
              renderItem={renderReview}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: 'rgba(24,28,32,0.95)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  ratingOverview: {
    alignItems: 'center',
    marginBottom: 24,
  },
  averageRating: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  totalReviews: {
    color: '#B0B6BE',
    fontSize: 16,
  },
  ratingDistribution: {
    width: '100%',
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingNumber: {
    color: '#fff',
    fontSize: 14,
    width: 20,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3DF45B',
    borderRadius: 4,
  },
  ratingCount: {
    color: '#B0B6BE',
    fontSize: 14,
    width: 30,
    textAlign: 'right',
  },
  reviewsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  reviewCard: {
    backgroundColor: 'rgba(24,28,32,0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewStars: {
    flexDirection: 'row',
  },
  reviewDate: {
    color: '#B0B6BE',
    fontSize: 14,
  },
  reviewComment: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  reviewFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 12,
  },
  reviewClient: {
    color: '#3DF45B',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  reviewRoute: {
    color: '#B0B6BE',
    fontSize: 14,
  },
});

export default Reviews;
