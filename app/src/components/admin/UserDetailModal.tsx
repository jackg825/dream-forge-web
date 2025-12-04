'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Minus,
  Loader2,
  History,
  CreditCard,
  User,
} from 'lucide-react';
import type { AdminUser, AdminTransaction, AdminTransactionType } from '@/types';

interface UserDetailModalProps {
  user: AdminUser | null;
  open: boolean;
  onClose: () => void;
  transactions: AdminTransaction[];
  transactionsLoading: boolean;
  transactionsPagination: { total: number; hasMore: boolean } | null;
  onFetchTransactions: (userId: string) => Promise<void>;
  onAddCredits: (userId: string, amount: number, reason?: string) => Promise<boolean>;
  onDeductCredits: (userId: string, amount: number, reason: string) => Promise<boolean>;
  addingCredits: boolean;
  deductingCredits: boolean;
}

const TRANSACTION_TYPE_CONFIG: Record<
  AdminTransactionType,
  { label: string; color: string }
> = {
  consume: { label: '消費', color: 'text-red-600' },
  purchase: { label: '購買', color: 'text-green-600' },
  bonus: { label: '獎勵', color: 'text-blue-600' },
  adjustment: { label: '調整', color: 'text-yellow-600' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

export function UserDetailModal({
  user,
  open,
  onClose,
  transactions,
  transactionsLoading,
  transactionsPagination,
  onFetchTransactions,
  onAddCredits,
  onDeductCredits,
  addingCredits,
  deductingCredits,
}: UserDetailModalProps) {
  const [addAmount, setAddAmount] = useState('10');
  const [addReason, setAddReason] = useState('');
  const [deductAmount, setDeductAmount] = useState('');
  const [deductReason, setDeductReason] = useState('');

  // Fetch transactions when user changes
  useEffect(() => {
    if (user && open) {
      onFetchTransactions(user.uid);
    }
  }, [user, open, onFetchTransactions]);

  if (!user) return null;

  const handleAddCredits = async () => {
    const amount = parseInt(addAmount, 10);
    if (isNaN(amount) || amount <= 0) return;

    const success = await onAddCredits(user.uid, amount, addReason || undefined);
    if (success) {
      setAddAmount('10');
      setAddReason('');
      // Refresh transactions
      onFetchTransactions(user.uid);
    }
  };

  const handleDeductCredits = async () => {
    const amount = parseInt(deductAmount, 10);
    if (isNaN(amount) || amount <= 0 || !deductReason.trim()) return;

    const success = await onDeductCredits(user.uid, amount, deductReason.trim());
    if (success) {
      setDeductAmount('');
      setDeductReason('');
      // Refresh transactions
      onFetchTransactions(user.uid);
    }
  };

  const isUnlimited = user.credits >= 999999;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.photoURL || undefined} />
              <AvatarFallback>
                {user.displayName?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user.displayName}</p>
              <p className="text-sm text-muted-foreground font-normal">{user.email}</p>
            </div>
            {user.role === 'admin' && (
              <Badge variant="destructive">Admin</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="credits" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex-shrink-0 w-full grid grid-cols-2">
            <TabsTrigger value="credits" className="gap-2">
              <CreditCard className="h-4 w-4" />
              點數管理
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2">
              <History className="h-4 w-4" />
              交易紀錄 ({transactionsPagination?.total ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="credits" className="flex-1 overflow-y-auto mt-4 space-y-6">
            {/* Current balance */}
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">目前點數</p>
              <p className={`text-4xl font-bold ${
                isUnlimited
                  ? 'text-purple-600'
                  : user.credits > 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {isUnlimited ? '∞' : user.credits}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                總生成次數: {user.totalGenerated}
              </p>
            </div>

            {/* Add credits */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-green-600" />
                <h3 className="font-medium">增加點數</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="add-amount">數量</Label>
                  <Input
                    id="add-amount"
                    type="number"
                    min="1"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    placeholder="10"
                  />
                </div>
                <div>
                  <Label htmlFor="add-reason">原因 (選填)</Label>
                  <Input
                    id="add-reason"
                    value={addReason}
                    onChange={(e) => setAddReason(e.target.value)}
                    placeholder="活動獎勵"
                  />
                </div>
              </div>
              <Button
                onClick={handleAddCredits}
                disabled={addingCredits || !addAmount}
                className="w-full gap-2"
              >
                {addingCredits ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                增加點數
              </Button>
            </div>

            {/* Deduct credits */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Minus className="h-4 w-4 text-red-600" />
                <h3 className="font-medium">扣除點數</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="deduct-amount">數量</Label>
                  <Input
                    id="deduct-amount"
                    type="number"
                    min="1"
                    max={user.credits}
                    value={deductAmount}
                    onChange={(e) => setDeductAmount(e.target.value)}
                    placeholder="5"
                  />
                </div>
                <div>
                  <Label htmlFor="deduct-reason">原因 (必填)</Label>
                  <Input
                    id="deduct-reason"
                    value={deductReason}
                    onChange={(e) => setDeductReason(e.target.value)}
                    placeholder="手動調整"
                  />
                </div>
              </div>
              <Button
                onClick={handleDeductCredits}
                disabled={deductingCredits || !deductAmount || !deductReason.trim()}
                variant="destructive"
                className="w-full gap-2"
              >
                {deductingCredits ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Minus className="h-4 w-4" />
                )}
                扣除點數
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="flex-1 overflow-y-auto mt-4">
            {transactionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>沒有交易紀錄</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => {
                  const config = TRANSACTION_TYPE_CONFIG[tx.type] || TRANSACTION_TYPE_CONFIG.adjustment;
                  const isPositive = tx.amount > 0;

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={config.color}>
                            {config.label}
                          </Badge>
                          {tx.reason && (
                            <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {tx.reason}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(tx.createdAt)}
                        </p>
                      </div>
                      <p className={`text-lg font-semibold ${
                        isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {isPositive ? '+' : ''}{tx.amount}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* User metadata */}
        <div className="flex-shrink-0 text-xs text-muted-foreground pt-4 border-t">
          <p>User ID: {user.uid}</p>
          <p>加入時間: {user.createdAt ? new Date(user.createdAt).toLocaleString('zh-TW') : '—'}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
