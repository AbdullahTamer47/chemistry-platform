export function openChemistryLabModal() {
  if (typeof window.navigateTo === 'function') {
    window.navigateTo('/lab');
  } else {
    window.history.pushState(null, '', '/lab');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}
