/**
 * DSL 往返：`toDsl()` 把**用户改过的实例**写回同一份 DSL 文档。
 *
 * 这是「AI 产出可编辑的工程产物」的地基 —— Agent 产出 DSL → 渲染成可编辑实例 →
 * 用户拖动 / 改名 / 分合 → 再把工程产物读回成同一份 DSL（而不是引擎私有的场景快照）。
 *
 * 契约（每个 kind 都要满足）：
 * 1. 身份保真：id / kind / 标题 / 端口 / 语义字段与实例一致；
 * 2. 坐标固化：实例里的位置（含嵌套容器的绝对位置）要写进文档，用户拖过的东西不能丢；
 * 3. 产物可校验：`toDsl()` 的结果必须能通过 `validateDsl()`；
 * 4. 可序列化：结果里不能有 undefined / 函数（必须能被 JSON.stringify 无损存取）；
 * 5. 再渲染等价：把导出的文档再渲染一遍，节点 / 连线的 id、类型、位置与第一遍一致。
 */
import {
  ICE,
  EventBus,
  EntityDesigner,
  FlowDesigner,
  BpmnDesigner,
  UmlDesigner,
  StatechartDesigner,
  GanttDesigner,
  PowerDesigner,
} from 'ice-entity-designer';
import { toDsl, validateDsl, compileFlowDsl, compileDsl, compileBpmnDsl, compileUmlDsl, compileStatechartDsl, compileGanttDsl, compilePowerDsl } from '../src';

function stubIce(): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  return ice;
}

const FLOW_DOC: any = {
  schemaVersion: 1,
  kind: 'flowchart',
  nodes: [
    { id: 'start', kind: 'terminator', title: '开始', left: 80, top: 60 },
    { id: 'check', kind: 'decision', title: '库存充足？', left: 80, top: 220 },
    { id: 'done', kind: 'terminator', title: '结束', left: 80, top: 420 },
  ],
  edges: [
    { id: 'e-start', source: 'start', target: 'check' },
    { id: 'e-yes', source: 'check', target: 'done', label: '是', sourcePort: 'B', targetPort: 'T' },
  ],
};

const ER_DOC: any = {
  schemaVersion: 1,
  entities: [
    { id: 'customer', name: 'Customer', left: 40, top: 40, fields: [{ name: 'id', type: 'number', primary: true }] },
    { id: 'order', name: 'Order', left: 360, top: 40, fields: [{ name: 'id', type: 'number', primary: true }] },
  ],
  relations: [{ id: 'r1', source: 'customer', target: 'order', type: 'one-to-many', label: 'places' }],
};

const BPMN_DOC: any = {
  schemaVersion: 1,
  kind: 'bpmn',
  nodes: [
    { id: 'pool', kind: 'pool', title: '银行', left: 60, top: 60, width: 900, height: 320 },
    { id: 'lane', kind: 'lane', title: '受理岗', parent: 'pool', left: 92, top: 92, width: 868, height: 288 },
    { id: 'start-event', kind: 'event', title: '收到申请', parent: 'lane', left: 180, top: 200 },
    { id: 'task', kind: 'task', title: '审批', parent: 'lane', left: 360, top: 180, taskType: 'user' },
  ],
  edges: [{ id: 'flow1', source: 'start-event', target: 'task', flowType: 'sequence', label: '提交' }],
};

const UML_DOC: any = {
  schemaVersion: 1,
  kind: 'uml',
  nodes: [
    { id: 'order', kind: 'class', title: 'Order', left: 60, top: 60, attributes: ['- id: string'], methods: ['+ pay(): void'] },
    { id: 'base', kind: 'class', title: 'BaseEntity', left: 60, top: 320, attributes: [] },
  ],
  edges: [{ id: 'rel1', source: 'order', target: 'base', type: 'inheritance', label: 'extends' }],
};

const STATECHART_DOC: any = {
  schemaVersion: 1,
  kind: 'statechart',
  nodes: [
    { id: 'initial', kind: 'initial', left: 60, top: 60 },
    { id: 'pending', kind: 'state', title: '待支付', left: 180, top: 60 },
    { id: 'processing', kind: 'composite', title: '订单处理', left: 420, top: 60, width: 500, height: 220 },
    { id: 'checking', kind: 'state', title: '库存校验', parent: 'processing', left: 470, top: 140 },
  ],
  edges: [
    { id: 't1', source: 'initial', target: 'pending' },
    { id: 't2', source: 'pending', target: 'checking', event: '支付成功', guard: '金额 > 0', action: '生成订单' },
  ],
};

const GANTT_DOC: any = {
  schemaVersion: 1,
  kind: 'gantt',
  nodes: [
    { id: 'req', title: '需求评审', start: '2026-01-02', days: 4, progress: 0.4, resource: '张三' },
    { id: 'design', title: '交互设计', start: '2026-01-06', days: 6, progress: 0.8, resource: '李四' },
  ],
  edges: [{ id: 'd1', source: 'req', target: 'design' }],
};

const POWER_DOC: any = {
  schemaVersion: 1,
  kind: 'power',
  nodes: [
    { id: 'bus', kind: 'busbar', title: '1M', voltageLevel: '110kV', left: 120, top: 80 },
    { id: 'qf', kind: 'breaker', title: '101QF', voltageLevel: '110kV', switchState: 'closed', left: 120, top: 220 },
    { id: 'tv', kind: 'voltageTransformer', title: '101TV', voltageLevel: '110kV', left: 320, top: 80, attachedTo: 'bus' },
  ],
  edges: [{ id: 'c1', source: 'qf', target: 'bus', voltageLevel: '110kV', sourcePort: 'T', targetPort: 'B' }],
};

/** 与 renderXxxDsl 相同的建图步骤，只是不经过 canvas（单测里不需要真画布） */
function buildFlow(doc: any): any {
  const designer: any = new FlowDesigner(stubIce());
  const scene = compileFlowDsl(doc);
  scene.nodes.forEach((node: any) => designer.createNode(node.kind, node));
  scene.edges.forEach((edge: any) => designer.createEdge(edge));
  return designer;
}

function buildEr(doc: any): any {
  const designer: any = new EntityDesigner(stubIce());
  compileDsl(doc).entities.forEach((entity: any) => designer.createEntity(entity));
  compileDsl(doc).relations.forEach((relation: any) => designer.createRelation(relation));
  return designer;
}

function buildBpmn(doc: any): any {
  const designer: any = new BpmnDesigner(stubIce());
  compileBpmnDsl(doc).nodes.forEach((node: any) => designer.createNode(node.kind, node));
  compileBpmnDsl(doc).edges.forEach((edge: any) => designer.createEdge(edge));
  return designer;
}

function buildUml(doc: any): any {
  const designer: any = new UmlDesigner(stubIce());
  compileUmlDsl(doc).nodes.forEach((node: any) => designer.createClass(node));
  compileUmlDsl(doc).edges.forEach((edge: any) => designer.createRelation(edge));
  return designer;
}

function buildStatechart(doc: any): any {
  const designer: any = new StatechartDesigner(stubIce());
  compileStatechartDsl(doc).nodes.forEach((node: any) => designer.createState(node));
  compileStatechartDsl(doc).edges.forEach((edge: any) => designer.createTransition(edge));
  return designer;
}

function buildGantt(doc: any): any {
  const designer: any = new GanttDesigner(stubIce());
  compileGanttDsl(doc).nodes.forEach((task: any) => designer.createTask(task));
  compileGanttDsl(doc).edges.forEach((edge: any) => designer.createDependency(edge));
  return designer;
}

function buildPower(doc: any): any {
  const designer: any = new PowerDesigner(stubIce());
  const scene = compilePowerDsl(doc);
  scene.nodes.forEach((node: any) => designer.createSymbol(node.kind, node));
  scene.edges.forEach((edge: any) => designer.createLine(edge));
  scene.attachments.forEach((item: any) => designer.attachToBus(item.deviceId, item.busId));
  return designer;
}

const CASES: Array<{ kind: string; doc: any; build: (doc: any) => any }> = [
  { kind: 'flowchart', doc: FLOW_DOC, build: buildFlow },
  { kind: 'entity', doc: ER_DOC, build: buildEr },
  { kind: 'bpmn', doc: BPMN_DOC, build: buildBpmn },
  { kind: 'uml', doc: UML_DOC, build: buildUml },
  { kind: 'statechart', doc: STATECHART_DOC, build: buildStatechart },
  { kind: 'gantt', doc: GANTT_DOC, build: buildGantt },
  { kind: 'power', doc: POWER_DOC, build: buildPower },
];

describe('DSL 往返 · 通用契约', () => {
  CASES.forEach(({ kind, doc, build }) => {
    it(`${kind}：导出的文档可校验、可 JSON 序列化、且没有丢 id`, () => {
      const designer = build(doc);
      const back: any = toDsl({ kind, designer });

      const validation = validateDsl(back);
      expect(validation.errors).toEqual([]);
      expect(validation.valid).toBe(true);

      // 可序列化：没有 undefined / 函数
      expect(JSON.parse(JSON.stringify(back))).toEqual(back);

      const items: any[] = (back.nodes || back.entities || []) as any[];
      const sourceItems: any[] = (doc.nodes || doc.entities) as any[];
      const ids = items.map((item) => item.id);
      // 导出顺序 = 实例顺序（BPMN 会把容器排在业务图元之前，这是编译器的既定顺序）
      expect(ids).toEqual((designer.nodes || designer.entities).map((item: any) => item.state.id));
      // 身份集合必须与 Agent 产出时一致：否则下次迭代引用不上
      expect(new Set(ids)).toEqual(new Set(sourceItems.map((item) => item.id)));
      expect(new Set(ids).size).toBe(ids.length);

      // 连线 / 关系同理：文档里给了 id 就必须原样带回；没给则至少要拿到稳定可用的 id
      const edges: any[] = (back.edges || back.relations || []) as any[];
      const sourceEdges: any[] = (doc.edges || doc.relations || []) as any[];
      const edgeIds = edges.map((item) => item.id);
      expect(edgeIds).toEqual((designer.edges || designer.relations).map((item: any) => item.state.id));
      edgeIds.forEach((id) => expect(typeof id === 'string' && id.length > 0).toBe(true));
      sourceEdges
        .map((item) => item.id)
        .filter((id) => typeof id === 'string' && id.length > 0)
        .forEach((id) => expect(edgeIds).toContain(id));
    });

    it(`${kind}：把导出的文档再渲染一遍，节点 id 与位置与第一遍一致`, () => {
      const designer = build(doc);
      const back: any = toDsl({ kind, designer });
      const again = build(back);

      const first = (designer.nodes || designer.entities || []).map((node: any) => ({
        id: node.state.id,
        left: Math.round(node.state.left),
        top: Math.round(node.state.top),
      }));
      const second = (again.nodes || again.entities || []).map((node: any) => ({
        id: node.state.id,
        left: Math.round(node.state.left),
        top: Math.round(node.state.top),
      }));

      // 甘特没有坐标，只比对 id
      if (kind === 'gantt') {
        expect(second.map((item: any) => item.id)).toEqual(first.map((item: any) => item.id));
      } else {
        expect(second).toEqual(first);
      }
    });
  });
});

describe('DSL 往返 · 用户编辑要能读回来', () => {
  it('流程图：改名 + 拖动之后，导出的是编辑后的位置与标题', () => {
    const designer = buildFlow(FLOW_DOC);
    designer.updateNode('check', { title: '库存够吗？', left: 500, top: 480 });

    const back: any = toDsl({ kind: 'flowchart', designer });
    const node = back.nodes.filter((item: any) => item.id === 'check')[0];

    expect(node.title).toBe('库存够吗？');
    expect(node.left).toBe(500);
    expect(node.top).toBe(480);

    // 编辑后的文档仍然必须可校验、可再渲染
    expect(validateDsl(back).valid).toBe(true);
    expect(buildFlow(back).nodes.map((item: any) => item.state.id)).toEqual(
      designer.nodes.map((item: any) => item.state.id)
    );
  });

  it('电力一次图：开关分合与母线 T 接的状态要写回文档', () => {
    const designer = buildPower(POWER_DOC);
    designer.setSwitchState('qf', 'open');
    designer.detachFromBus('tv');

    const back: any = toDsl({ kind: 'power', designer });
    const breaker = back.nodes.filter((item: any) => item.id === 'qf')[0];
    const transformer = back.nodes.filter((item: any) => item.id === 'tv')[0];

    expect(breaker.switchState).toBe('open');
    expect(transformer.attachedTo).toBeUndefined();
    // 再渲染一遍：T 接已经断开，不再是隐式等电位
    expect(buildPower(back).isAttachedToBus(transformer.id)).toBe(false);
  });

  it('ER：改实体名与字段之后，导出的是编辑后的模型', () => {
    const designer = buildEr(ER_DOC);
    designer.updateEntity('order', { entityName: 'SalesOrder', fields: [{ name: 'id', type: 'number', primary: true, comment: '单号' }] });

    const back: any = toDsl({ kind: 'entity', designer });
    const entity = back.entities.filter((item: any) => item.id === 'order')[0];

    expect(entity.name).toBe('SalesOrder');
    expect(entity.fields[0].comment).toBe('单号');
    expect(validateDsl(back).valid).toBe(true);
  });
});

describe('DSL 往返 · 推断不出来时必须明确报错', () => {
  it('空实例无法判别类型：抛错，而不是悄悄当成 ER 文档', () => {
    const designer: any = new FlowDesigner(stubIce());
    expect(() => toDsl(designer)).toThrow(/kind/i);
    expect(() => toDsl({})).toThrow(/kind/i);
  });

  it('显式给出 kind 时照常工作（空文档也允许）', () => {
    const designer: any = new FlowDesigner(stubIce());
    expect(toDsl(designer, { kind: 'flowchart' })).toMatchObject({ kind: 'flowchart', nodes: [] });
    expect(toDsl({ kind: 'uml', designer }, {} as any)).toMatchObject({ kind: 'uml', nodes: [] });
  });
});
