import { TransactionShimmer, useShimmerGate } from '@/components/shimmer';
import { BSColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BankStore, Transaction } from '@/store/banking';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FILTERS = ['All', 'Credit', 'Debit', 'Transfer', 'Payment'];

const CATEGORY_ICONS: Record<string, string> = {
  Income: 'briefcase-outline',
  Groceries: 'cart-outline',
  Entertainment: 'tv-outline',
  Transport: 'car-outline',
  Shopping: 'bag-outline',
  'Food & Drink': 'cafe-outline',
  Transfer: 'swap-horizontal-outline',
  Payment: 'card-outline',
};

export default function TransactionsScreen() {
  const { primaryColor, primaryBg, primaryBorder, greenMode } = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>(BankStore.getTransactions());
  const [activeFilter, setActiveFilter] = useState('All');
  const [balance, setBalance] = useState(BankStore.getBalance());
  const [txLoading, setTxLoading] = useState(BankStore.isLoading());
  const showShimmer = useShimmerGate(txLoading);

  useEffect(() => {
    // Sync real data from API
    BankStore.sync().then(() => setTxLoading(false)).catch(() => setTxLoading(false));
    const unsub = BankStore.subscribe(() => {
      setTransactions(BankStore.getTransactions());
      setBalance(BankStore.getBalance());
    });
    return unsub;
  }, []);

  const filtered = transactions.filter(tx => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Credit') return tx.type === 'credit';
    if (activeFilter === 'Debit') return tx.type === 'debit';
    return tx.category === activeFilter;
  });

  const totalCredit = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const totalDebit = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={styles.pageTitle}>Transactions</Text>

        {/* Summary Cards */}
        <View style={[styles.summaryRow, greenMode && { flexDirection: "column" }]}>
          <View style={[styles.summaryCard, { backgroundColor: BSColors.successBg }]}>
            <Ionicons name="arrow-down-circle-outline" size={20} color="#059669" />
            <Text style={styles.summaryLabel}>Total In</Text>
            <Text style={[styles.summaryValue, { color: BSColors.successDark }]}>+${totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: BSColors.errorBg }]}>
            <Ionicons name="arrow-up-circle-outline" size={20} color="#DC2626" />
            <Text style={styles.summaryLabel}>Total Out</Text>
            <Text style={[styles.summaryValue, { color: BSColors.errorDark }]}>-${totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: primaryBg }]}>
            <Ionicons name="wallet-outline" size={20} color={primaryColor} />
            <Text style={styles.summaryLabel}>Balance</Text>
            <Text style={[styles.summaryValue, { color: primaryColor }]}>${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f} style={[styles.filterChip, activeFilter === f && styles.filterChipActive]} onPress={() => setActiveFilter(f)} testID={`filter-${f.toLowerCase().replace(/\s+/g, "-")}`} accessibilityLabel={`Filter by ${f}`} accessibilityRole="button" accessibilityState={{ selected: activeFilter === f }}>
              <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Transaction List */}
        {showShimmer ? (
          <TransactionShimmer />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={primaryBorder} />
            <Text style={styles.emptyText}>No transactions found</Text>
          </View>
        ) : (
          <View style={styles.txList}>
            {filtered.map((tx, i) => (
              <View key={tx.id} style={[styles.txRow, i < filtered.length - 1 && styles.txBorder]}>
                <View style={[styles.txIconWrap, { backgroundColor: tx.type === 'credit' ? BSColors.successBg : BSColors.bgPageAlt }]}>
                  <Ionicons
                    name={(CATEGORY_ICONS[tx.category] || tx.icon) as any}
                    size={20}
                    color={tx.type === 'credit' ? BSColors.successDark : BSColors.darkGray}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txMerchant}>{tx.merchant}</Text>
                  <Text style={styles.txMeta}>{tx.category} · {tx.date}</Text>
                  {tx.note ? <Text style={styles.txNote}>&quot;{tx.note}&quot;</Text> : null}
                  <Text style={styles.txRef}>{tx.referenceId}</Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, tx.amount > 0 ? styles.txCredit : styles.txDebit]}>
                    {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                  <View style={[styles.txTypeBadge, { backgroundColor: tx.type === 'credit' ? BSColors.successBg : BSColors.errorBg }]}>
                    <Text style={[styles.txTypeBadgeText, { color: tx.type === 'credit' ? BSColors.successDark : BSColors.errorDark }]}>
                      {tx.type === 'credit' ? 'Credit' : 'Debit'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BSColors.bgPageAlt },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  pageTitle: { color: BSColors.textPrimary, fontSize: 22, fontFamily: 'Urbanist-Bold', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 },
  summaryLabel: { color: BSColors.darkGray, fontSize: 11, fontFamily: 'Urbanist-SemiBold' },
  summaryValue: { fontSize: 12, fontFamily: 'Urbanist-ExtraBold' },
  filterScroll: { marginBottom: 16 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: BSColors.white, borderWidth: 1.5, borderColor: BSColors.mediumGray },
  filterChipActive: { backgroundColor: BSColors.primary, borderColor: BSColors.primary },
  filterChipText: { color: BSColors.darkGray, fontSize: 13, fontFamily: 'Urbanist-SemiBold' },
  filterChipTextActive: { color: BSColors.white },
  txList: { backgroundColor: BSColors.white, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  txRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: BSColors.lightGray },
  txIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  txInfo: { flex: 1 },
  txMerchant: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-SemiBold', marginBottom: 2 },
  txMeta: { color: BSColors.slate300, fontSize: 12, marginBottom: 2 },
  txNote: { color: BSColors.darkGray, fontSize: 11, fontStyle: 'italic', marginBottom: 2 },
  txRef: { color: BSColors.indigoBorder, fontSize: 10 },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: 14, fontFamily: 'Urbanist-Bold' },
  txCredit: { color: BSColors.successDark },
  txDebit: { color: BSColors.errorDark },
  txTypeBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  txTypeBadgeText: { fontSize: 10, fontFamily: 'Urbanist-Bold' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: BSColors.slate300, fontSize: 15 },
});