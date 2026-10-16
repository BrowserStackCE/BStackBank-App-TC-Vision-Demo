import { CardShimmer } from '@/components/shimmer';
import { BSColors, CARD_THEMES, CardThemeKey } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/store/api';
import { AuthStore } from '@/store/auth';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Card {
  id: string;
  label: string;
  number: string;
  holder: string;
  expiry: string;
  color: string;
  type: 'visa' | 'mastercard' | 'amex';
  frozen: boolean;
}

// Card shades — same dark treatment as the reference card, different hues.
const CARD_COLORS: { label: string; value: CardThemeKey }[] = [
  { label: 'Slate', value: 'slate' },
  { label: 'Navy', value: 'navy' },
  { label: 'Forest', value: 'forest' },
  { label: 'Wine', value: 'wine' },
  { label: 'Plum', value: 'plum' },
  { label: 'Teal', value: 'teal' },
];

const CARD_TYPES: { label: string; value: Card['type'] }[] = [
  { label: 'Visa', value: 'visa' },
  { label: 'Mastercard', value: 'mastercard' },
  { label: 'Amex', value: 'amex' },
];

const NETWORK_NAMES: Record<Card['type'], string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express' };

// Shown only while cards load, and as a fallback if the request fails.
const placeholderCards = (holder: string): Card[] => [
  { id: 'placeholder', label: 'Primary Card', number: '0000 0000 0000 0000', holder, expiry: '--/--', color: 'slate', type: 'visa', frozen: false },
];

// Saved cards may hold a theme key or a legacy hex colour — fall back to slate for anything unknown.
function themeFor(color: string) {
  return CARD_THEMES[color as CardThemeKey] ?? CARD_THEMES.slate;
}

function CardDisplay({ card }: { card: Card }) {
  const [showNumber, setShowNumber] = useState(false);
  const theme = themeFor(card.color);
  const groups = card.number.split(' ');
  const lastFour = groups[groups.length - 1];
  const leading = groups.slice(0, -1);
  return (
    <View style={[styles.cardDisplay, { backgroundColor: theme.bg }]}>
      <View pointerEvents="none" style={[styles.cardCircle, { backgroundColor: theme.circle }]} />
      {card.frozen && (
        <View style={styles.frozenOverlay}>
          <Ionicons name="snow-outline" size={28} color="#fff" />
          <Text style={styles.frozenText}>Card Frozen</Text>
        </View>
      )}
      <Text style={[styles.cardKind, { color: theme.label }]}>{card.label.toUpperCase()}</Text>
      <Text style={[styles.cardNetwork, { color: theme.text }]}>{NETWORK_NAMES[card.type]}</Text>
      <TouchableOpacity style={styles.cardNumberRow} onPress={() => setShowNumber(!showNumber)} accessibilityLabel={showNumber ? 'Hide card number' : 'Show card number'} accessibilityRole="button">
        <Text style={[styles.cardNumberMask, { color: theme.text }]}>{showNumber ? leading.join('  ') : '****  ****  ****'}</Text>
        <Text style={[styles.cardNumberLast, { color: theme.text }]}>{lastFour}</Text>
      </TouchableOpacity>
      <View style={styles.cardBottom}>
        <View>
          <Text style={[styles.cardMeta, { color: theme.label }]}>CARD HOLDER</Text>
          <Text style={[styles.cardMetaValue, { color: theme.text }]}>{card.holder}</Text>
        </View>
        <View style={styles.cardExpiryCol}>
          <Text style={[styles.cardMeta, { color: theme.label }]}>EXPIRES</Text>
          <Text style={[styles.cardMetaValue, { color: theme.text }]}>{card.expiry}</Text>
        </View>
      </View>
    </View>
  );
}

export default function CardsScreen() {
  const { primaryColor, primaryBg, primaryBorder, greenMode } = useTheme();
  const userFullName = AuthStore.getUser()?.fullName?.toUpperCase() ?? '';
  const [cards, setCards] = useState<Card[]>(() => placeholderCards(userFullName));
  const [selectedCard, setSelectedCard] = useState<string>('placeholder');
  const [cardsLoading, setCardsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newHolder, setNewHolder] = useState(userFullName);

  useEffect(() => {
    api.getCards().then(res => {
      if (res.cards && res.cards.length > 0) {
        const mapped = res.cards.map((c: any) => ({
          id: c.id,
          label: c.label,
          number: c.number,
          holder: c.holder,
          expiry: c.expiry,
          color: c.color,
          type: (c.card_type || c.cardType || 'visa') as Card['type'],
          frozen: c.frozen,
        }));
        setCards(mapped);
        setSelectedCard(mapped[0].id);
      }
    }).catch(() => {}).finally(() => setCardsLoading(false));
  }, []);
  const [newColor, setNewColor] = useState<CardThemeKey>(CARD_COLORS[0].value);
  const [newType, setNewType] = useState<Card['type']>('visa');
  const [newExpiry, setNewExpiry] = useState('');

  const activeCard = cards.find(c => c.id === selectedCard) ?? cards[0];

  const toggleFreeze = () => {
    if (selectedCard === 'placeholder') return;
    setCards(prev => prev.map(c => c.id === selectedCard ? { ...c, frozen: !c.frozen } : c));
  };

  const deleteCard = () => {
    if (selectedCard === 'placeholder' || cards.length <= 1) { Alert.alert('Cannot Delete', 'You must have at least one card.'); return; }
    Alert.alert('Delete Card', `Delete "${activeCard.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        const remaining = cards.filter(c => c.id !== selectedCard);
        setCards(remaining);
        setSelectedCard(remaining[0].id);
      }},
    ]);
  };

  const createCard = () => {
    if (!newLabel.trim()) { Alert.alert('Error', 'Please enter a card label.'); return; }
    if (!newExpiry.match(/^\d{2}\/\d{2}$/)) { Alert.alert('Error', 'Expiry must be MM/YY format.'); return; }
    const randomNum = Array.from({ length: 4 }, () => Math.floor(1000 + Math.random() * 9000).toString()).join(' ');
    const newCard: Card = { id: `c${Date.now()}`, label: newLabel.trim(), number: randomNum, holder: newHolder.trim().toUpperCase() || userFullName, expiry: newExpiry, color: newColor, type: newType, frozen: false };
    setCards(prev => [...prev, newCard]);
    setSelectedCard(newCard.id);
    setShowCreateModal(false);
    setNewLabel(''); setNewHolder(userFullName); setNewColor(CARD_COLORS[0].value); setNewType('visa'); setNewExpiry('');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>My Cards</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)} testID="add-card-btn">
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>New Card</Text>
          </TouchableOpacity>
        </View>

        {cardsLoading ? <CardShimmer /> : <CardDisplay card={activeCard} />}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardSelector} contentContainerStyle={{ gap: 10, paddingHorizontal: 2 }}>
          {cards.map(c => (
            <TouchableOpacity key={c.id} style={[styles.cardChip, selectedCard === c.id && styles.cardChipActive, { borderColor: themeFor(c.color).bg }]} onPress={() => setSelectedCard(c.id)}>
              <View style={[styles.cardChipDot, { backgroundColor: themeFor(c.color).bg }]} />
              <Text style={[styles.cardChipText, selectedCard === c.id && { color: themeFor(c.color).bg }]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.actionsRow, greenMode && { flexWrap: "wrap", gap: 16 }]}>
          {[
            { label: activeCard.frozen ? 'Unfreeze' : 'Freeze', icon: activeCard.frozen ? 'snow' : 'snow-outline', color: activeCard.frozen ? primaryColor : BSColors.darkGray, bg: activeCard.frozen ? primaryBg : BSColors.lightGray, onPress: toggleFreeze, testID: 'freeze-btn' },
            { label: 'Details', icon: 'eye-outline', color: BSColors.darkGray, bg: BSColors.lightGray, onPress: () => Alert.alert('Card Details', `Number: ${activeCard.number}\nExpiry: ${activeCard.expiry}\nCVV: •••`), testID: 'details-btn' },
            { label: 'Limits', icon: 'speedometer-outline', color: BSColors.darkGray, bg: BSColors.lightGray, onPress: () => Alert.alert('Limits', 'Daily: $5,000\nMonthly: $50,000'), testID: 'limits-btn' },
            { label: 'Delete', icon: 'trash-outline', color: BSColors.errorDark, bg: BSColors.errorBg, onPress: deleteCard, testID: 'delete-card-btn' },
          ].map(a => (
            <TouchableOpacity key={a.label} style={styles.actionBtn} onPress={a.onPress} testID={a.testID}>
              <View style={[styles.actionIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon as any} size={22} color={a.color} />
              </View>
              <Text style={[styles.actionLabel, { color: a.color }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoCard}>
          {[
            { label: 'Card Type', value: activeCard.type.charAt(0).toUpperCase() + activeCard.type.slice(1) },
            { label: 'Daily Limit', value: '$5,000.00' },
            { label: 'Monthly Limit', value: '$50,000.00' },
          ].map((row, i, arr) => (
            <View key={row.label} style={[styles.infoRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text style={styles.infoValue}>{row.value}</Text>
            </View>
          ))}
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: activeCard.frozen ? primaryBg : BSColors.successBg }]}>
              <Text style={[styles.statusText, { color: activeCard.frozen ? primaryColor : BSColors.successDark }]}>{activeCard.frozen ? 'Frozen' : 'Active'}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Card</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)} accessibilityLabel="Close add card" accessibilityRole="button"><Ionicons name="close" size={24} color="#64748B" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Card Label</Text>
              <TextInput style={styles.fieldInput} value={newLabel} onChangeText={setNewLabel} placeholder="e.g. Travel Card" placeholderTextColor="#94A3B8" testID="card-label-input" />
              <Text style={styles.fieldLabel}>Card Holder Name</Text>
              <TextInput style={styles.fieldInput} value={newHolder} onChangeText={setNewHolder} placeholder="Name on card" placeholderTextColor="#94A3B8" autoCapitalize="characters" testID="card-holder-input" />
              <Text style={styles.fieldLabel}>Expiry (MM/YY)</Text>
              <TextInput
                style={styles.fieldInput}
                value={newExpiry}
                onChangeText={v => {
                  // Auto-insert slash after MM
                  const digits = v.replace(/\D/g, '').slice(0, 4);
                  if (digits.length >= 3) {
                    setNewExpiry(digits.slice(0, 2) + '/' + digits.slice(2));
                  } else if (v.endsWith('/') && digits.length === 2) {
                    setNewExpiry(digits + '/');
                  } else {
                    setNewExpiry(digits.length <= 2 ? digits : digits);
                  }
                }}
                placeholder="12/28"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                maxLength={5}
                testID="card-expiry-input"
              />
              <Text style={styles.fieldLabel}>Card Type</Text>
              <View style={styles.typeRow}>
                {CARD_TYPES.map(t => (
                  <TouchableOpacity key={t.value} style={[styles.typeChip, newType === t.value && styles.typeChipActive]} onPress={() => setNewType(t.value)}>
                    <Text style={[styles.typeChipText, newType === t.value && styles.typeChipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Card Color</Text>
              <View style={styles.colorRow}>
                {CARD_COLORS.map(c => (
                  <TouchableOpacity key={c.value} style={[styles.colorDot, { backgroundColor: CARD_THEMES[c.value].bg }, newColor === c.value && styles.colorDotSelected]} onPress={() => setNewColor(c.value)}>
                    {newColor === c.value && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Preview</Text>
              <View style={[styles.previewCard, { backgroundColor: CARD_THEMES[newColor].bg }]}>
                <Text style={styles.previewLabel}>{newLabel || 'Card Label'}</Text>
                <Text style={styles.previewNumber}>****  ****  ****  ****</Text>
                <View style={styles.previewBottom}>
                  <Text style={styles.previewHolder}>{(newHolder || userFullName || 'CARD HOLDER').toUpperCase()}</Text>
                  <Text style={styles.previewExpiry}>{newExpiry || 'MM/YY'}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.createBtn} onPress={createCard} testID="create-card-btn">
                <Text style={styles.createBtnText}>Create Card</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BSColors.bgPageAlt },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pageTitle: { color: BSColors.textPrimary, fontSize: 22, fontFamily: 'Urbanist-Bold' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BSColors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: BSColors.white, fontSize: 13, fontFamily: 'Urbanist-Bold' },
  cardDisplay: { borderRadius: 24, padding: 24, marginBottom: 16, minHeight: 200, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 6, overflow: 'hidden' },
  cardCircle: { position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80 },
  cardKind: { fontSize: 13, fontFamily: 'Urbanist-Medium', letterSpacing: 2, marginBottom: 6 },
  cardNetwork: { fontSize: 16, fontFamily: 'Urbanist-Regular', marginBottom: 28 },
  cardNumberMask: { fontSize: 18, fontFamily: 'Urbanist-Bold', letterSpacing: 2 },
  cardNumberLast: { fontSize: 24, fontFamily: 'Urbanist-Bold', letterSpacing: 4 },
  cardExpiryCol: { alignItems: 'flex-end' },
  frozenOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  frozenText: { color: BSColors.white, fontSize: 16, fontFamily: 'Urbanist-Bold', marginTop: 8 },
  cardNumberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: 28 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardMeta: { fontSize: 12, fontFamily: 'Urbanist-Regular', letterSpacing: 0.5, marginBottom: 4 },
  cardMetaValue: { fontSize: 16, fontFamily: 'Urbanist-Bold', letterSpacing: 0.5 },
  cardSelector: { marginBottom: 20 },
  cardChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: BSColors.white, borderWidth: 1.5, borderColor: BSColors.mediumGray },
  cardChipActive: { backgroundColor: BSColors.indigoBg },
  cardChipDot: { width: 8, height: 8, borderRadius: 4 },
  cardChipText: { color: BSColors.darkGray, fontSize: 12, fontFamily: 'Urbanist-SemiBold' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionBtn: { alignItems: 'center', gap: 6 },
  actionIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: BSColors.darkGray, fontSize: 11, fontFamily: 'Urbanist-SemiBold' },
  infoCard: { backgroundColor: BSColors.white, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BSColors.lightGray },
  infoLabel: { color: BSColors.darkGray, fontSize: 14 },
  infoValue: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-SemiBold' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontFamily: 'Urbanist-Bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: BSColors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: BSColors.textPrimary, fontSize: 18, fontFamily: 'Urbanist-Bold' },
  fieldLabel: { color: BSColors.slate700, fontSize: 13, fontFamily: 'Urbanist-SemiBold', marginBottom: 8, marginTop: 16 },
  fieldInput: { backgroundColor: BSColors.bgPageAlt, borderRadius: 12, borderWidth: 1.5, borderColor: BSColors.indigoBorder, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: BSColors.textPrimary },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: BSColors.lightGray, alignItems: 'center', borderWidth: 1.5, borderColor: BSColors.mediumGray },
  typeChipActive: { backgroundColor: BSColors.indigoBg, borderColor: BSColors.primary },
  typeChipText: { color: BSColors.darkGray, fontSize: 13, fontFamily: 'Urbanist-SemiBold' },
  typeChipTextActive: { color: BSColors.primary },
  colorRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  colorDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  colorDotSelected: { borderWidth: 3, borderColor: BSColors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  previewCard: { borderRadius: 16, padding: 20, marginTop: 4, minHeight: 120 },
  previewLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Urbanist-SemiBold', marginBottom: 16 },
  previewNumber: { color: BSColors.white, fontSize: 15, fontFamily: 'Urbanist-SemiBold', letterSpacing: 2, marginBottom: 16 },
  previewBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  previewHolder: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  previewExpiry: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  createBtn: { backgroundColor: BSColors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24, marginBottom: 8 },
  createBtnText: { color: BSColors.white, fontSize: 16, fontFamily: 'Urbanist-Bold' },
});