import {build} from 'vite';
import {copyFile,rm} from 'node:fs/promises';
await build({configFile:false,build:{outDir:'.bridge-build',emptyOutDir:true,lib:{entry:'bridge-entry.js',name:'DipsyReservationBridge',formats:['iife'],fileName:()=> 'reservation-bridge.js'},rollupOptions:{output:{inlineDynamicImports:true}}}});
await copyFile('.bridge-build/reservation-bridge.js','reservation-bridge.js');
await rm('.bridge-build',{recursive:true});
