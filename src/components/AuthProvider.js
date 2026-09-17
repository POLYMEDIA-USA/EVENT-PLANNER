'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

// Set when this browser's session came from an Access Portal cookie rather
// than our own login form — "Sign Out" then has to end the session
// fleet-wide, not just locally.
const SSO_KEY = 'cm_sso_portal';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // A verified Portal identity with no FunnelFlow account yet. The login page
  // uses it to say so and prefill the form, instead of showing a blank form to
  // someone who is already signed in across the rest of the fleet.
  const [portalEmail, setPortalEmail] = useState('');

  const applySession = useCallback((userData, token, portalUrl) => {
    localStorage.setItem('cm_token', token);
    localStorage.setItem('cm_user', JSON.stringify(userData));
    if (portalUrl) localStorage.setItem(SSO_KEY, portalUrl);
    else localStorage.removeItem(SSO_KEY);
    setUser(userData);
  }, []);

  // Single sign-on, accelerator only: if the browser is carrying a valid
  // verifyai.net Portal cookie AND it maps to a local account, sign straight
  // in. Every other outcome falls through to our own login/registration page
  // — FunnelFlow never redirects anyone to Portal, because reps signing up at
  // a live event have no Portal account at all.
  const tryPortalSSO = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/portal-session', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        applySession(data.user, data.token, data.portal_url);
        return true;
      }
      const data = await res.json().catch(() => ({}));
      if (data.reason === 'no_local_account' && data.portal_email) {
        setPortalEmail(data.portal_email);
      }
    } catch {
      // Offline or Portal unreachable — not an error worth surfacing.
    }
    return false;
  }, [applySession]);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('cm_token');
    if (!token) {
      await tryPortalSSO();
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('cm_token');
        localStorage.removeItem('cm_user');
        localStorage.removeItem(SSO_KEY);
        // The local token aged out, but the Portal cookie may still be live.
        await tryPortalSSO();
      }
    } catch {
      // offline — use cached user
      const cached = localStorage.getItem('cm_user');
      if (cached) setUser(JSON.parse(cached));
    }
    setLoading(false);
  }, [tryPortalSSO]);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = (userData, token) => applySession(userData, token, null);

  // Returns the fleet-wide logout URL when this session came from Portal, so
  // the caller can hand off a real browser navigation; null for a session that
  // started at our own login form, which is fully cleared by the time this
  // returns.
  const logout = () => {
    const portalUrl = localStorage.getItem(SSO_KEY);
    localStorage.removeItem('cm_token');
    localStorage.removeItem('cm_user');
    localStorage.removeItem('cm_event');
    localStorage.removeItem(SSO_KEY);
    setUser(null);
    if (!portalUrl) return null;
    return `${portalUrl}/logout?return_to=${encodeURIComponent(window.location.origin)}`;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth, portalEmail }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
