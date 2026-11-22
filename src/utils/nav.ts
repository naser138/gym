/**
 * Safe navigation helpers. On the web a screen can be opened directly (refresh,
 * bookmark, home-screen app) with no history behind it – then "back" goes home.
 */
import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

export function goBack(router: Router) {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Close a multi-screen flow (e.g. add food → amount) and land on `href`.
 * dismissTo pops back to that screen if it is in the history, otherwise replaces.
 */
export function closeFlow(router: Router, href: '/' | '/nutrition' = '/nutrition') {
  router.dismissTo(href);
}
