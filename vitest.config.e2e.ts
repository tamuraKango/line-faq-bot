import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // AppModule の読み込み時に検証されるため、テスト用の値はここで渡す（.env より優先される）
    env: {
      LINE_CHANNEL_SECRET: 'test-channel-secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'test-access-token',
      ANTHROPIC_API_KEY: 'test-anthropic-api-key',
    },
  },
});
