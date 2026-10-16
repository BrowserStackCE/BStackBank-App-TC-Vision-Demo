import { BSColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/store/api';
import { AuthStore } from '@/store/auth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withShimmer } from '@/components/shimmer';

type User = { id: string; name: string; email: string; avatar: string };
type Message = { id: string; sender_id: string; body: string; created_at: string };
type Conversation = {
  partner_id: string; partner_name: string; body: string;
  created_at: string; sender_id: string; unread_count: number;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ChatScreen() {
  const router = useRouter();
  const { primaryColor } = useTheme();
  const me = AuthStore.getUser();

  const [view, setView] = useState<'inbox' | 'new' | 'conversation'>('inbox');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const flatRef = useRef<FlatList>(null);

  const loadInbox = useCallback(async () => {
    setInboxLoading(true);
    try { const r = await api.getInbox(); setConversations(r.conversations || []); }
    catch { setConversations([]); }
    finally { setInboxLoading(false); }
  }, []);

  useEffect(() => { loadInbox(); }, [loadInbox]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try { const r = await api.getUsers(); setUsers(r.users || []); }
    catch { setUsers([]); }
    finally { setUsersLoading(false); }
  }, []);

  const openConversation = useCallback(async (user: User) => {
    setActiveUser(user); setView('conversation');
    setMsgLoading(true); setSendError('');
    try { const r = await api.getConversation(user.id); setMessages(r.messages || []); }
    catch { setMessages([]); }
    finally { setMsgLoading(false); }
  }, []);

  // Poll every 5 seconds when in conversation
  useEffect(() => {
    if (view !== 'conversation' || !activeUser) return;
    const id = setInterval(async () => {
      try { const r = await api.getConversation(activeUser.id); setMessages(r.messages || []); }
      catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(id);
  }, [view, activeUser]);

  const sendMessage = async () => {
    if (!activeUser || !msgText.trim() || sending) return;
    if (msgText.length > 100) { setSendError('Max 100 characters'); return; }
    setSending(true); setSendError('');
    try {
      await api.sendMessage(activeUser.id, msgText.trim());
      setMsgText('');
      try {
        const r = await api.getConversation(activeUser.id);
        setMessages(r.messages || []);
      } catch { /* ignore refresh error */ }
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      const msg = e?.message || '';
      // Surface rate-limit and validation errors clearly
      if (msg.includes('5 messages') || msg.includes('3 different') || msg.includes('100 char') || msg.includes('yourself')) {
        setSendError(msg);
      } else {
        setSendError('Failed to send. Please try again.');
      }
    } finally { setSending(false); }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  // ── INBOX VIEW ──────────────────────────────────────────────────────────────
  if (view === 'inbox') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
            <Ionicons name="arrow-back" size={20} color={BSColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Messages</Text>
          <TouchableOpacity style={[styles.newBtn, { backgroundColor: primaryColor }]}
            onPress={() => { setView('new'); loadUsers(); }} testID="new-chat-btn" accessibilityLabel="New message" accessibilityRole="button">
            <Ionicons name="create-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        {inboxLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={primaryColor} /></View>
        ) : conversations.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="chatbubbles-outline" size={48} color={BSColors.mediumGray} />
            <Text style={styles.emptyText}>No conversations yet</Text>
            <TouchableOpacity style={[styles.startBtn, { backgroundColor: primaryColor }]}
              onPress={() => { setView('new'); loadUsers(); }}>
              <Text style={styles.startBtnText}>Start a conversation</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={c => c.partner_id}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            onRefresh={loadInbox}
            refreshing={inboxLoading}
            renderItem={({ item }) => {
              const initials = item.partner_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
              const isMine = item.sender_id === me?.id;
              return (
                <TouchableOpacity style={styles.convRow}
                  onPress={() => openConversation({ id: item.partner_id, name: item.partner_name, email: '', avatar: initials })}>
                  <View style={[styles.avatar, { backgroundColor: primaryColor }]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.convTop}>
                      <Text style={styles.convName}>{item.partner_name}</Text>
                      <Text style={styles.convTime}>{formatTime(item.created_at)}</Text>
                    </View>
                    <Text style={styles.convPreview} numberOfLines={1}>
                      {isMine ? 'You: ' : ''}{item.body}
                    </Text>
                  </View>
                  {item.unread_count > 0 && (
                    <View style={[styles.unreadBadge, { backgroundColor: primaryColor }]}>
                      <Text style={styles.unreadText}>{item.unread_count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    );
  }

  // ── NEW CONVERSATION VIEW ───────────────────────────────────────────────────
  if (view === 'new') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView('inbox')} style={styles.backBtn} accessibilityLabel="Back to inbox" accessibilityRole="button">
            <Ionicons name="arrow-back" size={20} color={BSColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>New Message</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={BSColors.darkGray} />
          <TextInput style={styles.searchInput} placeholder="Search users..."
            placeholderTextColor={BSColors.darkGray} value={userSearch} onChangeText={setUserSearch} />
        </View>
        {usersLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={primaryColor} /></View>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={u => u.id}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.userRow} onPress={() => openConversation(item)} testID={`user-${item.id}`}>
                <View style={[styles.avatar, { backgroundColor: primaryColor }]}>
                  <Text style={styles.avatarText}>{item.avatar}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{item.name}</Text>
                  <Text style={styles.userEmail}>{item.email}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={BSColors.darkGray} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>No users found</Text></View>}
          />
        )}
      </SafeAreaView>
    );
  }

  // ── CONVERSATION VIEW ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { setView('inbox'); loadInbox(); }} style={styles.backBtn} accessibilityLabel="Back to messages" accessibilityRole="button">
          <Ionicons name="arrow-back" size={20} color={BSColors.textPrimary} />
        </TouchableOpacity>
        <View style={[styles.avatar, { backgroundColor: primaryColor, width: 32, height: 32, borderRadius: 16 }]}>
          <Text style={[styles.avatarText, { fontSize: 12 }]}>{activeUser?.avatar}</Text>
        </View>
        <Text style={styles.pageTitle}>{activeUser?.name}</Text>
        <View style={{ width: 38 }} />
      </View>

      {msgLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={primaryColor} /></View>
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMine = item.sender_id === me?.id;
            return (
              <View style={[
                styles.bubble,
                isMine
                  ? [styles.bubbleMine, { backgroundColor: primaryColor }]
                  : styles.bubbleTheirs,
              ]}>
                <Text style={[styles.bubbleText, isMine && { color: BSColors.white }]}>{item.body}</Text>
                <Text style={[styles.bubbleTime, isMine && { color: 'rgba(255,255,255,0.7)' }]}>
                  {formatTime(item.created_at)}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
            </View>
          }
        />
      )}

      {sendError ? (
        <View style={styles.errorBar}>
          <Ionicons name="warning-outline" size={14} color={BSColors.error} />
          <Text style={styles.errorText}>{sendError}</Text>
        </View>
      ) : null}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.msgInput}
            placeholder="Type a message... (max 100 chars)"
            placeholderTextColor={BSColors.darkGray}
            value={msgText}
            onChangeText={t => { setMsgText(t); if (sendError) setSendError(''); }}
            maxLength={100}
            multiline
            testID="msg-input"
          />
          <Text style={[styles.charCount, msgText.length > 90 && { color: BSColors.error }]}>
            {msgText.length}/100
          </Text>
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: primaryColor }, (!msgText.trim() || sending) && { opacity: 0.5 }]}
            onPress={sendMessage} disabled={!msgText.trim() || sending} testID="send-btn">
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BSColors.bgPage },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: BSColors.mediumGray, backgroundColor: BSColors.white },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: BSColors.lightGray, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, color: BSColors.textPrimary, fontSize: 17, fontFamily: 'Urbanist-ExtraBold' },
  newBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { color: BSColors.darkGray, fontSize: 14, textAlign: 'center' },
  startBtn: { borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  startBtnText: { color: BSColors.white, fontSize: 14, fontFamily: 'Urbanist-Bold' },
  convRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: BSColors.white, borderRadius: 16, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  convName: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-Bold' },
  convTime: { color: BSColors.darkGray, fontSize: 11 },
  convPreview: { color: BSColors.textSecondary, fontSize: 12 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { color: BSColors.white, fontSize: 11, fontFamily: 'Urbanist-ExtraBold' },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: BSColors.white, fontSize: 15, fontFamily: 'Urbanist-ExtraBold' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: BSColors.white, margin: 16, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderWidth: 1, borderColor: BSColors.mediumGray },
  searchInput: { flex: 1, fontSize: 14, color: BSColors.textPrimary },
  userRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: BSColors.white, borderRadius: 16, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  userName: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-Bold', marginBottom: 2 },
  userEmail: { color: BSColors.darkGray, fontSize: 12 },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { alignSelf: 'flex-end', borderBottomRightRadius: 4, backgroundColor: BSColors.accent },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: BSColors.white, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  bubbleText: { color: BSColors.textPrimary, fontSize: 14, lineHeight: 20 },
  bubbleTime: { color: BSColors.darkGray, fontSize: 10, marginTop: 4, textAlign: 'right' },
  errorBar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BSColors.errorBg, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: BSColors.errorBorder },
  errorText: { color: BSColors.error, fontSize: 12, flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: Platform.OS === 'android' ? 28 : 20, gap: 8, backgroundColor: BSColors.white, borderTopWidth: 1, borderTopColor: BSColors.mediumGray },
  msgInput: { flex: 1, backgroundColor: BSColors.lightGray, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: BSColors.textPrimary, maxHeight: 100 },
  charCount: { color: BSColors.darkGray, fontSize: 10, alignSelf: 'flex-end', marginBottom: 10 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});

export default withShimmer(ChatScreen);
