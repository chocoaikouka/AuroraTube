import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { navigate } from '../lib/navigation';

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function Link({ href, className = '', children, onClick, ...props }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(href);
  };

  return (
    <a href={href} className={className} data-link="true" {...props} onClick={handleClick}>
      {children}
    </a>
  );
}
