import { TransactionAuthModal } from '@/components/TransactionAuthModal';
import { RecipientShimmer } from '@/components/shimmer';
import { BSColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_URL, api } from '@/store/api';
import { BankStore } from '@/store/banking';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const QUICK_AMOUNTS = [50, 100, 250, 500];

type Tab = 'send' | 'pay';
interface Recipient { id: string; name: string; account: string; avatar: string; }

export default function TransferScreen() {
  const { primaryColor, primaryBg, primaryBorder, greenMode } = useTheme();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [tab, setTab] = useState<Tab>('send');

  // Shared state
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [balance, setBalance] = useState(BankStore.getBalance());

  // Send Money state
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastTx, setLastTx] = useState<{ amount: string; name: string; ref: string } | null>(null);
  const [sendError, setSendError] = useState('');

  // Biometric auth applies to normal transfers only; Stripe card payments go straight to the payment sheet
  const [showAuth, setShowAuth] = useState(false);

  // Stripe Pay state — recipient + amount shared above
  const [payDesc, setPayDesc] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payReady, setPayReady] = useState(false);
  const [payError, setPayError] = useState('');

  useEffect(() => {
    api.getUsers().then(res => {
      setRecipients(res.users);
    }).catch(() => {
      setRecipients([]);
    }).finally(() => setRecipientsLoading(false));
  }, []);

  // Reset shared fields when switching tabs
  const switchTab = (t: Tab) => {
    setTab(t);
    setSelectedRecipient(null);
    setAmount('');
    setRemarks('');
    setSendError('');
    setPayError('');
    setPayReady(false);
    setPayDesc('');
  };

  const recipient = recipients.find(r => r.id === selectedRecipient);

  // ── Send Money ──────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!selectedRecipient) { setSendError('Please select a recipient.'); return; }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setSendError('Please enter a valid amount.'); return; }
    if (!BankStore.canAfford(amt)) { setSendError(`Insufficient balance. Available: $${BankStore.getBalance().toLocaleString()}`); return; }
    setSendError('');
    setShowAuth(true);
  };

  const executeSend = async () => {
    const amt = parseFloat(amount);
    try {
      const tx = await BankStore.transfer(recipient!.name, amt, remarks || undefined, recipient!.id);
      setBalance(BankStore.getBalance());
      setLastTx({ amount: amt.toFixed(2), name: recipient!.name, ref: tx.referenceId });
      setShowSuccess(true);
    } catch {
      setSendError('Transaction could not be completed. Please try again.');
    }
  };

  const handleDone = () => {
    setShowSuccess(false);
    setSelectedRecipient(null);
    setAmount('');
    setRemarks('');
    setLastTx(null);
  };

  // ── Stripe Pay ──────────────────────────────────────────────────────────────
  const fetchAndInitPay = async () => {
    if (!selectedRecipient) { setPayError('Please select a recipient.'); return; }
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents < 50) { setPayError('Minimum payment is $0.50'); return; }
    if (!BankStore.canAfford(parseFloat(amount))) {
      setPayError(`Insufficient balance. Available: $${BankStore.getBalance().toLocaleString()}`);
      return;
    }
    setPayLoading(true);
    setPayError('');
    setPayReady(false);
    try {
      const response = await fetch(`${API_URL}/payment-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: cents, currency: 'usd', customerName: recipient!.name }),
      });
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      const { paymentIntent, ephemeralKey, customer } = await response.json();
      const { error } = await initPaymentSheet({
        merchantDisplayName: 'BrowserStack Bank',
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: { name: recipient!.name },
        returnURL: 'demobankingapp://stripe-redirect',
      });
      if (error) { setPayError(error.message); } else { setPayReady(true); }
    } catch (err: any) {
      setPayError(err.message || 'Could not connect to payment server.');
    } finally {
      setPayLoading(false);
    }
  };

  const handlePresent = async () => {
    const { error } = await presentPaymentSheet();
    if (error) {
      if (error.code !== 'Canceled') setPayError('Transaction could not be completed. ' + error.message);
    } else {
      const amt = parseFloat(amount);
      await BankStore.recordPayment(amt, payDesc || undefined);
      setBalance(BankStore.getBalance());
      Alert.alert(
        'Payment Successful!',
        `$${amt.toFixed(2)} sent to ${recipient!.name} via card.`,
        [{ text: 'Done', onPress: () => { setPayReady(false); setAmount(''); setPayDesc(''); setSelectedRecipient(null); } }],
      );
    }
  };

  // ── Shared: Recipient + Amount section ─────────────────────────────────────
  const renderRecipientAndAmount = (errorState: string, setErrorState: (v: string) => void) => (
    <>
      {/* Recipient */}
      <Text style={styles.label}>Send To</Text>
      {recipientsLoading && <RecipientShimmer />}
      <View style={styles.recipientList}>
        {!recipientsLoading && recipients.length === 0 && (
          <View style={styles.emptyRecipients}>
            <Ionicons name="people-outline" size={32} color={BSColors.accentLight} />
            <Text style={styles.emptyRecipientsText}>No other users found. Invite friends to sign up!</Text>
          </View>
        )}
        {recipients.map((r: Recipient) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.recipientCard, selectedRecipient === r.id && { borderColor: primaryColor, backgroundColor: primaryColor + '0A' }]}
            onPress={() => { setSelectedRecipient(r.id); setErrorState(''); setPayReady(false); }}
            testID={`recipient-${r.id}`}
          >
            <View style={[styles.avatar, selectedRecipient === r.id && { backgroundColor: primaryColor }]}>
              <Text style={[styles.avatarText, selectedRecipient === r.id && { color: BSColors.white }]}>{r.avatar}</Text>
            </View>
            <View style={styles.recipientInfo}>
              <Text style={[styles.recipientName, selectedRecipient === r.id && { color: primaryColor }]}>{r.name}</Text>
              <Text style={styles.recipientAccount}>{r.account}</Text>
            </View>
            {selectedRecipient === r.id && <Ionicons name="checkmark-circle" size={22} color={primaryColor} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Amount */}
      <Text style={styles.label}>Amount</Text>
      <View style={styles.amountRow}>
        <Text style={styles.currencySymbol}>$</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0.00"
          placeholderTextColor="#CBD5E1"
          value={amount}
          onChangeText={v => { setAmount(v); setErrorState(''); setPayReady(false); }}
          keyboardType="decimal-pad"
          returnKeyType="done"
          testID="amount-input"
        />
      </View>
      <View style={styles.quickAmounts}>
        {QUICK_AMOUNTS.map(a => (
          <TouchableOpacity
            key={a}
            style={[styles.quickPill, amount === a.toString() && { backgroundColor: primaryColor, borderColor: primaryColor }]}
            onPress={() => { setAmount(a.toString()); setErrorState(''); setPayReady(false); }}
          >
            <Text style={[styles.quickPillText, amount === a.toString() && { color: BSColors.white }]}>${a}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe}>

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'send' && { backgroundColor: primaryColor }]}
          onPress={() => switchTab('send')}
        >
          <Ionicons name="swap-horizontal" size={16} color={tab === 'send' ? BSColors.white : primaryColor} style={{ marginRight: 6 }} />
          <Text style={[styles.tabBtnText, { color: tab === 'send' ? BSColors.white : primaryColor }]}>Send Money</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'pay' && { backgroundColor: primaryColor }]}
          onPress={() => switchTab('pay')}
        >
          <Ionicons name="card-outline" size={16} color={tab === 'pay' ? BSColors.white : primaryColor} style={{ marginRight: 6 }} />
          <Text style={[styles.tabBtnText, { color: tab === 'pay' ? BSColors.white : primaryColor }]}>Pay via Card</Text>
        </TouchableOpacity>
      </View>

      {/* Balance Banner */}
      <View style={[styles.balanceBanner, { backgroundColor: primaryColor + '10', borderColor: primaryColor + '30' }]}>
        <Ionicons name="wallet-outline" size={16} color={primaryColor} />
        <Text style={styles.balanceBannerText}>
          Available: <Text style={[styles.balanceBannerAmt, { color: primaryColor }]}>${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        </Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── SEND MONEY ── */}
        {tab === 'send' ? (
          <>
            <View style={styles.pageTitleRow}>
              <View style={[styles.pageTitleIcon, { backgroundColor: primaryColor + '15' }]}>
                <Ionicons name="swap-horizontal" size={20} color={primaryColor} />
              </View>
              <View>
                <Text style={styles.pageTitle}>Send Money</Text>
                <Text style={styles.pageSubtitle}>Transfer funds instantly</Text>
              </View>
            </View>

            {renderRecipientAndAmount(sendError, setSendError)}

            <Text style={styles.label}>Remarks (optional)</Text>
            <TextInput
              style={styles.remarksInput}
              placeholder="Add a note..."
              placeholderTextColor="#94A3B8"
              value={remarks}
              onChangeText={setRemarks}
              returnKeyType="done"
              testID="remarks-input"
            />

            {sendError ? (
              <View style={styles.errorCard}>
                <Ionicons name="warning-outline" size={16} color={BSColors.error} />
                <Text style={styles.errorCardText}>{sendError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: primaryColor, shadowColor: primaryColor }]}
              onPress={handleSend}
              testID="send-btn"
              accessibilityLabel="Send money"
              accessibilityRole="button"
            >
              <Ionicons name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Send Money</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* ── PAY VIA CARD ── */
          <>
            <View style={styles.pageTitleRow}>
              <View style={[styles.pageTitleIcon, { backgroundColor: BSColors.success + '15' }]}>
                <Ionicons name="card-outline" size={20} color={BSColors.success} />
              </View>
              <View>
                <Text style={styles.pageTitle}>Pay via Card</Text>
                <Text style={styles.pageSubtitle}>Secure payments via Stripe</Text>
              </View>
            </View>

            <View style={styles.stripeBadge}>
              <Ionicons name="shield-checkmark-outline" size={14} color={BSColors.success} />
              <Text style={[styles.stripeBadgeText, { color: BSColors.success }]}>Secured by Stripe</Text>
            </View>

            {renderRecipientAndAmount(payError, setPayError)}

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={styles.remarksInput}
              value={payDesc}
              onChangeText={v => { setPayDesc(v); setPayReady(false); }}
              placeholder="What's this payment for?"
              placeholderTextColor="#94A3B8"
              testID="pay-desc-input"
            />

            {payError ? (
              <View style={styles.errorCard}>
                <Ionicons name="warning-outline" size={16} color={BSColors.error} />
                <Text style={styles.errorCardText}>{payError}</Text>
              </View>
            ) : null}

            {!payReady ? (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: primaryColor, shadowColor: primaryColor }, payLoading && styles.btnDisabled]}
                onPress={fetchAndInitPay}
                disabled={payLoading}
                testID="init-pay-btn"
                accessibilityLabel={payLoading ? 'Preparing payment' : 'Proceed to payment'}
                accessibilityRole="button"
                accessibilityState={{ disabled: payLoading }}
              >
                {payLoading
                  ? <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                  : <Ionicons name="card-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                }
                <Text style={styles.primaryBtnText}>{payLoading ? 'Preparing...' : 'Proceed to Payment'}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: BSColors.success, shadowColor: BSColors.success }]}
                onPress={handlePresent}
                testID="pay-btn"
                accessibilityLabel={`Pay $${parseFloat(amount || '0').toFixed(2)} now`}
                accessibilityRole="button"
              >
                <Ionicons name="lock-closed-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Pay ${parseFloat(amount || '0').toFixed(2)} Now</Text>
              </TouchableOpacity>
            )}

            <View style={styles.testCards}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="flask-outline" size={16} color={BSColors.textSecondary} /><Text style={styles.testCardsTitle}>Test Card Numbers</Text></View>
              {[
                { num: '4242 4242 4242 4242', label: 'Success', color: BSColors.success },
                { num: '4000 0025 0000 3155', label: 'Requires Auth', color: BSColors.warning },
                { num: '4000 0000 0000 9995', label: 'Declined', color: BSColors.error },
              ].map(c => (
                <View key={c.num} style={styles.testCardRow}>
                  <Text style={styles.testCardNum}>{c.num}</Text>
                  <View style={[styles.testCardBadge, { backgroundColor: c.color + '15' }]}>
                    <Text style={[styles.testCardLabel, { color: c.color }]}>{c.label}</Text>
                  </View>
                </View>
              ))}
              <Text style={styles.testCardNote}>Any future expiry · Any CVC · Any postal code</Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.successIconWrap, { backgroundColor: BSColors.success + '15' }]}>
              <Ionicons name="checkmark-circle" size={56} color={BSColors.success} />
            </View>
            <Text style={styles.modalTitle}>Transfer Successful!</Text>
            <Text style={styles.modalSubtitle}>${lastTx?.amount} sent to {lastTx?.name}</Text>
            {remarks ? <Text style={styles.modalRemarks}>&quot;{remarks}&quot;</Text> : null}
            <View style={styles.modalRef}>
              <Text style={styles.modalRefLabel}>Reference ID</Text>
              <Text style={styles.modalRefValue}>{lastTx?.ref}</Text>
            </View>
            <View style={[styles.modalBalanceRow, { backgroundColor: primaryColor + '10' }]}>
              <Text style={styles.modalBalanceLabel}>New Balance</Text>
              <Text style={[styles.modalBalanceValue, { color: primaryColor }]}>
                ${BankStore.getBalance().toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: primaryColor }]} onPress={handleDone} testID="done-btn" accessibilityLabel="Done, close transfer confirmation" accessibilityRole="button">
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TransactionAuthModal
        visible={showAuth}
        amount={amount ? `$${parseFloat(amount).toFixed(2)}` : undefined}
        description={`to ${recipient?.name}`}
        onSuccess={() => {
          setShowAuth(false);
          executeSend();
        }}
        onCancel={() => {
          setShowAuth(false);
          setSendError('Transaction could not be completed.');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BSColors.bgPage },
  tabRow: { flexDirection: 'row', margin: 16, backgroundColor: BSColors.lightGray, borderRadius: 14, padding: 4, gap: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 11 },
  tabBtnText: { fontSize: 13, fontFamily: 'Urbanist-Bold' },
  balanceBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 4, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  balanceBannerText: { color: BSColors.textSecondary, fontSize: 13 },
  balanceBannerAmt: { fontFamily: 'Urbanist-Bold' },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

  pageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  pageTitleIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { color: BSColors.textPrimary, fontSize: 20, fontFamily: 'Urbanist-ExtraBold' },
  pageSubtitle: { color: BSColors.darkGray, fontSize: 13, marginTop: 2 },

  label: { color: BSColors.textSecondary, fontSize: 13, fontFamily: 'Urbanist-SemiBold', marginBottom: 10, marginTop: 4 },
  recipientList: { gap: 10, marginBottom: 20 },
  recipientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: BSColors.white, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: BSColors.mediumGray, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: BSColors.lightGray, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: BSColors.darkGray, fontSize: 14, fontFamily: 'Urbanist-Bold' },
  recipientInfo: { flex: 1 },
  recipientName: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-SemiBold', marginBottom: 2 },
  recipientAccount: { color: BSColors.slate300, fontSize: 12 },
  emptyRecipients: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyRecipientsText: { color: BSColors.slate300, fontSize: 13, textAlign: 'center' },

  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: BSColors.white, borderRadius: 14, borderWidth: 1.5, borderColor: BSColors.primaryBorder, paddingHorizontal: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  currencySymbol: { color: BSColors.textSecondary, fontSize: 24, fontFamily: 'Urbanist-Bold', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 28, fontFamily: 'Urbanist-Bold', color: BSColors.textPrimary, paddingVertical: 16 },
  quickAmounts: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  quickPill: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: BSColors.white, alignItems: 'center', borderWidth: 1.5, borderColor: BSColors.primaryBorder },
  quickPillText: { color: BSColors.textSecondary, fontSize: 13, fontFamily: 'Urbanist-SemiBold' },

  remarksInput: { backgroundColor: BSColors.white, borderRadius: 14, borderWidth: 1.5, borderColor: BSColors.mediumGray, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: BSColors.textPrimary, marginBottom: 20 },

  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: BSColors.errorBg, borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: BSColors.errorBorder },
  errorCardText: { color: BSColors.error, fontSize: 13, flex: 1 },

  primaryBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4, marginBottom: 8 },
  primaryBtnText: { color: BSColors.white, fontSize: 16, fontFamily: 'Urbanist-Bold' },
  btnDisabled: { opacity: 0.6 },

  stripeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BSColors.successBg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'center', marginBottom: 20, borderWidth: 1, borderColor: BSColors.successBorder },
  stripeBadgeText: { fontSize: 12, fontFamily: 'Urbanist-SemiBold' },

  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: BSColors.primaryBg, borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: BSColors.primaryBorder },
  infoText: { color: BSColors.blueDark, fontSize: 12, flex: 1 },
  infoCode: { fontFamily: 'Urbanist-Bold' },

  testCards: { marginTop: 20, backgroundColor: BSColors.lightGray, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BSColors.mediumGray },
  testCardsTitle: { color: BSColors.textPrimary, fontSize: 13, fontFamily: 'Urbanist-Bold', marginBottom: 12 },
  testCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  testCardNum: { color: BSColors.textSecondary, fontSize: 12, fontFamily: 'monospace' },
  testCardBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  testCardLabel: { fontSize: 11, fontFamily: 'Urbanist-Bold' },
  testCardNote: { color: BSColors.slate300, fontSize: 11, marginTop: 6 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: BSColors.white, borderRadius: 28, padding: 32, width: '100%', alignItems: 'center' },
  successIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { color: BSColors.textPrimary, fontSize: 22, fontFamily: 'Urbanist-ExtraBold', marginBottom: 8 },
  modalSubtitle: { color: BSColors.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 8 },
  modalRemarks: { color: BSColors.slate300, fontSize: 13, fontStyle: 'italic', marginBottom: 16 },
  modalRef: { backgroundColor: BSColors.lightGray, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center', marginBottom: 10 },
  modalRefLabel: { color: BSColors.slate300, fontSize: 12, marginBottom: 4 },
  modalRefValue: { color: BSColors.textPrimary, fontSize: 15, fontFamily: 'Urbanist-Bold' },
  modalBalanceRow: { borderRadius: 12, padding: 14, width: '100%', alignItems: 'center', marginBottom: 24 },
  modalBalanceLabel: { color: BSColors.darkGray, fontSize: 12, marginBottom: 4 },
  modalBalanceValue: { fontSize: 20, fontFamily: 'Urbanist-ExtraBold' },
  doneBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 48 },
  doneBtnText: { color: BSColors.white, fontSize: 16, fontFamily: 'Urbanist-Bold' },
});