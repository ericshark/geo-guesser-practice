// Downloads the photos listed in scripts/media-manifest.json from Wikimedia Commons into
// public/media/ (960px wide JPEG) and writes src/content/mediaCredits.json with the author,
// licence and source page for each, which the app shows on its Credits page.
//
// Usage: node scripts/fetch-media.mjs [--force]
// Only freely licensed files (CC BY, CC BY-SA, CC0, public domain) are accepted.
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'scripts/media-manifest.json'), 'utf-8'));
const outDir = path.join(root, 'public/media');
const creditsPath = path.join(root, 'src/content/mediaCredits.json');
const force = process.argv.includes('--force');
const UA = 'geoguessr-academy-media-fetch/1.0 (educational app; local script)';
const ALLOWED = /^(CC BY(-SA)? \d\.\d|CC0|Public domain)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (s = '') => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

async function getJson(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.status === 429) {
      await sleep(4000 * (attempt + 1));
      continue;
    }
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }
  throw new Error(`rate limited: ${url}`);
}

await fs.mkdir(outDir, { recursive: true });
let existing = {};
try {
  existing = JSON.parse(await fs.readFile(creditsPath, 'utf-8'));
} catch {
  // first run
}
const credits = { ...existing };

for (const item of manifest) {
  const target = path.join(outDir, `${item.id}.jpg`);
  const have = await fs.access(target).then(() => true, () => false);
  if (have && credits[item.id] && !force) continue;

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: `File:${item.file}`,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '960',
  });
  const data = await getJson(`https://commons.wikimedia.org/w/api.php?${params}`);
  const page = Object.values(data.query.pages)[0];
  const info = page.imageinfo?.[0];
  if (!info) throw new Error(`Not found on Commons: ${item.file}`);
  const meta = info.extmetadata ?? {};
  const licence = stripHtml(meta.LicenseShortName?.value);
  if (!ALLOWED.test(licence)) throw new Error(`Licence not allowed for ${item.file}: ${licence}`);

  await sleep(1500);
  const img = await fetch(info.thumburl, { headers: { 'User-Agent': UA } });
  if (!img.ok) throw new Error(`Download failed ${img.status}: ${info.thumburl}`);
  await fs.writeFile(target, Buffer.from(await img.arrayBuffer()));

  credits[item.id] = {
    title: item.file,
    author: stripHtml(meta.Artist?.value) || 'Unknown',
    licence,
    licenceUrl: stripHtml(meta.LicenseUrl?.value) || undefined,
    source: info.descriptionurl,
  };
  console.log('saved', item.id, '|', licence);
  await sleep(1500);
}

await fs.writeFile(creditsPath, JSON.stringify(credits, null, 2) + '\n');
console.log('credits written for', Object.keys(credits).length, 'images');
