import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  Easing,
  Platform,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const RING1_RADIUS = 85;
const RING2_RADIUS = 150;

const slides = [
  {
    key: '1',
    title: 'penny',
    subtitleRegular: 'Beautifully simple\n',
    subtitleColor: 'expense tracking',
    colorHex: '#FF7E67',
    bgHex: '#FFF5F2',
    centerEmoji: '✦',
    ring1: ['✨', '💎'],
    ring2: ['💰', '📈', '🚀'],
  },
  {
    key: '2',
    title: 'track locally',
    subtitleRegular: 'Your data stays\n',
    subtitleColor: 'on your device',
    colorHex: '#6B8AFF',
    bgHex: '#F2F6FF',
    centerEmoji: '👛',
    ring1: ['🔒', '📱'],
    ring2: ['📊', '📝', '🛡️'],
  },
  {
    key: '3',
    title: 'split with friends',
    subtitleRegular: 'Sync, split, and\n',
    subtitleColor: 'settle up easily',
    colorHex: '#A267FF',
    bgHex: '#F8F2FF',
    centerEmoji: '🫂',
    ring1: ['☕️', '🍻'],
    ring2: ['🍕', '🎫', '✈️'],
  },
];

const SlideVisual = ({ slide, isFocused }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isFocused) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 35000,
          useNativeDriver: true,
          easing: Easing.linear,
        })
      ).start();
    } else {
      rotateAnim.stopAnimation();
      rotateAnim.setValue(0);
    }
  }, [isFocused]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spinReverse = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  const renderRing = (ringEmojis, radius, spinAnim, counterSpinAnim, isReverse = false) => {
    return (
      <Animated.View style={[
        styles.ringContainer, 
        { 
          width: radius * 2, 
          height: radius * 2, 
          marginTop: -radius, 
          marginLeft: -radius, 
          transform: [{ rotate: isReverse ? counterSpinAnim : spinAnim }] 
        }
      ]}>
        <View style={styles.ringBorder} />
        {ringEmojis.map((emoji, index) => {
          const angle = (index / ringEmojis.length) * 360;
          return (
            <View key={index} style={[styles.emojiWrapper, { transform: [{ rotate: `${angle}deg` }, { translateY: -radius }] }]}>
              <Animated.View style={{ transform: [{ rotate: `-${angle}deg` }, { rotate: isReverse ? spinAnim : counterSpinAnim }] }}>
                <View style={styles.emojiCircle}>
                  <Text style={styles.emoji}>{emoji}</Text>
                </View>
              </Animated.View>
            </View>
          );
        })}
      </Animated.View>
    );
  };

  return (
    <View style={styles.visualContainer}>
      <View style={styles.centerOrb}>
        <Text style={[styles.centerEmoji, { color: slide.colorHex }]}>{slide.centerEmoji}</Text>
      </View>
      {renderRing(slide.ring1, RING1_RADIUS, spin, spinReverse, false)}
      {renderRing(slide.ring2, RING2_RADIUS, spin, spinReverse, true)}
    </View>
  );
};

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activePage, setActivePage] = useState(0);

  const bgAnim = useRef(new Animated.Value(0)).current;

  // Animations for text content
  const fadeAnims = useRef(slides.map(() => new Animated.Value(0))).current;
  const slideUpAnims = useRef(slides.map(() => new Animated.Value(20))).current;

  // Animation for the final button
  const buttonFadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Animate background color
    Animated.timing(bgAnim, {
      toValue: activePage,
      duration: 600,
      useNativeDriver: false,
    }).start();

    // Animate text elements
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
          delay: 300,
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
    router.replace('/(tabs)/');
  };

  const interpolatedBg = bgAnim.interpolate({
    inputRange: slides.map((_, i) => i),
    outputRange: slides.map(s => s.bgHex),
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: interpolatedBg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      
      {/* Texture Orbs */}
      <View style={styles.bgOrb1} />
      <View style={styles.bgOrb2} />

      <View style={styles.skipHeader}>
        {activePage !== slides.length - 1 && (
          <TouchableOpacity onPress={finishOnboarding} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <PagerView
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={handlePageSelected}
      >
        {slides.map((slide, index) => {
          const isFocused = index === activePage;
          return (
            <View key={slide.key} style={styles.page}>
              <View style={styles.topVisualArea}>
                <SlideVisual slide={slide} isFocused={isFocused} />
              </View>

              <Animated.View
                style={[
                  styles.textContainer,
                  {
                    opacity: isFocused ? fadeAnims[index] : 0.4,
                    transform: [{ translateY: isFocused ? slideUpAnims[index] : 20 }],
                  },
                ]}
              >
                <Text style={styles.logoText}>penny</Text>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.subtitle}>
                  {slide.subtitleRegular}
                  <Text style={[styles.subtitleBold, { color: slide.colorHex }]}>
                    {slide.subtitleColor}
                  </Text>
                </Text>
              </Animated.View>
            </View>
          );
        })}
      </PagerView>

      <View style={styles.footer}>
        <View style={styles.paginationContainer}>
          {slides.map((slide, i) => {
            const isActive = i === activePage;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  isActive ? { backgroundColor: slide.colorHex, width: 24 } : styles.inactiveDot,
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
              width: '100%',
              alignItems: 'center',
            }}
          >
            <TouchableOpacity
              style={styles.getStartedBtn}
              onPress={finishOnboarding}
              activeOpacity={0.8}
              disabled={activePage !== slides.length - 1}
            >
              <Text style={styles.getStartedText}>Get Started</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgOrb1: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: '#fff',
    opacity: 0.5,
  },
  bgOrb2: {
    position: 'absolute',
    bottom: -50,
    right: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: '#fff',
    opacity: 0.4,
  },
  skipHeader: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  skipBtn: {
    padding: 8,
  },
  skipText: {
    fontSize: 15,
    color: '#888',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  topVisualArea: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualContainer: {
    width: RING2_RADIUS * 2,
    height: RING2_RADIUS * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 10,
  },
  centerEmoji: {
    fontSize: 28,
  },
  ringContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  emojiWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 44,
    height: 44,
    marginTop: -22,
    marginLeft: -22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emoji: {
    fontSize: 18,
  },
  textContainer: {
    flex: 0.8,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#888',
    marginBottom: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  subtitle: {
    fontSize: 20,
    color: '#666',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '500',
  },
  subtitleBold: {
    fontWeight: '800',
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
  inactiveDot: {
    width: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
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
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  getStartedText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
