# ice-entity-designer-dsl

JSON-first ER DSL for AI agents to drive `ice-entity-designer` without learning the imperative canvas API.

The package contains:

- DSL types and schema
- structural validator
- compiler from DSL to Entity/Relation props
- browser runtime that renders DSL through `ice-entity-designer`
- browser example with a JSON editor

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
import { validateDsl, compileDsl, renderDsl } from 'ice-render-dsl';
```

## API

- `validateDsl(dsl)`
- `compileDsl(dsl)`
- `renderDsl(canvasOrId, dsl)`
- `DSL_SCHEMA_VERSION`

## Example

Open `examples/entity-editor-dsl.html` after building.

## Agent discovery

Agents can use this project through:

1. npm package exports
2. `AGENTS.md`
3. `skills/ice-render-dsl/SKILL.md`
4. optional MCP wrapper in a separate package

The core runtime does not require MCP.
