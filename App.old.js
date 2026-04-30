import { StatusBar } from 'expo-status-bar';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  Keyboard, TouchableWithoutFeedback, Animated, FlatList,
  KeyboardAvoidingView, Platform, SectionList, Alert,
  ScrollView, PanResponder,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@tracker_transactions';
const BALANCE_KEY = '@tracker_balance';
const { height: SCREEN_HEIGHT } = require('react-native').Dimensions.get('window');

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

function fmtTime(date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtSectionDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

const TABS = ['activity', 'wallet', 'setting'];

export default function App() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('wallet');
  const [modalVisible, setModalVisible] = useState(false);
  const [snapshotVisible, setSnapshotVisible] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [editingBalance, setEditingBalance] = useState(false);
  const [newStartBalance, setNewStartBalance] = useState('');

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const snapshotAnim = useRef(new Animated.Value(0)).current;

  // Swipe gesture
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 20 && Math.abs(g.dy) < 60,
      onPanResponderRelease: (_, g) => {
        if (modalVisible || snapshotVisible) return;
        if (g.dx < -50) {
          setActiveTab(prev => {
            const i = TABS.indexOf(prev);
            return i < TABS.length - 1 ? TABS[i + 1] : prev;
          });
        } else if (g.dx > 50) {
          setActiveTab(prev => {
            const i = TABS.indexOf(prev);
            return i > 0 ? TABS[i - 1] : prev;
          });
        }
      },
    })
  ).current;

  // Load persisted data
  useEffect(() => {
    (async () => {
      try {
        const [txRaw, balRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(BALANCE_KEY),
        ]);
        if (txRaw) {
          const parsed = JSON.parse(txRaw).map(t => ({ ...t, date: new Date(t.date) }));
          setTransactions(parsed);
        }
        if (balRaw !== null) setBalance(parseFloat(balRaw));
      } catch (_) {}
    })();
  }, []);

  const persist = useCallback(async (txs, bal) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
      await AsyncStorage.setItem(BALANCE_KEY, String(bal));
    } catch (_) {}
  }, []);

  // Daily net
  const today = new Date();
  const dailyNet = transactions
    .filter(t => isSameDay(new Date(t.date), today))
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);

  // Weekly net
  const weekAgo = new Date(); weekAgo.setDate(today.getDate() - 7);
  const weeklyNet = transactions
    .filter(t => new Date(t.date) >= weekAgo)
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);

  // Activity sections
  const sections = (() => {
    const groups = {};
    [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!groups[key]) groups[key] = { dateKey: key, date: d, data: [] };
      groups[key].data.push(t);
    });
    return Object.values(groups).sort((a, b) => b.date - a.date);
  })();

  // Modal open/close
  function openModal(type) {
    setActionType(type); setAmount(''); setDescription(''); setModalVisible(true);
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
    };
    const newTxs = [tx, ...transactions];
    const newBal = actionType === 'income' ? balance + val : balance - val;
    setTransactions(newTxs);
    setBalance(newBal);
    persist(newTxs, newBal);
    closeModal();
  }

  // Snapshot open/close
  function openSnapshot() {
    setSnapshotVisible(true);
    Animated.timing(snapshotAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }
  function closeSnapshot() {
    Animated.timing(snapshotAnim, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => setSnapshotVisible(false));
  }

  // Clear all data
  function clearData() {
    Alert.alert('Clear all data', 'This will delete all transactions and reset your balance to zero. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          setTransactions([]); setBalance(0);
          await AsyncStorage.multiRemove([STORAGE_KEY, BALANCE_KEY]);
        }
      },
    ]);
  }

  function saveStartingBalance() {
    const val = parseFloat(newStartBalance);
    if (isNaN(val)) { setEditingBalance(false); return; }
    // Adjust balance by difference
    const diff = val - balance;
    const adjustTx = {
      id: Date.now().toString(),
      type: diff >= 0 ? 'income' : 'expense',
      amount: Math.abs(diff),
      description: 'Balance adjustment',
      date: new Date(),
    };
    const newTxs = [adjustTx, ...transactions];
    setTransactions(newTxs);
    setBalance(val);
    persist(newTxs, val);
    setEditingBalance(false);
    setNewStartBalance('');
  }

  // ── RENDER HELPERS ──────────────────────────────────────────

  function renderTxItem({ item }) {
    const isIncome = item.type === 'income';
    return (
      <View style={styles.txRow}>
        <Text style={styles.txTime}>{fmtTime(new Date(item.date))}</Text>
        <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
        <Text style={[styles.txAmt, { color: isIncome ? '#34A853' : '#E53935' }]}>
          {isIncome ? '+' : '−'} ₹{formatIndian(item.amount)}
        </Text>
      </View>
    );
  }

  function renderSectionHeader({ section }) {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{fmtSectionDate(section.date)}</Text>
      </View>
    );
  }

  // ── SCREENS ────────────────────────────────────────────────

  function WalletScreen() {
    const isProfit = dailyNet >= 0;
    const dailyColor = isProfit ? '#34A853' : '#E53935';
    const dailySign = isProfit ? '+' : '';
    return (
      <>
        {/* Balance — small, secondary, context */}
        <View style={styles.balanceChip}>
          <Text style={styles.balanceChipLabel}>balance  </Text>
          <Text style={styles.balanceChipAmount}>₹ {formatIndian(balance)}</Text>
        </View>

        {/* TODAY — hero, front and centre */}
        <View style={styles.heroSection}>
          <Text style={styles.heroLabel}>today</Text>
          <Text style={[styles.heroAmount, { color: dailyColor }]}>
            {dailySign}₹ {formatIndian(dailyNet)}
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
      </>
    );
  }

  function ActivityScreen() {
    return (
      <View style={{ flex: 1 }}>
        <Text style={styles.screenTitle}>activity</Text>
        {sections.length === 0
          ? <View style={styles.emptyState}><Text style={styles.emptyText}>no transactions yet</Text></View>
          : <SectionList
              sections={sections}
              keyExtractor={item => item.id}
              renderItem={renderTxItem}
              renderSectionHeader={renderSectionHeader}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              stickySectionHeadersEnabled={false}
            />
        }
      </View>
    );
  }

  function SettingsScreen() {
    return (
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <Text style={styles.screenTitle}>setting</Text>

        <Text style={styles.settingGroup}>balance</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>current balance</Text>
          <Text style={styles.settingValue}>₹ {formatIndian(balance)}</Text>
        </View>
        {editingBalance ? (
          <View style={styles.settingEditRow}>
            <TextInput
              style={styles.settingInput}
              value={newStartBalance}
              onChangeText={setNewStartBalance}
              keyboardType="numeric"
              placeholder="enter new amount"
              placeholderTextColor="#ccc"
              autoFocus
            />
            <TouchableOpacity style={styles.settingBtn} onPress={saveStartingBalance}>
              <Text style={styles.settingBtnText}>save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingBalance(false)}>
              <Text style={[styles.settingBtnText, { color: '#bbb', marginLeft: 12 }]}>cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.settingRow} onPress={() => { setNewStartBalance(String(balance)); setEditingBalance(true); }}>
            <Text style={styles.settingLabel}>adjust balance</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.settingGroup, { marginTop: 32 }]}>app</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>currency</Text>
          <Text style={styles.settingValue}>₹ Indian Rupee</Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>transactions</Text>
          <Text style={styles.settingValue}>{transactions.length}</Text>
        </View>

        <Text style={[styles.settingGroup, { marginTop: 32 }]}>data</Text>
        <TouchableOpacity style={styles.settingRow} onPress={clearData}>
          <Text style={[styles.settingLabel, { color: '#e05252' }]}>clear all data</Text>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>

        <Text style={[styles.settingGroup, { marginTop: 32 }]}>about</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>tracker</Text>
          <Text style={styles.settingValue}>v1.0.0</Text>
        </View>
        <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
          <Text style={[styles.settingLabel, { color: '#bbb', fontSize: 13, lineHeight: 20 }]}>
            no clutter, just clarity.{'\n'}track what matters, skip what doesn't.
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ── MAIN RENDER ────────────────────────────────────────────

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        {[['activity', 'activity'], ['wallet', 'Wallet'], ['setting', 'Setting']].map(([key, label]) => (
          <TouchableOpacity key={key} onPress={() => setActiveTab(key)}>
            <Text style={[styles.headerTab, activeTab === key && styles.headerTabActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'wallet' && <WalletScreen />}
      {activeTab === 'activity' && <ActivityScreen />}
      {activeTab === 'setting' && <SettingsScreen />}

      {/* Transaction Modal */}
      {modalVisible && (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.modalOverlay, { opacity: overlayAnim }]}>
            <TouchableWithoutFeedback onPress={closeModal}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
          </Animated.View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoid}>
            <Animated.View style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}>
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
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 28, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 40 },
  headerTab: { fontSize: 16, color: '#b0b0b0', fontWeight: '400', letterSpacing: 0.3 },
  headerTabActive: { color: '#000', fontWeight: '700' },

  // Balance chip — small contextual display at top
  balanceChip: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10, marginBottom: 36 },
  balanceChipLabel: { fontSize: 13, color: '#c0c0c0', fontWeight: '500', letterSpacing: 0.3 },
  balanceChipAmount: { fontSize: 15, color: '#a0a0a0', fontWeight: '600' },

  // Hero section — today is the star
  heroSection: { marginTop: 0 },
  heroLabel: { fontSize: 13, fontWeight: '600', color: '#c0c0c0', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
  heroAmount: { fontSize: 52, fontWeight: '800', letterSpacing: -1.5, lineHeight: 58 },
  heroSub: { fontSize: 15, color: '#c0c0c0', fontWeight: '400', marginTop: 8, letterSpacing: 0.2 },

  fabCluster: { alignItems: 'flex-end', marginBottom: 10 },
  fabSmallTop: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  fabRow: { flexDirection: 'row', gap: 14 },
  fabLarge: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  fabIcon: { fontSize: 34, color: '#fff', fontWeight: '300', lineHeight: 38 },
  fabArrow: { fontSize: 32, color: '#fff', fontWeight: '400', lineHeight: 36 },

  screenTitle: { fontSize: 20, fontWeight: '300', color: '#b0b0b0', marginBottom: 24 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#ccc' },

  sectionHeader: { paddingTop: 24, paddingBottom: 8 },
  sectionHeaderText: { fontSize: 13, fontWeight: '600', color: '#bbb', letterSpacing: 1, textTransform: 'uppercase' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' },
  txTime: { fontSize: 12, color: '#c0c0c0', width: 46, fontWeight: '400' },
  txDesc: { flex: 1, fontSize: 15, fontWeight: '500', color: '#000', marginHorizontal: 10 },
  txAmt: { fontSize: 15, fontWeight: '600' }, // color set inline per type

  settingGroup: { fontSize: 11, fontWeight: '700', color: '#bbb', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4, marginTop: 8 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f2f2f2' },
  settingLabel: { fontSize: 16, color: '#000', fontWeight: '400' },
  settingValue: { fontSize: 15, color: '#bbb', fontWeight: '400' },
  settingArrow: { fontSize: 20, color: '#bbb' },
  settingEditRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  settingInput: { flex: 1, fontSize: 16, color: '#000', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 8, paddingHorizontal: 0 },
  settingBtn: { marginLeft: 16, backgroundColor: '#000', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },
  settingBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  keyboardAvoid: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 50, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 20 },
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

  snapshotOverlay: { backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  snapshotCard: { backgroundColor: '#fff', borderRadius: 28, padding: 32, width: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 24 },
  snapshotTitle: { fontSize: 14, fontWeight: '600', color: '#bbb', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 28 },
  snapshotRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  snapshotLabel: { fontSize: 16, color: '#888', fontWeight: '400' },
  snapshotValue: { fontSize: 18, fontWeight: '700', color: '#000' },
  snapshotDivider: { height: 1, backgroundColor: '#f2f2f2', marginVertical: 8 },
  snapshotHint: { fontSize: 12, color: '#d0d0d0', textAlign: 'center', marginTop: 24 },
});
