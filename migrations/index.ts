import * as migration_20251226_170450 from './20251226_170450';

export const migrations = [
  {
    up: migration_20251226_170450.up,
    down: migration_20251226_170450.down,
    name: '20251226_170450'
  },
];
