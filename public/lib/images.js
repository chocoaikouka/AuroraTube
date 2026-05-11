const isAbsoluteHttpUrl = (value) => {
  try {
    const parsed = new URL(String(value || ''), window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const thumbnailUrl = (url) => {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.startsWith('/api/thumbnail?url=')) return value;
  if (!isAbsoluteHttpUrl(value) && !value.startsWith('//')) return '';
  const normalized = value.startsWith('//') ? `${window.location.protocol}${value}` : value;
  return `/api/thumbnail?url=${encodeURIComponent(normalized)}`;
};

export const posterStyle = (url) => {
  const src = thumbnailUrl(url);
  return src ? `background-image:url('${src.replace(/'/g, '%27')}')` : '';
};
