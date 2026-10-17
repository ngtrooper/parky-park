// Build one zip per portal into dist-portals/<portal>.zip (index.html at the zip root, relative paths only).
import { execSync } from 'node:child_process'; import fs from 'node:fs';
const ALL = ['crazygames', 'poki', 'gamedistribution'], want = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
fs.mkdirSync('dist-portals', { recursive: true });
for (const p of want) {
  const out = `dist-portals/${p}`; fs.rmSync(out, { recursive: true, force: true });
  execSync(`npx vite build --outDir ${out} --emptyOutDir`, { stdio: 'inherit', env: { ...process.env, VITE_PLATFORM: p, VITE_GD_GAME_ID: process.env.VITE_GD_GAME_ID || 'f80b379dea094c32949287ccda7b3610' } });
  fs.rmSync(`dist-portals/${p}.zip`, { force: true });
  execSync(`cd ${out} && python3 -c "import zipfile,os;z=zipfile.ZipFile('../${p}.zip','w',zipfile.ZIP_DEFLATED);[z.write(os.path.join(r,f),os.path.relpath(os.path.join(r,f),'.')) for r,_,fs in os.walk('.') for f in fs];z.close()"`);
  const kb = (fs.statSync(`dist-portals/${p}.zip`).size / 1024) | 0; console.log(`${p}: dist-portals/${p}.zip (${kb} KB)`);
}
