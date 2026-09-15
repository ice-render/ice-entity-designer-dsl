import { ICE, EntityDesigner, ICELayeredLayout, FlowDesigner, BpmnDesigner, UmlDesigner, StatechartDesigner, GanttDesigner, PowerDesigner } from 'ice-entity-designer';
import { isBpmnDsl, isFlowDsl, isUmlDsl, isStatechartDsl, isGanttDsl, isPowerDsl } from '../types';
import type {
  DslPowerDocument,
  DslBpmnDocument,
  DslGanttDocument,
  DslDocument,
  DslErDocument,
  DslFlowDocument,
  DslStatechartDocument,
  DslUmlDocument,
} from '../types';
import { compileDsl } from '../compiler/dslToScene';
import { compileFlowDsl } from '../compiler/flowToScene';
import { compileBpmnDsl } from '../compiler/bpmnToScene';
import { compileUmlDsl } from '../compiler/umlToScene';
import { compileStatechartDsl } from '../compiler/statechartToScene';
import { compileGanttDsl } from '../compiler/ganttToScene';
import { compilePowerDsl } from '../compiler/powerToScene';
import { validateDsl } from '../validate';
import { toDsl } from './exportDsl';

export type RenderErDslResult = {
  kind: 'entity';
  ice: any;
  designer: any;
  /** 把当前（可能已被用户编辑过的）实例写回同一份 DSL 文档 */
  toDsl: () => any;
};

export type RenderFlowDslResult = {
  kind: 'flowchart';
  ice: any;
  designer: any;
  /** 把当前（可能已被用户编辑过的）实例写回同一份 DSL 文档 */
  toDsl: () => any;
};

export type RenderBpmnDslResult = {
  kind: 'bpmn';
  ice: any;
  designer: any;
  /** 把当前（可能已被用户编辑过的）实例写回同一份 DSL 文档 */
  toDsl: () => any;
};

export type RenderUmlDslResult = {
  kind: 'uml';
  ice: any;
  designer: any;
  /** 把当前（可能已被用户编辑过的）实例写回同一份 DSL 文档 */
  toDsl: () => any;
};

export type RenderGanttDslResult = {
  kind: 'gantt';
  ice: any;
  designer: any;
  /** 把当前（可能已被用户编辑过的）实例写回同一份 DSL 文档 */
  toDsl: () => any;
};

export type RenderStatechartDslResult = {
  kind: 'statechart';
  ice: any;
  designer: any;
  /** 把当前（可能已被用户编辑过的）实例写回同一份 DSL 文档 */
  toDsl: () => any;
};

export type RenderDslResult =
  | RenderErDslResult
  | RenderFlowDslResult
  | RenderBpmnDslResult
  | RenderUmlDslResult
  | RenderStatechartDslResult
  | RenderGanttDslResult;

/** 每个渲染结果都自带 `toDsl()`：把用户改过的实例立刻写回同一份 DSL 文档 */
function withDsl<T extends { kind: string; ice: any; designer: any }>(result: T): T & { toDsl: () => any } {
  return Object.assign(result, { toDsl: () => toDsl(result) });
}

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
  if (isGanttDsl(dsl)) {
    return renderGanttDsl(canvasOrId, dsl);
  }
  if (isPowerDsl(dsl)) {
    return renderPowerDsl(canvasOrId, dsl);
  }
  if (isStatechartDsl(dsl)) {
    return renderStatechartDsl(canvasOrId, dsl);
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
 * 渲染甘特文档：任务条的位置由「起始日期 × 每日像素」算出（文档里不写坐标）。
 *
 * 语义校验用 `designer.validateGantt()`；矢量导出用 `designer.toSvg()`。
 */
export function renderGanttDsl(canvasOrId: any, dsl: DslGanttDocument): RenderGanttDslResult {
  const scene = compileGanttDsl(dsl);
  const options: any = scene.options || {};
  const ice: any = new ICE().init(canvasOrId);
  const designer: any = new GanttDesigner(ice);
  if (options.dayWidth) {
    designer.setDayWidth(options.dayWidth);
  }

  scene.nodes.forEach((task: any) => {
    designer.createTask({
      id: task.id,
      title: task.title,
      start: task.start,
      days: task.days,
      progress: task.progress,
      row: task.row,
      resource: task.resource,
    });
  });
  scene.edges.forEach((edge: any) => {
    designer.createDependency(edge);
  });
  designer.select(null);

  // 文档可以要求「按依赖排好期再渲染」：把绘制当天的排期推成最早可行排期
  if (options.autoSchedule) {
    designer.autoSchedule();
  }

  if (options.viewport) {
    ice.setViewport(options.viewport.scale, options.viewport.tx, options.viewport.ty);
  } else if (options.fitViewport !== false) {
    designer.fitViewport(options.fitViewportPadding);
  }
  designer.resetHistory();
  return withDsl({ kind: 'gantt', ice, designer });
}

/**
 * 渲染状态机文档：伪状态 / 状态 / 复合状态（容器）+ 转移。
 *
 * 语义校验用 `designer.validateStatechart()`；矢量导出用 `designer.toSvg()`。
 */
/**
 * 渲染电力一次系统图（单线图）文档。
 *
 * 与其它文档类型一致：DSL 只描述模型（设备 + 导体 + 母线 T 接），渲染交给
 * ice-entity-designer 的 `PowerDesigner` —— 色标、拓扑（带电范围）、五防校验都在那边。
 * 语义校验用 `designer.validatePower()`；矢量导出用 `designer.toSvg()`。
 */
export function renderPowerDsl(canvasOrId: any, dsl: DslPowerDocument): any {
  const scene = compilePowerDsl(dsl);
  const options: any = scene.options || {};
  const ice: any = new ICE().init(canvasOrId);
  const designer: any = new PowerDesigner(ice);
  if (options.voltageColors) {
    designer.setVoltageColors(options.voltageColors);
  }
  const created = new Map<string, any>();
  scene.nodes.forEach((node: any) => {
    const symbol = designer.createSymbol(node.kind, {
      // DSL 里的 id 必须透传：否则往返之后 Agent 拿到的 id 全是随机 UUID，引用不上
      id: node.id,
      title: node.title,
      name: node.title,
      voltageLevel: node.voltageLevel,
      left: node.left,
      top: node.top,
      width: node.width,
      height: node.height,
      switchState: node.switchState,
    });
    if (node.source) {
      symbol.setState({ energizedSource: true });
    }
    created.set(node.id, symbol);
  });
  scene.attachments.forEach((attachment: any) => {
    const device = created.get(attachment.deviceId);
    const bus = created.get(attachment.busId);
    if (device && bus) {
      designer.attachToBus(device, bus);
    }
  });
  scene.edges.forEach((edge: any) => {
    const source = created.get(edge.sourceId);
    const target = created.get(edge.targetId);
    if (!source || !target) {
      return;
    }
    designer.createLine({
      sourceId: source.state.id,
      targetId: target.state.id,
      sourcePort: edge.sourcePort,
      targetPort: edge.targetPort,
      voltageLevel: edge.voltageLevel,
    });
  });
  designer.select(null);
  designer.applyTopology();
  if (options.fitViewport !== false) {
    designer.fitViewport(options.fitViewportPadding);
  }
  designer.resetHistory();
  return withDsl({ kind: 'power', ice, designer });
}

export function renderStatechartDsl(canvasOrId: any, dsl: DslStatechartDocument): RenderStatechartDslResult {
  const scene = compileStatechartDsl(dsl);
  const options: any = scene.options || {};
  const ice: any = new ICE().init(canvasOrId);
  const designer: any = new StatechartDesigner(ice);

  scene.nodes.forEach((node: any) => {
    designer.createState({
      id: node.id,
      kind: node.kind,
      title: node.title,
      left: node.left,
      top: node.top,
      width: node.width,
      height: node.height,
    });
  });
  scene.edges.forEach((edge: any) => {
    designer.createTransition(edge);
  });
  designer.select(null);

  if (options.viewport) {
    ice.setViewport(options.viewport.scale, options.viewport.tx, options.viewport.ty);
  } else if (options.fitViewport !== false) {
    designer.fitViewport(options.fitViewportPadding);
  }
  designer.resetHistory();
  return withDsl({ kind: 'statechart', ice, designer });
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
  return withDsl({ kind: 'uml', ice, designer });
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
  return withDsl({ kind: 'bpmn', ice, designer });
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
  return withDsl({ kind: 'flowchart', ice, designer });
}

/** 按场景里的**布局意图**排一次；旧场景（没有 layoutSpec）走历史上的 ER 默认参数。 */
export function __applySceneLayout(ice: any, scene: any, options: any): void {
  const spec = scene && scene.layoutSpec;
  if (spec && spec.type) {
    const Ctor = typeof ice.getType === 'function' ? ice.getType(spec.type) : null;
    const manager = typeof Ctor === 'function' ? new Ctor(spec.props || {}) : null;
    if (manager && typeof manager.layoutContainer === 'function') {
      manager.layoutContainer(ice);
      return;
    }
  }
  // 兼容：引擎 2.9 之前编译出来的场景（只带 layout: 'layered' | 'horizontal'）
  if (scene && (scene.layout === 'layered' || scene.layout === 'horizontal')) {
    new ICELayeredLayout({
      gapX: options.gapX || 120,
      gapY: options.gapY || 50,
    }).layoutContainer(ice);
  }
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

  __applySceneLayout(ice, scene, options);

  if (options.viewport) {
    ice.setViewport(options.viewport.scale, options.viewport.tx, options.viewport.ty);
  } else if (options.fitViewport) {
    fitViewport(ice, designer, options.fitViewportPadding);
  }

  return withDsl({ kind: 'entity', ice, designer });
}
