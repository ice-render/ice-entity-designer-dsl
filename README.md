# ice-entity-designer-dsl

JSON-first DSL for AI agents to drive `ice-entity-designer` without learning the imperative canvas API.

One document kind, three shapes:

- **ER document** (`entities` / `relations`): entity-relation models and database schemas.
- **Flowchart document** (`kind: "flowchart"` with `nodes` / `edges`): process flows,
  decision trees, and algorithms, with optional coordinates (layered auto-layout).
- **BPMN document** (`kind: "bpmn"` with `nodes` / `edges`): business processes with
  participants (pools), lanes, events, gateways and message flows. Containers are
  nodes too, so the document stays a flat list; geometries are optional.
- **UML class diagram** (`kind: "uml"` with `nodes` / `edges`): classes, interfaces and
  enums with free-text members (`- id: string`, `+ pay(): void`), plus the six relation
  kinds (inheritance / realization / association / aggregation / composition /
  dependency). Coordinates are optional — inheritance drives a top-down layering.

The package contains:

- DSL types and schema (ER + flowchart + BPMN)
- structural validator
- compilers from DSL to Entity/Relation or FlowNode/FlowEdge props (shared layered layout)
- browser runtime that renders DSL through `ice-entity-designer`
- browser examples with a JSON editor (`examples/entity-editor-dsl.html`,
  `examples/flowchart-dsl.html`, `examples/bpmn-dsl.html`, `examples/uml-dsl.html`)

## Install

```bash
npm install
npm run build
```

## Browser usage

```html
<canvas id="canvas" width="1200" height="800"></canvas>

<script src="node_modules/ice-entity-designer/dist/index.umd.js"></script>
<script src="dist/index.umd.js"></script>
<script>
  const dsl = {
    schemaVersion: 1,
    layout: 'layered',
    entities: [
      { id: 'customer', name: 'Customer', fields: [{ name: 'id', type: 'number', primary: true }] },
      { id: 'order', name: 'Order', fields: [{ name: 'id', type: 'number', primary: true }] },
    ],
    relations: [
      { source: 'customer', target: 'order', type: 'one-to-many' },
    ],
  };

  const { ice, designer } = ICEDSL.renderDsl('canvas', dsl);
</script>
```

## Node/ESM usage

```ts
import { validateDsl, compileDsl, compileFlowDsl, renderDsl } from 'ice-entity-designer-dsl';
```

## Flowchart usage

Node coordinates are optional: if any node omits `left`/`top`, the whole graph is laid
out in layers (layer 0 = nodes without incoming edges; every other node = max
predecessor layer + 1).

```js
const flowchart = {
  schemaVersion: 1,
  kind: 'flowchart',
  nodes: [
    { id: 'start', kind: 'terminator', title: '开始' },
    { id: 'check', kind: 'decision', title: '库存充足？' },
    { id: 'done', kind: 'terminator', title: '结束' },
    { id: 'restock', kind: 'io', title: '通知补货' },
  ],
  edges: [
    { source: 'start', target: 'check' },
    { source: 'check', target: 'done', label: '是' },
    { source: 'check', target: 'restock', label: '否', sourcePort: 'R', targetPort: 'L' },
  ],
};

// kind === 'flowchart' 时 result.designer 是 FlowDesigner（createNode / createEdge / undo / …）
const result = ICEDSL.renderDsl('canvas', flowchart);
```

Node kinds: `terminator` (start/end pill) / `process` (action, default) / `decision`
(diamond) / `io` (parallelogram). Edge ports are `T` / `R` / `B` / `L` / `C` (default
`B` → `T`); `linkShape` is `visio` (orthogonal, default) or `bezier`.

## BPMN usage

Pools and lanes are nodes (`kind: "pool"` / `kind: "lane"`); everything else points
into a container with `parent`. Give coordinates and the compiler is the identity —
omit them and containers are sized from their contents while the flow nodes are laid
out left-to-right inside their container.

左侧是这份 DSL，右侧是它的渲染结果（`examples/bpmn-dsl.html`）——节点坐标全部省略，
池高、泳道条带与图元落位都是编译期算出来的：

<img src="https://raw.githubusercontent.com/ice-render/ice-entity-designer-dsl/main/examples/bpmn-dsl.png" alt="BPMN DSL 渲染示例" />

```js
const bpmn = {
  schemaVersion: 1,
  kind: 'bpmn',
  nodes: [
    { id: 'bank', kind: 'pool', title: '银行' },
    { id: 'accept', kind: 'lane', title: '受理岗', parent: 'bank' },
    { id: 'risk', kind: 'lane', title: '风控岗', parent: 'bank' },
    { id: 'submit', kind: 'event', title: '申请提交', eventKind: 'start', parent: 'accept' },
    { id: 'verify', kind: 'task', title: '身份核验', taskType: 'service', parent: 'accept' },
    { id: 'ok', kind: 'event', title: '申请通过', eventKind: 'end', parent: 'risk' },
  ],
  edges: [
    { source: 'submit', target: 'verify', label: '受理' },
    { source: 'verify', target: 'ok' },
  ],
};

const result = ICEDSL.renderDsl('canvas', bpmn);
// result.kind === 'bpmn'; result.designer is a BpmnDesigner
result.designer.validateBpmn();             // 语义检查：每个池一个开始事件、顺序流不跨池…
const xml = IED.toBpmnXml(result.designer); // BPMN 2.0 + BPMNDI（互操作格式，不是执行模型）
const svg = result.designer.toSvg();        // 矢量 SVG（与画布同一口径，放大不糊）
```

### UML usage

```js
const uml = {
  schemaVersion: 1,
  kind: 'uml',
  nodes: [
    { id: 'entity', kind: 'class', title: 'Entity', abstract: true, methods: ['+ save(): void'] },
    { id: 'user', kind: 'class', title: 'User', attributes: ['- email: string'] },
    { id: 'payable', kind: 'interface', title: 'Payable', methods: ['+ pay(): void'] },
  ],
  edges: [
    { source: 'user', target: 'entity', type: 'inheritance' },   // source = 子类，target = 父类
    { source: 'user', target: 'payable', type: 'realization' },
  ],
};

const result = ICEDSL.renderDsl('canvas', uml);
// result.kind === 'uml'; result.designer is a UmlDesigner
result.designer.validateUml();                 // 重名类 / 继承成环 / 悬空关系
result.designer.toSvg();                       // 矢量导出
IED.toPlantUml(result.designer);               // 文本互操作（PlantUML / Mermaid 语法子集）
IED.fromPlantUml(text, result.designer);       // 反向导入
```

Node kinds: `class` (default) / `interface` / `enum`. Relation `type`: `inheritance` /
`realization` / `association` / `aggregation` / `composition` / `dependency` — the
direction convention is inherited from PlantUML (`A <|-- B` = B inherits A, so the
edge is `{ source: 'B', target: 'A' }`).

Node kinds: `pool` / `lane` (containers), `task` (default), `event`, `gateway`,
`subprocess`, `dataObject`, `annotation`; events carry `eventKind` (start /
intermediate / end) + `trigger`, gateways carry `gatewayType` (exclusive / parallel
/ inclusive / event), tasks carry `taskType` (none / user / service / script / send
/ receive / manual). Edge `type`: `sequence` (default) / `message` (across pools) /
`association` (data objects, annotations); sequence flows also take `condition` and
`isDefault`.

## API

- `validateDsl(dsl)` —— ER / flowchart / BPMN / UML documents (dispatches on `kind`); `validateFlowDsl(dsl)` / `validateBpmnDsl(dsl)` / `validateUmlDsl(dsl)` for one kind only
- `compileDsl(dsl)` —— ER document → `Entity` / `Relation` props
- `compileFlowDsl(dsl)` —— flowchart document → `FlowNode` / `FlowEdge` props (with layered auto-layout)
- `compileBpmnDsl(dsl)` —— BPMN document → `FlowNode` / `FlowEdge` props (container auto-geometry + container-scoped auto-layout)
- `compileUmlDsl(dsl)` —— UML document → `UmlClass` / `UmlRelation` props (inheritance-driven layering)
- `layeredLayout(items, edges, options)` —— the shared layered layout (`direction: "vertical" | "horizontal"`)
- `renderDsl(canvasOrId, dsl)` —— renders any kind, returns `{ kind, ice, designer }`
- Export: `result.designer.toSvg(options)` (flowchart / BPMN) or `IED.exportSvg(result.ice, options)`; `options` = `{ area: 'content' | 'viewport', padding, scale, background, includeTools }`. The SVG is regenerated from the component tree + path commands, so it matches the canvas (geometry, styles, opacity, shadows, link labels) and can be rasterised to PNG/PDF by any external tool.
- `DSL_SCHEMA_VERSION`

## Example

Open `examples/entity-editor-dsl.html` (ER), `examples/flowchart-dsl.html`
(flowchart), `examples/bpmn-dsl.html` (BPMN) or `examples/uml-dsl.html` (UML) after building.

## Agent discovery

Agents can use this project through:

1. npm package exports
2. `AGENTS.md`
3. `skills/ice-entity-designer-dsl/SKILL.md`
4. optional MCP wrapper in a separate package

The core runtime does not require MCP.
