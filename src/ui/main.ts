import { byId } from './lib/dom';
import type {
  PluginToUiMessage,
  CollectionInfo,
  CompositesInfo,
  VariablePreview,
} from './lib/messages';
import { postToPlugin } from './lib/messages';
import { showScreen } from './components/screens';
import type { Screens } from './components/screens';
import {
  collectOptions,
  setToggle,
  toggleDataOn,
  isToggleOn,
} from './components/options';
import { createInitialState } from './state';
import { TargetController } from './controllers/target_controller';
import { ExportController } from './controllers/export_controller';
import { ReviewController, wireCopy } from './controllers/review_controller';

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
    if (idx === 0) group.classList.add('is-expanded');

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

// ================= Controllers Initialization =================

const targetController = new TargetController({
  targetSelect: targetId,
  packageNameInput: packageName,
});

const exportController = new ExportController({
  elements: {
    exportBtn,
    loadingOverlay,
    loadingTitle,
    loadingSub,
    statusEl: status,
    downloadZipBtn,
    errTitle,
    errList,
  },
  navigateTo: (screen) => go(screen),
  getExportOptions: () =>
    collectOptions({
      targetId,
      packageName,
      getSelectedCollectionIds,
      getCompositeSelection,
    }),
});

const reviewController = new ReviewController({
  elements: {
    diffBar,
    fileTree,
    reviewSummary,
    codeTitle,
    codeViewer,
    copyCodeBtn,
    backFromReviewBtn,
  },
  onBack: () => go('home'),
});

[targetId, packageName].forEach((el) => {
  el.addEventListener('input', updateMeta);
  el.addEventListener('change', updateMeta);
});

byId<HTMLButtonElement>('reset').addEventListener('click', () => {
  targetController.reset();
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

wireCopy(byId<HTMLButtonElement>('copyErrors'), () => errList.textContent || '');

// ================= Plugin Message Handler =================

window.onmessage = (e: MessageEvent) => {
  const msg = (e.data as any)?.pluginMessage as PluginToUiMessage | undefined;
  if (!msg) return;

  exportController.resetButtons();

  if (msg.type === 'init-data') {
    if (msg.availableTargets && msg.availableTargets.length > 0) {
      targetController.setAvailableTargets(msg.availableTargets);
    }
    renderCollections(msg.collections);
    renderComposites(msg.composites);
    return;
  }

  if (msg.type === 'validation-errors') {
    exportController.handleValidationErrors(msg.errors);
    return;
  }

  if (msg.type === 'preview-ready') {
    state.previewFiles = msg.files;
    exportController.hideLoading();
    reviewController.renderReview(msg.files, msg.diff, msg.summary);
    go('review');
    return;
  }

  if (msg.type === 'exporting') {
    exportController.handleExporting();
    return;
  }

  if (msg.type === 'zip-ready') {
    state.lastZip = msg.bytes;
    state.lastFilename = msg.filename || 'design_system.zip';
    exportController.handleZipReady(msg.bytes, state.lastFilename);
    return;
  }

  if (msg.type === 'error') {
    exportController.handleError(msg.message);
    return;
  }

  if (msg.type === 'warning') {
    exportController.handleWarning(msg.message);
    return;
  }
};

updateMeta();
go('home');

postToPlugin({ type: 'init' });
