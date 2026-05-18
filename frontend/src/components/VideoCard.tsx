import type { VideoSummary } from '../types';
import { Link } from './Link';
import { formatMeta } from '../lib/display';

export interface VideoCardProps { video: VideoSummary; }

export function VideoCard({ video }: VideoCardProps) {
  const meta = formatMeta(video);
  const duration = String(video.duration || '').trim();

  return (
    <Link href={`/watch/${encodeURIComponent(video.id)}`} className="video-card">
      <div className="video-thumb-wrap">
        <img className="video-thumb" loading="lazy" src={video.thumbnail || ''} alt={video.title || ''} />
        {duration ? <span className="video-duration">{duration}</span> : null}
      </div>
      <div className="video-body">
        <h3 className="video-title">{video.title || 'Untitled'}</h3>
        <div className="video-meta">{meta.map((item) => <span key={item}>{item}</span>)}</div>
      </div>
    </Link>
  );
}
