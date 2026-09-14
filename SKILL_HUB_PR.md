# Skill PR: ice-entity-designer-dsl

## Title

Add `ice-entity-designer-dsl` skill for rendering ER / flowchart / BPMN diagrams from JSON DSL.

## Summary

`ice-entity-designer-dsl` lets AI Agents render diagrams through `ice-entity-designer`
from a JSON document. Three document kinds, one entry point (`ICEDSL.renderDsl`):

- ER model — `entities` / `relations`
- Flowchart — `kind: "flowchart"`, `nodes` / `edges` (optional layered auto-layout)
- BPMN 2.0 — `kind: "bpmn"`, `nodes` / `edges` with pools and lanes as containers

## Theme and style boundary

The skill draws a clean line between the two, which prevents the usual "wrong colour" reports:

- **Domain semantics stay in the document** — voltage-level colours (power one-line),
  water/medium colours, UML / statechart / gantt palettes are *data*: persisted in the
  snapshot, tested (medium switch → line colour), and deliberately **not** theme-driven.
- **Chrome and default looks belong to the host** — selection box, handles, link hooks,
  connection slots, alignment guides are drawn by the engine and themed (engine 2.4+);
  the designer applies an antd-aligned chrome and a host can override it with
  `ice.setChrome(...)` / `ice.setTheme(...)`. A JSON document never themes the editor UI.
- **Labels live in `style.label`** (canonical since engine 2.4); the older top-level
  `labelStyle` is a deprecated alias folded into it. Style values may reference theme
  tokens as plain strings (`"fillStyle": "$primary"`) — the engine resolves them at paint
  time, so a host theme switch repaints the diagram.

## Skill path

```text
skills/ice-entity-designer-dsl/SKILL.md
```

## Supported concepts

- **ER**: Entity / Field / Relation, one-to-many / many-to-one / one-to-one /
  many-to-many, PK / FK / UQ / AI / NN
- **Flowchart**: terminator / process / decision / io, labeled branch edges,
  Visio or bezier links
- **BPMN 2.0**: pool / lane / task / event / gateway / subprocess / dataObject /
  annotation, sequence / message / association flows, conditions and default
  flows, semantic validation (`designer.validateBpmn()`) and BPMN 2.0 XML
  interop (`toBpmnXml` / `fromBpmnXml`)

## Example

```json
{
  "schemaVersion": 1,
  "kind": "bpmn",
  "nodes": [
    { "id": "bank", "kind": "pool", "title": "银行" },
    { "id": "accept", "kind": "lane", "title": "受理岗", "parent": "bank" },
    { "id": "submit", "kind": "event", "title": "申请提交", "eventKind": "start", "parent": "accept" },
    { "id": "verify", "kind": "task", "title": "身份核验", "taskType": "service", "parent": "accept" }
  ],
  "edges": [{ "source": "submit", "target": "verify", "label": "受理" }]
}
```

ER 与流程图文档示例见 `README.md` 与 `skills/ice-entity-designer-dsl/SKILL.md`。

## Install command

```bash
skill-installer install ice-entity-designer-dsl
```
