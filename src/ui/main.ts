import { byId } from './lib/dom';
import { fmtDiff, fmtSummary } from './lib/format';
import type { PluginToUiMessage } from './lib/messages';
import { formatError, postToPlugin } from './lib/messages';
import { setupModal } from './components/modal';
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
  errors: byId('screen-errors'),
};

const errTitle = byId<HTMLHeadingElement>('errTitle');
const errList = byId<HTMLPreElement>('errList');

const packageName = byId<HTMLInputElement>('packageName');
const targetId = byId<HTMLSelectElement>('targetId');
const tokensCount = byId<HTMLSpanElement>('tokensCount');
const compositesCount = byId<HTMLSpanElement>('compositesCount');

const toggles: ToggleEls = {
  primitives: byId('tPrimitives'),
  tokens: byId('tTokens'),
  colorStyles: byId('tColorStyles'),
  shadows: byId('tShadows'),
  textStyles: byId('tTextStyles'),
};

const modal = setupModal({
  backdrop: byId('modalBackdrop'),
  textEl: byId('changelogText'),
  closeBtn: byId('closeModal'),
});

function go(name: keyof typeof screens) {
  showScreen(screens, name as any, actionBar);
}

function updateMeta() {
  const o = collectOptions({
    targetId,
    packageName,
    toggles,
  });

  // Counters
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
  const options = collectOptions({
    targetId,
    packageName,
    toggles,
  });
  postToPlugin({ type: 'export', options });
}

exportBtn.addEventListener('click', startExport);

// Toggles: click + keyboard (Space / Enter)
Object.values(toggles).forEach((el) => {
  el.addEventListener('click', () => {
    toggleDataOn(el);
    updateMeta();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleDataOn(el);
      updateMeta();
    }
  });
});

[targetId, packageName].forEach((el) => {
  el.addEventListener('input', updateMeta);
  el.addEventListener('change', updateMeta);
});

byId<HTMLButtonElement>('reset').addEventListener('click', () => {
  targetId.value = 'flutter';
  packageName.value = 'design_system';
  setToggle(toggles.primitives, true);
  setToggle(toggles.tokens, true);
  setToggle(toggles.colorStyles, true);
  setToggle(toggles.shadows, true);
  setToggle(toggles.textStyles, true);
  updateMeta();
});

byId<HTMLButtonElement>('closeErrors').addEventListener('click', () => {
  postToPlugin({ type: 'cancel' });
  go('home');
});

// Copy buttons for errors / warnings
function wireCopy(btnId: string, source: HTMLElement) {
  const btn = byId<HTMLButtonElement>(btnId);
  btn.addEventListener('click', async () => {
    const text = source.textContent || '';
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
wireCopy('copyErrors', errList);

window.onmessage = (e: MessageEvent) => {
  const msg = (e.data as any)?.pluginMessage as PluginToUiMessage | undefined;
  if (!msg) return;

  exportBtn.disabled = false;

  if (msg.type === 'validation-errors') {
    hideLoading();
    const errs = msg.errors || [];
    errTitle.textContent = `${errs.length} error${errs.length === 1 ? '' : 's'}`;
    errList.textContent = errs.map(formatError).join('\n');
    go('errors');
    return;
  }

  if (msg.type === 'exporting') {
    showLoading('Packing zip…', 'Almost there.');
    return;
  }

  if (msg.type === 'zip-ready') {
    state.lastZip = msg.bytes;
    state.lastFilename = msg.filename || 'design_system.zip';
    state.lastChangelog = msg.changelog || '';
    state.lastDiff = msg.diff || state.lastDiff;
    state.lastSummary = msg.summary || state.lastSummary;
    hideLoading();
    downloadZip();
    // Stay in plugin after download (no "Export complete" screen).
    status.textContent = '';
    go('home');
    return;
  }

  if (msg.type === 'error') {
    hideLoading();
    go('home');
    status.textContent = 'Error: ' + msg.message;
  }
};

updateMeta();
go('home');
