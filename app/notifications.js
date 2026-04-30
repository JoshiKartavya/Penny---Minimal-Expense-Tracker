import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, getDoc, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('to_email', '==', user.email.toLowerCase()),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(notifs.sort((a, b) => b.timestamp - a.timestamp));
    });

    return () => unsubscribe();
  }, [user]);

  async function acceptRequest(notification) {
    try {
      // 1. Update notification status
      await updateDoc(doc(db, 'notifications', notification.id), {
        status: 'accepted',
        read: true
      });

      // 2. Create the connection record
      const connectionId = [notification.from_email, notification.to_email].sort().join('_');
      await setDoc(doc(db, 'connections', connectionId), {
        users: [notification.from_email, notification.to_email],
        status: 'accepted',
        createdAt: new Date().getTime()
      });

      Alert.alert('Success', `You are now connected with ${notification.from_email}!`);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  async function declineRequest(notification) {
    try {
      await updateDoc(doc(db, 'notifications', notification.id), {
        status: 'declined',
        read: true
      });
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  async function acceptSplitRequest(notification) {
    try {
      const connRef = doc(db, 'connections', notification.connectionId);
      const connSnap = await getDoc(connRef);
      if (!connSnap.exists()) throw new Error('Connection not found');
      
      const connData = connSnap.data();
      const balances = connData.balances || {};
      
      const fromUser = notification.from_email;
      const toUser = notification.to_email;
      const amount = notification.amount;
      
      const newFromBal = (balances[fromUser] || 0) + amount;
      const newToBal = (balances[toUser] || 0) - amount;
      
      await updateDoc(connRef, {
        balances: {
          ...balances,
          [fromUser]: newFromBal,
          [toUser]: newToBal
        }
      });
      
      await updateDoc(doc(db, 'notifications', notification.id), {
        status: 'accepted',
        read: true
      });
      
      const txId = Date.now().toString();
      await setDoc(doc(db, 'split_transactions', txId), {
        connectionId: notification.connectionId,
        from_email: fromUser,
        to_email: toUser,
        amount: amount,
        description: notification.description,
        timestamp: new Date().getTime()
      });
      
      Alert.alert('Success', `You accepted the split expense of ₹${amount}.`);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  function renderItem({ item }) {
    if (item.type === 'friend_request') {
      return (
        <View style={styles.card}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>Connection Request</Text>
            <Text style={styles.cardText}><Text style={{ fontWeight: '600' }}>{item.from_email}</Text> wants to connect to split expenses.</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(item)}>
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineBtn} onPress={() => declineRequest(item)}>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    if (item.type === 'split_request') {
      return (
        <View style={styles.card}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>Split Request</Text>
            <Text style={styles.cardText}>
              <Text style={{ fontWeight: '600' }}>{item.from_email}</Text> added a split expense of <Text style={{ fontWeight: '600' }}>₹{item.amount}</Text> for "{item.description}".
            </Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptSplitRequest(item)}>
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineBtn} onPress={() => declineRequest(item)}>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>✕</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.screenTitle}>notifications</Text>

      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>You have no new notifications.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfcfc', paddingHorizontal: 28 },
  topBar: { paddingTop: 16, alignItems: 'flex-end', marginBottom: 10 },
  backBtn: { padding: 8, marginRight: -8 },
  backText: { fontSize: 24, color: '#bbb', fontWeight: '300' },
  screenTitle: { fontSize: 20, fontWeight: '300', color: '#b0b0b0', marginBottom: 24 },
  
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 100 },
  emptyText: { fontSize: 16, color: '#bbb' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#C56A67', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  cardText: { fontSize: 15, color: '#555', lineHeight: 22, marginBottom: 16 },
  
  actions: { flexDirection: 'row', gap: 12 },
  acceptBtn: { flex: 1, backgroundColor: '#000', paddingVertical: 12, borderRadius: 24, alignItems: 'center' },
  acceptText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  declineBtn: { flex: 1, backgroundColor: '#f0f0f0', paddingVertical: 12, borderRadius: 24, alignItems: 'center' },
  declineText: { color: '#000', fontWeight: '600', fontSize: 14 },
});
