'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const adminLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: '⌂' },
  { href: '/events', label: 'Events', icon: '◈' },
  { href: '/leads', label: 'Leads', icon: '◉' },
  { href: '/invited', label: 'Invited', icon: '✉' },
  { href: '/scanner', label: 'QR Scanner', icon: '⊞' },
  { href: '/interactions', label: 'Interactions', icon: '◎' },
  { href: '/reports', label: 'Reports', icon: '▤' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

const repLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: '⌂' },
  { href: '/leads', label: 'Leads', icon: '◉' },
  { href: '/scanner', label: 'QR Scanner', icon: '⊞' },
  { href: '/interactions', label: 'My Interactions', icon: '◎' },
];

export default function Sidebar({ user, onLogout }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const links = user?.role === 'admin' ? adminLinks : repLinks;

  return (
    <aside className={`bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 transition-all ${collapsed ? 'w-16' : 'w-56'}`}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold text-indigo-600">CorpMarketer</h1>
            <p className="text-xs text-gray-400">Event Platform</p>
          </div>
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
        <button
          onClick={onLogout}
          className="w-full text-left text-xs text-red-500 hover:text-red-700"
        >
          {collapsed ? '→' : 'Sign Out'}
        </button>
      </div>
    </aside>
  );
}
