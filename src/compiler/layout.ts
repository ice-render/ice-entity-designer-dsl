/**
 * 分层自动布局（流程图 / BPMN / UML / 状态机共用）。
 *
 * **实现已迁到引擎的纯内核** `computeLayeredLayout`（ice-render 2.8.0 起导出）：
 * 分层（最长路径法，环安全）、层内排序（重心法 4 轮）、方向与交叉轴对齐都在内核里，
 * 本文件只负责编译器关心的两件事：
 *
 * 1. **按 `originX/originY` 平移到画布坐标**（默认 (80, 80)，与手写坐标的观感一致）；
 * 2. 保持旧签名（`Map<id, {left, top}>`）不变，调用方（UML / 流程图 / BPMN 编译器）零改动。
 *
 * 为什么不再自己实现一份：此前这里有 148 行自研分层算法，与引擎的 `ICELayeredLayout`
 * 是同一套东西，口径会漂（层内排序/环处理各写各的）。现在两边共用一份内核 ——
 * 引擎负责"写回组件 + 对齐连线端点"，编译器负责"算好坐标写进文档"。
 */
import { computeLayeredLayout } from 'ice-render';

export type LayoutItem = {
  id: string;
  width: number;
  height: number;
};

export type LayoutEdge = {
  sourceId: string;
  targetId: string;
};

export type LayoutOptions = {
  gapX?: number;
  gapY?: number;
  /** 布局结果的左上角落点，默认 (80, 80) */
  originX?: number;
  originY?: number;
  /**
   * 主干方向：`vertical`（默认，流程图：层自上而下、同层左右排开）
   * 或 `horizontal`（BPMN：层自左而右、同层上下排开）。
   */
  direction?: 'vertical' | 'horizontal';
};

export function layeredLayout(
  items: LayoutItem[],
  edges: LayoutEdge[],
  options: LayoutOptions = {}
): Map<string, { left: number; top: number }> {
  const gapX = Number(options.gapX) || 90;
  const gapY = Number(options.gapY) || 90;
  const originX = options.originX === undefined ? 80 : options.originX;
  const originY = options.originY === undefined ? 80 : options.originY;

  const positions = computeLayeredLayout(
    items.map((item) => ({ id: item.id, width: item.width, height: item.height })),
    edges.map((edge) => ({ from: edge.sourceId, to: edge.targetId })),
    {
      // 引擎内核的语义：gapX = 层间距、gapY = 层内间距；
      // 编译器的历史语义刚好相反（vertical 时层间距看 gapY），这里按方向换算一次，
      // 保证输出的坐标与迁移前逐像素一致。
      gapX: options.direction === 'vertical' ? gapY : gapX,
      gapY: options.direction === 'vertical' ? gapX : gapY,
      direction: options.direction === 'horizontal' ? 'horizontal' : 'vertical',
      // 编译器要的是"层内居中"的观感（引擎布局器默认 start，保持它自己的历史行为）
      crossAlign: 'center',
    }
  );

  const result = new Map<string, { left: number; top: number }>();
  if (!positions.size) {
    return result;
  }
  let minLeft = Infinity;
  let minTop = Infinity;
  positions.forEach((position) => {
    minLeft = Math.min(minLeft, position.left);
    minTop = Math.min(minTop, position.top);
  });
  positions.forEach((position, id) => {
    result.set(id, {
      left: Math.round(position.left - minLeft + originX),
      top: Math.round(position.top - minTop + originY),
    });
  });
  return result;
}
