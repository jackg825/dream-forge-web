'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { AdminHeader } from '@/components/layout/headers';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { UserDetailModal } from '@/components/admin/UserDetailModal';
import { LoadingButton } from '@/components/ui/loading-button';
import { FillImage } from '@/components/ui/fill-image';
import type { AdminUser } from '@/types';

function AdminDashboardContent() {
  const t = useTranslations();
  const { user } = useAuth();
  const {
    providerBalances,
    loadingProviderBalances,
    fetchAllProviderBalances,
    stats,
    loadingStats,
    fetchStats,
    users,
    usersLoading,
    usersPagination,
    fetchUsers,
    addCredits,
    addingCredits,
    deductCredits,
    deductingCredits,
    updateUserTier,
    updatingTier,
    transactions,
    transactionsLoading,
    transactionsPagination,
    fetchUserTransactions,
    error,
    clearError,
  } = useAdmin();

  // User detail modal state
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchAllProviderBalances();
    fetchStats();
    fetchUsers();
  }, [fetchAllProviderBalances, fetchStats, fetchUsers]);

  const openUserDetail = (targetUser: AdminUser) => {
    setSelectedUser(targetUser);
    setShowUserDetail(true);
  };

  const closeUserDetail = () => {
    setShowUserDetail(false);
    setSelectedUser(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      {/* Main content */}
      <main className="studio-shell">
        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl flex items-center justify-between">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            <button
              onClick={clearError}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Welcome */}
        <div className="mb-10">
          <h1 className="studio-page-title">{t('nav.adminPanel')}</h1>
          <p className="studio-page-subtitle">
            {t('dashboard.welcomeBack', { name: user?.displayName || t('common.user') })}
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Provider Balances */}
          <div className="store-card p-7">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">{t('admin.providerBalances')}</p>
              <button
                onClick={fetchAllProviderBalances}
                disabled={loadingProviderBalances}
                className="p-1.5 rounded-full hover:bg-muted disabled:opacity-50"
                title={t('admin.refresh')}
              >
                <svg
                  className={`w-4 h-4 text-primary ${loadingProviderBalances ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>
            {loadingProviderBalances && !providerBalances ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-6 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rodin</span>
                  <span className="font-medium text-foreground">
                    {providerBalances?.rodin.balance?.toFixed(1) ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Meshy</span>
                  <span className="font-medium text-foreground">
                    {providerBalances?.meshy.balance?.toLocaleString() ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tripo</span>
                  <span className="font-medium text-foreground">
                    {providerBalances?.tripo.balance !== null && providerBalances?.tripo.balance !== undefined ? (
                      <>
                        {providerBalances.tripo.balance.toLocaleString()}
                        {providerBalances.tripo.frozen ? (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({providerBalances.tripo.frozen} {t('admin.frozen')})
                          </span>
                        ) : null}
                      </>
                    ) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hunyuan</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {t('admin.freeTier')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Total Users */}
          <div className="store-card p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('admin.totalUsers')}</p>
                {loadingStats ? (
                  <div className="h-9 w-16 bg-muted animate-pulse rounded mt-1" />
                ) : (
                  <p className="mt-2 text-[32px] font-semibold tracking-tight text-foreground">
                    {stats?.totalUsers ?? '—'}
                  </p>
                )}
              </div>
              <div className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Jobs */}
          <div className="store-card p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('dashboard.totalGenerations')}</p>
                {loadingStats ? (
                  <div className="h-9 w-16 bg-muted animate-pulse rounded mt-1" />
                ) : (
                  <p className="mt-2 text-[32px] font-semibold tracking-tight text-foreground">
                    {stats?.jobs.total ?? '—'}
                  </p>
                )}
              </div>
              <div className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
            </div>
            {stats && (
              <div className="mt-2 flex gap-2 text-xs">
                <span className="text-green-600 dark:text-green-400">{t('admin.jobs.done', { count: stats.jobs.completed })}</span>
                <span className="text-yellow-600 dark:text-yellow-400">{t('admin.jobs.pending', { count: stats.jobs.pending })}</span>
                <span className="text-red-600 dark:text-red-400">{t('admin.jobs.failed', { count: stats.jobs.failed })}</span>
              </div>
            )}
          </div>

          {/* Credits Distributed */}
          <div className="store-card p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('admin.creditsDistributed')}</p>
                {loadingStats ? (
                  <div className="h-9 w-16 bg-muted animate-pulse rounded mt-1" />
                ) : (
                  <p className="mt-2 text-[32px] font-semibold tracking-tight text-foreground">
                    {stats?.totalCreditsDistributed ?? '—'}
                  </p>
                )}
              </div>
              <div className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Users table */}
        <div className="store-card overflow-hidden">
          <div className="px-7 py-6 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{t('admin.users')}</h2>
              {usersPagination && (
                <span className="text-sm text-muted-foreground">
                  {t('admin.totalUsersCount', { count: usersPagination.total })}
                </span>
              )}
            </div>
          </div>

          {usersLoading ? (
            <div className="p-10 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            </div>
          ) : users.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">{t('admin.noUsers')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground tracking-normal">
                      {t('admin.table.user')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground tracking-normal">
                      {t('admin.table.credits')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground tracking-normal">
                      {t('admin.table.generations')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground tracking-normal">
                      {t('admin.table.tier')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground tracking-normal">
                      {t('admin.table.role')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground tracking-normal">
                      {t('admin.table.joined')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground tracking-normal">
                      {t('admin.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {users.map((targetUser) => (
                    <tr key={targetUser.uid} className="hover:bg-muted/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {targetUser.photoURL ? (
                            <div className="relative h-8 w-8 overflow-hidden rounded-full">
                              <FillImage
                                src={targetUser.photoURL}
                                alt=""
                                className="object-cover"
                                sizes="32px"
                              />
                            </div>
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              <span className="text-sm font-medium text-muted-foreground">
                                {targetUser.displayName?.[0] || '?'}
                              </span>
                            </div>
                          )}
                          <div className="ml-3">
                            <p className="text-sm font-medium text-foreground">
                              {targetUser.displayName}
                            </p>
                            <p className="text-xs text-muted-foreground">{targetUser.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-sm font-medium ${
                            targetUser.credits >= 999999
                              ? 'text-primary'
                              : targetUser.credits > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {targetUser.credits >= 999999 ? '∞' : targetUser.credits}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {targetUser.totalGenerated}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            targetUser.tier === 'premium'
                              ? 'bg-accent text-accent-foreground'
                              : 'bg-secondary text-secondary-foreground'
                          }`}
                        >
                          {t(`tier.${targetUser.tier || 'free'}`)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            targetUser.role === 'admin'
                              ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                              : 'bg-secondary text-secondary-foreground'
                          }`}
                        >
                          {targetUser.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {targetUser.createdAt
                          ? new Date(targetUser.createdAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openUserDetail(targetUser)}
                          className="text-primary hover:underline"
                        >
                          {t('admin.manage')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {usersPagination && usersPagination.hasMore && (
            <div className="px-7 py-5 border-t border-border">
              <LoadingButton
                variant="link"
                size="sm"
                onClick={() =>
                  fetchUsers(
                    usersPagination.limit,
                    usersPagination.offset + usersPagination.limit
                  )
                }
                loading={usersLoading}
                className="text-primary hover:underline p-0 h-auto"
              >
                {t('admin.loadMore')}
              </LoadingButton>
            </div>
          )}
        </div>
      </main>

      {/* User Detail Modal */}
      <UserDetailModal
        user={selectedUser}
        open={showUserDetail}
        onClose={closeUserDetail}
        transactions={transactions}
        transactionsLoading={transactionsLoading}
        transactionsPagination={transactionsPagination}
        onFetchTransactions={fetchUserTransactions}
        onAddCredits={addCredits}
        onDeductCredits={deductCredits}
        onUpdateTier={updateUserTier}
        addingCredits={addingCredits}
        deductingCredits={deductingCredits}
        updatingTier={updatingTier}
      />
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminDashboardContent />
    </AdminGuard>
  );
}
