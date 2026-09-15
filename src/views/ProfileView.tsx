import { useState } from 'react';
import { UserRound, KeyRound, LogOut, Save, Palette, Check } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore, THEMES } from '../store/useThemeStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

export function ProfileView() {
  const { user, updateProfile, changePassword, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'details' | 'password'>('details');

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  const handleSaveProfile = async () => {
    if (!fullName.trim()) return toast.error('Full name is required');
    setIsSavingProfile(true);
    try {
      await updateProfile({ full_name: fullName.trim() });
      toast.success('Profile updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return toast.error('Enter current and new password');
    if (newPassword.length < 6) return toast.error('New password must be at least 6 characters');
    if (newPassword !== confirmPassword) return toast.error('New passwords do not match');
    setIsChanging(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setIsChanging(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-gray-50 overflow-hidden">
      <div className="bg-white p-4 sm:p-6 border-b border-gray-100 shadow-sm z-10 shrink-0">
        <div className="flex items-center max-w-3xl mx-auto w-full">
          <UserRound className="w-8 h-8 text-brand-600 mr-3 hidden sm:block" />
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-gray-900 leading-tight">Profile</h1>
            <p className="text-sm text-gray-500 capitalize">{user?.user_type} · {user?.username}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 custom-scrollbar no-chain-scroll">
        <div className="max-w-3xl mx-auto space-y-4 pb-20 md:pb-4">
          {/* Tabs */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('details')}
              className={cn(
                'flex items-center px-5 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === 'details' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <UserRound className="w-4 h-4 mr-2" /> My Details
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={cn(
                'flex items-center px-5 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === 'password' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <KeyRound className="w-4 h-4 mr-2" /> Change Password
            </button>
          </div>

          {activeTab === 'details' && (
            <>
              {/* My details */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4">My Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username (cannot be changed)</label>
                    <input value={user?.username || ''} disabled
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email (cannot be changed)</label>
                    <input value={user?.email || ''} disabled
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 outline-none" />
                  </div>
                  <button onClick={handleSaveProfile} disabled={isSavingProfile}
                    className="flex items-center justify-center px-6 py-2.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-70">
                    <Save className="w-4 h-4 mr-2" /> {isSavingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {/* Theme */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-1 flex items-center">
                  <Palette className="w-5 h-5 mr-2 text-brand-600" /> App Theme
                </h2>
                <p className="text-sm text-gray-500 mb-4">Pick a color theme for your POS.</p>
                <div className="grid grid-cols-4 gap-3">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-xl border transition-all',
                        theme === t.id
                          ? 'border-brand-600 bg-brand-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <span
                        className="w-10 h-10 rounded-full shadow-inner flex items-center justify-center"
                        style={{ background: t.preview }}
                      >
                        {theme === t.id && <Check className="w-5 h-5 text-white" />}
                      </span>
                      <span className="text-xs font-bold text-gray-700">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'password' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                <KeyRound className="w-5 h-5 mr-2 text-brand-600" /> Change Password
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password (min 6)</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                  </div>
                </div>
                <button onClick={handleChangePassword} disabled={isChanging}
                  className="flex items-center justify-center px-6 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-70">
                  <KeyRound className="w-4 h-4 mr-2" /> {isChanging ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </div>
          )}

          <button onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-3 rounded-xl text-sm font-medium text-red-600 bg-white border border-red-100 hover:bg-red-50 transition-colors">
            <LogOut className="w-5 h-5 mr-2" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
