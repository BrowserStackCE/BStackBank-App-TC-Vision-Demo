// Central API client — all backend calls go through here
import type { AuthResponse, Card, Conversation, Message, Order, ProfileResponse, Transaction, TransferResponse } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Backend URL — read from env (EXPO_PUBLIC_API_URL) ────────────────────────
// Set in eas.json per build profile, or in a local .env file for dev.
// EXPO_PUBLIC_ prefix makes it available at runtime in Expo (no server needed).
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://bs-banking-app.onrender.com';

/** How many people the transfer screen lists as recipients. */
const RECIPIENT_LIMIT = 5;

// In-memory token cache — avoids async AsyncStorage reads on every request
let _memToken: string | null = null;

async function getToken(): Promise<string | null> {
  // Use in-memory token first (set synchronously on login/signup)
  if (_memToken) return _memToken;
  try {
    const stored = await AsyncStorage.getItem('auth_token');
    if (stored) _memToken = stored;
    return stored;
  } catch { return null; }
}

async function request<T>(
  method: string,
  path: string,
  body?: object,
  requiresAuth = true,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (requiresAuth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  // Auth
  signup: (fullName: string, email: string, password: string) =>
    request<AuthResponse>('POST', '/auth/signup', { fullName, email, password }, false),

  login: (email: string, password: string) =>
    request<AuthResponse>('POST', '/auth/login', { email, password }, false),

  // Account
  getProfile: () => request<ProfileResponse>('GET', '/account/profile'),
  getBalance: () => request<{ balance: number; savings: number; checking: number; currency: string }>('GET', '/account/balance'),

  // Transactions
  getTransactions: () => request<{ transactions: Transaction[] }>('GET', '/transactions'),
  transfer: (recipientName: string, amount: number, note?: string, recipientId?: string) =>
    request<TransferResponse>('POST', '/transactions/transfer', { recipientName, amount, note, recipientId }),
  recordPayment: (amount: number, description?: string) =>
    request<TransferResponse>('POST', '/transactions/payment', { amount, description }),

  // Users (for transfer recipient list — returns a different shape than auth User)
  // The server already returns the 5 oldest users; the slice keeps the list short even against an older deployment.
  getUsers: async () => {
    const res = await request<{ users: { id: string; name: string; email: string; avatar: string; account: string }[] }>('GET', '/users');
    return { users: res.users.slice(0, RECIPIENT_LIMIT) };
  },

  // Shop
  placeOrder: (items: { id: string; name: string; price: number; qty: number }[], total: number, description?: string) =>
    request<{ order: Order; transaction: Transaction; newBalance: number }>('POST', '/shop/order', { items, total, description }),
  getOrders: () => request<{ orders: Order[] }>('GET', '/shop/orders'),
  receiptUrl: (orderId: string) => `${API_URL}/shop/orders/${orderId}/receipt`,

  // Profile photo (stored on Cloudinary; the image is sent as a base64 data URI)
  uploadAvatar: (image: string) => request<{ avatarUrl: string }>('PUT', '/account/avatar', { image }),
  deleteAvatar: () => request<{ avatarUrl: null }>('DELETE', '/account/avatar'),

  // Cards
  getCards: () => request<{ cards: Card[] }>('GET', '/cards'),
  createCard: (card: { label: string; number: string; holder: string; expiry: string; color: string; cardType: string }) =>
    request<{ card: Card }>('POST', '/cards', card),
  updateCard: (id: string, updates: { frozen?: boolean; label?: string; color?: string }) =>
    request<{ card: Card }>('PATCH', `/cards/${id}`, updates),
  deleteCard: (id: string) => request<{ deleted: boolean }>('DELETE', `/cards/${id}`),

  // Chat / Messages
  sendMessage: (recipientId: string, body: string) =>
    request<{ message: Message }>('POST', '/messages', { recipientId, body }),
  getConversation: (userId: string) =>
    request<{ messages: Message[] }>('GET', `/messages/conversation/${userId}`),
  getInbox: () =>
    request<{ conversations: Conversation[] }>('GET', '/messages/inbox'),
  getUnreadCount: () =>
    request<{ count: number }>('GET', '/messages/unread-count'),

  // Push tokens
  registerPushToken: (token: string, platform: string) =>
    request<{ ok: boolean }>('POST', '/push-tokens', { token, platform }),

  // Token management
  saveToken: async (token: string) => {
    _memToken = token; // set in-memory immediately
    return AsyncStorage.setItem('auth_token', token);
  },
  clearToken: async () => {
    _memToken = null;
    return AsyncStorage.removeItem('auth_token');
  },
  // Account deletion
  deleteAccount: () => request<{ deleted: boolean }>('DELETE', '/account'),

  setMemToken: (token: string) => { _memToken = token; },
  getToken,
};