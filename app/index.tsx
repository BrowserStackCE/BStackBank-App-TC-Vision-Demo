import { BSColors } from '@/constants/theme';
import { api } from '@/store/api';
import { AuthStore } from '@/store/auth';
import { firstError, validateEmail, validateRequired } from '@/utils/validation';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const autoFillRegular = () => { setEmail('yash@gmail.com'); setPassword('12345678'); setError(''); };
  const autoFillWrong = () => { setEmail('yash@gmail.com'); setPassword('wrongpass'); setError(''); };

  const handleLogin = async () => {
    const validationError = firstError(
      validateEmail(email),
      validateRequired(password, 'Password'),
    );
    if (validationError) { setError(validationError); return; }
    setError('');
    setLoading(true);
    try {
      const res = await api.login(email, password);
      await AuthStore.setSession(res.token, res.user);
      AuthStore.setEmail(email);
      router.replace(res.user.role === 'admin' ? '/(admin)/users' as any : '/(banking)/home' as any);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // A session restored at startup skips the login screen entirely (no flash, no extra request).
  const savedUser = AuthStore.getUser();
  if (savedUser) {
    return <Redirect href={(savedUser.role === 'admin' ? '/(admin)/users' : '/(banking)/home') as any} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        {/* Email */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#94A3B8"
            value={email}
            onChangeText={v => { setEmail(v); setError(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            testID="email-input"
          />
        </View>

        {/* Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={v => { setPassword(v); setError(''); }}
              secureTextEntry={!showPassword}
              testID="password-input"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(s => !s)} testID="toggle-password-visibility" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} accessibilityRole="button">
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          testID="login-btn"
          accessibilityLabel="Sign in to your account"
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
        >
          {loading ? <ActivityIndicator color="#fff" style={{ marginRight: 8 }} /> : null}
          <Text style={styles.primaryBtnText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow} onPress={() => router.replace('/signup' as any)} testID="goto-signup" accessibilityLabel="Go to sign up" accessibilityRole="link">
          <Text style={styles.linkText}>Don&apos;t have an account? <Text style={styles.link}>Sign Up</Text></Text>
        </TouchableOpacity>

        {/* Mock Data Controller Bar */}
        <View style={styles.mockBar}>
          <Text style={styles.mockBarTitle}>Mock Data Controller</Text>
          <View style={styles.mockButtons}>
            <TouchableOpacity style={styles.mockBtn} onPress={autoFillRegular} testID="autofill-regular">
              <Text style={styles.mockBtnText}>Regular User</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.mockBtn, styles.mockBtnWrong]} onPress={autoFillWrong} testID="autofill-incorrect">
              <Text style={styles.mockBtnText}>Wrong Login</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BSColors.bgPageAlt },
  container: { flex: 1, backgroundColor: BSColors.bgPageAlt },
  content: { paddingHorizontal: 28, paddingTop: 72, paddingBottom: 32 },
  title: { color: BSColors.textPrimary, fontSize: 28, fontFamily: 'Urbanist-Bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: BSColors.darkGray, fontSize: 15, fontFamily: 'Urbanist-Regular', textAlign: 'center', marginBottom: 36 },
  inputGroup: { marginBottom: 20 },
  label: { color: BSColors.slate700, fontSize: 14, fontFamily: 'Urbanist-SemiBold', marginBottom: 8 },
  input: {
    backgroundColor: BSColors.white, borderRadius: 12, borderWidth: 1.5,
    borderColor: BSColors.indigoBorder, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontFamily: 'Urbanist-Medium', color: BSColors.textPrimary,
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: BSColors.white,
    borderRadius: 12, borderWidth: 1.5, borderColor: BSColors.indigoBorder,
  },
  passwordInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Urbanist-Medium', color: BSColors.textPrimary,
  },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  error: { color: BSColors.errorDark, fontSize: 13, fontFamily: 'Urbanist-Medium', marginBottom: 14, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: BSColors.primary, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    marginBottom: 20, marginTop: 8,
    shadowColor: BSColors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: BSColors.white, fontSize: 16, fontFamily: 'Urbanist-Bold' },
  linkRow: { marginBottom: 36 },
  linkText: { color: BSColors.darkGray, textAlign: 'center', fontSize: 14, fontFamily: 'Urbanist-Medium' },
  link: { color: BSColors.primary, fontFamily: 'Urbanist-Bold' },
  mockBar: {
    backgroundColor: BSColors.indigoBg, borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: BSColors.indigoBorder, marginTop: 8,
  },
  mockBarTitle: { color: BSColors.primary, fontFamily: 'Urbanist-Bold', fontSize: 11, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  mockButtons: { flexDirection: 'row', gap: 8 },
  mockBtn: { flex: 1, backgroundColor: BSColors.primary, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  mockBtnWrong: { backgroundColor: BSColors.slate300 },
  mockBtnText: { color: BSColors.white, fontSize: 11, fontFamily: 'Urbanist-SemiBold' },
});