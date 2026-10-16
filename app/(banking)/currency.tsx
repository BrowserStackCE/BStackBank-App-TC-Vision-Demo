import { CurrencyShimmer } from '@/components/shimmer';
import { BSColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface RegionInfo {
  ip: string;
  city: string;
  region: string;
  country: string;          // ISO code e.g. "IN"
  countryName: string;      // e.g. "India"
  continent: string;
  timezone: string;
  currency: string;
  callingCode: string;
  languages: string;
  latitude: string;
  longitude: string;
  org: string;              // ISP / org
}

async function fetchRegionInfo(): Promise<RegionInfo> {
  // Try multiple HTTPS-only providers in order (HTTP is blocked on BrowserStack devices)
  let d: any = null;

  // 1. ipapi.co — HTTPS, reliable on BrowserStack
  try {
    const res = await fetch('https://ipapi.co/json/', { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const j = await res.json();
      if (j && j.ip && !j.error) {
        d = {
          status: 'success',
          query: j.ip,
          country: j.country_name,
          countryCode: j.country_code,
          regionName: j.region,
          city: j.city,
          timezone: j.timezone,
          currency: j.currency,
          org: j.org,
          lat: j.latitude,
          lon: j.longitude,
        };
      }
    }
  } catch { /* fall through */ }

  // 2. ipwho.is — HTTPS, no API key needed
  if (!d) {
    try {
      const res = await fetch('https://ipwho.is/', { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const j = await res.json();
        if (j && j.ip && j.success !== false) {
          d = {
            status: 'success',
            query: j.ip,
            country: j.country,
            countryCode: j.country_code,
            regionName: j.region,
            city: j.city,
            timezone: j.timezone?.id ?? j.timezone,
            currency: j.currency?.code ?? '—',
            org: j.connection?.org ?? j.connection?.isp ?? '—',
            lat: j.latitude,
            lon: j.longitude,
          };
        }
      }
    } catch { /* fall through */ }
  }

  // 3. ip-api.com HTTPS (requires pro for HTTPS, but try anyway)
  if (!d) {
    try {
      const res = await fetch(
        'https://ip-api.com/json/?fields=status,message,query,country,countryCode,regionName,city,timezone,currency,org,lat,lon'
      );
      if (res.ok) {
        const j = await res.json();
        if (j && j.status === 'success') d = j;
      }
    } catch { /* fall through */ }
  }

  if (!d) throw new Error('Network request failed');
  if (d.status !== 'success' && !d.ip) throw new Error(d.message || 'Lookup failed');
  return {
    ip: d.query ?? d.ip ?? '—',
    city: d.city ?? '—',
    region: d.regionName ?? d.region ?? '—',
    country: d.countryCode ?? '—',
    countryName: d.country ?? d.country_name ?? '—',
    continent: '—',
    timezone: d.timezone ?? '—',
    currency: d.currency ?? '—',
    callingCode: '—',
    languages: '—',
    latitude: d.lat != null ? String(d.lat) : d.latitude != null ? String(d.latitude) : '—',
    longitude: d.lon != null ? String(d.lon) : d.longitude != null ? String(d.longitude) : '—',
    org: d.org ?? '—',
  };
}

const CONTINENT_LABEL: Record<string, string> = {
  AF: 'Africa', AN: 'Antarctica', AS: 'Asia', EU: 'Europe',
  NA: 'North America', OC: 'Oceania', SA: 'South America',
};

export default function RegionScreen() {
  const router = useRouter();
  const { primaryColor } = useTheme();

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<RegionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    fetchRegionInfo()
      .then(setInfo)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const INFO_ROWS = info ? [
    { icon: 'location-outline',       label: 'City',           value: info.city },
    { icon: 'map-outline',            label: 'Region / State', value: info.region },
    { icon: 'flag-outline',           label: 'Country',        value: `${info.countryName} (${info.country})` },
    { icon: 'earth-outline',          label: 'Continent',      value: CONTINENT_LABEL[info.continent] ?? info.continent },
    { icon: 'time-outline',           label: 'Timezone',       value: info.timezone },
    { icon: 'cash-outline',           label: 'Currency',       value: info.currency },
    { icon: 'call-outline',           label: 'Calling Code',   value: info.callingCode },
    { icon: 'language-outline',       label: 'Languages',      value: info.languages },
    { icon: 'navigate-outline',       label: 'Coordinates',    value: `${info.latitude}, ${info.longitude}` },
    { icon: 'wifi-outline',           label: 'ISP / Org',      value: info.org },
    { icon: 'shield-outline',         label: 'IP Address',     value: info.ip },
  ] : [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
          <Ionicons name="arrow-back" size={20} color={BSColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Region Info</Text>
        <TouchableOpacity onPress={loadData} style={styles.refreshBtn} disabled={loading} testID="refresh-region-btn">
          {loading
            ? <ActivityIndicator size="small" color={primaryColor} />
            : <Ionicons name="refresh-outline" size={20} color={primaryColor} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <CurrencyShimmer />
        ) : error ? (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={32} color={BSColors.darkGray} />
            <Text style={styles.errorText}>Could not fetch region data</Text>
            <Text style={styles.errorSub}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Hero */}
            <View style={[styles.heroCard, { backgroundColor: primaryColor }]}>
              <Ionicons name="globe-outline" size={32} color="#fff" />
              <Text style={styles.heroCode}>{info!.countryName}</Text>
              <Text style={styles.heroSub}>{info!.city}{info!.region !== info!.city ? `, ${info!.region}` : ''}</Text>
              <View style={styles.heroBadge}>
                <Ionicons name="globe-outline" size={12} color="rgba(255,255,255,0.8)" />
                <Text style={styles.heroBadgeText}>Detected from your IP address</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Region Details</Text>
            <View style={styles.infoCard}>
              {INFO_ROWS.map((row, i) => (
                <View key={row.label} style={[styles.infoRow, i < INFO_ROWS.length - 1 && styles.infoRowBorder]}>
                  <View style={[styles.infoIconWrap, { backgroundColor: primaryColor + '15' }]}>
                    <Ionicons name={row.icon as any} size={16} color={primaryColor} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{row.label}</Text>
                    <Text style={styles.infoValue}>{row.value}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.noteCard}>
              <Ionicons name="information-circle-outline" size={16} color={BSColors.info} />
              <Text style={styles.noteText}>
                Region data is fetched live from your device&apos;s public IP address. Results reflect your current network location.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BSColors.bgPage },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: BSColors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  pageTitle: { color: BSColors.textPrimary, fontSize: 18, fontFamily: 'Urbanist-ExtraBold' },
  refreshBtn: { width: 38, height: 38 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  heroCard: { borderRadius: 24, padding: 32, alignItems: 'center', marginBottom: 24, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8 },
  heroFlag: { fontSize: 56, marginBottom: 8 },
  heroCode: { color: BSColors.white, fontSize: 28, fontFamily: 'Urbanist-ExtraBold', letterSpacing: 1, textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontFamily: 'Urbanist-Medium', marginBottom: 16, textAlign: 'center' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  heroBadgeText: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  sectionTitle: { color: BSColors.textPrimary, fontSize: 15, fontFamily: 'Urbanist-Bold', marginBottom: 12 },
  infoCard: { backgroundColor: BSColors.white, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: BSColors.lightGray },
  infoIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoContent: { flex: 1 },
  infoLabel: { color: BSColors.darkGray, fontSize: 11, fontFamily: 'Urbanist-SemiBold', marginBottom: 2 },
  infoValue: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-SemiBold' },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: BSColors.primaryBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BSColors.primaryBorder },
  noteText: { color: BSColors.textSecondary, fontSize: 12, flex: 1, lineHeight: 18 },
  errorCard: { alignItems: 'center', paddingTop: 80, gap: 12 },
  errorText: { color: BSColors.textPrimary, fontSize: 16, fontFamily: 'Urbanist-Bold' },
  errorSub: { color: BSColors.darkGray, fontSize: 13 },
});