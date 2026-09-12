import type { DslStatechartDocument, DslStatechartEdge, DslStatechartNode, DslStatechartNodeKind } from '../types';
import { layeredLayout } from './layout';

export type CompiledStatechartNode = {
  id: string;
  kind: DslStatechartNodeKind;
  title: string;
  parent?: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CompiledStatechartEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  event: string;
  guard: string;
  action: string;
  label?: string;
};

export type CompiledStatechartScene = {
  kind: 'statechart';
  nodes: CompiledStatechartNode[];
  edges: CompiledStatechartEdge[];
  layout: string;
  options?: Record<string, any>;
};

const DEFAULT_STATE = { width: 160, height: 64 };
// 默认宽度要能并排放下两个普通状态（160 + 40 间距 + 160 + 两侧内边距），否则子状态会换行
const DEFAULT_COMPOSITE = { width: 500, height: 200 };
const PSEUDO_SIZE = 24;
const COMPOSITE_PADDING = 56; // 顶部留给复合状态的名字

function isContainer(node: DslStatechartNode): boolean {
  return (node.kind || 'state') === 'composite';
}

/**
 * 状态机 DSL → `StateNode` / `StateTransition` 构造参数。
 *
 * 自动排布分两层（与 BPMN 的池/泳道同思路）：
 * 1. **根级节点**按转移流做横向分层（状态机读起来自左而右）；
 * 2. **子状态**留在所属复合状态里，按简单流式（左→右、超宽换行）落位，复合状态按内容自适应尺寸。
 *
 * 只要给了坐标（编辑器导出）编译过程就是恒等的。
 */
export function compileStatechartDsl(dsl: DslStatechartDocument): CompiledStatechartScene {
  const options: any = dsl.options || {};
  const source = dsl.nodes || [];

  const nodes: CompiledStatechartNode[] = source.map((item) => {
    const kind: DslStatechartNodeKind = item.kind || 'state';
    const pseudo = kind === 'initial' || kind === 'final';
    const preset = kind === 'composite' ? DEFAULT_COMPOSITE : pseudo ? { width: PSEUDO_SIZE, height: PSEUDO_SIZE } : DEFAULT_STATE;
    return {
      id: item.id,
      kind,
      title: item.title || item.name || (pseudo ? '' : item.id),
      parent: item.parent,
      left: typeof item.left === 'number' ? item.left : Number.NaN,
      top: typeof item.top === 'number' ? item.top : Number.NaN,
      width: typeof item.width === 'number' ? item.width : preset.width,
      height: typeof item.height === 'number' ? item.height : preset.height,
    };
  });

  const edges: CompiledStatechartEdge[] = (dsl.edges || []).map((item: DslStatechartEdge, index) => ({
    id: item.id || `transition-${index}`,
    sourceId: item.source,
    targetId: item.target,
    event: item.event || '',
    guard: item.guard || '',
    action: item.action || '',
    label: item.label,
  }));

  const layout = options.layout || 'auto';
  // 记录「由编译器自动落位」的子状态：它们现在拿的是**局部坐标**，最后要换算成绝对坐标；
  // 显式给了坐标的子状态按绝对坐标理解，不能被再偏移一次。
  const autoPlacedChildren = new Set<string>();
  if (layout !== 'none') {
    const byId = new Map<string, CompiledStatechartNode>();
    nodes.forEach((node) => byId.set(node.id, node));

    // ---- 1) 根级节点：按转移流横向分层 ----
    const rootNodes = nodes.filter((node) => !(node.parent && byId.has(node.parent)));
    if (rootNodes.some((node) => Number.isNaN(node.left) || Number.isNaN(node.top))) {
      // 边可能要「提升」到复合状态：转移画在子状态上时，整体顺序仍由所属复合状态决定
      // （`子状态 → 根级状态` 等价于 `复合状态 → 根级状态`），否则右边的状态会被排到最左边。
      const containerOf = (id: string): string => {
        let current = byId.get(id);
        while (current && current.parent && byId.has(current.parent)) {
          current = byId.get(current.parent);
        }
        return current ? current.id : id;
      };
      const liftedEdges = edges
        .map((edge) => ({ sourceId: containerOf(edge.sourceId), targetId: containerOf(edge.targetId) }))
        .filter((edge) => edge.sourceId !== edge.targetId);
      const positions = layeredLayout(rootNodes, liftedEdges, {
        gapX: Number(options.gapX) || 110,
        gapY: Number(options.gapY) || 80,
        originX: 80,
        originY: 80,
        direction: 'horizontal',
      });
      rootNodes.forEach((node) => {
        const position = positions.get(node.id);
        if (position) {
          node.left = position.left;
          node.top = position.top;
        }
      });
    }

    // ---- 2) 复合状态：先给个位置，再按子状态流式落位并自适应尺寸 ----
    let compositeCursorTop = 0;
    nodes
      .filter((node) => node.kind === 'composite')
      .forEach((composite) => {
        const children = nodes.filter((node) => node.parent === composite.id);
        if (Number.isNaN(composite.left)) {
          composite.left = 80;
        }
        if (Number.isNaN(composite.top)) {
          const rootsBottom = Math.max(
            ...rootNodes.filter((node) => node !== composite && !Number.isNaN(node.top)).map((node) => node.top + node.height),
            0
          );
          composite.top = Math.max(rootsBottom + 60, 80) + compositeCursorTop;
          compositeCursorTop += composite.height + 60;
        }
        if (!children.length) {
          return;
        }
        // 子状态流式落位（左→右，超过容器宽度换行）
        let x = COMPOSITE_PADDING;
        let y = COMPOSITE_PADDING;
        let contentWidth = 0;
        let contentBottom = COMPOSITE_PADDING;
        const innerWidth = composite.width - COMPOSITE_PADDING * 2;
        children.forEach((child) => {
          if (!Number.isNaN(child.left) && !Number.isNaN(child.top)) {
            return;
          }
          if (x > COMPOSITE_PADDING && x + child.width > COMPOSITE_PADDING + innerWidth) {
            x = COMPOSITE_PADDING;
            y = contentBottom + 40;
          }
          autoPlacedChildren.add(child.id);
          child.left = x;
          child.top = y;
          x += child.width + 40;
          contentWidth = Math.max(contentWidth, x);
          contentBottom = Math.max(contentBottom, y + child.height);
        });
        // 自适应：容器至少装得下内容
        composite.width = Math.max(composite.width, contentWidth + COMPOSITE_PADDING);
        composite.height = Math.max(composite.height, contentBottom + COMPOSITE_PADDING);
      });

    // ---- 3) 子状态的绝对坐标：父容器左上角 + 局部坐标（引擎的嵌套语义） ----
    nodes.forEach((node) => {
      if (Number.isNaN(node.left)) node.left = 0;
      if (Number.isNaN(node.top)) node.top = 0;
    });
    const offsetChildren = (composite: CompiledStatechartNode, dx: number, dy: number): void => {
      const children = nodes.filter((node) => node.parent === composite.id);
      children.forEach((child) => {
        if (!autoPlacedChildren.has(child.id)) {
          return; // 显式坐标：按绝对坐标理解
        }
        child.left += dx;
        child.top += dy;
        offsetChildren(child, dx, dy);
      });
    };
    nodes
      .filter((node) => node.kind === 'composite')
      .forEach((composite) => offsetChildren(composite, composite.left, composite.top));
  }

  return { kind: 'statechart', nodes, edges, layout, options };
}
