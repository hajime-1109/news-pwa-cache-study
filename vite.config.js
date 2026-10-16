import { readFileSync } from 'node:fs';

export default {
  plugins: [{
    name: 'service-worker-policy-files',
    // public/sw.jsはそのまま配信されるため、参照するモジュールもビルドへ含める。
    generateBundle() {
      for (const fileName of ['src/cache/stalenessPolicy.js', 'src/config/experimentConfig.js']) {
        this.emitFile({
          type: 'asset',
          fileName,
          source: readFileSync(new URL(fileName, import.meta.url), 'utf8'),
        });
      }
    },
  }],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
};
