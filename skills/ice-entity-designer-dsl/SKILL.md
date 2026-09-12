---
name: ice-entity-designer-dsl
description: Generate JSON-first ER DSL documents for ice-entity-designer. For interactive ER editor demos or pages, route to ice-entity-designer instead.
version: "1.1.0"
category: data
platforms:
  - claude-code
  - codex-cli
  - copilot
  - cursor
  - gemini-cli
  - other
metadata:
  short-description: JSON-first ER DSL plus canonical interactive ice-entity-designer editor demo guidance.
---

# ice-entity-designer-dsl

Use this skill when the requested artifact is a **JSON ER DSL document**: a
machine-readable Entity-Relation model or database schema that can be consumed
or rendered by `ice-entity-designer`.

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
| Interactive ER editor / "make a demo" / "show what the designer can do" | `ice-entity-designer` imperative API | HTML/JS editor page |
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

```js
function zoomAtPointer(clientX, clientY, factor) {
  const oldScale = ice.viewport.scale;
  const nextScale = Math.max(0.3, Math.min(3, oldScale * factor));
  const rect = canvas.getBoundingClientRect();
  const cx = clientX - rect.left;
  const cy = clientY - rect.top;
  const tx = cx - ((cx - ice.viewport.tx) * nextScale) / oldScale;
  const ty = cy - ((cy - ice.viewport.ty) * nextScale) / oldScale;
  ice.setViewport(nextScale, tx, ty);
}

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  zoomAtPointer(event.clientX, event.clientY, event.deltaY > 0 ? 0.9 : 1.1);
});

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

`renderDsl()` returns `{ ice, designer }`, but it is only the DSL bootstrap
path. Do not use it to build an editor demo; for that, create `EntityDesigner`
directly as shown in [Interactive editor demo
requirements](#interactive-editor-demo-requirements).

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

## Anti-patterns

Do not:

- put generic diagram nodes in `entities`
- create relations to entity ids that do not exist
- specify both fixed coordinates and automatic layout without clear intent
- add `joinTableName` to non-`many-to-many` relations
- mix ER fields with generic `ice-render-dsl` fields

## Output checklist

Before returning, verify:

- root contains only `schemaVersion`, `entities`, `relations`, `layout`, and
  `options`
- every entity has a unique non-empty `id`
- every entity has a `fields` array
- every field has a non-empty `name`
- every relation references an existing entity id
- `many-to-many` relations include `joinTableName`
- the document is valid JSON with no trailing commas

## Rules for JSON DSL mode

When the requested artifact is JSON DSL data, follow these rules:

- Return only JSON, never handwritten `EntityDesigner` class constructors.
- Use stable, semantic entity ids such as `customer`, `order`, and `product`.
- Model foreign keys explicitly as fields plus a relation.
- Preserve constraints and cardinalities supplied by the user.
- Use `layered` or `grid` when no coordinates are provided.
- Validate before rendering with `validateDsl()`.

For interactive editor or demo requests, follow
[Interactive editor demo build guide](#interactive-editor-demo-build-guide)
instead of these JSON-only rules.
