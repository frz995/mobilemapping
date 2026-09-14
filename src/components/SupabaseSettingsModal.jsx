import React, { useState, useEffect } from 'react';
import {
  X, Database, Server, KeyRound, Save, RotateCcw, CheckCircle, AlertCircle, Loader2, Plug
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import clsx from 'clsx';

export const SUPABASE_TARGET_STORAGE_KEY = 'webgis.supabaseTarget';

const Input = ({ icon: Icon, label, value, onChange, placeholder, type = 'text', isDark }) => (
  <label className="block">
    <span className={clsx(
      "flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-1.5",
      isDark ? "text-slate-400" : "text-gray-500"
    )}>
      <Icon size={12} />
      {label}
    </span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      className={clsx(
        "w-full rounded-xl border px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 transition-all",
        isDark
          ? "bg-slate-800/70 border-slate-700/70 text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:ring-blue-500/30"
          : "bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20"
      )}
    />
  </label>
);

const SupabaseSettingsModal = ({ isOpen, onClose, currentTarget, onApplyTarget, defaultUrl = '' }) => {
  const { isDark } = useTheme();
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [keyDirty, setKeyDirty] = useState(false); // user typed a new key
  const [status, setStatus] = useState(null); // { kind: 'ok'|'err', text }
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Privacy: never prefill the stored anon key — show a masked marker only.
      setUrl(currentTarget?.url || '');
      setAnonKey('');
      setKeyDirty(false);
      setStatus(null);
    }
  }, [isOpen, currentTarget]);

  if (!isOpen) return null;

  const save = () => {
    const trimmedUrl = url.trim().replace(/\/+$/, '');
    if (!trimmedUrl) {
      onApplyTarget(null);
      setStatus({ kind: 'ok', text: 'Using default backend.' });
      return;
    }
    // If the key box was left empty, keep whatever key is already stored.
    const nextKey = (keyDirty && anonKey.trim()) ? anonKey.trim() : (currentTarget?.anonKey || '');
    onApplyTarget({ url: trimmedUrl, anonKey: nextKey });
    setStatus({ kind: 'ok', text: 'Backend saved. Reloading map data…' });
  };

  const resetToDefault = () => {
    setUrl(defaultUrl || '');
    setAnonKey('');
    setKeyDirty(false);
    onApplyTarget(null);
    setStatus({ kind: 'ok', text: 'Reset to default backend.' });
  };

  const testConnection = async () => {
    const trimmedUrl = url.trim().replace(/\/+$/, '');
    if (!trimmedUrl) {
      setStatus({ kind: 'err', text: 'Enter a Supabase URL first.' });
      return;
    }
    setTesting(true);
    setStatus(null);
    // Privacy: never send the stored key unless the user typed one now.
    const testKey = keyDirty ? anonKey.trim() : '';
    try {
      const res = await fetch(`${trimmedUrl}/rest/v1/`, {
        headers: {
          apikey: testKey,
          Authorization: `Bearer ${testKey}`
        }
      });
      // Any HTTP response means the server is reachable. 401/403 are EXPECTED
      // for the REST root with a scoped anon key — auth is enforced per-table,
      // not at the root, so treat them as "reachable".
      setStatus({ kind: 'ok', text: `Reachable! Server responded ${res.status}.` });
    } catch (err) {
      setStatus({ kind: 'err', text: `Connection failed: ${(err?.message || err).slice(0, 120)}` });
    } finally {
      setTesting(false);
    }
  };

  const usingCustom = Boolean(currentTarget?.url);
  const hasStoredKey = Boolean(currentTarget?.anonKey);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx(
        "relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden",
        isDark ? "bg-slate-900 border-slate-700/80 text-slate-100 shadow-slate-950/60" : "bg-white border-gray-200/80 text-gray-800"
      )}>
        {/* Header */}
        <div className={clsx(
          "flex items-center justify-between px-5 py-4 border-b",
          isDark ? "border-slate-800" : "border-gray-100"
        )}>
          <div className="flex items-center gap-3">
            <div className={clsx(
              "p-2 rounded-xl flex items-center justify-center",
              isDark ? "bg-blue-950/60 text-blue-400" : "bg-blue-50 text-blue-600"
            )}>
              <Database size={18} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold leading-tight">Database Backend</h2>
              <span className={clsx("text-[10px] font-semibold", isDark ? "text-slate-400" : "text-gray-500")}>
                Point the map at local or cloud Supabase
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className={clsx(
              "p-2 rounded-lg transition-colors",
              isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            )}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {usingCustom ? (
            <div className={clsx(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold",
              isDark ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800/50" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            )}>
              <CheckCircle size={14} />
              Custom backend active{currentTarget?.url ? `: ${currentTarget.url}` : ''}.
            </div>
          ) : (
            <div className={clsx(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold",
              isDark ? "bg-slate-800/60 text-slate-400 border border-slate-700/60" : "bg-gray-50 text-gray-500 border border-gray-200"
            )}>
              <CheckCircle size={14} />
              Using default backend.
            </div>
          )}

          <Input
            icon={Server}
            label="Supabase URL"
            value={url}
            onChange={setUrl}
            placeholder="https://YOUR-PROJECT.supabase.co"
            isDark={isDark}
          />

          {keyDirty || anonKey ? (
            <Input
              icon={KeyRound}
              label="Anon Key"
              value={anonKey}
              onChange={(v) => { setAnonKey(v); setKeyDirty(true); }}
              placeholder="Paste your anon / publishable key"
              type="password"
              isDark={isDark}
            />
          ) : (
            <button
              type="button"
              onClick={() => { setKeyDirty(true); setAnonKey(''); }}
              className={clsx(
                "flex w-full items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-xs font-semibold transition-all",
                isDark ? "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200" : "border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700"
              )}
            >
              <KeyRound size={14} />
              {hasStoredKey ? 'Replace stored anon key…' : 'Set anon key (optional)…'}
            </button>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={testConnection}
              disabled={testing}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all shadow-sm",
                isDark
                  ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                  : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-white hover:shadow"
              )}
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
              Test Connection
            </button>
            <button
              onClick={save}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all shadow-sm",
                "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/30"
              )}
            >
              <Save size={14} />
              Save Backend
            </button>
            <button
              onClick={resetToDefault}
              title="Use default backend"
              className={clsx(
                "p-2.5 rounded-xl border transition-all",
                isDark ? "border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <RotateCcw size={14} />
            </button>
          </div>

          {/* Status */}
          {status && (
            <div className={clsx(
              "flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold",
              status.kind === 'ok'
                ? isDark ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800/50" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : isDark ? "bg-red-950/50 text-red-400 border border-red-800/50" : "bg-red-50 text-red-600 border border-red-200"
            )}>
              {status.kind === 'ok' ? <CheckCircle size={14} className="shrink-0 mt-px" /> : <AlertCircle size={14} className="shrink-0 mt-px" />}
              <span>{status.text}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={clsx(
          "px-5 py-3 border-t flex items-center gap-1.5",
          isDark ? "border-slate-800 text-slate-500" : "border-gray-100 text-gray-400"
        )}>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span className="text-[10px] font-medium">
            Saved in this browser only. Leave the key empty to keep the stored one.
          </span>
        </div>
      </div>
    </div>
  );
};

export default SupabaseSettingsModal;