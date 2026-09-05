import { useState, useEffect } from 'react';
import useAuth from './useAuth';
import { supabase } from '../services/supabase';

const DEFAULT_PERMISSIONS = {
  Administrator: {
    webgisUpload: true,
    webgisEditAttributes: true,
    webgisCameraCalibration: true,
    webgisFlagDefects: true,
    webgisExportData: true
  },
  'Survey Operator': {
    webgisUpload: true,
    webgisEditAttributes: false,
    webgisCameraCalibration: true,
    webgisFlagDefects: true,
    webgisExportData: true
  },
  'QA Inspector': {
    webgisUpload: false,
    webgisEditAttributes: true,
    webgisCameraCalibration: false,
    webgisFlagDefects: true,
    webgisExportData: true
  },
  Viewer: {
    webgisUpload: false,
    webgisEditAttributes: false,
    webgisCameraCalibration: false,
    webgisFlagDefects: false,
    webgisExportData: true
  },
  guest: {
    webgisUpload: false,
    webgisEditAttributes: false,
    webgisCameraCalibration: false,
    webgisFlagDefects: false,
    webgisExportData: false
  }
};

function resolveUserRole(user) {
  if (!user) return 'guest';
  const meta = user.user_metadata || {};
  const appMeta = user.app_metadata || {};
  if (meta.role) return meta.role;
  if (appMeta.role) return appMeta.role;
  if (user.role && user.role !== 'authenticated') return user.role;
  return 'Viewer';
}

export function usePermissions() {
  const { user, loading: authLoading } = useAuth();
  const [dbRole, setDbRole] = useState(null);
  const [matrix, setMatrix] = useState(() => {
    try {
      const cached = localStorage.getItem('webgis_role_permissions');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return DEFAULT_PERMISSIONS;
  });

  useEffect(() => {
    async function loadData() {
      // 1. Fetch live user role from user_accounts table if user is logged in
      if (user?.email) {
        try {
          const { data: userData } = await supabase
            .from('user_accounts')
            .select('role')
            .eq('email', user.email.toLowerCase().trim())
            .maybeSingle();

          if (userData?.role) {
            setDbRole(userData.role);
          }
        } catch (err) {
          console.warn('[usePermissions] Notice querying user_accounts:', err);
        }
      }

      // 2. Fetch remote role permission matrix
      try {
        const { data, error } = await supabase
          .from('project_settings')
          .select('id, settings')
          .eq('id', 'default')
          .maybeSingle();

        if (!error && data?.settings?.role_permissions) {
          const remoteMatrix = data.settings.role_permissions;
          setMatrix(prev => {
            const merged = { ...prev };
            Object.keys(remoteMatrix).forEach(roleKey => {
              merged[roleKey] = { ...(merged[roleKey] || {}), ...remoteMatrix[roleKey] };
            });
            try {
              localStorage.setItem('webgis_role_permissions', JSON.stringify(merged));
            } catch (_) {}
            return merged;
          });
        }
      } catch (err) {
        console.warn('[usePermissions] Notice fetching project_settings:', err);
      }
    }

    loadData();
  }, [user]);

  const role = dbRole || resolveUserRole(user);
  const activeCaps = matrix[role] || DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.guest;

  return {
    role,
    user,
    authLoading,
    canUpload: Boolean(activeCaps.webgisUpload),
    canEditAttributes: Boolean(activeCaps.webgisEditAttributes),
    canCalibrate: Boolean(activeCaps.webgisCameraCalibration),
    canFlagDefects: Boolean(activeCaps.webgisFlagDefects),
    canExport: Boolean(activeCaps.webgisExportData),
    isAdmin: role === 'Administrator',
    isOperator: role === 'Survey Operator',
    isInspector: role === 'QA Inspector',
    isViewer: role === 'Viewer' || role === 'guest',
    isGuest: role === 'guest'
  };
}

export default usePermissions;
