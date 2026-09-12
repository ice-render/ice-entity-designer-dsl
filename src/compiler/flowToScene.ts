import { FLOW_NODE_KINDS } from 'ice-entity-designer';
import type { DslFlowDocument, DslFlowEdge, DslFlowNode, DslFlowNodeKind } from '../types';

export type CompiledFlowNode = {
  id: string;
  typeId: string;
  kind: DslFlowNodeKind;
  title: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fillColor: string;
  strokeColor: string;
};

export type CompiledFlowEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePort: string;
  targetPort: string;
  label: string;
  linkShape: string;
};

export type CompiledFlowScene = {
  kind: 'flowchart';
  nodes: CompiledFlowNode[];
  edges: CompiledFlowEdge[];
  layout: string;
  options?: Record<string, any>;
};

const PRESETS: Record<string, { width: number; height: number; fill: string; stroke: string }> = {
  terminator: { width: FLOW_NODE_KINDS.terminator.width, height: FLOW_NODE_KINDS.terminator.height, fill: FLOW_NODE_KINDS.terminator.fill, stroke: FLOW_NODE_KINDS.terminator.stroke },
  process: { width: FLOW_NODE_KINDS.process.width, height: FLOW_NODE_KINDS.process.height, fill: FLOW_NODE_KINDS.process.fill, stroke: FLOW_NODE_KINDS.process.stroke },
  decision: { width: FLOW_NODE_KINDS.decision.width, height: FLOW_NODE_KINDS.decision.height, fill: FLOW_NODE_KINDS.decision.fill, stroke: FLOW_NODE_KINDS.decision.stroke },
  io: { width: FLOW_NODE_KINDS.io.width, height: FLOW_NODE_KINDS.io.height, fill: FLOW_NODE_KINDS.io.fill, stroke: FLOW_NODE_KINDS.io.stroke },
};

function nodeKind(node: DslFlowNode): DslFlowNodeKind {
  return node.kind && PRESETS[node.kind] ? node.kind : 'process';
}

function nodeTitle(node: DslFlowNode): string {
  return node.title || node.name || node.id;
}

/**
 * 分层自动布局：按「无入边节点为第 0 层、其余取前驱最大层 + 1」分层，
 * 同层按文档顺序横向排列，层间距 gapY、同层间距 gapX。
 *
 * 循环引用时用小步数上限保护（超过即按文档顺序兜底），保证一定给出确定性的坐标。
 */
function autoLayout(nodes: CompiledFlowNode[], edges: CompiledFlowEdge[], gapX: number, gapY: number): void {
  const byId = new Map<string, CompiledFlowNode>();
  nodes.forEach((node) => byId.set(node.id, node));

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  nodes.forEach((node) => {
    incoming.set(node.id, 0);
    outgoing.set(node.id, []);
  });
  edges.forEach((edge) => {
    if (!byId.has(edge.sourceId) || !byId.has(edge.targetId)) {
      return;
    }
    incoming.set(edge.targetId, (incoming.get(edge.targetId) || 0) + 1);
    outgoing.get(edge.sourceId)!.push(edge.targetId);
  });

  const depth = new Map<string, number>();
  const queue: string[] = [];
  nodes.forEach((node) => {
    if ((incoming.get(node.id) || 0) === 0) {
      depth.set(node.id, 0);
      queue.push(node.id);
    }
  });
  // 全环图（没有入度为 0 的节点）时以第一个节点为根，保证仍能分层
  if (!queue.length && nodes.length) {
    depth.set(nodes[0].id, 0);
    queue.push(nodes[0].id);
  }

  let guard = nodes.length * nodes.length + nodes.length;
  while (queue.length && guard-- > 0) {
    const current = queue.shift() as string;
    const currentDepth = depth.get(current) || 0;
    (outgoing.get(current) || []).forEach((next) => {
      const candidate = currentDepth + 1;
      if ((depth.get(next) ?? -1) < candidate) {
        depth.set(next, candidate);
        queue.push(next);
      }
    });
  }
  nodes.forEach((node) => {
    if (!depth.has(node.id)) {
      depth.set(node.id, 0);
    }
  });

  const layers = new Map<number, CompiledFlowNode[]>();
  nodes.forEach((node) => {
    const level = depth.get(node.id) || 0;
    if (!layers.has(level)) {
      layers.set(level, []);
    }
    layers.get(level)!.push(node);
  });

  const orderedLevels = [...layers.keys()].sort((a, b) => a - b);
  const layerHeights = orderedLevels.map((level) => Math.max(...layers.get(level)!.map((node) => node.height)));
  const totalHeight = layerHeights.reduce((sum, height) => sum + height, 0) + Math.max(orderedLevels.length - 1, 0) * gapY;

  let y = 0;
  orderedLevels.forEach((level, levelIndex) => {
    const items = layers.get(level)!;
    const width = items.reduce((sum, node) => sum + node.width, 0) + Math.max(items.length - 1, 0) * gapX;
    let x = -width / 2;
    items.forEach((node) => {
      node.left = Math.round(x);
      node.top = Math.round(y + (layerHeights[levelIndex] - node.height) / 2);
      x += node.width + gapX;
    });
    y += layerHeights[levelIndex] + gapY;
  });

  // 让整体左上角落在 (80, 80)，与手写坐标的观感一致
  const minLeft = Math.min(...nodes.map((node) => node.left));
  const minTop = Math.min(...nodes.map((node) => node.top));
  nodes.forEach((node) => {
    node.left += 80 - minLeft;
    node.top += 80 - minTop;
  });
  void totalHeight;
}

/**
 * 流程图 DSL → FlowNode / FlowEdge 构造参数。
 *
 * - 节点缺省尺寸/配色取 `FLOW_NODE_KINDS` 预设；
 * - 只要有一个节点缺坐标（或显式 `layout: 'layered'`），就对全部节点做分层自动布局；
 * - 连线的端口默认「下出上入」（B → T），分支标签走 label。
 */
export function compileFlowDsl(dsl: DslFlowDocument): CompiledFlowScene {
  const options: any = dsl.options || {};
  const nodes: CompiledFlowNode[] = (dsl.nodes || []).map((item) => {
    const kind = nodeKind(item);
    const preset = PRESETS[kind];
    return {
      id: item.id,
      typeId: 'FlowNode',
      kind,
      title: nodeTitle(item),
      left: typeof item.left === 'number' ? item.left : Number.NaN,
      top: typeof item.top === 'number' ? item.top : Number.NaN,
      width: typeof item.width === 'number' ? item.width : preset.width,
      height: typeof item.height === 'number' ? item.height : preset.height,
      fillColor: item.fillColor || preset.fill,
      strokeColor: item.strokeColor || preset.stroke,
    };
  });

  const edges: CompiledFlowEdge[] = (dsl.edges || []).map((item: DslFlowEdge, index) => ({
    id: item.id || `edge-${index}`,
    sourceId: item.source,
    targetId: item.target,
    sourcePort: item.sourcePort || 'B',
    targetPort: item.targetPort || 'T',
    label: item.label || '',
    linkShape: item.linkShape || 'visio',
  }));

  const layout = options.layout || 'layered';
  const needsLayout = layout !== 'none' && nodes.some((node) => Number.isNaN(node.left) || Number.isNaN(node.top));
  if (needsLayout) {
    nodes.forEach((node) => {
      if (Number.isNaN(node.left)) node.left = 0;
      if (Number.isNaN(node.top)) node.top = 0;
    });
    autoLayout(nodes, edges, Number(options.gapX) || 90, Number(options.gapY) || 90);
  }
  nodes.forEach((node) => {
    if (Number.isNaN(node.left)) node.left = 0;
    if (Number.isNaN(node.top)) node.top = 0;
  });

  return { kind: 'flowchart', nodes, edges, layout, options };
}
