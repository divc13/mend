const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const outFile = path.join(projectRoot, 'src', 'asset-manifest.json');

const IGNORED = new Set(['.DS_Store', 'Thumbs.db', '.raw']);

function walk(dir, prefix = '') {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (IGNORED.has(entry.name) || entry.name.startsWith('.')) {
      continue;
    }
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolute, relative));
    } else if (entry.isFile()) {
      files.push(relative.replaceAll(path.sep, '/'));
    }
  }
  return files;
}

function syncAssets() {
  const files = walk(publicDir).sort((a, b) => a.localeCompare(b));
  const next = `${JSON.stringify({ files }, null, 2)}\n`;
  const previous = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
  if (next !== previous) {
    fs.writeFileSync(outFile, next);
  }
  return files;
}

module.exports = { syncAssets };

if (require.main === module) {
  const files = syncAssets();
  console.log(`[mend-ad] asset manifest: ${files.length} file(s)`);
}
