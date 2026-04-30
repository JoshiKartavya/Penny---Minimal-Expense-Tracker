import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, getDocs, setDoc, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

export default function SplitScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [transactions, setTransactions] = useState([]);
  
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');

  // Split Expense State
  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [activeConnection, setActiveConnection] = useState(null);
  const [splitAmount, setSplitAmount] = useState('');
  const [splitDesc, setSplitDesc] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (connections.length > 0 && !activeConnection) {
      setActiveConnection(connections[0]);
    } else if (connections.length > 0 && activeConnection) {
      // Refresh activeConnection with new data
      const updated = connections.find(c => c.id === activeConnection.id);
      if (updated) setActiveConnection(updated);
    }
  }, [connections]);

  useEffect(() => {
    if (!activeConnection) {
      setTransactions([]);
      return;
    }
    const q = query(
      collection(db, 'split_transactions'),
      where('connectionId', '==', activeConnection.id)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTransactions(txs.sort((a, b) => b.timestamp - a.timestamp));
    });
    return () => unsub();
  }, [activeConnection?.id]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    async function fetchUserNames() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const mapping = {};
        snap.forEach(d => {
          mapping[d.id] = d.data().name || d.data().email;
        });
        setUserNames(mapping);
      } catch (e) {
        console.log('Error fetching users:', e);
      }
    }
    fetchUserNames();
  }, []);

  useEffect(() => {
    if (!user) {
      setConnections([]);
      setActiveConnection(null);
      setLoading(false);
      return;
    }

    // Listen for accepted connections where user is either in array
    const q = query(
      collection(db, 'connections'),
      where('users', 'array-contains', user.email.toLowerCase()),
      where('status', '==', 'accepted')
    );

    const unsubscribeConns = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setConnections(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setConnections([]);
      }
      setLoading(false);
    });

    return () => unsubscribeConns();
  }, [user]);

  async function sendFriendRequest() {
    const email = friendEmail.toLowerCase().trim();
    if (!email) return;
    if (email === user.email.toLowerCase()) {
      Alert.alert('Error', 'You cannot invite yourself.');
      return;
    }

    try {
      // Check if user exists
      const userDocRef = doc(db, 'users', email);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
        Alert.alert('Not Found', 'No user found with that email. They must create an account first.');
        return;
      }

      // Create notification
      const notifId = Date.now().toString();
      await setDoc(doc(db, 'notifications', notifId), {
        from_email: user.email.toLowerCase(),
        to_email: email,
        type: 'friend_request',
        status: 'pending',
        read: false,
        timestamp: new Date().getTime(),
      });

      Alert.alert('Sent!', 'Connection request sent to ' + email);
      setAddModalVisible(false);
      setFriendEmail('');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  async function sendSplitRequest() {
    const val = parseFloat(splitAmount);
    if (isNaN(val) || val <= 0) return;
    if (!splitDesc.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }
    try {
      const otherUser = activeConnection.users.find(e => e !== user.email.toLowerCase());
      const notifId = Date.now().toString();
      await setDoc(doc(db, 'notifications', notifId), {
        from_email: user.email.toLowerCase(),
        to_email: otherUser,
        type: 'split_request',
        amount: val,
        description: splitDesc.trim(),
        connectionId: activeConnection.id,
        status: 'pending',
        timestamp: new Date().getTime(),
      });
      Alert.alert('Sent!', `Split request for ₹${val} sent to ${otherUser}`);
      setSplitModalVisible(false);
      setSplitAmount('');
      setSplitDesc('');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  function renderTransaction({ item }) {
    const isMe = item.from_email === user?.email?.toLowerCase();
    const text = isMe ? `You split ₹${item.amount}` : `${item.from_email} split ₹${item.amount}`;
    return (
      <View style={styles.txCard}>
        <View style={styles.txInfo}>
          <Text style={styles.txDesc}>{item.description}</Text>
          <Text style={styles.txSub}>{text}</Text>
        </View>
        <Text style={[styles.txAmount, { color: isMe ? '#388E3C' : '#C56A67' }]}>
          {isMe ? '+' : '-'}₹{item.amount}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>split expenses</Text>
          {connections.length > 0 && activeConnection && user && (
            <TouchableOpacity style={styles.dropdownBtn} onPress={() => setDropdownVisible(true)}>
              <Text style={styles.dropdownText} numberOfLines={1}>
                {userNames[activeConnection.users.find(e => e !== user.email.toLowerCase())] || activeConnection.users.find(e => e !== user.email.toLowerCase())} ▼
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {!user ? (
          <View style={styles.emptyState}>
            <View style={styles.iconPlaceholder} />
            <Text style={styles.emptyTitle}>Log in to connect</Text>
            <Text style={styles.emptyText}>
              Connect with a friend to share expenses, split bills, and keep track of who owes whom in real time.
            </Text>
            
            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/login')}>
              <Text style={styles.loginBtnText}>continue with email</Text>
            </TouchableOpacity>
          </View>
        ) : connections.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.iconPlaceholder} />
            <Text style={styles.emptyTitle}>Add a Friend</Text>
            <Text style={styles.emptyText}>You need to connect with a friend before you can start splitting expenses.</Text>
            
            <TouchableOpacity style={styles.loginBtn} onPress={() => setAddModalVisible(true)}>
              <Text style={styles.loginBtnText}>add friend by email</Text>
            </TouchableOpacity>
          </View>
        ) : activeConnection && user ? (
          <View style={{ flex: 1 }}>
            <View style={styles.activeBalanceCard}>
              <Text style={styles.activeBalanceLabel}>Balance with {userNames[activeConnection.users.find(e => e !== user.email.toLowerCase())] || activeConnection.users.find(e => e !== user.email.toLowerCase())}</Text>
              {(() => {
                const myBalance = (activeConnection.balances || {})[user.email.toLowerCase()] || 0;
                let balanceText = 'Settled up';
                let balanceColor = '#888';
                if (myBalance > 0) {
                  balanceText = `Owes you ₹${myBalance}`;
                  balanceColor = '#388E3C'; // Green for profit
                } else if (myBalance < 0) {
                  balanceText = `You owe ₹${Math.abs(myBalance)}`;
                  balanceColor = '#C56A67'; // Red for debt
                }
                return <Text style={[styles.activeBalanceAmount, { color: balanceColor }]}>{balanceText}</Text>;
              })()}
              <TouchableOpacity style={styles.addExpenseBtn} onPress={() => setSplitModalVisible(true)}>
                <Text style={styles.addExpenseBtnText}>+ add split expense</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.historyTitle}>history</Text>
            <FlatList
              data={transactions}
              keyExtractor={item => item.id}
              renderItem={renderTransaction}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.emptyHistoryText}>No split history yet.</Text>}
            />
          </View>
        ) : null}
      </View>

      {/* Dropdown Modal */}
      <Modal visible={dropdownVisible} animationType="fade" transparent>
        <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setDropdownVisible(false)}>
          <View style={styles.dropdownMenu}>
            {connections.map(conn => {
              const otherEmail = conn.users.find(e => e !== user?.email?.toLowerCase());
              const displayName = userNames[otherEmail] || otherEmail;
              return (
                <TouchableOpacity key={conn.id} style={styles.dropdownItem} onPress={() => { setActiveConnection(conn); setDropdownVisible(false); }}>
                  <Text style={[styles.dropdownItemText, activeConnection?.id === conn.id && styles.dropdownItemActive]}>
                    {displayName}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={styles.dropdownDivider} />
            <TouchableOpacity style={styles.dropdownItem} onPress={() => { setDropdownVisible(false); setAddModalVisible(true); }}>
              <Text style={[styles.dropdownItemText, { fontWeight: '600' }]}>+ Add Friend</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Split Expense Modal */}
      <Modal visible={splitModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24} style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: 80 }]}>
            <Text style={styles.modalTitle}>split expense</Text>
            <Text style={styles.label}>their portion (₹)</Text>
            <TextInput
              style={styles.input}
              value={splitAmount}
              onChangeText={setSplitAmount}
              keyboardType="numeric"
              placeholder="50.00"
              autoFocus
            />
            <Text style={styles.label}>what was it for?</Text>
            <TextInput
              style={styles.input}
              value={splitDesc}
              onChangeText={setSplitDesc}
              placeholder="e.g. Dinner"
              returnKeyType="done"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSplitModalVisible(false)}>
                <Text style={styles.cancelText}>cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={sendSplitRequest}>
                <Text style={styles.saveText}>send request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Friend Modal */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>connect with friend</Text>
            <Text style={styles.label}>friend's email</Text>
            <TextInput
              style={styles.input}
              value={friendEmail}
              onChangeText={setFriendEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="friend@example.com"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.cancelText}>cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={sendFriendRequest}>
                <Text style={styles.saveText}>send invite</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfcfc' },
  content: { flex: 1, paddingHorizontal: 28 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 24 },
  screenTitle: { fontSize: 18, fontWeight: '300', color: '#b0b0b0' },
  dropdownBtn: { backgroundColor: '#f0f0f0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, maxWidth: 180 },
  dropdownText: { fontSize: 13, fontWeight: '600', color: '#000' },
  
  activeBalanceCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, marginBottom: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 4 },
  activeBalanceLabel: { fontSize: 13, fontWeight: '700', color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  activeBalanceAmount: { fontSize: 32, fontWeight: '700', marginBottom: 24 },
  addExpenseBtn: { backgroundColor: '#000', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 30 },
  addExpenseBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  
  historyTitle: { fontSize: 14, fontWeight: '600', color: '#b0b0b0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  txCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12 },
  txInfo: { flex: 1, paddingRight: 16 },
  txDesc: { fontSize: 15, fontWeight: '600', color: '#000', marginBottom: 4 },
  txSub: { fontSize: 13, color: '#888' },
  txAmount: { fontSize: 16, fontWeight: '700' },
  emptyHistoryText: { fontSize: 14, color: '#bbb', textAlign: 'center', marginTop: 24 },

  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'flex-end', paddingTop: Platform.OS === 'ios' ? 100 : 80, paddingRight: 28 },
  dropdownMenu: { backgroundColor: '#fff', borderRadius: 16, width: 220, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  dropdownItem: { paddingVertical: 14, paddingHorizontal: 20 },
  dropdownItemText: { fontSize: 15, color: '#000' },
  dropdownItemActive: { fontWeight: '700', color: '#C56A67' },
  dropdownDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 4 },
  
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 100 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#000', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, paddingHorizontal: 20, marginBottom: 32 },
  
  iconPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f0f0f0', marginBottom: 24 },
  
  loginBtn: { backgroundColor: '#000', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 30, width: '100%', alignItems: 'center' },
  loginBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 32, paddingBottom: 50 },
  modalTitle: { fontSize: 22, fontWeight: '300', color: '#b0b0b0', marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '600', color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  input: { fontSize: 18, color: '#000', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 12, marginBottom: 24 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  cancelBtn: { paddingVertical: 14, paddingHorizontal: 24 },
  cancelText: { fontSize: 16, color: '#bbb' },
  saveBtn: { backgroundColor: '#000', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 30 },
  saveText: { fontSize: 16, color: '#fff', fontWeight: '600' },
});
