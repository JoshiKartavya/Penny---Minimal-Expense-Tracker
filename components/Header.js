import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Animated } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { registerForPushNotificationsAsync } from '../services/NotificationService';
import { useAppContext } from '../app/AppContext';

export default function Header() {
  const { colors, isDark } = useAppContext();
  const styles = createStyles(colors, isDark);
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState(null);

  const isSettings = pathname === '/setting';
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(spinAnim, {
      toValue: isSettings ? 1 : 0,
      useNativeDriver: true,
      bounciness: 10,
      speed: 16,
    }).start();
  }, [isSettings]);

  function handleSettingsPress() {
    if (isSettings) {
      router.back();
    } else {
      router.push('/setting');
    }
  }

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg']
  });

  const gearOpacity = spinAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0]
  });

  const crossOpacity = spinAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1]
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Ensure user exists in Firestore (fixes older accounts)
        try {
          const userDocRef = doc(db, 'users', currentUser.email.toLowerCase());
          const pushToken = await registerForPushNotificationsAsync();
          const snap = await getDoc(userDocRef);
          if (!snap.exists()) {
            await setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email.toLowerCase(),
              name: currentUser.displayName || currentUser.email.split('@')[0],
              pushToken: pushToken || null,
              createdAt: new Date().toISOString(),
            }, { merge: true });
          } else if (pushToken) {
            await setDoc(userDocRef, { pushToken }, { merge: true });
          }
        } catch (e) {
          console.log('Error syncing user profile:', e);
        }
      }
    });
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('to_email', '==', user.email.toLowerCase()),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.brandText, { color: colors.text }]} numberOfLines={1}>
          {user ? `Hello, ${user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0]} 👋` : 'Penny'}
        </Text>
      </View>
      
      {/* Right side: Icons */}
      <View style={styles.iconGroup}>
        <TouchableOpacity 
          style={styles.iconBtn} 
          onPress={() => router.push('/notifications')}
          activeOpacity={0.7}
        >
          <Text style={styles.iconText}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.iconBtn} 
          onPress={handleSettingsPress}
          activeOpacity={0.7}
        >
          <Animated.View style={{ transform: [{ rotate: spin }], width: 26, height: 26, justifyContent: 'center', alignItems: 'center' }}>
            <Animated.Text style={[styles.iconText, { position: 'absolute', opacity: gearOpacity }]}>⚙️</Animated.Text>
            <Animated.Text style={[styles.iconText, { position: 'absolute', opacity: crossOpacity, fontSize: 28, color: '#bbb', marginTop: -2 }]}>✕</Animated.Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors, isDark) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 24, 
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: colors.background,
    zIndex: 10,
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16, // Increased gap
  },
  brandText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  iconBtn: {
    padding: 6,
    position: 'relative',
  },
  iconText: {
    fontSize: 26, // Increased from 20
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.danger,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
});
