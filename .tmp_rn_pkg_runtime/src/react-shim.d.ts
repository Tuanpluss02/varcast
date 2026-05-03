// GENERATED FILE — do not edit by hand.
// Minimal shims so `tsc --noEmit` can run without installing react typings.

declare module 'react' {
  export type Dispatch<T> = (value: T) => void;
  export type SetStateAction<S> = S | ((prevState: S) => S);
  export type ReactNode = any;
  export type Context<T> = { Provider: any; __type?: T };
  export function createContext<T>(value: T): Context<T>;
  export function useContext<T>(ctx: Context<T>): T;
  export function useMemo<T>(fn: () => T, deps: any[]): T;
  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export default {} as any;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}
