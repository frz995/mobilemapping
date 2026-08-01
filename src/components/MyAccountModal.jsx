import React, { useState, useEffect } from 'react';
import {
  X, User, Mail, Shield, LogOut, Lock, Eye, EyeOff,
  Activity, MapPin, Calendar, BarChart2, CheckCircle, AlertCircle,
  ChevronRight, Clock, Layers, Edit3, Save, Navigation, MousePointer2,
  Camera, FileText, Map as MapIcon, Wrench, Play, Download, RotateCcw
} from 'lucide-react';
import { supabase } from '../services/supabase';

const fmt = (n) => (n ?? 0).toLocaleString();

const StatCard = ({ icon: Icon, label, value, sub, gradient, iconColor }) => (
  <div className={`rounded-xl p-3 border ${gradient} flex flex-col gap-1`}>
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <Icon size={13} className={iconColor} />
    </div>
    <p className="text-xl font-extrabold text-gray-800 leading-none">{value}</p>
    {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
  </div>
);

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const MyAccountModal = ({ isOpen, onClose, user, signOut, usageStats = {}, onResetStats }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwStatus, setPwStatus] = useState(null);
  const [pwLoading, setPwLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (user) {
      const meta = user.user_metadata || {};
      setDisplayName(meta.display_name || meta.full_name || user.email?.split('@')[0] || 'User');
    }
  }, [user]);

  const handleSaveName = async () => {
    if (!displayName.trim()) return;
    const { error } = await supabase.auth.updateUser({ data: { display_name: displayName.trim() } });
    if (!error) {
      setEditingName(false);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 6) {
      setPwStatus({ type: 'error', message: 'Password must be at least 6 characters.' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPwStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }
    setPwLoading(true);
    setPwStatus(null);
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
    setPwLoading(false);
    if (error) {
      setPwStatus({ type: 'error', message: error.message });
    } else {
      setPwStatus({ type: 'success', message: 'Password updated successfully!' });
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setIsChangingPassword(false);
      setTimeout(() => setPwStatus(null), 4000);
    }
  };

  if (!isOpen || !user) return null;

  const email = user.email || '';
  const initials = displayName.slice(0, 2).toUpperCase();
  const joinDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';
  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'N/A';

  const s = usageStats;
  const session = s.session || {};

  // Activity score — weighted metric (0–100)
  const activityScore = Math.min(100, Math.round(
    (s.totalPointsVisited || 0) * 2 +
    (s.totalNavSteps || 0) * 3 +
    (s.totalMapClicks || 0) +
    (s.totalSnapshots || 0) * 5 +
    (s.totalToolsUsed || 0) * 2 +
    (s.totalSessions || 0) * 5
  ));
  const scoreColor = activityScore >= 70 ? 'text-green-600' : activityScore >= 30 ? 'text-amber-500' : 'text-blue-500';
  const scoreLabel = activityScore >= 70 ? 'Power User 🚀' : activityScore >= 30 ? 'Active Explorer 🗺️' : 'Getting Started 👋';

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'stats', label: 'Activity', icon: BarChart2 },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">

        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 px-6 pt-6 pb-16 shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all">
            <X size={18} />
          </button>
          <h2 className="text-white font-bold text-lg tracking-tight">My Account</h2>
          <p className="text-blue-200 text-xs mt-0.5">Manage your profile & view your activity</p>
        </div>

        {/* Avatar overlapping header */}
        <div className="relative flex items-end gap-4 px-6 -mt-10 mb-1 shrink-0">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-extrabold shadow-xl border-4 border-white ring-1 ring-blue-200">
              {initials}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white shadow-sm" />
          </div>
          <div className="pb-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {editingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="text-sm font-bold text-gray-800 border-b-2 border-blue-500 bg-transparent focus:outline-none w-32"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                  />
                  <button onClick={handleSaveName} className="p-1 text-blue-600"><Save size={14} /></button>
                  <button onClick={() => setEditingName(false)} className="p-1 text-gray-400"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <span className="font-bold text-gray-800 text-sm truncate max-w-[140px]">{displayName}</span>
                  <button onClick={() => setEditingName(true)} className="p-1 text-gray-400 hover:text-blue-500 transition-colors" title="Edit name"><Edit3 size={12} /></button>
                  {nameSaved && <CheckCircle size={13} className="text-green-500" />}
                </>
              )}
            </div>
            <span className="text-xs text-gray-500 truncate block max-w-[180px]">{email}</span>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-600 uppercase tracking-wider border border-blue-100">
              {user.role || 'Authenticated'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 mx-4 mt-3 shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── PROFILE TAB ── */}
          {activeTab === 'profile' && (
            <div className="space-y-3">
              {[
                { icon: Mail, label: 'Email', value: email },
                { icon: Calendar, label: 'Member Since', value: joinDate },
                { icon: Clock, label: 'Last Sign In', value: lastSignIn },
                { icon: Shield, label: 'Auth Provider', value: user.app_metadata?.provider || 'email' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
                    <p className="text-xs font-semibold text-gray-700 truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ACTIVITY STATS TAB ── */}
          {activeTab === 'stats' && (
            <div className="space-y-4">

              {/* Activity Score Banner */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Activity Score</p>
                  <p className={`text-3xl font-extrabold ${scoreColor}`}>{activityScore}<span className="text-sm font-normal text-gray-400">/100</span></p>
                  <p className="text-xs font-semibold text-gray-600 mt-0.5">{scoreLabel}</p>
                </div>
                {/* Mini progress arc */}
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#e0e7ff" strokeWidth="6" />
                  <circle
                    cx="32" cy="32" r="26" fill="none"
                    stroke={activityScore >= 70 ? '#16a34a' : activityScore >= 30 ? '#f59e0b' : '#3b82f6'}
                    strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${(activityScore / 100) * 163} 163`}
                    transform="rotate(-90 32 32)"
                  />
                  <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1e293b">{activityScore}</text>
                </svg>
              </div>

              {/* Session vs All-time toggle */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-0.5">This Session</p>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard icon={MapPin}       label="Points Visited"   value={fmt(session.pointsVisited)}  gradient="bg-blue-50 border-blue-100"   iconColor="text-blue-400" />
                  <StatCard icon={Navigation}   label="Nav Steps"        value={fmt(session.navSteps)}        gradient="bg-violet-50 border-violet-100" iconColor="text-violet-400" />
                  <StatCard icon={MousePointer2} label="Map Clicks"       value={fmt(session.mapClicks)}      gradient="bg-sky-50 border-sky-100"     iconColor="text-sky-400" />
                  <StatCard icon={Wrench}        label="Tools Used"       value={fmt(session.toolsUsed)}      gradient="bg-amber-50 border-amber-100" iconColor="text-amber-400" />
                  <StatCard icon={Camera}        label="Snapshots"        value={fmt(session.snapshots)}      gradient="bg-pink-50 border-pink-100"   iconColor="text-pink-400" />
                  <StatCard icon={MapIcon}       label="Basemap Changes"  value={fmt(session.basemapChanges)} gradient="bg-teal-50 border-teal-100"   iconColor="text-teal-400" />
                </div>
              </div>

              {/* All-time stats */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-0.5">All Time</p>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard icon={Activity}     label="Sessions"         value={fmt(s.totalSessions)}         gradient="bg-emerald-50 border-emerald-100" iconColor="text-emerald-400" />
                  <StatCard icon={Clock}         label="Time Spent"       value={formatDuration(s.totalTimeSeconds)} gradient="bg-indigo-50 border-indigo-100" iconColor="text-indigo-400" />
                  <StatCard icon={MapPin}        label="Points Visited"   value={fmt(s.totalPointsVisited)}   gradient="bg-blue-50 border-blue-100"      iconColor="text-blue-400" />
                  <StatCard icon={Navigation}    label="Nav Steps"        value={fmt(s.totalNavSteps)}         gradient="bg-violet-50 border-violet-100"  iconColor="text-violet-400" />
                  <StatCard icon={Camera}        label="Snapshots Taken"  value={fmt(s.totalSnapshots)}       gradient="bg-pink-50 border-pink-100"      iconColor="text-pink-400" />
                  <StatCard icon={FileText}      label="PDF Reports"      value={fmt(s.totalPdfReports)}      gradient="bg-orange-50 border-orange-100"  iconColor="text-orange-400" />
                  <StatCard icon={Play}          label="Playback Runs"    value={fmt(s.totalPlaybackRuns)}    gradient="bg-green-50 border-green-100"    iconColor="text-green-400" />
                  <StatCard icon={Layers}        label="Unique Subgrids"  value={fmt(s.uniqueSubgridsVisited?.length)} gradient="bg-purple-50 border-purple-100" iconColor="text-purple-400" />
                </div>
              </div>

              {/* Last used */}
              {s.lastUsed && (
                <p className="text-center text-[10px] text-gray-400">
                  Last active: {new Date(s.lastUsed).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}

              {/* Reset stats */}
              <div>
                {!confirmReset ? (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 text-[11px] font-semibold transition-all"
                  >
                    <RotateCcw size={12} /> Reset All Stats
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { onResetStats && onResetStats(); setConfirmReset(false); }}
                      className="flex-1 py-2 rounded-lg bg-red-500 text-white text-[11px] font-bold hover:bg-red-600 transition-colors"
                    >
                      Confirm Reset
                    </button>
                    <button
                      onClick={() => setConfirmReset(false)}
                      className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-500 text-[11px] font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SECURITY TAB ── */}
          {activeTab === 'security' && (
            <div className="space-y-3">
              <div className="bg-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => { setIsChangingPassword(!isChangingPassword); setPwStatus(null); }}
                  className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Lock size={15} className="text-blue-500" />
                    Change Password
                  </div>
                  <ChevronRight size={15} className={`text-gray-400 transition-transform duration-200 ${isChangingPassword ? 'rotate-90' : ''}`} />
                </button>

                {isChangingPassword && (
                  <form onSubmit={handleChangePassword} className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPw ? 'text' : 'password'}
                          value={passwordForm.newPassword}
                          onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                          className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-9"
                          placeholder="Min. 6 characters" minLength={6} required
                        />
                        <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPw ? 'text' : 'password'}
                          value={passwordForm.confirmPassword}
                          onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                          className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-9"
                          placeholder="Repeat new password" required
                        />
                        <button type="button" onClick={() => setShowConfirmPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showConfirmPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    {pwStatus && (
                      <div className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium ${pwStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {pwStatus.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                        {pwStatus.message}
                      </div>
                    )}
                    <button
                      type="submit" disabled={pwLoading}
                      className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {pwLoading ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Updating...</> : <><Lock size={13} /> Update Password</>}
                    </button>
                  </form>
                )}
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Activity size={11} /> Session Info
                </p>
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between"><span className="text-gray-400">User ID</span><span className="font-mono text-[10px] text-gray-600 truncate max-w-[140px]">{user.id?.slice(0, 16)}…</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Email Verified</span><span className={user.email_confirmed_at ? 'text-green-600 font-semibold' : 'text-red-500'}>{user.email_confirmed_at ? '✓ Verified' : '✗ Not Verified'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Last Login</span><span className="text-gray-600">{lastSignIn}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2 border-t border-gray-100 shrink-0">
          <button
            onClick={async () => { onClose(); await signOut(); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 text-sm font-semibold transition-all group"
          >
            <LogOut size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyAccountModal;
