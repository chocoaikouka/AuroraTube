import { api } from './lib/api.js';
import { escapeHtml } from './lib/format.js';
import { loadingController } from './lib/loading.js';
import { navigate, onInternalLink, currentUrl } from './lib/router.js';
import { resolveRoute, searchUrl } from './lib/routes.js';
import { homePage, resultsPage, watchPage, shortsPage, channelPage, notFoundPage } from './pages.js';
import { commentCard, videoCard } from './lib/cards.js';
import { mountPlayers } from './player.js';

const root = document.getElementById('app');
const locale = navigator.language || 'ja-JP';
const defaultRegion = locale.toLowerCase().startsWith('ja') ? 'JP' : 'US';

const state = {
  renderSeq: 0,
  renderAbort: null,
  searchAbort: null,
  searchTimer: 0,
  route: null,
};

const routeLoadingLabel = (route) => {
  switch (route?.kind) {
    case 'home': return 'ホームを読み込み中…';
    case 'results': return '検索結果を読み込み中…';
    case 'watch': return '動画を読み込み中…';
    case 'shorts': return 'ショートを読み込み中…';
    case 'channel': return 'チャンネルを読み込み中…';
    default: return '読み込み中…';
  }
};

const bindSearchForm = () => {
  const form = document.getElementById('search-form');
  if (!form) return;

  const input = form.querySelector('input[name="search_query"]');
  const box = document.getElementById('search-suggestions');
  if (!input || !box) return;

  const showSuggestions = (suggestions = []) => {
    const items = suggestions.slice(0, 8).map((item) => `<button type="button" class="suggestion-item" data-suggestion="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join('');
    box.innerHTML = items;
    box.hidden = !items;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = input.value.trim();
    navigate(searchUrl(query));
  });

  input.addEventListener('input', () => {
    clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(async () => {
      const value = input.value.trim();
      if (value.length < 2) {
        showSuggestions([]);
        return;
      }

      state.searchAbort?.abort?.();
      state.searchAbort = new AbortController();

      try {
        const payload = await api.suggestions(value, state.searchAbort.signal);
        const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
        showSuggestions(suggestions);
      } catch {
        showSuggestions([]);
      }
    }, 160);
  });

  box.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-suggestion]');
    if (!button) return;
    navigate(searchUrl(button.getAttribute('data-suggestion') || ''));
  });
};

const setLoadMoreButtonBusy = (button, busy) => {
  if (!button) return;
  button.disabled = busy;
  button.setAttribute('aria-busy', busy ? 'true' : 'false');
  button.dataset.busy = busy ? 'true' : 'false';
};

const appendComments = async (button, signal) => {
  const videoId = button.getAttribute('data-video-id') || '';
  const continuation = button.getAttribute('data-load-comments') || '';
  if (!videoId || !continuation) return;

  const token = loadingController.begin('コメントを読み込み中…');
  setLoadMoreButtonBusy(button, true);

  try {
    const payload = await api.watchComments(videoId, continuation, signal);
    const container = document.querySelector('[data-comments]');
    if (container && Array.isArray(payload.comments)) {
      container.insertAdjacentHTML('beforeend', payload.comments.map((comment) => commentCard(comment)).join(''));
    }
    button.remove();
  } catch (error) {
    setLoadMoreButtonBusy(button, false);
    button.title = error?.message || '読み込みに失敗しました';
  } finally {
    loadingController.end(token);
  }
};

const appendChannelVideos = async (button, signal) => {
  const channelId = button.getAttribute('data-channel-id') || '';
  const continuation = button.getAttribute('data-load-channel') || '';
  const sortBy = button.getAttribute('data-sort-by') || 'newest';
  if (!channelId || !continuation) return;

  const token = loadingController.begin('動画を読み込み中…');
  setLoadMoreButtonBusy(button, true);

  try {
    const payload = await api.channel(channelId, { continuation, sortBy }, signal);
    const grid = document.querySelector('[data-channel-grid]');
    if (grid && Array.isArray(payload.videos)) {
      grid.insertAdjacentHTML('beforeend', payload.videos.map((item) => videoCard(item)).join(''));
    }
    button.remove();
  } catch (error) {
    setLoadMoreButtonBusy(button, false);
    button.title = error?.message || '読み込みに失敗しました';
  } finally {
    loadingController.end(token);
  }
};

const clipboardText = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', 'readonly');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand('copy');
    return true;
  } finally {
    document.body.removeChild(area);
  }
};

const bindGlobalEvents = () => {
  document.addEventListener('click', async (event) => {
    if (onInternalLink(event)) return;

    const copyButton = event.target.closest?.('[data-copy-link]');
    if (copyButton) {
      const url = copyButton.getAttribute('data-url') || window.location.href;
      await clipboardText(url);
      return;
    }

    const shareButton = event.target.closest?.('[data-share-link]');
    if (shareButton) {
      const url = shareButton.getAttribute('data-url') || window.location.href;
      if (navigator.share) {
        try {
          await navigator.share({ url, title: document.title });
          return;
        } catch {
          // fall through to copy
        }
      }
      await clipboardText(url);
      return;
    }

    const sidebarToggle = event.target.closest?.('[data-toggle-sidebar]');
    if (sidebarToggle) {
      document.body.classList.toggle('sidebar-open');
      return;
    }

    const backdrop = event.target.closest?.('[data-sidebar-backdrop]');
    if (backdrop) {
      document.body.classList.remove('sidebar-open');
      return;
    }

    const commentsButton = event.target.closest?.('[data-load-comments]');
    if (commentsButton) {
      await appendComments(commentsButton, state.renderAbort?.signal);
      return;
    }

    const channelButton = event.target.closest?.('[data-load-channel]');
    if (channelButton) {
      await appendChannelVideos(channelButton, state.renderAbort?.signal);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.body.classList.remove('sidebar-open');
      document.getElementById('search-suggestions')?.setAttribute('hidden', '');
      return;
    }

    const isTypingTarget = /^(INPUT|TEXTAREA|SELECT)$/.test(String(event.target?.tagName || '')) || event.target?.isContentEditable;
    if (isTypingTarget) return;

    if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
      const input = document.getElementById('search-input');
      if (!input) return;
      event.preventDefault();
      input.focus();
      input.select();
    }
  });
};

const render = async () => {
  const sequence = ++state.renderSeq;
  state.renderAbort?.abort?.();
  state.renderAbort = new AbortController();
  const signal = state.renderAbort.signal;
  const route = resolveRoute(currentUrl());
  const loadingToken = loadingController.begin(routeLoadingLabel(route));
  const prev = state.route;
  state.route = route;

  try {
    let page;
    if (route.kind === 'home') {
      const trending = await api.trending('default', defaultRegion, signal);
      page = homePage(trending.items || [], defaultRegion);
    } else if (route.kind === 'results') {
      const filters = route.filters || {};
      if (!route.query) {
        const trending = await api.trending('default', defaultRegion, signal);
        page = resultsPage('', filters, trending.items || []);
      } else {
        const payload = await api.search(route.query, filters, signal);
        page = resultsPage(payload.query || route.query, payload.filters || filters, payload.items || []);
      }
    } else if (route.kind === 'watch') {
      const payload = await api.watch(route.id, { signal, quality: route.quality || '' });
      page = watchPage(payload);
    } else if (route.kind === 'shorts') {
      const payload = await api.watch(route.id, { signal, quality: route.quality || '' });
      if (!(Number(payload?.video?.lengthSeconds || 0) > 0 && Number(payload.video.lengthSeconds) <= 60)) {
        navigate(`/watch?v=${encodeURIComponent(route.id)}${route.quality ? `&quality=${encodeURIComponent(route.quality)}` : ''}`, { replace: true });
        return;
      }
      page = shortsPage(payload);
    } else if (route.kind === 'channel') {
      const payload = await api.channel(route.id, { sortBy: route.sortBy }, signal);
      page = channelPage(payload);
    } else {
      page = notFoundPage();
    }

    if (signal.aborted || sequence !== state.renderSeq) return;
    root.innerHTML = page.html;
    document.title = page.title || 'AuroraTube';
    document.body.classList.remove('sidebar-open');

    const preserveScroll = prev?.kind === 'watch' && route.kind === 'watch' && prev.id === route.id;
    if (!preserveScroll) window.scrollTo(0, 0);
  } catch (error) {
    if (signal.aborted || sequence !== state.renderSeq) return;
    root.innerHTML = `
      <div class="error-state-wrap">
        <div class="empty-state large error-state">
          <strong>${escapeHtml(error?.message || '読み込みに失敗しました')}</strong>
          <span>${escapeHtml(String(error?.details || ''))}</span>
        </div>
      </div>
    `;
    document.title = 'AuroraTube';
  } finally {
    if (sequence === state.renderSeq) {
      bindSearchForm();
      mountPlayers();
      loadingController.end(loadingToken);
    } else {
      loadingController.end(loadingToken);
    }
  }
};

bindGlobalEvents();
window.addEventListener('popstate', render);
window.addEventListener('app:navigate', render);
render();
