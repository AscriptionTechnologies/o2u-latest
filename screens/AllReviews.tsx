import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Modal,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import * as VideoThumbnails from 'expo-video-thumbnails';

const { width } = Dimensions.get('window');

const AllReviews = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { productName, averageRating, totalReviews, reviews } = route.params as any;

  const [showReviewMediaViewer, setShowReviewMediaViewer] = useState(false);
  const [reviewMediaIndex, setReviewMediaIndex] = useState(0);
  const [reviewMediaItems, setReviewMediaItems] = useState<Array<{type: 'image' | 'video', url: string}>>([]);
  // Track failed video thumbnail loads to use a fallback image instead of a gray box
  const [failedVideoThumbs, setFailedVideoThumbs] = useState<{ [url: string]: boolean }>({});
  const [videoThumbnails, setVideoThumbnails] = useState<{ [url: string]: string }>({});

  // Generate thumbnails for review videos (first frame)
  React.useEffect(() => {
    const allVideos: string[] = (reviews || []).flatMap((r: any) => r.review_videos || []);
    if (!allVideos.length) return;

    const generateThumbnails = async () => {
      console.log('[AllReviews] Generating thumbnails for', allVideos.length, 'videos');
      
      for (const videoUrl of allVideos) {
        // Skip if already generated
        if (videoThumbnails[videoUrl]) {
          console.log('[AllReviews] Thumbnail already exists for:', videoUrl);
          continue;
        }

        try {
          console.log('[AllReviews] Generating thumbnail for:', videoUrl);
          const { uri } = await VideoThumbnails.getThumbnailAsync(videoUrl, {
            time: 0,
            quality: 0.8,
          });
          console.log('[AllReviews] Thumbnail generated:', uri);
          
          setVideoThumbnails(prev => ({
            ...prev,
            [videoUrl]: uri
          }));
        } catch (error) {
          console.error('[AllReviews] Failed to generate thumbnail for:', videoUrl, error);
          // Set a placeholder on failure - using a simple gray background
          setVideoThumbnails(prev => ({
            ...prev,
            [videoUrl]: 'https://placehold.co/400x400?text=Video'
          }));
        }
      }
    };

    generateThumbnails();
  }, [reviews]);
  
  // Review interaction state
  const [helpfulVotes, setHelpfulVotes] = useState<{ [reviewId: string]: boolean }>({});
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);

  const getRatingText = (rating: number) => {
    if (rating >= 5) return 'Very Good';
    if (rating >= 4) return 'Good';
    if (rating >= 3) return 'Ok-Ok';
    if (rating >= 2) return 'Bad';
    return 'Very Bad';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Posted 1 day ago';
    if (diffDays < 7) return `Posted ${diffDays} days ago`;
    return `Posted on ${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  };

  // Review interaction handlers
  const handleHelpfulVote = async (reviewId: string) => {
    try {
      const isCurrentlyHelpful = helpfulVotes[reviewId];
      const newHelpfulState = !isCurrentlyHelpful;
      
      // Update local state
      setHelpfulVotes(prev => ({
        ...prev,
        [reviewId]: newHelpfulState
      }));

      // In a real app, you would make an API call here to save the vote
      // await supabase.from('review_helpful_votes').upsert({
      //   review_id: reviewId,
      //   user_id: userData?.id,
      //   is_helpful: newHelpfulState
      // });

      // Show feedback (you can replace with your toast system)
      console.log(newHelpfulState ? 'Marked as helpful!' : 'Removed helpful vote');
    } catch (error) {
      console.error('Error voting on review:', error);
    }
  };

  const handleShareReview = async (review: any) => {
    try {
      const shareMessage = `Check out this review by ${review.reviewer_name || 'Only2U User'}:\n\n"${review.comment}"\n\nRating: ${review.rating}/5 stars`;
      
      await Share.share({
        message: shareMessage,
        title: 'Product Review',
      });
    } catch (error) {
      console.error('Error sharing review:', error);
    }
  };

  const handleReportReview = (reviewId: string) => {
    setReportingReviewId(reviewId);
    setShowReportModal(true);
  };

  const confirmReportReview = async () => {
    if (!reportingReviewId) return;

    try {
      // In a real app, you would make an API call here to report the review
      // await supabase.from('review_reports').insert({
      //   review_id: reportingReviewId,
      //   user_id: userData?.id,
      //   reason: 'Inappropriate content',
      //   reported_at: new Date().toISOString()
      // });

      console.log('Review reported successfully');
      setShowReportModal(false);
      setReportingReviewId(null);
    } catch (error) {
      console.error('Error reporting review:', error);
    }
  };

  // Calculate rating breakdown
  const calculateRatingBreakdown = () => {
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    
    reviews.forEach(review => {
      breakdown[review.rating as keyof typeof breakdown]++;
    });
    
    return breakdown;
  };

  // Render rating breakdown
  const renderRatingBreakdown = () => {
    const breakdown = calculateRatingBreakdown();
    
    return (
      <View style={styles.ratingBreakdownContainer}>
        {[5, 4, 3, 2, 1].map(rating => {
          const count = breakdown[rating as keyof typeof breakdown];
          const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
          
          return (
            <View key={rating} style={styles.ratingBreakdownRow}>
              <Text style={styles.ratingBreakdownNumber}>{rating}</Text>
              <Ionicons name="star" size={14} color="#fcc026" style={{ marginLeft: 4 }} />
              <View style={styles.ratingBreakdownBarContainer}>
                <View 
                  style={[
                    styles.ratingBreakdownBar,
                    { 
                      width: `${percentage}%`,
                      backgroundColor: '#FF9500'
                    }
                  ]} 
                />
              </View>
              <Text style={styles.ratingBreakdownCount}>{count}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderReview = (review: any) => {
    return (
      <View key={review.id} style={styles.reviewCard}>
        {/* Reviewer Info with Profile Photo */}
        <View style={styles.reviewerInfoContainer}>
          {/* Profile Photo */}
          <View style={styles.reviewerPhotoContainer}>
            {review.profile_image_url ? (
              <Image
                source={{ uri: review.profile_image_url }}
                style={styles.reviewerPhoto}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.reviewerPhotoPlaceholder}>
                <Ionicons name="person" size={24} color="#999" />
              </View>
            )}
          </View>

          {/* Reviewer Details */}
          <View style={styles.reviewerInfo}>
            <Text style={styles.reviewerName}>
              {review.reviewer_name || 'Only2U User'}
            </Text>
            <View style={styles.reviewRatingContainer}>
              <View style={styles.reviewStarsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= review.rating ? "star" : "star-outline"}
                    size={16}
                    color="#FF9500"
                  />
                ))}
              </View>
              <Text style={styles.verifiedPurchase}>Verified Purchase</Text>
            </View>
          </View>
        </View>

        {/* Review Title */}
        <Text style={styles.reviewTitle}>
          {review.comment && review.comment.length > 50 
            ? review.comment.substring(0, 50) + '...' 
            : review.comment || 'Great product!'}
        </Text>

        {/* Review Metadata */}
        <Text style={styles.reviewMetadata}>
          Reviewed in India on {formatDate(review.created_at)}
        </Text>

        {/* Review Text */}
        {review.comment && review.comment.length > 50 && (
          <View style={styles.reviewTextContainer}>
            <Text style={styles.reviewText} numberOfLines={3}>
              {review.comment}
            </Text>
            <TouchableOpacity>
              <Text style={styles.seeMoreText}>See more</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Helpfulness Indicator */}
        <Text style={styles.helpfulText}>
          {Math.floor(Math.random() * 20) + 1} people found this helpful
        </Text>

        {/* Review Actions */}
        <View style={styles.reviewActions}>
          <TouchableOpacity 
            style={[
              styles.helpfulButton,
              helpfulVotes[review.id] && styles.helpfulButtonActive
            ]}
            onPress={() => handleHelpfulVote(review.id)}
          >
            <Ionicons 
              name={helpfulVotes[review.id] ? "thumbs-up" : "thumbs-up-outline"} 
              size={16} 
              color={helpfulVotes[review.id] ? "#007AFF" : "#333"} 
            />
            <Text style={[
              styles.helpfulButtonText,
              helpfulVotes[review.id] && styles.helpfulButtonTextActive
            ]}>
              Helpful
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.shareButton}
            onPress={() => handleShareReview(review)}
          >
            <Ionicons name="share-outline" size={16} color="#333" />
            <Text style={styles.shareButtonText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.reportButton}
            onPress={() => handleReportReview(review.id)}
          >
            <Text style={styles.reportButtonText}>Report</Text>
          </TouchableOpacity>
        </View>

        {/* Review Images and Videos */}
        {((review.review_images && review.review_images.length > 0) || (review.review_videos && review.review_videos.length > 0)) && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.reviewMediaScrollContainer}
            contentContainerStyle={styles.reviewImagesContainer}
          >
            {/* Display Images */}
            {review.review_images && review.review_images.map((image: string, index: number) => {
              const reviewMedia = [
                ...(review.review_images || []).map((img: string) => ({ type: 'image' as const, url: img })),
                ...(review.review_videos || []).map((vid: string) => ({ type: 'video' as const, url: vid }))
              ];
              
              return (
                <TouchableOpacity
                  key={`review-img-${index}`}
                  activeOpacity={0.8}
                  onPress={() => {
                    setReviewMediaItems(reviewMedia);
                    setReviewMediaIndex(index);
                    setShowReviewMediaViewer(true);
                  }}
                >
                  <Image
                    source={{ uri: image }}
                    style={styles.reviewImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              );
            })}
            
            {/* Display Videos */}
            {review.review_videos && review.review_videos.map((video: string, index: number) => {
              const reviewMedia = [
                ...(review.review_images || []).map((img: string) => ({ type: 'image' as const, url: img })),
                ...(review.review_videos || []).map((vid: string) => ({ type: 'video' as const, url: vid }))
              ];
              const videoIndex = (review.review_images?.length || 0) + index;
              // Use generated thumbnail, fallback to placeholder
              const thumbnailUri = videoThumbnails[video] || 'https://images.unsplash.com/photo-1520975922284-9d8ff95b6a88?q=80&w=400&auto=format&fit=crop';
              
              return (
                <TouchableOpacity
                  key={`review-vid-${index}`}
                  style={styles.reviewVideoContainer}
                  activeOpacity={0.8}
                  onPress={() => {
                    setReviewMediaItems(reviewMedia);
                    setReviewMediaIndex(videoIndex);
                    setShowReviewMediaViewer(true);
                  }}
                >
                  <Image
                    source={{ uri: thumbnailUri }}
                    style={styles.reviewImage}
                    resizeMode="cover"
                    onError={(e) => {
                      console.error('[AllReviews] Thumbnail image load error:', e.nativeEvent.error);
                    }}
                  />
                  <View style={styles.reviewVideoOverlay}>
                    <Ionicons name="play-circle" size={32} color="rgba(255, 255, 255, 0.95)" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>{productName}</Text>
          <Text style={styles.headerSubtitle}>Customer Reviews</Text>
          <View style={styles.headerRating}>
            <Ionicons name="star" size={16} color="#fcc026" />
            <Text style={styles.headerRatingText}>
              {averageRating.toFixed(1)} out of 5
            </Text>
            <Text style={styles.headerReviewCount}>({totalReviews} reviews)</Text>
          </View>
        </View>
      </View>

      {/* All Reviews */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Overall Rating Summary */}
        <View style={styles.ratingSummaryContainer}>
          <View style={styles.overallRatingSection}>
            <Text style={styles.overallRatingNumber}>{averageRating.toFixed(1)}</Text>
            <View style={styles.overallRatingDetails}>
              <View style={styles.overallRatingStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= Math.round(averageRating) ? "star" : "star-outline"}
                    size={20}
                    color="#fcc026"
                    style={{ marginRight: 2 }}
                  />
                ))}
              </View>
              <Text style={styles.overallRatingText}>
                Based on {totalReviews} reviews
              </Text>
            </View>
          </View>
          
          {/* Rating Breakdown */}
          <View style={styles.ratingBreakdownSection}>
            <Text style={styles.ratingBreakdownTitle}>Rating Breakdown</Text>
            {renderRatingBreakdown()}
          </View>
        </View>

        {/* Individual Reviews Section */}
        <View style={styles.individualReviewsSection}>
          <Text style={styles.individualReviewsTitle}>All Reviews</Text>
          <View style={styles.reviewsList}>
            {reviews.map(renderReview)}
          </View>
        </View>
      </ScrollView>

      {/* Review Media Viewer Modal */}
      <Modal
        visible={showReviewMediaViewer}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReviewMediaViewer(false)}
      >
        <View style={styles.reviewMediaViewerContainer}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.reviewMediaViewerCloseButton}
            onPress={() => setShowReviewMediaViewer(false)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>

          {/* Media Counter */}
          <View style={styles.reviewMediaViewerCounter}>
            <Text style={styles.reviewMediaViewerCounterText}>
              {reviewMediaIndex + 1} / {reviewMediaItems.length}
            </Text>
          </View>

          {/* Scrollable Media Gallery */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const newIndex = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width);
              setReviewMediaIndex(newIndex);
            }}
            scrollEventThrottle={16}
            contentOffset={{ x: reviewMediaIndex * Dimensions.get('window').width, y: 0 }}
          >
            {reviewMediaItems.map((media, index) => (
              <View key={`review-media-${index}`} style={styles.reviewMediaViewerItemContainer}>
                {media.type === 'image' ? (
                  <Image
                    source={{ uri: media.url }}
                    style={styles.reviewMediaViewerImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Video
                    source={{ uri: media.url }}
                    style={styles.reviewMediaViewerVideo}
                    resizeMode={ResizeMode.CONTAIN}
                    useNativeControls
                    shouldPlay={index === reviewMediaIndex}
                    isLooping
                  />
                )}
              </View>
            ))}
          </ScrollView>

          {/* Navigation Arrows */}
          {reviewMediaItems.length > 1 && (
            <>
              {reviewMediaIndex > 0 && (
                <TouchableOpacity
                  style={[styles.reviewMediaViewerArrow, styles.reviewMediaViewerLeftArrow]}
                  onPress={() => setReviewMediaIndex(reviewMediaIndex - 1)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-back" size={32} color="#fff" />
                </TouchableOpacity>
              )}
              {reviewMediaIndex < reviewMediaItems.length - 1 && (
                <TouchableOpacity
                  style={[styles.reviewMediaViewerArrow, styles.reviewMediaViewerRightArrow]}
                  onPress={() => setReviewMediaIndex(reviewMediaIndex + 1)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-forward" size={32} color="#fff" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </Modal>

      {/* Report Review Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.reportModalOverlay}>
          <View style={styles.reportModalContainer}>
            <View style={styles.reportModalIconContainer}>
              <Ionicons name="flag" size={40} color="#FF6B6B" />
            </View>
            
            <Text style={styles.reportModalTitle}>Report Review</Text>
            <Text style={styles.reportModalMessage}>
              Are you sure you want to report this review? This will help us improve our content quality.
            </Text>
            
            <View style={styles.reportModalButtons}>
              <TouchableOpacity
                style={styles.reportModalCancelButton}
                onPress={() => {
                  setShowReportModal(false);
                  setReportingReviewId(null);
                }}
              >
                <Text style={styles.reportModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.reportModalConfirmButton}
                onPress={confirmReportReview}
              >
                <Text style={styles.reportModalConfirmText}>Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  headerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerRatingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  headerReviewCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  // Rating Summary Styles
  ratingSummaryContainer: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 8,
  },
  overallRatingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  overallRatingNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: '#111',
    marginRight: 20,
  },
  overallRatingDetails: {
    flex: 1,
  },
  overallRatingStars: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  overallRatingText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  ratingBreakdownSection: {
    marginTop: 8,
  },
  ratingBreakdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
  },
  ratingBreakdownContainer: {
    gap: 12,
  },
  ratingBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingBreakdownNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 20,
    textAlign: 'center',
  },
  ratingBreakdownBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  ratingBreakdownBar: {
    height: '100%',
    borderRadius: 4,
  },
  ratingBreakdownCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 30,
    textAlign: 'right',
  },
  individualReviewsSection: {
    backgroundColor: '#f8f9fa',
    paddingTop: 20,
  },
  individualReviewsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  reviewsList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  reviewerInfoContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  reviewerPhotoContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
  reviewerPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  reviewerPhotoPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  reviewRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewStarsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  verifiedPurchase: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    lineHeight: 24,
  },
  reviewMetadata: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  reviewTextContainer: {
    marginBottom: 12,
  },
  reviewText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  seeMoreText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  helpfulText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  reviewMediaScrollContainer: {
    marginBottom: 12,
  },
  reviewImagesContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  reviewImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  reviewVideoContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
  },
  reviewVideoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  reviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  helpfulButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  helpfulButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shareButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  reportButton: {
    marginLeft: 'auto',
  },
  reportButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  helpfulButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  helpfulButtonTextActive: {
    color: '#007AFF',
  },
  // Report Modal Styles
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  reportModalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  reportModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
    textAlign: 'center',
  },
  reportModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  reportModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  reportModalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  reportModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  reportModalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
  },
  reportModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Review Media Viewer Styles
  reviewMediaViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewMediaViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewMediaViewerCounter: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  reviewMediaViewerCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reviewMediaViewerItemContainer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewMediaViewerImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  reviewMediaViewerVideo: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
  },
  reviewMediaViewerArrow: {
    position: 'absolute',
    top: '50%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  reviewMediaViewerLeftArrow: {
    left: 20,
  },
  reviewMediaViewerRightArrow: {
    right: 20,
  },
});

export default AllReviews;

