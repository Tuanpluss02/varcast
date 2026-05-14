// Emits `src/index.ts` — the package public surface for NativeWind.
// Re-exports the `themes` aggregator so consumers can do
// `import { themes } from '<package>'` and pass `themes.dark` to `vars()`.

export function emitPackageIndexTs(): string {
  return [
    '// GENERATED FILE — do not edit by hand.',
    "export { themes } from '../themes';",
    '',
  ].join('\n');
}
