import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const slides = [
  {
    key: '1',
    title: 'welcome to tracker',
    subtitle: 'simple, elegant expense tracking.',
    icon: '✧',
  },
  {
    key: '2',
    title: 'track locally',
    subtitle: 'add expenses in seconds, your data stays on your device.',
    icon: '◒',
  },
  {
    key: '3',
    title: 'split with friends',
    subtitle: 'log in to sync, split, and settle up easily.',
    icon: '◓',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activePage, setActivePage] = useState(0);

  // Animations for slide content
  const fadeAnims = useRef(slides.map(() => new Animated.Value(0))).current;
  const slideUpAnims = useRef(slides.map(() => new Animated.Value(20))).current;

  // Animation for the final button
  const buttonFadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Animate the active page elements
    Animated.parallel([
      Animated.timing(fadeAnims[activePage], {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideUpAnims[activePage], {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Show button on last slide
    if (activePage === slides.length - 1) {
      Animated.parallel([
        Animated.timing(buttonFadeAnim, {
          toValue: 1,
          duration: 500,
          delay: 300, // wait for slide animation
          useNativeDriver: true,
        }),
        Animated.spring(buttonScaleAnim, {
          toValue: 1,
          tension: 60,
          friction: 8,
          delay: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(buttonFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      Animated.timing(buttonScaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [activePage]);

  const handlePageSelected = (e) => {
    setActivePage(e.nativeEvent.position);
  };

  const finishOnboarding = () => {
    // Go to the main app after onboarding
    router.replace('/(tabs)/split');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.skipHeader}>
        {activePage !== slides.length - 1 && (
          <TouchableOpacity onPress={finishOnboarding} style={styles.skipBtn}>
            <Text style={styles.skipText}>skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <PagerView
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={handlePageSelected}
      >
        {slides.map((slide, index) => {
          // Calculate if this slide is active or if we should just render it hidden initially
          const isFocused = index === activePage;
          
          return (
            <View key={slide.key} style={styles.page}>
              <Animated.View
                style={[
                  styles.contentContainer,
                  {
                    opacity: isFocused ? fadeAnims[index] : 0.4,
                    transform: [
                      {
                        translateY: isFocused ? slideUpAnims[index] : 20,
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.icon}>{slide.icon}</Text>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.subtitle}>{slide.subtitle}</Text>
              </Animated.View>
            </View>
          );
        })}
      </PagerView>

      <View style={styles.footer}>
        <View style={styles.paginationContainer}>
          {slides.map((_, i) => {
            const isActive = i === activePage;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  isActive ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            );
          })}
        </View>

        <View style={styles.buttonContainer}>
          <Animated.View
            style={{
              opacity: buttonFadeAnim,
              transform: [{ scale: buttonScaleAnim }],
            }}
          >
            <TouchableOpacity
              style={styles.getStartedBtn}
              onPress={finishOnboarding}
              activeOpacity={0.8}
              disabled={activePage !== slides.length - 1}
            >
              <Text style={styles.getStartedText}>let's go</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  skipHeader: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
  },
  skipBtn: {
    padding: 8,
  },
  skipText: {
    fontSize: 15,
    color: '#bbb',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 64,
    color: '#000',
    marginBottom: 40,
    fontWeight: '300',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#000',
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },
  footer: {
    height: 140,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingBottom: 20,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 5,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#000',
  },
  inactiveDot: {
    width: 6,
    backgroundColor: '#e8e8e8',
  },
  buttonContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  getStartedBtn: {
    backgroundColor: '#000',
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  getStartedText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
