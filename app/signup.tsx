import { BSColors } from '@/constants/theme';
import { api } from '@/store/api';
import { AuthStore } from '@/store/auth';
import { firstError, validateEmail, validatePassword, validatePasswordMatch, validateRequired } from '@/utils/validation';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignupScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const autoFillNewUser = () => {
    const firstNames = ['Alex', 'Jordan', 'Morgan', 'Taylor', 'Casey', 'Riley', 'Jamie', 'Avery', 'Quinn', 'Blake'];
    const lastNames = ['Johnson', 'Smith', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Anderson', 'Thomas'];
    const first = firstNames[Math.floor(Math.random() * firstNames.length)];
    const last = lastNames[Math.floor(Math.random() * lastNames.length)];
    // timestamp + random guarantees uniqueness across runs — no duplicate emails
    const suffix = Date.now().toString().slice(-5) + Math.floor(10 + Math.random() * 90);
    setFullName(`${first} ${last}`);
    setEmail(`${first.toLowerCase()}.${last.toLowerCase()}${suffix}@example.com`);
    setPassword('SecurePass@123');
    setConfirmPassword('SecurePass@123');
    setError('');
  };

  const handleSignup = async () => {
    const validationError = firstError(
      validateRequired(fullName, 'Full name'),
      validateEmail(email),
      validatePassword(password),
      validatePasswordMatch(password, confirmPassword),
    );
    if (validationError) { setError(validationError); return; }
    setError('');
    setLoading(true);
    try {
      const res = await api.signup(fullName, email, password);
      await AuthStore.setSession(res.token, res.user);
      AuthStore.setEmail(email);
      router.replace('/(banking)/home' as any);
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join BrowserStack today</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input} placeholder="Enter your full name"
            placeholderTextColor="#AAA" value={fullName}
            onChangeText={setFullName} testID="fullname-input"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input} placeholder="Enter your email"
            placeholderTextColor="#AAA" value={email}
            onChangeText={setEmail} keyboardType="email-address"
            autoCapitalize="none" testID="email-input"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput} placeholder="Create a password"
              placeholderTextColor="#AAA" value={password}
              onChangeText={setPassword} secureTextEntry={!showPassword} testID="password-input"
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn} testID="toggle-password-visibility" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} accessibilityRole="button">
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput} placeholder="Confirm your password"
              placeholderTextColor="#AAA" value={confirmPassword}
              onChangeText={setConfirmPassword} secureTextEntry={!showConfirmPassword} testID="confirm-password-input"
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(v => !v)} style={styles.eyeBtn} testID="toggle-confirm-password-visibility" accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} accessibilityRole="button">
              <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {error ? <Text style={styles.error} testID="signup-error">{error}</Text> : null}

        <TouchableOpacity style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={handleSignup} disabled={loading} testID="signup-btn" accessibilityLabel="Create your account" accessibilityRole="button" accessibilityState={{ disabled: loading }}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow} onPress={() => router.replace('/' as any)} testID="goto-login">
          <Text style={styles.linkText}>Already have an account? <Text style={styles.link}>Sign In</Text></Text>
        </TouchableOpacity>

        {/* Mock Data Controller Bar */}
        <View style={styles.mockBar}>
          <Text style={styles.mockBarTitle}>Mock Data Controller</Text>
          <TouchableOpacity style={styles.mockBtn} onPress={autoFillNewUser} testID="autofill-new-user">
            <Text style={styles.mockBtnText}>Auto-fill</Text>
          </TouchableOpacity>
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
  passwordWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: BSColors.white, borderRadius: 12, borderWidth: 1.5, borderColor: BSColors.indigoBorder,
  },
  passwordInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Urbanist-Medium', color: BSColors.textPrimary },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  error: { color: BSColors.errorDeeper, fontSize: 13, fontFamily: 'Urbanist-Medium', marginBottom: 14, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: BSColors.primary, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginBottom: 20, marginTop: 8,
    shadowColor: BSColors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  primaryBtnText: { color: BSColors.white, fontSize: 16, fontFamily: 'Urbanist-Bold' },
  linkRow: { marginBottom: 36 },
  linkText: { color: BSColors.darkGray, textAlign: 'center', fontSize: 14, fontFamily: 'Urbanist-Medium' },
  link: { color: BSColors.primary, fontFamily: 'Urbanist-Bold' },
  mockBar: { backgroundColor: BSColors.indigoBg, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: BSColors.primary, marginTop: 8 },
  mockBarTitle: { color: BSColors.primary, fontFamily: 'Urbanist-Bold', fontSize: 11, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  mockBtn: { backgroundColor: BSColors.primary, borderRadius: 8, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  mockBtnText: { color: BSColors.white, fontSize: 13, fontFamily: 'Urbanist-SemiBold' },
});