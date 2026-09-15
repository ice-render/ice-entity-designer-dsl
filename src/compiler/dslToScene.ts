import { isFlowDsl } from '../types';
import type { DslErDocument, DslEntity, DslRelation } from '../types';
import { buildLayeredLayoutSpec } from './layout';
import type { DslLayoutSpec } from './layout';

export type CompiledScene = {
  entities: Array<Record<string, any>>;
  relations: Array<Record<string, any>>;
  layout?: string;
  /** 布局意图（引擎布局描述符）：运行期照单执行（见 runtime/renderDsl.ts 的 applySceneLayout） */
  layoutSpec?: DslLayoutSpec | null;
  options?: Record<string, any>;
};

function entityName(entity: DslEntity): string {
  return entity.entityName || entity.name || entity.id;
}

function relationType(relation: DslRelation): string {
  return relation.relationType || relation.type || 'one-to-many';
}

/** ER 文档 → Entity / Relation 构造参数（流程图请用 compileFlowDsl） */
export function compileDsl(dsl: DslErDocument): CompiledScene {
  if (isFlowDsl(dsl)) {
    throw new Error('compileDsl() 只处理 ER 文档；流程图文档请使用 compileFlowDsl()');
  }
  if (!dsl || !Array.isArray(dsl.entities)) {
    throw new Error('ER 文档必须包含 entities 数组');
  }
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

  const layoutOptions: any = dsl.options || {};
  return {
    entities,
    relations,
    layout: dsl.layout,
    // ER 的坐标不由编译器算，而是运行期排（见 runtime/renderDsl.ts）——
    // 这里把"用什么排"随场景带出去，运行期照单执行（旧场景没有这个字段时走兼容分支）
    layoutSpec:
      dsl.layout
        ? buildLayeredLayoutSpec({
            gapX: Number(layoutOptions.gapX) || 120,
            gapY: Number(layoutOptions.gapY) || 50,
          })
        : null,
    options: dsl.options,
  };
}
