import { useState, useRef } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Modal, Alert, Animated } from 'react-native';
import Text from '../components/AppText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../firebaseConfig';
import { deleteUser, signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppContext } from './AppContext';

export default function HelpCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, colors, isDark } = useAppContext();
  const styles = createStyles(colors, isDark);
  
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  
  const getStorageKey = (u) => u ? `@tracker_transactions_${u.uid}` : '@tracker_transactions_local';
  const getBalanceKey = (u) => u ? `@tracker_balance_${u.uid}` : '@tracker_balance_local';

  async function executeClearData() {
    try {
      const user = auth.currentUser;
      const txKey = getStorageKey(user);
      const balKey = getBalanceKey(user);
      await AsyncStorage.multiRemove([txKey, balKey]);
      setClearModalVisible(false);
      Alert.alert('Success', 'All local data has been cleared.');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  }

  async function executeDeleteAccount() {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const txKey = getStorageKey(user);
      const balKey = getBalanceKey(user);
      await AsyncStorage.multiRemove([txKey, balKey]);
      
      await deleteUser(user);
      setDeleteModalVisible(false);
      router.replace('/login');
    } catch (error) {
      // Firebase might require recent re-authentication for deletion
      if (error.code === 'auth/requires-recent-login') {
        Alert.alert('Authentication Required', 'Please sign out and sign back in before deleting your account.');
        setDeleteModalVisible(false);
      } else {
        Alert.alert('Error', error.message);
      }
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>✕</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <Text style={styles.screenTitle}>{t('help_center') || 'Help Center'}</Text>
        
        <Text style={styles.sectionTitle}>FAQ</Text>
        
        <View style={styles.faqCard}>
          <Text style={styles.faqQuestion}>How do I split an expense?</Text>
          <Text style={styles.faqAnswer}>Navigate to the Split tab, ensure you have connected with a friend using their email, and tap "Add Split Expense". You can enter the amount and description there.</Text>
        </View>

        <View style={styles.faqCard}>
          <Text style={styles.faqQuestion}>How do I settle up?</Text>
          <Text style={styles.faqAnswer}>In the Split tab, next to your balance, there is a "Settle Up" button. Use this when you have paid a friend in cash or via external apps to reset your balance.</Text>
        </View>

        <View style={styles.faqCard}>
          <Text style={styles.faqQuestion}>How do I change the currency?</Text>
          <Text style={styles.faqAnswer}>Go back to Settings &gt; Preferences &gt; Currency to select from a list of global currencies.</Text>
        </View>

        <Text style={styles.sectionTitle}>Contact Support</Text>
        <View style={styles.contactCard}>
          <Text style={styles.contactText}>If you're experiencing bugs or need further assistance, please reach out to our team.</Text>
          <Text style={styles.emailText}>joshikartavya78@gmail.com</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.danger, marginTop: 40 }]}>Danger Zone</Text>
        
        <TouchableOpacity style={styles.dangerBtn} onPress={() => setClearModalVisible(true)} activeOpacity={0.8}>
          <Text style={styles.dangerBtnText}>{t('clear_all_data') || 'Clear all data'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.dangerBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger, marginTop: 16 }]} onPress={() => setDeleteModalVisible(true)} activeOpacity={0.8}>
          <Text style={[styles.dangerBtnText, { color: colors.danger }]}>Delete Account</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Clear Data Modal */}
      <Modal visible={clearModalVisible} transparent animationType="fade" onRequestClose={() => setClearModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>{t('clear_data_title') || 'Clear all data?'}</Text>
            <Text style={styles.alertText}>
              {t('clear_data_text') || 'Are you sure? This will permanently delete all your transactions and reset your balance.'}
            </Text>
            <View style={styles.alertActions}>
              <TouchableOpacity style={styles.alertCancelBtn} onPress={() => setClearModalVisible(false)}>
                <Text style={styles.alertCancelText}>{t('cancel') || 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.alertConfirmBtn} onPress={executeClearData}>
                <Text style={styles.alertConfirmText}>{t('yes_delete') || 'Yes, Delete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Delete Account?</Text>
            <Text style={styles.alertText}>
              This action is irreversible. All your account data, connections, and split history will be permanently deleted from our servers.
            </Text>
            <View style={styles.alertActions}>
              <TouchableOpacity style={styles.alertCancelBtn} onPress={() => setDeleteModalVisible(false)}>
                <Text style={styles.alertCancelText}>{t('cancel') || 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.alertConfirmBtn} onPress={executeDeleteAccount}>
                <Text style={styles.alertConfirmText}>{t('yes_delete') || 'Yes, Delete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const createStyles = (colors, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 28 },
  topBar: { paddingTop: 16, alignItems: 'flex-end', marginBottom: 10, marginRight: -8 },
  backBtn: { padding: 8 },
  backText: { fontSize: 24, color: colors.textMuted, fontWeight: '300' },
  screenTitle: { fontSize: 20, fontWeight: '300', color: colors.textMuted, marginBottom: 32 },
  
  sectionTitle: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12, marginTop: 24 },
  
  faqCard: { backgroundColor: colors.card, padding: 20, borderRadius: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  faqQuestion: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 8 },
  faqAnswer: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },

  contactCard: { backgroundColor: colors.card, padding: 20, borderRadius: 16, marginBottom: 16 },
  contactText: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 12 },
  emailText: { fontSize: 15, fontWeight: '600', color: colors.primary },

  dangerBtn: { backgroundColor: colors.danger, paddingVertical: 14, borderRadius: 20, alignItems: 'center' },
  dangerBtnText: { color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: colors.overlayDark, justifyContent: 'center', alignItems: 'center', padding: 24 },
  alertBox: { backgroundColor: colors.card, width: '100%', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.3 : 0.15, shadowRadius: 24, elevation: 24 },
  alertTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12, textAlign: 'center' },
  alertText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 10 },
  alertActions: { width: '100%', gap: 12 },
  alertConfirmBtn: { backgroundColor: colors.danger, paddingVertical: 14, borderRadius: 12, alignItems: 'center', width: '100%' },
  alertConfirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  alertCancelBtn: { paddingVertical: 12, alignItems: 'center', width: '100%' },
  alertCancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: '500' },
});
