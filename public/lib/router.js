export const currentUrl = () => new URL(window.location.href);

export const navigate = (url, { replace = false } = {}) => {
  const next = new URL(String(url || ''), window.location.href);
  if (next.origin !== window.location.origin) return false;

  if (replace) {
    history.replaceState({}, '', `${next.pathname}${next.search}${next.hash}`);
  } else {
    history.pushState({}, '', `${next.pathname}${next.search}${next.hash}`);
  }

  window.dispatchEvent(new Event('app:navigate'));
  return true;
};

export const onInternalLink = (event) => {
  const link = event.target.closest?.('a[href]');
  if (!link) return false;

  const href = link.getAttribute('href') || '';
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return false;
  if (href.startsWith('/api/')) return false;
  if (link.hasAttribute('download') || link.target === '_blank') return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1) return false;

  let target;
  try {
    target = new URL(href, window.location.href);
  } catch {
    return false;
  }

  if (target.origin !== window.location.origin) return false;
  event.preventDefault();
  navigate(`${target.pathname}${target.search}${target.hash}`);
  return true;
};
