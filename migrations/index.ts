import * as migration_20251228_170646 from './20251228_170646';

export const migrations = [
  {
    up: migration_20251228_170646.up,
    down: migration_20251228_170646.down,
    name: '20251228_170646'
  },
];
