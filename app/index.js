import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';

export default function IndexScreen() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // The user is authenticated if they have a non-null user object
      const inAuthGroup = segments[0] === '(tabs)';
      
      if (!user) {
        // Redirect to login if not authenticated
        router.replace('/login');
      } else {
        // Redirect to tabs (home) if authenticated
        router.replace('/(tabs)/');
      }
      setIsReady(true);
    });

    return () => unsubscribe();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
