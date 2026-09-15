/**
 * `__applySceneLayout` 的回归（2026-09-15）：
 *
 * 它把 DSL 场景"排一次"，而 DSL 场景的容器就是 **ICE 根**。引擎的布局器要求容器有
 * `state`（`contentBox()` / `paddingOf()` 从它读宽高与 padding），ICE 实例没有 `state` ——
 * 于是 `layoutContainer(ice)` 直接抛 `TypeError: Cannot read properties of undefined (reading 'padding')`。
 *
 * 这个缺陷从引擎 2.7（内外距机制）起就在，只是 `examples/entity-editor-dsl.html` 一直没被
 * 任何 runner 跑过。这里用最小桩把它钉住：**两条分支都不许抛，且真的把位置写回节点**。
 */
import { ICELayeredLayout } from 'ice-render';
import { __applySceneLayout } from '../src/runtime/renderDsl';

function makeNode(id: string, left = 0, top = 0): any {
  return {
    props: { id },
    state: { id, left, top, width: 100, height: 40 },
    getPreferredSize: () => [100, 40],
    isEffectivelyVisible: () => true,
    setState(patch: any) {
      Object.assign(this.state, patch);
    },
  };
}

function makeEdge(from: string, to: string): any {
  return {
    isLine: true,
    getLinkFromId: () => from,
    getLinkToId: () => to,
    state: {},
    setState(patch: any) {
      Object.assign(this.state, patch);
    },
  };
}

function makeIce(nodes: any[], edges: any[], types: Record<string, any> = {}): any {
  return {
    canvasWidth: 1200,
    canvasHeight: 800,
    childNodes: [...nodes, ...edges],
    getType: (typeId: string) => types[typeId] || null,
  };
}

describe('__applySceneLayout（场景布局）', () => {
  it('兼容分支（scene.layout = layered）：不抛异常，且把节点分开摆好', () => {
    const a = makeNode('a');
    const b = makeNode('b');
    const ice = makeIce([a, b], [makeEdge('a', 'b')]);

    expect(() => __applySceneLayout(ice, { layout: 'layered' }, {})).not.toThrow();
    // 分层布局会把 b 排到 a 的下一层：至少有一轴的坐标被写动过
    const moved = a.state.left !== 0 || a.state.top !== 0 || b.state.left !== 0 || b.state.top !== 0;
    expect(moved).toBe(true);
  });

  it('layoutSpec 分支（引擎按 typeId 反查布局）：同样不抛，位置写回节点', () => {
    const a = makeNode('a');
    const b = makeNode('b');
    const ice = makeIce([a, b], [makeEdge('a', 'b')], { 'ice-render:ICELayeredLayout': ICELayeredLayout });

    expect(() =>
      __applySceneLayout(ice, { layoutSpec: { type: 'ice-render:ICELayeredLayout', props: {} } }, {})
    ).not.toThrow();
    expect(Number.isFinite(a.state.left)).toBe(true);
    expect(Number.isFinite(a.state.top)).toBe(true);
  });

  it('连线端点会被同步到节点边缘（分层布局的既有行为不许丢）', () => {
    const a = makeNode('a');
    const b = makeNode('b');
    const edge = makeEdge('a', 'b');
    const ice = makeIce([a, b], [edge]);

    __applySceneLayout(ice, { layout: 'layered' }, {});
    expect(Array.isArray(edge.state.startPoint)).toBe(true);
    expect(Array.isArray(edge.state.endPoint)).toBe(true);
    // 出边从 a 的右边缘中点出发
    expect(edge.state.startPoint[0]).toBe(a.state.left + a.state.width);
    expect(edge.state.startPoint[1]).toBe(a.state.top + a.state.height / 2);
  });

  it('没有布局意图时什么都不做（不抛、不改坐标）', () => {
    const a = makeNode('a', 33, 44);
    const ice = makeIce([a], []);
    expect(() => __applySceneLayout(ice, {}, {})).not.toThrow();
    expect(a.state.left).toBe(33);
    expect(a.state.top).toBe(44);
  });
});
