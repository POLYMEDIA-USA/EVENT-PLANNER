'use client';

import { useAuth } from '@/components/AuthProvider';
import Sidebar from '@/components/Sidebar';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function AppShell({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [hasEvent, setHasEvent] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Check if an event is selected (re-check on route change)
  useEffect(() => {
    setHasEvent(!!localStorage.getItem('cm_event'));
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden">
      <Sidebar user={user} onLogout={handleLogout} />
      <main className="flex-1 min-w-0 p-4 pt-16 pb-20 md:p-6 md:pt-6 md:pb-6 overflow-x-hidden overflow-y-auto">
        {!hasEvent && pathname !== '/dashboard' && pathname !== '/events' && pathname !== '/settings' && pathname !== '/users' && pathname !== '/audit' && (
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-indigo-700">
                <span className="font-medium">No event selected.</span> Data is unfiltered.{' '}
                <button onClick={() => router.push('/dashboard')} className="underline font-semibold hover:text-indigo-900">
                  Select an event on the Dashboard
                </button>
              </p>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
