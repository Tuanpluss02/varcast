import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TargetController, FALLBACK_TARGETS } from '../../ui/controllers/target_controller';
import { ExportController } from '../../ui/controllers/export_controller';
import {
  ReviewController,
  fmtSize,
  pickInitialFile,
  buildTree,
} from '../../ui/controllers/review_controller';
import type { TargetMetadataItem, ValidationErrorMsg, PreviewFile } from '../../ui/lib/messages';

function createMockElement(tag = 'div') {
  const listeners: Record<string, Function[]> = {};
  const attributes: Record<string, string> = {};
  const classListSet = new Set<string>();
  const children: any[] = [];
  let _innerHTML = '';

  const el: any = {
    tagName: tag.toUpperCase(),
    value: '',
    placeholder: '',
    textContent: '',
    style: {},
    disabled: false,
    dataset: {},
    children,
    attributes,
    get innerHTML() {
      return _innerHTML;
    },
    set innerHTML(val: string) {
      _innerHTML = val;
      if (val === '') {
        children.length = 0;
      }
    },
    classList: {
      add: (c: string) => classListSet.add(c),
      remove: (c: string) => classListSet.delete(c),
      contains: (c: string) => classListSet.has(c),
      toggle: (c: string, force?: boolean) => {
        if (force !== undefined) {
          if (force) classListSet.add(c);
          else classListSet.delete(c);
        } else {
          if (classListSet.has(c)) classListSet.delete(c);
          else classListSet.add(c);
        }
      },
    },
    setAttribute: (k: string, v: string) => {
      attributes[k] = v;
    },
    getAttribute: (k: string) => attributes[k] ?? null,
    addEventListener: (type: string, fn: Function) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    dispatchEvent: (type: string, eventObj: any = {}) => {
      (listeners[type] || []).forEach((fn) => fn(eventObj));
    },
    appendChild: (child: any) => {
      children.push(child);
      return child;
    },
    querySelectorAll: (selector: string) => {
      const results: any[] = [];
      function walk(node: any) {
        for (const ch of node.children || []) {
          if (selector.startsWith('.') && ch.classList?.contains(selector.slice(1))) {
            results.push(ch);
          }
          walk(ch);
        }
      }
      walk(el);
      return results;
    },
  };
  return el;
}

// Ensure global document exists for controller DOM operations
if (typeof globalThis.document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => createMockElement(tag),
  };
}

describe('TargetController', () => {
  let targetSelect: any;
  let packageNameInput: any;

  beforeEach(() => {
    targetSelect = createMockElement('select');
    packageNameInput = createMockElement('input');
    packageNameInput.placeholder = 'design_system';
  });

  it('initializes with fallback targets and updates placeholder', () => {
    const ctrl = new TargetController({
      targetSelect,
      packageNameInput,
    });

    expect(ctrl.getAllTargets()).toEqual(FALLBACK_TARGETS);
    expect(targetSelect.children.length).toBe(3);
    expect(targetSelect.children[0].value).toBe('flutter');
    expect(targetSelect.children[1].value).toBe('react_native');
    expect(targetSelect.children[2].value).toBe('compose');
  });

  it('populates available targets dynamically from TargetMetadataItem[]', () => {
    const ctrl = new TargetController({
      targetSelect,
      packageNameInput,
    });

    const customTargets: TargetMetadataItem[] = [
      { id: 'swift_ui', displayName: 'SwiftUI', defaultPackageName: 'DesignTokens' },
      { id: 'compose', displayName: 'Jetpack Compose', defaultPackageName: 'com.tokens' },
    ];

    ctrl.setAvailableTargets(customTargets);

    expect(ctrl.getAllTargets()).toEqual(customTargets);
    expect(targetSelect.children.length).toBe(2);
    expect(targetSelect.children[0].value).toBe('swift_ui');
    expect(targetSelect.children[0].textContent).toBe('SwiftUI');
    expect(targetSelect.children[1].value).toBe('compose');
    expect(targetSelect.children[1].textContent).toBe('Jetpack Compose');
  });

  it('updates package name placeholder on target change', () => {
    const ctrl = new TargetController({
      targetSelect,
      packageNameInput,
    });

    const targets: TargetMetadataItem[] = [
      { id: 'flutter', displayName: 'Flutter', defaultPackageName: 'my_flutter_lib' },
      { id: 'react_native', displayName: 'React Native', defaultPackageName: 'my-rn-pkg' },
    ];
    ctrl.setAvailableTargets(targets);

    targetSelect.value = 'react_native';
    targetSelect.dispatchEvent('change');

    expect(packageNameInput.placeholder).toBe('my-rn-pkg');
    expect(ctrl.getSelectedTargetId()).toBe('react_native');
    expect(ctrl.getSelectedTarget()?.displayName).toBe('React Native');
  });

  it('resets target and package name input to defaults', () => {
    const ctrl = new TargetController({
      targetSelect,
      packageNameInput,
    });

    targetSelect.value = 'react_native';
    packageNameInput.value = 'custom_pkg';

    ctrl.reset('flutter');

    expect(targetSelect.value).toBe('flutter');
    expect(packageNameInput.value).toBe('design_system');
    expect(packageNameInput.placeholder).toBe('design_system');
  });

  it('falls back to first target when current selection is not in targets', () => {
    const ctrl = new TargetController({
      targetSelect,
      packageNameInput,
    });

    targetSelect.value = 'non_existent';
    ctrl.setAvailableTargets([
      { id: 'custom_a', displayName: 'Custom A', defaultPackageName: 'pkg_a' },
      { id: 'custom_b', displayName: 'Custom B', defaultPackageName: 'pkg_b' },
    ]);

    expect(targetSelect.value).toBe('custom_a');
    expect(packageNameInput.placeholder).toBe('pkg_a');
  });
});

describe('ExportController', () => {
  let exportBtn: any;
  let loadingOverlay: any;
  let loadingTitle: any;
  let loadingSub: any;
  let statusEl: any;
  let downloadZipBtn: any;
  let errTitle: any;
  let errList: any;

  beforeEach(() => {
    exportBtn = createMockElement('button');
    loadingOverlay = createMockElement('div');
    loadingTitle = createMockElement('div');
    loadingSub = createMockElement('div');
    statusEl = createMockElement('div');
    downloadZipBtn = createMockElement('button');
    errTitle = createMockElement('h2');
    errList = createMockElement('pre');
  });

  it('starts export, shows loading overlay and posts message', () => {
    const postMessage = vi.fn();
    const getExportOptions = vi.fn().mockReturnValue({ targetId: 'flutter', packageName: 'test' });

    const ctrl = new ExportController({
      elements: {
        exportBtn,
        loadingOverlay,
        loadingTitle,
        loadingSub,
        statusEl,
        downloadZipBtn,
        errTitle,
        errList,
      },
      postMessage,
      getExportOptions,
    });

    ctrl.startExport();

    expect(exportBtn.disabled).toBe(true);
    expect(loadingTitle.textContent).toBe('Validating…');
    expect(loadingOverlay.classList.contains('is-open')).toBe(true);
    expect(loadingOverlay.getAttribute('aria-hidden')).toBe('false');
    expect(postMessage).toHaveBeenCalledWith({
      type: 'export',
      options: { targetId: 'flutter', packageName: 'test' },
    });
  });

  it('handles validation errors and navigates to errors screen', () => {
    const navigateTo = vi.fn();
    const ctrl = new ExportController({
      elements: {
        exportBtn,
        loadingOverlay,
        loadingTitle,
        loadingSub,
        statusEl,
        downloadZipBtn,
        errTitle,
        errList,
      },
      navigateTo,
    });

    ctrl.showLoading('Validating…', 'Test');
    const errors: ValidationErrorMsg[] = [
      { type: 'CYCLE', path: ['tokenA', 'tokenB', 'tokenA'] },
    ];

    ctrl.handleValidationErrors(errors);

    expect(loadingOverlay.classList.contains('is-open')).toBe(false);
    expect(exportBtn.disabled).toBe(false);
    expect(errTitle.textContent).toBe('1 error');
    expect(errList.textContent).toContain('CYCLE: tokenA → tokenB → tokenA');
    expect(navigateTo).toHaveBeenCalledWith('errors');
  });

  it('handles general error messages and resets buttons', () => {
    const ctrl = new ExportController({
      elements: {
        exportBtn,
        loadingOverlay,
        loadingTitle,
        loadingSub,
        statusEl,
        downloadZipBtn,
        errTitle,
        errList,
      },
    });

    ctrl.showLoading('Working', 'Wait');
    exportBtn.disabled = true;
    downloadZipBtn.disabled = true;

    ctrl.handleError('Network failed');

    expect(loadingOverlay.classList.contains('is-open')).toBe(false);
    expect(exportBtn.disabled).toBe(false);
    expect(downloadZipBtn.disabled).toBe(false);
    expect(statusEl.textContent).toBe('Error: Network failed');
  });

  it('handles download zip dispatch', () => {
    const postMessage = vi.fn();
    const ctrl = new ExportController({
      elements: {
        exportBtn,
        loadingOverlay,
        loadingTitle,
        loadingSub,
        statusEl,
        downloadZipBtn,
        errTitle,
        errList,
      },
      postMessage,
    });

    ctrl.startDownloadZip();

    expect(downloadZipBtn.disabled).toBe(true);
    expect(loadingTitle.textContent).toBe('Packing zip…');
    expect(postMessage).toHaveBeenCalledWith({ type: 'download-zip' });
  });

  it('triggers download with proper blob and filename', () => {
    const ctrl = new ExportController({
      elements: {
        exportBtn,
        loadingOverlay,
        loadingTitle,
        loadingSub,
      },
    });

    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    (globalThis as any).URL = { createObjectURL, revokeObjectURL };

    let clickCalled = false;
    let downloadedName = '';
    const origCreateElement = (globalThis as any).document.createElement;
    (globalThis as any).document.createElement = (tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        el.click = () => {
          clickCalled = true;
          downloadedName = el.download;
        };
      }
      return el;
    };

    const bytes = new Uint8Array([1, 2, 3]);
    ctrl.triggerDownload(bytes, 'output.zip');

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickCalled).toBe(true);
    expect(downloadedName).toBe('output.zip');

    (globalThis as any).document.createElement = origCreateElement;
  });
});

describe('ReviewController helpers', () => {
  it('fmtSize formats bytes correctly', () => {
    expect(fmtSize(500)).toBe('500 B');
    expect(fmtSize(2048)).toBe('2.0 kB');
    expect(fmtSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });

  it('pickInitialFile picks primary entrypoints first', () => {
    const files1: PreviewFile[] = [
      { path: 'assets/icon.png', contents: '', size: 10 },
      { path: 'lib/tokens.dart', contents: '', size: 20 },
    ];
    expect(pickInitialFile(files1)).toBe('lib/tokens.dart');

    const files2: PreviewFile[] = [
      { path: 'src/index.ts', contents: '', size: 30 },
      { path: 'package.json', contents: '', size: 40 },
    ];
    expect(pickInitialFile(files2)).toBe('src/index.ts');

    const files3: PreviewFile[] = [
      { path: 'misc/file.txt', contents: '', size: 5 },
    ];
    expect(pickInitialFile(files3)).toBe('misc/file.txt');

    expect(pickInitialFile([])).toBeNull();
  });

  it('buildTree creates recursive file hierarchy', () => {
    const files: PreviewFile[] = [
      { path: 'lib/src/colors.dart', contents: 'color', size: 10 },
      { path: 'lib/tokens.dart', contents: 'tokens', size: 20 },
      { path: 'pubspec.yaml', contents: 'name', size: 15 },
    ];

    const tree = buildTree(files);
    expect(tree.children?.has('lib')).toBe(true);
    expect(tree.children?.has('pubspec.yaml')).toBe(true);

    const lib = tree.children?.get('lib');
    expect(lib?.type).toBe('dir');
    expect(lib?.children?.has('tokens.dart')).toBe(true);
    expect(lib?.children?.get('tokens.dart')?.type).toBe('file');
    expect(lib?.children?.has('src')).toBe(true);
    expect(lib?.children?.get('src')?.children?.has('colors.dart')).toBe(true);
  });
});

describe('ReviewController', () => {
  it('renders diff bar and summary', () => {
    const diffBar = createMockElement('div');
    const fileTree = createMockElement('div');
    const reviewSummary = createMockElement('span');
    const codeTitle = createMockElement('h2');
    const codeViewer = createMockElement('pre');
    const copyCodeBtn = createMockElement('button');

    const ctrl = new ReviewController({
      elements: {
        diffBar,
        fileTree,
        reviewSummary,
        codeTitle,
        codeViewer,
        copyCodeBtn,
      },
    });

    const files: PreviewFile[] = [
      { path: 'lib/tokens.dart', contents: '// Tokens', size: 1024 },
    ];

    ctrl.renderReview(
      files,
      { added: 3, removed: 1, renamed: 0 },
      { fileCount: 1, totalBytes: 1024 },
    );

    expect(diffBar.innerHTML).toContain('+3 added');
    expect(diffBar.innerHTML).toContain('−1 removed');
    expect(reviewSummary.textContent).toBe('1 files · 1.0 kB');
    expect(ctrl.getSelectedPath()).toBe('lib/tokens.dart');
    expect(codeTitle.textContent).toBe('lib/tokens.dart');
  });

  it('renders neutral chip when diff has no changes', () => {
    const diffBar = createMockElement('div');
    const fileTree = createMockElement('div');
    const reviewSummary = createMockElement('span');
    const codeTitle = createMockElement('h2');
    const codeViewer = createMockElement('pre');
    const copyCodeBtn = createMockElement('button');

    const ctrl = new ReviewController({
      elements: {
        diffBar,
        fileTree,
        reviewSummary,
        codeTitle,
        codeViewer,
        copyCodeBtn,
      },
    });

    ctrl.renderDiffBar({ added: 0, removed: 0, renamed: 0 });
    expect(diffBar.innerHTML).toContain('No changes since last export');
  });
});
