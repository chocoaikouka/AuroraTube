import type { RelatedVideo } from '../types';
import { Link } from './Link';
import { formatMeta } from '../lib/display';

export interface VideoListItemProps { video: RelatedVideo; }

export function VideoListItem({ video }: VideoListItemProps) {
  const meta = formatMeta(video);
  return (
    <Link href={`/watch/${encodeURIComponent(video.id)}`} className="video-list-item">
      <img loading="lazy" src={video.thumbnail || ''} alt={video.title || ''} />
      <div>
        <h4>{video.title || 'Untitled'}</h4>
        <p>{meta.join(' · ')}</p>
      </div>
    </Link>
  );
}
