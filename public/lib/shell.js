import { escapeHtml } from './format.js';
import { homeUrl, searchUrl, shortsUrl } from './routes.js';
import { icons } from './icons.js';

const topicLinks = [
  ['すべて', ''],
  ['音楽', '音楽'],
  ['ゲーム', 'ゲーム'],
  ['ライブ', 'ライブ'],
  ['ニュース', 'ニュース'],
  ['ポッドキャスト', 'ポッドキャスト'],
  ['料理', '料理'],
  ['旅行', '旅行'],
];

const navItem = ({ label, href, active = false, icon = '', compact = false }) => `
  <a class="sidebar-link${active ? ' active' : ''}${compact ? ' compact' : ''}" href="${escapeHtml(href)}">
    <span class="sidebar-link-icon">${icon}</span>
    <span class="sidebar-link-text">${escapeHtml(label)}</span>
  </a>
`;

const chipItem = ({ label, query }) => `
  <a class="topic-chip" href="${escapeHtml(searchUrl(query))}">${escapeHtml(label)}</a>
`;

export const appShell = ({
  title = 'AuroraTube',
  query = '',
  active = '',
  body = '',
} = {}) => `
  <div class="site-shell" data-shell>
    <header class="topbar">
      <div class="topbar-left">
        <button class="icon-button menu-button" type="button" data-toggle-sidebar aria-label="メニューを開く">
          ${icons.menu()}
        </button>
        <a class="brand" href="${homeUrl()}" aria-label="AuroraTube ホーム">
          <span class="brand-mark">A</span>
          <span class="brand-name">AuroraTube</span>
        </a>
      </div>

      <form id="search-form" class="search-form" autocomplete="off" action="${searchUrl('')}">
        <div class="search-input-wrap">
          <span class="search-icon">${icons.search()}</span>
          <input id="search-input" name="search_query" type="search" value="${escapeHtml(query)}" placeholder="検索" aria-label="検索" />
          <button type="submit" class="search-submit" aria-label="検索">検索</button>
        </div>
        <div class="search-suggestions" id="search-suggestions" hidden></div>
      </form>

      <div class="topbar-right">
        <button class="icon-button" type="button" data-copy-link aria-label="現在のURLをコピー">
          ${icons.copy()}
        </button>
        <button class="icon-button" type="button" data-share-link aria-label="共有">
          ${icons.share()}
        </button>
        <div class="avatar-chip" aria-hidden="true">Y</div>
      </div>
    </header>

    <div class="workspace">
      <aside class="sidebar" aria-label="ナビゲーション">
        <nav class="sidebar-nav">
          ${navItem({ label: 'ホーム', href: homeUrl(), active: active === 'home', icon: icons.home(), compact: false })}
          ${navItem({ label: 'ショート', href: shortsUrl(), active: active === 'shorts', icon: icons.shorts(), compact: false })}
        </nav>

        <section class="sidebar-section">
          <h2>おすすめ検索</h2>
          <div class="topic-chip-list">
            ${topicLinks.map(chipItem).join('')}
          </div>
        </section>
      </aside>

      <div class="workspace-main">
        <div class="sidebar-backdrop" data-sidebar-backdrop></div>
        <main class="content" aria-label="${escapeHtml(title)}">
          ${body}
        </main>
      </div>
    </div>
  </div>
`;
