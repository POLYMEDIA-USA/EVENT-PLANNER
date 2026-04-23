'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const adminLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: '⌂' },
  { href: '/events', label: 'Events', icon: '◈' },
  { href: '/leads', label: 'Leads', icon: '◉' },
  { href: '/invited', label: 'Invited', icon: '✉' },
  { href: '/scanner', label: 'QR Scanner', icon: '⊞' },
  { href: '/checkin-dashboard', label: 'Check-In Live', icon: '⚡' },
  { href: '/interactions', label: 'Interactions', icon: '◎' },
  { href: '/tasks', label: 'Tasks', icon: '☐' },
  { href: '/reports', label: 'Reports', icon: '▤' },
  { href: '/users', label: 'Users', icon: '◆' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
  { href: '/audit', label: 'Audit Log', icon: '⊘' },
];

const supervisorLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: '⌂' },
  { href: '/events', label: 'Events', icon: '◈' },
  { href: '/leads', label: 'Leads', icon: '◉' },
  { href: '/invited', label: 'Invited', icon: '✉' },
  { href: '/scanner', label: 'QR Scanner', icon: '⊞' },
  { href: '/checkin-dashboard', label: 'Check-In Live', icon: '⚡' },
  { href: '/interactions', label: 'Interactions', icon: '◎' },
  { href: '/tasks', label: 'Tasks', icon: '☐' },
  { href: '/reps', label: 'My Reps', icon: '◆' },
  { href: '/reports', label: 'Reports', icon: '▤' },
];

const repLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: '⌂' },
  { href: '/leads', label: 'Leads', icon: '◉' },
  { href: '/invited', label: 'Invited', icon: '✉' },
  { href: '/scanner', label: 'QR Scanner', icon: '⊞' },
  { href: '/checkin-dashboard', label: 'Check-In Live', icon: '⚡' },
  { href: '/interactions', label: 'My Interactions', icon: '◎' },
  { href: '/tasks', label: 'My Tasks', icon: '☐' },
  { href: '/reports', label: 'Reports', icon: '▤' },
];

const guideUrl = (role) =>
  role === 'admin' ? '/admin-guide.html' : role === 'supervisor' ? '/supervisor-guide.html' : '/sales-rep-guide.html';

export default function Sidebar({ user, onLogout }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const links = user?.role === 'admin' ? adminLinks : user?.role === 'supervisor' ? supervisorLinks : repLinks;

  // Mobile: show top 4-5 links in bottom bar, rest in "More" menu
  const mobileMainLinks = links.slice(0, 4);
  const mobileMoreLinks = links.slice(4);
  const hasMore = mobileMoreLinks.length > 0;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex bg-white border-r border-gray-200 flex-col h-screen sticky top-0 transition-all ${collapsed ? 'w-16' : 'w-56'}`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="VerifyAI" className="h-8 w-8 object-contain" />
              <div>
                <h1 className="text-lg font-bold text-indigo-600">FunnelFlow</h1>
                <p className="text-xs text-gray-400">Sales Funnel Platform</p>
              </div>
            </div>
          )}
          {collapsed && (
            <img src="/logo.png" alt="VerifyAI" className="h-8 w-8 object-contain" />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-base">{link.icon}</span>
                {!collapsed && <span>{link.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          {!collapsed && (
            <div className="mb-2">
              <p className="text-sm font-medium text-gray-700 truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.organization_name}</p>
              <p className="text-xs text-indigo-500 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          )}
          <a
            href={guideUrl(user?.role)}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 mb-2 ${collapsed ? 'justify-center' : ''}`}
          >
            <span>📖</span>
            {!collapsed && <span>User Guide</span>}
          </a>
          <button
            onClick={onLogout}
            className="w-full text-left text-xs text-red-500 hover:text-red-700"
          >
            {collapsed ? '→' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="VerifyAI" className="h-7 w-7 object-contain" />
          <span className="text-base font-bold text-indigo-600">FunnelFlow</span>
        </div>
        <div className="flex items-center gap-3">
          <a href={guideUrl(user?.role)} target="_blank" rel="noopener noreferrer" className="text-indigo-500 text-sm">📖</a>
          <button onClick={onLogout} className="text-xs text-red-500 font-medium">Sign Out</button>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex">
        {mobileMainLinks.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                active ? 'text-indigo-600 font-semibold' : 'text-gray-500'
              }`}
            >
              <span className="text-lg mb-0.5">{link.icon}</span>
              <span className="truncate max-w-[64px]">{link.label.replace('My ', '')}</span>
            </Link>
          );
        })}
        {hasMore && (
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
              mobileMenuOpen || mobileMoreLinks.some(l => l.href === pathname) ? 'text-indigo-600 font-semibold' : 'text-gray-500'
            }`}
          >
            <span className="text-lg mb-0.5">•••</span>
            <span>More</span>
          </button>
        )}
      </nav>

      {/* Mobile "More" Menu Overlay */}
      {mobileMenuOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
          <div className="md:hidden fixed bottom-14 left-0 right-0 z-40 bg-white border-t border-gray-200 rounded-t-xl shadow-lg p-4">
            <div className="grid grid-cols-3 gap-3">
              {mobileMoreLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex flex-col items-center py-3 rounded-xl transition-colors ${
                      active ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xl mb-1">{link.icon}</span>
                    <span className="text-xs font-medium">{link.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">{user?.full_name} &middot; <span className="capitalize">{user?.role?.replace('_', ' ')}</span></p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
