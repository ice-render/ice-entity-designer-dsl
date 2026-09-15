import { defineConfig } from '@playwright/test';

/**
 * 示例页真机冒烟（目录驱动）。
 *
 * 前置：`npm run build` —— 示例页加载 `../dist/index.umd.js`（本包）与
 * `../node_modules/ice-render/dist/index.umd.js`（引擎）。
 *
 * 为什么要有它：这些示例页此前**没有任何 runner**，于是 `entity-editor-dsl.html`
 * 从引擎 2.7 起就一直报 `TypeError: ... (reading 'padding')` 而没人发现
 * （2026-09-15 第一次真机跑才发现）。冒烟断言三件事：无 console/pageerror、无 4xx、画布有落墨。
 *
 * 家族端口分配（见 ice-render 仓 AGENTS）：ice-render 8090 / 实体设计器 8091 / smart-water 8092 /
 * ice-web-components 8093 / ice-render-dsl 8094 / react-demo 8095 / ice-chart-dsl 8096 /
 * **本仓 8097** / ice-game 8098。
 * `reuseExistingServer: false`：端口被别的服务占着时**响亮失败**（而不是静默复用别人的目录）。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  reporter: [['list']],
  webServer: {
    command: 'npx http-server . -p 8097 -c-1 --silent',
    port: 8097,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:8097',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
});
