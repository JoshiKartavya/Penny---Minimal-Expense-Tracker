import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import { requestPermissionsAsync, sendLocalNotification } from '../../services/NotificationService';
import Header from '../../components/Header';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const appStartTime = useRef(Date.now());

  useEffect(() => {
    requestPermissionsAsync();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const q = query(
          collection(db, 'notifications'),
          where('to_email', '==', user.email.toLowerCase()),
          where('status', '==', 'pending')
        );

        const unsubscribeSnap = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              // Only notify for truly new notifications received after app launch
              if (data.timestamp > appStartTime.current) {
                if (data.type === 'friend_request') {
                  sendLocalNotification(
                    'New Invitation',
                    `${data.from_email} wants to split expenses with you.`
                  );
                } else if (data.type === 'split_request') {
                  sendLocalNotification(
                    'New Split Expense',
                    `${data.from_email} requested ₹${data.amount} for ${data.description}`
                  );
                }
              }
            }
          });
        });
        
        return () => unsubscribeSnap();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Global Header sits above the Swipeable Tabs */}
      <Header />
      
      <MaterialTopTabs
        screenOptions={{
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          tabBarStyle: styles.tabBar,
          tabBarIndicatorStyle: styles.indicator,
          tabBarActiveTintColor: '#000',
          tabBarInactiveTintColor: '#bbb',
          swipeEnabled: true,
        }}
      >
        <MaterialTopTabs.Screen
          name="activity"
          options={{ title: 'Activity' }}
        />
        <MaterialTopTabs.Screen
          name="index"
          options={{ title: 'Wallet' }}
        />
        <MaterialTopTabs.Screen
          name="split"
          options={{ title: 'Split' }}
        />
      </MaterialTopTabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcfcfc',
  },
  tabBar: {
    backgroundColor: '#fcfcfc',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
    paddingHorizontal: 16,
  },
  tabItem: {
    width: 'auto',
    paddingHorizontal: 12,
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
  indicator: {
    backgroundColor: '#000',
    height: 2,
    borderRadius: 2,
    marginBottom: -1, // Sits exactly on the bottom border
  },
});
