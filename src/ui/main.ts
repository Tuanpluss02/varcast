import { byId } from './lib/dom';
import { fmtDiff, fmtSummary } from './lib/format';
import type { PluginToUiMessage } from './lib/messages';
import { formatError, formatWarning, postToPlugin } from './lib/messages';
import { setupModal } from './components/modal';
import { showScreen } from './components/screens';
import type { Screens } from './components/screens';
import {
  collectOptions,
  pillText,
  setToggle,
  toggleDataOn,
  isToggleOn,
  type ToggleEls,
} from './components/options';
import { createInitialState } from './state';

const state = createInitialState();

const pillStatusText = byId<HTMLSpanElement>('pillStatusText');
const status = byId<HTMLDivElement>('status');
const exportBtn = byId<HTMLButtonElement>('export');
const actionBar = byId<HTMLElement>('actionBar');

const screens: Screens = {
  home: byId('screen-home'),
  validating: byId('screen-validating'),
  errors: byId('screen-errors'),
  warnings: byId('screen-warnings'),
  ready: byId('screen-ready'),
  exporting: byId('screen-exporting'),
  done: byId('screen-done'),
};

const errTitle = byId<HTMLHeadingElement>('errTitle');
const errList = byId<HTMLPreElement>('errList');
const warnList = byId<HTMLPreElement>('warnList');
const summary = byId<HTMLPreElement>('summary');
const diffSummary = byId<HTMLPreElement>('diffSummary');
const doneSummary = byId<HTMLPreElement>('doneSummary');
const doneFilename = byId<HTMLParagraphElement>('doneFilename');

const packageName = byId<HTMLInputElement>('packageName');
const targetId = byId<HTMLSelectElement>('targetId');
const leafPrefix = byId<HTMLInputElement>('leafPrefix');
const leafSuffix = byId<HTMLInputElement>('leafSuffix');
const namingPreview = byId<HTMLParagraphElement>('namingPreview');
const tokensCount = byId<HTMLSpanElement>('tokensCount');
const compositesCount = byId<HTMLSpanElement>('compositesCount');

const toggles: ToggleEls = {
  primitives: byId('tPrimitives'),
  tokens: byId('tTokens'),
  colorStyles: byId('tColorStyles'),
  shadows: byId('tShadows'),
  textStyles: byId('tTextStyles'),
  smokeTest: byId('tSmokeTest'),
};

const modal = setupModal({
  backdrop: byId('modalBackdrop'),
  textEl: byId('changelogText'),
  closeBtn: byId('closeModal'),
});

function go(name: keyof typeof screens) {
  showScreen(screens, name as any, actionBar);
}

function camel(s: string) {
  return s.replace(/[_\-\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
}
function pascal(s: string) {
  const c = camel(s);
  return c ? c[0].toUpperCase() + c.slice(1) : '';
}

function updateMeta() {
  const o = collectOptions({
    targetId,
    packageName,
    leafPrefix,
    leafSuffix,
    toggles,
  });
  pillStatusText.textContent = pillText(o);

  // Counters
  const tokenOn = [toggles.primitives, toggles.tokens].filter(isToggleOn).length;
  tokensCount.textContent = `${tokenOn} of 2`;
  const compOn = [toggles.colorStyles, toggles.shadows, toggles.textStyles]
    .filter(isToggleOn).length;
  compositesCount.textContent = `${compOn} of 3`;

  // Naming preview: e.g. "primary" → "dsPrimaryToken"
  const prefix = camel(leafPrefix.value.trim());
  const suffix = pascal(leafSuffix.value.trim());
  const example = prefix
    ? prefix + 'Primary' + suffix
    : 'primary' + suffix || 'primary';
  namingPreview.innerHTML = `Preview · <code>primary</code> → <code>${escapeHtml(example)}</code>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

function startExport() {
  exportBtn.disabled = true;
  status.textContent = '';
  go('validating');
  const options = collectOptions({
    targetId,
    packageName,
    leafPrefix,
    leafSuffix,
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

[targetId, packageName, leafPrefix, leafSuffix].forEach((el) => {
  el.addEventListener('input', updateMeta);
  el.addEventListener('change', updateMeta);
});

byId<HTMLButtonElement>('reset').addEventListener('click', () => {
  targetId.value = 'flutter';
  packageName.value = 'design_system';
  leafPrefix.value = '';
  leafSuffix.value = '';
  setToggle(toggles.primitives, true);
  setToggle(toggles.tokens, true);
  setToggle(toggles.colorStyles, true);
  setToggle(toggles.shadows, true);
  setToggle(toggles.textStyles, true);
  setToggle(toggles.smokeTest, true);
  updateMeta();
});

byId<HTMLButtonElement>('closeErrors').addEventListener('click', () => {
  postToPlugin({ type: 'cancel' });
  go('home');
});
byId<HTMLButtonElement>('cancelWarnings').addEventListener('click', () => {
  postToPlugin({ type: 'cancel' });
  go('home');
});
byId<HTMLButtonElement>('continueWarnings').addEventListener('click', () => {
  go('exporting');
  const options = collectOptions({
    targetId,
    packageName,
    leafPrefix,
    leafSuffix,
    toggles,
  });
  postToPlugin({ type: 'continue', options });
});

byId<HTMLButtonElement>('downloadZip').addEventListener('click', () => {
  go('exporting');
  postToPlugin({ type: 'download-zip' });
});
byId<HTMLButtonElement>('downloadZipAgain').addEventListener('click', downloadZip);

byId<HTMLButtonElement>('viewChangelog').addEventListener('click', () => {
  modal.open(state.lastChangelog);
});
byId<HTMLButtonElement>('viewChangelogDone').addEventListener('click', () => {
  modal.open(state.lastChangelog);
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
wireCopy('copyWarnings', warnList);

window.onmessage = (e: MessageEvent) => {
  const msg = (e.data as any)?.pluginMessage as PluginToUiMessage | undefined;
  if (!msg) return;

  exportBtn.disabled = false;

  if (msg.type === 'validation-errors') {
    const errs = msg.errors || [];
    errTitle.textContent = `${errs.length} error${errs.length === 1 ? '' : 's'}`;
    errList.textContent = errs.map(formatError).join('\n');
    go('errors');
    return;
  }

  if (msg.type === 'validation-warnings') {
    const ws = msg.warnings || [];
    warnList.textContent = ws.map(formatWarning).join('\n');
    state.lastDiff = msg.diff || state.lastDiff;
    go('warnings');
    return;
  }

  if (msg.type === 'ready') {
    state.lastDiff = msg.diff || state.lastDiff;
    state.lastSummary = msg.summary || state.lastSummary;
    summary.textContent = fmtSummary(state.lastSummary);
    diffSummary.textContent = fmtDiff(state.lastDiff);
    go('ready');
    return;
  }

  if (msg.type === 'exporting') {
    go('exporting');
    return;
  }

  if (msg.type === 'zip-ready') {
    state.lastZip = msg.bytes;
    state.lastFilename = msg.filename || 'design_system.zip';
    state.lastChangelog = msg.changelog || '';
    state.lastDiff = msg.diff || state.lastDiff;
    state.lastSummary = msg.summary || state.lastSummary;
    doneFilename.textContent = state.lastFilename;
    doneSummary.textContent =
      fmtSummary(state.lastSummary) + '\n\n' + fmtDiff(state.lastDiff);
    go('done');
    downloadZip();
    return;
  }

  if (msg.type === 'error') {
    go('home');
    status.textContent = 'Error: ' + msg.message;
  }
};

updateMeta();
go('home');
