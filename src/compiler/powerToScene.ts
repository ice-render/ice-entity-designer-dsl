import type { DslPowerDocument, DslPowerEdge, DslPowerNode } from '../types';

export type CompiledPowerNode = {
  id: string;
  kind: string;
  title: string;
  voltageLevel: string;
  left: number;
  top: number;
  width?: number;
  height?: number;
  switchState?: 'open' | 'closed';
  source: boolean;
};

export type CompiledPowerEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePort: string;
  targetPort: string;
  voltageLevel: string;
};

export type CompiledPowerAttachment = { deviceId: string; busId: string };

export type CompiledPowerScene = {
  kind: 'power';
  nodes: CompiledPowerNode[];
  edges: CompiledPowerEdge[];
  /** 母线 T 接：渲染时对每一条调用 `designer.attachToBus(device, bus)` */
  attachments: CompiledPowerAttachment[];
  options?: Record<string, any>;
};

/** 省略坐标时的默认网格（真实图纸建议显式给坐标：一次图布局本身有工程含义） */
function defaultPlacement(index: number): { left: number; top: number } {
  const columns = 6;
  return { left: 120 + (index % columns) * 200, top: 120 + Math.floor(index / columns) * 160 };
}

export function compilePowerDsl(dsl: DslPowerDocument): CompiledPowerScene {
  const options: any = dsl.options || {};
  const nodes: CompiledPowerNode[] = (dsl.nodes || []).map((node: DslPowerNode, index) => {
    const placement = defaultPlacement(index);
    return {
      id: node.id,
      kind: node.kind,
      title: node.title || node.name || node.id,
      voltageLevel: String(node.voltageLevel || ''),
      left: typeof node.left === 'number' ? node.left : placement.left,
      top: typeof node.top === 'number' ? node.top : placement.top,
      width: node.width,
      height: node.height,
      switchState: node.switchState,
      source: !!node.source,
    };
  });
  const byId = new Map<string, CompiledPowerNode>();
  nodes.forEach((node) => byId.set(node.id, node));

  const edges: CompiledPowerEdge[] = (dsl.edges || []).map((edge: DslPowerEdge, index) => ({
    id: edge.id || `conductor-${index}`,
    sourceId: edge.source,
    targetId: edge.target,
    sourcePort: edge.sourcePort || 'B',
    targetPort: edge.targetPort || 'T',
    voltageLevel: edge.voltageLevel || (byId.get(edge.source) || ({} as any)).voltageLevel || '',
  }));

  const attachments: CompiledPowerAttachment[] = (dsl.nodes || [])
    .filter((node: DslPowerNode) => !!node.attachedTo)
    .map((node: DslPowerNode) => ({ deviceId: node.id, busId: String(node.attachedTo) }));

  return { kind: 'power', nodes, edges, attachments, options };
}
