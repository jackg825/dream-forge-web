'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { AdminHeader } from '@/components/layout/headers';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { UserDetailModal } from '@/components/admin/UserDetailModal';
import { LoadingButton } from '@/components/ui/loading-button';
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AdminHeader />

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('nav.adminPanel')}</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('dashboard.welcomeBack', { name: user?.displayName || t('common.user') })}
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Provider Balances */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.providerBalances')}</p>
              <button
                onClick={fetchAllProviderBalances}
                disabled={loadingProviderBalances}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                title={t('admin.refresh')}
              >
                <svg
                  className={`w-4 h-4 text-purple-600 dark:text-purple-400 ${loadingProviderBalances ? 'animate-spin' : ''}`}
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
                  <div key={i} className="h-6 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Rodin</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {providerBalances?.rodin.balance?.toFixed(1) ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Meshy</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {providerBalances?.meshy.balance?.toLocaleString() ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Tripo</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {providerBalances?.tripo.balance !== null && providerBalances?.tripo.balance !== undefined ? (
                      <>
                        {providerBalances.tripo.balance.toLocaleString()}
                        {providerBalances.tripo.frozen ? (
                          <span className="text-xs text-gray-500 ml-1">
                            ({providerBalances.tripo.frozen} {t('admin.frozen')})
                          </span>
                        ) : null}
                      </>
                    ) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Hunyuan</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {t('admin.freeTier')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Total Users */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.totalUsers')}</p>
                {loadingStats ? (
                  <div className="h-9 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats?.totalUsers ?? '—'}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600 dark:text-blue-400"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.totalGenerations')}</p>
                {loadingStats ? (
                  <div className="h-9 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats?.jobs.total ?? '—'}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.creditsDistributed')}</p>
                {loadingStats ? (
                  <div className="h-9 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats?.totalCreditsDistributed ?? '—'}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.users')}</h2>
              {usersPagination && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {t('admin.totalUsersCount', { count: usersPagination.total })}
                </span>
              )}
            </div>
          </div>

          {usersLoading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
            </div>
          ) : users.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">{t('admin.noUsers')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.table.user')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.table.credits')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.table.generations')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.table.tier')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.table.role')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.table.joined')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((targetUser) => (
                    <tr key={targetUser.uid} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {targetUser.photoURL ? (
                            <img
                              className="h-8 w-8 rounded-full"
                              src={targetUser.photoURL}
                              alt=""
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-500 dark:text-gray-300">
                                {targetUser.displayName?.[0] || '?'}
                              </span>
                            </div>
                          )}
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {targetUser.displayName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{targetUser.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-sm font-medium ${
                            targetUser.credits >= 999999
                              ? 'text-purple-600 dark:text-purple-400'
                              : targetUser.credits > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {targetUser.credits >= 999999 ? '∞' : targetUser.credits}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {targetUser.totalGenerated}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            targetUser.tier === 'premium'
                              ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
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
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {targetUser.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {targetUser.createdAt
                          ? new Date(targetUser.createdAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openUserDetail(targetUser)}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200"
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
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
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
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200 p-0 h-auto"
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
