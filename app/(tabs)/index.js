import { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  Keyboard, TouchableWithoutFeedback, Animated,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebaseConfig';

const STORAGE_KEY = '@tracker_transactions';
const BALANCE_KEY = '@tracker_balance';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatIndian(num) {
  const isNeg = num < 0;
  const abs = Math.abs(num).toFixed(2);
  const [whole, dec] = abs.split('.');
  let res = '';
  const len = whole.length;
  if (len <= 3) { res = whole; }
  else {
    res = whole.slice(len - 3);
    let rem = whole.slice(0, len - 3);
    while (rem.length > 2) { res = rem.slice(rem.length - 2) + ',' + res; rem = rem.slice(0, rem.length - 2); }
    if (rem.length > 0) res = rem + ',' + res;
  }
  return (isNeg ? '-' : '') + res + '.' + dec;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

export default function WalletScreen() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [snapshotVisible, setSnapshotVisible] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState('online');

  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const snapshotAnim = useRef(new Animated.Value(0)).current;

  // Compute dynamic storage keys
  const getStorageKey = (u) => u ? `@tracker_transactions_${u.uid}` : '@tracker_transactions_local';
  const getBalanceKey = (u) => u ? `@tracker_balance_${u.uid}` : '@tracker_balance_local';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      try {
        const txKey = getStorageKey(currentUser);
        const balKey = getBalanceKey(currentUser);
        const [txRaw, balRaw] = await Promise.all([
          AsyncStorage.getItem(txKey),
          AsyncStorage.getItem(balKey),
        ]);
        if (txRaw) {
          const parsed = JSON.parse(txRaw).map(t => ({ ...t, date: new Date(t.date) }));
          setTransactions(parsed);
        } else {
          setTransactions([]);
        }
        if (balRaw !== null) {
          setBalance(parseFloat(balRaw));
        } else {
          setBalance(0);
        }
      } catch (_) {}
    });
    return unsubscribe;
  }, []);

  const persist = useCallback(async (txs, bal) => {
    try {
      const txKey = getStorageKey(user);
      const balKey = getBalanceKey(user);
      await AsyncStorage.setItem(txKey, JSON.stringify(txs));
      await AsyncStorage.setItem(balKey, String(bal));
    } catch (_) {}
  }, [user]);

  const today = new Date();
  const dailyNet = transactions
    .filter(t => isSameDay(new Date(t.date), today))
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);

  const weekAgo = new Date(); weekAgo.setDate(today.getDate() - 7);
  const weeklyNet = transactions
    .filter(t => new Date(t.date) >= weekAgo)
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);

  function openModal(type) {
    setActionType(type); setAmount(''); setDescription(''); setMethod('online'); setModalVisible(true);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }

  function closeModal() {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { setModalVisible(false); setActionType(null); });
  }

  function handleSave() {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    const tx = {
      id: Date.now().toString(),
      type: actionType,
      amount: val,
      description: description.trim() || (actionType === 'income' ? 'Income' : 'Expense'),
      date: new Date(),
      method: method,
    };
    const newTxs = [tx, ...transactions];
    const newBal = actionType === 'income' ? balance + val : balance - val;
    setTransactions(newTxs);
    setBalance(newBal);
    persist(newTxs, newBal);
    closeModal();
  }

  function openSnapshot() {
    setSnapshotVisible(true);
    Animated.timing(snapshotAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }
  function closeSnapshot() {
    Animated.timing(snapshotAnim, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => setSnapshotVisible(false));
  }

  const isProfit = dailyNet >= 0;
  // Soft colors applied here
  const dailyColor = isProfit ? '#6A9C78' : '#C56A67';
  const dailySign = isProfit ? '+' : '';

  const cashBalance = transactions.filter(t => t.method === 'cash').reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
  const onlineBalance = transactions.filter(t => t.method !== 'cash').reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <View style={styles.balanceChip}>
          <Text style={styles.balanceChipLabel}>balance  </Text>
          <Text style={styles.balanceChipAmount}>₹ {formatIndian(balance)}</Text>
        </View>
        <View style={styles.subBalanceRow}>
          <Text style={styles.balanceSubLabel}>CASH  </Text>
          <Text style={styles.balanceSubAmount}>₹ {formatIndian(cashBalance)}</Text>
          <Text style={styles.balanceSubLabel}>   •   ONLINE  </Text>
          <Text style={styles.balanceSubAmount}>₹ {formatIndian(onlineBalance)}</Text>
        </View>

      <View style={styles.heroSection}>
        <Text style={styles.heroLabel}>today</Text>
        <Text style={[styles.heroAmount, { color: dailyColor }]}>
          {dailySign}{formatIndian(dailyNet)}
        </Text>
        <Text style={styles.heroSub}>
          {isProfit ? 'net positive' : 'net spend'}
        </Text>
      </View>

      <View style={{ flex: 1 }} />
      <View style={styles.fabCluster}>
        <TouchableOpacity style={styles.fabSmallTop} onPress={() => openModal('income')} activeOpacity={0.75}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
        <View style={styles.fabRow}>
          <TouchableOpacity style={styles.fabLarge} onPress={openSnapshot} activeOpacity={0.75}>
            <Text style={styles.fabArrow}>↗</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fabLarge} onPress={() => openModal('expense')} activeOpacity={0.75}>
            <Text style={styles.fabIcon}>−</Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>

      {/* Transaction Modal */}
      {modalVisible && (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.modalOverlay, { opacity: overlayAnim }]}>
            <TouchableWithoutFeedback onPress={closeModal}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
          </Animated.View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24} style={styles.keyboardAvoid}>
            <Animated.View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 20, 80), transform: [{ translateY: slideAnim }] }]}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHandle} />
                  <Text style={styles.modalTitle}>{actionType === 'income' ? 'add income' : 'add expense'}</Text>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputPrefix}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor="#ccc"
                      autoFocus
                    />
                  </View>
                  <View style={styles.methodToggle}>
                    <TouchableOpacity 
                      style={[styles.methodBtn, method === 'online' && styles.methodBtnActive]} 
                      onPress={() => setMethod('online')}
                    >
                      <Text style={[styles.methodText, method === 'online' && styles.methodTextActive]}>Online</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.methodBtn, method === 'cash' && styles.methodBtnActive]} 
                      onPress={() => setMethod('cash')}
                    >
                      <Text style={[styles.methodText, method === 'cash' && styles.methodTextActive]}>Cash</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.descInput}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="what was it for?"
                    placeholderTextColor="#bbb"
                    maxLength={50}
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                  />
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                      <Text style={styles.cancelText}>cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, (!amount || parseFloat(amount) <= 0) && styles.saveBtnDisabled]}
                      onPress={handleSave}
                      disabled={!amount || parseFloat(amount) <= 0}
                    >
                      <Text style={styles.saveText}>save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Snapshot Overlay */}
      {snapshotVisible && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.snapshotOverlay, { opacity: snapshotAnim }]}>
          <TouchableWithoutFeedback onPress={closeSnapshot}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.snapshotCard, {
            opacity: snapshotAnim,
            transform: [{ scale: snapshotAnim.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] }) }]
          }]}>
            <Text style={styles.snapshotTitle}>how am i doing?</Text>
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotLabel}>total balance</Text>
              <Text style={styles.snapshotValue}>₹ {formatIndian(balance)}</Text>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotLabel}>today</Text>
              <Text style={[styles.snapshotValue, { color: dailyNet >= 0 ? '#000' : '#888' }]}>
                {dailyNet >= 0 ? '+' : ''}₹ {formatIndian(dailyNet)}
              </Text>
            </View>
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotLabel}>this week</Text>
              <Text style={[styles.snapshotValue, { color: weeklyNet >= 0 ? '#000' : '#888' }]}>
                {weeklyNet >= 0 ? '+' : ''}₹ {formatIndian(weeklyNet)}
              </Text>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotLabel}>transactions logged</Text>
              <Text style={styles.snapshotValue}>{transactions.length}</Text>
            </View>
            <Text style={styles.snapshotHint}>tap anywhere to close</Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfcfc' },
  content: { flex: 1, paddingHorizontal: 28, paddingBottom: 120 },
  balanceChip: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10, marginBottom: 8 },
  balanceChipLabel: { fontSize: 12, color: '#c0c0c0', fontWeight: '500', letterSpacing: 0.3 },
  balanceChipAmount: { fontSize: 14, color: '#a0a0a0', fontWeight: '600' },
  subBalanceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 36 },
  balanceSubLabel: { fontSize: 10, color: '#d0d0d0', fontWeight: '600', letterSpacing: 0.5 },
  balanceSubAmount: { fontSize: 11, color: '#b0b0b0', fontWeight: '600' },
  heroSection: { marginTop: 0 },
  heroLabel: { fontSize: 12, fontWeight: '600', color: '#c0c0c0', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
  heroAmount: { fontSize: 46, fontWeight: '800', letterSpacing: -1.5, lineHeight: 52 },
  heroSub: { fontSize: 14, color: '#c0c0c0', fontWeight: '400', marginTop: 8, letterSpacing: 0.2 },
  fabCluster: { alignItems: 'flex-end', marginBottom: 10 },
  fabSmallTop: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  fabRow: { flexDirection: 'row', gap: 14 },
  fabLarge: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  fabIcon: { fontSize: 34, color: '#fff', fontWeight: '300', lineHeight: 38 },
  fabArrow: { fontSize: 32, color: '#fff', fontWeight: '400', lineHeight: 36 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  keyboardAvoid: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 20 },
  modalContent: { paddingHorizontal: 28, paddingTop: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '300', color: '#b0b0b0', marginBottom: 30 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  inputPrefix: { fontSize: 36, fontWeight: '700', color: '#000', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 36, fontWeight: '700', color: '#000', padding: 0 },
  descInput: { fontSize: 16, color: '#000', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 12, marginBottom: 32 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelBtn: { paddingVertical: 14, paddingHorizontal: 24 },
  cancelText: { fontSize: 16, color: '#bbb' },
  saveBtn: { backgroundColor: '#000', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30 },
  saveBtnDisabled: { backgroundColor: '#e0e0e0' },
  saveText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  
  methodToggle: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderRadius: 20, padding: 4, marginBottom: 16 },
  methodBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 16 },
  methodBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  methodText: { fontSize: 13, fontWeight: '600', color: '#888' },
  methodTextActive: { color: '#000' },
  snapshotOverlay: { backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  snapshotCard: { backgroundColor: '#fff', borderRadius: 28, padding: 32, width: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 24 },
  snapshotTitle: { fontSize: 13, fontWeight: '600', color: '#bbb', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 28 },
  snapshotRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  snapshotLabel: { fontSize: 15, color: '#888', fontWeight: '400' },
  snapshotValue: { fontSize: 16, fontWeight: '700', color: '#000' },
  snapshotDivider: { height: 1, backgroundColor: '#f2f2f2', marginVertical: 8 },
  snapshotHint: { fontSize: 11, color: '#d0d0d0', textAlign: 'center', marginTop: 24 },
});
