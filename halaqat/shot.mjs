import { chromium } from '@playwright/test';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
const p = await ctx.newPage();
const shots = [
  ['admin', '/app/admin/teachers', 'admin-teachers'],
  ['parent', '/app/parent/requests', 'parent-requests'],
  ['supervisor', '/app/supervisor/requests', 'supervisor-requests'],
  ['student', '/app/student/goals', 'student-goals'],
];
for (const [role, path, name] of shots) {
  await p.goto('http://127.0.0.1:4173/demo');
  await p.getByTestId(`demo-login-${role}`).click();
  await p.waitForURL(new RegExp(`/app/${role}`));
  await p.goto('http://127.0.0.1:4173' + path);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `/tmp/new-${name}.png`, fullPage: false });
  await p.evaluate(() => localStorage.removeItem('halaqat.session'));
}
await b.close();
console.log('done');
