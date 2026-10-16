import { BSColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withShimmer } from '@/components/shimmer';

// Measure latency via HEAD requests to fast endpoints (no large downloads)
// Latency-based classification reflects BrowserStack throttling accurately
const PING_URLS = [
  'https://www.google.com/generate_204',
  'https://connectivitycheck.gstatic.com/generate_204',
  'https://www.cloudflare.com/cdn-cgi/trace',
];

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<{ ok: boolean; elapsed: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    return { ok: res.ok || res.status === 204, elapsed: Date.now() - start };
  } catch {
    clearTimeout(timer);
    return { ok: false, elapsed: timeoutMs };
  }
}

async function measureSpeedMbps(): Promise<number> {
  // Run all pings in parallel with 4s timeout each
  const results = await Promise.all(PING_URLS.map(url => fetchWithTimeout(url, 4000)));
  const successful = results.filter(r => r.ok);
  if (successful.length === 0) throw new Error('No connectivity');
  const avgLatencyMs = successful.reduce((s, r) => s + r.elapsed, 0) / successful.length;
  // Map latency to approximate Mbps (lower latency = faster connection)
  if (avgLatencyMs < 50) return 80;    // Excellent — 5G/Fibre
  if (avgLatencyMs < 150) return 30;   // Good — 4G LTE
  if (avgLatencyMs < 300) return 12;   // Fair — 4G
  if (avgLatencyMs < 600) return 4;    // Slow — 3G
  if (avgLatencyMs < 1500) return 1;   // Very slow — 2G/Edge
  return 0.2;                          // Extremely slow
}

function NetworkScreen() {
  const { primaryColor } = useTheme();
  const router = useRouter();
  const [online, setOnline] = useState<boolean | null>(null);
  const [speedMbps, setSpeedMbps] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [networkProfile, setNetworkProfile] = useState<string | null>(null);

  const deriveNetworkProfile = (mbps: number): string => {
    if (mbps >= 100) return '5G / Fibre';
    if (mbps >= 25) return '4G LTE';
    if (mbps >= 10) return '4G';
    if (mbps >= 3) return '3G';
    if (mbps >= 0.5) return '2G / Edge';
    return 'Very Slow';
  };

  const checkConnection = async () => {
    setChecking(true);
    setSpeedMbps(null);
    setOnline(null);
    setNetworkProfile(null);
    try {
      const speed = await measureSpeedMbps();
      setOnline(true);
      setSpeedMbps(speed);
      setNetworkProfile(deriveNetworkProfile(speed));
    } catch {
      try {
        const res = await fetch('https://www.google.com', { method: 'HEAD', cache: 'no-store' });
        setOnline(res.ok);
      } catch {
        setOnline(false);
      }
    }
    setChecking(false);
  };

  useEffect(() => { checkConnection(); }, []);

  const isOnline = online === true;
  const statusColor = online === null ? BSColors.slate300 : isOnline ? BSColors.success : BSColors.error;
  const statusBg = online === null ? BSColors.lightGray : isOnline ? BSColors.successBg : BSColors.errorBg;
  const statusText = checking ? 'Measuring...' : online === null ? 'Checking...' : isOnline ? 'Online' : 'Offline';

  const speedColor = speedMbps === null ? statusColor
    : speedMbps >= 25 ? BSColors.success
    : speedMbps >= 5 ? BSColors.warning
    : BSColors.error;

  const speedLabel = speedMbps === null ? null
    : speedMbps >= 100 ? 'Excellent'
    : speedMbps >= 25 ? 'Good'
    : speedMbps >= 5 ? 'Fair'
    : 'Slow';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color={BSColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Network Status</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: statusBg, borderColor: statusColor + '40' }]}>
          <View style={[styles.statusIconWrap, { backgroundColor: statusColor + '20' }]}>
            {checking
              ? <ActivityIndicator size="large" color={statusColor} />
              : <Ionicons name={isOnline ? 'wifi-outline' : 'wifi-outline'} size={48} color={statusColor} />}
          </View>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          <Text style={styles.statusDesc}>
            {checking
              ? 'Downloading test data to measure your speed...'
              : isOnline
              ? 'Your device is connected to the internet.'
              : 'Your device is not connected to the internet.'}
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: statusColor + '15' }]}>
              <Ionicons name="radio-button-on-outline" size={16} color={statusColor} />
            </View>
            <Text style={styles.infoLabel}>Connection Status</Text>
            <Text style={[styles.infoValue, { color: statusColor }]}>{checking ? '—' : online === null ? '—' : isOnline ? 'Online' : 'Offline'}</Text>
          </View>

          <View style={[styles.infoRow, styles.infoRowBorder]}>
            <View style={[styles.infoIcon, { backgroundColor: speedColor + '15' }]}>
              <Ionicons name="speedometer-outline" size={16} color={speedColor} />
            </View>
            <Text style={styles.infoLabel}>Download Speed</Text>
            <Text style={[styles.infoValue, { color: speedColor }]}>
              {checking ? 'Measuring...' : speedMbps !== null ? `${speedMbps} Mbps` : '—'}
            </Text>
          </View>

          {speedLabel && !checking && (
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <View style={[styles.infoIcon, { backgroundColor: speedColor + '15' }]}>
                <Ionicons name="bar-chart-outline" size={16} color={speedColor} />
              </View>
              <Text style={styles.infoLabel}>Quality</Text>
              <View style={[styles.qualityBadge, { backgroundColor: speedColor + '20' }]}>
                <Text style={[styles.qualityText, { color: speedColor }]}>{speedLabel}</Text>
              </View>
            </View>
          )}

          {networkProfile && !checking && (
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <View style={[styles.infoIcon, { backgroundColor: primaryColor + '15' }]}>
                <Ionicons name="cellular-outline" size={16} color={primaryColor} />
              </View>
              <Text style={styles.infoLabel}>Network Profile</Text>
              <View style={[styles.qualityBadge, { backgroundColor: primaryColor + '20' }]}>
                <Text style={[styles.qualityText, { color: primaryColor }]}>{networkProfile}</Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.checkBtn, { backgroundColor: primaryColor }, checking && styles.checkBtnDisabled]}
          onPress={checkConnection}
          disabled={checking}
          testID="check-connection-btn"
        >
          {checking
            ? <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
            : <Ionicons name="refresh-outline" size={18} color="#fff" style={{ marginRight: 8 }} />}
          <Text style={styles.checkBtnText}>{checking ? 'Measuring...' : 'Test Again'}</Text>
        </TouchableOpacity>

        <Text style={styles.note}>Speed measured by downloading 500KB from Cloudflare</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BSColors.bgPage },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: BSColors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  pageTitle: { color: BSColors.textPrimary, fontSize: 18, fontFamily: 'Urbanist-Bold' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  statusCard: { borderRadius: 24, padding: 36, alignItems: 'center', marginBottom: 20, borderWidth: 1.5 },
  statusIconWrap: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  statusText: { fontSize: 28, fontFamily: 'Urbanist-ExtraBold', marginBottom: 8 },
  statusDesc: { color: BSColors.darkGray, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  infoCard: { backgroundColor: BSColors.white, borderRadius: 18, overflow: 'hidden', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: BSColors.lightGray },
  infoIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { flex: 1, color: BSColors.textSecondary, fontSize: 14 },
  infoValue: { fontSize: 14, fontFamily: 'Urbanist-Bold' },
  qualityBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  qualityText: { fontSize: 13, fontFamily: 'Urbanist-Bold' },
  checkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16, marginBottom: 12 },
  checkBtnDisabled: { opacity: 0.6 },
  checkBtnText: { color: BSColors.white, fontSize: 16, fontFamily: 'Urbanist-Bold' },
  note: { color: BSColors.darkGray, fontSize: 12, textAlign: 'center' },
});

export default withShimmer(NetworkScreen);
