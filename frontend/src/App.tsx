import { useEffect, useState, type ReactNode } from 'react';
import type { HomeResponse, RoutePayload, RouteState, SearchResponse, WatchResponse } from './types';
import { apiGet } from './lib/api';
import { getRoute, navigate } from './lib/navigation';
import { TopBar } from './components/TopBar';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { WatchPage } from './pages/WatchPage';

export default function App() {
  const [route, setRoute] = useState<RouteState>(() => getRoute(window.location));
  const [payload, setPayload] = useState<RoutePayload | null>(null);
  const [error, setError] = useState('');

  const query = route.query.get('q') || '';
  const selectedFormat = route.isWatch ? (route.query.get('format') || '') : '';
  const routeKey = `${route.path}?${route.query.toString()}`;

  useEffect(() => {
    const onPop = () => setRoute(getRoute(window.location));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setPayload(null);

    (async () => {
      try {
        let next: RoutePayload;
        if (route.isSearch) {
          const q = route.query.get('q') || '';
          next = await apiGet<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`, controller.signal);
        } else if (route.isWatch) {
          const suffix = selectedFormat ? `?format=${encodeURIComponent(selectedFormat)}` : '';
          next = await apiGet<WatchResponse>(`/api/watch/${encodeURIComponent(route.id)}${suffix}`, controller.signal);
        } else {
          next = await apiGet<HomeResponse>('/api/trending', controller.signal);
        }

        if (!controller.signal.aborted) setPayload(next);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Unexpected error');
      }
    })();

    return () => controller.abort();
  }, [route, selectedFormat, routeKey]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [routeKey]);

  const handleSearch = (term: string) => {
    const q = String(term || '').trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/');
  };

  const openHome = () => navigate('/');

  let main: ReactNode;
  if (error) {
    main = (<div className="empty-state"><h1>読み込みに失敗しました</h1><p>{error}</p></div>);
  } else if (!payload) {
    main = <div className="empty-state">読み込み中…</div>;
  } else if (route.isSearch) {
    main = <SearchPage data={payload as SearchResponse} query={query} />;
  } else if (route.isWatch) {
    main = (
      <WatchPage
        data={payload as WatchResponse}
        videoId={route.id}
        selectedFormat={selectedFormat}
        onSelectFormat={(format) => navigate(`/watch/${encodeURIComponent(route.id)}?format=${encodeURIComponent(format)}`)}
      />
    );
  } else {
    main = <HomePage data={payload as HomeResponse} />;
  }

  return (
    <div className="app-shell">
      <TopBar query={query} onSearch={handleSearch} onOpenHome={openHome} />
      <main className="page">{main}</main>
    </div>
  );
}
