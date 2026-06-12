const fs = require('fs');
const path = require('path');
const dataDir = path.join('d:', '10A_daksh_Cs', 'src', 'data');
const texts = fs.readFileSync(path.join(dataDir, 'languages', 'l0.txt'), 'utf8').split(/\r?\n/).map(x => x.replace(/\r?\n|\r/g, ''));
const sizes = JSON.parse(fs.readFileSync(path.join(dataDir, 'sizes.json'), 'utf8'));
let out = [];
for (let idx = 29; idx < sizes.length; idx++) {
  const i = idx - 29;
  const title = texts[i * 2] || '';
  out.push(`${idx - 28}. ${title}`);
}
fs.writeFileSync(path.join('d:', '10A_daksh_Cs', 'item_names.txt'), out.join('\n'));
console.log('wrote', out.length, 'item names');
