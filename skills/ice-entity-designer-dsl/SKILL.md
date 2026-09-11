---
name: ice-entity-designer-dsl
description: Render ER diagrams with ice-entity-designer using a JSON-first DSL instead of raw canvas API calls.
---

# ice-render-dsl

Use this skill when the user wants to render Entity/Relation diagrams with `ice-render`.

## Required output

Return a JSON DSL document, not HTML and not imperative `ICE` API code.

## Schema

```json
{
  "schemaVersion": 1,
  "layout": "layered",
  "entities": [],
  "relations": [],
  "options": {}
}
```

## Entity

```json
{
  "id": "customer",
  "name": "Customer",
  "fields": [
    { "name": "id", "type": "number", "primary": true },
    { "name": "email", "type": "string", "unique": true }
  ]
}
```

## Relation

```json
{
  "source": "customer",
  "target": "order",
  "type": "one-to-many",
  "sourceField": "id",
  "targetField": "customerId"
}
```

## Validation

Use `validateDsl()` before rendering. Entity ids must be unique. Relation endpoints must exist.

## Rendering

Browser:

```js
ICEDSL.renderDsl('canvas', dsl);
```

Node:

```ts
import { renderDsl } from 'ice-render-dsl';
```

Do not invent coordinates unless explicitly requested.
