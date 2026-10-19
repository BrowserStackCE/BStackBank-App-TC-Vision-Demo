/**
 * TransactionAuthModal
 * Transaction authentication using native device biometric OR passcode.
 * No in-app PIN keypad — the OS system prompt handles everything.
 */
import { BSColors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Step = 'auth' | 'success' | 'failed';

interface Props {
  visible: boolean;
  amount?: string;
  description?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TransactionAuthModal({ visible, amount, description, onSuccess, onCancel }: Props) {
  const [step, setStep] = useState<Step>('auth');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [failReason, setFailReason] = useState('');

  useEffect(() => {
    if (visible) {
      setStep('auth');
      setAuthLoading(false);
      setAuthError('');
      setFailReason('');
    }
  }, [visible]);

  const handleSuccess = () => {
    setStep('success');
    setTimeout(() => onSuccess(), 600);
  };

  const handleRetry = () => {
    setStep('auth');
    setAuthLoading(false);
    setAuthError('');
    setFailReason('');
  };

  // Single native auth — biometric if available, falls back to device passcode.
  // disableDeviceFallback: false lets the OS show biometric OR passcode prompt.
  // Do NOT skip based on isEnrolled — BrowserStack executor handles it.
  // When biometric is disabled app-wide, skip auth and auto-succeed.
  const triggerAuth = async () => {
    const { AuthStore } = await import('@/store/auth');
    if (!AuthStore.getBiometricEnabled()) {
      handleSuccess();
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to authorize transaction',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      setAuthLoading(false);
      if (result.success) {
        handleSuccess();
      } else if (result.error === 'user_cancel') {
        // User cancelled — stay on screen silently
      } else {
        setAuthError('Authentication failed. Please try again.');
      }
    } catch {
      setAuthLoading(false);
      setAuthError('Authentication unavailable. Please try again.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerIcon}>
              <Ionicons name="shield-checkmark" size={24} color={BSColors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>Authorize Transaction</Text>
              {amount && <Text style={s.headerAmount}>{amount}{description ? ` · ${description}` : ''}</Text>}
            </View>
            <TouchableOpacity onPress={onCancel} testID="auth-cancel-btn">
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Auth screen */}
          {step === 'auth' && (
            <View style={s.body}>
              <View style={s.iconCircle}>
                <Ionicons name="finger-print" size={56} color={BSColors.primary} />
              </View>
              <Text style={s.hint}>Use your biometric or device passcode to authorize this transaction.</Text>

              {authError ? (
                <Text style={s.errorText} testID="auth-error">{authError}</Text>
              ) : null}

              <TouchableOpacity
                style={[s.authBtn, authLoading && s.authBtnDisabled]}
                onPress={triggerAuth}
                disabled={authLoading}
                testID="bio-auth-btn"
              >
                {authLoading
                  ? <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                  : <Ionicons name="finger-print-outline" size={22} color="#fff" style={{ marginRight: 8 }} />}
                <Text style={s.authBtnText}>{authLoading ? 'Verifying...' : 'Authenticate'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Success */}
          {step === 'success' && (
            <View style={s.body}>
              <View style={s.successCircle}>
                <Ionicons name="checkmark-circle" size={72} color="#059669" />
              </View>
              <Text style={s.successTitle}>Authorized!</Text>
              <Text style={s.successSub}>Processing your transaction...</Text>
            </View>
          )}

          {/* Failed */}
          {step === 'failed' && (
            <View style={s.body}>
              <View style={s.failCircle}>
                <Ionicons name="close-circle" size={72} color="#DC2626" />
              </View>
              <Text style={s.failTitle}>Transaction Failed</Text>
              <Text style={s.failSub} testID="auth-fail-reason">{failReason}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={handleRetry} testID="auth-retry-btn">
                <Ionicons name="refresh-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={s.retryBtnText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={onCancel} testID="auth-cancel-final-btn">
                <Text style={s.cancelBtnText}>Cancel Transaction</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: BSColors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: BSColors.lightGray },
  headerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: BSColors.indigoBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: BSColors.textPrimary, fontSize: 16, fontFamily: 'Urbanist-ExtraBold' },
  headerAmount: { color: BSColors.darkGray, fontSize: 13, marginTop: 2 },
  body: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 24, paddingBottom: 8 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: BSColors.indigoBg, borderWidth: 2, borderColor: BSColors.indigoBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  hint: { color: BSColors.darkGray, fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  errorText: { color: BSColors.errorDark, fontSize: 13, marginBottom: 16, textAlign: 'center' },
  authBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BSColors.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, width: '100%' },
  authBtnDisabled: { opacity: 0.6 },
  authBtnText: { color: BSColors.white, fontSize: 16, fontFamily: 'Urbanist-Bold' },
  successCircle: { marginBottom: 16, marginTop: 8 },
  successTitle: { color: BSColors.successDark, fontSize: 22, fontFamily: 'Urbanist-ExtraBold', marginBottom: 8 },
  successSub: { color: BSColors.darkGray, fontSize: 14 },
  failCircle: { marginBottom: 16, marginTop: 8 },
  failTitle: { color: BSColors.errorDark, fontSize: 22, fontFamily: 'Urbanist-ExtraBold', marginBottom: 8 },
  failSub: { color: BSColors.darkGray, fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: BSColors.primary, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 28, marginBottom: 12 },
  retryBtnText: { color: BSColors.white, fontSize: 15, fontFamily: 'Urbanist-Bold' },
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { color: BSColors.slate300, fontSize: 14, fontFamily: 'Urbanist-SemiBold', textDecorationLine: 'underline' },
});