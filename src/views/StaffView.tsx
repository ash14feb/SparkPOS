import { useEffect, useState } from 'react';
import { Users, Plus, Pencil, Trash2, Mail, RefreshCw, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

interface StoreUser {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  user_type: string;
  is_active: number;
}

const emptyForm = { full_name: '', email: '', username: '', user_type: 'staff', assigned_store: 'all' };

export function StaffView() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<StoreUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StoreUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const role = (user?.user_type || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'super_admin';

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await api.getUsers();
      const list = res.data?.users || res.users || res.data || [];
      // Filter out admin rows (per spec)
      setUsers((Array.isArray(list) ? list : []).filter((u: StoreUser) => u.user_type !== 'admin'));
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (u: StoreUser) => {
    setEditing(u);
    setForm({ full_name: u.full_name || '', email: u.email || '', username: u.username || '', user_type: u.user_type, assigned_store: 'all' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.email.trim() || (!editing && !form.username.trim())) {
      return toast.error('Name, email and username suffix are required');
    }
    setIsSaving(true);
    try {
      if (editing) {
        // Username locked on edit
        await api.updateUser(editing.user_id, { full_name: form.full_name, email: form.email, user_type: form.user_type });
        toast.success('User updated successfully');
      } else {
        await api.createUser(form);
        toast.success('User created successfully and credentials emailed');
      }
      setShowForm(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (u: StoreUser) => {
    if (!confirm(`Deactivate ${u.full_name || u.username}?`)) return;
    try {
      await api.deleteUser(u.user_id);
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    }
  };

  const handleResend = async (u: StoreUser) => {
    try {
      await api.resendCredentials(u.user_id);
      toast.success('User credentials resent successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend credentials');
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-gray-500 font-medium">Only admins can manage staff.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-gray-50 overflow-hidden">
      <div className="bg-white p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm z-10 shrink-0">
        <div className="flex items-center">
          <Users className="w-8 h-8 text-brand-600 mr-3 hidden sm:block" />
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-gray-900 leading-tight">Staff</h1>
            <p className="text-sm text-gray-500">Create users — credentials are emailed to them</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchUsers} className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </button>
          <button onClick={openCreate} className="flex items-center px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Add User
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 custom-scrollbar no-chain-scroll">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-base font-medium text-gray-900">No staff users yet</p>
            <p className="text-sm">Add your first user with the button above.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.user_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{u.full_name}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                      <div className="text-xs text-gray-400 sm:hidden">{u.username}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">{u.username}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 inline-flex text-xs font-semibold rounded-full bg-brand-50 text-brand-700 capitalize">{u.user_type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        'px-2.5 py-1 inline-flex text-xs font-semibold rounded-full',
                        u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                      )}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(u)} title="Edit" className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleResend(u)} title="Resend credentials" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Mail className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(u)} title="Delete" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit User' : 'Add User'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" placeholder="Raju" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" placeholder="raju@shop.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username suffix *</label>
                <input value={form.username} disabled={!!editing} onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none disabled:bg-gray-50 disabled:text-gray-400" placeholder="raju" />
                <p className="text-xs text-gray-400 mt-1">{editing ? 'Username is locked after creation.' : 'Full login becomes <admin-username>.<suffix>.'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={form.user_type} onChange={(e) => setForm({ ...form, user_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none">
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <button onClick={handleSave} disabled={isSaving}
                className="w-full py-2.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-70">
                {isSaving ? 'Saving...' : editing ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
