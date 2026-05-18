import type { RouteState } from '../types';

export function getRoute(location: Location): RouteState {
  const url = new URL(location.href);
  const segments = url.pathname.split('/').filter(Boolean);
  return { path: url.pathname, query: new URLSearchParams(url.searchParams), id: segments[1] || '', isHome: url.pathname === '/', isSearch: url.pathname === '/search', isWatch: url.pathname.startsWith('/watch/') };
}

export function navigate(url: string): void {
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
