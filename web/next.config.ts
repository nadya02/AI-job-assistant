import type { NextConfig } from 'next';

// The repo root holds the shared node_modules (Prisma client) and package-lock.
const config: NextConfig = {
  // Lets a second server run beside the main one (for testing) without sharing its build folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  turbopack: { root: '..' },
};
export default config;
