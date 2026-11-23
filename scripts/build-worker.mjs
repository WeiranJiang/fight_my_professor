import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { assets } from '../backend/http.mjs';

const publicFiles=await Promise.all(Object.values(assets).map(async ([name])=>[
  name,await readFile(new URL('../public/'+name,import.meta.url),'utf8')
]));
await build({
  entryPoints:['worker/index.js'],
  outfile:'dist/server/index.js',
  bundle:true,
  platform:'browser',
  format:'esm',
  target:'es2022',
  plugins:[{
    name:'game-assets',
    setup(builder){
      builder.onResolve({filter:/^virtual:fmp-assets$/},()=>({path:'assets',namespace:'game'}));
      builder.onLoad({filter:/^assets$/,namespace:'game'},()=>({contents:JSON.stringify(Object.fromEntries(publicFiles)),loader:'json'}));
    }
  }]
});
await mkdir('dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
