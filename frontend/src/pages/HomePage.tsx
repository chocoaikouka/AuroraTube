import type { HomeResponse } from '../types';
import { VideoCard } from '../components/VideoCard';
import { sortVideosByViews } from '../lib/media';

export interface HomePageProps { data: HomeResponse; }

export function HomePage({ data }: HomePageProps) {
  const results = Array.isArray(data?.results) ? data.results : [];
  const topPicks = sortVideosByViews(results).slice(0, 12);
  return (
    <section className="page-section">
      <div className="section-head"><h1 className="page-title">おすすめ</h1></div>
      <div className="video-grid">{topPicks.length ? topPicks.map((video) => <VideoCard key={video.id} video={video} />) : <div className="empty-state">表示できる動画がありません。</div>}</div>
    </section>
  );
}
