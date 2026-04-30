import { byId } from './lib/dom';
import { fmtDiff, fmtSummary } from './lib/format';
import type { PluginToUiMessage } from './lib/messages';
import { postToPlugin } from './lib/messages';
import { setupModal } from './components/modal';
import { showScreen } from './components/screens';
import type { Screens } from './components/screens';
import {
  collectOptions,
  pillText,
  setToggle,
  toggleDataOn,
  type ToggleEls,
} from './components/options';
import { createInitialState } from './state';

const state = createInitialState();

const pillStatus = byId<HTMLDivElement>('pillStatus');
const status = byId<HTMLDivElement>('status');
const btn = byId<HTMLButtonElement>('export');
const regenBtn = byId<HTMLButtonElement>('regen');

const screens: Screens = {
  home: byId('screen-home'),
  validating: byId('screen-validating'),
  errors: byId('screen-errors'),
  warnings: byId('screen-warnings'),
  ready: byId('screen-ready'),
  exporting: byId('screen-exporting'),
  done: byId('screen-done'),
};

const errTitle = byId<HTMLDivElement>('errTitle');
const errList = byId<HTMLDivElement>('errList');
const warnList = byId<HTMLDivElement>('warnList');
const summary = byId<HTMLDivElement>('summary');
const diffSummary = byId<HTMLDivElement>('diffSummary');
const doneSummary = byId<HTMLDivElement>('doneSummary');

const packageName = byId<HTMLInputElement>('packageName');
const leafPrefix = byId<HTMLInputElement>('leafPrefix');
const leafSuffix = byId<HTMLInputElement>('leafSuffix');

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

function updatePill() {
  const o = collectOptions({ packageName, leafPrefix, leafSuffix, toggles });
  pillStatus.textContent = pillText(o);
}

function downloadZip() {
  if (!state.lastZip) return;
  const bytes = state.lastZip instanceof Uint8Array ? state.lastZip : new Uint8Array(state.lastZip as any);
  const blob = new Blob([bytes.buffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = state.lastFilename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function startExport() {
  btn.disabled = true;
  regenBtn.disabled = true;
  status.textContent = '';
  showScreen(screens, 'validating');
  const options = collectOptions({ packageName, leafPrefix, leafSuffix, toggles });
  postToPlugin({ type: 'export', options });
}

btn.addEventListener('click', startExport);
regenBtn.addEventListener('click', startExport);

Object.values(toggles).forEach((el) => {
  el.addEventListener('click', () => {
    toggleDataOn(el);
    updatePill();
  });
});

byId<HTMLButtonElement>('reset').addEventListener('click', () => {
  packageName.value = 'design_system';
  leafPrefix.value = '';
  leafSuffix.value = '';
  setToggle(toggles.primitives, true);
  setToggle(toggles.tokens, true);
  setToggle(toggles.colorStyles, true);
  setToggle(toggles.shadows, true);
  setToggle(toggles.textStyles, true);
  setToggle(toggles.smokeTest, true);
  updatePill();
});

byId<HTMLButtonElement>('closeErrors').addEventListener('click', () => {
  postToPlugin({ type: 'cancel' });
});
byId<HTMLButtonElement>('cancelWarnings').addEventListener('click', () => {
  postToPlugin({ type: 'cancel' });
});
byId<HTMLButtonElement>('continueWarnings').addEventListener('click', () => {
  showScreen(screens, 'ready');
  postToPlugin({ type: 'continue' });
});

byId<HTMLButtonElement>('downloadZip').addEventListener('click', () => {
  showScreen(screens, 'exporting');
  postToPlugin({ type: 'download-zip' });
});
byId<HTMLButtonElement>('downloadZipAgain').addEventListener('click', downloadZip);

byId<HTMLButtonElement>('viewChangelog').addEventListener('click', () => {
  modal.open(state.lastChangelog);
});
byId<HTMLButtonElement>('viewChangelogDone').addEventListener('click', () => {
  modal.open(state.lastChangelog);
});

window.onmessage = (e: MessageEvent) => {
  const msg = (e.data as any)?.pluginMessage as PluginToUiMessage | undefined;
  if (!msg) return;

  btn.disabled = false;
  regenBtn.disabled = false;

  if (msg.type === 'validation-errors') {
    const errs = msg.errors || [];
    errTitle.textContent = `✗ ${errs.length} errors — fix in Figma before exporting`;
    errList.textContent = errs
      .map((er) => `${er.type}: ${(er.path || []).join(' → ')}`)
      .join('\n');
    showScreen(screens, 'errors');
    return;
  }

  if (msg.type === 'validation-warnings') {
    const ws = msg.warnings || [];
    warnList.textContent = ws
      .map((w) => `${w.type}: ${(w.path || []).join(' → ')}`)
      .join('\n');
    state.lastDiff = msg.diff || state.lastDiff;
    showScreen(screens, 'warnings');
    return;
  }

  if (msg.type === 'ready') {
    state.lastDiff = msg.diff || state.lastDiff;
    state.lastSummary = msg.summary || state.lastSummary;
    summary.textContent = fmtSummary(state.lastSummary);
    diffSummary.textContent = fmtDiff(state.lastDiff);
    showScreen(screens, 'ready');
    return;
  }

  if (msg.type === 'exporting') {
    showScreen(screens, 'exporting');
    return;
  }

  if (msg.type === 'zip-ready') {
    state.lastZip = msg.bytes;
    state.lastFilename = msg.filename || 'design_system.zip';
    state.lastChangelog = msg.changelog || '';
    state.lastDiff = msg.diff || state.lastDiff;
    state.lastSummary = msg.summary || state.lastSummary;
    doneSummary.textContent =
      fmtSummary(state.lastSummary) + '\n\n' + fmtDiff(state.lastDiff);
    showScreen(screens, 'done');
    downloadZip();
    return;
  }

  if (msg.type === 'error') {
    showScreen(screens, 'home');
    status.textContent = 'Error: ' + msg.message;
  }
};

updatePill();
showScreen(screens, 'home');

