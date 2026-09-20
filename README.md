# ice-entity-designer-dsl

JSON-first DSL for AI agents to drive `ice-entity-designer` without learning the imperative canvas API.

One JSON DSL, seven document kinds — the same document drives rendering, validation and export:

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
- **Gantt** (`kind: "gantt"` with `nodes` / `edges`): a schedule — each task carries `start`
  (`YYYY-MM-DD`), `days` and `progress`; edges are finish-to-start dependencies. **No
  coordinates at all**: the horizontal axis is time, the vertical axis is declaration order.
- **Statechart** (`kind: "statechart"` with `nodes` / `edges`): initial/final pseudo-states,
  states, **composite states** (containers — children follow when you drag the parent) and
  transitions labelled `event [guard] / action`. Coordinates are optional — the flow lays
  out left to right.
- **Power document** (`kind: "power"`): one-line diagrams — equipment kinds mirror
  `ice-entity-designer`'s power pack, `attachedTo` expresses a busbar T-connection and
  `voltageLevel` drives the colour code. Semantic checks (voltage consistency / busbar feed /
  五防) live in `result.designer.validatePower()`. Coordinates are optional.

The package contains:

- DSL types and schema, plus a structural validator that dispatches on `kind`
- compilers from DSL to component props: `compileDsl` (ER) / `compileFlowDsl` / `compileBpmnDsl` /
  `compileUmlDsl` / `compileStatechartDsl` / `compileGanttDsl` / `compilePowerDsl`, sharing one
  layered layout
- browser runtime that renders DSL through `ice-entity-designer`
- browser examples with a JSON editor (`examples/entity-editor-dsl.html`,
  `examples/flowchart-dsl.html`, `examples/bpmn-dsl.html`, `examples/uml-dsl.html`,
  `examples/statechart-dsl.html`, `examples/gantt-dsl.html`, `examples/power-dsl.html`)
- all diagram examples share `examples/canvas-interactions.js`: canvas fills the preview
  pane, wheel zooms at the cursor (`ICE.zoomAt`), dragging blank space (or any middle-button
  drag) pans, plus 「适应视图 / 复位视图」 buttons

## Install

```bash
npm install ice-entity-designer-dsl
```

`ice-entity-designer`（DSL 的渲染目标）与引擎 `ice-render` 都是本包的 **peer dependency**：
两者在 UMD 产物里同样是 **external**（`globals: { 'ice-render': 'ICE' }` /
`{ 'ice-entity-designer': 'IED' }`），由宿主提供 —— 所以一个纯 `<script>` 页面必须**按这个顺序**
加载三份 UMD：`ice-render` → `ice-entity-designer` → `dist/index.umd.js`（见下）。

> npm 7+ 会自动装 peer 依赖，`npm install ice-entity-designer-dsl` 依旧一次装齐；
> 区别是**版本由宿主决定**（不会再嵌一份旧副本，避免两个 designer 实例/类身份不一致）。

## Browser usage

```html
<canvas id="canvas" width="1200" height="800"></canvas>

<script src="node_modules/ice-render/dist/index.umd.js"></script>
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

### Gantt usage

```js
const plan = {
  schemaVersion: 1,
  kind: 'gantt',
  nodes: [
    { id: 'review', title: '需求评审', start: '2026-03-02', days: 4, progress: 1 },
    { id: 'design', title: '交互设计', start: '2026-03-05', days: 6, progress: 0.8 },
    { id: 'frontend', title: '前端开发', start: '2026-03-10', days: 12, progress: 0.35 },
  ],
  edges: [
    { source: 'review', target: 'design' },      // 完成 → 开始
    { source: 'design', target: 'frontend' },
  ],
  options: { dayWidth: 28, fitViewport: true },
};

const result = ICEDSL.renderDsl('canvas', plan);
// result.kind === 'gantt'; result.designer is a GanttDesigner
result.designer.validateGantt();   // 依赖成环 / 进度越界 / 天数非法 / 资源冲突
result.designer.autoSchedule();    // 自动排程：按依赖推到「前置结束之后」（只推后不提前）
result.designer.criticalPath();    // 关键路径（按「尽早排」归一化算浮时）
result.designer.toSvg();           // 矢量导出（含日期刻度与进度）
```

`options.autoSchedule: true` 可以让**渲染时**就按依赖把排期推到最早可行（文档里写的日期当作下界），
`resource` 字段用于资源冲突检查（同一负责人时间重叠会在 `validateGantt()` 里报出）。
关键路径用 CPM 的标准口径：有前置的任务由前置的最早完工决定，没有前置的才以自身日期为锚，
所以末端任务的日期被手写得很晚、或者刚跑完 `autoSchedule()`，链路判定都不会退化成单个任务。

Fields: `start` (`YYYY-MM-DD`, required), `days` (default 1), `progress` (0..1, default 0),
`row` (defaults to declaration order). **Do not invent coordinates** — the timeline is derived;
dragging a bar in the editor snaps it to whole days.

### Statechart usage

```js
const chart = {
  schemaVersion: 1,
  kind: 'statechart',
  nodes: [
    { id: 'start', kind: 'initial' },
    { id: 'pending', title: '待支付' },
    { id: 'paid', title: '已支付' },
    { id: 'processing', kind: 'composite', title: '订单处理' },
    { id: 'stock', title: '库存校验', parent: 'processing' },   // 子状态：进复合状态
    { id: 'done', kind: 'final' },
  ],
  edges: [
    { source: 'start', target: 'pending' },
    { source: 'pending', target: 'paid', event: '支付成功', guard: '金额 > 0', action: '生成订单' },
    { source: 'paid', target: 'stock', event: '进入处理' },
    { source: 'stock', target: 'done', event: '已发货' },
  ],
};

const result = ICEDSL.renderDsl('canvas', chart);
// result.kind === 'statechart'; result.designer is a StatechartDesigner
result.designer.validateStatechart();  // 缺初始状态 / 终态出边 / 孤立节点 / 不可达
result.designer.toSvg();               // 矢量导出（实心箭头也是填充路径）
```

Node kinds: `initial` (filled dot) / `final` (bullseye) / `state` (rounded box, default) /
`composite` (container; children declared with `parent`). Transition labels are composed
from `event` / `guard` / `action` (missing parts are omitted).

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

- `validateDsl(dsl)` —— ER / flowchart / BPMN / UML / statechart / gantt / power documents (dispatches on `kind`); `validateFlowDsl(dsl)` / `validateBpmnDsl(dsl)` / `validateUmlDsl(dsl)` / `validateStatechartDsl(dsl)` / `validateGanttDsl(dsl)` / `validatePowerDsl(dsl)` for one kind only
  - 返回值除了 `{ valid, errors }`（英文句子，给人看）还带 **`diagnostics`**：`{ severity, code, message, path }`，
    其中 **`code` 才是合同**（`IED_DSL_*`，见 `src/types.ts` 的 `IED_DSL_CODES`），`path` 指出位置（如 `nodes[3].source`）。
    **Agent / 工具请按 `code` 分支、按 `path` 定位**，不要匹配 `message` 里的自然语言 —— 这是
    ice-render [`docs/architecture/17-i18n-boundary.md`](../ice-render/docs/architecture/17-i18n-boundary.md)
    里那条「库不翻译文案，但必须给稳定 id」的契约。
  - 常用码：`IED_DSL_ROOT_NOT_OBJECT` / `IED_DSL_SCHEMA_VERSION_UNSUPPORTED` / `IED_DSL_ID_INVALID` /
    `IED_DSL_ID_DUPLICATED` / `IED_DSL_NOT_OBJECT` / `IED_DSL_NODES_NOT_ARRAY` / `IED_DSL_EDGES_NOT_ARRAY` /
    `IED_DSL_KIND_INVALID` / `IED_DSL_FIELD_TYPE` / `IED_DSL_FIELD_ENUM` / `IED_DSL_FIELD_FORMAT` /
    `IED_DSL_FIELD_RANGE` / `IED_DSL_EDGE_ENDPOINT_INVALID` / `IED_DSL_EDGE_ENDPOINT_UNKNOWN` /
    `IED_DSL_EDGE_SELF_LOOP` / `IED_DSL_PARENT_INVALID` / `IED_DSL_PARENT_UNKNOWN` / `IED_DSL_PARENT_SELF` /
    `IED_DSL_PARENT_KIND` / `IED_DSL_PARENT_NOT_ALLOWED` / `IED_DSL_ATTACHED_TO_UNKNOWN` /
    `IED_DSL_ATTACHED_TO_NOT_BUSBAR`（完整列表见 `src/types.ts`）。
- `compileDsl(dsl)` —— ER document → `Entity` / `Relation` props
- `compileFlowDsl(dsl)` —— flowchart document → `FlowNode` / `FlowEdge` props (with layered auto-layout)
- `compileBpmnDsl(dsl)` —— BPMN document → `FlowNode` / `FlowEdge` props (container auto-geometry + container-scoped auto-layout)
- `compileUmlDsl(dsl)` —— UML document → `UmlClass` / `UmlRelation` props (inheritance-driven layering)
- `compileStatechartDsl(dsl)` —— statechart document → `StateNode` / `StateTransition` props (flow layering + composite auto-sizing)
- `compileGanttDsl(dsl)` —— gantt document → `GanttTask` / `GanttDependency` props (no coordinates; rows filled in)
- `compilePowerDsl(dsl)` —— power document → `PowerSymbol` / `PowerLine` props (busbar T-connections resolved, voltage colour code applied)
- `layeredLayout(items, edges, options)` —— the shared layered layout (`direction: "vertical" | "horizontal"`)
- `renderDsl(canvasOrId, dsl)` —— renders any kind, returns `{ kind, ice, designer }`
- `renderPowerDsl(canvasOrId, dsl)` —— power documents specifically (`renderFlowDsl` / `renderBpmnDsl` / `renderUmlDsl` / `renderStatechartDsl` / `renderGanttDsl` are the per-kind equivalents)
- Export: `result.designer.toSvg(options)` (flowchart / BPMN) or `IED.exportSvg(result.ice, options)`; `options` = `{ area: 'content' | 'viewport', padding, scale, background, includeTools }`. The SVG is regenerated from the component tree + path commands, so it matches the canvas (geometry, styles, opacity, shadows, link labels) and can be rasterised to PNG/PDF by any external tool.
- `DSL_SCHEMA_VERSION`

## Round-trip: render → edit → `toDsl()`

`renderDsl()` 返回的对象自带 `toDsl()`，用来把**用户改过的实例**写回成同一份 DSL 文档：

```js
const result = ICEDSL.renderDsl('canvas', doc);

// 用户在画布上拖动 / 改名 / 分合 / 增删……
result.designer.updateNode('check', { title: '库存够吗？', left: 500, top: 480 });

const edited = result.toDsl();        // 同一份 DSL：位置与语义改动都在
ICEDSL.validateDsl(edited).valid;     // true —— 导出结果永远能过校验
ICEDSL.renderDsl('canvas', edited);   // 也能直接再渲染一遍
```

单独使用时是 `toDsl(resultOrDesigner, { kind? })`（不传 `kind` 时按图元自动判别）。

契约（7 种 `kind` 都有测试兜底）：

- **id 保真**：Agent 产出时用的 `id` 原样带回（导出顺序 = 实例顺序，BPMN 会把池/泳道排在业务图元之前）；
  文档里没写 `id` 的连线会拿到 `edge-0` 这类稳定 id，而不是每次重新生成的随机 UUID；
- **坐标是绝对坐标**：嵌套容器（BPMN 池 / 泳道、状态机复合状态）的相对坐标已沿父链还原；
- **只导出 DSL 词汇表里的字段**：引擎内部字段（zIndex、变换矩阵等）不外泄；
- **必过校验、必须可序列化**：结果里没有 `undefined`，`JSON.parse(JSON.stringify(doc))` 无损往返；
- **再渲染等价**：把导出的文档再渲染一遍，节点 id 与位置与上一遍一致；
- **推断不出来就报错**：实例里没有任何可识别图元时，`toDsl()` 抛错并提示显式传 `kind`，不会悄悄当成 ER 文档。

## Example

Open `examples/entity-editor-dsl.html` (ER), `examples/flowchart-dsl.html`
(flowchart), `examples/bpmn-dsl.html` (BPMN), `examples/uml-dsl.html` (UML),
`examples/statechart-dsl.html` (statechart), `examples/gantt-dsl.html` (gantt) or
`examples/power-dsl.html` (power one-line diagram) after building.
渲染结果可以滚轮缩放、空白处拖拽平移，工具栏还有「适应视图 / 复位视图」。

每个示例页都有一个 **「导出当前文档」** 按钮：在画布上拖动 / 改名 / 分合之后点一下，
左侧 JSON 立刻变成**你改过之后**的那份文档（仍是同一份 DSL，可直接再渲染回去）。
在控制台执行 `window.__dslResult.toDsl()` 拿到的是同一个结果。

## Agent discovery

Agents can use this project through:

1. npm package exports
2. `AGENTS.md`
3. `skills/ice-entity-designer-dsl/SKILL.md`
4. optional MCP wrapper in a separate package

The core runtime does not require MCP.
