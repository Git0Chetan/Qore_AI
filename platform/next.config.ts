import type { NextConfig } from 'next';

const config: NextConfig = {
  // pdf-parse is a CommonJS lib with optional deps; keep it external on the server.
  serverExternalPackages: ['pdf-parse'],
};

export default config;
