import { FLOW_NODE_KINDS, FlowNode } from 'ice-entity-designer';
import type { DslBpmnDocument, DslBpmnEdge, DslBpmnNode, DslBpmnNodeKind } from '../types';
import { buildLayeredLayoutSpec, layeredLayout } from './layout';

export type CompiledBpmnNode = {
  id: string;
  typeId: string;
  /** ice-entity-designer 的 FlowNode kind（bpmn*） */
  kind: string;
  title: string;
  left: number;
  top: number;
  width: number;
  height: number;
  eventKind?: string;
  trigger?: string;
  gatewayType?: string;
  taskType?: string;
  fillColor?: string;
  strokeColor?: string;
};

export type CompiledBpmnEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  flowType: string;
  label: string;
  condition: string;
  isDefault: boolean;
  linkShape: string;
};

export type CompiledBpmnScene = {
  kind: 'bpmn';
  nodes: CompiledBpmnNode[];
  edges: CompiledBpmnEdge[];
  layout: string;
  /** 布局意图（引擎布局描述符） */
  layoutSpec?: import('./layout').DslLayoutSpec | null;
  options?: Record<string, any>;
};

/** DSL 词汇 → ice-entity-designer 的 FlowNode kind */
const KIND_BY_DSL_KIND: Record<string, string> = {
  pool: 'bpmnPool',
  lane: 'bpmnLane',
  task: 'bpmnTask',
  event: 'bpmnEvent',
  gateway: 'bpmnGateway',
  subprocess: 'bpmnSubprocess',
  dataObject: 'bpmnDataObject',
  annotation: 'bpmnAnnotation',
};

const POOL_ORIGIN_X = 60;
const POOL_ORIGIN_Y = 60;
const POOL_GAP = 60;
/** 池的名称带高度 / 泳道的名称带宽度（与 FLOW_NODE_KINDS 的 bandSize 一致） */
const POOL_BAND = Number(FLOW_NODE_KINDS.bpmnPool.bandSize) || 32;
const LANE_BAND = Number(FLOW_NODE_KINDS.bpmnLane.bandSize) || 32;
const DEFAULT_LANE_HEIGHT = Number(FLOW_NODE_KINDS.bpmnLane.height) || 130;
const MIN_POOL_WIDTH = Number(FLOW_NODE_KINDS.bpmnPool.width) || 900;
/** 容器内容区里的留白（自动排布用） */
const CONTAINER_PADDING = 28;

type WorkingNode = CompiledBpmnNode & {
  dslKind: DslBpmnNodeKind;
  parent?: string;
  /** 是否由文档显式给出（没给的才允许自动几何覆盖） */
  explicitLeft: boolean;
  explicitTop: boolean;
  explicitWidth: boolean;
  explicitHeight: boolean;
};

function presetOf(kind: string): any {
  return FLOW_NODE_KINDS[kind as keyof typeof FLOW_NODE_KINDS] || FLOW_NODE_KINDS.bpmnTask;
}

function toWorkingNode(item: DslBpmnNode): WorkingNode {
  const dslKind: DslBpmnNodeKind = item.kind || 'task';
  const preset = presetOf(KIND_BY_DSL_KIND[dslKind] || 'bpmnTask');
  const node: WorkingNode = {
    id: item.id,
    typeId: FlowNode.typeId,
    kind: KIND_BY_DSL_KIND[dslKind] || 'bpmnTask',
    title: item.title || item.name || item.id,
    left: typeof item.left === 'number' ? item.left : 0,
    top: typeof item.top === 'number' ? item.top : 0,
    width: typeof item.width === 'number' ? item.width : preset.width,
    height: typeof item.height === 'number' ? item.height : preset.height,
    fillColor: item.fillColor,
    strokeColor: item.strokeColor,
    dslKind,
    parent: item.parent,
    explicitLeft: typeof item.left === 'number',
    explicitTop: typeof item.top === 'number',
    explicitWidth: typeof item.width === 'number',
    explicitHeight: typeof item.height === 'number',
  };
  if (dslKind === 'event') {
    node.eventKind = item.eventKind || preset.eventKind || 'start';
    node.trigger = item.trigger || preset.trigger || 'none';
  }
  if (dslKind === 'gateway') {
    node.gatewayType = item.gatewayType || preset.gatewayType || 'exclusive';
  }
  if (dslKind === 'task' || dslKind === 'subprocess') {
    node.taskType = item.taskType || preset.taskType || 'none';
  }
  return node;
}

function isContainer(node: WorkingNode): boolean {
  return node.dslKind === 'pool' || node.dslKind === 'lane';
}

type Box = { minX: number; minY: number; maxX: number; maxY: number };

type NodeGroup = {
  owner: WorkingNode | null;
  nodes: WorkingNode[];
  /** 该组的包围盒（didLayout 时是「布局空间」，否则是绝对坐标；两种情况下**尺寸**都可用） */
  box: Box | null;
  /** 是否做过自动排布（做过的话坐标在布局空间，落位前需要平移） */
  didLayout: boolean;
};

function unionBox(nodes: WorkingNode[]): Box | null {
  if (!nodes.length) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  nodes.forEach((node) => {
    minX = Math.min(minX, node.left);
    minY = Math.min(minY, node.top);
    maxX = Math.max(maxX, node.left + node.width);
    maxY = Math.max(maxY, node.top + node.height);
  });
  return { minX, minY, maxX, maxY };
}

/** 泳道归属：显式 parent 优先；否则「文档里只有唯一一个池」时归它 */
function resolveLaneOwners(lanes: WorkingNode[], pools: WorkingNode[]): Map<string, string> {
  const owners = new Map<string, string>();
  lanes.forEach((lane) => {
    let owner = lane.parent;
    if (!owner && pools.length === 1) {
      owner = pools[0].id;
    }
    if (owner) {
      owners.set(lane.id, owner);
    }
  });
  return owners;
}

/**
 * 把业务图元按 `parent` 分组：泳道 / 池 / 根。
 *
 * 没写 `parent` 且文档里只有一个容器时（AI 生成的短文档很常见）归它，否则落到根级。
 */
function buildGroups(flows: WorkingNode[], containers: WorkingNode[]): NodeGroup[] {
  const byId = new Map<string, WorkingNode>();
  containers.forEach((node) => byId.set(node.id, node));
  const fallback = containers.length === 1 ? containers[0] : null;

  const groups: NodeGroup[] = [];
  const groupOf = (owner: WorkingNode | null): NodeGroup => {
    let group = groups.filter((item) => item.owner === owner)[0];
    if (!group) {
      group = { owner, nodes: [], box: null, didLayout: false };
      groups.push(group);
    }
    return group;
  };

  flows.forEach((node) => {
    const declared = node.parent ? byId.get(node.parent) : undefined;
    groupOf(declared || fallback).nodes.push(node);
  });
  return groups;
}

/** 在「布局空间」里排布每一组（左上角接近 0,0），并记下包围盒 */
function layoutGroups(groups: NodeGroup[], edges: CompiledBpmnEdge[], gapX: number, gapY: number): void {
  groups.forEach((group) => {
    const missing = group.nodes.some((node) => !node.explicitLeft || !node.explicitTop);
    if (missing) {
      // BPMN 观感是「主干自左而右」（泳道也是横向条带），因此用 horizontal
      const positions = layeredLayout(group.nodes, edges, { gapX, gapY, originX: 0, originY: 0, direction: 'horizontal' });
      group.nodes.forEach((node) => {
        const position = positions.get(node.id);
        if (position) {
          node.left = position.left;
          node.top = position.top;
        }
      });
      group.didLayout = true;
    }
    group.box = unionBox(group.nodes);
  });
}

/**
 * BPMN DSL → FlowNode / FlowEdge 构造参数。
 *
 * 与流程图同一套「节点 + 连线」语义，额外做两件事：
 *
 * 1. **容器内分层排布**：节点缺坐标时，按所属容器（`parent`）分组做分层布局（主干自左而右）。
 * 2. **容器自适应内容**：没给几何的泳道按「内容包围盒 + 名称带 + 留白」定尺寸，没给几何的池
 *    再按泳道们定尺寸，池之间纵向堆叠。**先排内容、再定尺寸、最后落位**，因此自动排出来的
 *    图元一定落在所属容器的内容区里（否则会被 `BpmnDesigner` 按几何重新归属到别的容器）。
 *
 * 池名称带（顶部 32）与泳道名称带（左侧 32）都算在内容区之外，与 `BpmnDesigner` 的归属判定一致。
 *
 * 只要给了坐标（编辑器导出 / BPMN XML 导入的产物），编译过程就完全是恒等的，不做任何挪动。
 */
export function compileBpmnDsl(dsl: DslBpmnDocument): CompiledBpmnScene {
  const options: any = dsl.options || {};
  const working: WorkingNode[] = (dsl.nodes || []).map(toWorkingNode);
  const pools = working.filter((node) => node.dslKind === 'pool');
  const lanes = working.filter((node) => node.dslKind === 'lane');
  const flows = working.filter((node) => !isContainer(node));

  const edges: CompiledBpmnEdge[] = (dsl.edges || []).map((item: DslBpmnEdge, index) => ({
    id: item.id || `edge-${index}`,
    sourceId: item.source,
    targetId: item.target,
    flowType: item.type || item.flowType || 'sequence',
    label: item.label || '',
    condition: item.condition || '',
    isDefault: !!item.isDefault,
    linkShape: item.linkShape || 'visio',
  }));

  const layout = options.layout || 'auto';
  const laneOwner = resolveLaneOwners(lanes, pools);
  const lanesOf = (poolId: string) => lanes.filter((lane) => laneOwner.get(lane.id) === poolId);
  let groups: NodeGroup[] = [];

  if (layout !== 'none') {
    groups = buildGroups(flows, pools.concat(lanes));
    layoutGroups(groups, edges, Number(options.gapX) || 90, Number(options.gapY) || 60);
  }

  // ---- 泳道尺寸：内容包围盒 + 左侧名称带 + 留白 ----
  lanes.forEach((lane) => {
    const group = groups.filter((item) => item.owner === lane)[0];
    const box = group ? group.box : null;
    if (!lane.explicitHeight) {
      lane.height = Math.round(Math.max((box ? box.maxY - box.minY : 0) + CONTAINER_PADDING * 2, DEFAULT_LANE_HEIGHT));
    }
    if (!lane.explicitWidth) {
      lane.width = Math.round(
        Math.max((box ? box.maxX - box.minX : 0) + LANE_BAND + CONTAINER_PADDING * 2, MIN_POOL_WIDTH)
      );
    }
  });

  // ---- 池尺寸：宽取最宽泳道（池内泳道等宽），高 = 名称带 + 泳道高度和 ----
  pools.forEach((pool) => {
    const ownLanes = lanesOf(pool.id);
    if (ownLanes.length) {
      const laneWidth = ownLanes.reduce((max, lane) => Math.max(max, lane.width), MIN_POOL_WIDTH);
      if (!pool.explicitWidth) {
        pool.width = laneWidth;
      }
      if (pool.explicitWidth) {
        // 池宽显式给出：池内泳道统一跟随池宽
        ownLanes.forEach((lane) => {
          if (!lane.explicitWidth) {
            lane.width = pool.width;
          }
        });
      }
      if (!pool.explicitHeight) {
        pool.height = POOL_BAND + ownLanes.reduce((sum, lane) => sum + lane.height, 0);
      }
      return;
    }
    const group = groups.filter((item) => item.owner === pool)[0];
    const box = group ? group.box : null;
    if (!pool.explicitWidth) {
      pool.width = Math.round(Math.max((box ? box.maxX - box.minX : 0) + CONTAINER_PADDING * 2, MIN_POOL_WIDTH));
    }
    if (!pool.explicitHeight) {
      pool.height = Math.round(Math.max((box ? box.maxY - box.minY : 0) + POOL_BAND + CONTAINER_PADDING * 2, 160));
    }
  });

  // ---- 池位置：没给坐标的按声明顺序纵向堆叠 ----
  let poolCursorTop = POOL_ORIGIN_Y;
  pools.forEach((pool) => {
    if (!pool.explicitLeft) {
      pool.left = POOL_ORIGIN_X;
    }
    if (!pool.explicitTop) {
      pool.top = poolCursorTop;
    }
    poolCursorTop = Math.max(poolCursorTop, pool.top + pool.height + POOL_GAP);
  });

  // ---- 泳道位置：铺满所属池的内容区；池高显式给出时，没给高度的泳道均分剩余空间 ----
  pools.forEach((pool) => {
    const ownLanes = lanesOf(pool.id);
    if (!ownLanes.length) {
      return;
    }
    const contentTop = pool.top + POOL_BAND;
    const contentHeight = Math.max(pool.height - POOL_BAND, 1);
    const fixedHeight = ownLanes.reduce((sum, lane) => sum + (lane.explicitHeight ? lane.height : 0), 0);
    const flexible = ownLanes.filter((lane) => !lane.explicitHeight);
    const flexibleHeight = flexible.length ? Math.max(contentHeight - fixedHeight, 0) / flexible.length : 0;

    let cursorTop = contentTop;
    ownLanes.forEach((lane) => {
      if (!lane.explicitLeft) {
        lane.left = pool.left;
      }
      if (!lane.explicitTop) {
        lane.top = cursorTop;
      }
      if (!lane.explicitHeight && pool.explicitHeight) {
        lane.height = Math.round(flexibleHeight || DEFAULT_LANE_HEIGHT);
      }
      cursorTop = lane.top + lane.height;
    });
  });

  // 没有池的孤立泳道：与池同一套默认观感
  let orphanTop = POOL_ORIGIN_Y;
  lanes.forEach((lane) => {
    if (laneOwner.get(lane.id)) {
      return;
    }
    if (!lane.explicitLeft) lane.left = POOL_ORIGIN_X;
    if (!lane.explicitTop) {
      lane.top = orphanTop;
      orphanTop = lane.top + lane.height + POOL_GAP;
    }
  });

  // ---- 业务图元落位：把「布局空间」的坐标平移到所属容器的内容区 ----
  groups.forEach((group) => {
    const box = group.box;
    if (!box || !group.didLayout) {
      return;
    }
    const owner = group.owner;
    let originX = 80;
    let originY = 80;
    if (owner) {
      originX = owner.left + CONTAINER_PADDING;
      originY = owner.top + CONTAINER_PADDING;
      if (owner.dslKind === 'pool') {
        originY += POOL_BAND;
      } else {
        originX += LANE_BAND;
      }
    }
    group.nodes.forEach((node) => {
      node.left = Math.round(originX + (node.left - box.minX));
      node.top = Math.round(originY + (node.top - box.minY));
    });
  });

  // 创建顺序：池 → 泳道 → 业务图元（`BpmnDesigner` 按几何嵌套，容器必须先存在）
  const outputNodes: CompiledBpmnNode[] = pools.concat(lanes).concat(flows).map((node) => {
    const output: CompiledBpmnNode = {
      id: node.id,
      typeId: FlowNode.typeId,
      kind: node.kind,
      title: node.title,
      left: node.left,
      top: node.top,
      width: node.width,
      height: node.height,
    };
    if (node.eventKind !== undefined) output.eventKind = node.eventKind;
    if (node.trigger !== undefined) output.trigger = node.trigger;
    if (node.gatewayType !== undefined) output.gatewayType = node.gatewayType;
    if (node.taskType !== undefined) output.taskType = node.taskType;
    if (node.fillColor !== undefined) output.fillColor = node.fillColor;
    if (node.strokeColor !== undefined) output.strokeColor = node.strokeColor;
    return output;
  });

  return {
    kind: 'bpmn',
    nodes: outputNodes,
    edges,
    layout,
    // BPMN 的自动布局是"每个容器内部各排一次"（原点是容器内容区左上角）
    layoutSpec: buildLayeredLayoutSpec({ gapX: Number(options.gapX) || 90, gapY: Number(options.gapY) || 60, direction: 'horizontal' }),
    options,
  };
}
