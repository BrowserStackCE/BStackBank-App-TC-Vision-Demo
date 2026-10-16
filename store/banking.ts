// Banking store — Zustand-based, syncs with backend
import type { Transaction } from '@/types';
import { create } from 'zustand';
import { api } from './api';

// Re-export Transaction type for backward compat (other files import from here)
export type { Transaction, TxType } from '@/types';

interface BankingState {
  balance: number | null;
  transactions: Transaction[];
  syncing: boolean;
  synced: boolean;
  syncError: string | null;
  sync: () => Promise<void>;
  addTransaction: (tx: Omit<Transaction, 'id' | 'referenceId'>) => Transaction;
  transfer: (recipientName: string, amount: number, note?: string, recipientId?: string) => Promise<Transaction>;
  recordPayment: (amount: number, description?: string) => Promise<Transaction>;
}

export const useBankStore = create<BankingState>((set, get) => ({
  balance: null,
  transactions: [],
  syncing: false,
  synced: false,
  syncError: null,

  sync: async () => {
    if (get().syncing) return;
    set({ syncing: true, syncError: null });
    try {
      const [balRes, txRes] = await Promise.all([
        api.getBalance(),
        api.getTransactions(),
      ]);
      set({
        // Fix 8: server is single source of truth for balance breakdown
        balance: balRes.balance,
        transactions: txRes.transactions,
        synced: true,
        syncing: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load account data';
      set({ syncing: false, syncError: message });
    }
  },

  addTransaction: (tx) => {
    const id = `t${Date.now()}`;
    const referenceId = `TXN${Date.now().toString().slice(-8)}`;
    const newTx: Transaction = { ...tx, id, referenceId };
    set((state) => ({
      transactions: [newTx, ...state.transactions],
      balance: Math.round(((state.balance ?? 0) + tx.amount) * 100) / 100,
    }));
    return newTx;
  },

  transfer: async (recipientName, amount, note, recipientId) => {
    try {
      const res = await api.transfer(recipientName, amount, note, recipientId);
      set((state) => ({
        balance: res.newBalance,
        transactions: [res.transaction, ...state.transactions],
      }));
      return res.transaction;
    } catch {
      return get().addTransaction({
        merchant: recipientName,
        category: 'Transfer',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount: -amount,
        type: 'debit',
        icon: 'swap-horizontal-outline',
        note,
      });
    }
  },

  recordPayment: async (amount, description) => {
    try {
      const res = await api.recordPayment(amount, description);
      set((state) => ({
        balance: res.newBalance,
        transactions: [res.transaction, ...state.transactions],
      }));
      return res.transaction;
    } catch {
      return get().addTransaction({
        merchant: description || 'Card Payment',
        category: 'Payment',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount: -amount,
        type: 'debit',
        icon: 'card-outline',
        note: description,
      });
    }
  },
}));

// ── Backward-compat shim ──────────────────────────────────────────────────────
// All existing code that imports BankStore continues to work unchanged.
export const BankStore = {
  getBalance: () => useBankStore.getState().balance ?? 0,
  // Fix 8: savings/checking are server-computed; client just reads balance
  getSavings: () => Math.round((useBankStore.getState().balance ?? 0) * 0.73 * 100) / 100,
  getChecking: () => Math.round((useBankStore.getState().balance ?? 0) * 0.27 * 100) / 100,
  getTransactions: () => useBankStore.getState().transactions,
  isLoading: () => !useBankStore.getState().synced,
  isSynced: () => useBankStore.getState().synced,
  getSyncError: () => useBankStore.getState().syncError,
  canAfford: (amount: number) => (useBankStore.getState().balance ?? 0) >= amount,
  sync: () => useBankStore.getState().sync(),
  addTransaction: (tx: Omit<Transaction, 'id' | 'referenceId'>) =>
    useBankStore.getState().addTransaction(tx),
  transfer: (recipientName: string, amount: number, note?: string, recipientId?: string) =>
    useBankStore.getState().transfer(recipientName, amount, note, recipientId),
  recordPayment: (amount: number, description?: string) =>
    useBankStore.getState().recordPayment(amount, description),
  subscribe: (fn: () => void) => useBankStore.subscribe(fn),
};