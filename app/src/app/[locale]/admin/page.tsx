'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { AdminHeader } from '@/components/layout/headers';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { UserDetailModal } from '@/components/admin/UserDetailModal';
import type { AdminUser } from '@/types';

function AdminDashboardContent() {
  const t = useTranslations();
  const { user } = useAuth();
  const {
    rodinBalance,
    loadingBalance,
    fetchRodinBalance,
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
    fetchRodinBalance();
    fetchStats();
    fetchUsers();
  }, [fetchRodinBalance, fetchStats, fetchUsers]);

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
          {/* Rodin API Balance */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Rodin API Balance</p>
                {loadingBalance ? (
                  <div className="h-9 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {rodinBalance !== null ? rodinBalance.toFixed(1) : '—'}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600 dark:text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
            </div>
            <button
              onClick={fetchRodinBalance}
              disabled={loadingBalance}
              className="mt-3 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 disabled:opacity-50"
            >
              {loadingBalance ? t('common.loading') : t('controls.reset')}
            </button>
          </div>

          {/* Total Users */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
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
                <span className="text-green-600 dark:text-green-400">{stats.jobs.completed} done</span>
                <span className="text-yellow-600 dark:text-yellow-400">{stats.jobs.pending} pending</span>
                <span className="text-red-600 dark:text-red-400">{stats.jobs.failed} failed</span>
              </div>
            )}
          </div>

          {/* Credits Distributed */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Credits Distributed</p>
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Users</h2>
              {usersPagination && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {usersPagination.total} total users
                </span>
              )}
            </div>
          </div>

          {usersLoading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
            </div>
          ) : users.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Credits
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Generations
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
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
                          管理
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
              <button
                onClick={() =>
                  fetchUsers(
                    usersPagination.limit,
                    usersPagination.offset + usersPagination.limit
                  )
                }
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200"
              >
                Load more
              </button>
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
        addingCredits={addingCredits}
        deductingCredits={deductingCredits}
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
