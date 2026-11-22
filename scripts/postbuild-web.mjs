/**
 * Post-processes `expo export --platform web` output for GitHub Pages.
 *
 *  - No COOP/COEP headers needed: expo-sqlite only needs SharedArrayBuffer for its
 *    *synchronous* API, and this app uses the async API exclusively.
 *  - Home-screen app: manifest + Apple meta tags so "Add to Home Screen" opens full-screen.
 *  - SPA fallback: 404.html = index.html so deep links work.
 *  - noindex: keeps the site out of search engines.
 *
 * Usage: node scripts/postbuild-web.mjs <distDir>   (EXPO_BASE_URL=/my-gym for sub-paths)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.argv[2] ?? join(root, 'dist');
const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');

const indexPath = join(dist, 'index.html');
if (!existsSync(indexPath)) throw new Error(`No index.html in ${dist} – run "expo export --platform web" first.`);

// 2) Web app manifest.
const manifest = {
  name: 'My Gym',
  short_name: 'My Gym',
  lang: 'ar',
  dir: 'rtl',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#090D12',
  theme_color: '#090D12',
  icons: [
    { src: `${base}/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png' },
  ],
};
writeFileSync(join(dist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

// 3) Inject tags into index.html.
let html = readFileSync(indexPath, 'utf8');
const head = [
  `<meta name="robots" content="noindex, nofollow">`,
  `<meta name="theme-color" content="#090D12">`,
  `<meta name="apple-mobile-web-app-capable" content="yes">`,
  `<meta name="mobile-web-app-capable" content="yes">`,
  `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`,
  `<meta name="apple-mobile-web-app-title" content="My Gym">`,
  `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">`,
  `<link rel="manifest" href="${base}/manifest.webmanifest">`,
].join('\n    ');

html = html.replace(/<head>/i, `<head>\n    ${head}`);
// viewport-fit=cover → safe-area insets work on iPhone (notch / home indicator).
html = html.replace(
  /<meta name="viewport"[^>]*>/i,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">',
);
html = html.replace(/<html[^>]*>/i, '<html lang="ar">');
html = html.replace(/<title>[^<]*<\/title>/i, '<title>My Gym</title>');

writeFileSync(indexPath, html);
// 4) SPA fallback for deep links on GitHub Pages.
writeFileSync(join(dist, '404.html'), html);
writeFileSync(join(dist, '.nojekyll'), '');

console.log(`postbuild-web: done (base "${base || '/'}")`);
