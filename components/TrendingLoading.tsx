import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface TrendingLoadingProps {
    visible: boolean;
}

export const TrendingLoading = ({ visible }: TrendingLoadingProps) => {
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Multiple dots for the loader
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!visible) {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }).start();
        } else {
            fadeAnim.setValue(1);

            // Breathing animation for the main icon
            Animated.loop(
                Animated.sequence([
                    Animated.timing(scaleAnim, {
                        toValue: 1.1,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(scaleAnim, {
                        toValue: 1,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            // Bouncing dots animation
            const animateDot = (anim: Animated.Value, delay: number) => {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(anim, {
                            toValue: -10,
                            duration: 500,
                            delay: delay,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim, {
                            toValue: 0,
                            duration: 500,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                    ])
                ).start();
            };

            animateDot(dot1, 0);
            animateDot(dot2, 200);
            animateDot(dot3, 400);
        }
    }, [visible]);

    if (!visible && fadeAnim._value === 0) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                { opacity: fadeAnim },
                !visible && styles.pointerEventsNone
            ]}
        >
            <LinearGradient
                colors={['#FFFFFF', '#FFF0F5', '#FFE4E1']}
                style={styles.gradient}
            >
                <View style={styles.content}>
                    <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
                        <LinearGradient
                            colors={['#F53F7A', '#FF6B9C']}
                            style={styles.iconBackground}
                        >
                            <Ionicons name="sparkles" size={40} color="#FFF" />
                        </LinearGradient>
                    </Animated.View>

                    <Text style={styles.title}>Curating designs for u</Text>

                    <View style={styles.loaderContainer}>
                        <Animated.View style={[styles.dot, { transform: [{ translateY: dot1 }] }]} />
                        <Animated.View style={[styles.dot, { transform: [{ translateY: dot2 }] }]} />
                        <Animated.View style={[styles.dot, { transform: [{ translateY: dot3 }] }]} />
                    </View>
                </View>
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pointerEventsNone: {
        pointerEvents: 'none',
    },
    gradient: {
        width,
        height,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        marginBottom: 30,
        shadowColor: '#F53F7A',
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    iconBackground: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        color: '#333',
        fontSize: 22,
        fontWeight: '600',
        marginBottom: 40,
        letterSpacing: 0.5,
        fontFamily: 'System',
    },
    loaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 20,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#F53F7A',
        marginHorizontal: 6,
    },
});
