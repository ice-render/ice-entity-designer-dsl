---
name: ice-entity-designer-dsl
description: Render Entity-Relation diagrams with ice-entity-designer from a JSON-first ER DSL instead of raw imperative canvas API calls.
version: "1.0.0"
category: data
metadata:
  short-description: JSON-first ER DSL for entities, fields, constraints, relations, and TypeORM-oriented models.
---

# ice-entity-designer-dsl

Use this skill when the user wants an Entity-Relation (ER) model or database
schema diagram that can be rendered by `ice-entity-designer`.

## Required output

Return one JSON DSL document, not HTML and not imperative `EntityDesigner` API
code. The DSL describes the complete ER model.

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

## Entity

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

Use field flags consistently with the target database schema. Do not invent
primary keys when the user already provided them.

## Relation

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

### Relation types

| type | typical direction |
| --- | --- |
| `one-to-one` | one source row to one target row |
| `one-to-many` | one source row to many target rows |
| `many-to-one` | many source rows to one target row |
| `many-to-many` | many-to-many, usually requires `joinTableName` |

### Relation styling and routing

- `linkShape`: `visio` (orthogonal connector, default) or `bezier`.
- `routeType`: `straight` or `orthogonal`.
- `arrow`: `none`, `start`, `end`, or `both`.
- `sourceCardinality` and `targetCardinality` are display hints, e.g. `1`,
  `0..1`, `0..N`, `1..N`.
- For `many-to-many`, set `joinTableName`; the DSL and designer treat it as a
  join table.
- `onDelete` / `onUpdate` accept referential-action strings such as `CASCADE`,
  `SET NULL`, `NO ACTION`, or `RESTRICT`.

## Layout

Supported layout values:

- `grid`: grid arrangement.
- `layered`: layered arrangement, good for parent/child flows.
- `horizontal`: horizontal layered arrangement.
- `vertical`: vertical arrangement.

Example:

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

When coordinates are already supplied on entities, prefer those coordinates
unless the user explicitly asks for automatic layout.

## Rendering options

```json
{
  "options": {
    "fitViewport": true,
    "routeType": "orthogonal",
    "gapX": 120,
    "gapY": 60
  }
}
```

## Validation

Call `validateDsl()` before rendering. The validator checks:

- entity ids are non-empty and unique
- every entity has a `fields` array
- field names are non-empty
- relations reference existing entity ids

## Rendering

### Runtime requirements

- Node: installing `ice-entity-designer-dsl@>=0.0.2` automatically installs
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

## Rules

- Always return JSON, never handwritten `EntityDesigner` class constructors.
- Use stable, semantic entity ids such as `customer`, `order`, and `product`.
- Model foreign keys explicitly as fields plus a relation, matching common ER
  tool conventions.
- Preserve constraints and cardinality when they are supplied by the user.
- Use `layered` or `grid` when no coordinates are provided.
- Validate before rendering with `validateDsl()`.
