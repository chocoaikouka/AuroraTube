import { escapeAttr, escapeHtml } from './lib/format.js';
import { currentUrl, navigate } from './lib/router.js';
import { watchUrl } from './lib/routes.js';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];
const RESUME_PREFIX = 'auroratube:resume:';

const formatTime = (seconds) => {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
};

const resumeKey = (videoId) => `${RESUME_PREFIX}${videoId}`;

const readResumePoint = (videoId) => {
  try {
    const raw = sessionStorage.getItem(resumeKey(videoId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Number.isFinite(Number(parsed?.time)) ? parsed : null;
  } catch {
    return null;
  }
};

const writeResumePoint = (videoId, time, quality) => {
  try {
    sessionStorage.setItem(resumeKey(videoId), JSON.stringify({
      time: Number(time || 0),
      quality: String(quality || 'auto'),
      at: Date.now(),
    }));
  } catch {
    // storage is best-effort only
  }
};

const clearResumePoint = (videoId) => {
  try {
    sessionStorage.removeItem(resumeKey(videoId));
  } catch {
    // ignore storage failures
  }
};

const qualityOptionsMarkup = (qualities = [], selectedQuality = 'auto') => {
  if (!Array.isArray(qualities) || qualities.length <= 1) return '';
  return `
    <label class="player-label player-quality-label">
      <span>画質</span>
      <select class="player-select" data-player-quality aria-label="画質">
        ${qualities.map((option) => {
          const value = String(option?.value || 'auto');
          const label = String(option?.label || value);
          return `<option value="${escapeAttr(value)}"${value === selectedQuality ? ' selected' : ''}>${escapeHtml(label)}</option>`;
        }).join('')}
      </select>
    </label>
  `;
};

export const playerMarkup = ({
  videoId = '',
  poster = '',
  short = false,
  playback = {},
} = {}) => {
  const selectedQuality = String(playback.selectedQuality || 'auto');
  const safeVideoId = escapeAttr(videoId);
  const playbackUrl = playback.playUrl || playback.streamUrl || (safeVideoId ? watchUrl(videoId, selectedQuality !== 'auto' ? { quality: selectedQuality } : {}) : '');
  const downloadUrl = playback.downloadUrl || (safeVideoId ? `/api/watch/${encodeURIComponent(videoId)}/download${selectedQuality !== 'auto' ? `?quality=${encodeURIComponent(selectedQuality)}` : ''}` : playbackUrl);
  const qualities = Array.isArray(playback.qualities) ? playback.qualities : [];

  return `
    <section class="player-shell ${short ? 'player-shell-short' : ''}" data-player data-video-id="${safeVideoId}" data-selected-quality="${escapeAttr(selectedQuality)}" data-playback-url="${escapeAttr(playbackUrl)}">
      <div class="player-stage">
        <video class="player-video" playsinline preload="metadata"${poster ? ` poster="${escapeAttr(poster)}"` : ''} src="${escapeAttr(playbackUrl)}"></video>
        <div class="player-overlay"></div>
        <button class="player-center" type="button" data-player-play aria-label="再生/一時停止">▶</button>
      </div>

      <div class="player-controls">
        <div class="player-row player-row-main">
          <button class="player-icon-button player-icon-button-primary" type="button" data-player-play-toggle aria-label="再生/一時停止">再生</button>
          <div class="player-progress-wrap">
            <input class="player-progress" type="range" min="0" max="1000" value="0" step="1" data-player-progress aria-label="再生位置" />
          </div>
          <span class="player-time" data-player-time>0:00 / 0:00</span>
        </div>

        <div class="player-row player-row-secondary">
          <button class="player-icon-button" type="button" data-player-mute aria-label="ミュート">音量</button>
          <input class="player-volume" type="range" min="0" max="1" value="1" step="0.05" data-player-volume aria-label="音量" />
          ${qualityOptionsMarkup(qualities, selectedQuality)}
          <label class="player-label player-speed-label">
            <span>速度</span>
            <select class="player-select" data-player-speed aria-label="再生速度">
              ${SPEEDS.map((speed) => `<option value="${speed}"${speed === 1 ? ' selected' : ''}>${speed}x</option>`).join('')}
            </select>
          </label>
          <a class="player-icon-button" data-player-download href="${escapeAttr(downloadUrl)}">DL</a>
          <button class="player-icon-button" type="button" data-player-fullscreen aria-label="全画面">全画面</button>
        </div>
      </div>
    </section>
  `;
};

const syncState = (root) => {
  const video = root.querySelector('.player-video');
  const playToggle = root.querySelector('[data-player-play-toggle]');
  const playCenter = root.querySelector('[data-player-play]');
  const progress = root.querySelector('[data-player-progress]');
  const time = root.querySelector('[data-player-time]');
  const mute = root.querySelector('[data-player-mute]');
  const volume = root.querySelector('[data-player-volume]');
  const speed = root.querySelector('[data-player-speed]');
  const quality = root.querySelector('[data-player-quality]');
  const download = root.querySelector('[data-player-download]');
  const fullscreen = root.querySelector('[data-player-fullscreen]');
  const videoId = String(root.dataset.videoId || '');
  const selectedQuality = String(root.dataset.selectedQuality || 'auto');

  if (!video || root.dataset.playerMounted === 'true') return;
  root.dataset.playerMounted = 'true';

  const updateTime = () => {
    const current = formatTime(video.currentTime || 0);
    const duration = Number.isFinite(video.duration) ? formatTime(video.duration) : '0:00';
    if (time) time.textContent = `${current} / ${duration}`;
    if (progress && Number.isFinite(video.duration) && video.duration > 0) {
      progress.value = String(Math.round((video.currentTime / video.duration) * 1000));
    }
  };

  const updatePlayState = () => {
    const playing = !video.paused && !video.ended;
    if (playToggle) playToggle.textContent = playing ? '一時停止' : '再生';
    if (playCenter) {
      playCenter.textContent = playing ? '❚❚' : '▶';
      playCenter.hidden = playing;
    }
  };

  const updateMuteState = () => {
    if (!mute) return;
    mute.textContent = video.muted || video.volume === 0 ? 'ミュート' : '音量';
  };

  const updateVolumeState = () => {
    if (volume) volume.value = String(video.muted ? 0 : video.volume);
    updateMuteState();
  };

  const restoreResumePoint = () => {
    if (!videoId) return;
    const saved = readResumePoint(videoId);
    if (!saved) return;
    const savedQuality = String(saved.quality || 'auto');
    if (savedQuality !== selectedQuality && savedQuality !== 'auto') return;
    const target = Number(saved.time || 0);
    if (Number.isFinite(target) && target > 0 && Number.isFinite(video.duration)) {
      video.currentTime = Math.min(Math.max(0, target), Math.max(0, video.duration - 1));
    }
    clearResumePoint(videoId);
  };

  const togglePlay = async () => {
    try {
      if (video.paused) {
        await video.play();
      } else {
        video.pause();
      }
    } catch {
      // ignore autoplay/network errors
    }
  };

  const navigateQuality = (nextQuality) => {
    if (!videoId) return;
    const url = currentUrl();
    if (nextQuality && nextQuality !== 'auto') {
      url.searchParams.set('quality', nextQuality);
    } else {
      url.searchParams.delete('quality');
    }
    writeResumePoint(videoId, video.currentTime || 0, nextQuality || 'auto');
    navigate(`${url.pathname}${url.search}${url.hash}`, { replace: true });
  };

  playToggle?.addEventListener('click', togglePlay);
  playCenter?.addEventListener('click', togglePlay);

  progress?.addEventListener('input', () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const ratio = Number(progress.value || 0) / 1000;
    video.currentTime = ratio * video.duration;
    updateTime();
  });

  volume?.addEventListener('input', () => {
    const value = Number(volume.value || 0);
    video.volume = Math.min(1, Math.max(0, value));
    video.muted = video.volume === 0;
    updateVolumeState();
  });

  mute?.addEventListener('click', () => {
    video.muted = !video.muted;
    if (!video.muted && Number(volume?.value || 0) === 0) {
      video.volume = 0.5;
      if (volume) volume.value = '0.5';
    }
    updateVolumeState();
  });

  speed?.addEventListener('change', () => {
    const value = Number(speed.value || 1);
    video.playbackRate = SPEEDS.includes(value) ? value : 1;
  });

  quality?.addEventListener('change', () => {
    navigateQuality(String(quality.value || 'auto'));
  });

  download?.addEventListener('click', (event) => {
    event.preventDefault();
    window.location.href = download.getAttribute('href') || '#';
  });

  fullscreen?.addEventListener('click', async () => {
    try {
      const target = root.querySelector('.player-stage') || root;
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
        return;
      }
      await target.requestFullscreen?.();
    } catch {
      // ignore fullscreen errors
    }
  });

  video.addEventListener('loadedmetadata', () => {
    updateTime();
    restoreResumePoint();
  });
  video.addEventListener('timeupdate', updateTime);
  video.addEventListener('durationchange', updateTime);
  video.addEventListener('play', updatePlayState);
  video.addEventListener('pause', updatePlayState);
  video.addEventListener('ended', updatePlayState);
  video.addEventListener('volumechange', updateVolumeState);
  video.addEventListener('ratechange', () => {
    if (speed) speed.value = String(video.playbackRate || 1);
  });

  updateTime();
  updatePlayState();
  updateVolumeState();
  if (speed) speed.value = String(video.playbackRate || 1);
  if (quality) quality.value = selectedQuality;
};

export const mountPlayers = () => {
  document.querySelectorAll('[data-player]').forEach((root) => syncState(root));
};

export const bindPlayers = mountPlayers;
