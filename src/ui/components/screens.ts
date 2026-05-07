export type ScreenName =
  | 'home'
  | 'review'
  | 'errors';

export type Screens = Record<ScreenName, HTMLElement>;

export function showScreen(
  screens: Screens,
  name: ScreenName,
  actionBar?: HTMLElement,
) {
  Object.values(screens).forEach((el) => el.classList.add('hidden'));
  screens[name].classList.remove('hidden');

  if (actionBar) {
    const groups = actionBar.querySelectorAll<HTMLElement>('[data-screen]');
    groups.forEach((g) => {
      const matches = g.dataset.screen === name;
      g.classList.toggle('hidden', !matches);
    });
  }
}
