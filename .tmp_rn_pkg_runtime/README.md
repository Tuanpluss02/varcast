# ds

Generated React Native design system. Do not edit by hand.

## Usage

```tsx
import { ThemeProvider, useTheme } from 'ds';

function App() {
  return (
    <ThemeProvider>
      <Screen />
    </ThemeProvider>
  );
}

function Screen() {
  const theme = useTheme();
  return null;
}
```
