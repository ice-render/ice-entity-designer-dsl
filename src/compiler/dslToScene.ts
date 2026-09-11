import type { DslDocument, DslEntity, DslRelation } from '../types';

export type CompiledScene = {
  entities: Array<Record<string, any>>;
  relations: Array<Record<string, any>>;
  layout?: string;
  options?: Record<string, any>;
};

function entityName(entity: DslEntity): string {
  return entity.entityName || entity.name || entity.id;
}

function relationType(relation: DslRelation): string {
  return relation.relationType || relation.type || 'one-to-many';
}

export function compileDsl(dsl: DslDocument): CompiledScene {
  const entities = dsl.entities.map((entity) => ({
    id: entity.id,
    entityName: entityName(entity),
    fields: entity.fields || [],
    left: entity.left,
    top: entity.top,
    width: entity.width,
    height: entity.height,
    style: entity.style,
    headerStyle: entity.headerStyle,
    fieldStyle: entity.fieldStyle,
    dividerStyle: entity.dividerStyle,
    draggable: entity.draggable,
    interactive: entity.interactive,
  }));

  const relations = (dsl.relations || []).map((relation, index) => ({
    id: relation.id || `relation-${index}`,
    relationType: relationType(relation),
    sourceId: relation.source,
    targetId: relation.target,
    sourceField: relation.sourceField || 'id',
    targetField: relation.targetField || 'id',
    nullable: relation.nullable,
    onDelete: relation.onDelete,
    onUpdate: relation.onUpdate,
    joinTableName: relation.joinTableName,
    fromKey: relation.fromKey,
    toKey: relation.toKey,
    sourceCardinality: relation.sourceCardinality,
    targetCardinality: relation.targetCardinality,
    label: relation.label,
    style: relation.style,
    arrow: relation.arrow,
    linkShape: relation.linkShape,
    routeType: relation.routeType,
    routeOffset: relation.routeOffset,
    curveType: relation.curveType,
    lineDash: relation.lineDash,
  }));

  return {
    entities,
    relations,
    layout: dsl.layout,
    options: dsl.options,
  };
}
