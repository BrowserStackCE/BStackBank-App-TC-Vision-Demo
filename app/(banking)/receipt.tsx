import { ScreenShimmer } from '@/components/shimmer';
import { BSColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/store/api';
import { Ionicons } from '@expo/vector-icons';
import { Directory, File, Paths } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type OrderDetails = Awaited<ReturnType<typeof api.getOrders>>['orders'][number];

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ReceiptScreen() {
  const { primaryColor } = useTheme();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdf, setPdf] = useState<{ uri: string; name: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getOrders()
      .then(res => setOrder(res.orders.find(o => o.id === orderId) ?? null))
      .catch(() => setError('Could not load this order.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  const download = async () => {
    if (!order) return;
    setDownloading(true);
    setError('');
    try {
      const token = await api.getToken();
      const folder = new Directory(Paths.cache, 'receipts');
      folder.create({ idempotent: true });
      const file = await File.downloadFileAsync(api.receiptUrl(order.id), folder, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        idempotent: true,
      });
      setPdf({ uri: file.uri, name: file.uri.split('/').pop() ?? 'receipt.pdf' });
    } catch {
      setError('Could not export the receipt. Please check your connection and try again.');
    } finally {
      setDownloading(false);
    }
  };

  const openPdf = async () => {
    if (!pdf) return;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        setError('No app is available to open PDF files on this device.');
        return;
      }
      await Sharing.shareAsync(pdf.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Order receipt',
      });
    } catch {
      setError('Could not open the receipt.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(banking)/shop' as any))} style={styles.backBtn} accessibilityLabel="Back" accessibilityRole="button">
          <Ionicons name="arrow-back" size={20} color={BSColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Order Receipt</Text>
      </View>

      {loading ? (
        <ScreenShimmer rows={3} />
      ) : !order ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={48} color={BSColors.mediumGray} />
          <Text style={styles.emptyText}>{error || 'Order not found.'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.successWrap}>
            <View style={[styles.successIcon, { backgroundColor: BSColors.success + '15' }]}>
              <Ionicons name="checkmark-circle" size={48} color={BSColors.success} />
            </View>
            <Text style={styles.successTitle}>Receipt preview</Text>
            <Text style={styles.successSub}>Review your receipt, then export it as a PDF</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Reference</Text>
              <Text style={styles.metaValue} testID="receipt-reference">{order.referenceId}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>{order.date}</Text>
            </View>
            <View style={styles.divider} />
            {order.items.map(item => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.itemQty}>Qty {item.qty} · {money(item.price)}</Text>
                </View>
                <Text style={styles.itemTotal}>{money(item.price * item.qty)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Shipping</Text>
              <Text style={[styles.metaValue, { color: BSColors.success }]}>Free</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.totalLabel}>Total paid</Text>
              <Text style={[styles.totalValue, { color: primaryColor }]} testID="receipt-total">{money(order.total)}</Text>
            </View>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Ionicons name="warning-outline" size={16} color={BSColors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {pdf ? (
            <View style={styles.savedRow}>
              <Ionicons name="document-text-outline" size={18} color={BSColors.successDark} />
              <Text style={styles.savedText} numberOfLines={1}>{pdf.name}</Text>
            </View>
          ) : null}

          {!pdf ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: primaryColor }, downloading && { opacity: 0.7 }]}
              onPress={download}
              disabled={downloading}
              testID="download-receipt-btn"
              accessibilityRole="button"
              accessibilityLabel="Export receipt as PDF"
            >
              {downloading
                ? <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                : <Ionicons name="download-outline" size={18} color="#fff" style={{ marginRight: 8 }} />}
              <Text style={styles.primaryBtnText}>{downloading ? 'Exporting...' : 'Export as PDF'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: BSColors.successDark }]}
              onPress={openPdf}
              testID="view-receipt-btn"
              accessibilityRole="button"
              accessibilityLabel="View the downloaded receipt"
            >
              <Ionicons name="document-text-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Open / share PDF</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(banking)/shop' as any)} testID="continue-shopping-btn">
            <Text style={[styles.secondaryBtnText, { color: primaryColor }]}>Back to shop</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BSColors.bgPage },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: BSColors.white, alignItems: 'center', justifyContent: 'center' },
  title: { color: BSColors.textPrimary, fontSize: 18, fontFamily: 'Urbanist-ExtraBold' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: BSColors.darkGray, fontSize: 14 },
  successWrap: { alignItems: 'center', marginVertical: 20 },
  successIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  successTitle: { color: BSColors.textPrimary, fontSize: 22, fontFamily: 'Urbanist-ExtraBold' },
  successSub: { color: BSColors.darkGray, fontSize: 14, marginTop: 2 },
  card: { backgroundColor: BSColors.white, borderRadius: 18, padding: 18, marginBottom: 16 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  metaLabel: { color: BSColors.darkGray, fontSize: 13 },
  metaValue: { color: BSColors.textPrimary, fontSize: 13, fontFamily: 'Urbanist-SemiBold', flexShrink: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: BSColors.lightGray, marginVertical: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  itemInfo: { flex: 1 },
  itemName: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-SemiBold' },
  itemQty: { color: BSColors.darkGray, fontSize: 12, marginTop: 2 },
  itemTotal: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-Bold' },
  totalLabel: { color: BSColors.textPrimary, fontSize: 15, fontFamily: 'Urbanist-Bold' },
  totalValue: { fontSize: 18, fontFamily: 'Urbanist-ExtraBold' },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: BSColors.errorBg, borderRadius: 12, padding: 12, marginBottom: 12 },
  errorText: { flex: 1, color: BSColors.errorDark, fontSize: 13 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: BSColors.successBg, borderRadius: 12, padding: 12, marginBottom: 12 },
  savedText: { flex: 1, color: BSColors.successDark, fontSize: 13, fontFamily: 'Urbanist-SemiBold' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16, marginBottom: 10 },
  primaryBtnText: { color: BSColors.white, fontSize: 16, fontFamily: 'Urbanist-Bold' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 12 },
  secondaryBtnText: { fontSize: 15, fontFamily: 'Urbanist-SemiBold' },
});
