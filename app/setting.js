import { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, View, TouchableOpacity,
  ScrollView, Alert, Modal, FlatList, Animated,
} from 'react-native';
import Text from '../components/AppText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import Header from '../components/Header';
import { useAppContext } from './AppContext';

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
  const { language, changeLanguage, fontScale, changeFontScale, themeOverride, changeTheme, t, colors, isDark } = useAppContext();
  const styles = createStyles(colors, isDark);
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  
  // Custom Modal State for Clearing Data
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


  function showToast(message) {
    setToastMessage(message);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastMessage(''));
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
        <Text style={styles.screenTitle}>{t('setting')}</Text>

        {/* AUTH */}
        <Text style={styles.settingGroup}>{t('account')}</Text>
        {!user ? (
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/login')}>
            <Text style={styles.settingLabel}>{t('log_in_to_connect')}</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>{t('logged_in_as')}</Text>
              <Text style={styles.settingSubValue}>{user.displayName || user.email}</Text>
            </View>
            <TouchableOpacity style={styles.signOutListBtn} onPress={handleSignOut}>
              <Text style={styles.signOutListBtnText}>{t('sign_out')}</Text>
            </TouchableOpacity>
          </>
        )}



        {/* PREFERENCES */}
        <Text style={[styles.settingGroup, { marginTop: 32 }]}>{t('preferences')}</Text>
        <TouchableOpacity style={styles.settingRow} onPress={() => setCurrencyModalVisible(true)}>
          <View>
            <Text style={styles.settingLabel}>{t('currency')}</Text>
            <Text style={styles.settingSubValue}>{currency.name}</Text>
          </View>
          <View style={styles.currencyRight}>
            <Text style={styles.currencySymbolBadge}>{currency.symbol}</Text>
            <Text style={styles.settingArrow}>›</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingRow} onPress={() => setLangModalVisible(true)}>
          <View>
            <Text style={styles.settingLabel}>{t('language')}</Text>
            <Text style={styles.settingSubValue}>{language.toUpperCase()}</Text>
          </View>
          <View style={styles.currencyRight}>
            <Text style={styles.settingArrow}>›</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow} onPress={() => setThemeModalVisible(true)}>
          <View>
            <Text style={styles.settingLabel}>{t('theme') || 'Theme'}</Text>
            <Text style={styles.settingSubValue}>
              {themeOverride === 'system' ? (t('system_default') || 'System Default') : themeOverride === 'dark' ? (t('dark_mode') || 'Dark') : (t('light_mode') || 'Light')}
            </Text>
          </View>
          <View style={styles.currencyRight}>
            <Text style={styles.settingArrow}>›</Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.settingRow, { flexDirection: 'column', alignItems: 'flex-start', borderBottomWidth: 0 }]}>
          <Text style={styles.settingLabel}>{t('font_size')}</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            {[ {label: t('small'), scale: 1.0}, {label: t('medium'), scale: 1.2}, {label: t('large'), scale: 1.4} ].map(item => (
              <TouchableOpacity 
                key={item.label}
                style={[styles.fontBtn, fontScale === item.scale && styles.fontBtnActive]} 
                onPress={() => changeFontScale(item.scale)}
              >
                <Text style={[styles.fontBtnText, fontScale === item.scale && styles.fontBtnTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>


        {/* ABOUT & HELP */}
        <Text style={[styles.settingGroup, { marginTop: 32 }]}>{t('about')}</Text>
        <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/help')}>
          <View>
            <Text style={styles.settingLabel}>{t('help_center') || 'Help Center'}</Text>
            <Text style={styles.settingSubValue}>FAQ & Support</Text>
          </View>
          <View style={styles.currencyRight}>
            <Text style={styles.settingArrow}>›</Text>
          </View>
        </TouchableOpacity>
        <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
          <Text style={[styles.settingLabel, { color: '#bbb', fontSize: 13, lineHeight: 22 }]}>
            {t('about_text')}
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
            <Text style={styles.modalTitle}>{t('choose_currency')}</Text>
            <TouchableOpacity onPress={() => setCurrencyModalVisible(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>{t('done')}</Text>
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
      {/* Language picker modal */}
      <Modal
        visible={langModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('choose_language')}</Text>
            <TouchableOpacity onPress={() => setLangModalVisible(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>{t('done')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalHandle} />
          <FlatList
            data={[{code: 'en', name: 'English'}, {code: 'hi', name: 'हिंदी'}, {code: 'gu', name: 'ગુજરાતી'}, {code: 'es', name: 'Español'}]}
            keyExtractor={item => item.code}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = item.code === language;
              return (
                <TouchableOpacity
                  style={[styles.currencyRow, isSelected && styles.currencyRowSelected]}
                  onPress={() => { changeLanguage(item.code); setLangModalVisible(false); }}
                  activeOpacity={0.6}
                >
                  <View style={styles.currencyRowLeft}>
                    <Text style={styles.currencyName}>{item.name}</Text>
                  </View>
                  <View style={styles.currencyRowRight}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>

      {/* Theme picker modal */}
      <Modal
        visible={themeModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('theme') || 'Theme'}</Text>
            <TouchableOpacity onPress={() => setThemeModalVisible(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>{t('done')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalHandle} />
          <FlatList
            data={[
              {code: 'system', name: t('system_default') || 'System Default'}, 
              {code: 'light', name: t('light_mode') || 'Light'}, 
              {code: 'dark', name: t('dark_mode') || 'Dark'}
            ]}
            keyExtractor={item => item.code}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = item.code === themeOverride;
              return (
                <TouchableOpacity
                  style={[styles.currencyRow, isSelected && styles.currencyRowSelected]}
                  onPress={() => { changeTheme(item.code); setThemeModalVisible(false); }}
                  activeOpacity={0.6}
                >
                  <View style={styles.currencyRowLeft}>
                    <Text style={styles.currencyName}>{item.name}</Text>
                  </View>
                  <View style={styles.currencyRowRight}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
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
            <Text style={styles.alertTitle}>{t('sign_out')}</Text>
            <Text style={styles.alertText}>
              Are you sure you want to sign out of your account?
            </Text>

            <View style={styles.signOutActions}>
              <TouchableOpacity 
                style={styles.signOutBtn} 
                onPress={executeSignOut}
              >
                <Text style={styles.signOutBtnText}>{t('sign_out')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.signOutCancelBtn} 
                onPress={() => setSignOutModalVisible(false)}
              >
                <Text style={styles.signOutCancelText}>{t('cancel')}</Text>
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

const createStyles = (colors, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: 28 },
  screenTitle: { fontSize: 18, fontWeight: '300', color: colors.textMuted, marginBottom: 24 },

  settingGroup: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4, marginTop: 8 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSecondary },
  settingLabel: { fontSize: 15, color: colors.text, fontWeight: '400' },
  settingSubValue: { fontSize: 13, color: colors.textSecondary, fontWeight: '500', marginTop: 4 },
  settingValue: { fontSize: 14, color: colors.textMuted, fontWeight: '400' },
  settingArrow: { fontSize: 20, color: colors.textPlaceholder, paddingLeft: 10 },
  currencyRight: { flexDirection: 'row', alignItems: 'center' },
  currencySymbolBadge: { backgroundColor: colors.iconPlaceholder, color: colors.text, fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },

  fontBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.borderSecondary },
  fontBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  fontBtnText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  fontBtnTextActive: { color: colors.primaryText },

  signOutListBtn: { backgroundColor: colors.danger, paddingVertical: 10, paddingHorizontal: 28, borderRadius: 16, alignSelf: 'flex-start', marginTop: 16 },
  signOutListBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Danger Button
  dangerBtn: { backgroundColor: colors.danger, paddingVertical: 14, borderRadius: 20, alignItems: 'center', marginTop: 12 },
  dangerBtnText: { color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },

  // Currency modal
  modalContainer: { flex: 1, backgroundColor: colors.background, paddingTop: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderSecondary, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  modalClose: { padding: 4 },
  modalCloseText: { fontSize: 15, color: colors.text, fontWeight: '500' },

  currencyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSecondary },
  currencyRowSelected: { backgroundColor: colors.iconPlaceholder },
  currencyRowLeft: { flex: 1 },
  currencyCode: { fontSize: 14, fontWeight: '600', color: colors.text },
  currencyName: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  currencyRowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  currencySymbol: { fontSize: 16, fontWeight: '500', color: colors.textSecondary },
  checkmark: { fontSize: 14, color: colors.text, fontWeight: '700' },

  // Alert Modal
  modalOverlay: { flex: 1, backgroundColor: colors.overlayDark, justifyContent: 'center', alignItems: 'center', padding: 24 },
  alertBox: { backgroundColor: colors.card, width: '100%', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.3 : 0.15, shadowRadius: 24, elevation: 24 },
  alertTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12, textAlign: 'center' },
  alertText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 10 },
  alertActions: { width: '100%', gap: 12 },
  alertConfirmBtn: { backgroundColor: colors.danger, paddingVertical: 14, borderRadius: 12, alignItems: 'center', width: '100%' },
  alertConfirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  alertCancelBtn: { paddingVertical: 12, alignItems: 'center', width: '100%' },
  alertCancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: '500' },

  // Toast
  toastContainer: { position: 'absolute', alignSelf: 'center', backgroundColor: isDark ? '#444' : '#333', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  
  signOutActions: { width: '100%', gap: 12 },
  signOutBtn: { width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center' },
  signOutBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  signOutCancelBtn: { width: '100%', paddingVertical: 12, borderRadius: 12, backgroundColor: colors.iconPlaceholder, alignItems: 'center' },
  signOutCancelText: { fontSize: 15, fontWeight: '600', color: colors.text },
});
