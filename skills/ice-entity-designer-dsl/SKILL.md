---
name: ice-entity-designer-dsl
description: Generate JSON-first DSL documents (ER models, flowcharts, BPMN 2.0 processes, UML class diagrams, statecharts, or gantt schedules) for ice-entity-designer. For interactive editor demos or pages, route to ice-entity-designer instead.
version: "1.3.5"
category: data
platforms:
  - claude-code
  - codex-cli
  - copilot
  - cursor
  - gemini-cli
  - other
metadata:
  short-description: JSON-first ER + flowchart + BPMN 2.0 + UML + statechart + gantt DSL, plus canonical interactive ice-entity-designer editor demo guidance.
---

# ice-entity-designer-dsl

Use this skill when the requested artifact is a **JSON DSL document** that can be
consumed or rendered by `ice-entity-designer`. Three document kinds are supported:

- **ER document** (`entities` / `relations`): an Entity-Relation model or
  database schema (the original mode of this skill).
- **Flowchart document** (`kind: "flowchart"` with `nodes` / `edges`): a process
  flow, decision tree, or algorithm diagram.
- **BPMN document** (`kind: "bpmn"` with `nodes` / `edges`): a business process
  with participants (pools), lanes, events, gateways and message flows.

This skill is **not** the interactive `ice-entity-designer` editor. If the
user asks for a runnable page, a visual demo, or an editor they can click and
drag, use `ice-entity-designer` directly. Do not wrap `ICEDSL.renderDsl()` in
HTML and present that as the designer demo.

## Decide what to produce

Start by classifying the request:

| Requested artifact | Use | Deliverable |
| --- | --- | --- |
| ER model / schema as JSON data | `ice-entity-designer-dsl` | one JSON DSL document |
| Static ER diagram rendered from a known DSL document | `ICEDSL.renderDsl()` | minimal canvas page only when explicitly requested |
| Flowchart / process flow / decision tree as JSON data | `ice-entity-designer-dsl` | one flowchart DSL document (`kind: "flowchart"`) |
| Static flowchart rendered from a DSL document | `ICEDSL.renderDsl()` | minimal canvas page only when explicitly requested |
| Business process with pools / lanes / participants as JSON data | `ice-entity-designer-dsl` | one BPMN DSL document (`kind: "bpmn"`) |
| Static BPMN diagram rendered from a DSL document | `ICEDSL.renderDsl()` | minimal canvas page only when explicitly requested |
| Interactive ER editor / "make a demo" / "show what the designer can do" | `ice-entity-designer` imperative API | HTML/JS editor page |
| Interactive flowchart editor | `ice-entity-designer` (`FlowDesigner`) | HTML/JS editor page (see `tests/flowchart-editor.html`) |
| Interactive BPMN editor | `ice-entity-designer` (`BpmnDesigner`) | HTML/JS editor page (see `tests/bpmn-editor.html`) |
| React integration / controlled designer / hooks | `ice-entity-designer/react` | React app |
| TypeORM schema or code generation | `ice-entity-designer` | `toSchemaObject()` / `toSchemaString()` result |

The phrase "画一个 demo" almost always means the third row: build an
interactive editor, not return DSL JSON and not build a static
`ICEDSL.renderDsl()` viewer.

## Interactive editor demo build guide

When the requested artifact is an interactive ER editor, use
`ice-entity-designer`, **not** `ice-entity-designer-dsl`.

### Runtime setup

For a no-build HTML demo:

- create `index.html`
- copy `ice-entity-designer/dist/index.umd.js` next to `index.html`
- load `<script src="./ice-entity-designer.umd.js"></script>`
- use the global `IED` namespace:

```js
const ice = new IED.ICE().init('canvas-1');
const designer = new IED.EntityDesigner(ice);
ice.alignmentGuide.enable({ threshold: 6 });
```

Do **not** load `ice-entity-designer-dsl.umd.js` for an interactive editor.
That bundle is for JSON DSL rendering only. Mixing the two bundles is the most
common way agents produce a static viewer instead of the real editor.

For React, use `ice-entity-designer/react` and the `EntityDesignerCanvas`
component described below.

### Page anatomy an agent must produce

The page should have three zones:

1. Toolbar
2. Canvas
3. Side panel

Minimum toolbar controls:

- add entity
- delete selected
- connect/link mode
- undo
- redo
- validate
- save project
- load project
- export TypeORM Schema
- reset view
- relation type selector
- relation link-shape selector

Minimum side panel capabilities:

- edit selected entity name
- edit entity fields: name, type, length, constraints
- add and remove entity fields
- edit selected relation type, link shape, source/target fields,
  `onDelete`, `onUpdate`, `joinTableName`
- show validation result
- show serialized project JSON
- show TypeORM Schema JSON

Canvas capabilities:

- entities are draggable
- wheel zoom at the pointer
- blank-space drag pan
- selection updates the side panel
- link mode shows a preview while selecting source and target entities

A minimal DOM skeleton:

```html
<div class="toolbar">
  <button id="btn-add-entity">新增实体</button>
  <button id="btn-delete-selected">删除选中</button>
  <select id="rel-type">
    <option value="one-to-many">one-to-many</option>
    <option value="many-to-one">many-to-one</option>
    <option value="one-to-one">one-to-one</option>
    <option value="many-to-many">many-to-many</option>
  </select>
  <select id="rel-shape">
    <option value="visio">Visio 折线</option>
    <option value="bezier">贝塞尔曲线</option>
  </select>
  <button id="btn-toggle-link">连接关系</button>
  <button id="btn-undo">撤销</button>
  <button id="btn-redo">重做</button>
  <button id="btn-validate">校验</button>
  <button id="btn-save-project">保存项目</button>
  <button id="btn-load-project">加载项目</button>
  <button id="btn-schema">导出 TypeORM Schema</button>
  <button id="btn-reset">重置视图</button>
</div>

<div class="canvas-wrap">
  <canvas id="canvas-1" width="2200" height="1700"></canvas>
  <svg id="link-preview" viewBox="0 0 2200 1700" preserveAspectRatio="none">
    <path id="link-preview-path" d=""></path>
  </svg>
</div>

<aside class="side">
  <div id="property-panel"></div>
  <pre id="schema-output" hidden></pre>
  <div id="validation-output"></div>
</aside>
```

### Core API surface

```js
const ice = new IED.ICE().init('canvas-1');
const designer = new IED.EntityDesigner(ice);

designer.entities;              // Entity[]
designer.relations;             // Relation[]
designer.selectedId;            // string | null
designer.selected;              // Entity | Relation | null

designer.createEntity(props);   // -> Entity
designer.createRelation(props); // -> Relation
designer.updateEntity(id, patch);
designer.updateRelation(id, patch);
designer.removeComponent(id);   // removes entity and its linked relations
designer.select(id);

designer.undo();
designer.redo();
designer.canUndo();
designer.canRedo();
designer.captureHistory();

designer.validate();
designer.serializeProject();    // -> JSON string
designer.loadProject(json);
designer.toSchemaObject();      // -> TypeORM EntitySchema array
designer.toSchemaString();      // -> JSON string
designer.subscribe(listener);   // -> unsubscribe
```

Entity instances expose:

```js
entity.state.id;
entity.state.entityName;
entity.state.fields;
entity.setFields(fields);
entity.addField(field);
entity.removeField(fieldName);
entity.setPosition(x, y);
entity.getMinBoundingBox(true);
```

Relation instances expose:

```js
relation.state.id;
relation.state.relationType;
relation.state.linkShape;
relation.state.sourceField;
relation.state.targetField;
relation.state.onDelete;
relation.state.onUpdate;
relation.state.joinTableName;
relation.state.links;
```

### Seed model

Do not start with an empty canvas. Seed a compact, readable model so the demo
immediately shows what the designer can do:

```js
const idField = {
  name: 'id',
  type: 'number',
  primary: true,
  autoIncrement: true,
  nullable: false
};

function addEntity(name, left, top, fields) {
  return designer.createEntity({
    entityName: name,
    left,
    top,
    fields,
    style: { fillStyle: '#ffffff', strokeStyle: '#94a3b8', radius: 10, lineWidth: 1.5 },
    headerStyle: { textColor: '#0f766e', fontSize: 18 },
    fieldStyle: { textColor: '#334155', fontSize: 15 },
    dividerStyle: { strokeStyle: '#e2e8f0' }
  });
}

function addRelation(source, target, props = {}) {
  const sourceBox = source.getMinBoundingBox(true);
  const targetBox = target.getMinBoundingBox(true);
  const dx = targetBox.center[0] - sourceBox.center[0];
  const dy = targetBox.center[1] - sourceBox.center[1];
  const startPosition = Math.abs(dx) > Math.abs(dy)
    ? (dx >= 0 ? 'R' : 'L')
    : (dy >= 0 ? 'B' : 'T');
  const endPosition = Math.abs(dx) > Math.abs(dy)
    ? (dx >= 0 ? 'L' : 'R')
    : (dy >= 0 ? 'T' : 'B');

  return designer.createRelation({
    ...props,
    sourceId: source.state.id,
    targetId: target.state.id,
    links: {
      start: { id: source.state.id, position: startPosition },
      end: { id: target.state.id, position: endPosition }
    }
  });
}

const customer = addEntity('Customer', 120, 120, [
  idField,
  { name: 'email', type: 'string', unique: true, nullable: false },
  { name: 'name', type: 'string', nullable: false }
]);

const order = addEntity('Order', 560, 120, [
  idField,
  { name: 'customerId', type: 'number', foreignKey: true, index: true, nullable: false },
  { name: 'status', type: 'string', nullable: false, default: 'pending' },
  { name: 'total', type: 'decimal', length: '12,2' }
]);

addRelation(customer, order, {
  relationType: 'one-to-many',
  sourceField: 'id',
  targetField: 'customerId',
  sourceCardinality: '1',
  targetCardinality: '0..N',
  label: 'places',
  onDelete: 'CASCADE',
  linkShape: 'visio'
});
```

### Required interaction patterns

Define these references once:

```js
const canvas = document.getElementById('canvas-1');
const linkPreviewPath = document.getElementById('link-preview-path');
const validationOutput = document.getElementById('validation-output');
const schemaOutput = document.getElementById('schema-output');
let linkingMode = false;
```

#### Selection

`EntityDesigner` already selects on `mousedown`. Re-render the side panel on
that event:

```js
ice.evtBus.on('mousedown', () => {
  setTimeout(renderPanel, 0);
});

function renderPanel() {
  const selected = designer.selected;
  const type = componentType(selected);
  if (type === 'Entity') renderEntityPanel(selected);
  else if (type === 'Relation') renderRelationPanel(selected);
  else {
    document.getElementById('property-panel').textContent =
      '点击画布中的 Entity 或 Relation 进行编辑';
  }
}
```

`renderEntityPanel` and `renderRelationPanel` are the DOM builders described in
the next two sections.

Never detect component type with `constructor.name`; downstream bundlers may
mangle it. Use the stable type ids:

```js
function componentType(component) {
  return component && component.constructor && component.constructor.typeId;
}

// 'Entity' | 'Relation' | null
```

#### Zoom and pan

**Use the engine primitive for zoom.** `ICE.zoomAt(screenX, screenY, factor, minScale, maxScale)`
already does anchored zoom (it resolves the world point under the cursor via
`screenToWorld()` and re-solves the translate). Do not hand-roll the
`screenToWorld` + `setViewport` math — that duplicates engine code and drifts.

```js
canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault(); // 需要 { passive: false }，否则部分浏览器忽略 preventDefault
    // 锚点 canvas 坐标、倍数、最小/最大 scale（默认 0.05 / 20）
    ice.zoomAt(event.offsetX, event.offsetY, event.deltaY < 0 ? 1.1 : 1 / 1.1, 0.3, 3);
  },
  { passive: false }
);
```

Panning stays application-level (the engine only ships the `setViewport()` /
`hitTest()` primitives — see the engine's gap analysis): blank-space drag or
middle-button drag shifts the translate by the pointer delta.

```js
let panning = false;
let lastX = 0;
let lastY = 0;

canvas.addEventListener('mousedown', (event) => {
  if (linkingMode) return;
  const point = [event.offsetX, event.offsetY];
  const blank = event.button === 0 && !ice.hitTest(point[0], point[1]);
  if (event.button !== 1 && !blank) return;
  event.preventDefault();
  panning = true;
  lastX = point[0];
  lastY = point[1];
});

canvas.addEventListener('mousemove', (event) => {
  if (!panning) return;
  const dx = event.offsetX - lastX;
  const dy = event.offsetY - lastY;
  lastX = event.offsetX;
  lastY = event.offsetY;
  ice.setViewport(ice.viewport.scale, ice.viewport.tx + dx, ice.viewport.ty + dy);
});

canvas.addEventListener('mouseup', () => { panning = false; });
canvas.addEventListener('mouseleave', () => { panning = false; });
```

If you also implement link mode, merge the `mousedown` / `mousemove` listeners
below with these handlers instead of registering conflicting listeners.

#### Link mode

Implement source-then-target selection, not a fake line:

```js
let linkSource = null;

function findRootEntity(component) {
  let root = component;
  while (root && root.parentNode) root = root.parentNode;
  return root && root.constructor && root.constructor.typeId === 'Entity'
    ? root
    : null;
}

function entityCenter(entity) {
  const box = entity.getMinBoundingBox(true);
  const center = box.center;
  return ice.worldToScreen(center[0], center[1]);
}

function setLinkingMode(enabled) {
  linkingMode = enabled;
  linkSource = null;
  designer.entities.forEach((entity) => {
    entity.setState({ draggable: !enabled });
  });
  if (!enabled) {
    hideLinkPreview();
  }
}

function orthogonalPreview(x1, y1, x2, y2) {
  if (Math.abs(x2 - x1) > Math.abs(y2 - y1)) {
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  }
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
}

function showLinkPreview(entity) {
  const [x, y] = entityCenter(entity);
  linkPreviewPath.setAttribute('d', orthogonalPreview(x, y, x, y));
  document.getElementById('link-preview').style.display = 'block';
}

function hideLinkPreview() {
  document.getElementById('link-preview').style.display = 'none';
}

canvas.addEventListener('mousedown', (event) => {
  if (!linkingMode) return;
  const hit = ice.hitTest(event.offsetX, event.offsetY);
  const entity = findRootEntity(hit);
  if (!entity) return;
  event.preventDefault();
  event.stopPropagation();

  if (!linkSource) {
    linkSource = entity;
    showLinkPreview(entity);
  } else if (linkSource.state.id !== entity.state.id) {
    designer.createRelation({
      sourceId: linkSource.state.id,
      targetId: entity.state.id,
      relationType: document.getElementById('rel-type').value,
      linkShape: document.getElementById('rel-shape').value
    });
    setLinkingMode(false);
    renderPanel();
  } else {
    linkSource = null;
    hideLinkPreview();
  }
});

canvas.addEventListener('mousemove', (event) => {
  if (!linkingMode || !linkSource) return;
  const [sx, sy] = entityCenter(linkSource);
  linkPreviewPath.setAttribute('d', orthogonalPreview(sx, sy, event.offsetX, event.offsetY));
});
```

#### Entity property panel

Plain DOM is sufficient. The important part is that edits go back into the
entity:

```js
function commitEntityName(entity, value) {
  designer.updateEntity(entity.state.id, {
    entityName: value || 'Entity Name'
  });
}

function commitField(entity, index, patch) {
  const fields = [...(entity.state.fields || [])];
  fields[index] = { ...fields[index], ...patch };
  entity.setFields(fields);
}

function addField(entity) {
  entity.addField({ name: 'newField', type: 'string' });
}

function removeFieldAt(entity, index) {
  const fields = [...(entity.state.fields || [])];
  fields.splice(index, 1);
  entity.setFields(fields);
}
```

Constraint values map back to booleans:

```js
function commitConstraints(entity, index, values) {
  commitField(entity, index, {
    primary: values.includes('PK'),
    foreignKey: values.includes('FK'),
    unique: values.includes('UQ'),
    autoIncrement: values.includes('AI'),
    nullable: !values.includes('NN'),
    generated: values.includes('GEN'),
    index: values.includes('IDX')
  });
}
```

Example plain-DOM entity panel:

```js
function renderEntityPanel(entity) {
  const panel = document.getElementById('property-panel');
  panel.innerHTML = '';

  const name = document.createElement('input');
  name.value = entity.state.entityName || '';
  name.addEventListener('change', () => commitEntityName(entity, name.value));
  panel.appendChild(name);

  (entity.state.fields || []).forEach((field, index) => {
    const row = document.createElement('div');

    const fieldName = document.createElement('input');
    fieldName.value = field.name || '';
    fieldName.addEventListener('change', () => commitField(entity, index, { name: fieldName.value }));
    row.appendChild(fieldName);

    const fieldType = document.createElement('input');
    fieldType.value = field.type || '';
    fieldType.addEventListener('change', () => commitField(entity, index, { type: fieldType.value }));
    row.appendChild(fieldType);

    const remove = document.createElement('button');
    remove.textContent = '删除';
    remove.addEventListener('click', () => {
      removeFieldAt(entity, index);
      renderPanel();
    });
    row.appendChild(remove);

    panel.appendChild(row);
  });

  const add = document.createElement('button');
  add.textContent = '新增字段';
  add.addEventListener('click', () => {
    addField(entity);
    renderPanel();
  });
  panel.appendChild(add);
}
```

#### Relation property panel

Use `designer.updateRelation(id, patch)` for every relation form control:

```js
const relation = designer.selected;
if (componentType(relation) === 'Relation') {
  designer.updateRelation(relation.state.id, {
    relationType: 'many-to-many',
    linkShape: 'bezier',
    sourceField: 'id',
    targetField: 'id',
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
    joinTableName: 'user_roles'
  });
}
```

Example plain-DOM relation panel:

```js
function renderRelationPanel(relation) {
  const panel = document.getElementById('property-panel');
  panel.innerHTML = '';

  const type = document.createElement('select');
  ['one-to-many', 'many-to-one', 'one-to-one', 'many-to-many'].forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    type.appendChild(option);
  });
  type.value = relation.state.relationType || 'one-to-many';
  type.addEventListener('change', () => {
    designer.updateRelation(relation.state.id, { relationType: type.value });
    renderPanel();
  });
  panel.appendChild(type);

  const shape = document.createElement('select');
  ['visio', 'bezier'].forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    shape.appendChild(option);
  });
  shape.value = relation.state.linkShape || 'visio';
shape.addEventListener('change', () => {
  designer.updateRelation(relation.state.id, { linkShape: shape.value });
  renderPanel();
});
panel.appendChild(shape);
}
```

Extend this pattern with inputs for `sourceField`, `targetField`,
`joinTableName`, and selects for `onDelete` / `onUpdate`; each control calls
`designer.updateRelation(relation.state.id, { [key]: value })`.

#### Toolbar actions

```js
document.getElementById('btn-add-entity').addEventListener('click', () => {
  designer.createEntity({
    entityName: 'NewEntity',
    fields: [{ name: 'id', type: 'number', primary: true, autoIncrement: true }]
  });
  renderPanel();
});

document.getElementById('btn-toggle-link').addEventListener('click', () => {
  setLinkingMode(!linkingMode);
});

document.getElementById('btn-delete-selected').addEventListener('click', () => {
  if (designer.selectedId) {
    designer.removeComponent(designer.selectedId);
    renderPanel();
  }
});

document.getElementById('btn-undo').addEventListener('click', () => {
  designer.undo();
  renderPanel();
});

document.getElementById('btn-redo').addEventListener('click', () => {
  designer.redo();
  renderPanel();
});

document.getElementById('btn-validate').addEventListener('click', () => {
  const issues = designer.validate();
  validationOutput.textContent = issues.length
    ? issues.map((issue) => `${issue.level}: ${issue.message}`).join('\n')
    : 'Schema valid';
});

document.getElementById('btn-schema').addEventListener('click', () => {
  schemaOutput.hidden = false;
  schemaOutput.textContent = JSON.stringify(designer.toSchemaObject(), null, 2);
});

document.getElementById('btn-save-project').addEventListener('click', () => {
  localStorage.setItem('ice-entity-designer-project', designer.serializeProject());
});

document.getElementById('btn-load-project').addEventListener('click', () => {
  const json = localStorage.getItem('ice-entity-designer-project');
  if (json) {
    designer.loadProject(json);
    renderPanel();
  }
});

document.getElementById('btn-reset').addEventListener('click', () => {
  ice.setViewport(1, 0, 0);
});
```

### Demo anti-patterns

Do **not**:

- use `ICEDSL.renderDsl()` and call the result an interactive editor
- build only model/layout/link-shape buttons around a static canvas
- rebuild the canvas element on every model change
- make entities non-draggable except while link mode is active
- omit the entity/relation property panels
- omit TypeORM Schema and validation output
- use `constructor.name` for type checks; use `constructor.typeId`
- load both `ice-entity-designer-dsl` and `ice-entity-designer` bundles unless
  the page also has a separate static-DSL feature

### React demo path

For React, use the component rather than reimplementing lifecycle glue:

```tsx
import { useRef } from 'react';
import { EntityDesignerCanvas } from 'ice-entity-designer/react';
import type { EntityDesignerHandle } from 'ice-entity-designer/react';

const ref = useRef<EntityDesignerHandle>(null);

<EntityDesignerCanvas
  ref={ref}
  width={1080}
  height={620}
  defaultValue={seedProjectJson}
  onChange={() => setVersion((v) => v + 1)}
>
  <SidePanel />
</EntityDesignerCanvas>
```

Toolbar buttons use the same command API through the ref:

```tsx
ref.current?.addEntity({ entityName: 'User', fields: [idField] });
ref.current?.connect({
  sourceId,
  targetId,
  relationType: 'one-to-many',
  sourceField: 'id',
  targetField: 'id'
});
ref.current?.undo();
ref.current?.redo();
ref.current?.validate();
ref.current?.toSchemaObject();
ref.current?.toSchemaString();
ref.current?.serializeProject();
ref.current?.loadProject(snapshot);
```

The React side panel can read the shared instance with
`useEntityDesigner()`.

## Flowchart editor (imperative + React)

Use this path when the user wants a **flowchart they can edit** (drag nodes, wire
branches, edit labels). Do not reach for `EntityDesigner` (that is ER only) and do not
ship a static `ICEDSL.renderDsl()` viewer when an editor was requested.

### Imperative API

```js
const ice = new IED.ICE().init('canvas-1');
const flow = new IED.FlowDesigner(ice);

const start = flow.createNode('terminator', { title: '开始' });       // 起止
const check = flow.createNode('decision', { title: '库存充足？' });    // 判定
const done = flow.createNode('process', { left: 600, top: 400 });     // 处理

flow.createEdge({ sourceId: check.state.id, targetId: done.state.id, label: '是' });
flow.createEdge({ sourceId: check.state.id, targetId: start.state.id, label: '否', sourcePort: 'R', targetPort: 'L' });

flow.fitViewport();                    // 适应视图
flow.subscribe((snapshot) => save(snapshot));  // 任何模型变更（含拖拽）
flow.serialize();                      // 流程图快照
```

Node kinds and their presets (`FLOW_NODE_KINDS`): `terminator` (start/end pill),
`process` (action, default), `decision` (diamond), `io` (parallelogram). Edge ports are
`T`/`R`/`B`/`L`/`C`, default `B` → `T`.

Editable style props (all persisted in the snapshot): node `fillColor`,
`strokeColor`, `textColor`, `fontSize`; edge `style.strokeStyle` (line + arrow fill),
`style.lineWidth`, `labelStyle.fillStyle` (branch-label color). `updateNode()` /
`updateEdge()` apply them immediately — remember `FlowNode.applyPatch()` rebuilds the
shape/label children, so it is safe to change colors at runtime.

### Document format (v2 = the engine's own serialization)

`flow.serialize()` emits `{ version: 2, kind: "flowchart", scene: <engine payload> }`
where `scene` is produced by the engine's `Serializer` (`{ version, childNodes }`).
Consequences worth knowing:

- Anything on a component's `state` round-trips — including app metadata you attach as
  `state.data` (`{ ... }` arbitrary JSON). No field list to maintain.
- Unknown component types are skipped and reported in `load()`'s `skipped` array
  (same contract as the engine's `Deserializer.unknownTypes`).
- `FlowNode` is a *composite* component (shape + label are derived from its state), so it
  declares `hasDerivedChildren()` and its internal children are intentionally **not**
  written to the document; the constructor rebuilds them on load. Without that flag a
  round-trip would mount them twice.
- Legacy v1 documents (`{ version: 1, nodes: [...], edges: [...] }`) still load; every
  write is v2.

`ice-render` exports `Serializer`, `Deserializer`, `SERIALIZATION_VERSION` and
`SERIALIZATION_MIGRATIONS` so application layers can reuse this exact mechanism on their
own ICE instances (even before `init()`) instead of inventing a second one.

### React

```tsx
import { useRef } from 'react';
import { FlowDesignerCanvas, useFlowDesigner } from 'ice-entity-designer/react';
import type { FlowDesignerHandle } from 'ice-entity-designer/react';

function Stats() {
  const flow = useFlowDesigner();
  return <span>{flow ? `${flow.nodes.length} 个节点 / ${flow.edges.length} 条连线` : '…'}</span>;
}

export default function FlowEditor() {
  const ref = useRef<FlowDesignerHandle>(null);
  return (
    <FlowDesignerCanvas
      ref={ref}
      width={900}
      height={700}
      defaultValue={flowJson}
      onChange={({ snapshot, counts }) => save(snapshot, counts)}
      onError={({ error }) => console.error(error)}
    >
      <Stats />
    </FlowDesignerCanvas>
  );
}
```

The handle mirrors `EntityDesignerHandle`: `addNode(kind, props)` / `connect(...)` /
`updateNode` / `updateEdge` / `remove` / `load` / `undo` / `redo` / `serialize` /
`toSnapshot` / `fitViewport`. `onChange` also fires while a node is dragged on the
canvas (the designer subscribes to the engine's `BEFORE_MOVE` / `AFTER_MOVE` and
coalesces per frame), so autosave never writes stale coordinates.

### Canvas interaction contract (learned the hard way)

- **Wheel zoom:** call the engine primitive `ice.zoomAt(offsetX, offsetY, factor, min, max)`
  inside a `wheel` listener registered with `{ passive: false }`. Never hand-roll the
  `screenToWorld` + translate math.
- **Pan:** not an engine feature — blank-space left drag or middle-button drag that
  shifts `tx`/`ty` via `ice.setViewport(scale, tx + dx, ty + dy)`, gated by
  `ice.hitTest()` so node drags keep working.
- **Property panel:** never rebuild the whole panel DOM on every model change. A panel
  that does `innerHTML = ''` on each change destroys the native `<input type="color">`
  mid-interaction, which reads as "changing the color does nothing". Rebuild only when
  the selected object changes; otherwise sync control values in place (skip the focused
  control).
- **Panel clicks must not deselect:** the engine's event interceptor is global, so
  clicks on your own panel arrive on `ice.evtBus` as `mousedown` with no `param.component`.
  Only clear the selection when the event target is really the canvas
  (`evt.originalEvent.target === canvas`).
- **Link mode:** toggle a flag, then two canvas clicks (source → target) create the edge
  with `createEdge({ sourceId, targetId, sourcePort, targetPort, label })`; ignore clicks
  that do not hit a `FlowNode`.

A complete runnable editor (toolbar + property panel + link mode) lives in
`ice-entity-designer/tests/flowchart-editor.html`.

## Capability boundary

This SKILL is the right choice for:

- entities and database tables
- fields, primary keys, foreign keys, unique constraints
- one-to-one / one-to-many / many-to-one / many-to-many relations
- ER layout and readable database-model diagrams
- relation labels, cardinalities, referential actions, and join tables

The JSON DSL portion of this SKILL should **not** be used for:

- generic flowcharts or topology diagrams: use `ice-render-dsl`
- React integration, Undo/Redo controls, project snapshots, or TypeORM Schema
  export APIs: use `ice-entity-designer` imperative or React APIs
- custom component types, plugins, or accessibility internals: use `ice-render`

## Decision guide for JSON DSL only

| User intent | Recommended output |
| --- | --- |
| Represent an ER / database model as data | Return an `ice-entity-designer-dsl` JSON document |
| Render an interactive ER editor or demo | Use `ice-entity-designer` imperative API |
| Draw a generic diagram | Use `ice-render-dsl` |
| Build an interactive designer with Undo/Redo | Use `ice-entity-designer` imperative API |
| Embed the designer in React | Use `ice-entity-designer/react` |
| Generate TypeORM code or schema objects | Use `designer.toSchemaObject()` / `toSchemaString()` |

## Required output for JSON DSL mode

Return one JSON DSL document and nothing else.

- Do not return HTML when the user asked for JSON data.
- Do not return imperative `EntityDesigner` API code.
- Do not mix generic `ice-render-dsl` nodes into this ER document.

## Core contract

```json
{
  "schemaVersion": 1,
  "entities": [],
  "relations": [],
  "layout": "layered",
  "options": {}
}
```

- `entities` is required.
- `relations` connects existing entity ids.
- `layout` controls automatic arrangement.
- Entity ids must be unique.

## Entity model

```json
{
  "id": "customer",
  "name": "Customer",
  "fields": [
    { "name": "id", "type": "number", "primary": true, "autoIncrement": true },
    { "name": "email", "type": "string", "unique": true, "nullable": false },
    { "name": "status", "type": "string", "default": "active", "comment": "Customer state" }
  ],
  "left": 120,
  "top": 120,
  "width": 220,
  "style": { "fillStyle": "#ffffff", "strokeStyle": "#334155" },
  "headerStyle": { "fillStyle": "#0f172a", "strokeStyle": "#0f172a" },
  "fieldStyle": { "fillStyle": "#f8fafc", "strokeStyle": "#e2e8f0" },
  "dividerStyle": { "strokeStyle": "#cbd5e1", "lineWidth": 1 },
  "draggable": true,
  "interactive": true
}
```

### Field semantics

| field | meaning |
| --- | --- |
| `name` | required field name |
| `type` | logical column type, e.g. `number`, `string`, `boolean`, `decimal`, `date` |
| `length` | optional length / precision text |
| `primary` | primary key |
| `foreignKey` | foreign key |
| `autoIncrement` | auto-increment marker, often shown as `AI` |
| `nullable` | nullability |
| `unique` | unique constraint, often shown as `UQ` |
| `index` | indexed column |
| `default` | default value |
| `comment` | column comment |
| `generated` | generated column |

Modeling rules:

- Prefer one stable primary key per entity, usually named `id`.
- Use `autoIncrement: true` for numeric surrogate primary keys.
- Name foreign-key fields after the referenced entity, e.g. `customerId`.
- Keep `sourceField` / `targetField` exactly equal to real field names.
- Prefer `camelCase` for entity and field names.

## Relation model

```json
{
  "id": "customer_orders",
  "source": "customer",
  "target": "order",
  "type": "one-to-many",
  "sourceField": "id",
  "targetField": "customerId",
  "sourceCardinality": "1",
  "targetCardinality": "0..N",
  "label": "places",
  "onDelete": "CASCADE",
  "onUpdate": "NO ACTION",
  "routeType": "orthogonal",
  "linkShape": "visio",
  "arrow": "end",
  "style": { "strokeStyle": "#64748b", "lineWidth": 2 },
  "lineDash": [6, 4]
}
```

### Relation type cheat sheet

| type | default cardinality | typical arrow |
| --- | --- | --- |
| `one-to-one` | `1 : 1` | `none` |
| `one-to-many` | `1 : 0..N` | `end` |
| `many-to-one` | `0..N : 1` | `start` |
| `many-to-many` | `0..N : 0..N` | `none`, usually requires `joinTableName` |

Use `sourceCardinality` / `targetCardinality` only to override defaults.

### Relation styling and routing

- `linkShape`: `visio` or `bezier`.
- `routeType`: `straight` or `orthogonal`.
- `arrow`: `none`, `start`, `end`, or `both`.
- `onDelete` / `onUpdate`: `CASCADE`, `SET NULL`, `NO ACTION`, or `RESTRICT`.
- `many-to-many` relations should set `joinTableName`.

## Layout

Supported layout values:

- `grid`: grid arrangement, good for many entities.
- `layered`: layered arrangement, good for parent/child flows.
- `horizontal`: horizontal layered arrangement.
- `vertical`: vertical arrangement.

```json
{
  "layout": "layered",
  "options": {
    "gapX": 120,
    "gapY": 60,
    "routeType": "orthogonal"
  }
}
```

When entity coordinates are supplied, prefer them unless the user explicitly
asks for automatic layout.

## Rendering options

```json
{
  "options": {
    "fitViewport": true,
    "fitViewportPadding": 48,
    "routeType": "orthogonal",
    "gapX": 120,
    "gapY": 60
  }
}
```

- `fitViewport`: shrink the whole ER model to fit the canvas and center it.
  It never upscales content.
- `routeType`: default route type for relations that do not specify their own.
- `gapX` / `gapY`: spacing used by `layered` and `horizontal`.

## Validation

Call `validateDsl()` before rendering. The validator checks:

- entity ids are non-empty and unique
- every entity has a `fields` array
- field names are non-empty
- relations reference existing entity ids

## Rendering

### Runtime requirements

- Node: installing `ice-entity-designer-dsl@>=0.0.3` automatically installs
  `ice-entity-designer`.
- Browser: load `ice-entity-designer` before `ice-entity-designer-dsl`.

Browser:

```js
ICEDSL.renderDsl('canvas', dsl);
```

Node:

```ts
import { renderDsl } from 'ice-entity-designer-dsl';
```

`renderDsl()` returns `{ kind, ice, designer }` (`kind` is `"entity"` or
`"flowchart"`), but it is only the DSL bootstrap path. Do not use it to build an
editor demo; for that, create `EntityDesigner` / `FlowDesigner` directly as shown in
[Interactive editor demo requirements](#interactive-editor-demo-requirements).

## Flowchart DSL

Use this mode when the artifact is a **process flow, decision tree, algorithm, or
onboarding flow** (start/end, actions, conditions with yes/no branches). Keep ER
requests in the entity mode above; do not mix the two document kinds in one file.

### Document shape

```jsonc
{
  "schemaVersion": 1,
  "kind": "flowchart",          // required discriminator
  "nodes": [
    { "id": "start", "kind": "terminator", "title": "开始" },
    { "id": "check", "kind": "decision", "title": "库存充足？" },
    { "id": "done", "kind": "terminator", "title": "结束" }
    // left / top / width / height / fillColor / strokeColor are all optional
  ],
  "edges": [
    { "source": "start", "target": "check" },
    { "source": "check", "target": "done", "label": "是" }
  ],
  "options": { "fitViewport": true, "gapX": 90, "gapY": 90 }
}
```

### Node kinds

| `kind` | Shape | Default size | Use for |
| --- | --- | --- | --- |
| `terminator` | rounded pill | 180 × 60 | start / end |
| `process` | rounded rectangle | 220 × 80 | an action or step (default when `kind` is omitted) |
| `decision` | diamond | 200 × 120 | a condition with labeled branches |
| `io` | parallelogram | 220 × 80 | input / output / notification |

`title` is the visible text (`name` is accepted as an alias). Colors come from the
kind preset; override with `fillColor` / `strokeColor` only when the user asks for a
specific palette.

### Edges

| Field | Meaning |
| --- | --- |
| `source` / `target` | node ids; both must exist (the validator rejects dangling endpoints) |
| `label` | branch text, e.g. `"是"` / `"否"` / `"else"` |
| `sourcePort` / `targetPort` | attachment side: `T` `R` `B` `L` `C`; default `B` → `T` (out of the bottom, into the top) |
| `linkShape` | `visio` (default, orthogonal) or `bezier` |

Use `sourcePort: "R"` + `targetPort: "L"` for a side branch that leaves a decision
node horizontally and lands on a node placed to its right.

### Layout

Coordinates are optional. If **any** node omits `left`/`top`, the compiler lays the
whole graph out in layers:

- layer 0 = nodes with no incoming edge; every other node = max(predecessor layer) + 1
- nodes of one layer sit side by side (`gapX`, default 90), layers stack downward (`gapY`, default 90)
- the result is offset so its top-left corner sits at (80, 80)

Set `options.layout: "none"` to keep exactly the coordinates you provide (any node
without coordinates then falls back to 0,0). Supply coordinates when the user asks
for a specific arrangement or when reproducing a diagram from an image.

### Rendering

```js
const result = ICEDSL.renderDsl('canvas', flowchartDoc);
// result.kind === 'flowchart'
// result.designer is a FlowDesigner (imperative API below)
```

Flowchart documents fit the viewport by default (`options.fitViewport !== false`);
pass `options.viewport: { scale, tx, ty }` to control the camera yourself.

### Imperative equivalent (interactive editor)

```js
const ice = new IED.ICE().init('canvas-1');
const flow = new IED.FlowDesigner(ice);
const start = flow.createNode('terminator', { title: '开始' });
const check = flow.createNode('decision', { title: '库存充足？' });
flow.createEdge({ sourceId: start.state.id, targetId: check.state.id, label: '是' });
flow.fitViewport();
```

`FlowDesigner` mirrors `EntityDesigner`: `nodes` / `edges` / `select()` /
`updateNode()` / `updateEdge()` / `remove()` / `undo()` / `redo()` / `serialize()` /
`load()` / `subscribe()`. A complete runnable editor lives in
`ice-entity-designer/tests/flowchart-editor.html`; a JSON-editor + live preview page
for this DSL lives in `examples/flowchart-dsl.html`.

### Validation

`validateDsl()` dispatches on `kind`. For flowchart documents it checks:

- `nodes` is an array; node ids are non-empty and unique
- `kind`, when present, is one of `terminator` / `process` / `decision` / `io`
- `left` / `top` / `width` / `height`, when present, are numbers
- every edge `source` / `target` references an existing node id
- `sourcePort` / `targetPort` are one of `T` `R` `B` `L` `C`; `linkShape` is `visio` or `bezier`

### Flowchart anti-patterns

- Emitting flowchart nodes as `entities` (or ER tables as `nodes`) — the two
  document kinds are discriminated by `kind: "flowchart"` and are not interchangeable.
- Drawing the branches as two unlabeled edges: a `decision` node needs `label` on its
  outgoing edges (`是` / `否`), otherwise the diagram is ambiguous.
- Hand-computing coordinates for a long flow: omit them and let the layered layout
  place the graph, then adjust only the nodes that need a manual position.
- Using `linkShape: "bezier"` for a dense flow: orthogonal (`visio`) routing keeps
  branch lines readable.

## BPMN DSL

Use this mode when the artifact is a **business process across participants**:
approval workflows, order fulfillment across departments, anything that would be
drawn with pools, lanes, events and gateways. The document is the same
"nodes + edges" model as the flowchart kind — only the vocabulary changes, and
pools/lanes are nodes too (declared with `kind` and linked by `parent`).

Do not use this for a plain single-actor flow: if there are no participants and no
lane split, a flowchart document is the shorter answer.

```jsonc
{
  "schemaVersion": 1,
  "kind": "bpmn",                       // required discriminator
  "nodes": [
    { "id": "bank", "kind": "pool", "title": "银行" },                 // left/top/width/height optional
    { "id": "accept", "kind": "lane", "title": "受理岗", "parent": "bank" },
    { "id": "risk", "kind": "lane", "title": "风控岗", "parent": "bank" },
    { "id": "submit", "kind": "event", "title": "申请提交", "eventKind": "start", "parent": "accept" },
    { "id": "verify", "kind": "task", "title": "身份核验", "taskType": "service", "parent": "accept" },
    { "id": "gateway", "kind": "gateway", "title": "是否通过", "gatewayType": "exclusive", "parent": "risk" }
  ],
  "edges": [
    { "source": "submit", "target": "verify", "label": "受理" },
    { "source": "verify", "target": "gateway" }
  ],
  "options": { "fitViewport": true, "gapX": 90, "gapY": 60 }
}
```

### Node kinds

| `kind` | Shape | Default size | Notes |
| --- | --- | --- | --- |
| `pool` | rectangle with a top title band | 900 × 260 | the participant; outermost container |
| `lane` | rectangle with a left title band | 900 × 130 | `parent` must be a pool |
| `task` | rounded rectangle + type icon | 180 × 90 | default when `kind` is omitted |
| `event` | circle | 56 × 56 | `eventKind`: `start` / `intermediate` / `end`; `trigger`: `none` / `message` / `timer` / `error` / `terminate` |
| `gateway` | diamond + symbol | 70 × 70 | `gatewayType`: `exclusive` / `parallel` / `inclusive` / `event` |
| `subprocess` | rounded rectangle | 200 × 110 | same `taskType` vocabulary as `task` |
| `dataObject` | page with a folded corner | 130 × 80 | attach with an `association` edge |
| `annotation` | open bracket, dashed | 200 × 80 | attach with an `association` edge |

`taskType` (on `task` and `subprocess`): `none` (default) / `user` / `service` /
`script` / `send` / `receive` / `manual`. The vocabulary and the palette match the
interactive editor's property panel, so a document round-trips through the editor
without loss.

### Pools and lanes (containers)

- Every non-container node belongs to a container through `parent` — a flow node's
  `parent` may be a `lane` or a `pool`; a `lane`'s `parent` must be a `pool`.
- `parent` is optional. Nodes with coordinates are nested **geometrically** by the
  designer anyway (innermost container whose content area holds the node's center),
  so editor exports and BPMN XML imports need no `parent` at all.
- When coordinates are omitted, the compiler sizes the containers from their
  contents: a lane becomes its children's bounding box plus the left title band and
  padding (never thinner than the default), the pool becomes its lanes stacked with
  the top title band, and pools without coordinates are stacked top to bottom.
- The title bands are **not** part of the content area (pool band is 32px on top,
  lane band is 32px on the left). Do not put children in a band: they would be
  re-assigned to another container.
- Children of a container are laid out left-to-right in layers. An explicit
  `left`/`top` on **every** node of a container skips that container's auto-layout.

### Edges

| Field | Meaning |
| --- | --- |
| `source` / `target` | node ids; both must exist |
| `type` | `sequence` (default), `message` (dashed, arrow at target — use it **only** across pools), `association` (dotted — data objects and annotations) |
| `flowType` | alias of `type` (kept for compatibility; `type` wins) |
| `label` | text on the line, e.g. `"受理"`, `"通过"` |
| `condition` | condition expression on a sequence flow (drawn on the line) |
| `isDefault` | default sequence flow (drawn with the slash marker) |
| `linkShape` | `visio` (default, orthogonal) or `bezier` |

### Rendering

```js
const result = ICEDSL.renderDsl('canvas', bpmnDoc);
// result.kind === 'bpmn'
// result.designer is a BpmnDesigner (extends FlowDesigner)
```

BPMN documents fit the viewport by default (`options.fitViewport !== false`); pass
`options.viewport: { scale, tx, ty }` to control the camera yourself. A JSON-editor
plus live preview page for this DSL lives in `examples/bpmn-dsl.html`.

### Exporting the rendered result (SVG)

Both flowchart and BPMN designers can export a **vector** SVG of what they render —
use this whenever the user asks for an image file, a printable figure, or something
to hand to a design tool. Do not screenshot the canvas: that is a raster snapshot
that blurs when scaled.

```js
const result = ICEDSL.renderDsl('canvas', bpmnDoc);
const svg = result.designer.toSvg();                                  // content-fit, transparent
const svg = result.designer.toSvg({ background: '#fff', padding: 16 });
const svg = result.designer.toSvg({ area: 'viewport' });              // exactly what is on screen
const { svg, width, height } = IED.exportSvgResult(result.ice, {});   // needs the pixel size too
```

`options`: `area` (`content` | `viewport`), `padding`, `scale`, `background`,
`includeTools` (editor handles/guides are excluded by default). The SVG is
regenerated from the component tree and path commands, so it matches the canvas
(geometry, colours, radii, gradients, opacity, shadows, link labels); text is
aligned identically but glyph rasterisation differs slightly from canvas. For
server-side rendering (no browser) use `ICE.headless()` and the same `toSvg()`;
rasterise the SVG to PNG/PDF with any external tool (`resvg`, `sharp`,
`rsvg-convert`, headless Chrome).

### Validation

`validateDsl()` dispatches on `kind`. For BPMN documents it checks structure only:

- `nodes` is an array; node ids are non-empty and unique
- `kind` is one of the eight BPMN kinds; `eventKind` / `trigger` / `gatewayType` /
  `taskType` values are from the vocabulary above
- `left` / `top` / `width` / `height`, when present, are numbers
- `parent`, when present, references an existing node; a lane's parent must be a
  pool, and a pool cannot have a parent
- every edge `source` / `target` references an existing node id; `type` is a known
  flow type

**Semantic** rules live in the designer, not in the DSL validator — call
`result.designer.validateBpmn()` after rendering to get BPMN-specific issues:

- every pool needs at least one start event
- a sequence flow must not cross pools (use a message flow between participants)
- a message flow should connect different pools
- gateways need the outgoing branches their type implies
- every node should be reachable from a start event

### BPMN 2.0 XML interop

The DSL renders into `BpmnDesigner`, which ships the XML bridge — there is no second
serializer:

```js
const xml = IED.toBpmnXml(result.designer);              // BPMN 2.0 + BPMNDI layout
const imported = IED.fromBpmnXml(xml, result.designer);  // rebuild the designer from XML
```

Scope: process, collaboration/participants, lanes, the eight shapes above, the three
flow types, and DI layout. It is a **layout-preserving exchange format**, not a full
BPMN execution model: conditions travel as text, and there are no engine semantics
(no token simulation, no boundary-event subscriptions, no multi-instance metadata).

### Simulating a BPMN process (token flow)

When the user asks to **demonstrate** or **animate** a process ("流程怎么走", "演示一下"),
do not fake it with timers over DOM elements: `ice-entity-designer` ships
`new IED.BpmnSimulator(designer, { nodeDuration, edgeDuration })` — `start()` puts a token
on every start event and drives it along the sequence flows (dwell on tasks, pick one
branch at exclusive gateways by condition/default, split at parallel gateways, die at end
events). Tokens live in the tool layer, so the document, snapshots and BPMN XML export stay
clean; `stop()` clears them. Drive it with the engine frame loop in the browser
(`start()` subscribes for you) or step it deterministically in tests via `simulator.step(dtMs)`.

### BPMN anti-patterns

- Using `sequence` for a line that crosses pools: the validator flags it; a line
  between participants is a `message` flow.
- Putting a lane inside a lane, or a pool inside a pool: containers are exactly two
  levels — pool → lane → flow node.
- Placing a node in a title band (pool top 32px / lane left 32px): it will be
  re-assigned to whatever container actually contains its center.
- Emitting only the flow nodes and forgetting the pools: without a pool the diagram
  has no participants and BPMN semantics are not checkable.
- Mixing `kind: "bpmn"` nodes into a `kind: "flowchart"` document: the vocabulary is
  not shared; pick one discriminator per document.

## UML class diagram DSL

Use this mode when the artifact is a **class model**: domain models, API/domain layer
design, refactoring targets, "what does this service look like". Classes, interfaces
and enums are nodes; the six UML relations are edges. Members are **free text**
(`- id: string`, `+ pay(amount: number): void`) — the same spelling PlantUML and
Mermaid use, so anything you know about those formats carries over.

```jsonc
{
  "schemaVersion": 1,
  "kind": "uml",                        // required discriminator
  "nodes": [
    { "id": "entity", "kind": "class", "title": "Entity", "abstract": true,
      "attributes": ["# id: string"], "methods": ["+ save(): Promise<void>"] },
    { "id": "user", "kind": "class", "title": "User",
      "attributes": ["- email: string"], "methods": ["+ placeOrder(): Order"] },
    { "id": "payable", "kind": "interface", "title": "Payable", "methods": ["+ pay(): void"] },
    { "id": "status", "kind": "enum", "title": "OrderStatus", "attributes": ["PAID", "UNPAID"] }
  ],
  "edges": [
    { "source": "user", "target": "entity", "type": "inheritance" },  // 子类 → 父类
    { "source": "user", "target": "payable", "type": "realization" },
    { "source": "user", "target": "status", "type": "dependency" }
  ],
  "options": { "fitViewport": true, "gapX": 90, "gapY": 120 }
}
```

### Node kinds

| `kind` | Renders as |
| --- | --- |
| `class` | three compartments (name / attributes / methods); `abstract: true` adds «abstract» |
| `interface` | «interface» stereotype, italic name |
| `enum` | «enumeration» stereotype, literals in the attribute compartment |

Box height grows with the member list automatically — you never position or size
members yourself.

### Relation types

| `type` | Notation |
| --- | --- |
| `inheritance` | solid line + hollow triangle (points at the superclass) |
| `realization` | dashed line + hollow triangle (points at the interface) |
| `association` | solid line |
| `aggregation` | solid line + **hollow diamond** on the whole side |
| `composition` | solid line + **filled diamond** on the whole side |
| `dependency` | dashed line + open arrow |

**Direction convention** (inherited from PlantUML, easy to get backwards):
`A <|-- B` means B inherits A, so the edge is `{ "source": "B", "target": "A" }`.
For aggregation/composition the diamond sits on the **source** (the whole).

### Layout, validation, rendering

- Coordinates are optional: with any node missing `left`/`top` the whole model is
  layered **top-down by inheritance/realization** (superclass above subclass).
- `validateDsl()` checks structure (ids, kinds, member arrays, endpoints, relation
  types); semantic rules live in the designer — call `result.designer.validateUml()`
  for duplicate class names, dangling relations and inheritance cycles.
- `ICEDSL.renderDsl('canvas', umlDoc)` returns `{ kind: 'uml', designer: UmlDesigner }`.
- Text interop: `IED.toPlantUml(designer)` / `IED.fromPlantUml(text, designer)` speak the
  PlantUML/Mermaid class-diagram subset (class/interface/enum bodies, the six arrows,
  quoted names, comments). Prefer this over inventing your own format when the user
  wants something to paste into a wiki or a code review.
- A JSON-editor plus live preview page lives in `examples/uml-dsl.html`.

### UML anti-patterns

- Writing members as structured objects (`{ name, type }`) — members are free text in
  this DSL, matching PlantUML/Mermaid.
- Reversing the inheritance direction (`{ source: 'Parent', target: 'Child' }`): the
  triangle then points at the subclass and the top-down layout inverts.
- Dumping a whole codebase as one diagram: split by module/package and keep each
  document readable (10-20 classes).
- Forgetting `«interface»`: an interface is `kind: 'interface'`, not a class named
  "IUser".

## Statechart DSL

Use this mode when the artifact is a **state machine / lifecycle**: order or payment
lifecycles, device/session states, workflow stages, protocol state machines. Nodes are
pseudo-states (initial/final), states and **composite states**; edges are transitions
labelled `event [guard] / action`.

```jsonc
{
  "schemaVersion": 1,
  "kind": "statechart",
  "nodes": [
    { "id": "start", "kind": "initial" },
    { "id": "pending", "title": "待支付" },
    { "id": "processing", "kind": "composite", "title": "订单处理" },
    { "id": "stock", "title": "库存校验", "parent": "processing" },
    { "id": "done", "kind": "final" }
  ],
  "edges": [
    { "source": "start", "target": "pending" },
    { "source": "pending", "target": "stock", "event": "支付成功", "guard": "金额 > 0", "action": "生成订单" },
    { "source": "stock", "target": "done", "event": "已发货" }
  ],
  "options": { "fitViewport": true }
}
```

### Node kinds

| `kind` | Renders as |
| --- | --- |
| `initial` | filled dot (pseudo-state, no label) |
| `final` | bullseye ring (pseudo-state, no label) |
| `state` | rounded rectangle with the name (default) |
| `composite` | container: children declared with `parent` live inside; dragging it moves them |

### Transitions

| Field | Meaning |
| --- | --- |
| `source` / `target` | state ids; both must exist |
| `event` | trigger, e.g. `支付成功` |
| `guard` | condition, rendered as `[guard]` |
| `action` | effect, rendered after `/` |
| `label` | explicit label; when present it wins over the composed one |

Labels are composed automatically: `event [guard] / action` with missing parts omitted
(no empty brackets, no dangling slash).

### Layout, validation, rendering

- Coordinates are optional: the flow is laid out **left to right** (transitions lift to
  the enclosing composite so the order stays right), and composite states grow to fit
  their children.
- `validateDsl()` checks structure (ids, kinds, parent must be a composite, endpoints);
  semantics live in the designer — `result.designer.validateStatechart()` reports a
  missing initial state, out-edges from a final state, isolated states and states
  unreachable from the initial one (a composite counts as reachable when its children are).
- `ICEDSL.renderDsl('canvas', chartDoc)` → `{ kind: 'statechart', designer: StatechartDesigner }`.
- Prefer a statechart over a flowchart when the artifact is a **lifecycle with retries /
  cancellation / nested phases**: pseudo-states and guards say things a flowchart cannot.
- A JSON-editor plus live preview page lives in `examples/statechart-dsl.html`.

### Statechart anti-patterns

- Modeling a lifecycle as a flowchart with "start/end" boxes: the initial/final
  pseudo-states and guards carry meaning the validator can check.
- Writing the transition label by hand in three places: use `event` / `guard` / `action`
  and let the renderer compose.
- Nesting states without a composite: only `kind: "composite"` accepts `parent`.
- Forgetting the final state: a lifecycle usually has completion; `validateStatechart()`
  will not flag a missing final, but the reviewer will.

## Gantt DSL

Use this mode when the artifact is a **schedule / plan**: release plans, project roadmaps,
sprint breakdowns, resource timelines — anything where the question is "what happens when".

```jsonc
{
  "schemaVersion": 1,
  "kind": "gantt",
  "nodes": [
    { "id": "review", "title": "需求评审", "start": "2026-03-02", "days": 4, "progress": 1 },
    { "id": "design", "title": "交互设计", "start": "2026-03-05", "days": 6, "progress": 0.8 },
    { "id": "frontend", "title": "前端开发", "start": "2026-03-10", "days": 12, "progress": 0.35 }
  ],
  "edges": [
    { "source": "review", "target": "design" },   // 完成 → 开始（finish-to-start）
    { "source": "design", "target": "frontend" }
  ],
  "options": { "dayWidth": 28, "fitViewport": true }
}
```

### Task fields

| Field | Meaning |
| --- | --- |
| `id` | required, unique |
| `title` / `name` | bar label (rendered as `名称（N 天）· P%`) |
| `start` | required, `YYYY-MM-DD` |
| `days` | duration in days, default 1 |
| `progress` | 0..1, default 0 (drawn as a filled overlay) |
| `row` | row index, default = declaration order |
| `resource` | owner/resource name — same-resource overlapping tasks are flagged by the validator |

**There are no coordinates.** The horizontal axis is time (`start` × `dayWidth`), the
vertical axis is the row. Never emit `left`/`top` for gantt tasks — they would fight the
dates, and the editor snaps dragged bars back to whole days anyway.

### Dependencies, validation, rendering, scheduling

- `edges` are finish-to-start dependencies: the arrow goes from the predecessor's end to
  the successor's start.
- Schedule, don't just draw: `options.autoSchedule: true` (or `designer.autoSchedule()`)
  pushes every task to its earliest feasible start (only later, never earlier — a plan
  should not silently pull work forward). `designer.criticalPath()` returns the zero-float
  chain to highlight; `designer.validateGantt()` reports dependency cycles AND
  resource conflicts (same `resource` with overlapping dates).
- `validateDsl()` checks structure (ids, `start` format, `days >= 1`, `progress` in 0..1,
  endpoints); semantics live in the designer — `result.designer.validateGantt()` reports
  dependency cycles.
- `ICEDSL.renderDsl('canvas', ganttDoc)` → `{ kind: 'gantt', designer: GanttDesigner }`;
  `options.dayWidth` sets the zoom (the editor can also change it live).
- A JSON-editor plus live preview page lives in `examples/gantt-dsl.html`.

### Gantt anti-patterns

- Emitting `left`/`top` (or any pixel math) for tasks: the timeline is derived from dates.
- Overlapping a task with itself by hand-computing "day counts" across months: use
  durations (`days`) and let the renderer place bars — `2026-02-25 + 5 days` spans the month.
- Treating dependencies as cosmetic: a cycle is a broken schedule; the validator flags it.
- Emitting dates that already violate the dependencies and hoping the viewer fixes it:
  set `options.autoSchedule` (or call `autoSchedule()`), and give tasks a `resource` when
  the plan is people-bound so conflicts surface.
- Long plans with `dayWidth` cranked up: pick a width where the whole plan fits the page
  (the editor's 适应视图 / `dayWidth` control does this).

## Worked example: compact e-commerce model

```json
{
  "schemaVersion": 1,
  "layout": "layered",
  "entities": [
    {
      "id": "customer",
      "name": "Customer",
      "fields": [
        { "name": "id", "type": "number", "primary": true, "autoIncrement": true },
        { "name": "email", "type": "string", "unique": true, "nullable": false },
        { "name": "name", "type": "string", "nullable": false }
      ]
    },
    {
      "id": "order",
      "name": "Order",
      "fields": [
        { "name": "id", "type": "number", "primary": true, "autoIncrement": true },
        { "name": "customerId", "type": "number", "foreignKey": true, "nullable": false },
        { "name": "status", "type": "string", "default": "pending" },
        { "name": "total", "type": "decimal", "length": "12,2" }
      ]
    },
    {
      "id": "product",
      "name": "Product",
      "fields": [
        { "name": "id", "type": "number", "primary": true, "autoIncrement": true },
        { "name": "sku", "type": "string", "unique": true, "nullable": false },
        { "name": "price", "type": "decimal", "length": "10,2" }
      ]
    },
    {
      "id": "order_item",
      "name": "OrderItem",
      "fields": [
        { "name": "id", "type": "number", "primary": true, "autoIncrement": true },
        { "name": "orderId", "type": "number", "foreignKey": true },
        { "name": "productId", "type": "number", "foreignKey": true },
        { "name": "quantity", "type": "number", "nullable": false },
        { "name": "unitPrice", "type": "decimal", "length": "10,2" }
      ]
    }
  ],
  "relations": [
    {
      "source": "customer",
      "target": "order",
      "type": "one-to-many",
      "sourceField": "id",
      "targetField": "customerId",
      "sourceCardinality": "1",
      "targetCardinality": "0..N",
      "label": "places",
      "onDelete": "CASCADE"
    },
    {
      "source": "order",
      "target": "order_item",
      "type": "one-to-many",
      "sourceField": "id",
      "targetField": "orderId",
      "sourceCardinality": "1",
      "targetCardinality": "0..N",
      "label": "contains"
    },
    {
      "source": "product",
      "target": "order_item",
      "type": "one-to-many",
      "sourceField": "id",
      "targetField": "productId",
      "sourceCardinality": "1",
      "targetCardinality": "0..N",
      "label": "ordered as"
    }
  ],
  "options": {
    "gapX": 140,
    "gapY": 70,
    "routeType": "orthogonal"
  }
}
```

## Worked example: order-fulfillment flowchart

```json
{
  "schemaVersion": 1,
  "kind": "flowchart",
  "nodes": [
    { "id": "start", "kind": "terminator", "title": "开始" },
    { "id": "browse", "kind": "process", "title": "浏览商品" },
    { "id": "submit", "kind": "process", "title": "提交订单" },
    { "id": "stock", "kind": "decision", "title": "库存充足？" },
    { "id": "pay", "kind": "process", "title": "创建支付单" },
    { "id": "paid", "kind": "decision", "title": "支付成功？" },
    { "id": "ship", "kind": "process", "title": "安排发货" },
    { "id": "done", "kind": "terminator", "title": "结束" },
    { "id": "restock", "kind": "io", "title": "通知补货" },
    { "id": "closed", "kind": "process", "title": "关闭订单" },
    { "id": "failed", "kind": "terminator", "title": "结束（未成交）" }
  ],
  "edges": [
    { "source": "start", "target": "browse" },
    { "source": "browse", "target": "submit" },
    { "source": "submit", "target": "stock" },
    { "source": "stock", "target": "pay", "label": "是" },
    { "source": "stock", "target": "restock", "label": "否", "sourcePort": "R", "targetPort": "L" },
    { "source": "restock", "target": "failed" },
    { "source": "pay", "target": "paid" },
    { "source": "paid", "target": "ship", "label": "是" },
    { "source": "paid", "target": "closed", "label": "否", "sourcePort": "R", "targetPort": "L" },
    { "source": "closed", "target": "failed" },
    { "source": "ship", "target": "done" }
  ],
  "options": { "fitViewport": true, "gapX": 120, "gapY": 90 }
}
```

No coordinates are given, so the layered layout places the 11 nodes: the main chain
reads top-to-bottom, while 通知补货 and 关闭订单 land on the right as side branches of
their decision nodes.

## Anti-patterns

Do not:

- put generic diagram nodes in `entities`
- create relations to entity ids that do not exist
- specify both fixed coordinates and automatic layout without clear intent
- add `joinTableName` to non-`many-to-many` relations
- mix ER fields with generic `ice-render-dsl` fields

## Output checklist

Before returning an **ER** document, verify:

- root contains only `schemaVersion`, `entities`, `relations`, `layout`, and
  `options`
- every entity has a unique non-empty `id`
- every entity has a `fields` array
- every field has a non-empty `name`
- every relation references an existing entity id
- `many-to-many` relations include `joinTableName`
- the document is valid JSON with no trailing commas

Before returning a **flowchart** document, verify:

- root contains `kind: "flowchart"` plus `nodes` / `edges` (and optionally `options`)
- every node id is unique and non-empty; every `kind` is one of
  `terminator` / `process` / `decision` / `io`
- every edge references existing node ids
- every branch out of a `decision` node carries a `label` (`是` / `否`, `yes` / `no`)
- the flow starts at a `terminator` (start) and ends at one or more `terminator` (end) nodes
- coordinates are either omitted entirely (auto layout) or provided for every node
- the document is valid JSON with no trailing commas

## Rules for JSON DSL mode

When the requested artifact is JSON DSL data, follow these rules:

- Return only JSON, never handwritten `EntityDesigner` class constructors.
- Use stable, semantic entity ids such as `customer`, `order`, and `product`.
- Model foreign keys explicitly as fields plus a relation.
- Preserve constraints and cardinalities supplied by the user.
- Use `layered` or `grid` when no coordinates are provided.
- Validate before rendering with `validateDsl()`.

When the request is a flowchart (process flow, decision tree, algorithm), emit a
flowchart document instead: `kind: "flowchart"` with `nodes` / `edges`, omit
coordinates unless the user asked for a specific arrangement, and label every branch
of a `decision` node. See [Flowchart DSL](#flowchart-dsl).

For interactive editor or demo requests, follow
[Interactive editor demo build guide](#interactive-editor-demo-build-guide)
instead of these JSON-only rules.
