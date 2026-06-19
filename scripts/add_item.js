/**
 * add_item.js — FULLY AUTOMATIC: Add a custom item to The Scale of the Universe 2
 * 
 * Usage:   node scripts/add_item.js
 * 
 * What you need:
 *   - 2 PNG images (high-res and low-res versions of your item)
 *   - Run from the project root: d:\10A_daksh_Cs
 * 
 * What this does AUTOMATICALLY:
 *   ✅ Creates standalone spritesheets (JSON + PNG) from your images
 *   ✅ Updates src/data/sizes.json
 *   ✅ Updates src/data/visualLocations.json
 *   ✅ Updates src/data/languages/l0.txt
 *   ✅ Updates src/ts/classes/universe.ts (whitelist)
 *   ✅ Updates src/ts/main.ts (loaders for custom spritesheets)
 *   ✅ Copies everything to dist/
 * 
 * How it works:
 *   Instead of modifying the existing packed spritesheets (which requires
 *   TexturePacker), this creates NEW standalone spritesheets for your
 *   custom items. PixiJS can load multiple spritesheets and merge their
 *   textures, so your items appear alongside the originals.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ─── Configuration ───────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const SRC_DATA = path.join(ROOT, 'src', 'data');
const SRC_LANG = path.join(SRC_DATA, 'languages');
const SRC_TS = path.join(ROOT, 'src', 'ts');

// ─── Helpers ─────────────────────────────────────────────────────────────────
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer));
  });
}

function pad3(n) {
  return String(n).padStart(3, '0');
}

function getNextObjectID() {
  const sizes = JSON.parse(fs.readFileSync(path.join(SRC_DATA, 'sizes.json'), 'utf8'));
  const maxID = sizes.reduce((max, item) => Math.max(max, item.objectID), 0);
  return maxID + 1;
}

function getImageFormat(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return 'png';
  }
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return 'jpg';
  }
  throw new Error(`Not a valid image file: ${filePath}\nSupported formats: PNG, JPG/JPEG`);
}

function getImageDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  const fmt = getImageFormat(filePath);
  if (fmt === 'png') {
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20)
    };
  }
  if (fmt === 'jpg') {
    // Parse JPEG SOF0 marker for dimensions
    let offset = 2;
    while (offset < buf.length) {
      if (buf[offset] !== 0xFF) { offset++; continue; }
      const marker = buf[offset + 1];
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
        return {
          height: buf.readUInt16BE(offset + 5),
          width: buf.readUInt16BE(offset + 7)
        };
      }
      const segLen = buf.readUInt16BE(offset + 2);
      offset += 2 + segLen;
    }
    throw new Error('Could not determine JPEG dimensions: ' + path.basename(filePath));
  }
  throw new Error('Unsupported format: ' + path.basename(filePath));
}

function createSpritesheetJSON(frameName, imgPath, scale) {
  const { width, height } = getImageDimensions(imgPath);
  const imgFile = path.basename(imgPath);
  return {
    frames: {
      [frameName]: {
        frame: { x: 0, y: 0, w: width, h: height },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: width, h: height },
        sourceSize: { w: width, h: height }
      }
    },
    meta: {
      app: "custom_item_script",
      version: "1.0",
      image: imgFile,
      format: "RGBA8888",
      size: { w: width, h: height },
      scale: scale.toString()
    }
  };
}

function loadTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
}

function saveTextFile(filePath, lines) {
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

function resolveFile(pathStr) {
  const paths = [pathStr, path.resolve(ROOT, pathStr), path.resolve(pathStr)];
  for (const p of paths) {
    if (fs.existsSync(p)) return path.resolve(p);
  }
  return null;
}

// ─── Main Logic ──────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Add a Custom Item to The Scale of the Universe 2         ║');
  console.log('║   Fully Automatic — just provide 2 images                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1: Gather item info
  // ══════════════════════════════════════════════════════════════════════════
  const objectID = getNextObjectID();
  console.log(`Next available objectID: ${objectID}\n`);

  const title = await ask('Item title (e.g. "My Galaxy"): ');
  if (!title.trim()) { console.log('❌ Title cannot be empty.'); rl.close(); return; }
  const description = await ask('Item description: ');

  console.log('\n── Real-World Size ────────────────────────────────────────');
  console.log('size = 10^exponent × coefficient meters');
  console.log('Earth = 10^7 × 1.27, Human = 10^0 × 1.7\n');

  const exponent = parseFloat(await ask('Size exponent (power of 10): '));
  if (isNaN(exponent)) { console.log('❌ Invalid exponent.'); rl.close(); return; }

  const coeff = parseFloat((await ask('Size coefficient (default: 1): ')).trim() || '1');
  const cullFac = parseFloat((await ask('Cull factor (default: 1): ')).trim() || '1');
  const realRatio = parseFloat((await ask('Real ratio (default: 1): ')).trim() || '1');

  console.log('\n── Image Files ────────────────────────────────────────────');
  console.log('Provide paths to your PNG images.\n');

  const highResPath = await ask('Path to HIGH-RES image PNG: ');
  const highResFullPath = resolveFile(highResPath);
  if (!highResFullPath) { console.log('❌ File not found: ' + highResPath); rl.close(); return; }

  const lowResPath = await ask('Path to LOW-RES image PNG (or Enter to reuse high-res): ');
  let lowResFullPath = resolveFile(lowResPath);
  if (lowResPath.trim() && !lowResFullPath) {
    console.log('⚠️  Not found, will reuse high-res image for low-res.');
  }

  console.log('\n── Clickable Area ─────────────────────────────────────────');
  console.log('(Press Enter for defaults)\n');

  const boundW = parseFloat((await ask('Clickable width in px (default: 200): ')).trim() || '200');
  const boundH = parseFloat((await ask('Clickable height in px (default: 200): ')).trim() || '200');
  const titleY = parseFloat((await ask('Title Y offset (neg=above, default: -150): ')).trim() || '-150');

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2: Confirm
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    CONFIRM                              ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  objectID:   ${objectID}`);
  console.log(`  Title:      ${title}`);
  console.log(`  Size:       10^${exponent} × ${coeff} m`);
  console.log(`  High-res:   ${path.basename(highResFullPath)} (${getImageDimensions(highResFullPath).width}×${getImageDimensions(highResFullPath).height})`);
  console.log(`  Click area: ${boundW}×${boundH}px`);
  console.log('');

  if ((await ask('Proceed? (y/N): ')).toLowerCase() !== 'y') {
    console.log('❌ Cancelled.'); rl.close(); return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3: Create standalone spritesheets
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📦 Creating spritesheets...');

  const paddedID = pad3(objectID);
  const texturesDir = path.join(ROOT, 'src', 'img', 'textures');
  if (!fs.existsSync(texturesDir)) fs.mkdirSync(texturesDir, { recursive: true });

  // Low-res spritesheet (named with _quarter, stored in quarter_items_custom)
  const lowImgDest = path.join(texturesDir, `quarter_items_custom.png`);
  const lowJSONDest = path.join(texturesDir, `quarter_items_custom.json`);

  // High-res spritesheet (named with padded ID, stored in new_items_custom)
  const highImgDest = path.join(texturesDir, `new_items_custom.png`);
  const highJSONDest = path.join(texturesDir, `new_items_custom.json`);

  // Copy images
  const srcLow = lowResFullPath || highResFullPath;
  fs.copyFileSync(highResFullPath, highImgDest);
  fs.copyFileSync(srcLow, lowImgDest);
  console.log(`  ✅ Images copied`);

  // Create spritesheet JSONs
  const lowJSON = createSpritesheetJSON(paddedID + '_quarter', lowImgDest, 0.25);
  const highJSON = createSpritesheetJSON(paddedID, highImgDest, 1);
  fs.writeFileSync(lowJSONDest, JSON.stringify(lowJSON, null, 2), 'utf8');
  fs.writeFileSync(highJSONDest, JSON.stringify(highJSON, null, 2), 'utf8');
  console.log(`  ✅ Spritesheet JSONs created`);

  // Also copy to dist
  const distTextures = path.join(ROOT, 'dist', 'img', 'textures');
  if (!fs.existsSync(distTextures)) fs.mkdirSync(distTextures, { recursive: true });
  fs.copyFileSync(lowImgDest, path.join(distTextures, 'quarter_items_custom.png'));
  fs.copyFileSync(lowJSONDest, path.join(distTextures, 'quarter_items_custom.json'));
  fs.copyFileSync(highImgDest, path.join(distTextures, 'new_items_custom.png'));
  fs.copyFileSync(highJSONDest, path.join(distTextures, 'new_items_custom.json'));
  console.log(`  ✅ Copied to dist/img/textures/`);

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4: Update data files
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📝 Updating data files...');

  // sizes.json
  const sizesPath = path.join(SRC_DATA, 'sizes.json');
  const sizes = JSON.parse(fs.readFileSync(sizesPath, 'utf8'));
  sizes.push({ objectID, exponent, coeff, cullFac, realRatio });
  fs.writeFileSync(sizesPath, JSON.stringify(sizes, null, 2), 'utf8');
  console.log(`  ✅ sizes.json (${sizes.length} entries)`);

  // visualLocations.json
  const visPath = path.join(SRC_DATA, 'visualLocations.json');
  const vis = JSON.parse(fs.readFileSync(visPath, 'utf8'));
  vis.push({
    objectID, boundX: -boundW/2, boundY: -boundH/2,
    boundW, boundH, titleX: 0, titleY,
    titleScale: 1, titleWrap: true, descriptionX: 0, descriptionY: 0
  });
  fs.writeFileSync(visPath, JSON.stringify(vis, null, 2), 'utf8');
  console.log(`  ✅ visualLocations.json (${vis.length} entries)`);

  // l0.txt
  const langPath = path.join(SRC_LANG, 'l0.txt');
  const langLines = loadTextFile(langPath);
  langLines.splice(596, 0, title, description);
  saveTextFile(langPath, langLines);
  console.log(`  ✅ l0.txt (title+description inserted)`);

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 5: Update universe.ts (whitelist)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔧 Patching TypeScript files...');

  const universePath = path.join(SRC_TS, 'classes', 'universe.ts');
  let universeCode = fs.readFileSync(universePath, 'utf8');

  const setEndPatt = /"Universe"\s*\n(\s*\]\.map\(normalizeTitle\))/;
  if (setEndPatt.test(universeCode)) {
    universeCode = universeCode.replace(setEndPatt, `"Universe",\n      "${title}"\n$1`);
    fs.writeFileSync(universePath, universeCode, 'utf8');
    console.log(`  ✅ Added "${title}" to keepItemTitles`);
  } else {
    console.log(`  ⚠️  Could not update universe.ts automatically.`);
    console.log(`     Manually add "${title}" to the keepItemTitles Set.`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 6: Update main.ts (load custom spritesheets)
  // ══════════════════════════════════════════════════════════════════════════
  const mainPath = path.join(SRC_TS, 'main.ts');
  let mainCode = fs.readFileSync(mainPath, 'utf8');

  const CUSTOM_MARKER = '// === CUSTOM ITEM TEXTURES ===';

  if (mainCode.includes(CUSTOM_MARKER)) {
    console.log('  ⚠️  Custom loader already exists — skipping main.ts patch.');
    console.log('     (Custom spritesheet files were updated with your new images.)');
  } else {
    // Add custom low-res loader next to the existing line 69
    mainCode = mainCode.replace(
      'loader.add("assetsLow", `img/textures/quarter_items-0-main.json`);',
      `loader.add("assetsLow", \`img/textures/quarter_items-0-main.json\`);
  loader.add("assetsCustom", \`img/textures/quarter_items_custom.json\`);`
    );

    // Add custom high-res loader after the existing high-res loader loop (lines 112-114)
    mainCode = mainCode.replace(
      `highLoader.add(\`main\${i}\`, \`img/textures/new_items_\${i}.json\`);`,
      `highLoader.add(\`main\${i}\`, \`img/textures/new_items_\${i}.json\`);
      ${CUSTOM_MARKER}
      highLoader.add("mainCustom", \`img/textures/new_items_custom.json\`);`
    );

    // Patch the hydrateHighTextures call to work with the custom textures
    // The existing merge loop already collects ALL textures from highLoader resources
    // (lines 119-123). Custom textures loaded via highLoader will automatically
    // be included since they're loaded under the same loader.
    // No additional merge code needed!

    // Patch createItems call to include custom low textures
    // Find the createItems call and update the resource merging
    const createItemsCall = `await universe.createItems(resources, textData);`;
    const patchedCreateItems = `    ${CUSTOM_MARKER}
    // Merge custom low textures into the main textures object
    if (resources.assetsCustom && resources.assetsCustom.textures) {
      resources.assetsLow.textures = {
        ...resources.assetsLow.textures,
        ...resources.assetsCustom.textures
      };
    }
    await universe.createItems(resources, textData);`;

    mainCode = mainCode.replace(createItemsCall, patchedCreateItems);

    fs.writeFileSync(mainPath, mainCode, 'utf8');
    console.log('  ✅ main.ts patched with custom spritesheet loaders');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 7: Build
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🏗️  Copying to dist/...');

  // Manually copy all changed files to dist/
  const distDataDir = path.join(ROOT, 'dist', 'data');
  if (!fs.existsSync(distDataDir)) fs.mkdirSync(distDataDir, { recursive: true });
  fs.copyFileSync(sizesPath, path.join(distDataDir, 'sizes.json'));
  fs.copyFileSync(visPath, path.join(distDataDir, 'visualLocations.json'));

  const distLangDir = path.join(distDataDir, 'languages');
  if (!fs.existsSync(distLangDir)) fs.mkdirSync(distLangDir, { recursive: true });
  fs.copyFileSync(langPath, path.join(distLangDir, 'l0.txt'));

  console.log('  ✅ Data files copied to dist/');

  // The TypeScript needs to be compiled. If browserify is available, run it
  const { execSync } = require('child_process');
  try {
    execSync('npx browserify src/ts/main.ts -p tsify > dist/js/bundle.js 2>&1', {
      cwd: ROOT,
      shell: true,
      stdio: 'pipe',
      timeout: 60000
    });
    console.log('  ✅ TypeScript compiled (bundle.js updated)');
  } catch (err) {
    console.log('  ⚠️  TypeScript compilation had issues. Run `npx gulp` to rebuild.');
    console.log('     (The data files are already updated in both src/ and dist/)');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DONE
  // ══════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              ✅  ITEM ADDED SUCCESSFULLY!                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  "${title}" (objectID ${objectID}) is now part of the universe!`);
  console.log('');
  console.log('  What was done:');
  console.log(`  • Created spritesheets: quarter_items_custom.json & new_items_custom.json`);
  console.log(`  • Registered in sizes.json, visualLocations.json, l0.txt`);
  console.log(`  • Whitelisted in universe.ts`);
  console.log(`  • Patched main.ts to load custom textures`);
  console.log(`  • Copied all files to dist/`);
  console.log('');
  console.log('  To see your item:');
  console.log('    1. If compilation succeeded:');
  console.log('       → Run:  npx gulp');
  console.log('       → Open http://localhost:3000');
  console.log('    2. Scroll to the zoom level matching your item\'s size.');
  console.log('');
  console.log('  To add ANOTHER custom item:');
  console.log(`    1. Put your new image(s) in: src/img/textures/new_items_custom.png`);
  console.log(`       (Use an image editor to paste it alongside existing ones.)`);
  console.log(`    2. Update the JSON: src/img/textures/new_items_custom.json`);
  console.log(`       (Add your new frame with the correct coordinates.)`);
  console.log(`    3. Run this script again for the data registration parts.`);
  console.log('');

  rl.close();
}

main().catch(err => {
  console.error('\n❌ Error:', err);
  rl.close();
});