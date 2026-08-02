import React, { useState, useEffect } from 'react';
import {
  X, User, Mail, Shield, LogOut, Lock, Eye, EyeOff,
  Activity, MapPin, Calendar, BarChart2, CheckCircle, AlertCircle,
  ChevronRight, Clock, Layers, Edit3, Save, Navigation, MousePointer2,
  Camera, FileText, Map as MapIcon, Wrench, Play, RotateCcw
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import clsx from 'clsx';

const fmt = (n) => (n ?? 0).toLocaleString();

const StatCard = ({ icon: Icon, label, value, sub, isDark }) => (
  <div className={clsx(
    "rounded-2xl p-3 border transition-all flex flex-col gap-1",
    isDark
      ? "bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600"
      : "bg-slate-50/80 border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-sm"
  )}>
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <Icon size={14} className={isDark ? "text-blue-400" : "text-blue-600"} />
    </div>
    <p className={clsx("text-xl font-extrabold leading-none", isDark ? "text-slate-100" : "text-slate-800")}>{value}</p>
    {sub && <p className="text-[10px] font-semibold text-slate-400">{sub}</p>}
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
  const { isDark } = useTheme();
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

  const activityScore = Math.min(100, Math.round(
    (s.totalPointsVisited || 0) * 2 +
    (s.totalNavSteps || 0) * 3 +
    (s.totalMapClicks || 0) +
    (s.totalSnapshots || 0) * 5 +
    (s.totalToolsUsed || 0) * 2 +
    (s.totalSessions || 0) * 5
  ));
  const scoreLabel = activityScore >= 70 ? 'Power User 🚀' : activityScore >= 30 ? 'Active Explorer 🗺️' : 'Getting Started 👋';

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'stats', label: 'Activity', icon: BarChart2 },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className={clsx(
        "backdrop-blur-2xl border max-w-md w-full p-6 space-y-4 relative overflow-hidden flex flex-col max-h-[90vh] rounded-3xl transition-all duration-300",
        isDark
          ? "bg-slate-900/95 border-slate-800 text-slate-100 shadow-2xl shadow-slate-950/80"
          : "bg-white/95 border-slate-200/90 text-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)]"
      )}>

        {/* Top Decorative Subtle Ambient Gradient */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-32 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />

        {/* Header */}
        <div className={clsx("flex items-center justify-between pb-3 border-b relative shrink-0", isDark ? "border-slate-800" : "border-slate-100")}>
          <div className="flex items-center gap-3">
            <div className={clsx("p-2.5 border rounded-2xl shadow-sm", isDark ? "bg-blue-950/60 border-blue-800/60 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600")}>
              <User size={22} />
            </div>
            <div>
              <h3 className={clsx("font-extrabold text-base tracking-tight", isDark ? "text-slate-100" : "text-slate-800")}>My Account</h3>
              <p className="text-[11px] font-semibold text-slate-400">Manage profile & activity stats</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={clsx("p-2 rounded-2xl transition-all", isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100")}
          >
            <X size={18} />
          </button>
        </div>

        {/* User Details Card */}
        <div className={clsx("p-3.5 border rounded-2xl flex items-center gap-3.5 relative shrink-0", isDark ? "bg-slate-800/60 border-slate-700/60" : "bg-slate-50/80 border-slate-200/80")}>
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-base font-extrabold shadow-md shadow-blue-600/20">
              {initials}
            </div>
            <div className={clsx("absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 shadow-sm", isDark ? "border-slate-800" : "border-white")} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {editingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className={clsx("text-xs font-bold border-b-2 border-blue-600 bg-transparent focus:outline-none w-32", isDark ? "text-slate-100" : "text-slate-800")}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                  />
                  <button onClick={handleSaveName} className="p-1 text-blue-500 hover:text-blue-400"><Save size={13} /></button>
                  <button onClick={() => setEditingName(false)} className={clsx("p-1", isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-600")}><X size={13} /></button>
                </div>
              ) : (
                <>
                  <span className={clsx("font-bold text-xs truncate max-w-[140px]", isDark ? "text-slate-100" : "text-slate-800")}>{displayName}</span>
                  <button onClick={() => setEditingName(true)} className={clsx("p-0.5 transition-colors", isDark ? "text-slate-400 hover:text-blue-400" : "text-slate-400 hover:text-blue-600")} title="Edit name"><Edit3 size={11} /></button>
                  {nameSaved && <CheckCircle size={12} className={isDark ? "text-blue-400" : "text-blue-600"} />}
                </>
              )}
            </div>
            <span className="text-[11px] font-semibold text-slate-400 truncate block">{email}</span>
            <span className={clsx("inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border", isDark ? "bg-blue-950/60 text-blue-400 border-blue-800/40" : "bg-blue-50 text-blue-600 border-blue-100")}>
              {user.role || 'Authenticated'}
            </span>
          </div>
        </div>

        {/* Segmented Tabs */}
        <div className={clsx("grid grid-cols-3 gap-1.5 p-1 border rounded-2xl shrink-0", isDark ? "bg-slate-800/60 border-slate-700/60" : "bg-slate-100/70 border-slate-200/60")}>
          {tabs.map(t => {
            const isSelected = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={clsx(
                  "py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                  isSelected
                    ? isDark ? "bg-slate-900 text-blue-400 border border-slate-700 shadow-sm" : "bg-white text-blue-600 shadow-sm border border-slate-200/80"
                    : isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <t.icon size={13} className={isSelected ? (isDark ? "text-blue-400" : "text-blue-600") : "text-slate-400"} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">

          {/* ── PROFILE TAB ── */}
          {activeTab === 'profile' && (
            <div className="space-y-2.5">
              {[
                { icon: Mail, label: 'Email', value: email },
                { icon: Calendar, label: 'Member Since', value: joinDate },
                { icon: Clock, label: 'Last Sign In', value: lastSignIn },
                { icon: Shield, label: 'Auth Provider', value: user.app_metadata?.provider || 'email' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className={clsx("flex items-center gap-3 p-3 rounded-2xl border", isDark ? "bg-slate-800/60 border-slate-700/60" : "bg-slate-50/80 border-slate-200/80")}>
                  <div className={clsx("w-8 h-8 rounded-xl border flex items-center justify-center shrink-0", isDark ? "bg-blue-950/60 border-blue-800/60 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600")}>
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
                    <p className={clsx("text-xs font-bold truncate", isDark ? "text-slate-100" : "text-slate-800")}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ACTIVITY STATS TAB ── */}
          {activeTab === 'stats' && (
            <div className="space-y-4">

              {/* Activity Score Banner */}
              <div className={clsx("border rounded-2xl p-3.5 flex items-center justify-between", isDark ? "bg-slate-800/60 border-slate-700/60" : "bg-slate-50/80 border-slate-200/80")}>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Activity Score</p>
                  <p className={clsx("text-3xl font-extrabold", isDark ? "text-blue-400" : "text-blue-600")}>{activityScore}<span className="text-xs font-normal text-slate-400">/100</span></p>
                  <p className={clsx("text-xs font-bold mt-0.5", isDark ? "text-slate-300" : "text-slate-700")}>{scoreLabel}</p>
                </div>
                {/* Mini progress arc */}
                <svg width="56" height="56" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke={isDark ? "#334155" : "#e2e8f0"} strokeWidth="6" />
                  <circle
                    cx="32" cy="32" r="26" fill="none"
                    stroke={isDark ? "#60a5fa" : "#2563eb"}
                    strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${(activityScore / 100) * 163} 163`}
                    transform="rotate(-90 32 32)"
                  />
                  <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="bold" fill={isDark ? "#f1f5f9" : "#1e293b"}>{activityScore}</text>
                </svg>
              </div>

              {/* Session Stats */}
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 px-0.5">This Session</p>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard icon={MapPin}       label="Points Visited"   value={fmt(session.pointsVisited)} isDark={isDark} />
                  <StatCard icon={Navigation}   label="Nav Steps"        value={fmt(session.navSteps)} isDark={isDark} />
                  <StatCard icon={MousePointer2} label="Map Clicks"       value={fmt(session.mapClicks)} isDark={isDark} />
                  <StatCard icon={Wrench}        label="Tools Used"       value={fmt(session.toolsUsed)} isDark={isDark} />
                  <StatCard icon={Camera}        label="Snapshots"        value={fmt(session.snapshots)} isDark={isDark} />
                  <StatCard icon={MapIcon}       label="Basemap Changes"  value={fmt(session.basemapChanges)} isDark={isDark} />
                </div>
              </div>

              {/* All-time stats */}
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 px-0.5">All Time</p>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard icon={Activity}     label="Sessions"         value={fmt(s.totalSessions)} isDark={isDark} />
                  <StatCard icon={Clock}         label="Time Spent"       value={formatDuration(s.totalTimeSeconds)} isDark={isDark} />
                  <StatCard icon={MapPin}        label="Points Visited"   value={fmt(s.totalPointsVisited)} isDark={isDark} />
                  <StatCard icon={Navigation}    label="Nav Steps"        value={fmt(s.totalNavSteps)} isDark={isDark} />
                  <StatCard icon={Camera}        label="Snapshots Taken"  value={fmt(s.totalSnapshots)} isDark={isDark} />
                  <StatCard icon={FileText}      label="PDF Reports"      value={fmt(s.totalPdfReports)} isDark={isDark} />
                  <StatCard icon={Play}          label="Playback Runs"    value={fmt(s.totalPlaybackRuns)} isDark={isDark} />
                  <StatCard icon={Layers}        label="Unique Subgrids"  value={fmt(s.uniqueSubgridsVisited?.length)} isDark={isDark} />
                </div>
              </div>

              {/* Last used */}
              {s.lastUsed && (
                <p className="text-center text-[10px] font-semibold text-slate-400">
                  Last active: {new Date(s.lastUsed).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}

              {/* Reset stats */}
              <div>
                {!confirmReset ? (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className={clsx(
                      "w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[11px] font-bold transition-all",
                      isDark ? "border-slate-700 text-slate-400 hover:text-blue-400 hover:bg-blue-950/40" : "border-slate-200/80 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                    )}
                  >
                    <RotateCcw size={12} /> Reset All Stats
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { onResetStats && onResetStats(); setConfirmReset(false); }}
                      className="flex-1 py-2 rounded-xl bg-red-500 text-white text-[11px] font-bold hover:bg-red-600 transition-colors"
                    >
                      Confirm Reset
                    </button>
                    <button
                      onClick={() => setConfirmReset(false)}
                      className={clsx(
                        "flex-1 py-2 rounded-xl border text-[11px] font-semibold transition-colors",
                        isDark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
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
              <div className={clsx("border rounded-2xl overflow-hidden", isDark ? "bg-slate-800/60 border-slate-700/60" : "bg-slate-50/80 border-slate-200/80")}>
                <button
                  onClick={() => { setIsChangingPassword(!isChangingPassword); setPwStatus(null); }}
                  className={clsx(
                    "flex items-center justify-between w-full px-4 py-3 text-xs font-bold transition-colors",
                    isDark ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100/70"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Lock size={14} className={isDark ? "text-blue-400" : "text-blue-600"} />
                    Change Password
                  </div>
                  <ChevronRight size={14} className={`text-slate-400 transition-transform duration-200 ${isChangingPassword ? 'rotate-90' : ''}`} />
                </button>

                {isChangingPassword && (
                  <form onSubmit={handleChangePassword} className={clsx("px-4 pb-4 space-y-3 border-t pt-3", isDark ? "border-slate-700/60" : "border-slate-200/60")}>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPw ? 'text' : 'password'}
                          value={passwordForm.newPassword}
                          onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                          className={clsx(
                            "w-full px-3.5 py-2 text-xs font-bold border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 pr-9",
                            isDark ? "bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500" : "bg-white border-slate-200 text-slate-800"
                          )}
                          placeholder="Min. 6 characters" minLength={6} required
                        />
                        <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                          {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPw ? 'text' : 'password'}
                          value={passwordForm.confirmPassword}
                          onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                          className={clsx(
                            "w-full px-3.5 py-2 text-xs font-bold border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 pr-9",
                            isDark ? "bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500" : "bg-white border-slate-200 text-slate-800"
                          )}
                          placeholder="Repeat new password" required
                        />
                        <button type="button" onClick={() => setShowConfirmPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                          {showConfirmPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    {pwStatus && (
                      <div className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium ${pwStatus.type === 'success' ? (isDark ? 'bg-blue-950/60 text-blue-400 border border-blue-800' : 'bg-blue-50 text-blue-700 border border-blue-200') : (isDark ? 'bg-red-950/60 text-red-400 border border-red-800' : 'bg-red-50 text-red-700 border border-red-200')}`}>
                        {pwStatus.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                        {pwStatus.message}
                      </div>
                    )}
                    <button
                      type="submit" disabled={pwLoading}
                      className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-blue-600/20"
                    >
                      {pwLoading ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Updating...</> : <><Lock size={13} /> Update Password</>}
                    </button>
                  </form>
                )}
              </div>

              <div className={clsx("p-3.5 rounded-2xl border space-y-2", isDark ? "bg-slate-800/60 border-slate-700/60" : "bg-slate-50/80 border-slate-200/80")}>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Activity size={11} /> Session Info
                </p>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-slate-400">User ID</span><span className={clsx("font-mono text-[10px] truncate max-w-[140px]", isDark ? "text-slate-300" : "text-slate-600")}>{user.id?.slice(0, 16)}…</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Email Verified</span><span className={user.email_confirmed_at ? (isDark ? 'text-blue-400 font-semibold' : 'text-blue-600 font-semibold') : 'text-red-500'}>{user.email_confirmed_at ? '✓ Verified' : '✗ Not Verified'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Last Login</span><span className={isDark ? "text-slate-300" : "text-slate-600"}>{lastSignIn}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Action Buttons */}
        <div className={clsx("flex items-center justify-end gap-3 pt-3 border-t shrink-0", isDark ? "border-slate-800" : "border-slate-100")}>
          <button
            type="button"
            onClick={onClose}
            className={clsx("px-5 py-2.5 rounded-2xl font-semibold text-xs transition-all", isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100")}
          >
            Close
          </button>
          <button
            onClick={async () => { onClose(); await signOut(); }}
            className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 active:scale-95 transition-all flex items-center gap-2"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyAccountModal;


