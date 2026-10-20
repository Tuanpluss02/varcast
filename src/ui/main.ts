import { byId } from './lib/dom';
import { highlight } from './lib/highlight';
import type {
  PluginToUiMessage,
  PreviewFile,
  DiffSummary,
  CollectionInfo,
  CompositesInfo,
  VariablePreview,
  PaintStylePreview,
  EffectStylePreview,
  TextStylePreview,
} from './lib/messages';
import { formatError, postToPlugin } from './lib/messages';
import { showScreen } from './components/screens';
import type { Screens } from './components/screens';
import {
  collectOptions,
  setToggle,
  toggleDataOn,
  isToggleOn,
} from './components/options';
import { createInitialState } from './state';
import { getAllTargets, getTarget, hasTarget } from '../core/registry';
// Ensure default targets are registered:
import '../targets/flutter';
import '../targets/react_native';

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
const collectionsList = byId<HTMLDivElement>('collectionsList');
const collectionsCount = byId<HTMLSpanElement>('collectionsCount');
const compositesList = byId<HTMLDivElement>('compositesList');
const compositesCount = byId<HTMLSpanElement>('compositesCount');

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

function createChevronSvg(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', 'accordion-chevron');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    '<path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
  return svg;
}

function createSwitchEl(): HTMLElement {
  const sw = document.createElement('div');
  sw.className = 'switch';
  sw.setAttribute('aria-hidden', 'true');
  const thumb = document.createElement('span');
  thumb.className = 'switch__thumb';
  sw.appendChild(thumb);
  return sw;
}

function getSelectedCollectionIds(): string[] {
  const headers = collectionsList.querySelectorAll<HTMLElement>('.accordion-header[data-col-id]');
  const selected: string[] = [];
  headers.forEach((h) => {
    if (isToggleOn(h)) {
      const id = h.getAttribute('data-col-id');
      if (id) selected.push(id);
    }
  });
  return selected;
}

function getCompositeSelection(): {
  colorStyles: boolean;
  shadows: boolean;
  textStyles: boolean;
} {
  const cPaint = compositesList.querySelector<HTMLElement>('[data-comp="colorStyles"]');
  const cShadow = compositesList.querySelector<HTMLElement>('[data-comp="shadows"]');
  const cText = compositesList.querySelector<HTMLElement>('[data-comp="textStyles"]');
  return {
    colorStyles: cPaint ? isToggleOn(cPaint) : true,
    shadows: cShadow ? isToggleOn(cShadow) : true,
    textStyles: cText ? isToggleOn(cText) : true,
  };
}

function updateMeta() {
  const colHeaders = collectionsList.querySelectorAll<HTMLElement>(
    '.accordion-header[data-col-id]',
  );
  const totalCols = colHeaders.length;
  const onCols = Array.from(colHeaders).filter((el: HTMLElement) => isToggleOn(el)).length;
  collectionsCount.textContent = `${onCols} of ${totalCols}`;

  const compHeaders = compositesList.querySelectorAll<HTMLElement>(
    '.accordion-header[data-comp]',
  );
  const totalComps = compHeaders.length;
  const onComps = Array.from(compHeaders).filter((el: HTMLElement) => isToggleOn(el)).length;
  compositesCount.textContent = `${onComps} of ${totalComps}`;
}

function renderVariablePreviewRow(v: VariablePreview): HTMLElement {
  const row = document.createElement('div');
  row.className = 'preview-row';

  const left = document.createElement('div');
  left.className = 'preview-row__left';

  if (v.type === 'COLOR') {
    const swatchBox = document.createElement('div');
    swatchBox.className = 'color-swatch-box';
    if (v.colorHex) {
      const fill = document.createElement('div');
      fill.className = 'color-swatch-fill';
      fill.style.background = v.colorHex;
      swatchBox.appendChild(fill);
    }
    left.appendChild(swatchBox);
  }

  const nameEl = document.createElement('span');
  nameEl.className = 'preview-row__name';
  nameEl.textContent = v.name;
  nameEl.title = v.name;
  left.appendChild(nameEl);

  const right = document.createElement('div');
  right.className = 'preview-row__right';

  const chip = document.createElement('span');
  chip.className = 'val-chip';
  chip.textContent = v.valuePreview;
  right.appendChild(chip);

  row.appendChild(left);
  row.appendChild(right);
  return row;
}

function renderCollections(cols: CollectionInfo[]) {
  collectionsList.innerHTML = '';
  if (cols.length === 0) {
    collectionsList.innerHTML =
      '<div style="padding: 12px 0; color: var(--color-text-muted); font-size: 11px; text-align: center;">No collections found in file.</div>';
    updateMeta();
    return;
  }

  cols.forEach((col, idx) => {
    const group = document.createElement('div');
    group.className = 'accordion-group';
    if (idx === 0) group.classList.add('is-expanded'); // expand first by default

    const header = document.createElement('div');
    header.className = 'accordion-header';
    header.role = 'switch';
    header.tabIndex = 0;
    header.setAttribute('aria-checked', 'true');
    header.setAttribute('data-col-id', col.id);

    const trigger = document.createElement('div');
    trigger.className = 'accordion-trigger';

    const chevron = createChevronSvg();
    const title = document.createElement('div');
    title.className = 'toggle__title';
    title.textContent = col.name;

    const badge = document.createElement('span');
    badge.className = 'count-pill';
    badge.style.fontSize = '10px';
    badge.style.padding = '1px 5px';
    badge.textContent = `${col.variableCount} var${col.variableCount === 1 ? '' : 's'}`;

    trigger.appendChild(chevron);
    trigger.appendChild(title);
    trigger.appendChild(badge);

    const sw = createSwitchEl();

    header.appendChild(trigger);
    header.appendChild(sw);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      group.classList.toggle('is-expanded');
    });

    sw.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDataOn(header);
      updateMeta();
    });

    header.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleDataOn(header);
        updateMeta();
      }
    });

    const body = document.createElement('div');
    body.className = 'accordion-body';

    if (col.variables && col.variables.length > 0) {
      col.variables.forEach((v) => {
        body.appendChild(renderVariablePreviewRow(v));
      });
    } else {
      const empty = document.createElement('div');
      empty.style.padding = '6px';
      empty.style.color = 'var(--ink-mute)';
      empty.style.fontSize = '11px';
      empty.textContent = 'No variables in collection';
      body.appendChild(empty);
    }

    group.appendChild(header);
    group.appendChild(body);
    collectionsList.appendChild(group);
  });

  updateMeta();
}

function renderComposites(comp: CompositesInfo) {
  compositesList.innerHTML = '';

  const sections: {
    key: 'colorStyles' | 'shadows' | 'textStyles';
    title: string;
    count: number;
    renderItems: () => HTMLElement[];
  }[] = [
    {
      key: 'colorStyles',
      title: 'Color styles',
      count: comp.paintStylesCount,
      renderItems: () =>
        comp.paintStyles.map((p) => {
          const row = document.createElement('div');
          row.className = 'preview-row';
          const left = document.createElement('div');
          left.className = 'preview-row__left';

          if (p.gradientCss) {
            const grad = document.createElement('div');
            grad.className = 'gradient-swatch-box';
            grad.style.background = p.gradientCss;
            left.appendChild(grad);
          } else {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch-box';
            const fill = document.createElement('div');
            fill.className = 'color-swatch-fill';
            fill.style.background = p.colorHex || '#7C5CFF';
            swatch.appendChild(fill);
            left.appendChild(swatch);
          }

          const name = document.createElement('span');
          name.className = 'preview-row__name';
          name.textContent = p.name;
          name.title = p.name;
          left.appendChild(name);

          const right = document.createElement('div');
          right.className = 'preview-row__right';
          const typeChip = document.createElement('span');
          typeChip.className = 'val-chip';
          typeChip.textContent = p.type;
          right.appendChild(typeChip);

          row.appendChild(left);
          row.appendChild(right);
          return row;
        }),
    },
    {
      key: 'shadows',
      title: 'Shadows',
      count: comp.effectStylesCount,
      renderItems: () =>
        comp.effectStyles.map((e) => {
          const row = document.createElement('div');
          row.className = 'preview-row';
          const left = document.createElement('div');
          left.className = 'preview-row__left';

          const shadowBox = document.createElement('div');
          shadowBox.className = 'shadow-box-sample';
          if (e.boxShadowCss) shadowBox.style.boxShadow = e.boxShadowCss;
          left.appendChild(shadowBox);

          const name = document.createElement('span');
          name.className = 'preview-row__name';
          name.textContent = e.name;
          name.title = e.name;
          left.appendChild(name);

          const right = document.createElement('div');
          right.className = 'preview-row__right';
          const typeChip = document.createElement('span');
          typeChip.className = 'val-chip';
          typeChip.textContent = e.type;
          right.appendChild(typeChip);

          row.appendChild(left);
          row.appendChild(right);
          return row;
        }),
    },
    {
      key: 'textStyles',
      title: 'Text styles',
      count: comp.textStylesCount,
      renderItems: () =>
        comp.textStyles.map((t) => {
          const row = document.createElement('div');
          row.className = 'preview-row';
          const left = document.createElement('div');
          left.className = 'preview-row__left';

          const name = document.createElement('span');
          name.className = 'preview-row__name';
          name.textContent = t.name;
          name.title = t.name;
          left.appendChild(name);

          const sample = document.createElement('span');
          sample.className = 'text-sample-line';
          sample.style.fontFamily = t.fontFamily;
          sample.style.fontWeight = String(t.fontWeight);
          sample.textContent = 'Ag Sample';
          left.appendChild(sample);

          const right = document.createElement('div');
          right.className = 'preview-row__right';
          const sizeChip = document.createElement('span');
          sizeChip.className = 'val-chip';
          sizeChip.textContent = `${t.fontSize}px / ${t.fontWeight}`;
          right.appendChild(sizeChip);

          row.appendChild(left);
          row.appendChild(right);
          return row;
        }),
    },
  ];

  sections.forEach((sec) => {
    const group = document.createElement('div');
    group.className = 'accordion-group';

    const header = document.createElement('div');
    header.className = 'accordion-header';
    header.role = 'switch';
    header.tabIndex = 0;
    header.setAttribute('aria-checked', sec.count > 0 ? 'true' : 'false');
    header.setAttribute('data-comp', sec.key);

    const trigger = document.createElement('div');
    trigger.className = 'accordion-trigger';

    const chevron = createChevronSvg();
    const title = document.createElement('div');
    title.className = 'toggle__title';
    title.textContent = sec.title;

    const badge = document.createElement('span');
    badge.className = 'count-pill';
    badge.style.fontSize = '10px';
    badge.style.padding = '1px 5px';
    badge.textContent = `${sec.count} style${sec.count === 1 ? '' : 's'}`;

    trigger.appendChild(chevron);
    trigger.appendChild(title);
    trigger.appendChild(badge);

    const sw = createSwitchEl();

    header.appendChild(trigger);
    header.appendChild(sw);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      group.classList.toggle('is-expanded');
    });

    sw.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDataOn(header);
      updateMeta();
    });

    header.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleDataOn(header);
        updateMeta();
      }
    });

    const body = document.createElement('div');
    body.className = 'accordion-body';

    if (sec.count > 0) {
      sec.renderItems().forEach((item) => body.appendChild(item));
    } else {
      const empty = document.createElement('div');
      empty.style.padding = '6px';
      empty.style.color = 'var(--ink-mute)';
      empty.style.fontSize = '11px';
      empty.textContent = 'None found in file';
      body.appendChild(empty);
    }

    group.appendChild(header);
    group.appendChild(body);
    compositesList.appendChild(group);
  });

  updateMeta();
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
  const options = collectOptions({
    targetId,
    packageName,
    getSelectedCollectionIds,
    getCompositeSelection,
  });
  postToPlugin({ type: 'export', options });
}

exportBtn.addEventListener('click', startExport);

function initTargetDropdown() {
  const targets = getAllTargets();
  if (targets.length > 0) {
    const currentVal = targetId.value;
    targetId.innerHTML = '';
    targets.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.displayName ?? t.id;
      if (t.id === currentVal || (!currentVal && t.id === 'flutter')) {
        opt.selected = true;
      }
      targetId.appendChild(opt);
    });
  }
}

[targetId, packageName].forEach((el) => {
  el.addEventListener('input', updateMeta);
  el.addEventListener('change', updateMeta);
});

targetId.addEventListener('change', () => {
  const t = hasTarget(targetId.value) ? getTarget(targetId.value) : null;
  if (t) {
    packageName.placeholder = t.defaultPackageName ?? 'design_system';
  }
});

byId<HTMLButtonElement>('reset').addEventListener('click', () => {
  const firstTarget = getAllTargets()[0];
  targetId.value = firstTarget?.id ?? 'flutter';
  packageName.value = firstTarget?.defaultPackageName ?? 'design_system';
  const allHeaders = document.querySelectorAll<HTMLElement>(
    '.accordion-header[role="switch"]',
  );
  allHeaders.forEach((h: HTMLElement) => setToggle(h, true));
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
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
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
  codeViewer.innerHTML = highlight(file.contents, path);
  copyCodeBtn.classList.remove('hidden');
  fileTree.querySelectorAll<HTMLElement>('.tree-row--file').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.path === path);
  });
}

function renderDiffBar(diff: DiffSummary) {
  const total = diff.added + diff.removed + diff.renamed;
  if (total === 0) {
    diffBar.innerHTML =
      '<span class="diff-chip diff-chip--neutral">No changes since last export</span>';
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
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pickInitialFile(files: PreviewFile[]): string | null {
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

  if (msg.type === 'init-data') {
    renderCollections(msg.collections);
    renderComposites(msg.composites);
    return;
  }

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
    copyCodeBtn.classList.remove('hidden');
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

initTargetDropdown();
updateMeta();
go('home');

postToPlugin({ type: 'init' });
