import {
  validateDsl,
  compileStatechartDsl,
  isStatechartDsl,
  compileGanttDsl,
  isGanttDsl,
  compilePowerDsl,
  isPowerDsl,
  compileDsl,
  compileFlowDsl,
  compileBpmnDsl,
  compileUmlDsl,
  isFlowDsl,
  isBpmnDsl,
  isUmlDsl,
} from '../src';

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
    expect(validateDsl(minimalFlow)).toEqual({ valid: true, errors: [], diagnostics: [] });
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
    expect(scene.nodes[0]).toMatchObject({
      id: 'a',
      typeId: 'ice-entity-designer:FlowNode',
      kind: 'decision',
      title: '取名',
      width: 200,
      height: 120,
    });
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
    expect(validateDsl(minimalBpmn)).toEqual({ valid: true, errors: [], diagnostics: [] });
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

describe('ice-entity-designer-dsl · UML 类图文档', () => {
  const minimalUml = {
    schemaVersion: 1,
    kind: 'uml' as const,
    nodes: [
      { id: 'entity', kind: 'class' as const, title: 'Entity', abstract: true, methods: ['+ save(): void'] },
      { id: 'user', kind: 'class' as const, title: 'User', attributes: ['- email: string'], methods: ['+ placeOrder(): Order'] },
      { id: 'payable', kind: 'interface' as const, title: 'Payable', methods: ['+ pay(): void'] },
      { id: 'order', kind: 'class' as const, title: 'Order' },
      { id: 'item', kind: 'class' as const, title: 'OrderItem' },
      { id: 'status', kind: 'enum' as const, title: 'OrderStatus', attributes: ['PAID', 'UNPAID'] },
    ],
    edges: [
      { source: 'user', target: 'entity', type: 'inheritance' as const },
      { source: 'order', target: 'payable', type: 'realization' as const },
      { source: 'user', target: 'order', type: 'association' as const, label: '1 : 0..*' },
      { source: 'order', target: 'item', type: 'composition' as const, label: '1..*' },
      { source: 'order', target: 'status', type: 'dependency' as const },
    ],
  };
  it('识别并校验最小 UML 文档', () => {
    expect(isUmlDsl(minimalUml)).toBe(true);
    expect(isFlowDsl(minimalUml as any)).toBe(false);
    expect(validateDsl(minimalUml)).toEqual({ valid: true, errors: [], diagnostics: [] });
  });

  it('拒绝重复 id、非法 kind、非字符串成员、悬空端点与非法关系类型', () => {
    const result = validateDsl({
      kind: 'uml',
      nodes: [
        { id: 'a', kind: 'class' },
        { id: 'a', kind: 'struct' },
        { id: 'b', attributes: ['ok', 42] },
      ],
      edges: [{ source: 'a', target: 'ghost', type: 'extends' }],
    } as any);
    expect(result.valid).toBe(false);
    const message = result.errors.join('\n');
    expect(message).toContain('duplicated');
    expect(message).toContain('nodes[1].kind');
    expect(message).toContain('nodes[2].attributes');
    expect(message).toContain('edges[0].target');
    expect(message).toContain('edges[0].type');
  });

  it('编译：类名/构造型/成员原样传递，关系种类与标签保留', () => {
    const scene = compileUmlDsl(minimalUml);
    expect(scene.kind).toBe('uml');
    const byId = new Map(scene.nodes.map((node) => [node.id, node]));
    expect(byId.get('entity')).toMatchObject({ className: 'Entity', kind: 'class', abstract: true, methods: ['+ save(): void'] });
    expect(byId.get('payable')).toMatchObject({ kind: 'interface' });
    expect(byId.get('status')).toMatchObject({ kind: 'enum', attributes: ['PAID', 'UNPAID'] });
    expect(scene.edges[0]).toMatchObject({ sourceId: 'user', targetId: 'entity', relationKind: 'inheritance' });
    expect(scene.edges[2]).toMatchObject({ relationKind: 'association', label: '1 : 0..*' });
  });

  it('缺坐标时自动分层：父类在上、子类在下（继承自上而下）', () => {
    const scene = compileUmlDsl(minimalUml);
    const byId = new Map(scene.nodes.map((node) => [node.id, node]));
    const entity = byId.get('entity')!;
    const user = byId.get('user')!;
    const order = byId.get('order')!;
    const payable = byId.get('payable')!;
    // 继承/实现参与分层，且方向是「父类在上、子类在下」：
    // Entity 与 Payable 都在第 0 层；User 继承 Entity → 在 Entity 下方；
    // Order 实现 Payable → 在 Payable 下方（与 User 同层，不要求谁更高）。
    expect(payable.top).toBe(entity.top);
    expect(user.top).toBeGreaterThan(entity.top);
    expect(order.top).toBeGreaterThan(payable.top);
    // 布局结果落在正坐标区，且类框之间有间距
    scene.nodes.forEach((node) => {
      expect(node.left).toBeGreaterThanOrEqual(0);
      expect(node.top).toBeGreaterThanOrEqual(0);
    });
  });

  it('给了坐标就是恒等编译', () => {
    const scene = compileUmlDsl({
      kind: 'uml',
      nodes: [
        { id: 'a', title: 'A', left: 120, top: 80 },
        { id: 'b', title: 'B', left: 500, top: 80 },
      ],
      edges: [{ source: 'a', target: 'b', type: 'aggregation' }],
    });
    expect(scene.nodes.map((node) => [node.left, node.top])).toEqual([
      [120, 80],
      [500, 80],
    ]);
  });
});

describe('ice-entity-designer-dsl · 状态机文档', () => {
  const orderStatechart = {
    schemaVersion: 1,
    kind: 'statechart' as const,
    nodes: [
      { id: 'start', kind: 'initial' as const },
      { id: 'pending', title: '待支付' },
      { id: 'paid', title: '已支付' },
      { id: 'processing', kind: 'composite' as const, title: '订单处理' },
      { id: 'stock', title: '库存校验', parent: 'processing' },
      { id: 'ship', title: '安排发货', parent: 'processing' },
      { id: 'done', kind: 'final' as const },
    ],
    edges: [
      { source: 'start', target: 'pending' },
      { source: 'pending', target: 'paid', event: '支付成功', guard: '金额 > 0', action: '生成订单' },
      { source: 'paid', target: 'stock', event: '进入处理' },
      { source: 'stock', target: 'ship', event: '库存充足' },
      { source: 'ship', target: 'done', event: '已发货' },
    ],
  };

  it('识别并校验最小状态机文档', () => {
    expect(isStatechartDsl(orderStatechart)).toBe(true);
    expect(validateDsl(orderStatechart)).toEqual({ valid: true, errors: [], diagnostics: [] });
  });

  it('拒绝重复 id、非法 kind、非法 parent（只能挂复合状态）与悬空端点', () => {
    const result = validateDsl({
      kind: 'statechart',
      nodes: [
        { id: 'a', kind: 'initial' },
        { id: 'a', kind: 'pseudo' },
        { id: 'b', parent: 'ghost' },
        { id: 'c', parent: 'a' },
      ],
      edges: [{ source: 'a', target: 'ghost' }],
    } as any);
    expect(result.valid).toBe(false);
    const message = result.errors.join('\n');
    expect(message).toContain('duplicated');
    expect(message).toContain('nodes[1].kind');
    expect(message).toContain('nodes[2].parent must reference an existing node id');
    expect(message).toContain('nodes[3].parent must reference a composite state');
    expect(message).toContain('edges[0].target');
  });

  it('编译：转移标签三段式、子状态被放进复合状态（绝对坐标）、根级按流向横向排布', () => {
    const scene = compileStatechartDsl(orderStatechart);
    expect(scene.kind).toBe('statechart');
    const byId = new Map(scene.nodes.map((node) => [node.id, node]));
    const composite = byId.get('processing')!;
    const stock = byId.get('stock')!;
    const ship = byId.get('ship')!;

    // 子状态落在复合状态的框内（绝对坐标：复合状态左上角 + 内边距）
    expect(stock.left).toBeGreaterThan(composite.left);
    expect(stock.left).toBeLessThan(composite.left + composite.width);
    expect(stock.top).toBeGreaterThan(composite.top);
    expect(ship.left).toBeGreaterThan(stock.left);
    // 复合状态按内容自适应：装得下两个子状态
    expect(composite.width).toBeGreaterThanOrEqual(ship.left + ship.width - composite.left);

    // 根级沿转移流自左而右（start → pending → paid → done）
    expect(byId.get('pending')!.left).toBeGreaterThan(byId.get('start')!.left);
    expect(byId.get('paid')!.left).toBeGreaterThan(byId.get('pending')!.left);
    expect(byId.get('done')!.left).toBeGreaterThan(byId.get('paid')!.left);

    // 标签三段式原样传递（由 StateTransition 拼）
    const pay = scene.edges.find((edge) => edge.id === 'transition-1')!;
    expect(pay).toMatchObject({ event: '支付成功', guard: '金额 > 0', action: '生成订单' });
  });

  it('给了坐标就是恒等编译（子状态坐标按绝对理解）', () => {
    const scene = compileStatechartDsl({
      kind: 'statechart',
      nodes: [
        { id: 'c', kind: 'composite', left: 100, top: 100, width: 400, height: 300 },
        { id: 's', title: '子', parent: 'c', left: 160, top: 180 },
      ],
    });
    const byId = new Map(scene.nodes.map((node) => [node.id, node]));
    expect(byId.get('s')).toMatchObject({ left: 160, top: 180 });
    expect(byId.get('c')).toMatchObject({ left: 100, top: 100 });
  });
});

describe('ice-entity-designer-dsl · 甘特文档', () => {
  const releasePlan = {
    schemaVersion: 1,
    kind: 'gantt' as const,
    nodes: [
      { id: 'review', title: '需求评审', start: '2026-03-02', days: 4, progress: 1, resource: '张三' },
      { id: 'design', title: '交互设计', start: '2026-03-05', days: 6, progress: 0.8 },
      { id: 'frontend', title: '前端开发', start: '2026-03-10', days: 12, progress: 0.35 },
      { id: 'release', title: '灰度发布', start: '2026-03-30', days: 4 },
    ],
    edges: [
      { source: 'review', target: 'design' },
      { source: 'design', target: 'frontend' },
      { source: 'frontend', target: 'release' },
    ],
    options: { dayWidth: 30, fitViewport: true },
  };

  it('识别并校验最小甘特文档', () => {
    expect(isGanttDsl(releasePlan)).toBe(true);
    expect(validateDsl(releasePlan)).toEqual({ valid: true, errors: [], diagnostics: [] });
  });

  it('拒绝重复 id、非法日期、越界进度与悬空端点', () => {
    const result = validateDsl({
      kind: 'gantt',
      nodes: [
        { id: 'a', start: '2026-03-02' },
        { id: 'a', start: '三月二日', days: 0, progress: 2, row: -1 },
      ],
      edges: [{ source: 'a', target: 'ghost' }],
    } as any);
    expect(result.valid).toBe(false);
    const message = result.errors.join('\n');
    expect(message).toContain('duplicated');
    expect(message).toContain('nodes[1].start');
    expect(message).toContain('nodes[1].days');
    expect(message).toContain('nodes[1].progress');
    expect(message).toContain('nodes[1].row');
    expect(message).toContain('edges[0].target');
  });

  it('编译：日期/天数/进度原样传递，行号缺省按声明顺序补齐（不需要坐标）', () => {
    const scene = compileGanttDsl(releasePlan);
    expect(scene.kind).toBe('gantt');
    expect(scene.nodes.map((task) => task.row)).toEqual([0, 1, 2, 3]);
    expect(scene.nodes[0]).toMatchObject({ id: 'review', title: '需求评审', start: '2026-03-02', days: 4, progress: 1 });
    expect(scene.nodes[3]).toMatchObject({ id: 'release', days: 4, progress: 0 });
    // 资源字段（用于资源冲突检查）原样传递
    expect(scene.nodes[0].resource).toBe('张三');
    expect(scene.nodes[1].resource).toBe('');
    expect(scene.edges[1]).toMatchObject({ sourceId: 'design', targetId: 'frontend' });
  });

  it('显式行号优先（允许任务在纵轴上重排）', () => {
    const scene = compileGanttDsl({
      kind: 'gantt',
      nodes: [
        { id: 'a', start: '2026-03-02', row: 5 },
        { id: 'b', start: '2026-03-03' },
      ],
    });
    expect(scene.nodes.map((task) => task.row)).toEqual([5, 1]);
  });

  it('编译器不碰日期：排期/关键路径语义属于设计器（回归边界）', () => {
    // 末端任务手写了一个很晚的日期，编译器必须原样传递。
    // 归一化（自动排程）与浮时计算（关键路径）是设计器的职责：
    // 编译期"顺手推一下日期"会让 autoSchedule 的"只推后不提前"失去意义。
    const scene = compileGanttDsl({
      kind: 'gantt',
      nodes: [
        { id: 'design', start: '2026-03-02', days: 4 },
        { id: 'test', start: '2026-03-20', days: 3 },
      ],
      edges: [{ source: 'design', target: 'test' }],
      options: { dayWidth: 30, autoSchedule: true },
    });
    expect(scene.nodes.map((task) => task.start)).toEqual(['2026-03-02', '2026-03-20']);
    expect(scene.options).toMatchObject({ dayWidth: 30, autoSchedule: true });
  });
});

describe('ice-entity-designer-dsl · 电力一次系统图文档', () => {
  const substation = {
    schemaVersion: 1,
    kind: 'power' as const,
    nodes: [
      { id: 'bus1', kind: 'busbar' as const, name: '#1M', voltageLevel: '110kV', left: 120, top: 120, width: 600 },
      { id: 'bus2', kind: 'busbar' as const, name: '#2M', voltageLevel: '110kV', left: 120, top: 220, width: 600 },
      { id: 'line', kind: 'generator' as const, name: '甲线', voltageLevel: '110kV', left: 240, top: 620, source: true },
      { id: 'ds1', kind: 'disconnector' as const, name: '11011', voltageLevel: '110kV', attachedTo: 'bus1' },
      { id: 'ds2', kind: 'disconnector' as const, name: '11012', voltageLevel: '110kV', attachedTo: 'bus2', switchState: 'open' as const },
      { id: 'qf', kind: 'breaker' as const, name: '1101', voltageLevel: '110kV', left: 240, top: 350, switchState: 'closed' as const },
      { id: 'ct', kind: 'currentTransformer' as const, name: '1101TA', voltageLevel: '110kV', left: 240, top: 440 },
    ],
    edges: [
      { source: 'ds1', target: 'qf' },
      { source: 'ds2', target: 'qf' },
      { source: 'qf', target: 'ct' },
      { source: 'ct', target: 'line' },
    ],
    options: { fitViewport: true },
  };

  it('识别并校验最小电力文档', () => {
    expect(isPowerDsl(substation)).toBe(true);
    expect(validateDsl(substation)).toEqual({ valid: true, errors: [], diagnostics: [] });
  });

  it('拒绝非法 kind、重复 id、悬空端点与「挂在非母线上」', () => {
    const result = validateDsl({
      kind: 'power',
      nodes: [
        { id: 'a', kind: 'breaker', voltageLevel: '110kV' },
        { id: 'a', kind: '不存在的设备', voltageLevel: '110千伏' },
        { id: 'b', kind: 'disconnector', attachedTo: 'a' },
      ],
      edges: [{ source: 'a', target: 'ghost' }],
    } as any);
    expect(result.valid).toBe(false);
    const message = result.errors.join('\n');
    expect(message).toContain('duplicated');
    expect(message).toContain('nodes[1].kind');
    expect(message).toContain('nodes[1].voltageLevel');
    expect(message).toContain('edges[0].target');
    expect(message).toContain('must point at a busbar');
  });

  it('编译：坐标 / 电压等级 / 开关状态原样传递，母线 T 接编译成 attachments', () => {
    const scene = compilePowerDsl(substation);
    expect(scene.kind).toBe('power');
    expect(scene.nodes.find((node) => node.id === 'qf')).toMatchObject({
      kind: 'breaker',
      voltageLevel: '110kV',
      left: 240,
      top: 350,
      switchState: 'closed',
    });
    expect(scene.nodes.find((node) => node.id === 'line')!.source).toBe(true);
    expect(scene.attachments).toEqual([
      { deviceId: 'ds1', busId: 'bus1' },
      { deviceId: 'ds2', busId: 'bus2' },
    ]);
    // 省略坐标时给默认网格（不写 NaN）
    const fallback = compilePowerDsl({
      kind: 'power',
      nodes: [{ id: 'x', kind: 'breaker', voltageLevel: '110kV' }],
    });
    expect(Number.isFinite(fallback.nodes[0].left)).toBe(true);
    expect(Number.isFinite(fallback.nodes[0].top)).toBe(true);
  });
});
