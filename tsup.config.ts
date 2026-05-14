import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['esm'],
    target: 'node18',
    clean: true,
    splitting: false,
    banner: { js: '#!/usr/bin/env node' },
    outDir: 'dist',
  },
  {
    entry: { 'mcp/server': 'src/mcp/server.ts' },
    format: ['esm'],
    target: 'node18',
    clean: false,
    splitting: false,
    banner: { js: '#!/usr/bin/env node' },
    outDir: 'dist',
  },
])
