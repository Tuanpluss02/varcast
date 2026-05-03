import type { Dispatch, SetStateAction } from 'react';
import { colorToken } from '../tokens/tokens/color-token';

export type ThemeModeState = Record<string, string>;

export type Theme = {
  modes: ThemeModeState;
  setMode: (collection: string, mode: string) => void;
  [k: string]: any;
};

export function createTheme(
  modes: ThemeModeState = {},
  setModes?: Dispatch<SetStateAction<ThemeModeState>>,
): Theme {
  const setMode = (collection: string, mode: string) => {
    if (!setModes) return;
    setModes((prev: ThemeModeState) => ({ ...prev, [collection]: mode }));
  };

  const theme: Theme = {
    modes: {
  "colorToken": "darkMode",
      ...modes,
    },
    setMode,
  } as any;

  Object.defineProperty(theme, "colorToken", {
    enumerable: true,
    get: () => colorToken[theme.modes["colorToken"] as keyof typeof colorToken] ?? colorToken["darkMode" as any],
  });

  return theme;
}
