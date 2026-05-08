import { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Text from '../../components/AppText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, getDocs, setDoc, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { sendPushNotification } from '../../services/NotificationService';
import { useAppContext } from '../AppContext';

export default function SplitScreen() {
  const { t, colors, isDark } = useAppContext();
  const styles = createStyles(colors, isDark);
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

  // Settle Up State
  const [settleModalVisible, setSettleModalVisible] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');

  // Remove Connection State
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [connectionToRemove, setConnectionToRemove] = useState(null);

  // Success Modal State
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successTitle, setSuccessTitle] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const insets = useSafeAreaInsets();

  function getDisplayName(email) {
    if (!email) return '';
    const lowerEmail = email.toLowerCase();
    if (userNames[lowerEmail]) return userNames[lowerEmail];
    return lowerEmail.split('@')[0];
  }

  function showSuccess(title, msg) {
    setSuccessTitle(title);
    setSuccessMessage(msg);
    setSuccessModalVisible(true);
    setTimeout(() => {
      setSuccessModalVisible(false);
    }, 2500);
  }

  useEffect(() => {
    async function loadLastConnection() {
      if (connections.length > 0 && !activeConnection) {
        try {
          const lastConnId = await AsyncStorage.getItem('lastActiveConnectionId');
          const lastConn = connections.find(c => c.id === lastConnId);
          if (lastConn) {
            setActiveConnection(lastConn);
          } else {
            setActiveConnection(connections[0]);
          }
        } catch (e) {
          setActiveConnection(connections[0]);
        }
      } else if (connections.length > 0 && activeConnection) {
        // Refresh activeConnection with new data
        const updated = connections.find(c => c.id === activeConnection.id);
        if (updated) setActiveConnection(updated);
      }
    }
    loadLastConnection();
  }, [connections]);

  useEffect(() => {
    if (activeConnection) {
      AsyncStorage.setItem('lastActiveConnectionId', activeConnection.id).catch(e => console.log('Error saving active connection:', e));
    }
  }, [activeConnection]);

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
      const recipientData = userSnap.data();

      // Create notification
      const notifId = Date.now().toString();
      const myName = getDisplayName(user.email);
      await setDoc(doc(db, 'notifications', notifId), {
        from_email: user.email.toLowerCase(),
        from_name: myName,
        to_email: email,
        type: 'friend_request',
        status: 'pending',
        read: false,
        timestamp: new Date().getTime(),
      });

      if (recipientData.pushToken) {
        sendPushNotification(
          recipientData.pushToken,
          'New Invitation',
          `${myName} wants to split expenses with you.`,
          { type: 'friend_request' }
        );
      }

      showSuccess('Sent!', `Connection request sent to ${getDisplayName(email)}`);
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
      
      const userDocRef = doc(db, 'users', otherUser);
      const userSnap = await getDoc(userDocRef);
      const recipientData = userSnap.exists() ? userSnap.data() : null;

      const myName = getDisplayName(user.email);
      const notifId = Date.now().toString();
      await setDoc(doc(db, 'notifications', notifId), {
        from_email: user.email.toLowerCase(),
        from_name: myName,
        to_email: otherUser,
        type: 'split_request',
        amount: val,
        description: splitDesc.trim(),
        connectionId: activeConnection.id,
        status: 'pending',
        timestamp: new Date().getTime(),
      });

      if (recipientData && recipientData.pushToken) {
        sendPushNotification(
          recipientData.pushToken,
          'New Split Expense',
          `${myName} requested ₹${val} for ${splitDesc.trim()}`,
          { type: 'split_request' }
        );
      }

      showSuccess('Sent!', `Split request for ₹${val} sent to ${getDisplayName(otherUser)}`);
      setSplitModalVisible(false);
      setSplitAmount('');
      setSplitDesc('');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  async function sendSettleRequest() {
    const val = parseFloat(settleAmount);
    if (isNaN(val) || val <= 0) return;
    try {
      const otherUser = activeConnection.users.find(e => e !== user.email.toLowerCase());
      
      const userDocRef = doc(db, 'users', otherUser);
      const userSnap = await getDoc(userDocRef);
      const recipientData = userSnap.exists() ? userSnap.data() : null;

      const myName = getDisplayName(user.email);
      const notifId = Date.now().toString();
      await setDoc(doc(db, 'notifications', notifId), {
        from_email: user.email.toLowerCase(),
        from_name: myName,
        to_email: otherUser,
        type: 'settle_request',
        amount: val,
        description: settleNote.trim() || 'Settled via external payment',
        connectionId: activeConnection.id,
        status: 'pending',
        timestamp: new Date().getTime(),
      });

      if (recipientData && recipientData.pushToken) {
        sendPushNotification(
          recipientData.pushToken,
          'Settle Up Request',
          `${myName} paid you ₹${val}`,
          { type: 'settle_request' }
        );
      }

      showSuccess('Sent!', `Settle request for ₹${val} sent to ${getDisplayName(otherUser)}`);
      setSettleModalVisible(false);
      setSettleAmount('');
      setSettleNote('');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  function confirmDeleteUser(conn) {
    setConnectionToRemove(conn);
    setDropdownVisible(false);
    setRemoveModalVisible(true);
  }

  async function executeRemoveConnection() {
    if (!connectionToRemove) return;
    try {
      await deleteDoc(doc(db, 'connections', connectionToRemove.id));
      if (activeConnection?.id === connectionToRemove.id) {
        setActiveConnection(null);
      }
      setRemoveModalVisible(false);
      setConnectionToRemove(null);
    } catch(e) {
      Alert.alert('Error', e.message);
    }
  }

  function renderTransaction({ item }) {
    const isMe = item.from_email === user?.email?.toLowerCase();
    const isSettle = item.type === 'settle_request';
    const senderName = item.from_name || getDisplayName(item.from_email);
    
    let text = '';
    if (isSettle) {
      text = isMe ? `You paid ₹${item.amount}` : `${senderName} paid ₹${item.amount}`;
    } else {
      text = isMe ? `You split ₹${item.amount}` : `${senderName} split ₹${item.amount}`;
    }

    return (
      <View style={styles.txCard}>
        <View style={styles.txInfo}>
          <Text style={styles.txDesc}>{item.description}</Text>
          <Text style={styles.txSub}>{text}</Text>
        </View>
        <Text style={[styles.txAmount, { color: isMe ? colors.successLight : colors.danger }]}>
          {isMe ? '+' : '-'}₹{item.amount}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>{t('split_expenses')}</Text>
          {connections.length > 0 && activeConnection && user && (
            <TouchableOpacity style={styles.dropdownBtn} onPress={() => setDropdownVisible(true)}>
              <Text style={styles.dropdownText} numberOfLines={1}>
                {getDisplayName(activeConnection.users.find(e => e !== user.email.toLowerCase()))} ▼
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {!user ? (
          <View style={styles.emptyState}>
            <View style={styles.iconPlaceholder} />
            <Text style={styles.emptyTitle}>{t('log_in_to_connect_title')}</Text>
            <Text style={styles.emptyText}>
              {t('log_in_to_connect_desc')}
            </Text>
            
            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/login')}>
              <Text style={styles.loginBtnText}>{t('continue_with_email')}</Text>
            </TouchableOpacity>
          </View>
        ) : connections.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.iconPlaceholder} />
            <Text style={styles.emptyTitle}>{t('add_a_friend')}</Text>
            <Text style={styles.emptyText}>{t('add_a_friend_desc')}</Text>
            
            <TouchableOpacity style={styles.loginBtn} onPress={() => setAddModalVisible(true)}>
              <Text style={styles.loginBtnText}>{t('add_friend_by_email')}</Text>
            </TouchableOpacity>
          </View>
        ) : activeConnection && user ? (
          <View style={{ flex: 1 }}>
            <View style={styles.activeBalanceCard}>
              <Text style={styles.activeBalanceLabel}>{t('balance_with')} {getDisplayName(activeConnection.users.find(e => e !== user.email.toLowerCase()))}</Text>
              {(() => {
                const myBalance = (activeConnection.balances || {})[user.email.toLowerCase()] || 0;
                let balanceText = t('settled_up');
                let balanceColor = '#888';
                if (myBalance > 0) {
                  balanceText = `${t('owes_you')} ₹${myBalance}`;
                  balanceColor = colors.successLight; // Green for profit
                } else if (myBalance < 0) {
                  balanceText = `${t('you_owe')} ₹${Math.abs(myBalance)}`;
                  balanceColor = colors.danger; // Red for debt
                }
                return <Text style={[styles.activeBalanceAmount, { color: balanceColor }]}>{balanceText}</Text>;
              })()}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity style={[styles.addExpenseBtn, { backgroundColor: colors.borderSecondary }]} onPress={() => setSettleModalVisible(true)}>
                  <Text style={[styles.addExpenseBtnText, { color: colors.text }]}>{t('settle_up')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addExpenseBtn} onPress={() => setSplitModalVisible(true)}>
                  <Text style={styles.addExpenseBtnText}>{t('add_split_expense')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.historyTitle}>{t('history')}</Text>
            <FlatList
              data={transactions}
              keyExtractor={item => item.id}
              renderItem={renderTransaction}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.emptyHistoryText}>{t('no_split_history')}</Text>}
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
              const displayName = getDisplayName(otherEmail);
              return (
                <View key={conn.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 }}>
                  <TouchableOpacity style={[styles.dropdownItem, { flex: 1 }]} onPress={() => { setActiveConnection(conn); setDropdownVisible(false); }}>
                    <Text style={[styles.dropdownItemText, activeConnection?.id === conn.id && styles.dropdownItemActive]}>
                      {displayName}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeUserBtn} onPress={() => confirmDeleteUser(conn)}>
                    <Text style={styles.removeUserBtnText}>⋮</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <View style={styles.dropdownDivider} />
            <TouchableOpacity style={styles.dropdownItem} onPress={() => { setDropdownVisible(false); setAddModalVisible(true); }}>
              <Text style={[styles.dropdownItemText, { fontWeight: '600' }]}>+ {t('add_a_friend')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Split Expense Modal */}
      <Modal visible={splitModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24} style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: 80 }]}>
            <Text style={styles.modalTitle}>{t('split_expense_modal')}</Text>
            <Text style={styles.label}>{t('their_portion')}</Text>
            <TextInput
              style={styles.input}
              value={splitAmount}
              onChangeText={setSplitAmount}
              keyboardType="numeric"
              placeholder="50.00"
              autoFocus
            />
            <Text style={styles.label}>{t('what_was_it_for')}</Text>
            <TextInput
              style={styles.input}
              value={splitDesc}
              onChangeText={setSplitDesc}
              placeholder="e.g. Dinner"
              returnKeyType="done"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSplitModalVisible(false)}>
                <Text style={styles.cancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={sendSplitRequest}>
                <Text style={styles.saveText}>{t('send_request')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settle Up Modal */}
      <Modal visible={settleModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24} style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: 80 }]}>
            <Text style={styles.modalTitle}>{t('settle_balance')}</Text>
            <Text style={styles.label}>{t('amount_to_settle')}</Text>
            <TextInput
              style={styles.input}
              value={settleAmount}
              onChangeText={setSettleAmount}
              keyboardType="numeric"
              placeholder="50.00"
              autoFocus
            />
            <Text style={styles.label}>{t('note_optional')}</Text>
            <TextInput
              style={styles.input}
              value={settleNote}
              onChangeText={setSettleNote}
              placeholder="e.g. Paid in Cash"
              returnKeyType="done"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSettleModalVisible(false)}>
                <Text style={styles.cancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={sendSettleRequest}>
                <Text style={styles.saveText}>{t('send_request')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Friend Modal */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('connect_with_friend')}</Text>
            <Text style={styles.label}>{t('friends_email')}</Text>
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
                <Text style={styles.cancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={sendFriendRequest}>
                <Text style={styles.saveText}>{t('send_invite')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Remove Connection Modal */}
      <Modal
        visible={removeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRemoveModalVisible(false)}
      >
        <View style={styles.modalOverlayCentered}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Remove {connectionToRemove ? getDisplayName(connectionToRemove.users.find(e => e !== user?.email?.toLowerCase())) : ''}?</Text>
            <Text style={styles.alertText}>
              They will be removed from your split section, but no past transaction data will be deleted.
            </Text>

            <View style={styles.alertActions}>
              <TouchableOpacity 
                style={styles.alertConfirmBtn} 
                onPress={executeRemoveConnection}
              >
                <Text style={styles.alertConfirmText}>{t('remove') || 'Remove'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.alertCancelBtn} 
                onPress={() => setRemoveModalVisible(false)}
              >
                <Text style={styles.alertCancelText}>{t('cancel') || 'Cancel'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Success Modal */}
      <Modal visible={successModalVisible} animationType="fade" transparent>
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successIconWrapper}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successModalTitle}>{successTitle}</Text>
            <Text style={styles.successModalText}>{successMessage}</Text>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const createStyles = (colors, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: 28 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 24 },
  screenTitle: { fontSize: 18, fontWeight: '300', color: colors.textMuted },
  dropdownBtn: { backgroundColor: colors.iconPlaceholder, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, maxWidth: 180 },
  dropdownText: { fontSize: 13, fontWeight: '600', color: colors.text },
  
  activeBalanceCard: { backgroundColor: colors.card, borderRadius: 20, padding: 24, marginBottom: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.05, shadowRadius: 12, elevation: 4 },
  activeBalanceLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  activeBalanceAmount: { fontSize: 32, fontWeight: '700', marginBottom: 24 },
  addExpenseBtn: { backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 30 },
  addExpenseBtnText: { color: colors.primaryText, fontSize: 14, fontWeight: '600' },
  
  historyTitle: { fontSize: 14, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  txCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, padding: 16, borderRadius: 16, marginBottom: 12 },
  txInfo: { flex: 1, paddingRight: 16 },
  txDesc: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  txSub: { fontSize: 13, color: colors.textSecondary },
  txAmount: { fontSize: 16, fontWeight: '700' },
  emptyHistoryText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 24 },

  dropdownOverlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'flex-end', paddingTop: Platform.OS === 'ios' ? 100 : 80, paddingRight: 28 },
  dropdownMenu: { backgroundColor: colors.card, borderRadius: 16, width: 220, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.3 : 0.15, shadowRadius: 20, elevation: 10 },
  dropdownItem: { paddingVertical: 14, paddingHorizontal: 20 },
  dropdownItemText: { fontSize: 15, color: colors.text },
  dropdownItemActive: { fontWeight: '700', color: colors.danger },
  dropdownDivider: { height: 1, backgroundColor: colors.borderSecondary, marginVertical: 4 },
  removeUserBtn: { padding: 4, paddingHorizontal: 12, backgroundColor: colors.iconPlaceholder, borderRadius: 8 },
  removeUserBtnText: { fontSize: 16, fontWeight: '800', color: colors.textSecondary, lineHeight: 20 },
  
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 100 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20, marginBottom: 32 },
  
  iconPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.iconPlaceholder, marginBottom: 24 },
  
  loginBtn: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 30, width: '100%', alignItems: 'center' },
  loginBtnText: { color: colors.primaryText, fontSize: 15, fontWeight: '600' },
  
  modalOverlay: { flex: 1, backgroundColor: colors.overlayDark, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 32, paddingBottom: 50 },
  modalTitle: { fontSize: 22, fontWeight: '300', color: colors.textMuted, marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  input: { fontSize: 18, color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 12, marginBottom: 24 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  cancelBtn: { paddingVertical: 14, paddingHorizontal: 24 },
  cancelText: { fontSize: 16, color: colors.textMuted },
  saveBtn: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 30 },
  saveText: { fontSize: 16, color: colors.primaryText, fontWeight: '600' },

  // Alert Modal (Remove Friend)
  modalOverlayCentered: { flex: 1, backgroundColor: colors.overlayDark, justifyContent: 'center', alignItems: 'center', padding: 24 },
  alertBox: { backgroundColor: colors.card, width: '100%', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.3 : 0.15, shadowRadius: 24, elevation: 24 },
  alertTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 12, textAlign: 'center' },
  alertText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28, paddingHorizontal: 10 },
  alertActions: { width: '100%', gap: 12 },
  alertConfirmBtn: { backgroundColor: colors.danger, paddingVertical: 16, borderRadius: 20, alignItems: 'center', width: '100%' },
  alertConfirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  alertCancelBtn: { paddingVertical: 14, alignItems: 'center', width: '100%', borderRadius: 20, backgroundColor: colors.iconPlaceholder },
  alertCancelText: { color: colors.text, fontSize: 15, fontWeight: '600' },

  // Success Modal Styles
  successModalOverlay: { flex: 1, backgroundColor: colors.overlayDark, justifyContent: 'center', alignItems: 'center', padding: 24 },
  successModalCard: { backgroundColor: colors.card, borderRadius: 24, padding: 32, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: isDark ? 0.3 : 0.15, shadowRadius: 24, elevation: 20 },
  successIconWrapper: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.successLight, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successIconText: { fontSize: 32, color: '#fff', fontWeight: '800' },
  successModalTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8 },
  successModalText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
