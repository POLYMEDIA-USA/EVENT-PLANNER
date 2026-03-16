'use client';

import { useAuth } from '@/components/AuthProvider';
import Sidebar from '@/components/Sidebar';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AppShell({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

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
    <div className="flex min-h-screen">
      <Sidebar user={user} onLogout={handleLogout} />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
