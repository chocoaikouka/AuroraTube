import type { SearchResponse } from '../types';
import { useEffect, useMemo, useState } from 'react';
import { VideoCard } from '../components/VideoCard';
import { sortVideosByDuration, sortVideosByViews } from '../lib/media';

export interface SearchPageProps { data: SearchResponse; query: string; }

export function SearchPage({ data, query }: SearchPageProps) {
  const results = Array.isArray(data?.results) ? data.results : [];
  const [sortMode, setSortMode] = useState<'relevance' | 'views' | 'duration'>('relevance');
  useEffect(() => { setSortMode('relevance'); }, [query]);
  const sorted = useMemo(() => {
    if (sortMode === 'views') return sortVideosByViews(results);
    if (sortMode === 'duration') return sortVideosByDuration(results);
    return results;
  }, [results, sortMode]);
  return (
    <section className="page-section">
      <div className="section-head section-head--stacked">
        <div><h1 className="page-title">「{query}」</h1><p className="page-subtitle">{String(results.length)} 件</p></div>
        <div className="chip-row">
          <button type="button" className={`chip ${sortMode === 'relevance' ? 'is-active' : ''}`} onClick={() => setSortMode('relevance')}>関連度</button>
          <button type="button" className={`chip ${sortMode === 'views' ? 'is-active' : ''}`} onClick={() => setSortMode('views')}>再生回数</button>
          <button type="button" className={`chip ${sortMode === 'duration' ? 'is-active' : ''}`} onClick={() => setSortMode('duration')}>長さ</button>
        </div>
      </div>
      <div className="video-grid">{sorted.length ? sorted.map((video) => <VideoCard key={video.id} video={video} />) : <div className="empty-state">結果がありません。</div>}</div>
    </section>
  );
}
