import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SectionList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebaseConfig';

const STORAGE_KEY = '@tracker_transactions';

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

function groupTransactions(transactions) {
  const groups = {};
  [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!groups[key]) groups[key] = { dateKey: key, date: d, data: [] };
    groups[key].data.push(t);
  });
  return Object.values(groups).sort((a, b) => b.date - a.date);
}

export default function ActivityScreen() {
  const [sections, setSections] = useState([]);
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);

  const getStorageKey = (u) => u ? `@tracker_transactions_${u.uid}` : '@tracker_transactions_local';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      try {
        const raw = await AsyncStorage.getItem(getStorageKey(currentUser));
        if (raw) {
          const parsed = JSON.parse(raw);
          setSections(groupTransactions(parsed));
        } else {
          setSections([]);
        }
      } catch (_) {}
    });
    return unsubscribe;
  }, []);

  function renderTxItem({ item }) {
    const isIncome = item.type === 'income';
    return (
      <View style={styles.txItem}>
        <View>
          <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.txTime}>{fmtTime(new Date(item.date))}</Text>
        </View>
        <Text style={[styles.txAmount, { color: isIncome ? '#6A9C78' : '#C56A67' }]}>
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

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <Text style={styles.screenTitle}>activity</Text>
        {sections.length === 0
          ? <View style={styles.emptyState}><Text style={styles.emptyText}>no transactions yet</Text></View>
          : <SectionList
              sections={sections}
              keyExtractor={item => item.id}
              renderItem={renderTxItem}
              renderSectionHeader={renderSectionHeader}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120 }}
              stickySectionHeadersEnabled={false}
            />
        }
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfcfc' },
  content: { flex: 1, paddingHorizontal: 28 },
  screenTitle: { fontSize: 18, fontWeight: '300', color: '#b0b0b0', marginBottom: 24 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: '#ccc' },
  sectionHeader: { paddingVertical: 10, backgroundColor: '#fcfcfc', marginTop: 12 },
  sectionHeaderText: { fontSize: 12, fontWeight: '700', color: '#bbb', textTransform: 'uppercase', letterSpacing: 1.2 },
  txItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f2f2f2' },
  txDesc: { fontSize: 14, fontWeight: '500', color: '#000', marginBottom: 4 },
  txTime: { fontSize: 11, color: '#aaa' },
  txAmount: { fontSize: 14, fontWeight: '600' },
  txAmt: { fontSize: 15, fontWeight: '600' },
});
