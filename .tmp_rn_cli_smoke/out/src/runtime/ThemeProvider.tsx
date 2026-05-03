import React, { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createTheme } from './createTheme';
import type { Theme, ThemeModeState } from './createTheme';

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider(props: { children: ReactNode; initial?: Partial<ThemeModeState> }) {
  const [modes, setModes] = useState<ThemeModeState>(() => ({ ...(props.initial as ThemeModeState | undefined) } as ThemeModeState));

  const theme = useMemo(() => createTheme(modes, setModes), [modes]);

  return <ThemeContext.Provider value={theme}>{props.children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useTheme must be used within ThemeProvider');
  return v;
}

