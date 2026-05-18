declare module 'react' {
  export type ReactNode = any;
  export type MouseEvent<T = any> = any;
  export type KeyboardEvent = any;
  export type FormEvent<T = any> = any;
  export type ChangeEvent<T = any> = any;
  export type AnchorHTMLAttributes<T> = Record<string, any>;

  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps?: any[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function useState<T>(initialState: T | (() => T)): [T, (value: T | ((prevState: T) => T)) => void];

  const React: any;
  export default React;
}

declare module 'react-dom/client' {
  export function createRoot(container: Element | DocumentFragment): { render(node: any): void };
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare namespace JSX {
  interface Element {}
  interface IntrinsicAttributes {
    key?: any;
  }
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
