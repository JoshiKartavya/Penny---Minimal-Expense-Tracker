import { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, Alert, Modal, FlatList, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import Header from '../components/Header';

const STORAGE_KEY = '@tracker_transactions';
const BALANCE_KEY = '@tracker_balance';
export const CURRENCY_KEY = '@tracker_currency';

export const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
];

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

export default function SettingsScreen() {
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  
  // Custom Modal State for Clearing Data
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);
  
  // Custom Toast State
  const [toastMessage, setToastMessage] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const [user, setUser] = useState(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const getStorageKey = (u) => u ? `@tracker_transactions_${u.uid}` : '@tracker_transactions_local';
  const getBalanceKey = (u) => u ? `@tracker_balance_${u.uid}` : '@tracker_balance_local';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [currRaw] = await Promise.all([
          AsyncStorage.getItem(CURRENCY_KEY),
        ]);
        if (currRaw) {
          const found = CURRENCIES.find(c => c.code === currRaw);
          if (found) setCurrency(found);
        }
      } catch (_) {}
    })();
  }, [user]);

  async function selectCurrency(c) {
    setCurrency(c);
    setCurrencyModalVisible(false);
    await AsyncStorage.setItem(CURRENCY_KEY, c.code);
  }

  function promptClearData() {
    setClearModalVisible(true);
  }

  function showToast(message) {
    setToastMessage(message);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastMessage(''));
  }

  async function executeClearData() {
    const txKey = getStorageKey(user);
    const balKey = getBalanceKey(user);
    await AsyncStorage.multiRemove([txKey, balKey]);
    setClearModalVisible(false);
    showToast('All data has been cleared.');
  }

  function handleSignOut() {
    setSignOutModalVisible(true);
  }

  async function executeSignOut() {
    setSignOutModalVisible(false);
    await signOut(auth);
    router.replace('/login');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Header />
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <Text style={styles.screenTitle}>setting</Text>

        {/* AUTH */}
        <Text style={styles.settingGroup}>account</Text>
        {!user ? (
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/login')}>
            <Text style={styles.settingLabel}>log in to connect</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>logged in as</Text>
              <Text style={styles.settingSubValue}>{user.displayName || user.email}</Text>
            </View>
            <TouchableOpacity style={styles.signOutListBtn} onPress={handleSignOut}>
              <Text style={styles.signOutListBtnText}>sign out</Text>
            </TouchableOpacity>
          </>
        )}



        {/* CURRENCY */}
        <Text style={[styles.settingGroup, { marginTop: 32 }]}>preferences</Text>
        <TouchableOpacity style={styles.settingRow} onPress={() => setCurrencyModalVisible(true)}>
          <View>
            <Text style={styles.settingLabel}>currency</Text>
            <Text style={styles.settingSubValue}>{currency.name}</Text>
          </View>
          <View style={styles.currencyRight}>
            <Text style={styles.currencySymbolBadge}>{currency.symbol}</Text>
            <Text style={styles.settingArrow}>›</Text>
          </View>
        </TouchableOpacity>

        {/* APP INFO */}
        <Text style={[styles.settingGroup, { marginTop: 32 }]}>app</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>version</Text>
          <Text style={styles.settingValue}>2.0.0</Text>
        </View>

        {/* DATA */}
        <Text style={[styles.settingGroup, { marginTop: 32 }]}>data</Text>
        <TouchableOpacity style={styles.dangerBtn} onPress={promptClearData} activeOpacity={0.8}>
          <Text style={styles.dangerBtnText}>clear all data</Text>
        </TouchableOpacity>

        {/* ABOUT */}
        <Text style={[styles.settingGroup, { marginTop: 32 }]}>about</Text>
        <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
          <Text style={[styles.settingLabel, { color: '#bbb', fontSize: 13, lineHeight: 22 }]}>
            no clutter, just clarity.{'\n'}track what matters, skip what doesn't.
          </Text>
        </View>
      </ScrollView>

      {/* Currency picker modal */}
      <Modal
        visible={currencyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>choose currency</Text>
            <TouchableOpacity onPress={() => setCurrencyModalVisible(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>done</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalHandle} />
          <FlatList
            data={CURRENCIES}
            keyExtractor={item => item.code}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = item.code === currency.code;
              return (
                <TouchableOpacity
                  style={[styles.currencyRow, isSelected && styles.currencyRowSelected]}
                  onPress={() => selectCurrency(item)}
                  activeOpacity={0.6}
                >
                  <View style={styles.currencyRowLeft}>
                    <Text style={styles.currencyCode}>{item.code}</Text>
                    <Text style={styles.currencyName}>{item.name}</Text>
                  </View>
                  <View style={styles.currencyRowRight}>
                    <Text style={styles.currencySymbol}>{item.symbol}</Text>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
      {/* Clear Data Confirmation Modal */}
      <Modal
        visible={clearModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setClearModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Clear all data?</Text>
            <Text style={styles.alertText}>
              Are you sure? This will permanently delete all your transactions and reset your balance to zero.
            </Text>

            <View style={styles.alertActions}>
              <TouchableOpacity 
                style={styles.alertCancelBtn} 
                onPress={() => setClearModalVisible(false)}
              >
                <Text style={styles.alertCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.alertConfirmBtn} 
                onPress={executeClearData}
              >
                <Text style={styles.alertConfirmText}>Yes, Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={signOutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSignOutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Sign Out</Text>
            <Text style={styles.alertText}>
              Are you sure you want to sign out of your account?
            </Text>

            <View style={styles.signOutActions}>
              <TouchableOpacity 
                style={styles.signOutBtn} 
                onPress={executeSignOut}
              >
                <Text style={styles.signOutBtnText}>Sign Out</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.signOutCancelBtn} 
                onPress={() => setSignOutModalVisible(false)}
              >
                <Text style={styles.signOutCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Toast */}
      {!!toastMessage && (
        <Animated.View style={[styles.toastContainer, { opacity: toastOpacity, bottom: insets.bottom + 40 }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfcfc' },
  content: { flex: 1, paddingHorizontal: 28 },
  screenTitle: { fontSize: 18, fontWeight: '300', color: '#b0b0b0', marginBottom: 24 },

  settingGroup: { fontSize: 10, fontWeight: '700', color: '#bbb', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4, marginTop: 8 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f2f2f2' },
  settingLabel: { fontSize: 15, color: '#000', fontWeight: '400' },
  settingSubValue: { fontSize: 13, color: '#888', fontWeight: '500', marginTop: 4 },
  settingValue: { fontSize: 14, color: '#bbb', fontWeight: '400' },
  settingArrow: { fontSize: 20, color: '#ccc', paddingLeft: 10 },
  currencyRight: { flexDirection: 'row', alignItems: 'center' },
  currencySymbolBadge: { backgroundColor: '#f0f0f0', color: '#000', fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },

  signOutListBtn: { backgroundColor: '#C56A67', paddingVertical: 10, paddingHorizontal: 28, borderRadius: 16, alignSelf: 'flex-start', marginTop: 16 },
  signOutListBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Danger Button
  dangerBtn: { backgroundColor: '#C56A67', paddingVertical: 14, borderRadius: 20, alignItems: 'center', marginTop: 12 },
  dangerBtnText: { color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },

  // Currency modal
  modalContainer: { flex: 1, backgroundColor: '#fff', paddingTop: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#000' },
  modalClose: { padding: 4 },
  modalCloseText: { fontSize: 15, color: '#000', fontWeight: '500' },

  currencyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f5f5f5' },
  currencyRowSelected: { backgroundColor: '#fafafa' },
  currencyRowLeft: { flex: 1 },
  currencyCode: { fontSize: 14, fontWeight: '600', color: '#000' },
  currencyName: { fontSize: 12, color: '#888', marginTop: 2 },
  currencyRowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  currencySymbol: { fontSize: 16, fontWeight: '500', color: '#555' },
  checkmark: { fontSize: 14, color: '#000', fontWeight: '700' },

  // Alert Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  alertBox: { backgroundColor: '#fff', width: '100%', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 24 },
  alertTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 12, textAlign: 'center' },
  alertText: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 10 },
  alertActions: { width: '100%', gap: 12 },
  alertConfirmBtn: { backgroundColor: '#C56A67', paddingVertical: 14, borderRadius: 12, alignItems: 'center', width: '100%' },
  alertConfirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  alertCancelBtn: { paddingVertical: 12, alignItems: 'center', width: '100%' },
  alertCancelText: { color: '#888', fontSize: 15, fontWeight: '500' },

  // Toast
  toastContainer: { position: 'absolute', alignSelf: 'center', backgroundColor: '#333', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  
  signOutActions: { width: '100%', gap: 12 },
  signOutBtn: { width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: '#C56A67', alignItems: 'center' },
  signOutBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  signOutCancelBtn: { width: '100%', paddingVertical: 12, borderRadius: 12, backgroundColor: '#f0f0f0', alignItems: 'center' },
  signOutCancelText: { fontSize: 15, fontWeight: '600', color: '#000' },
});
