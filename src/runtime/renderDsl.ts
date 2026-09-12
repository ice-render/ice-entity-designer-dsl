import { ICE, EntityDesigner, ICELayeredLayout, FlowDesigner, BpmnDesigner, UmlDesigner } from 'ice-entity-designer';
import { isBpmnDsl, isFlowDsl, isUmlDsl } from '../types';
import type { DslBpmnDocument, DslDocument, DslErDocument, DslFlowDocument, DslUmlDocument } from '../types';
import { compileDsl } from '../compiler/dslToScene';
import { compileFlowDsl } from '../compiler/flowToScene';
import { compileBpmnDsl } from '../compiler/bpmnToScene';
import { compileUmlDsl } from '../compiler/umlToScene';
import { validateDsl } from '../validate';

export type RenderErDslResult = {
  kind: 'entity';
  ice: any;
  designer: any;
};

export type RenderFlowDslResult = {
  kind: 'flowchart';
  ice: any;
  designer: any;
};

export type RenderBpmnDslResult = {
  kind: 'bpmn';
  ice: any;
  designer: any;
};

export type RenderUmlDslResult = {
  kind: 'uml';
  ice: any;
  designer: any;
};

export type RenderDslResult =
  | RenderErDslResult
  | RenderFlowDslResult
  | RenderBpmnDslResult
  | RenderUmlDslResult;

function positionLinks(designer: any, scene: any, defaultRouteType: string): any[] {
  const entityBox = new Map();
  designer.entities.forEach((entity: any) => {
    entityBox.set(entity.state.id, entity.getMinBoundingBox(true));
  });
  return scene.relations.map((relation: any) => {
    const source = entityBox.get(relation.sourceId);
    const target = entityBox.get(relation.targetId);
    let start = 'R';
    let end = 'L';
    if (source && target) {
      const dx = target.center[0] - source.center[0];
      const dy = target.center[1] - source.center[1];
      if (Math.abs(dx) > Math.abs(dy)) {
        start = dx >= 0 ? 'R' : 'L';
        end = dx >= 0 ? 'L' : 'R';
      } else {
        start = dy >= 0 ? 'B' : 'T';
        end = dy >= 0 ? 'T' : 'B';
      }
    }
    return {
      ...relation,
      routeType: relation.routeType || defaultRouteType || 'orthogonal',
      linkShape: relation.linkShape || 'visio',
      links: {
        start: { id: relation.sourceId, position: start },
        end: { id: relation.targetId, position: end },
      },
    };
  });
}

function fitViewport(ice: any, designer: any, padding: number): void {
  const entities = designer.entities || [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  entities.forEach((entity: any) => {
    const box = entity.getMinBoundingBox(true);
    const bounds = box.getMinAndMaxPoint();
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  });

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  const canvasWidth = ice.canvasWidth || 0;
  const canvasHeight = ice.canvasHeight || 0;
  if (!canvasWidth || !canvasHeight || contentWidth <= 0 || contentHeight <= 0) {
    return;
  }

  const pad = Number.isFinite(padding) && padding >= 0 ? padding : 40;
  const availableWidth = Math.max(1, canvasWidth - pad * 2);
  const availableHeight = Math.max(1, canvasHeight - pad * 2);
  const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1);
  const tx = (canvasWidth - contentWidth * scale) / 2 - minX * scale;
  const ty = (canvasHeight - contentHeight * scale) / 2 - minY * scale;
  ice.setViewport(scale, tx, ty);
}

/**
 * 渲染一份 DSL 文档：ER 文档（entities/relations）或流程图文档（kind: 'flowchart'）。
 *
 * 两种文档共用同一个入口，返回的 `kind` 表明实际渲染的是哪一类，
 * `designer` 分别是 `EntityDesigner` / `FlowDesigner` 实例。
 */
export function renderDsl(canvasOrId: any, dsl: DslDocument): RenderDslResult {
  const validation = validateDsl(dsl);
  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'));
  }
  if (isUmlDsl(dsl)) {
    return renderUmlDsl(canvasOrId, dsl);
  }
  if (isBpmnDsl(dsl)) {
    return renderBpmnDsl(canvasOrId, dsl);
  }
  if (isFlowDsl(dsl)) {
    return renderFlowDsl(canvasOrId, dsl);
  }
  return renderErDsl(canvasOrId, dsl as DslErDocument);
}

/**
 * 渲染 UML 类图文档：类是复合组件（成员由 state 派生），关系是六种记法之一。
 *
 * 语义校验用 `designer.validateUml()`；文本互操作用 `IED.toPlantUml` / `IED.fromPlantUml`；
 * 矢量导出用 `designer.toSvg()`。
 */
export function renderUmlDsl(canvasOrId: any, dsl: DslUmlDocument): RenderUmlDslResult {
  const scene = compileUmlDsl(dsl);
  const options: any = scene.options || {};
  const ice: any = new ICE().init(canvasOrId);
  const designer: any = new UmlDesigner(ice);

  scene.nodes.forEach((node: any) => {
    designer.createClass({
      id: node.id,
      kind: node.kind,
      className: node.className,
      abstract: node.abstract,
      attributes: node.attributes,
      methods: node.methods,
      left: node.left,
      top: node.top,
      width: node.width,
    });
  });
  scene.edges.forEach((edge: any) => {
    designer.createRelation(edge);
  });
  designer.select(null);

  if (options.viewport) {
    ice.setViewport(options.viewport.scale, options.viewport.tx, options.viewport.ty);
  } else if (options.fitViewport !== false) {
    designer.fitViewport(options.fitViewportPadding);
  }
  designer.resetHistory();
  return { kind: 'uml', ice, designer };
}

/**
 * 渲染 BPMN 文档：池/泳道也是节点（`parent` 声明归属），由 `BpmnDesigner` 按几何真嵌套，
 * 因此拖动池/泳道时内部图元与挂在它们上面的连线会一起走（引擎的容器 + 递归 AFTER_MOVE）。
 *
 * 语义校验沿用编辑器那一套：`designer.validateBpmn()`；BPMN XML 互操作用
 * `ice-entity-designer` 的 `toBpmnXml(designer)` / `fromBpmnXml(...)`。
 */
export function renderBpmnDsl(canvasOrId: any, dsl: DslBpmnDocument): RenderBpmnDslResult {
  const scene = compileBpmnDsl(dsl);
  const options: any = scene.options || {};
  const ice: any = new ICE().init(canvasOrId);
  const designer: any = new BpmnDesigner(ice);

  scene.nodes.forEach((node: any) => {
    const props: any = {
      id: node.id,
      title: node.title,
      left: node.left,
      top: node.top,
      width: node.width,
      height: node.height,
    };
    ['eventKind', 'trigger', 'gatewayType', 'taskType', 'fillColor', 'strokeColor'].forEach((key) => {
      if (node[key] !== undefined) {
        props[key] = node[key];
      }
    });
    designer.createNode(node.kind, props);
  });
  scene.edges.forEach((edge: any) => {
    designer.createEdge(edge);
  });
  designer.select(null);

  if (options.viewport) {
    ice.setViewport(options.viewport.scale, options.viewport.tx, options.viewport.ty);
  } else if (options.fitViewport !== false) {
    designer.fitViewport(options.fitViewportPadding);
  }
  // 渲染期创建的节点/连线不该占用撤销栈
  designer.resetHistory();
  return { kind: 'bpmn', ice, designer };
}

/** 渲染流程图文档：节点缺坐标时已由 compileFlowDsl 做过分层自动布局 */
export function renderFlowDsl(canvasOrId: any, dsl: DslFlowDocument): RenderFlowDslResult {
  const scene = compileFlowDsl(dsl);
  const options: any = scene.options || {};
  const ice: any = new ICE().init(canvasOrId);
  const designer: any = new FlowDesigner(ice);

  scene.nodes.forEach((node: any) => {
    designer.createNode(node.kind, node);
  });
  scene.edges.forEach((edge: any) => {
    designer.createEdge(edge);
  });
  designer.select(null);

  if (options.viewport) {
    ice.setViewport(options.viewport.scale, options.viewport.tx, options.viewport.ty);
  } else if (options.fitViewport !== false) {
    // 流程图默认适应视图（ER 的默认是不动视图，保持既有行为）
    designer.fitViewport(options.fitViewportPadding);
  }
  // 渲染期创建的节点/连线不该占用撤销栈
  designer.resetHistory();
  return { kind: 'flowchart', ice, designer };
}

function renderErDsl(canvasOrId: any, dsl: DslErDocument): RenderErDslResult {
  const scene = compileDsl(dsl);
  const options: any = scene.options || {};
  const ice: any = new ICE().init(canvasOrId);
  const designer: any = new EntityDesigner(ice);

  scene.entities.forEach((entity: any) => {
    designer.createEntity(entity);
  });

  positionLinks(designer, scene, options.routeType).forEach((relation: any) => {
    designer.createRelation(relation);
  });

  if (scene.layout === 'layered' || scene.layout === 'horizontal') {
    new ICELayeredLayout({
      gapX: options.gapX || 120,
      gapY: options.gapY || 50,
    }).layoutContainer(ice);
  }

  if (options.viewport) {
    ice.setViewport(options.viewport.scale, options.viewport.tx, options.viewport.ty);
  } else if (options.fitViewport) {
    fitViewport(ice, designer, options.fitViewportPadding);
  }

  return { kind: 'entity', ice, designer };
}
