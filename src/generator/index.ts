// Public generator entrypoints.
//
// IMPORTANT:
// - `emitPackage()` is browser-safe (used by the Figma plugin runtime).
// - `writePackage()` is Node-only (used by the CLI).

export type { EmittedFile } from './emit';
export { emitPackage } from './emit';

export { writePackage } from './write_node';
