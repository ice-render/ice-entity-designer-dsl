import { FLOW_NODE_KINDS, FlowNode } from 'ice-entity-designer';
import type { DslFlowDocument, DslFlowEdge, DslFlowNode, DslFlowNodeKind } from '../types';
import { buildLayeredLayoutSpec, layeredLayout } from './layout';

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
  /** 布局意图（引擎布局描述符） */
  layoutSpec?: import('./layout').DslLayoutSpec | null;
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

/** 分层自动布局（实现见 compiler/layout.ts，与 BPMN 共用） */
function autoLayout(nodes: CompiledFlowNode[], edges: CompiledFlowEdge[], gapX: number, gapY: number): void {
  const positions = layeredLayout(nodes, edges, { gapX, gapY });
  nodes.forEach((node) => {
    const position = positions.get(node.id);
    if (position) {
      node.left = position.left;
      node.top = position.top;
    }
  });
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
      typeId: FlowNode.typeId,
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

  return {
    kind: 'flowchart',
    nodes,
    edges,
    layout,
    layoutSpec:
      layout === 'none' ? null : buildLayeredLayoutSpec({ gapX: Number(options.gapX) || 90, gapY: Number(options.gapY) || 90 }),
    options,
  };
}
