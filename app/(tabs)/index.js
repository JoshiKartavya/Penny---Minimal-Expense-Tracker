import { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  Keyboard, TouchableWithoutFeedback, Animated,
  KeyboardAvoidingView, Platform, Dimensions, Alert, ScrollView, Modal,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, where, writeBatch, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { useAppContext } from '../AppContext';

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
  const [presets, setPresets] = useState([]);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [snapshotVisible, setSnapshotVisible] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const insets = useSafeAreaInsets();
  const { colors } = useAppContext();
  const styles = createStyles(colors);
  
  // Success Toast State
  const [successVisible, setSuccessVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  function showSuccess(msg) {
    setSuccessMessage(msg);
    setSuccessVisible(true);
    setTimeout(() => setSuccessVisible(false), 2000);
  }

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const snapshotAnim = useRef(new Animated.Value(0)).current;

  // Report Modal States
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportDuration, setReportDuration] = useState(7);
  const reportAnim = useRef(new Animated.Value(0)).current;
  const reportSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Preset Modal State
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [presetType, setPresetType] = useState('expense');
  const [presetAmount, setPresetAmount] = useState('');
  const [presetDesc, setPresetDesc] = useState('');
  const [presetMethod, setPresetMethod] = useState('cash');
  const presetSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const presetOverlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // --- AUTO-MIGRATION LOGIC ---
        try {
          const localTxsRaw = await AsyncStorage.getItem(`@tracker_transactions_${currentUser.uid}`);
          if (localTxsRaw) {
            const localTxs = JSON.parse(localTxsRaw);
            if (localTxs.length > 0) {
              const batch = writeBatch(db);
              localTxs.forEach(tx => {
                const docRef = doc(db, 'wallet_transactions', tx.id);
                // Convert dates to timestamps for consistent cloud storage
                batch.set(docRef, { ...tx, user_email: currentUser.email.toLowerCase(), date: new Date(tx.date).getTime() });
              });
              await batch.commit();
              // Clear local cache once safely in cloud
              await AsyncStorage.removeItem(`@tracker_transactions_${currentUser.uid}`);
              await AsyncStorage.removeItem(`@tracker_balance_${currentUser.uid}`);
            }
          }
        } catch (e) {
          console.log('Migration error:', e);
        }

        // --- REAL-TIME CLOUD LISTENER ---
        const q = query(
          collection(db, 'wallet_transactions'),
          where('user_email', '==', currentUser.email.toLowerCase())
        );
        
        const unsubTxs = onSnapshot(q, (snapshot) => {
          const txs = snapshot.docs.map(d => ({ ...d.data(), id: d.id, date: new Date(d.data().date) }));
          // Sort by date descending
          txs.sort((a, b) => b.date - a.date);
          setTransactions(txs);
          
          // Calculate balance dynamically
          const bal = txs.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
          setBalance(bal);
        });

        // PRESETS LISTENER
        const presetsQ = query(collection(db, 'presets'), where('user_email', '==', currentUser.email.toLowerCase()));
        const unsubPresets = onSnapshot(presetsQ, (snapshot) => {
          setPresets(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
        });
        
        return () => { unsubTxs(); unsubPresets(); };
      } else {
        setTransactions([]);
        setPresets([]);
        setBalance(0);
      }
    });
    return unsubscribe;
  }, []);

  const today = new Date();
  const dailyNet = transactions
    .filter(t => isSameDay(new Date(t.date), today))
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);

  const weekAgo = new Date(); weekAgo.setDate(today.getDate() - 7);
  const weeklyNet = transactions
    .filter(t => new Date(t.date) >= weekAgo)
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);

  function openModal(type) {
    setActionType(type); setAmount(''); setDescription(''); setMethod(null); setSelectedDate(new Date()); setModalVisible(true);
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

  async function logPreset(preset) {
    if (!user) return;
    try {
      const tx = {
        user_email: user.email.toLowerCase(),
        type: preset.type,
        amount: preset.amount,
        description: preset.description,
        date: new Date().getTime(),
        method: preset.method || 'cash',
      };
      await setDoc(doc(collection(db, 'wallet_transactions')), tx);
      showSuccess(`Logged ₹${preset.amount}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to log preset');
    }
  }

  function confirmDeletePreset(preset) {
    Alert.alert('Delete Preset', `Are you sure you want to remove "${preset.description}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDoc(doc(db, 'presets', preset.id)) }
    ]);
  }

  async function handleSave() {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    
    if (!method) {
      Alert.alert('Selection Required', 'Please select either Online or Cash');
      return;
    }
    
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save transactions.');
      return;
    }

    const tx = {
      user_email: user.email.toLowerCase(),
      type: actionType,
      amount: val,
      description: description.trim() || (actionType === 'income' ? 'Income' : 'Expense'),
      date: selectedDate.getTime(),
      method: method,
    };
    
    try {
      const docRef = doc(collection(db, 'wallet_transactions'));
      await setDoc(docRef, tx);
      closeModal();
    } catch (error) {
      Alert.alert('Error', 'Could not save transaction to cloud.');
    }
  }

  function openPresetModal() {
    setPresetType('expense'); setPresetAmount(''); setPresetDesc(''); setPresetMethod('cash');
    setPresetModalVisible(true);
    Animated.parallel([
      Animated.spring(presetSlideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      Animated.timing(presetOverlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }

  function closePresetModal() {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(presetSlideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }),
      Animated.timing(presetOverlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setPresetModalVisible(false));
  }

  async function handleSavePreset() {
    if (!presetAmount || !presetDesc) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    const val = parseFloat(presetAmount);
    if (isNaN(val) || val <= 0) return;

    try {
      await setDoc(doc(collection(db, 'presets')), {
        user_email: user.email.toLowerCase(),
        type: presetType,
        amount: val,
        description: presetDesc.trim(),
        method: presetMethod,
        createdAt: new Date().getTime()
      });
      closePresetModal();
    } catch(e) {
      Alert.alert('Error', e.message);
    }
  }

  function openSnapshot() {
    setSnapshotVisible(true);
    Animated.timing(snapshotAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }
  function closeSnapshot() {
    Animated.timing(snapshotAnim, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => setSnapshotVisible(false));
  }

  function openReportModal() {
    closeSnapshot();
    setTimeout(() => {
      setReportModalVisible(true);
      Animated.parallel([
        Animated.timing(reportAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(reportSlideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true })
      ]).start();
    }, 200);
  }

  function closeReportModal() {
    Animated.parallel([
      Animated.timing(reportAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(reportSlideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true })
    ]).start(() => setReportModalVisible(false));
  }

  const generatePDF = async (days) => {
    try {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - days);

      const filtered = transactions.filter(t => new Date(t.date) >= pastDate);
      
      const tableRows = filtered.map(t => {
        const d = new Date(t.date);
        const dateStr = d.toLocaleDateString();
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
        <tr>
          <td>${dateStr} <span style="color: #bbb; font-size: 12px; margin-left: 6px;">${timeStr}</span></td>
          <td>${t.description}</td>
          <td style="color: ${t.type === 'income' ? '#6A9C78' : '#C56A67'};">${t.type === 'income' ? '+' : '-'}₹${formatIndian(t.amount)}</td>
          <td>${t.method || 'online'}</td>
        </tr>
      `}).join('');

      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; }
              h1 { color: #000; text-align: center; margin-bottom: 5px; }
              p { color: #888; text-align: center; margin-top: 0; margin-bottom: 30px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border-bottom: 1px solid #eee; padding: 14px 8px; text-align: left; font-size: 14px; }
              th { background-color: #fafafa; color: #888; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
              .total { margin-top: 30px; font-size: 20px; font-weight: bold; text-align: right; color: #000; }
            </style>
          </head>
          <body>
            <h1>Penny Statement</h1>
            <p>Past ${days} Days</p>
            <table>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Method</th>
              </tr>
              ${tableRows}
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      
      const safeName = user && user.email ? user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') : 'User';
      const durationLabel = days === 7 ? '1Week' : days === 14 ? '2Weeks' : '1Month';
      const newUri = `${FileSystem.documentDirectory}Penny_${safeName}_${durationLabel}.pdf`;
      
      await FileSystem.moveAsync({
        from: uri,
        to: newUri
      });

      await Sharing.shareAsync(newUri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: `Penny Report - ${durationLabel}` });
      closeReportModal();
    } catch (error) {
      Alert.alert('Error', 'Failed to generate PDF');
    }
  };

  const isProfit = dailyNet >= 0;
  // Soft colors applied here
  const dailyColor = isProfit ? colors.successLight : colors.danger;
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

      <View style={styles.presetsContainer}>
        <Text style={styles.presetsLabel}>QUICK LOG</Text>
        {presets.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
            {presets.map(p => (
              <TouchableOpacity
                key={p.id}
                style={styles.presetCard}
                onPress={() => logPreset(p)}
                onLongPress={() => confirmDeletePreset(p)}
                delayLongPress={400}
                activeOpacity={0.7}
              >
                <View style={[styles.presetIcon, p.type === 'income' ? styles.presetIconIncome : styles.presetIconExpense]}>
                  <Text style={[styles.presetIconText, p.type === 'income' ? styles.presetIconTextIncome : styles.presetIconTextExpense]}>
                    {p.type === 'income' ? '+' : '−'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.presetTitle}>{p.description}</Text>
                  <Text style={styles.presetAmount}>₹{p.amount}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.presetAddBtn} onPress={() => openPresetModal()} activeOpacity={0.7}>
              <Text style={styles.presetAddIcon}>+</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <TouchableOpacity style={styles.presetAddBtnEmpty} onPress={() => openPresetModal()} activeOpacity={0.7}>
            <Text style={styles.presetAddIconEmpty}>+</Text>
            <Text style={styles.presetAddText}>Create Preset</Text>
          </TouchableOpacity>
        )}
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
                      placeholderTextColor={colors.textPlaceholder}
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
                  <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickerBtn}>
                    <Text style={styles.datePickerText}>
                      🗓️ {isSameDay(selectedDate, new Date()) ? 'Today' : selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, {selectedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.descInput}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="what was it for?"
                    placeholderTextColor={colors.textMuted}
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

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode={Platform.OS === 'ios' ? 'datetime' : 'date'}
              display="default"
              onChange={(event, date) => {
                if (Platform.OS === 'android') {
                  setShowDatePicker(false);
                  if (date && event.type === 'set') {
                    const newDate = new Date(selectedDate);
                    newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                    setSelectedDate(newDate);
                    setShowTimePicker(true);
                  }
                } else {
                  if (date) setSelectedDate(date);
                }
              }}
            />
          )}
          {showTimePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={selectedDate}
              mode="time"
              display="default"
              onChange={(event, date) => {
                setShowTimePicker(false);
                if (date && event.type === 'set') {
                  const newDate = new Date(selectedDate);
                  newDate.setHours(date.getHours(), date.getMinutes(), date.getSeconds());
                  setSelectedDate(newDate);
                }
              }}
            />
          )}

        </View>
      )}

      {/* Preset Creation Modal */}
      {presetModalVisible && (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.modalOverlay, { opacity: presetOverlayAnim }]}>
            <TouchableWithoutFeedback onPress={closePresetModal}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
          </Animated.View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24} style={styles.keyboardAvoid}>
            <Animated.View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 20, 80), transform: [{ translateY: presetSlideAnim }] }]}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHandle} />
                  <Text style={styles.modalTitle}>create preset</Text>
                  
                  <View style={styles.methodToggle}>
                    <TouchableOpacity style={[styles.methodBtn, presetType === 'expense' && styles.methodBtnActive]} onPress={() => setPresetType('expense')}>
                      <Text style={[styles.methodText, presetType === 'expense' && styles.methodTextActive]}>Expense</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.methodBtn, presetType === 'income' && styles.methodBtnActive]} onPress={() => setPresetType('income')}>
                      <Text style={[styles.methodText, presetType === 'income' && styles.methodTextActive]}>Income</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputPrefix}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={presetAmount}
                      onChangeText={setPresetAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={colors.textPlaceholder}
                    />
                  </View>
                  
                  <View style={styles.methodToggle}>
                    <TouchableOpacity style={[styles.methodBtn, presetMethod === 'online' && styles.methodBtnActive]} onPress={() => setPresetMethod('online')}>
                      <Text style={[styles.methodText, presetMethod === 'online' && styles.methodTextActive]}>Online</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.methodBtn, presetMethod === 'cash' && styles.methodBtnActive]} onPress={() => setPresetMethod('cash')}>
                      <Text style={[styles.methodText, presetMethod === 'cash' && styles.methodTextActive]}>Cash</Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.descInput}
                    value={presetDesc}
                    onChangeText={setPresetDesc}
                    placeholder="preset name (e.g. Tea & Chips)"
                    placeholderTextColor={colors.textMuted}
                    maxLength={30}
                    returnKeyType="done"
                    onSubmitEditing={handleSavePreset}
                  />

                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={closePresetModal}>
                      <Text style={styles.cancelText}>cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, (!presetAmount || !presetDesc) && styles.saveBtnDisabled]}
                      onPress={handleSavePreset}
                      disabled={!presetAmount || !presetDesc}
                    >
                      <Text style={styles.saveText}>save preset</Text>
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
            <View style={styles.snapshotTitleRow}>
              <Text style={styles.snapshotTitle}>how am i doing?</Text>
              <TouchableOpacity onPress={openReportModal} style={styles.pdfBtn}>
                <Text style={styles.pdfIcon}>📄</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotLabel}>total balance</Text>
              <Text style={styles.snapshotValue}>₹ {formatIndian(balance)}</Text>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotLabel}>today</Text>
              <Text style={[styles.snapshotValue, { color: dailyNet >= 0 ? colors.text : colors.textSecondary }]}>
                {dailyNet >= 0 ? '+' : ''}₹ {formatIndian(dailyNet)}
              </Text>
            </View>
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotLabel}>this week</Text>
              <Text style={[styles.snapshotValue, { color: weeklyNet >= 0 ? colors.text : colors.textSecondary }]}>
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

      {/* Report PDF Modal */}
      {reportModalVisible && (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.modalOverlay, { opacity: reportAnim }]}>
            <TouchableWithoutFeedback onPress={closeReportModal}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
          </Animated.View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24} style={styles.keyboardAvoid}>
            <Animated.View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 20, 40), transform: [{ translateY: reportSlideAnim }] }]}>
              <View style={styles.modalContent}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>download report</Text>
                
                <Text style={styles.reportLabel}>SELECT DURATION</Text>
                <View style={styles.reportOptions}>
                  {[
                    { label: '1 Week', value: 7 },
                    { label: '2 Weeks', value: 14 },
                    { label: '1 Month', value: 30 }
                  ].map(opt => (
                    <TouchableOpacity 
                      key={opt.value} 
                      style={[styles.reportOptionBtn, reportDuration === opt.value && styles.reportOptionBtnActive]}
                      onPress={() => setReportDuration(opt.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.reportOptionText, reportDuration === opt.value && styles.reportOptionTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.downloadBtn} onPress={() => generatePDF(reportDuration)} activeOpacity={0.8}>
                  <Text style={styles.downloadText}>Download PDF</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      )}
      {/* Success Toast Modal */}
      <Modal visible={successVisible} animationType="fade" transparent>
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successIconWrapper}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successModalTitle}>{successMessage}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: 28, paddingBottom: 120 },
  balanceChip: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10, marginBottom: 8 },
  balanceChipLabel: { fontSize: 12, color: colors.textPlaceholder, fontWeight: '500', letterSpacing: 0.3 },
  balanceChipAmount: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  subBalanceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 36 },
  balanceSubLabel: { fontSize: 10, color: colors.textPlaceholder, fontWeight: '600', letterSpacing: 0.5 },
  balanceSubAmount: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  heroSection: { marginTop: 0 },
  heroLabel: { fontSize: 12, fontWeight: '600', color: colors.textPlaceholder, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
  heroAmount: { fontSize: 46, fontWeight: '800', letterSpacing: -1.5, lineHeight: 52 },
  heroSub: { fontSize: 14, color: colors.textPlaceholder, fontWeight: '400', marginTop: 8, letterSpacing: 0.2 },
  fabCluster: { alignItems: 'flex-end', marginBottom: 10 },
  fabSmallTop: { width: 74, height: 74, borderRadius: 37, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  fabRow: { flexDirection: 'row', gap: 14 },
  fabLarge: { width: 82, height: 82, borderRadius: 41, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  fabIcon: { fontSize: 34, color: colors.primaryText, fontWeight: '300', lineHeight: 38 },
  fabArrow: { fontSize: 32, color: colors.primaryText, fontWeight: '400', lineHeight: 36 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlayDark },
  keyboardAvoid: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 20 },
  modalContent: { paddingHorizontal: 28, paddingTop: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '300', color: colors.textMuted, marginBottom: 30 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  inputPrefix: { fontSize: 36, fontWeight: '700', color: colors.text, marginRight: 8 },
  amountInput: { flex: 1, fontSize: 36, fontWeight: '700', color: colors.text, padding: 0 },
  descInput: { fontSize: 16, color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 12, marginBottom: 32 },
  datePickerBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: colors.iconPlaceholder, borderRadius: 20, marginBottom: 16 },
  datePickerText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelBtn: { paddingVertical: 14, paddingHorizontal: 24 },
  cancelText: { fontSize: 16, color: colors.textMuted },
  saveBtn: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30 },
  saveBtnDisabled: { backgroundColor: colors.border },
  saveText: { fontSize: 16, color: colors.primaryText, fontWeight: '600' },
  
  methodToggle: { flexDirection: 'row', backgroundColor: colors.iconPlaceholder, borderRadius: 20, padding: 4, marginBottom: 16 },
  methodBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 16 },
  methodBtnActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  methodText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  methodTextActive: { color: colors.text },
  snapshotOverlay: { backgroundColor: colors.overlayDark, alignItems: 'center', justifyContent: 'center' },
  snapshotCard: { backgroundColor: colors.card, borderRadius: 28, padding: 32, width: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 24 },
  snapshotTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  snapshotTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' },
  pdfBtn: { padding: 4 },
  pdfIcon: { fontSize: 20 },
  snapshotRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  snapshotLabel: { fontSize: 15, color: colors.textSecondary, fontWeight: '400' },
  snapshotValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  snapshotDivider: { height: 1, backgroundColor: colors.borderSecondary, marginVertical: 8 },
  snapshotHint: { fontSize: 11, color: colors.textPlaceholder, textAlign: 'center', marginTop: 24 },
  reportLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: 16 },
  reportOptions: { flexDirection: 'column', gap: 12, marginBottom: 32 },
  reportOptionBtn: { paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  reportOptionBtnActive: { backgroundColor: colors.successLight + '20', borderColor: colors.successLight },
  reportOptionText: { fontSize: 16, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' },
  reportOptionTextActive: { color: colors.successLight, fontWeight: '700' },
  downloadBtn: { backgroundColor: colors.successLight, paddingVertical: 18, borderRadius: 30, alignItems: 'center' },
  downloadText: { color: colors.primaryText, fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },

  // Preset Styles
  // Preset Styles
  presetsContainer: { marginTop: 40 },
  presetsLabel: { fontSize: 11, fontWeight: '700', color: colors.textPlaceholder, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 16 },
  presetCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 24, backgroundColor: colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, marginRight: 12, minWidth: 140 },
  presetIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  presetIconIncome: { backgroundColor: colors.successLight + '20' },
  presetIconExpense: { backgroundColor: colors.danger + '20' },
  presetIconText: { fontSize: 20, fontWeight: '400', marginTop: -2 },
  presetIconTextIncome: { color: colors.successLight },
  presetIconTextExpense: { color: colors.danger },
  presetTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  presetAmount: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  presetAddBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.iconPlaceholder, alignItems: 'center', justifyContent: 'center' },
  presetAddIcon: { fontSize: 28, color: colors.textSecondary, fontWeight: '300' },
  presetAddBtnEmpty: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 24, backgroundColor: colors.iconPlaceholder, alignSelf: 'flex-start' },
  presetAddIconEmpty: { fontSize: 20, color: colors.textSecondary, fontWeight: '300', marginRight: 8, marginTop: -2 },
  presetAddText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  // Success Toast Styles
  successModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0)', justifyContent: 'flex-start', alignItems: 'center', paddingTop: 60 },
  successModalCard: { backgroundColor: colors.successLight, borderRadius: 30, paddingVertical: 12, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 10 },
  successIconWrapper: { marginRight: 8 },
  successIconText: { fontSize: 16, color: '#fff', fontWeight: '800' },
  successModalTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  successModalText: { display: 'none' },
});
