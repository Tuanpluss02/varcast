export type DiffSummary = {
  added: unknown[];
  removed: unknown[];
  renamed: unknown[];
};

export type ExportSummary = {
  collections: number;
  variables: number;
  composites: number;
  fileCount: number;
};

export function fmtDiff(diff: Partial<DiffSummary> | null | undefined): string {
  const added = diff?.added?.length ?? 0;
  const removed = diff?.removed?.length ?? 0;
  const renamed = diff?.renamed?.length ?? 0;
  return `Changes\n- added: ${added}\n- removed: ${removed}\n- renamed: ${renamed}`;
}

export function fmtSummary(s: ExportSummary | null | undefined): string {
  if (!s) return '';
  return `${s.collections} collections · ${s.variables} variables · ${s.composites} composites\n${s.fileCount} generated files`;
}

