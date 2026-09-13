/**
 * 示例页的「导出当前文档」按钮是 `toDsl()` 唯一的可视化入口 —— 用户改完图之后，
 * 得有个地方能立刻看到「同一份 DSL 回来了」。
 *
 * 这里做静态校验（不需要浏览器）：七个示例页都要有按钮、都要调用 `toDsl()`、
 * 都要把结果写回 `#dsl` 文本域。浏览器里的真实点击验证见提交说明。
 */
import * as fs from 'fs';
import * as path from 'path';

const EXAMPLES = [
  'entity-editor-dsl',
  'flowchart-dsl',
  'bpmn-dsl',
  'uml-dsl',
  'statechart-dsl',
  'gantt-dsl',
  'power-dsl',
];

describe('示例页 · 导出当前文档（toDsl 往返的可视化入口）', () => {
  EXAMPLES.forEach((name) => {
    it(`${name}.html 有按钮、调用 toDsl()、写回 #dsl`, () => {
      const file = path.join(__dirname, '..', 'examples', `${name}.html`);
      const html = fs.readFileSync(file, 'utf-8');

      expect(html).toContain('<button id="export-doc">');
      expect(html).toContain("getElementById('export-doc')");
      expect(html).toContain('window.__dslResult.toDsl()');
      expect(html).toContain("document.getElementById('dsl').value");
    });
  });
});

/**
 * 示例页的脚本加载顺序（回归：曾整套漏掉 ice-render）。
 *
 * `ice-entity-designer` 与 `ice-entity-designer-dsl` 的 UMD 都把引擎 **external** 化
 * （designer 的 rollup `globals: { 'ice-render': 'ICE' }`），页面必须先加载 ice-render 的 UMD
 * 提供 `window.ICE`。此前七个示例页只引了 designer + dsl 两个包，打开就是
 * `Cannot read properties of undefined (reading 'ICEGroup')`、`ICEDSL.renderDsl is not a function`
 * —— 整页白屏，而 jest 只跑库代码、没有任何测试覆盖示例页，所以一直没人发现。
 */
describe('示例页 · 引擎 UMD 必须在 designer / dsl 之前加载', () => {
  EXAMPLES.forEach((name) => {
    it(`${name}.html 先引 ice-render，再引 ice-entity-designer，最后引本包`, () => {
      const file = path.join(__dirname, '..', 'examples', `${name}.html`);
      const html = fs.readFileSync(file, 'utf-8');
      const order = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
      const at = (needle: string) => order.findIndex((src) => src.includes(needle));

      expect(at('node_modules/ice-render/dist/index.umd.js')).toBeGreaterThanOrEqual(0);
      expect(at('node_modules/ice-entity-designer/dist/index.umd.js')).toBeGreaterThan(
        at('node_modules/ice-render/dist/index.umd.js')
      );
      expect(at('../dist/index.umd.js')).toBeGreaterThan(at('node_modules/ice-entity-designer/dist/index.umd.js'));
    });
  });
});
