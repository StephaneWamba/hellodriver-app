import { useEffect, useState } from 'react';

const STORAGE_KEY = 'hd_admin_sidebar_collapsed';

function readInitial(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === '1';
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readInitial);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  return { collapsed, toggle: () => setCollapsed((c) => !c) };
}
