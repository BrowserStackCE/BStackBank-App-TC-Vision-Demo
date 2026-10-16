import { Shimmer } from '@/components/shimmer';
import { BSColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/store/api';
import { AuthStore, useAuthStore } from '@/store/auth';
import { BankStore } from '@/store/banking';
import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Fields the backend does not provide show a dash rather than made-up details.
const EMPTY_VALUE = '—';

function initialUserInfo() {
  const user = AuthStore.getUser();
  return {
    name: user?.fullName ?? '',
    email: user?.email ?? '',
    phone: EMPTY_VALUE,
    dob: EMPTY_VALUE,
    address: EMPTY_VALUE,
    accountNumber: EMPTY_VALUE,
    accountType: EMPTY_VALUE,
    memberSince: EMPTY_VALUE,
    kycStatus: user?.kycStatus === 'verified' ? 'Verified' : 'Pending',
  };
}

export default function ProfileScreen() {
  const { primaryColor, primaryBorder, greenMode } = useTheme();
  const router = useRouter();
  const [balance, setBalance] = useState(BankStore.getBalance());
  const [txCount, setTxCount] = useState(BankStore.getTransactions().length);
  const [userInfo, setUserInfo] = useState(initialUserInfo);
  const [profileLoading, setProfileLoading] = useState(true);
  const avatarUrl = useAuthStore(s => s.user?.avatarUrl) ?? null;
  const biometricEnabled = useAuthStore(s => s.biometricEnabled);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [viewPhoto, setViewPhoto] = useState(false);

  const pickAndUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to choose a profile picture.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhotoBusy(true);
    try {
      const base64 = await new File(asset.uri).base64();
      const res = await api.uploadAvatar(`data:${asset.mimeType ?? 'image/jpeg'};base64,${base64}`);
      await AuthStore.setAvatarUrl(res.avatarUrl);
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message || 'Could not upload your photo. Please try again.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = () => {
    Alert.alert('Remove photo', 'Remove your profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        setPhotoBusy(true);
        try {
          await api.deleteAvatar();
          await AuthStore.setAvatarUrl(null);
        } catch (err: any) {
          Alert.alert('Could not remove photo', err?.message || 'Please try again.');
        } finally {
          setPhotoBusy(false);
        }
      }},
    ]);
  };

  const photoActions = () => {
    const options: any[] = [];
    if (avatarUrl) options.push({ text: 'View photo', onPress: () => setViewPhoto(true) });
    options.push({ text: avatarUrl ? 'Change photo' : 'Upload photo', onPress: pickAndUpload });
    if (avatarUrl) options.push({ text: 'Remove photo', style: 'destructive', onPress: removePhoto });
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile photo', undefined, options);
  };

  useEffect(() => {
    const unsub = BankStore.subscribe(() => {
      setBalance(BankStore.getBalance());
      setTxCount(BankStore.getTransactions().length);
    });
    // Load real profile from API
    api.getProfile().then(profile => {
      if (profile) {
        setUserInfo(prev => ({
          ...prev,
          name: profile.fullName || prev.name,
          email: profile.email || prev.email,
          kycStatus: profile.kycStatus === 'verified' ? 'Verified' : 'Pending',
          accountNumber: profile.account ? `****${profile.account.id.slice(-4)}` : prev.accountNumber,
          memberSince: profile.memberSince
            ? new Date(profile.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : prev.memberSince,
        }));
      }
    }).catch(() => { /* use defaults */ }).finally(() => setProfileLoading(false));
    return unsub;
  }, []);

  const PROTECTED_EMAILS = ['yash@gmail.com'];
  const isProtectedAccount = PROTECTED_EMAILS.includes(userInfo.email.toLowerCase());

  const handleDeleteAccount = async () => {
    if (isProtectedAccount) {
      Alert.alert('Cannot Delete', 'This account cannot be deleted.');
      return;
    }
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await api.deleteAccount();
            } catch (err: any) {
              const msg = err?.message || '';
              if (msg.includes('cannot be deleted')) {
                Alert.alert('Cannot Delete', msg);
                return;
              }
              // Other errors — proceed with local logout
            }
            await AuthStore.logout();
            router.replace('/' as any);
          },
        },
      ],
    );
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await AuthStore.logout();
        router.replace('/' as any);
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          {profileLoading ? (
            <>
              <Shimmer width={80} height={80} borderRadius={40} style={{ marginBottom: 12 }} />
              <Shimmer width={160} height={20} borderRadius={10} style={{ marginBottom: 8 }} />
              <Shimmer width={200} height={14} borderRadius={7} style={{ marginBottom: 10 }} />
              <Shimmer width={100} height={24} borderRadius={12} />
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={photoActions}
                disabled={photoBusy}
                activeOpacity={0.8}
                testID="profile-photo-btn"
                accessibilityRole="button"
                accessibilityLabel={avatarUrl ? 'Profile photo options' : 'Upload profile photo'}
              >
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                    testID="profile-avatar-image"
                  />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{userInfo.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  {photoBusy
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="camera" size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
              <Text style={styles.userName}>{userInfo.name}</Text>
              <Text style={styles.userEmail}>{userInfo.email}</Text>
              <View style={styles.kycBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#059669" />
                <Text style={styles.kycText}>KYC {userInfo.kycStatus}</Text>
              </View>
            </>
          )}
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, greenMode && { flexDirection: "column" }]}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>${balance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
            <Text style={styles.statLabel}>Balance</Text>
          </View>
          <View style={[styles.statCard, styles.statCardMiddle]}>
            <Text style={styles.statValue}>{txCount}</Text>
            <Text style={styles.statLabel}>Transactions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>2</Text>
            <Text style={styles.statLabel}>Cards</Text>
          </View>
        </View>

        {/* Personal Info */}
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={styles.infoCard}>
          {profileLoading ? (
            [1,2,3,4,5].map(i => (
              <View key={i} style={[styles.infoRow, i === 5 && { borderBottomWidth: 0 }]}>
                <Shimmer width={36} height={36} borderRadius={10} style={{ marginRight: 12 }} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Shimmer width="30%" height={11} borderRadius={6} />
                  <Shimmer width="65%" height={14} borderRadius={7} />
                </View>
              </View>
            ))
          ) : (
            [
              { icon: 'person-outline', label: 'Full Name', value: userInfo.name },
              { icon: 'mail-outline', label: 'Email', value: userInfo.email },
            ].map((item, i, arr) => (
              <View key={item.label} style={[styles.infoRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name={item.icon as any} size={18} color={primaryColor} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Account Info */}
        <Text style={styles.sectionTitle}>Account Details</Text>
        <View style={styles.infoCard}>
          {profileLoading ? (
            [1,2,3].map(i => (
              <View key={i} style={[styles.infoRow, i === 3 && { borderBottomWidth: 0 }]}>
                <Shimmer width={36} height={36} borderRadius={10} style={{ marginRight: 12 }} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Shimmer width="30%" height={11} borderRadius={6} />
                  <Shimmer width="55%" height={14} borderRadius={7} />
                </View>
              </View>
            ))
          ) : (
            [
              { icon: 'card-outline', label: 'Account Number', value: userInfo.accountNumber },
              { icon: 'time-outline', label: 'Member Since', value: userInfo.memberSince },
            ].filter(item => item.value && item.value !== EMPTY_VALUE).map((item, i, arr) => (
              <View key={item.label} style={[styles.infoRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name={item.icon as any} size={18} color={primaryColor} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.infoCard}>
          {/* Biometric confirmation toggle (transfers and shop balance payments) */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="finger-print-outline" size={18} color={primaryColor} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoValue}>Biometric Confirmation</Text>
              <Text style={styles.infoLabel}>{biometricEnabled ? 'Enabled' : 'Disabled'}</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={(val) => AuthStore.setBiometricEnabled(val)}
              trackColor={{ false: BSColors.mediumGray, true: BSColors.primary + '80' }}
              thumbColor={biometricEnabled ? BSColors.primary : BSColors.slate300}
              testID="biometric-toggle"
              accessibilityLabel={biometricEnabled ? 'Biometric confirmation is enabled, tap to disable' : 'Biometric confirmation is disabled, tap to enable'}
              accessibilityRole="switch"
            />
          </View>
          <TouchableOpacity
            style={[styles.infoRow, { borderBottomWidth: 0 }]}
            onPress={() => router.push({ pathname: '/(banking)/webview' as any, params: { url: 'https://www.reuters.com/finance/', title: 'Financial News' } })}
          >
            <View style={styles.infoIconWrap}>
              <Ionicons name="newspaper-outline" size={18} color={primaryColor} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoValue}>Financial News</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={primaryBorder} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          testID="logout-btn"
          accessibilityLabel="Sign out of your account"
          accessibilityRole="button"
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteBtn, isProtectedAccount && styles.deleteBtnDisabled]}
          onPress={handleDeleteAccount}
          testID="delete-account-btn"
          accessibilityLabel={isProtectedAccount ? 'Delete account is disabled for this account' : 'Delete your account permanently'}
          accessibilityRole="button"
          accessibilityState={{ disabled: isProtectedAccount }}
        >
          <Ionicons name="trash-outline" size={18} color={isProtectedAccount ? BSColors.slate300 : '#DC2626'} />
          <Text style={[styles.deleteText, isProtectedAccount && styles.deleteTextDisabled]}>
            {isProtectedAccount ? 'Delete Account (Protected)' : 'Delete Account'}
          </Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal visible={viewPhoto} transparent animationType="fade" onRequestClose={() => setViewPhoto(false)}>
        <TouchableOpacity style={styles.photoOverlay} activeOpacity={1} onPress={() => setViewPhoto(false)} accessibilityLabel="Close photo">
          {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.photoFull} resizeMode="contain" testID="profile-photo-full" /> : null}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BSColors.bgPageAlt },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: BSColors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: BSColors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  avatarImage: { width: 80, height: 80, borderRadius: 40, marginBottom: 12, shadowColor: BSColors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  avatarText: { color: BSColors.white, fontSize: 28, fontFamily: 'Urbanist-ExtraBold' },
  cameraBadge: { position: 'absolute', right: 0, bottom: 12, width: 26, height: 26, borderRadius: 13, backgroundColor: BSColors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: BSColors.white },
  photoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  photoFull: { width: '92%', height: '70%' },
  userName: { color: BSColors.textPrimary, fontSize: 20, fontFamily: 'Urbanist-Bold', marginBottom: 4 },
  userEmail: { color: BSColors.darkGray, fontSize: 14, marginBottom: 10 },
  kycBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: BSColors.successBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: BSColors.successBorder },
  kycText: { color: BSColors.successDark, fontSize: 12, fontFamily: 'Urbanist-Bold' },
  statsRow: { flexDirection: 'row', backgroundColor: BSColors.white, borderRadius: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statCardMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: BSColors.lightGray },
  statValue: { color: BSColors.primary, fontSize: 18, fontFamily: 'Urbanist-ExtraBold', marginBottom: 2 },
  statLabel: { color: BSColors.slate300, fontSize: 11, fontFamily: 'Urbanist-SemiBold' },
  sectionTitle: { color: BSColors.textPrimary, fontSize: 15, fontFamily: 'Urbanist-Bold', marginBottom: 10 },
  infoCard: { backgroundColor: BSColors.white, borderRadius: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BSColors.lightGray },
  infoIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: BSColors.indigoBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  infoContent: { flex: 1 },
  infoLabel: { color: BSColors.slate300, fontSize: 11, marginBottom: 2 },
  infoValue: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-Medium' },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteTextDisabled: { color: BSColors.slate300 },
  insightsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 18, padding: 18, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  insightsLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  insightsIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  insightsTitle: { color: BSColors.white, fontSize: 15, fontFamily: 'Urbanist-ExtraBold', marginBottom: 2 },
  insightsSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BSColors.errorBg, borderRadius: 14, paddingVertical: 16, borderWidth: 1.5, borderColor: BSColors.errorBorder, marginBottom: 12 },
  logoutText: { color: BSColors.errorDark, fontSize: 16, fontFamily: 'Urbanist-Bold' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BSColors.white, borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: BSColors.errorBorder },
  deleteText: { color: BSColors.errorDark, fontSize: 14, fontFamily: 'Urbanist-SemiBold' },
  verifyCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: BSColors.white, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: BSColors.indigoBorder },
  verifyCardDone: { borderColor: BSColors.successBorder, backgroundColor: BSColors.successBg },
  verifyIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  verifyTitle: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-Bold', marginBottom: 2 },
  verifySub: { color: BSColors.darkGray, fontSize: 12 },
});