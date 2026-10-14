import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['Gallery.tsx'], bundle: true, outfile: 'dist/gallery.js', platform: 'browser', format: 'esm', jsx: 'automatic', alias: {'react-native':'react-native-web'}, nodePaths: ['./node_modules'], define: {'process.env.NODE_ENV':'"production"'}, minify: true });
await copyFile('index.html','dist/index.html');
await copyFile('../tokens.css','dist/tokens.css');
console.log('Built web gallery from React Native primitives.');
