import { BSColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BankStore } from '@/store/banking';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withShimmer } from '@/components/shimmer';

function ShakeScreen() {
  const { primaryColor } = useTheme();
  const router = useRouter();
  const [shakeEnabled, setShakeEnabled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [suspiciousTx, setSuspiciousTx] = useState<{ merchant: string; amount: number; date: string } | null>(null);
  const [reported, setReported] = useState<string[]>([]);
  const shakeAnim = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.get() }],
  }));
  const lastAccel = useRef({ x: 0, y: 0, z: 0 });
  const lastShakeTime = useRef(0);

  // Pick a random recent transaction to flag as suspicious
  const pickSuspiciousTx = useCallback(() => {
    const txs = BankStore.getTransactions().filter(t => t.amount < 0);
    if (txs.length === 0) return null;
    const idx = Math.floor(Math.random() * Math.min(txs.length, 5));
    const t = txs[idx];
    return { merchant: t.merchant, amount: Math.abs(t.amount), date: t.date };
  }, []);

  const triggerShakeEffect = useCallback(() => {
    const now = Date.now();
    if (now - lastShakeTime.current < 2000) return;
    lastShakeTime.current = now;
    const tx = pickSuspiciousTx();
    setSuspiciousTx(tx);
    setShowModal(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    shakeAnim.value = withSequence(
      withTiming(10, { duration: 60 }),
      withTiming(-10, { duration: 60 }),
      withTiming(6, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
  }, [shakeAnim, pickSuspiciousTx]);

  useEffect(() => {
    if (!shakeEnabled) return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Accelerometer } = require('expo-sensors');
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(({ x, y, z }: { x: number; y: number; z: number }) => {
      const dx = Math.abs(x - lastAccel.current.x);
      const dy = Math.abs(y - lastAccel.current.y);
      const dz = Math.abs(z - lastAccel.current.z);
      lastAccel.current = { x, y, z };
      if (dx + dy + dz > 2.5) triggerShakeEffect();
    });
    return () => sub.remove();
  }, [shakeEnabled, triggerShakeEffect]);

  const handleReport = () => {
    if (suspiciousTx) {
      setReported(prev => [...prev, suspiciousTx.merchant]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setShowModal(false);
  };

  const handleDismiss = () => {
    setShowModal(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Fraud Alert</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View style={[styles.alertCard, shakeStyle]}>
          <View style={styles.alertIconWrap}>
            <Ionicons name="shield-outline" size={48} color={shakeEnabled ? BSColors.errorDark : BSColors.slate300} />
          </View>
          <Text style={styles.alertTitle}>Shake to Report Fraud</Text>
          <Text style={styles.alertSub}>
            {shakeEnabled
              ? 'Shake your device if you spot a suspicious transaction below'
              : 'Enable detection, then shake to flag a suspicious transaction'}
          </Text>
        </Animated.View>

        <TouchableOpacity
          style={[styles.toggleBtn, { backgroundColor: shakeEnabled ? BSColors.errorDark : BSColors.primary }]}
          onPress={() => setShakeEnabled(e => !e)}
          testID="shake-toggle-btn"
        >
          <Ionicons name={shakeEnabled ? 'stop-circle-outline' : 'radio-outline'} size={20} color="#fff" />
          <Text style={styles.toggleBtnText}>{shakeEnabled ? 'Stop Monitoring' : 'Enable Fraud Detection'}</Text>
        </TouchableOpacity>

        {shakeEnabled && (
          <View style={styles.hintCard}>
            <Ionicons name="information-circle-outline" size={16} color="#D97706" />
            <Text style={styles.hintText}>Shake your device to flag a suspicious transaction for review</Text>
          </View>
        )}

        {/* Recent transactions list */}
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <View style={styles.txCard}>
          {BankStore.getTransactions().filter(t => t.amount < 0).slice(0, 5).map((tx, i, arr) => (
            <View key={tx.id} style={[styles.txRow, i < arr.length - 1 && styles.txBorder]}>
              <View style={[styles.txIcon, { backgroundColor: reported.includes(tx.merchant) ? BSColors.errorBorderDark : BSColors.lightGray }]}>
                <Ionicons
                  name={reported.includes(tx.merchant) ? 'flag' : (tx.icon as any)}
                  size={16}
                  color={reported.includes(tx.merchant) ? BSColors.errorDark : BSColors.darkGray}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txMerchant}>{tx.merchant}</Text>
                <Text style={styles.txDate}>{tx.category} · {tx.date}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.txAmount}>-${Math.abs(tx.amount).toLocaleString()}</Text>
                {reported.includes(tx.merchant) && (
                  <Text style={styles.reportedBadge}>Reported</Text>
                )}
              </View>
            </View>
          ))}
          {BankStore.getTransactions().filter(t => t.amount < 0).length === 0 && (
            <View style={styles.emptyTx}>
              <Text style={styles.emptyTxText}>No transactions yet</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fraud Alert Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="warning" size={40} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>Suspicious Transaction?</Text>
            {suspiciousTx ? (
              <>
                <Text style={styles.modalDesc}>You flagged this transaction as suspicious:</Text>
                <View style={styles.modalTxBox}>
                  <Text style={styles.modalTxMerchant}>{suspiciousTx.merchant}</Text>
                  <Text style={styles.modalTxAmount}>-${suspiciousTx.amount.toLocaleString()}</Text>
                  <Text style={styles.modalTxDate}>{suspiciousTx.date}</Text>
                </View>
              </>
            ) : (
              <Text style={styles.modalDesc}>No recent debit transactions found to flag.</Text>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalDismissBtn} onPress={handleDismiss} testID="dismiss-fraud-btn">
                <Text style={styles.modalDismissText}>Not Suspicious</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalReportBtn} onPress={handleReport} testID="report-fraud-btn">
                <Ionicons name="flag" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.modalReportText}>Report Fraud</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BSColors.bgPageAlt },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: BSColors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  pageTitle: { color: BSColors.textPrimary, fontSize: 18, fontFamily: 'Urbanist-Bold' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  alertCard: { backgroundColor: BSColors.white, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  alertIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: BSColors.errorBg, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  alertTitle: { color: BSColors.textPrimary, fontSize: 18, fontFamily: 'Urbanist-Bold', marginBottom: 8, textAlign: 'center' },
  alertSub: { color: BSColors.darkGray, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, marginBottom: 14 },
  toggleBtnText: { color: BSColors.white, fontSize: 15, fontFamily: 'Urbanist-Bold' },
  hintCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: BSColors.warningBg, borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: BSColors.amberHighlight },
  hintText: { color: BSColors.amberText, fontSize: 13, flex: 1, lineHeight: 18 },
  sectionTitle: { color: BSColors.textPrimary, fontSize: 15, fontFamily: 'Urbanist-Bold', marginBottom: 10 },
  txCard: { backgroundColor: BSColors.white, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: BSColors.lightGray },
  txIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txMerchant: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-SemiBold', marginBottom: 2 },
  txDate: { color: BSColors.slate300, fontSize: 12 },
  txAmount: { color: BSColors.errorDark, fontSize: 14, fontFamily: 'Urbanist-Bold' },
  reportedBadge: { color: BSColors.errorDark, fontSize: 10, fontFamily: 'Urbanist-Bold', marginTop: 2 },
  emptyTx: { padding: 24, alignItems: 'center' },
  emptyTxText: { color: BSColors.slate300, fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: BSColors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: BSColors.errorBorderDark, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { color: BSColors.textPrimary, fontSize: 20, fontFamily: 'Urbanist-Bold', textAlign: 'center', marginBottom: 8 },
  modalDesc: { color: BSColors.darkGray, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  modalTxBox: { backgroundColor: BSColors.errorBg, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: BSColors.errorBorder },
  modalTxMerchant: { color: BSColors.textPrimary, fontSize: 16, fontFamily: 'Urbanist-Bold', marginBottom: 4 },
  modalTxAmount: { color: BSColors.errorDark, fontSize: 20, fontFamily: 'Urbanist-ExtraBold', marginBottom: 4 },
  modalTxDate: { color: BSColors.slate300, fontSize: 12 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalDismissBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: BSColors.lightGray },
  modalDismissText: { color: BSColors.darkGray, fontSize: 15, fontFamily: 'Urbanist-SemiBold' },
  modalReportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: BSColors.errorDark },
  modalReportText: { color: BSColors.white, fontSize: 15, fontFamily: 'Urbanist-Bold' },
});

export default withShimmer(ShakeScreen);
