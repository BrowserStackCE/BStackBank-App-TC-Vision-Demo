import { BalanceShimmer, TransactionShimmer } from '@/components/shimmer';
import { BSColors, CARD_THEMES } from '@/constants/theme';
import { AuthStore } from '@/store/auth';
import { BankStore } from '@/store/banking';
import { ThemeStore } from '@/store/theme';
import { Ionicons } from '@expo/vector-icons';
import { scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Modal, ScrollView,
  StyleSheet, Switch, Text,
  TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// IP-based geolocation — ip-api.com is free, no key, works from mobile
const IP_GEO_URL = 'http://ip-api.com/json/?fields=status,country,countryCode,regionName,city,currency,timezone,org,lat,lon,query,callingCodes';

export default function HomeScreen() {
  const router = useRouter();
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [, setScanned] = useState(false);
  const [qrResult, setQrResult] = useState<string | null>(null);
  const [balance, setBalance] = useState(BankStore.getBalance());
  const [recentTxs, setRecentTxs] = useState(BankStore.getTransactions().slice(0, 4));
  const [greenMode, setGreenMode] = useState(ThemeStore.isGreenMode());
  const [userName, setUserName] = useState(AuthStore.getUser()?.fullName || '');
  const [dataLoading, setDataLoading] = useState(BankStore.isLoading());
  const [showNotifs, setShowNotifs] = useState(false);

  // GPS location (header badge)
  const [locationName, setLocationName] = useState('Detecting...');
  const [locationLoading, setLocationLoading] = useState(true);

  // IP geolocation currency
  const [ipCurrency, setIpCurrency] = useState<{ code: string; country: string; city: string } | null>(null);
  const [ipLoading, setIpLoading] = useState(true);

  const primaryColor = greenMode ? BSColors.successDark : BSColors.primary;
  const accentColor = greenMode ? BSColors.success : BSColors.accent;

  useEffect(() => {
    BankStore.sync().then(() => setDataLoading(false)).catch(() => setDataLoading(false));
    const unsub = BankStore.subscribe(() => {
      setBalance(BankStore.getBalance());
      setRecentTxs(BankStore.getTransactions().slice(0, 4));
    });
    import('@/store/api').then(({ api }) => {
      api.getProfile().then(p => { if (p?.fullName) setUserName(p.fullName); }).catch(() => {});
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = ThemeStore.subscribe(() => setGreenMode(ThemeStore.isGreenMode()));
    return unsub;
  }, []);

  // GPS location for header badge — dynamic import avoids top-level Location name clash
  useEffect(() => {
    (async () => {
      try {
        const Loc = await import('expo-location');
        const { status } = await Loc.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Loc.getCurrentPositionAsync({ accuracy: Loc.Accuracy.Low });
          const [place] = await Loc.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          if (place) {
            const city = place.city || place.subregion || place.region || '';
            const country = place.country || '';
            if (city || country) {
              setLocationName(city ? `${city}, ${country}` : country);
            } else {
              // GPS gave no useful data — will be overridden by IP fallback below
              setLocationName('Detecting...');
            }
          } else { setLocationName('Detecting...'); }
        } else { setLocationName('Location off'); }
      } catch { setLocationName('Detecting...'); }
      setLocationLoading(false);
    })();
  }, []);

  const fetchIpCurrency = useCallback(async () => {
    setIpLoading(true);
    try {
      // ip-api.com: free, no key, works from mobile (HTTP allowed on Android)
      const res = await fetch(IP_GEO_URL);
      const data = await res.json();
      if (data?.status === 'success' && data?.currency) {
        const city = data.city || '';
        const country = data.country || '';
        setIpCurrency({ code: data.currency, country, city });
        // Use IP location as fallback for the location badge if GPS gave nothing useful
        setLocationName(prev =>
          (prev === 'Detecting...' || prev === 'Unknown' || prev === 'Location off')
            ? (city ? `${city}, ${country}` : country || 'Unknown')
            : prev
        );
      }
    } catch {
      // Silent — location badge stays as-is
    } finally {
      setIpLoading(false);
    }
  }, []);

  // Fetch IP geolocation on mount
  useEffect(() => {
    fetchIpCurrency();
  }, [fetchIpCurrency]);

  const openQRScanner = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Permission', 'Camera access is needed to scan QR codes.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.9,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    try {
      const barcodes = await scanFromURLAsync(uri, ['qr', 'aztec', 'datamatrix', 'pdf417', 'code128', 'code39', 'ean13', 'ean8']);
      if (barcodes.length > 0) {
        setQrResult(barcodes[0].data ?? null);
      } else {
        setQrResult('No QR code detected in the image.');
      }
    } catch {
      setQrResult('Could not decode image. Please try again.');
    }
    setScanned(true);
    setShowQRModal(true);
  }, []);

  const handleThemeToggle = () => {
    const next = !ThemeStore.isGreenMode();
    ThemeStore.toggle();
    setGreenMode(next);
  };

  const savings = BankStore.getSavings();
  const checking = BankStore.getChecking();

  const currencyLabel = ipCurrency
    ? `${ipCurrency.city || ipCurrency.country || 'Region'}`
    : 'Region';

  const QUICK_ACTIONS = [
    { id: 'chat', label: 'Chat', icon: 'chatbubbles-outline' as const, color: BSColors.purple, bg: '#7C3AED15', onPress: () => router.push('/(banking)/chat' as any) },
    { id: 'scan-qr', label: 'Scan QR', icon: 'qr-code-outline' as const, color: BSColors.errorDark, bg: '#DC262615', onPress: openQRScanner },
    { id: 'shop', label: 'Shop', icon: 'bag-outline' as const, color: BSColors.successDark, bg: '#05966915', onPress: () => router.push('/(banking)/shop' as any) },
    { id: 'network', label: 'Network', icon: 'wifi-outline' as const, color: BSColors.infoDark, bg: '#0891B215', onPress: () => router.push('/(banking)/network' as any) },
    { id: 'shake', label: 'Shake', icon: 'phone-portrait-outline' as const, color: BSColors.purple, bg: '#7C3AED15', onPress: () => router.push('/(banking)/testfeatures' as any) },
    {
      id: 'region',
      label: currencyLabel,
      icon: 'globe-outline' as const,
      color: accentColor,
      bg: accentColor + '15',
      onPress: () => router.push({ pathname: '/(banking)/currency' as any, params: ipCurrency ? { code: ipCurrency.code, country: ipCurrency.country, city: ipCurrency.city } : {} }),
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
          <Text style={styles.greeting}>Welcome</Text>
          <Text style={styles.userName}>{userName}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.locationBadge} onPress={async () => {
              setLocationLoading(true);
              try {
                const Loc = await import('expo-location');
                const { status } = await Loc.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                  const loc = await Loc.getCurrentPositionAsync({ accuracy: Loc.Accuracy.Low });
                  const [place] = await Loc.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                  if (place) {
                    const city = place.city || place.subregion || place.region || '';
                    const country = place.country || '';
                    setLocationName(city ? `${city}, ${country}` : country || 'Unknown');
                  }
                }
              } catch { /* ignore */ }
              setLocationLoading(false);
            }}>
              {locationLoading
                ? <ActivityIndicator size="small" color={primaryColor} style={{ marginRight: 4 }} />
                : <Ionicons name="location-outline" size={12} color={primaryColor} />}
              <Text style={[styles.locationText, { color: primaryColor }]} numberOfLines={1}>{locationName}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.notifBtn} onPress={() => setShowNotifs(true)} testID="notif-btn" accessibilityLabel="Notifications" accessibilityRole="button">
              <Ionicons name="notifications-outline" size={22} color={BSColors.textPrimary} />
              <View style={[styles.notifDot, { backgroundColor: BSColors.error }]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Theme Toggle */}
        <View style={[styles.themeToggleRow, {
          borderColor: greenMode ? BSColors.successDark + '30' : BSColors.primary + '30',
          backgroundColor: greenMode ? BSColors.successDark + '12' : BSColors.primary + '08',
        }]}>
          <Ionicons name={greenMode ? 'leaf-outline' : 'color-palette-outline'} size={16} color={primaryColor} />
          <Text style={[styles.themeToggleLabel, { color: primaryColor }]}>{greenMode ? 'Green Mode ON' : 'Default Theme'}</Text>
          <Switch
            value={greenMode}
            onValueChange={handleThemeToggle}
            trackColor={{ false: BSColors.mediumGray, true: BSColors.greenLight }}
            thumbColor={greenMode ? BSColors.successDark : primaryColor}
            testID="theme-toggle"
            accessibilityLabel={greenMode ? 'Green mode is on, tap to switch to default theme' : 'Default theme is on, tap to switch to green mode'}
            accessibilityRole="switch"
          />
        </View>

        {/* Balance Card — shifts slightly left+top in green mode (Percy visual diff use-case) */}
        <View style={[styles.balanceCard, { backgroundColor: CARD_THEMES.slate.bg }, greenMode && styles.balanceCardGreen]}>
          <View pointerEvents="none" style={[styles.cardCircle, { backgroundColor: CARD_THEMES.slate.circle }]} />
          {dataLoading ? <BalanceShimmer /> : (
            <>
              <View style={styles.balanceCardTop}>
                <View>
                  <Text style={styles.balanceLabel}>Total Balance</Text>
                  <Text style={styles.balanceCurrency}>USD</Text>
                </View>
                <TouchableOpacity onPress={() => setBalanceVisible(v => !v)} style={styles.eyeBtn} testID="balance-eye-btn" accessibilityLabel={balanceVisible ? 'Hide balance' : 'Show balance'} accessibilityRole="button">
                  <Ionicons name={balanceVisible ? 'eye-outline' : 'eye-off-outline'} size={22} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              </View>
              <Text style={styles.balanceAmount}>
                {balanceVisible ? `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '••••••••'}
              </Text>
              <View style={styles.balanceDividerLine} />
              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <View style={styles.balanceItemIcon}>
                    <Ionicons name="trending-up-outline" size={14} color="rgba(255,255,255,0.9)" />
                  </View>
                  <View>
                    <Text style={styles.balanceItemLabel}>Savings</Text>
                    <Text style={styles.balanceItemValue}>{balanceVisible ? `$${savings.toLocaleString()}` : '••••'}</Text>
                  </View>
                </View>
                <View style={styles.balanceVertDivider} />
                <View style={styles.balanceItem}>
                  <View style={styles.balanceItemIcon}>
                    <Ionicons name="wallet-outline" size={14} color="rgba(255,255,255,0.9)" />
                  </View>
                  <View>
                    <Text style={styles.balanceItemLabel}>Checking</Text>
                    <Text style={styles.balanceItemValue}>{balanceVisible ? `$${checking.toLocaleString()}` : '••••'}</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map(action => (
            <TouchableOpacity key={action.id} style={styles.quickAction} onPress={action.onPress} testID={`quick-action-${action.id}`} accessibilityLabel={action.label} accessibilityRole="button">
              <View style={[styles.quickActionIcon, { backgroundColor: action.bg }]}>
                {action.label === currencyLabel && ipLoading
                  ? <ActivityIndicator size="small" color={action.color} />
                  : <Ionicons name={action.icon} size={22} color={action.color} />
                }
              </View>
              <Text style={styles.quickActionLabel} numberOfLines={1}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => router.push('/(banking)/transactions' as any)} accessibilityLabel="See all transactions" accessibilityRole="link">
            <Text style={[styles.seeAll, { color: primaryColor }]}>
              {greenMode ? 'See all' : 'See all →'}
            </Text>
          </TouchableOpacity>
        </View>
        {dataLoading ? <TransactionShimmer /> : (
          <View style={styles.transactionCard}>
            {recentTxs.length === 0 ? (
              <View style={styles.emptyTx}>
                <Ionicons name="receipt-outline" size={32} color={BSColors.mediumGray} />
                <Text style={styles.emptyTxText}>No transactions yet</Text>
              </View>
            ) : recentTxs.map((tx, i) => (
              <View key={tx.id} style={[styles.txRow, i < recentTxs.length - 1 && styles.txBorder]}>
                <View style={[styles.txIconWrap, { backgroundColor: tx.amount > 0 ? BSColors.success + '15' : BSColors.error + '10' }]}>
                  <Ionicons name={tx.icon as any} size={18} color={tx.amount > 0 ? BSColors.success : BSColors.darkGray} />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txMerchant}>{tx.merchant}</Text>
                  <Text style={styles.txCategory}>{tx.category} · {tx.date}</Text>
                </View>
                <Text style={[styles.txAmount, tx.amount > 0 ? styles.txCredit : styles.txDebit]}>
                  {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      {/* Notifications Modal */}
      <Modal visible={showNotifs} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: BSColors.bgPage }}>
          <View style={styles.notifHeader}>
            <Text style={styles.notifTitle}>Notifications</Text>
            <TouchableOpacity onPress={() => setShowNotifs(false)} style={styles.notifCloseBtn} accessibilityLabel="Close notifications" accessibilityRole="button">
              <Ionicons name="close" size={22} color={BSColors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            {[
              { icon: 'checkmark-circle-outline', color: BSColors.success, title: 'Transfer Successful', body: 'Your transfer of $250.00 was completed.', time: '2 min ago' },
              { icon: 'card-outline', color: primaryColor, title: 'Card Payment', body: 'A payment of $45.99 was made with your card.', time: '1 hr ago' },
              { icon: 'alert-circle-outline', color: BSColors.warning, title: 'Low Balance Alert', body: 'Your checking account balance is below $100.', time: '3 hr ago' },
              { icon: 'gift-outline', color: BSColors.purple, title: 'Cashback Earned', body: 'You earned $5.00 cashback on your last purchase.', time: 'Yesterday' },
              { icon: 'shield-checkmark-outline', color: BSColors.info, title: 'Security Update', body: 'Your account password was changed successfully.', time: '2 days ago' },
            ].map((n, i) => (
              <View key={i} style={styles.notifItem}>
                <View style={[styles.notifIconWrap, { backgroundColor: n.color + '15' }]}>
                  <Ionicons name={n.icon as any} size={20} color={n.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifItemTitle}>{n.title}</Text>
                  <Text style={styles.notifItemBody}>{n.body}</Text>
                  <Text style={styles.notifItemTime}>{n.time}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>


      {/* QR Result Modal — shown after native camera capture + decode */}
      <Modal visible={showQRModal} transparent animationType="fade">
        <View style={styles.pinOverlay}>
          <View style={styles.qrResultModal}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Ionicons name="qr-code-outline" size={24} color={BSColors.primary} />
              <Text style={styles.pinModalTitle}>QR Result</Text>
            </View>
            <Text style={styles.qrResultText} testID="qr-result-text" selectable>{qrResult ?? ''}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.qrResultBtn, { backgroundColor: BSColors.successDark }]}
                onPress={() => { setShowQRModal(false); setScanned(false); setQrResult(null); openQRScanner(); }}
                testID="scan-again-btn"
              >
                <Ionicons name="refresh" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.qrResultBtnText}>Scan Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.qrResultBtn, { backgroundColor: BSColors.darkGray }]}
                onPress={() => { setShowQRModal(false); setScanned(false); setQrResult(null); }}
                testID="qr-close-btn"
              >
                <Ionicons name="close" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.qrResultBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BSColors.bgPage },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greeting: { color: BSColors.darkGray, fontSize: 13, fontFamily: 'Urbanist-Medium' },
  userName: { color: BSColors.textPrimary, fontSize: 22, fontFamily: 'Urbanist-ExtraBold', letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BSColors.white, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1, maxWidth: 130 },
  locationText: { fontSize: 11, fontFamily: 'Urbanist-SemiBold', flexShrink: 1 },
  notifBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: BSColors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 },
  notifDot: { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: BSColors.white },

  // Theme toggle
  themeToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 18, borderWidth: 1 },
  themeToggleLabel: { flex: 1, fontSize: 13, fontFamily: 'Urbanist-SemiBold' },

  // Balance card
  balanceCard: { borderRadius: 24, padding: 24, marginBottom: 24, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 6, overflow: 'hidden' },
  cardCircle: { position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80 },
  balanceCardGreen: { marginLeft: -6, marginTop: -4 },
  balanceCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  balanceLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontFamily: 'Urbanist-Medium', marginBottom: 2 },
  balanceCurrency: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Urbanist-SemiBold', letterSpacing: 1 },
  eyeBtn: { padding: 4 },
  balanceAmount: { color: BSColors.white, fontSize: 36, fontFamily: 'Urbanist-ExtraBold', letterSpacing: -0.5, marginBottom: 20 },
  balanceDividerLine: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 16 },
  balanceRow: { flexDirection: 'row', alignItems: 'center' },
  balanceItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  balanceItemIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  balanceItemLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginBottom: 2 },
  balanceItemValue: { color: BSColors.white, fontSize: 15, fontFamily: 'Urbanist-Bold' },
  balanceVertDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8 },

  // Quick actions
  sectionTitle: { color: BSColors.textPrimary, fontSize: 16, fontFamily: 'Urbanist-Bold', marginBottom: 14 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16, marginBottom: 28 },
  quickAction: { width: '31%', alignItems: 'center', gap: 8 },
  quickActionIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { color: BSColors.textSecondary, fontSize: 12, fontFamily: 'Urbanist-SemiBold', textAlign: 'center' },

  // Transactions
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAll: { fontSize: 13, fontFamily: 'Urbanist-SemiBold' },
  transactionCard: { backgroundColor: BSColors.white, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: BSColors.lightGray },
  txIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txMerchant: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-SemiBold', marginBottom: 2 },
  txCategory: { color: BSColors.darkGray, fontSize: 12 },
  txAmount: { fontSize: 14, fontFamily: 'Urbanist-Bold' },
  txCredit: { color: BSColors.success },
  txDebit: { color: BSColors.error },
  emptyTx: { padding: 32, alignItems: 'center', gap: 10 },
  emptyTxText: { color: BSColors.darkGray, fontSize: 13 },

  // Notifications
  notifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: BSColors.mediumGray },
  notifTitle: { color: BSColors.textPrimary, fontSize: 20, fontFamily: 'Urbanist-ExtraBold' },
  notifCloseBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: BSColors.lightGray, alignItems: 'center', justifyContent: 'center' },
  notifItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: BSColors.white, borderRadius: 16, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  notifIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifItemTitle: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-Bold', marginBottom: 3 },
  notifItemBody: { color: BSColors.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 4 },
  notifItemTime: { color: BSColors.darkGray, fontSize: 11 },

  // QR result modal
  pinOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  pinModalTitle: { color: BSColors.textPrimary, fontSize: 18, fontFamily: 'Urbanist-Bold' },
  qrResultModal: { backgroundColor: BSColors.white, borderRadius: 20, padding: 24, width: '88%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  qrResultText: { color: BSColors.textPrimary, fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 4 },
  qrResultBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 12 },
  qrResultBtnText: { color: BSColors.white, fontSize: 14, fontFamily: 'Urbanist-Bold' },
});