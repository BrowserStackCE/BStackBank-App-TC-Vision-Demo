import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BSColors } from '@/constants/theme';
import { withShimmer } from '@/components/shimmer';

type Control = { id: string; label: string; description: string; icon: string; iconColor: string; value: boolean; danger?: boolean };

const INIT_CONTROLS: Control[] = [
  { id: 'maintenance', label: 'Maintenance Mode', description: 'Temporarily disable app access for all users', icon: 'construct-outline', iconColor: BSColors.warningDark, value: false, danger: true },
  { id: 'signups', label: 'Disable New Signups', description: 'Prevent new user registrations', icon: 'person-add-outline', iconColor: BSColors.errorDark, value: false, danger: true },
  { id: 'transfers', label: 'Freeze All Transfers', description: 'Block all money transfers system-wide', icon: 'ban-outline', iconColor: BSColors.errorDark, value: false, danger: true },
  { id: 'notifications', label: 'Push Notifications', description: 'Send system-wide push notifications', icon: 'notifications-outline', iconColor: BSColors.accent, value: true },
  { id: 'twofa', label: 'Enforce 2FA', description: 'Require two-factor auth for all logins', icon: 'shield-checkmark-outline', iconColor: BSColors.successDark, value: true },
  { id: 'audit', label: 'Audit Logging', description: 'Log all admin actions for compliance', icon: 'document-text-outline', iconColor: BSColors.infoDark, value: true },
];

function ControlsTab() {
  const [controls, setControls] = useState<Control[]>(INIT_CONTROLS);

  const toggle = (id: string, current: boolean, label: string, danger?: boolean) => {
    if (danger && !current) {
      Alert.alert('Warning', `Enabling "${label}" will affect all users. Are you sure?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Enable', style: 'destructive', onPress: () => setControls(p => p.map(c => c.id === id ? { ...c, value: true } : c)) },
      ]);
    } else {
      setControls(p => p.map(c => c.id === id ? { ...c, value: !c.value } : c));
    }
  };

  const activeCount = controls.filter(c => c.value).length;
  const dangerCount = controls.filter(c => c.danger && c.value).length;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>System Controls</Text>
          <Text style={s.headerSub}>{activeCount} active · {dangerCount} critical enabled</Text>
        </View>
        {dangerCount > 0 && (
          <View style={s.alertBadge}>
            <Ionicons name="warning-outline" size={14} color="#DC2626" />
            <Text style={s.alertBadgeText}>{dangerCount} Critical</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {dangerCount > 0 && (
          <View style={s.warningBanner}>
            <Ionicons name="warning" size={18} color="#DC2626" />
            <Text style={s.warningText}>{dangerCount} critical system control{dangerCount > 1 ? 's are' : ' is'} currently active. This may affect all users.</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>Critical Controls</Text>
        <View style={s.controlGroup}>
          {controls.filter(c => c.danger).map((ctrl, i, arr) => (
            <View key={ctrl.id} style={[s.controlRow, i < arr.length - 1 && s.controlBorder]}>
              <View style={[s.controlIcon, { backgroundColor: ctrl.iconColor + '15' }]}>
                <Ionicons name={ctrl.icon as any} size={20} color={ctrl.iconColor} />
              </View>
              <View style={s.controlInfo}>
                <Text style={s.controlLabel}>{ctrl.label}</Text>
                <Text style={s.controlDesc}>{ctrl.description}</Text>
              </View>
              <Switch
                value={ctrl.value}
                onValueChange={() => toggle(ctrl.id, ctrl.value, ctrl.label, ctrl.danger)}
                trackColor={{ false: BSColors.grayNeutral, true: BSColors.errorBorder }}
                thumbColor={ctrl.value ? BSColors.errorDark : BSColors.white}
                testID={`toggle-${ctrl.id}`}
              />
            </View>
          ))}
        </View>

        <Text style={s.sectionTitle}>General Settings</Text>
        <View style={s.controlGroup}>
          {controls.filter(c => !c.danger).map((ctrl, i, arr) => (
            <View key={ctrl.id} style={[s.controlRow, i < arr.length - 1 && s.controlBorder]}>
              <View style={[s.controlIcon, { backgroundColor: ctrl.iconColor + '15' }]}>
                <Ionicons name={ctrl.icon as any} size={20} color={ctrl.iconColor} />
              </View>
              <View style={s.controlInfo}>
                <Text style={s.controlLabel}>{ctrl.label}</Text>
                <Text style={s.controlDesc}>{ctrl.description}</Text>
              </View>
              <Switch
                value={ctrl.value}
                onValueChange={() => toggle(ctrl.id, ctrl.value, ctrl.label)}
                trackColor={{ false: BSColors.grayNeutral, true: BSColors.successBorder }}
                thumbColor={ctrl.value ? BSColors.successDark : BSColors.white}
                testID={`toggle-${ctrl.id}`}
              />
            </View>
          ))}
        </View>

        <View style={s.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color="#0891B2" />
          <Text style={s.infoText}>All changes are applied immediately to the active session. No backend persistence in this prototype.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BSColors.bgPageLight },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: BSColors.white, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BSColors.indigoBg },
  headerTitle: { color: '#111', fontSize: 17, fontFamily: 'Urbanist-Bold' },
  headerSub: { color: '#888', fontSize: 12, marginTop: 1 },
  alertBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BSColors.errorBorderDark, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  alertBadgeText: { color: BSColors.errorDark, fontSize: 12, fontFamily: 'Urbanist-Bold' },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: BSColors.errorBg, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: BSColors.errorBorder },
  warningText: { flex: 1, color: BSColors.errorDark, fontSize: 13, fontFamily: 'Urbanist-Medium' },
  sectionTitle: { color: '#111', fontSize: 15, fontFamily: 'Urbanist-Bold', marginBottom: 10 },
  controlGroup: { backgroundColor: BSColors.white, borderRadius: 16, overflow: 'hidden', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  controlRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  controlBorder: { borderBottomWidth: 1, borderBottomColor: BSColors.bgPageNeutral },
  controlIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  controlInfo: { flex: 1, marginRight: 8 },
  controlLabel: { color: '#111', fontSize: 14, fontFamily: 'Urbanist-SemiBold', marginBottom: 2 },
  controlDesc: { color: '#888', fontSize: 12 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: BSColors.infoBg, borderRadius: 12, padding: 14 },
  infoText: { flex: 1, color: BSColors.infoDeep, fontSize: 13 },
});

export default withShimmer(ControlsTab);
