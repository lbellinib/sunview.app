import { promises as fs } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

const tokensPath = path.join(src, 'tokens.json');
const tokens = JSON.parse(await fs.readFile(tokensPath, 'utf8'));

await fs.mkdir(dist, { recursive: true });

const cssLines = [':root {'];

const toKebab = (value) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();

const addVar = (name, value) => {
  cssLines.push(`  --${toKebab(name)}: ${value};`);
};

addVar('font-display-size', tokens.typography.display.size);
addVar('font-display-line', tokens.typography.display.lineHeight);
addVar('font-display-weight', tokens.typography.display.weight);
addVar('font-title-size', tokens.typography.title.size);
addVar('font-title-line', tokens.typography.title.lineHeight);
addVar('font-title-weight', tokens.typography.title.weight);
addVar('font-body-size', tokens.typography.body.size);
addVar('font-body-line', tokens.typography.body.lineHeight);
addVar('font-body-weight', tokens.typography.body.weight);

Object.entries(tokens.spacing).forEach(([key, value]) => addVar(`space-${key}`, value));
Object.entries(tokens.radii).forEach(([key, value]) => addVar(`radius-${key}`, value));
Object.entries(tokens.motion).forEach(([key, value]) => addVar(`motion-${key}`, value));

cssLines.push('}');

Object.entries(tokens.colorSchemes).forEach(([scheme, values]) => {
  cssLines.push(`:root[data-theme="${toKebab(scheme)}"] {`);
  Object.entries(values).forEach(([key, value]) => addVar(`color-${key}`, value));
  cssLines.push('}');
});

cssLines.push('');

await fs.writeFile(path.join(dist, 'tokens.css'), cssLines.join('\n'));

const jsContent = `export const tokens = ${JSON.stringify(tokens, null, 2)};\n`;
await fs.writeFile(path.join(dist, 'tokens.js'), jsContent);

console.log('Design tokens built.');
