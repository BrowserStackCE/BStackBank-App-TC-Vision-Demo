import { BSColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet, Text,
  TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { withShimmer } from '@/components/shimmer';

function WebViewScreen() {
  const router = useRouter();
  const { primaryColor } = useTheme();
  const params = useLocalSearchParams<{ url?: string; title?: string; html?: string }>();

  const rawUrl = params.url || 'https://www.moneycontrol.com/news/business/markets/';
  const title = params.title || 'Financial News';
  // Support inline HTML passed as param (for deep-link verification page)
  const inlineHtml = params.html || null;
  // Detect data: URIs and extract HTML from them (legacy support)
  const isDataUri = rawUrl.startsWith('data:text/html');
  let extractedHtml: string | null = null;
  if (isDataUri) {
    try {
      extractedHtml = decodeURIComponent(rawUrl.replace(/^data:text\/html,/, ''));
    } catch {
      // If decoding fails, use the raw string as-is
      extractedHtml = rawUrl.replace(/^data:text\/html,/, '');
    }
  }
  const url = isDataUri ? 'about:blank' : rawUrl;
  const htmlSource = inlineHtml || extractedHtml;

  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(rawUrl);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} accessibilityLabel="Close" accessibilityRole="button">
          <Ionicons name="close" size={20} color={BSColors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.urlText} numberOfLines={1}>
            {currentUrl.replace(/^https?:\/\//, '').split('/')[0]}
          </Text>
        </View>
        <View style={[styles.secureBadge, { backgroundColor: primaryColor + '15' }]}>
          <Ionicons name="lock-closed" size={10} color={primaryColor} />
          <Text style={[styles.secureText, { color: primaryColor }]}>Secure</Text>
        </View>
      </View>

      {/* Progress bar */}
      {loading && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { backgroundColor: primaryColor }]} />
        </View>
      )}

      {/* WebView */}
      {error ? (
        <View style={styles.errorWrap}>
          <Ionicons name="wifi-outline" size={48} color={BSColors.mediumGray} />
          <Text style={styles.errorTitle}>Page unavailable</Text>
          <Text style={styles.errorSub}>Check your connection and try again.</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: primaryColor }]}
            onPress={() => { setError(false); webRef.current?.reload(); }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webRef}
          source={htmlSource ? { html: htmlSource } : { uri: url }}
          style={styles.webview}
          onLoadStart={() => { setLoading(true); setError(false); }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          onNavigationStateChange={state => {
            setCanGoBack(state.canGoBack);
            setCanGoForward(state.canGoForward);
            setCurrentUrl(state.url);
            // Intercept deep links (e.g. demobankingapp://verified) — iOS blocks these in WKWebView
            if (state.url && state.url.startsWith('demobankingapp://')) {
              // Navigate back to profile with deeplink_verified=1 so it can mark email as verified
              router.replace({ pathname: '/(banking)/profile' as any, params: { deeplink_verified: '1' } });
            }
          }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          )}
        />
      )}

      {/* Bottom nav bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.navBtn, !canGoBack && styles.navBtnDisabled]}
          onPress={() => webRef.current?.goBack()}
          disabled={!canGoBack}>
          <Ionicons name="chevron-back" size={22} color={canGoBack ? BSColors.textPrimary : BSColors.mediumGray} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navBtn, !canGoForward && styles.navBtnDisabled]}
          onPress={() => webRef.current?.goForward()}
          disabled={!canGoForward}>
          <Ionicons name="chevron-forward" size={22} color={canGoForward ? BSColors.textPrimary : BSColors.mediumGray} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => webRef.current?.reload()}>
          <Ionicons name="refresh" size={20} color={BSColors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.back()}>
          <Ionicons name="home-outline" size={20} color={BSColors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => {
            const { Linking: L } = require('react-native') as typeof import('react-native');
            // Try Chrome first (Android), fall back to default browser
            const chromeUrl = `googlechrome://${currentUrl.replace(/^https?:\/\//, '')}`;
            L.canOpenURL(chromeUrl)
              .then((supported: boolean) => {
                if (supported) return L.openURL(chromeUrl);
                return L.openURL(currentUrl);
              })
              .catch(() => L.openURL(currentUrl));
          }}
          testID="open-in-chrome-btn"
        >
          <Ionicons name="open-outline" size={20} color={BSColors.textPrimary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BSColors.bgPage },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10, backgroundColor: BSColors.white, borderBottomWidth: 1, borderBottomColor: BSColors.mediumGray },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: BSColors.lightGray, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1 },
  title: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-Bold' },
  urlText: { color: BSColors.darkGray, fontSize: 11, marginTop: 1 },
  secureBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  secureText: { fontSize: 10, fontFamily: 'Urbanist-Bold' },
  progressBar: { height: 2, backgroundColor: BSColors.lightGray },
  progressFill: { height: 2, width: '60%' },
  webview: { flex: 1 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: BSColors.bgPage },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  errorTitle: { color: BSColors.textPrimary, fontSize: 18, fontFamily: 'Urbanist-Bold' },
  errorSub: { color: BSColors.darkGray, fontSize: 14, textAlign: 'center' },
  retryBtn: { borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12, marginTop: 8 },
  retryText: { color: BSColors.white, fontSize: 15, fontFamily: 'Urbanist-Bold' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: BSColors.white, borderTopWidth: 1, borderTopColor: BSColors.mediumGray, paddingVertical: 10, paddingBottom: 16 },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  navBtnDisabled: { opacity: 0.4 },
});

export default withShimmer(WebViewScreen);
