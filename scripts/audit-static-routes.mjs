import fs from 'node:fs';
import path from 'node:path';

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const appDirectory = path.join('src', 'app');
const routes = walk(appDirectory)
  .filter((file) => file.endsWith(`${path.sep}page.tsx`))
  .map((file) => {
    const relative = path.relative(appDirectory, path.dirname(file)).replaceAll('\\', '/');
    const route = relative
      .split('/')
      .filter((segment) => segment && !(segment.startsWith('(') && segment.endsWith(')')))
      .join('/');
    return `/${route}`.replace(/\/$/, '') || '/';
  });

function routePattern(route) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\\\[[^/]+\\\]/g, '[^/]+')}$`);
}

const routePatterns = routes.map(routePattern);
const sourceFiles = walk('src').filter((file) => /\.(?:ts|tsx)$/.test(file));
const unmatched = [];
let checkedLinks = 0;

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/href\s*=\s*["'](\/[A-Za-z0-9_?=&.\-/]+)["']/g)) {
    checkedLinks += 1;
    const href = match[1];
    const pathname = href.split('?')[0];
    if (pathname.startsWith('/api/')) continue;
    if (!routePatterns.some((pattern) => pattern.test(pathname))) {
      unmatched.push({ file: file.replaceAll('\\', '/'), href });
    }
  }
}

const uniqueUnmatched = [...new Map(unmatched.map((row) => [`${row.file}|${row.href}`, row])).values()];
console.log(JSON.stringify({ routeCount: routes.length, checkedLinks, unmatched: uniqueUnmatched }, null, 2));
process.exitCode = uniqueUnmatched.length > 0 ? 1 : 0;
