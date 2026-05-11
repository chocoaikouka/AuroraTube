const icon = (path) => `
  <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="${path}" />
  </svg>
`;

export const icons = {
  menu: () => icon('M4 6h16v2H4zM4 11h16v2H4zM4 16h16v2H4z'),
  home: () => icon('M12 3 3 10h2v10h6v-6h2v6h6V10h2z'),
  shorts: () => icon('M8 5.5 17 10l-9 4.5V5.5zm0 13 9-4.5V22L8 18.5z'),
  search: () => icon('M10 4a6 6 0 1 0 3.83 10.61l4.28 4.28 1.41-1.41-4.28-4.28A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z'),
  copy: () => icon('M8 8V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h3zm2 0h5a2 2 0 0 1 2 2v5h1V5H10v3zm-5 2v7h7v-7H5z'),
  share: () => icon('M16 5a3 3 0 1 0-2.83-4H13a3 3 0 0 0 0 6 2.96 2.96 0 0 0 1.17-.24l-4.1 4.1A3 3 0 0 0 6 10a3 3 0 1 0 2.83 4h.17a3 3 0 0 0 1.18-.24l4.08 4.08A3 3 0 1 0 16 16a2.96 2.96 0 0 0-1.17.24l-4.08-4.08A3 3 0 0 0 11 10a2.98 2.98 0 0 0-.17-1l4.1-4.1A2.98 2.98 0 0 0 16 5z'),
  download: () => icon('M12 3v10l4-4 1.41 1.41L12 16.83 6.59 10.41 8 9l4 4V3h0zM5 19h14v2H5z'),
  chevron: () => icon('M9 6 15 12 9 18 7.59 16.59 12.17 12 7.59 7.41z'),
  play: () => icon('M8 5v14l11-7z'),
};
