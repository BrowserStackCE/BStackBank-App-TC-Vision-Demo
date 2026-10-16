import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BSColors } from '@/constants/theme';
import { withShimmer } from '@/components/shimmer';

type Status = 'Active' | 'Suspended';
type User = { id: string; name: string; email: string; accountType: string; balance: number; status: Status; accountNumber: string };

const INIT_USERS: User[] = [
  { id: '1', name: 'Alex Johnson', email: 'alex.johnson@example.com', accountType: 'Savings', balance: 24850, status: 'Active', accountNumber: 'ACC-00482-7731' },
  { id: '2', name: 'Sarah Williams', email: 'sarah.w@example.com', accountType: 'Checking', balance: 8200, status: 'Active', accountNumber: 'ACC-00391-4521' },
  { id: '3', name: 'James Carter', email: 'james.c@example.com', accountType: 'Savings', balance: 15600, status: 'Suspended', accountNumber: 'ACC-00512-8834' },
  { id: '4', name: 'Priya Sharma', email: 'priya.s@example.com', accountType: 'Premium', balance: 52000, status: 'Active', accountNumber: 'ACC-00623-2290' },
];

function UsersTab() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>(INIT_USERS);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [addForm, setAddForm] = useState({ name: '', email: '', accountType: 'Savings', balance: '' });
  const [editForm, setEditForm] = useState({ name: '', balance: '', status: 'Active' as Status });

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!addForm.name || !addForm.email || !addForm.balance) { Alert.alert('Error', 'Please fill all fields.'); return; }
    const u: User = {
      id: Date.now().toString(), name: addForm.name, email: addForm.email,
      accountType: addForm.accountType, balance: Number(addForm.balance), status: 'Active',
      accountNumber: 'ACC-' + Math.floor(10000 + Math.random() * 90000) + '-' + Math.floor(1000 + Math.random() * 9000),
    };
    setUsers(p => [u, ...p]);
    setAddForm({ name: '', email: '', accountType: 'Savings', balance: '' });
    setShowAdd(false);
  };

  const openEdit = (u: User) => { setEditUser(u); setEditForm({ name: u.name, balance: String(u.balance), status: u.status }); };

  const handleEdit = () => {
    if (!editUser) return;
    setUsers(p => p.map(u => u.id === editUser.id ? { ...u, name: editForm.name, balance: Number(editForm.balance), status: editForm.status } : u));
    setEditUser(null);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Confirm Delete', `Remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setUsers(p => p.filter(u => u.id !== id)) },
    ]);
  };

  const handleToggle = (id: string, name: string, cur: Status) => {
    const next: Status = cur === 'Active' ? 'Suspended' : 'Active';
    Alert.alert('Confirm', `${next === 'Suspended' ? 'Suspend' : 'Activate'} ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => setUsers(p => p.map(u => u.id === id ? { ...u, status: next } : u)) },
    ]);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>User Directory</Text>
          <Text style={s.headerSub}>{users.length} customers registered</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={() => router.replace('/' as any)}>
          <Ionicons name="log-out-outline" size={16} color="#DC2626" />
          <Text style={s.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.statsRow}>
          {[
            { label: 'Total', value: users.length, icon: 'people-outline' as const, color: BSColors.accent },
            { label: 'Active', value: users.filter(u => u.status === 'Active').length, icon: 'checkmark-circle-outline' as const, color: BSColors.successDark },
            { label: 'Suspended', value: users.filter(u => u.status === 'Suspended').length, icon: 'ban-outline' as const, color: BSColors.errorDark },
          ].map(st => (
            <View key={st.label} style={s.statCard}>
              <Ionicons name={st.icon} size={18} color={st.color} />
              <Text style={[s.statValue, { color: st.color }]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        <View style={s.toolbar}>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={15} color="#888" />
            <TextInput style={s.searchInput} placeholder="Search by name or email..." placeholderTextColor="#AAA" value={search} onChangeText={setSearch} testID="search-input" />
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)} testID="add-user-btn">
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {filtered.map(u => (
          <View key={u.id} style={s.userCard}>
            <View style={s.userTop}>
              <View style={s.avatar}><Text style={s.avatarText}>{u.name.split(' ').map(n => n[0]).join('')}</Text></View>
              <View style={s.userInfo}>
                <Text style={s.userName}>{u.name}</Text>
                <Text style={s.userEmail}>{u.email}</Text>
                <Text style={s.userAccNum}>{u.accountNumber}</Text>
              </View>
              <View style={[s.badge, u.status === 'Active' ? s.badgeActive : s.badgeSuspended]}>
                <Text style={[s.badgeText, u.status === 'Active' ? s.badgeTextActive : s.badgeTextSuspended]}>{u.status}</Text>
              </View>
            </View>
            <View style={s.userMeta}>
              <Text style={s.metaItem}><Text style={s.metaLabel}>Type: </Text>{u.accountType}</Text>
              <Text style={s.metaItem}><Text style={s.metaLabel}>Balance: </Text>${u.balance.toLocaleString()}</Text>
            </View>
            <View style={s.userActions}>
              <TouchableOpacity style={s.btnEdit} onPress={() => openEdit(u)} testID={`edit-${u.id}`}>
                <Ionicons name="pencil-outline" size={13} color="#4F46E5" /><Text style={s.btnEditText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnToggle, u.status === 'Active' ? s.btnSuspend : s.btnActivate]} onPress={() => handleToggle(u.id, u.name, u.status)} testID={`toggle-${u.id}`}>
                <Ionicons name={u.status === 'Active' ? 'pause-circle-outline' : 'play-circle-outline'} size={13} color={u.status === 'Active' ? BSColors.warningDark : BSColors.successDark} />
                <Text style={[s.btnToggleText, { color: u.status === 'Active' ? BSColors.warningDark : BSColors.successDark }]}>{u.status === 'Active' ? 'Suspend' : 'Activate'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnDelete} onPress={() => handleDelete(u.id, u.name)} testID={`delete-${u.id}`}>
                <Ionicons name="trash-outline" size={13} color="#DC2626" /><Text style={s.btnDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {filtered.length === 0 && <View style={s.empty}><Ionicons name="people-outline" size={40} color="#CCC" /><Text style={s.emptyText}>No users found</Text></View>}
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Add New Customer</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}><Ionicons name="close" size={22} color="#666" /></TouchableOpacity>
            </View>
            {([['Full Name', 'name', 'default'], ['Email', 'email', 'email-address'], ['Initial Balance ($)', 'balance', 'decimal-pad']] as [string, string, string][]).map(([label, key, kb]) => (
              <View key={key} style={s.formGroup}>
                <Text style={s.formLabel}>{label}</Text>
                <TextInput style={s.formInput} placeholder={label} placeholderTextColor="#AAA"
                  value={(addForm as any)[key]} onChangeText={v => setAddForm(p => ({ ...p, [key]: v }))}
                  keyboardType={kb as any} testID={`add-${key}`} />
              </View>
            ))}
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Account Type</Text>
              <View style={s.typeRow}>
                {['Savings', 'Checking', 'Premium'].map(t => (
                  <TouchableOpacity key={t} style={[s.typeBtn, addForm.accountType === t && s.typeBtnActive]} onPress={() => setAddForm(p => ({ ...p, accountType: t }))}>
                    <Text style={[s.typeBtnText, addForm.accountType === t && s.typeBtnTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={s.submitBtn} onPress={handleAdd} testID="submit-add"><Text style={s.submitBtnText}>Add Customer</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editUser} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Edit User</Text>
              <TouchableOpacity onPress={() => setEditUser(null)}><Ionicons name="close" size={22} color="#666" /></TouchableOpacity>
            </View>
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Full Name</Text>
              <TextInput style={s.formInput} value={editForm.name} onChangeText={v => setEditForm(p => ({ ...p, name: v }))} testID="edit-name" />
            </View>
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Balance ($)</Text>
              <TextInput style={s.formInput} value={editForm.balance} onChangeText={v => setEditForm(p => ({ ...p, balance: v }))} keyboardType="decimal-pad" testID="edit-balance" />
            </View>
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Status</Text>
              <View style={s.typeRow}>
                {(['Active', 'Suspended'] as Status[]).map(st => (
                  <TouchableOpacity key={st} style={[s.typeBtn, editForm.status === st && s.typeBtnActive]} onPress={() => setEditForm(p => ({ ...p, status: st }))}>
                    <Text style={[s.typeBtnText, editForm.status === st && s.typeBtnTextActive]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={s.submitBtn} onPress={handleEdit} testID="submit-edit"><Text style={s.submitBtnText}>Save Changes</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BSColors.bgPageLight },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: BSColors.white, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BSColors.indigoBg },
  headerTitle: { color: '#111', fontSize: 17, fontFamily: 'Urbanist-Bold' },
  headerSub: { color: '#888', fontSize: 12, marginTop: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: BSColors.errorBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  logoutText: { color: BSColors.errorDark, fontSize: 12, fontFamily: 'Urbanist-SemiBold' },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: BSColors.white, borderRadius: 12, padding: 12, alignItems: 'center', gap: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  statValue: { fontSize: 20, fontFamily: 'Urbanist-Bold' },
  statLabel: { color: '#888', fontSize: 11 },
  toolbar: { flexDirection: 'row', gap: 10, marginBottom: 14, alignItems: 'center' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: BSColors.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderWidth: 1, borderColor: BSColors.indigoBorder },
  searchInput: { flex: 1, fontSize: 14, color: '#111' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BSColors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { color: BSColors.white, fontFamily: 'Urbanist-Bold', fontSize: 14 },
  userCard: { backgroundColor: BSColors.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  userTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: BSColors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { color: BSColors.white, fontFamily: 'Urbanist-Bold', fontSize: 13 },
  userInfo: { flex: 1 },
  userName: { color: '#111', fontSize: 14, fontFamily: 'Urbanist-Bold' },
  userEmail: { color: '#888', fontSize: 12 },
  userAccNum: { color: '#AAA', fontSize: 11, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeActive: { backgroundColor: BSColors.successBgLight },
  badgeSuspended: { backgroundColor: BSColors.errorBorderDark },
  badgeText: { fontSize: 11, fontFamily: 'Urbanist-Bold' },
  badgeTextActive: { color: BSColors.successDark },
  badgeTextSuspended: { color: BSColors.errorDark },
  userMeta: { flexDirection: 'row', gap: 16, marginBottom: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: BSColors.bgPageNeutral },
  metaItem: { color: '#555', fontSize: 13 },
  metaLabel: { color: '#888', fontFamily: 'Urbanist-SemiBold' },
  userActions: { flexDirection: 'row', gap: 8 },
  btnEdit: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: BSColors.indigoBg, borderRadius: 8, paddingVertical: 7 },
  btnEditText: { color: BSColors.accent, fontSize: 12, fontFamily: 'Urbanist-SemiBold' },
  btnToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 8, paddingVertical: 7 },
  btnSuspend: { backgroundColor: BSColors.warningBg },
  btnActivate: { backgroundColor: BSColors.successBg },
  btnToggleText: { fontSize: 12, fontFamily: 'Urbanist-SemiBold' },
  btnDelete: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: BSColors.errorBg, borderRadius: 8, paddingVertical: 7 },
  btnDeleteText: { color: BSColors.errorDark, fontSize: 12, fontFamily: 'Urbanist-SemiBold' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { color: '#AAA', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: BSColors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#111', fontSize: 18, fontFamily: 'Urbanist-Bold' },
  formGroup: { marginBottom: 16 },
  formLabel: { color: '#333', fontSize: 13, fontFamily: 'Urbanist-SemiBold', marginBottom: 6 },
  formInput: { backgroundColor: BSColors.white, borderRadius: 10, borderWidth: 1.5, borderColor: BSColors.indigoBorder, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center', backgroundColor: BSColors.bgPageNeutral },
  typeBtnActive: { backgroundColor: BSColors.primary },
  typeBtnText: { color: '#666', fontSize: 13, fontFamily: 'Urbanist-SemiBold' },
  typeBtnTextActive: { color: BSColors.white },
  submitBtn: { backgroundColor: BSColors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  submitBtnText: { color: BSColors.white, fontSize: 15, fontFamily: 'Urbanist-Bold' },
});

export default withShimmer(UsersTab);
