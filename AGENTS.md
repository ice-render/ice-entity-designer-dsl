# ice-entity-designer-dsl Agent Guide

## Purpose

This repository provides a JSON-first DSL for rendering diagrams through `ice-render`.

## Rules

- Prefer producing JSON DSL over direct canvas API calls.
- Always include `schemaVersion: 1`.
- Pick exactly one document kind: ER (no `kind`, uses `entities`/`relations`),
  `kind: "flowchart"` (`nodes`/`edges`) or `kind: "bpmn"` (`nodes`/`edges` with
  pools/lanes). The vocabularies are not shared between kinds.
- Entity `id` values must be unique.
- Relation `source` and `target` must reference existing entity ids.
- Use `layout: "layered"` for dependency-style diagrams.
- Use `layout: "grid"` for simple tabular layouts.

## Minimal document

```json
{
  "schemaVersion": 1,
  "layout": "layered",
  "entities": [
    { "id": "a", "name": "A", "fields": [] },
    { "id": "b", "name": "B", "fields": [] }
  ],
  "relations": [
    { "source": "a", "target": "b", "type": "one-to-many" }
  ]
}
```

## Runtime

```js
const result = ICEDSL.renderDsl('canvas', dsl);
```

## Tests

```bash
npm run types:check
npm test
npm run build
```
