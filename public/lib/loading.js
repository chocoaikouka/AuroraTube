const OVERLAY_ID = 'route-loading-overlay';
const OVERLAY_CLASS = 'loading-overlay';
const CARD_CLASS = 'loading-card';
const BODY_CLASS = 'body-loading';

const ensureOverlay = () => {
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-busy', 'false');
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="${CARD_CLASS}" role="status" aria-live="polite">
      <span class="loading-spinner" aria-hidden="true"></span>
      <span class="loading-text">読み込み中…</span>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
};

const getLoadingCard = () => ensureOverlay().querySelector(`.${CARD_CLASS}`);

export const assertLoadingUiConsistency = () => {
  const overlay = ensureOverlay();
  const card = getLoadingCard();
  const loading = document.body.classList.contains(BODY_CLASS);
  const consistent = Boolean(card)
    && overlay.hidden === !loading
    && overlay.getAttribute('aria-busy') === (loading ? 'true' : 'false')
    && document.body.classList.contains(BODY_CLASS) === loading;
  return consistent;
};

const syncOverlay = (count, label = '読み込み中…') => {
  const overlay = ensureOverlay();
  const visible = count > 0;
  document.body.classList.toggle(BODY_CLASS, visible);
  overlay.hidden = !visible;
  overlay.setAttribute('aria-busy', visible ? 'true' : 'false');
  const text = overlay.querySelector('.loading-text');
  if (text) text.textContent = visible ? label : '読み込み中…';
  assertLoadingUiConsistency();
};

export const createLoadingStateController = () => {
  const activeTokens = new Map();
  let nextToken = 1;

  const latestLabel = () => {
    const entries = Array.from(activeTokens.values());
    return entries.length ? String(entries[entries.length - 1] || '読み込み中…') : '読み込み中…';
  };

  return {
    begin(label = '読み込み中…') {
      const token = nextToken++;
      activeTokens.set(token, String(label || '読み込み中…'));
      syncOverlay(activeTokens.size, latestLabel());
      return token;
    },
    end(token) {
      if (!activeTokens.has(token)) return false;
      activeTokens.delete(token);
      syncOverlay(activeTokens.size, latestLabel());
      return true;
    },
    reset() {
      activeTokens.clear();
      syncOverlay(0);
    },
    isLoading() {
      return activeTokens.size > 0;
    },
    get count() {
      return activeTokens.size;
    },
    sync(label = '読み込み中…') {
      syncOverlay(activeTokens.size, label);
    },
  };
};
