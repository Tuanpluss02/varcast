import { byId } from './lib/dom';
import { highlight } from './lib/highlight';
import type { PluginToUiMessage, PreviewFile, DiffSummary } from './lib/messages';
import { formatError, postToPlugin } from './lib/messages';
import { showScreen } from './components/screens';
import type { Screens } from './components/screens';
import {
  collectOptions,
  setToggle,
  toggleDataOn,
  isToggleOn,
  type ToggleEls,
} from './components/options';
import { createInitialState } from './state';

const state = createInitialState();

const status = byId<HTMLDivElement>('status');
const exportBtn = byId<HTMLButtonElement>('export');
const actionBar = byId<HTMLElement>('actionBar');
const loadingOverlay = byId<HTMLDivElement>('loadingOverlay');
const loadingTitle = byId<HTMLDivElement>('loadingTitle');
const loadingSub = byId<HTMLDivElement>('loadingSub');

const screens: Screens = {
  home: byId('screen-home'),
  review: byId('screen-review'),
  errors: byId('screen-errors'),
};

const errTitle = byId<HTMLHeadingElement>('errTitle');
const errList = byId<HTMLPreElement>('errList');

const packageName = byId<HTMLInputElement>('packageName');
const targetId = byId<HTMLSelectElement>('targetId');
const rnFlavor = byId<HTMLSelectElement>('rnFlavor');
const rnFlavorRow = byId<HTMLDivElement>('rnFlavorRow');
const tokensCount = byId<HTMLSpanElement>('tokensCount');
const compositesCount = byId<HTMLSpanElement>('compositesCount');

const toggles: ToggleEls = {
  primitives: byId('tPrimitives'),
  tokens: byId('tTokens'),
  colorStyles: byId('tColorStyles'),
  shadows: byId('tShadows'),
  textStyles: byId('tTextStyles'),
  archContext: byId('tArchContext'),
};

const archCard = byId<HTMLDivElement>('archCard');

function syncTargetSpecificUi() {
  // Architecture (context-based) is Flutter-specific. The RN flavor select
  // is RN-specific. Only one of the two cards is visible at a time.
  const isFlutter = (targetId.value || 'flutter') === 'flutter';
  archCard.classList.toggle('hidden', !isFlutter);
  rnFlavorRow.classList.toggle('hidden', isFlutter);
}

const diffBar = byId<HTMLDivElement>('diffBar');
const fileTree = byId<HTMLDivElement>('fileTree');
const reviewSummary = byId<HTMLSpanElement>('reviewSummary');
const codeTitle = byId<HTMLHeadingElement>('codeTitle');
const codeViewer = byId<HTMLPreElement>('codeViewer');
const copyCodeBtn = byId<HTMLButtonElement>('copyCode');
const downloadZipBtn = byId<HTMLButtonElement>('downloadZip');
const backFromReviewBtn = byId<HTMLButtonElement>('backFromReview');

function go(name: keyof typeof screens) {
  showScreen(screens, name as any, actionBar);
}

function updateMeta() {
  const tokenOn = [toggles.primitives, toggles.tokens].filter(isToggleOn).length;
  tokensCount.textContent = `${tokenOn} of 2`;
  const compOn = [toggles.colorStyles, toggles.shadows, toggles.textStyles]
    .filter(isToggleOn).length;
  compositesCount.textContent = `${compOn} of 3`;
}

function downloadZip() {
  if (!state.lastZip) return;
  const bytes =
    state.lastZip instanceof Uint8Array
      ? state.lastZip
      : new Uint8Array(state.lastZip as any);
  const blob = new Blob([bytes.buffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = state.lastFilename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function showLoading(title: string, sub: string) {
  loadingTitle.textContent = title;
  loadingSub.textContent = sub;
  loadingOverlay.classList.add('is-open');
  loadingOverlay.setAttribute('aria-hidden', 'false');
}
function hideLoading() {
  loadingOverlay.classList.remove('is-open');
  loadingOverlay.setAttribute('aria-hidden', 'true');
}

function startExport() {
  exportBtn.disabled = true;
  status.textContent = '';
  showLoading('Validating…', 'Reading tokens and styles from Figma.');
  const options = collectOptions({ targetId, rnFlavor, packageName, toggles });
  postToPlugin({ type: 'export', options });
}

exportBtn.addEventListener('click', startExport);

// Clicks/keys on the info button inside .toggle__copy must not flip the switch.
function isFromInfoButton(e: Event): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && !!t.closest && !!t.closest('.info');
}
Object.values(toggles).forEach((el) => {
  el.addEventListener('click', (e) => {
    if (isFromInfoButton(e)) return;
    toggleDataOn(el);
    updateMeta();
  });
  el.addEventListener('keydown', (e) => {
    if (isFromInfoButton(e)) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleDataOn(el);
      updateMeta();
    }
  });
});

[targetId, rnFlavor, packageName].forEach((el) => {
  el.addEventListener('input', updateMeta);
  el.addEventListener('change', updateMeta);
});
targetId.addEventListener('change', syncTargetSpecificUi);

byId<HTMLButtonElement>('reset').addEventListener('click', () => {
  targetId.value = 'flutter';
  rnFlavor.value = 'nativewind';
  packageName.value = 'design_system';
  setToggle(toggles.primitives, true);
  setToggle(toggles.tokens, true);
  setToggle(toggles.colorStyles, true);
  setToggle(toggles.shadows, true);
  setToggle(toggles.textStyles, true);
  setToggle(toggles.archContext, true);
  syncTargetSpecificUi();
  updateMeta();
});

byId<HTMLButtonElement>('closeErrors').addEventListener('click', () => {
  postToPlugin({ type: 'cancel' });
  go('home');
});

backFromReviewBtn.addEventListener('click', () => {
  go('home');
});

downloadZipBtn.addEventListener('click', () => {
  downloadZipBtn.disabled = true;
  showLoading('Packing zip…', 'Almost there.');
  postToPlugin({ type: 'download-zip' });
});

function wireCopy(btn: HTMLButtonElement, getText: () => string) {
  btn.addEventListener('click', async () => {
    const text = getText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    btn.classList.add('is-copied');
    const original = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => {
      btn.classList.remove('is-copied');
      btn.textContent = original;
    }, 1400);
  });
}
wireCopy(byId<HTMLButtonElement>('copyErrors'), () => errList.textContent || '');
wireCopy(copyCodeBtn, () => codeViewer.textContent || '');

// ── Review screen rendering ────────────────────────────────────────────────

type TreeNode = {
  name: string;
  type: 'dir' | 'file';
  path: string;
  children?: Map<string, TreeNode>;
  size?: number;
};

function buildTree(files: PreviewFile[]): TreeNode {
  const root: TreeNode = { name: '', type: 'dir', path: '', children: new Map() };
  for (const f of files) {
    const parts = f.path.split('/');
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const map = cur.children!;
      let next = map.get(name);
      if (!next) {
        next = isLast
          ? { name, type: 'file', path: f.path, size: f.size }
          : {
              name,
              type: 'dir',
              path: parts.slice(0, i + 1).join('/'),
              children: new Map(),
            };
        map.set(name, next);
      }
      cur = next;
    }
  }
  return root;
}

const ICON_FOLDER =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M1.5 3.5a1 1 0 0 1 1-1h2l1 1h4a1 1 0 0 1 1 1V9a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3.5Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>';
const ICON_FILE =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 1.5h4l2.5 2.5V10a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M7 1.5V4h2.5" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>';

function renderTreeInto(container: HTMLElement, files: PreviewFile[]) {
  container.innerHTML = '';
  const root = buildTree(files);

  function walk(node: TreeNode, depth: number) {
    if (!node.children) return;
    const entries = [...node.children.values()].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of entries) {
      const row = document.createElement('div');
      row.className = `tree-row tree-row--${child.type}`;
      row.style.paddingLeft = `${depth * 12 + 12}px`;
      if (child.type === 'dir') {
        row.innerHTML = `${ICON_FOLDER}<span class="tree-row__name">${escapeHtml(child.name)}</span>`;
        container.appendChild(row);
        walk(child, depth + 1);
      } else {
        row.dataset.path = child.path;
        row.innerHTML =
          `${ICON_FILE}<span class="tree-row__name">${escapeHtml(child.name)}</span>` +
          `<span class="tree-row__size">${fmtSize(child.size ?? 0)}</span>`;
        row.addEventListener('click', () => selectFile(child.path));
        container.appendChild(row);
      }
    }
  }
  walk(root, 0);
}

function selectFile(path: string) {
  state.selectedPath = path;
  const file = state.previewFiles.find((f) => f.path === path);
  if (!file) return;
  codeTitle.textContent = path;
  // innerHTML carries our <span class="tok-…"> wrappers; highlight() escapes
  // every raw character before wrapping, so user content can't inject markup.
  codeViewer.innerHTML = highlight(file.contents, path);
  copyCodeBtn.classList.remove('hidden');
  fileTree.querySelectorAll<HTMLElement>('.tree-row--file').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.path === path);
  });
}

function renderDiffBar(diff: DiffSummary) {
  const total = diff.added + diff.removed + diff.renamed;
  if (total === 0) {
    diffBar.innerHTML = '<span class="diff-chip diff-chip--neutral">No changes since last export</span>';
    return;
  }
  const chips: string[] = [];
  if (diff.added > 0)
    chips.push(`<span class="diff-chip diff-chip--added">+${diff.added} added</span>`);
  if (diff.removed > 0)
    chips.push(`<span class="diff-chip diff-chip--removed">−${diff.removed} removed</span>`);
  if (diff.renamed > 0)
    chips.push(`<span class="diff-chip diff-chip--renamed">~${diff.renamed} renamed</span>`);
  diffBar.innerHTML = chips.join('');
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pickInitialFile(files: PreviewFile[]): string | null {
  // Prefer the public barrel / entry file so users see something useful first.
  const preferred = files.find(
    (f) =>
      /^lib\/[^/]+\.dart$/.test(f.path) ||
      /^src\/index\.ts$/.test(f.path) ||
      /^pubspec\.yaml$/.test(f.path) ||
      /^package\.json$/.test(f.path),
  );
  return preferred?.path ?? files[0]?.path ?? null;
}

window.onmessage = (e: MessageEvent) => {
  const msg = (e.data as any)?.pluginMessage as PluginToUiMessage | undefined;
  if (!msg) return;

  exportBtn.disabled = false;
  downloadZipBtn.disabled = false;

  if (msg.type === 'validation-errors') {
    hideLoading();
    const errs = msg.errors || [];
    errTitle.textContent = `${errs.length} error${errs.length === 1 ? '' : 's'}`;
    errList.textContent = errs.map(formatError).join('\n');
    go('errors');
    return;
  }

  if (msg.type === 'preview-ready') {
    state.previewFiles = msg.files;
    state.selectedPath = null;
    hideLoading();
    renderDiffBar(msg.diff);
    renderTreeInto(fileTree, msg.files);
    reviewSummary.textContent = `${msg.summary.fileCount} files · ${fmtSize(msg.summary.totalBytes)}`;
    codeTitle.textContent = 'Select a file';
    codeViewer.textContent = 'Pick a file from the tree above to preview its contents.';
    copyCodeBtn.classList.add('hidden');
    go('review');
    const initial = pickInitialFile(msg.files);
    if (initial) selectFile(initial);
    return;
  }

  if (msg.type === 'exporting') {
    showLoading('Packing zip…', 'Almost there.');
    return;
  }

  if (msg.type === 'zip-ready') {
    state.lastZip = msg.bytes;
    state.lastFilename = msg.filename || 'design_system.zip';
    hideLoading();
    downloadZip();
    return;
  }

  if (msg.type === 'error') {
    hideLoading();
    status.textContent = 'Error: ' + msg.message;
  }
};

updateMeta();
syncTargetSpecificUi();
go('home');
