import type { VideoFormat, WatchResponse } from '../types';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { VideoListItem } from '../components/VideoListItem';
import { formatOptionLabel, truncateText } from '../lib/display';
import { buildDownloadHref, buildStreamHref, pickDownloadFormat } from '../lib/media';

export interface WatchPageProps {
  data: WatchResponse;
  onSelectFormat: (format: string) => void;
  selectedFormat: string;
  videoId: string;
}

export function WatchPage({ data, onSelectFormat, selectedFormat, videoId }: WatchPageProps) {
  const formats = Array.isArray(data?.formats) ? data.formats : [];
  const related = Array.isArray(data?.relatedVideos) ? data.relatedVideos : [];
  const selected = useMemo(() => formats.find((format) => format.id === selectedFormat) || data.selectedFormat || formats[0] || null, [formats, selectedFormat, data.selectedFormat]);
  const downloadFormat = useMemo(() => pickDownloadFormat(formats, selected?.id || ''), [formats, selected]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [theaterMode, setTheaterMode] = useState(false);
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [copyState, setCopyState] = useState('');

  const sourceUrl = useMemo(() => {
    if (!selected) return '';
    return buildStreamHref(videoId, selected.id, Boolean(selected.hls));
  }, [videoId, selected]);

  const downloadUrl = useMemo(() => {
    const candidate: VideoFormat | null = downloadFormat || selected;
    return candidate ? buildDownloadHref(videoId, candidate.id) : '';
  }, [downloadFormat, selected, videoId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sourceUrl) return;
    video.src = sourceUrl;
    video.load();
  }, [sourceUrl]);

  const shareUrl = `${window.location.origin}/watch/${encodeURIComponent(videoId)}${selected?.id ? `?format=${encodeURIComponent(selected.id)}` : ''}`;

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState('コピーしました');
    } catch {
      setCopyState('失敗');
    } finally {
      window.setTimeout(() => setCopyState(''), 1200);
    }
  };

  return (
    <div className={`watch-layout ${theaterMode ? 'is-theater' : ''}`}>
      <section className="player-card">
        <div className="player-shell"><video ref={videoRef} controls playsInline preload="metadata" poster={data?.thumbnail || ''} /></div>
        <div className="watch-toolbar">
          <select className="watch-select" aria-label="画質を選択" value={selected?.id || ''} onChange={(event: ChangeEvent<HTMLSelectElement>) => onSelectFormat(event.target.value)}>
            {formats.length ? formats.map((format) => <option key={format.id} value={format.id}>{formatOptionLabel(format)}</option>) : <option value="">利用可能な形式なし</option>}
          </select>
          <div className="action-row">
            <a className="button-link" href={downloadUrl || '#'} download={downloadFormat ? undefined : true} aria-disabled={!downloadUrl} onClick={(event: MouseEvent<HTMLAnchorElement>) => { if (!downloadUrl) event.preventDefault(); }}>保存</a>
            <button className="button-secondary" type="button" onClick={copyShareLink}>共有 {copyState ? `· ${copyState}` : ''}</button>
            <button className={`button-secondary ${theaterMode ? 'is-active' : ''}`} type="button" onClick={() => setTheaterMode((value) => !value)}>劇場</button>
          </div>
        </div>
        <div className="watch-info">
          <h1>{data?.title || 'Untitled'}</h1>
          <div className="meta-row">
            {data?.author ? <span>{data.author}</span> : null}
            {data?.duration ? <span>{data.duration}</span> : null}
            {data?.availability ? <span>{data.availability}</span> : null}
            {selected?.hls ? <span>HLS</span> : null}
            {downloadFormat ? <span>{formatOptionLabel(downloadFormat)}</span> : null}
          </div>
          <div className="watch-summary">{expandedDescription ? (data?.description || '') : truncateText(data?.description || '', 260)}</div>
          {(data?.description || '').length > 260 ? <button type="button" className="text-button" onClick={() => setExpandedDescription((value) => !value)}>{expandedDescription ? '折りたたむ' : 'さらに表示'}</button> : null}
        </div>
      </section>
      <aside className="side-column">
        <section className="side-panel">
          <h3 className="panel-title">関連動画</h3>
          <div className="list-stack">{related.length ? related.map((video) => <VideoListItem key={video.id} video={video} />) : <div className="empty-state">関連動画はありません。</div>}</div>
        </section>
      </aside>
    </div>
  );
}
