# ice-entity-designer-dsl

JSON-first DSL for AI agents to drive `ice-entity-designer` without learning the imperative canvas API.

One document kind, two shapes:

- **ER document** (`entities` / `relations`): entity-relation models and database schemas.
- **Flowchart document** (`kind: "flowchart"` with `nodes` / `edges`): process flows,
  decision trees, and algorithms, with optional coordinates (layered auto-layout).

The package contains:

- DSL types and schema (ER + flowchart)
- structural validator
- compilers from DSL to Entity/Relation or FlowNode/FlowEdge props
- browser runtime that renders DSL through `ice-entity-designer`
- browser examples with a JSON editor (`examples/entity-editor-dsl.html`, `examples/flowchart-dsl.html`)

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

## API

- `validateDsl(dsl)` —— ER / flowchart documents (dispatches on `kind`); `validateFlowDsl(dsl)` for flowcharts only
- `compileDsl(dsl)` —— ER document → `Entity` / `Relation` props
- `compileFlowDsl(dsl)` —— flowchart document → `FlowNode` / `FlowEdge` props (with layered auto-layout)
- `renderDsl(canvasOrId, dsl)` —— renders either kind, returns `{ kind, ice, designer }`
- `DSL_SCHEMA_VERSION`

## Example

Open `examples/entity-editor-dsl.html` (ER) or `examples/flowchart-dsl.html` (flowchart) after building.

## Agent discovery

Agents can use this project through:

1. npm package exports
2. `AGENTS.md`
3. `skills/ice-entity-designer-dsl/SKILL.md`
4. optional MCP wrapper in a separate package

The core runtime does not require MCP.
