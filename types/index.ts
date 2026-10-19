// ─────────────────────────────────────────────────────────────────────────────
// Shared domain types — used across store/, components/, app/, and server types
// ─────────────────────────────────────────────────────────────────────────────

// ── Auth ─────────────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'admin';
export type KycStatus = 'pending' | 'verified' | 'rejected';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  kycStatus: KycStatus;
  // Some endpoints return these additional fields
  name?: string;
  avatar?: string;
  avatarUrl?: string;
  account?: string;
}

// ── Transactions ──────────────────────────────────────────────────────────────

export type TxType = 'debit' | 'credit';

export interface Transaction {
  id: string;
  merchant: string;
  category: string;
  date: string;
  amount: number; // positive = credit, negative = debit
  type: TxType;
  icon: string;
  note?: string;
  referenceId: string;
}

// ── Cards ─────────────────────────────────────────────────────────────────────

export type CardType = 'visa' | 'mastercard' | 'amex' | 'discover';

export interface Card {
  id: string;
  label: string;
  number: string;
  holder: string;
  expiry: string;
  color: string;
  cardType: CardType;
  frozen?: boolean;
}

// ── Account / Balance ─────────────────────────────────────────────────────────

export interface AccountBalance {
  balance: number;
  savings: number;
  checking: number;
  currency: string;
}

// ── Orders / Shop ─────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  description?: string;
  createdAt?: string;
  // Returned by the shop endpoints
  status?: string;
  referenceId?: string;
  date?: string;
}

// ── Messages ──────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  // Server returns snake_case for chat messages
  sender_id: string;
  body: string;
  created_at: string;
  // camelCase aliases (used in some contexts)
  senderId?: string;
  recipientId?: string;
  read?: boolean;
}

export interface Conversation {
  // Server returns snake_case for inbox conversations
  partner_id: string;
  partner_name: string;
  body: string;
  created_at: string;
  sender_id: string;
  unread_count: number;
  // camelCase aliases
  userId?: string;
  fullName?: string;
  unreadCount?: number;
}

// ── API responses ─────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: User;
}

export interface TransferResponse {
  transaction: Transaction;
  newBalance: number;
}

export interface ProfileResponse extends Omit<User, 'account'> {
  memberSince: string;
  account: { id: string; balance: number; currency: string } | null;
}
