import { readFile, writeFile } from 'node:fs/promises';
const sources = await Promise.all(['src/data.ts','src/lib/aiDraft.ts'].map(p=>readFile(p,'utf8')));
const icons=new Set(sources.flatMap(src=>[...src.matchAll(/(?:N|P)\('([^']+)'/g),...src.matchAll(/\bi: '([^']+)'/g),...src.matchAll(/\['([^']+)',/g)].map(m=>m[1]).filter(x=>x && !/[가-힣A-Za-z]/u.test(x))));
for(const icon of ['🍎','🍌','🍞','🍚','🚌','🚗','🐶','🐱','⚽','📚','💊','🛏️','🚿','🧼','👕','🥛','🍪','🍓','🍊','🍉','🧃','🧑','💬']) icons.add(icon);
const entries=[];
for(const icon of icons){
 const code=[...icon].map(c=>c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')).filter(x=>x!=='FE0F'||icon.includes('\u20e3')||icon.includes('\u200d')).join('-');
 const res=await fetch(`https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/618x618/${code}.png`);
 if(!res.ok) throw new Error(`${code}: ${res.status}`);
 await writeFile(`assets/symbols/${code}.png`,Buffer.from(await res.arrayBuffer()));
 entries.push(`  '${icon}': require('../../assets/symbols/${code}.png'),`);
}
await writeFile('src/lib/symbolAssets.ts',`// OpenMoji, CC BY-SA 4.0. See assets/symbols/LICENSE.md.\nimport type { ImageSourcePropType } from 'react-native';\nexport const SYMBOL_ASSETS: Record<string, ImageSourcePropType> = {\n${entries.join('\n')}\n};\n`);
console.log(`Downloaded ${entries.length} symbols`);
