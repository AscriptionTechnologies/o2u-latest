import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface OrderSuccessAnimationProps {
  visible: boolean;
  orderNumber: string;
  onClose: () => void;
  onViewOrders: () => void;
}

const OrderSuccessAnimation: React.FC<OrderSuccessAnimationProps> = ({
  visible,
  orderNumber,
  onClose,
  onViewOrders,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const checkmarkRotate = useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef(
    Array.from({ length: 20 }, () => ({
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Reset all animations
      scaleAnim.setValue(0);
      checkmarkScale.setValue(0);
      checkmarkRotate.setValue(0);
      contentOpacity.setValue(0);
      pulseAnim.setValue(1);
      confettiAnims.forEach((anim) => {
        anim.translateY.setValue(0);
        anim.translateX.setValue(0);
        anim.rotate.setValue(0);
        anim.opacity.setValue(1);
      });

      // Sequence of animations
      Animated.sequence([
        // 1. Scale in the circle
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        // 2. Show checkmark with rotation
        Animated.parallel([
          Animated.spring(checkmarkScale, {
            toValue: 1,
            tension: 80,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(checkmarkRotate, {
            toValue: 1,
            tension: 80,
            friction: 8,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        // 3. Show content
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();

        // 4. Start confetti
        confettiAnims.forEach((anim, index) => {
          const randomX = (Math.random() - 0.5) * width * 1.5;
          const randomRotate = Math.random() * 720 - 360;
          const delay = index * 30;

          Animated.parallel([
            Animated.timing(anim.translateY, {
              toValue: height,
              duration: 2000 + Math.random() * 1000,
              delay,
              useNativeDriver: true,
            }),
            Animated.timing(anim.translateX, {
              toValue: randomX,
              duration: 2000 + Math.random() * 1000,
              delay,
              useNativeDriver: true,
            }),
            Animated.timing(anim.rotate, {
              toValue: randomRotate,
              duration: 2000 + Math.random() * 1000,
              delay,
              useNativeDriver: true,
            }),
            Animated.timing(anim.opacity, {
              toValue: 0,
              duration: 2000,
              delay: delay + 500,
              useNativeDriver: true,
            }),
          ]).start();
        });

        // 5. Pulse animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.05,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    }
  }, [visible]);

  const checkmarkRotateInterpolate = checkmarkRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '0deg'],
  });

  const confettiColors = [
    '#FF6B9D',
    '#C44569',
    '#F8B500',
    '#00D2FF',
    '#3867D6',
    '#8E44AD',
    '#FEA47F',
    '#25CCF7',
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Background overlay with gradient */}
        <LinearGradient
          colors={['rgba(245, 63, 122, 0.95)', 'rgba(196, 69, 105, 0.95)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Confetti */}
        {confettiAnims.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.confetti,
              {
                backgroundColor:
                  confettiColors[index % confettiColors.length],
                left: width / 2 - 5,
                top: height / 2 - 100,
                transform: [
                  { translateY: anim.translateY },
                  { translateX: anim.translateX },
                  {
                    rotate: anim.rotate.interpolate({
                      inputRange: [0, 360],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
                opacity: anim.opacity,
              },
            ]}
          />
        ))}

        <View style={styles.content}>
          {/* Success Circle with Checkmark */}
          <Animated.View
            style={[
              styles.successCircle,
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.successCircleInner}>
              <Animated.View
                style={{
                  transform: [
                    { scale: Animated.multiply(checkmarkScale, pulseAnim) },
                    { rotate: checkmarkRotateInterpolate },
                  ],
                }}
              >
                <Ionicons name="checkmark" size={80} color="#fff" />
              </Animated.View>
            </View>
          </Animated.View>

          {/* Success Text */}
          <Animated.View
            style={[styles.textContainer, { opacity: contentOpacity }]}
          >
            <Text style={styles.successTitle}>Order Placed! 🎉</Text>
            <Text style={styles.successSubtitle}>
              Your order has been successfully placed
            </Text>

            {/* Order Number Card */}
            <View style={styles.orderCard}>
              <View style={styles.orderCardHeader}>
                <Ionicons name="receipt-outline" size={20} color="#F53F7A" />
                <Text style={styles.orderCardLabel}>Order Number</Text>
              </View>
              <Text style={styles.orderNumber}>{orderNumber}</Text>
            </View>

            {/* Info Message */}
            <View style={styles.infoBox}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#fff"
              />
              <Text style={styles.infoText}>
                We'll send you an update when your order ships
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onViewOrders}
                activeOpacity={0.8}
              >
                <Ionicons name="list-outline" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>View Orders</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>Continue Shopping</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 30,
    width: '100%',
  },
  successCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  successCircleInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 30,
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  orderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  orderCardLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  orderNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F53F7A',
    textAlign: 'center',
    letterSpacing: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 30,
    width: '100%',
  },
  infoText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#F53F7A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OrderSuccessAnimation;

