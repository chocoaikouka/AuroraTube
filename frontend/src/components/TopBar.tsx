import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from './Link';

export interface TopBarProps {
  query: string;
  onSearch: (value: string) => void;
  onOpenHome: () => void;
}

export function TopBar({ query, onSearch, onOpenHome }: TopBarProps) {
  const [draft, setDraft] = useState(query);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  return (
    <header className="topbar">
      <button type="button" className="brand-button" onClick={onOpenHome} aria-label="ホーム">
        <span className="brand-mark">A</span>
        <span className="brand-name">AuroraTube</span>
      </button>

      <form
        className="search-form"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSearch(draft);
        }}
      >
        <label className="sr-only" htmlFor="search-input">検索</label>
        <input
          id="search-input"
          className="search-input"
          type="search"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="search"
          placeholder="検索"
          value={draft}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
        />
        <button type="submit" className="button-primary">検索</button>
      </form>

      <div className="topbar-actions">
        <Link href="/" className="button-secondary">ホーム</Link>
      </div>
    </header>
  );
}
