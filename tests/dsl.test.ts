import { validateDsl, compileDsl, compileFlowDsl, isFlowDsl } from '../src';

describe('ice-render-dsl', () => {
  it('validates a minimal document', () => {
    const result = validateDsl({
      entities: [{ id: 'customer', name: 'Customer', fields: [] }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects duplicate entity ids and invalid relation endpoints', () => {
    const result = validateDsl({
      entities: [
        { id: 'customer' },
        { id: 'customer' },
      ],
      relations: [{ source: 'customer', target: '' }],
    } as any);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('duplicated');
    expect(result.errors.join('\n')).toContain('relations[0].target');
  });

  it('compiles DSL into Entity/Relation props', () => {
    const scene = compileDsl({
      layout: 'layered',
      entities: [
        { id: 'customer', name: 'Customer', fields: [{ name: 'id', type: 'number', primary: true }] },
        { id: 'order', name: 'Order', fields: [] },
      ],
      relations: [
        {
          source: 'customer',
          target: 'order',
          type: 'one-to-many',
          sourceField: 'id',
          targetField: 'customerId',
        },
      ],
    });

    expect(scene.entities).toHaveLength(2);
    expect(scene.entities[0].entityName).toBe('Customer');
    expect(scene.relations).toHaveLength(1);
    expect(scene.relations[0].relationType).toBe('one-to-many');
    expect(scene.relations[0].sourceId).toBe('customer');
  });
});

describe('ice-entity-designer-dsl · 流程图文档', () => {
  const minimalFlow = {
    schemaVersion: 1,
    kind: 'flowchart' as const,
    nodes: [
      { id: 'start', kind: 'terminator' as const, title: '开始' },
      { id: 'check', kind: 'decision' as const, title: '库存充足？' },
      { id: 'done', kind: 'terminator' as const, title: '结束' },
    ],
    edges: [
      { source: 'start', target: 'check' },
      { source: 'check', target: 'done', label: '是', sourcePort: 'B' as const, targetPort: 'T' as const },
    ],
  };

  it('识别并校验最小流程图文档', () => {
    expect(isFlowDsl(minimalFlow)).toBe(true);
    expect(validateDsl(minimalFlow)).toEqual({ valid: true, errors: [] });
  });

  it('拒绝重复节点 id、悬空端点与非法类型/端口', () => {
    const result = validateDsl({
      kind: 'flowchart',
      nodes: [
        { id: 'a', kind: 'process' },
        { id: 'a', kind: 'not-a-kind' },
      ],
      edges: [{ source: 'a', target: 'ghost', sourcePort: 'X', linkShape: 'curvy' }],
    } as any);
    expect(result.valid).toBe(false);
    const message = result.errors.join('\n');
    expect(message).toContain('duplicated');
    expect(message).toContain('nodes[1].kind');
    expect(message).toContain('edges[0].target');
    expect(message).toContain('edges[0].sourcePort');
    expect(message).toContain('edges[0].linkShape');
  });

  it('编译为 FlowNode / FlowEdge 参数：预设尺寸配色 + 默认端口 + name 回退为标题', () => {
    const scene = compileFlowDsl({
      kind: 'flowchart',
      nodes: [
        { id: 'a', name: '取名', kind: 'decision' },
        { id: 'b', kind: 'io' },
      ],
      edges: [{ source: 'a', target: 'b', label: '否' }],
    });
    expect(scene.kind).toBe('flowchart');
    expect(scene.nodes[0]).toMatchObject({ id: 'a', typeId: 'FlowNode', kind: 'decision', title: '取名', width: 200, height: 120 });
    expect(scene.nodes[0].fillColor).toBeTruthy();
    expect(scene.nodes[1]).toMatchObject({ kind: 'io', title: 'b', width: 220, height: 80 });
    expect(scene.edges[0]).toMatchObject({ sourceId: 'a', targetId: 'b', sourcePort: 'B', targetPort: 'T', label: '否', linkShape: 'visio' });
  });

  it('显式坐标原样保留（不触发自动布局）', () => {
    const scene = compileFlowDsl({
      kind: 'flowchart',
      nodes: [
        { id: 'a', left: 500, top: 300 },
        { id: 'b', left: 500, top: 600 },
      ],
    });
    expect(scene.nodes.map((node) => [node.left, node.top])).toEqual([
      [500, 300],
      [500, 600],
    ]);
  });

  it('缺坐标时按分层自动布局：主干自上而下、同层不重叠', () => {
    const scene = compileFlowDsl({
      kind: 'flowchart',
      nodes: [
        { id: 'start', kind: 'terminator' },
        { id: 'branch-a', kind: 'process' },
        { id: 'branch-b', kind: 'process' },
        { id: 'end', kind: 'terminator' },
      ],
      edges: [
        { source: 'start', target: 'branch-a' },
        { source: 'start', target: 'branch-b' },
        { source: 'branch-a', target: 'end' },
        { source: 'branch-b', target: 'end' },
      ],
    });
    const byId = new Map(scene.nodes.map((node) => [node.id, node]));
    const start = byId.get('start')!;
    const a = byId.get('branch-a')!;
    const b = byId.get('branch-b')!;
    const end = byId.get('end')!;

    // 起点在最上、下游在最下
    expect(a.top).toBeGreaterThan(start.top);
    expect(end.top).toBeGreaterThan(a.top);
    // 同层水平排开且不重叠
    expect(a.top).toBe(b.top);
    expect(Math.max(a.left, b.left)).toBeGreaterThanOrEqual(Math.min(a.left + a.width, b.left + b.width));
    // 布局结果整体落在正坐标区
    scene.nodes.forEach((node) => {
      expect(node.left).toBeGreaterThanOrEqual(0);
      expect(node.top).toBeGreaterThanOrEqual(0);
    });
  });

  it('compileDsl 拒绝流程图文档（避免误用）', () => {
    expect(() => compileDsl(minimalFlow as any)).toThrow(/compileFlowDsl/);
  });
});
