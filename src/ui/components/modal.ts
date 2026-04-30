export type ModalApi = {
  open: (text: string) => void;
  close: () => void;
};

export function setupModal(opts: {
  backdrop: HTMLElement;
  textEl: HTMLElement;
  closeBtn: HTMLElement;
}): ModalApi {
  const { backdrop, textEl, closeBtn } = opts;

  function open(text: string) {
    textEl.textContent = text || 'No changelog yet.';
    (backdrop as HTMLElement).style.display = 'flex';
  }

  function close() {
    (backdrop as HTMLElement).style.display = 'none';
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  return { open, close };
}

