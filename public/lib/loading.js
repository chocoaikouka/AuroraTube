const OVERLAY_ID = 'route-loading-overlay';
const OVERLAY_CLASS = 'loading-overlay';
const CARD_CLASS = 'loading-card';
const BODY_CLASS = 'body-loading';
const DEFAULT_LABEL = '読み込み中…';

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
      <span class="loading-text">${DEFAULT_LABEL}</span>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
};

const setOverlayState = (visible, label = DEFAULT_LABEL) => {
  const overlay = ensureOverlay();
  document.body.classList.toggle(BODY_CLASS, visible);
  overlay.hidden = !visible;
  overlay.setAttribute('aria-busy', visible ? 'true' : 'false');

  const text = overlay.querySelector('.loading-text');
  if (visible && text) {
    text.textContent = label || DEFAULT_LABEL;
  }

  return overlay;
};

export const createLoadingStateController = () => {
  const activeTokens = new Map();
  let nextToken = 1;

  const latestLabel = () => {
    const entries = Array.from(activeTokens.values());
    return entries.length ? String(entries[entries.length - 1] || DEFAULT_LABEL) : DEFAULT_LABEL;
  };

  return {
    begin(label = DEFAULT_LABEL) {
      const token = nextToken++;
      activeTokens.set(token, String(label || DEFAULT_LABEL));
      setOverlayState(true, latestLabel());
      return token;
    },
    end(token) {
      if (!activeTokens.has(token)) return false;
      activeTokens.delete(token);
      if (activeTokens.size > 0) {
        setOverlayState(true, latestLabel());
      } else {
        setOverlayState(false);
      }
      return true;
    },
    reset() {
      activeTokens.clear();
      setOverlayState(false);
    },
    isLoading() {
      return activeTokens.size > 0;
    },
    get count() {
      return activeTokens.size;
    },
    sync(label = DEFAULT_LABEL) {
      if (activeTokens.size > 0) {
        setOverlayState(true, label);
      } else {
        setOverlayState(false);
      }
    },
  };
};

export const loadingController = createLoadingStateController();
