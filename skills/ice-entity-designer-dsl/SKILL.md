---
name: ice-entity-designer-dsl
description: Render Entity-Relation diagrams with ice-entity-designer from a JSON-first ER DSL instead of raw imperative canvas API calls.
version: "1.0.2"
category: data
platforms:
  - claude-code
  - codex-cli
  - copilot
  - cursor
  - gemini-cli
  - other
metadata:
  short-description: JSON-first ER DSL for entities, fields, constraints, relations, and TypeORM-oriented models.
---

# ice-entity-designer-dsl

Use this skill when the user wants an Entity-Relation (ER) model or database
schema diagram that can be rendered by `ice-entity-designer`.

## Capability boundary

This SKILL is the right choice for:

- entities and database tables
- fields, primary keys, foreign keys, unique constraints
- one-to-one / one-to-many / many-to-one / many-to-many relations
- ER layout and readable database-model diagrams
- relation labels, cardinalities, referential actions, and join tables

This SKILL should **not** be used for:

- generic flowcharts or topology diagrams: use `ice-render-dsl`
- React integration, Undo/Redo controls, project snapshots, or TypeORM Schema
  export APIs: use `ice-entity-designer` imperative or React APIs
- custom component types, plugins, or accessibility internals: use `ice-render`

## Decision guide

| User intent | Recommended output |
| --- | --- |
| Draw an ER / database model | Return an `ice-entity-designer-dsl` JSON document |
| Draw a generic diagram | Use `ice-render-dsl` |
| Build an interactive designer with Undo/Redo | Use `ice-entity-designer` imperative API |
| Embed the designer in React | Use `ice-entity-designer/react` |
| Generate TypeORM code or schema objects | Use `designer.toSchemaObject()` / `toSchemaString()` |

## Required output

Return one JSON DSL document.

- Do not return HTML.
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

## Rules

- Always return JSON, never handwritten `EntityDesigner` class constructors.
- Use stable, semantic entity ids such as `customer`, `order`, and `product`.
- Model foreign keys explicitly as fields plus a relation.
- Preserve constraints and cardinalities supplied by the user.
- Use `layered` or `grid` when no coordinates are provided.
- Validate before rendering with `validateDsl()`.
