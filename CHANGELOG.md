# Changelog

## 0.1.0 — Initial release

First public release of Varcast.

### Targets

- **Flutter** — Dart package with `AppTheme` facade, mode-animated
  `DesignSystemController`, and typed composite getters
  (`DSColorStyles`, `DSShadows`, `DSStyles` / `DSTextStyle`).
- **React Native** — TypeScript package with `ThemeProvider` + `useTheme()`
  hook, per-collection mode state, and composite token files.

### Features

- Read Figma Variables (collections, modes, alias chains) into a target-neutral
  intermediate representation.
- Read local Paint, Effect, and Text styles; preserve variable bindings as
  alias references in the IR.
- Validate IR before emit: cycle detection, unresolved alias warnings,
  float-noise rounding, hidden-variable filtering.
- Per-target stable identifier manifest — Figma renames never break consumer
  code.
- Auto-generated `CHANGELOG.md` per export (added / removed / renamed).
- ZIP packaging entirely in-browser; no network access.
