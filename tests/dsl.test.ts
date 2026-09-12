import { validateDsl, compileDsl, compileFlowDsl, compileBpmnDsl, isFlowDsl, isBpmnDsl } from '../src';

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

describe('ice-entity-designer-dsl · BPMN 文档', () => {
  const minimalBpmn = {
    schemaVersion: 1,
    kind: 'bpmn' as const,
    nodes: [
      { id: 'bank', kind: 'pool' as const, title: '银行', left: 60, top: 60, width: 900, height: 292 },
      { id: 'accept', kind: 'lane' as const, title: '受理岗', parent: 'bank' },
      { id: 'risk', kind: 'lane' as const, title: '风控岗', parent: 'bank' },
      { id: 'start', kind: 'event' as const, title: '申请提交', left: 120, top: 130, parent: 'accept' },
      { id: 'verify', kind: 'task' as const, title: '身份核验', taskType: 'service' as const, left: 260, top: 120, parent: 'accept' },
    ],
    edges: [{ source: 'start', target: 'verify', label: '受理', condition: '额度<6000', isDefault: true }],
  };

  it('识别并校验最小 BPMN 文档', () => {
    expect(isBpmnDsl(minimalBpmn)).toBe(true);
    expect(isFlowDsl(minimalBpmn as any)).toBe(false);
    expect(validateDsl(minimalBpmn)).toEqual({ valid: true, errors: [] });
  });

  it('拒绝重复 id、悬空端点、非法词汇与不合法的 parent', () => {
    const result = validateDsl({
      kind: 'bpmn',
      nodes: [
        { id: 'a', kind: 'pool' },
        { id: 'a', kind: 'not-a-kind' },
        { id: 'lane-1', kind: 'lane', parent: 'ghost' },
        { id: 'lane-2', kind: 'lane', parent: 'task-1' },
        { id: 'task-1', kind: 'task', parent: 'a' },
        { id: 'evt', kind: 'event', eventKind: 'middle', trigger: 'beep', gatewayType: 'xor', taskType: 'robot' },
      ],
      edges: [{ source: 'a', target: 'ghost', type: 'signal' }],
    } as any);
    expect(result.valid).toBe(false);
    const message = result.errors.join('\n');
    expect(message).toContain('duplicated');
    expect(message).toContain('nodes[1].kind');
    expect(message).toContain('nodes[2].parent must reference an existing node id');
    expect(message).toContain('nodes[3].parent must reference a pool');
    expect(message).toContain('nodes[5].eventKind');
    expect(message).toContain('nodes[5].trigger');
    expect(message).toContain('nodes[5].gatewayType');
    expect(message).toContain('nodes[5].taskType');
    expect(message).toContain('edges[0].target');
    expect(message).toContain('edges[0].type');
  });

  it('池 → 泳道 → 图元：泳道缺几何时铺满池的内容区并均分条带', () => {
    const scene = compileBpmnDsl(minimalBpmn);
    expect(scene.kind).toBe('bpmn');
    const byId = new Map(scene.nodes.map((node) => [node.id, node]));
    const pool = byId.get('bank')!;
    const accept = byId.get('accept')!;
    const risk = byId.get('risk')!;

    expect(pool.kind).toBe('bpmnPool');
    expect(accept.kind).toBe('bpmnLane');
    expect(accept.left).toBe(pool.left);
    expect(accept.width).toBe(pool.width);
    // 池的名称带（顶部 32）不参与内容区
    expect(accept.top).toBe(pool.top + 32);
    expect(risk.top).toBe(accept.top + accept.height);
    expect(risk.top + risk.height).toBeLessThanOrEqual(pool.top + pool.height);
  });

  it('缺坐标的图元按所属容器分层落位，且落在容器**内容区**里（会被真正嵌进去）', () => {
    const scene = compileBpmnDsl({
      kind: 'bpmn',
      nodes: [
        { id: 'pool', kind: 'pool', title: '池', left: 100, top: 100, width: 800, height: 360 },
        { id: 'lane', kind: 'lane', title: '泳道', parent: 'pool' },
        { id: 'a', kind: 'task', title: 'A', parent: 'lane' },
        { id: 'b', kind: 'task', title: 'B', parent: 'lane' },
      ],
      edges: [{ source: 'a', target: 'b' }],
    });
    const byId = new Map(scene.nodes.map((node) => [node.id, node]));
    const pool = byId.get('pool')!;
    const lane = byId.get('lane')!;
    const a = byId.get('a')!;
    const b = byId.get('b')!;

    // 顺序流方向：a 在 b 的左侧
    expect(a.left).toBeLessThan(b.left);
    // 泳道内容区（扣掉左侧 32 的名称带）之内
    [a, b].forEach((node) => {
      const cx = node.left + node.width / 2;
      const cy = node.top + node.height / 2;
      expect(cx).toBeGreaterThanOrEqual(lane.left + 32);
      expect(cx).toBeLessThanOrEqual(lane.left + lane.width);
      expect(cy).toBeGreaterThanOrEqual(lane.top);
      expect(cy).toBeLessThanOrEqual(lane.top + lane.height);
    });
    expect(lane.left).toBe(pool.left);
  });

  it('给了坐标就是恒等编译（编辑器导出 / XML 导入的坐标不被挪动）', () => {
    const scene = compileBpmnDsl({
      kind: 'bpmn',
      nodes: [
        { id: 'pool', kind: 'pool', left: 40, top: 40, width: 600, height: 200 },
        { id: 'a', kind: 'task', left: 120, top: 90 },
        { id: 'b', kind: 'task', left: 360, top: 90 },
      ],
      edges: [{ source: 'a', target: 'b' }],
    });
    const byId = new Map(scene.nodes.map((node) => [node.id, node]));
    expect(byId.get('pool')!).toMatchObject({ left: 40, top: 40, width: 600, height: 200 });
    expect(byId.get('a')!).toMatchObject({ left: 120, top: 90 });
    expect(byId.get('b')!).toMatchObject({ left: 360, top: 90 });
  });

  it('连线：type 决定 BPMN 语义（默认 sequence），label/condition/默认流原样传递', () => {
    const scene = compileBpmnDsl({
      kind: 'bpmn',
      nodes: [
        { id: 'a', kind: 'task', left: 0, top: 0 },
        { id: 'b', kind: 'task', left: 200, top: 0 },
        { id: 'c', kind: 'task', left: 400, top: 0 },
      ],
      edges: [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c', flowType: 'message', label: '提交申请' },
        { source: 'b', target: 'c', type: 'association', condition: '额度<6000', isDefault: true },
      ],
    });
    expect(scene.edges[0].flowType).toBe('sequence');
    expect(scene.edges[1]).toMatchObject({ flowType: 'message', label: '提交申请' });
    expect(scene.edges[2]).toMatchObject({ flowType: 'association', condition: '额度<6000', isDefault: true });
  });

  it('创建顺序是「池 → 泳道 → 业务图元」（容器先存在，几何嵌套才成立）', () => {
    const scene = compileBpmnDsl(minimalBpmn);
    const kinds = scene.nodes.map((node) => node.kind);
    expect(kinds.slice(0, 1)).toEqual(['bpmnPool']);
    expect(kinds.slice(1, 3)).toEqual(['bpmnLane', 'bpmnLane']);
    expect(kinds.slice(3)).toEqual(['bpmnEvent', 'bpmnTask']);
  });

  it('BPMN 预设：事件/网关/任务/子流程映射到对应 kind 与默认语义取值', () => {
    const scene = compileBpmnDsl({
      kind: 'bpmn',
      nodes: [
        { id: 'evt', kind: 'event', left: 0, top: 0 },
        { id: 'gw', kind: 'gateway', left: 100, top: 0 },
        { id: 'sub', kind: 'subprocess', left: 200, top: 0 },
        { id: 'data', kind: 'dataObject', left: 300, top: 0 },
        { id: 'note', kind: 'annotation', left: 400, top: 0 },
      ],
    });
    expect(scene.nodes[0]).toMatchObject({ kind: 'bpmnEvent', eventKind: 'start', trigger: 'none', width: 56, height: 56 });
    expect(scene.nodes[1]).toMatchObject({ kind: 'bpmnGateway', gatewayType: 'exclusive' });
    expect(scene.nodes[2]).toMatchObject({ kind: 'bpmnSubprocess', taskType: 'none' });
    expect(scene.nodes[3]).toMatchObject({ kind: 'bpmnDataObject' });
    expect(scene.nodes[4]).toMatchObject({ kind: 'bpmnAnnotation' });
  });
});
