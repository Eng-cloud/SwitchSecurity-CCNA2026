/**
 * يبني نسخة الملف الواحد ثم يدمج CSS وJS داخل صفحة واحدة مكتفية بذاتها.
 *
 * المخرج جزء صفحة (بلا html/head/body) لأن منصة النشر تغلّفه بنفسها،
 * ويضبط الاتجاه واللغة والمظهر قبل إقلاع React لمنع وميض المظهر.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist-single');
const assetsDir = join(distDir, 'assets');
const outFile = join(distDir, 'halaqat-app.html');

const files = await readdir(assetsDir);
const jsFile = files.find((name) => name.endsWith('.js'));
const cssFile = files.find((name) => name.endsWith('.css'));

if (!jsFile) throw new Error('لم يُعثر على حزمة JS في dist-single/assets');

const js = await readFile(join(assetsDir, jsFile), 'utf8');
const css = cssFile ? await readFile(join(assetsDir, cssFile), 'utf8') : '';

// منع إغلاق وسم السكربت مبكرًا لو ورد النص داخل سلسلة.
// ثم تحويل كل حرف غير ASCII إلى \uXXXX حتى لا تعتمد الحزمة على ترميز المستند:
// أي مضيف يقدّم الصفحة بترميز مختلف كان يفسد النصوص العربية والتعابير النمطية.
const safeJs = js
  .replaceAll('</script', '<\\/script')
  .replace(/[^\x00-\x7F]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);

const bootstrap = `
(function () {
  var root = document.documentElement;
  root.setAttribute('lang', 'ar');
  root.setAttribute('dir', 'rtl');
  try {
    var raw = localStorage.getItem('halaqat.theme');
    var mode = raw ? JSON.parse(raw) : 'system';
    if (mode !== 'light' && mode !== 'dark' && mode !== 'system') mode = 'system';
    var resolved = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    root.setAttribute('data-theme', resolved);
    var a11yRaw = localStorage.getItem('halaqat.a11y');
    if (a11yRaw) {
      var a = JSON.parse(a11yRaw) || {};
      if (a.fontScale) root.setAttribute('data-font-scale', a.fontScale);
      if (a.contrast) root.setAttribute('data-contrast', a.contrast);
      if (a.motion) root.setAttribute('data-motion', a.motion);
    }
  } catch (e) {
    root.setAttribute('data-theme', 'light');
  }
})();
`.trim();

const html = `<meta charset="utf-8" />
<title>منصة الحلقات</title>
<meta name="description" content="منصة تعليمية لتحفيظ القرآن الكريم ومتابعة الحلقات — نسخة تجريبية تعمل ببيانات وهمية." />
<meta name="color-scheme" content="light dark" />
<script>${bootstrap}</script>
<style>${css}</style>
<div id="root"></div>
<script type="module">${safeJs}</script>
`;

await mkdir(distDir, { recursive: true });
await writeFile(outFile, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
console.log(`✓ ${outFile} (${kb} KB)`);
