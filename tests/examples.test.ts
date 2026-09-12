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
