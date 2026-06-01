import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, UserRound, CheckCircle2, Clock3, Save } from 'lucide-react';
import type { AuthUser, AppPagePermissions, PageAccessMode } from '../access';
import { defaultApprovedPermissions, normalizePermissions, pageDefinitions } from '../access';

interface Props {
  currentUser: AuthUser;
}

type EditableUser = AuthUser & { dirty?: boolean };

export default function UserAccess({ currentUser }: Props) {
  const [users, setUsers] = useState<EditableUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingUsername, setSavingUsername] = useState<string | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch('/api/admin/users', {
          credentials: 'include',
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null) as { message?: string } | null;
          throw new Error(body?.message || 'Unable to load users');
        }

        const body = await response.json() as { users: AuthUser[] };
        setUsers(body.users.map((user) => ({
          ...user,
          permissions: normalizePermissions(user.permissions, defaultApprovedPermissions),
          dirty: false,
        })));
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to load users');
      } finally {
        setIsLoading(false);
      }
    };

    void loadUsers();
  }, []);

  const pendingCount = useMemo(() => users.filter((user) => user.status === 'pending').length, [users]);

  const updateUser = (username: string, updater: (user: EditableUser) => EditableUser) => {
    setUsers((prev) => prev.map((user) => {
      if (user.username !== username) return user;
      return { ...updater(user), dirty: true };
    }));
  };

  const handleStatusChange = (username: string, status: 'pending' | 'approved') => {
    updateUser(username, (user) => ({ ...user, status }));
  };

  const handlePermissionChange = (username: string, key: keyof AppPagePermissions, mode: PageAccessMode) => {
    updateUser(username, (user) => ({
      ...user,
      permissions: {
        ...user.permissions,
        [key]: mode,
      },
    }));
  };

  const handleSave = async (user: EditableUser) => {
    setSavingUsername(user.username);
    setError('');
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.username)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          status: user.status,
          permissions: user.permissions,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || 'Unable to save user changes');
      }

      const body = await response.json() as { user: AuthUser };
      setUsers((prev) => prev.map((entry) => entry.username === user.username ? {
        ...body.user,
        permissions: normalizePermissions(body.user.permissions, defaultApprovedPermissions),
        dirty: false,
      } : entry));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save user changes');
    } finally {
      setSavingUsername(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-green-900">User Access</h1>
          <p className="mt-1 text-sm text-gray-600">Approve sign-ups and control who can view or edit each page.</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-white px-4 py-3 text-sm shadow-sm">
          <div className="font-semibold text-green-900">Signed in as {currentUser.username}</div>
          <div className="text-gray-600">{pendingCount} pending approval</div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {isLoading ? (
        <div className="card text-sm text-gray-500">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="card text-sm text-gray-500">No users found.</div>
      ) : (
        <div className="space-y-4">
          {users.map((user) => {
            const isAdminAccount = user.isAdmin;
            return (
              <div key={user.username} className="card space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-green-700">
                      {isAdminAccount ? <ShieldCheck className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-green-900">{user.username}</h2>
                        {user.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            <Clock3 className="h-3.5 w-3.5" /> Pending
                          </span>
                        )}
                        {isAdminAccount && (
                          <span className="inline-flex rounded-full bg-green-900 px-2 py-0.5 text-xs font-semibold text-white">Admin</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">Created {new Date(user.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  {!isAdminAccount && (
                    <div className="flex items-center gap-2">
                      <select
                        value={user.status}
                        onChange={(event) => handleStatusChange(user.username, event.target.value as 'pending' | 'approved')}
                        className="form-input w-32"
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                      </select>
                      <button
                        onClick={() => void handleSave(user)}
                        disabled={!user.dirty || savingUsername === user.username}
                        className="btn-primary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" />
                        {savingUsername === user.username ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Page</th>
                        <th className="py-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Route</th>
                        <th className="py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pageDefinitions.map((page) => (
                        <tr key={`${user.username}-${page.key}`}>
                          <td className="py-2 pr-3 text-gray-800">{page.label}</td>
                          <td className="py-2 pr-3 text-gray-500">{page.route}</td>
                          <td className="py-2">
                            {isAdminAccount || page.adminOnly ? (
                              <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                                {isAdminAccount ? 'Edit (admin)' : 'Admin only'}
                              </span>
                            ) : (
                              <select
                                value={user.permissions[page.key]}
                                onChange={(event) => handlePermissionChange(user.username, page.key, event.target.value as PageAccessMode)}
                                className="form-input w-28"
                              >
                                <option value="none">No access</option>
                                <option value="view">View</option>
                                <option value="edit">Edit</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}