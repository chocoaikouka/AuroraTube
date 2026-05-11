const toSearch = (params = {}) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
};

export const homeUrl = () => '/';

export const searchUrl = (query = '', params = {}) => `/results${toSearch({ search_query: query, ...params })}`;

export const watchUrl = (videoId = '', params = {}) => {
  const safe = String(videoId || '').trim();
  return safe ? `/watch${toSearch({ v: safe, ...params })}` : '/watch';
};

export const shortsUrl = (videoId = '', params = {}) => {
  const safe = encodeURIComponent(String(videoId || '').trim());
  return safe ? `/shorts/${safe}${toSearch(params)}` : '/shorts';
};

export const channelUrl = (channelId = '', params = {}) => {
  const safe = encodeURIComponent(String(channelId || '').trim());
  return safe ? `/channel/${safe}${toSearch(params)}` : '/channel';
};

export const resolveRoute = (url = new URL(window.location.href)) => {
  const current = url instanceof URL ? url : new URL(String(url), window.location.href);
  const { pathname } = current;
  const path = pathname === '/' ? '/' : pathname.replace(/\/+$/u, '');
  const query = current.searchParams;
  const quality = String(query.get('quality') || '').trim();

  if (path === '/' || path === '') {
    return { kind: 'home', active: 'home', title: 'AuroraTube', query: '', quality, key: 'home' };
  }

  if (path === '/results' || path === '/search') {
    const searchQuery = String(query.get('search_query') || query.get('q') || '').trim();
    const filters = {
      type: String(query.get('type') || 'all').trim() || 'all',
      sort: String(query.get('sort') || 'relevance').trim() || 'relevance',
      date: String(query.get('date') || '').trim(),
      duration: String(query.get('duration') || '').trim(),
      features: String(query.get('features') || '').trim(),
      region: String(query.get('region') || '').trim().toUpperCase(),
      hl: String(query.get('hl') || '').trim(),
    };
    return {
      kind: 'results',
      active: 'home',
      title: searchQuery ? `${searchQuery} - AuroraTube` : '検索 - AuroraTube',
      query: searchQuery,
      filters,
      quality,
      key: `results:${searchQuery}:${filters.type}:${filters.sort}:${filters.date}:${filters.duration}:${filters.features}`,
    };
  }

  if (path === '/watch' || path.startsWith('/watch/')) {
    const videoId = path === '/watch'
      ? String(query.get('v') || '').trim()
      : decodeURIComponent(path.split('/').filter(Boolean)[1] || '');
    return {
      kind: 'watch',
      active: '',
      title: videoId ? `${videoId} - AuroraTube` : 'Watch - AuroraTube',
      id: videoId,
      quality,
      key: `watch:${videoId}:${quality}`,
    };
  }

  if (path === '/shorts' || path.startsWith('/shorts/')) {
    const videoId = path === '/shorts'
      ? String(query.get('v') || '').trim()
      : decodeURIComponent(path.split('/').filter(Boolean)[1] || '');
    return {
      kind: 'shorts',
      active: 'shorts',
      title: videoId ? `${videoId} - Shorts - AuroraTube` : 'ショート - AuroraTube',
      id: videoId,
      quality,
      key: `shorts:${videoId}:${quality}`,
    };
  }

  if (path === '/channel' || path.startsWith('/channel/')) {
    const channelId = path === '/channel'
      ? String(query.get('id') || query.get('handle') || '').trim()
      : decodeURIComponent(path.split('/').filter(Boolean)[1] || '');
    return {
      kind: 'channel',
      active: '',
      title: channelId ? `${channelId} - AuroraTube` : 'チャンネル - AuroraTube',
      id: channelId,
      sortBy: String(query.get('sortBy') || query.get('sort_by') || 'newest').trim() || 'newest',
      key: `channel:${channelId}:${String(query.get('sortBy') || query.get('sort_by') || 'newest').trim() || 'newest'}`,
    };
  }

  return { kind: 'not-found', active: '', title: '404 - AuroraTube', query: '', key: `404:${path}` };
};
