import { copyFileSync, chmodSync } from 'node:fs';
copyFileSync('src/infrastructure/exercises.json', 'dist/infrastructure/exercises.json');
chmodSync('dist/index.js', 0o755);
