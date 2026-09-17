# ice-entity-designer-dsl Agent Guide

## Purpose

This repository provides a JSON-first DSL for rendering diagrams through `ice-render`.

## Rules

- Prefer producing JSON DSL over direct canvas API calls.
- **Branches & release（家族铁律，2026-09-13 确立）**：develop on a temporary branch (or `dev`);
  `main` is for integration + release only. Before releasing, merge the development branch into
  `main` **and release from `main`** (gates → `npm publish` / `skills-hub ... version`).
  Never commit implementation directly on `main`, and never leave `main` behind the development line.
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

## 成员顺序（class member order，2026-09-17 定，全家族同口径）

`examples/*.html` 里的页面类按这个顺序排成员 —— 棘轮里就是正则 `S*T*F*C*(A|M)*`：

```
static 常量/字段  →  static 方法  →  实例字段  →  构造函数  →  访问器 / 实例方法
```

- **只到这一层**：不查 public/private 的先后，也不查同组内谁先谁后。Google Java Style §3.4.2
  说 class 成员顺序"**没有唯一正确的配方**"（要的是每种顺序都讲得通、维护者能解释），
  Google 的 TypeScript 指南对顺序**完全沉默**（全文 "ordering" 出现 0 次）。
- ⚠️ **挪位置前先分清挪的是什么**：TS 里**方法随便挪**（类定义时方法就全部装好，与文本顺序无关），
  但**字段的声明顺序有语义**（初始化按声明顺序执行 + 影响 V8 的 class shape）——
  挪字段要确认初始化表达式互不依赖。
- 本仓示例页已全部合规；棘轮是 `tests/examplesConvention.test.ts` 的最后一条。
