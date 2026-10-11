import { existsSync } from 'node:fs';

// Published installations do not need Git hooks or development dependencies.
if (existsSync('.git') && !process.env.CI && process.env.HUSKY !== '0' && process.env.NODE_ENV !== 'production') {
  const { default: husky } = await import('husky');
  const error = husky();
  if (error) throw new Error(error);
}
