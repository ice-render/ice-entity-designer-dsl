# Skill PR: ice-entity-designer-dsl

## Title

Add `ice-entity-designer-dsl` skill for rendering ER diagrams from JSON DSL.

## Summary

`ice-entity-designer-dsl` lets AI Agents render Entity/Relation diagrams through `ice-entity-designer`.

## Skill path

```text
skills/ice-entity-designer-dsl/SKILL.md
```

## Supported concepts

- Entity
- Field
- Relation
- one-to-many / many-to-one / one-to-one / many-to-many
- PK / FK / UQ / AI / NN

## Example

```json
{
  "schemaVersion": 1,
  "layout": "layered",
  "entities": [
    {
      "id": "customer",
      "name": "Customer",
      "fields": [
        { "name": "id", "type": "number", "primary": true }
      ]
    }
  ],
  "relations": []
}
```

## Install command

```bash
skill-installer install ice-entity-designer-dsl
```
