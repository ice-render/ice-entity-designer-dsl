/**
 * 分层自动布局（流程图与 BPMN 共用）。
 *
 * 规则：无入边节点为第 0 层，其余节点取「前驱最大层 + 1」；同层按文档顺序横向排列，
 * 层内垂直居中，层间距 gapY、同层间距 gapX。循环引用用小步数上限保护，
 * 全环图以第一个节点为根 —— 保证任何输入都能给出**确定性**的坐标。
 *
 * 两个方向：`vertical`（默认，流程图）层自上而下、同层左右排开；
 * `horizontal`（BPMN）层自左而右、同层上下排开。
 *
 * 返回的是 id → {left, top} 的映射，不改动入参；调用方决定写回哪里
 * （流程图写到画布坐标，BPMN 写到所属容器的内容区）。
 */

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
  const result = new Map<string, { left: number; top: number }>();
  if (!items.length) {
    return result;
  }

  const byId = new Map<string, LayoutItem>();
  items.forEach((item) => byId.set(item.id, item));

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  items.forEach((item) => {
    incoming.set(item.id, 0);
    outgoing.set(item.id, []);
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
  items.forEach((item) => {
    if ((incoming.get(item.id) || 0) === 0) {
      depth.set(item.id, 0);
      queue.push(item.id);
    }
  });
  // 全环图（没有入度为 0 的节点）时以第一个节点为根，保证仍能分层
  if (!queue.length) {
    depth.set(items[0].id, 0);
    queue.push(items[0].id);
  }

  let guard = items.length * items.length + items.length;
  while (queue.length && guard-- > 0) {
    const current = queue.shift() as string;
    const currentDepth = depth.get(current) || 0;
    (outgoing.get(current) || []).forEach((next) => {
      const candidate = currentDepth + 1;
      if ((depth.get(next) === undefined ? -1 : (depth.get(next) as number)) < candidate) {
        depth.set(next, candidate);
        queue.push(next);
      }
    });
  }
  items.forEach((item) => {
    if (!depth.has(item.id)) {
      depth.set(item.id, 0);
    }
  });

  const layers = new Map<number, LayoutItem[]>();
  items.forEach((item) => {
    const level = depth.get(item.id) || 0;
    if (!layers.has(level)) {
      layers.set(level, []);
    }
    layers.get(level)!.push(item);
  });

  const orderedLevels = [...layers.keys()].sort((a, b) => a - b);
  const horizontal = options.direction === 'horizontal';

  if (horizontal) {
    // BPMN 观感：主干自左而右，同一层上下排开、在层内垂直居中
    const layerWidths = orderedLevels.map((level) => Math.max(...layers.get(level)!.map((item) => item.width)));
    let x = 0;
    orderedLevels.forEach((level, levelIndex) => {
      const layerItems = layers.get(level)!;
      const height = layerItems.reduce((sum, item) => sum + item.height, 0) + Math.max(layerItems.length - 1, 0) * gapY;
      let y = -height / 2;
      layerItems.forEach((item) => {
        result.set(item.id, {
          left: Math.round(x + (layerWidths[levelIndex] - item.width) / 2),
          top: Math.round(y),
        });
        y += item.height + gapY;
      });
      x += layerWidths[levelIndex] + gapX;
    });
  } else {
    const layerHeights = orderedLevels.map((level) => Math.max(...layers.get(level)!.map((item) => item.height)));
    let y = 0;
    orderedLevels.forEach((level, levelIndex) => {
      const layerItems = layers.get(level)!;
      const width = layerItems.reduce((sum, item) => sum + item.width, 0) + Math.max(layerItems.length - 1, 0) * gapX;
      let x = -width / 2;
      layerItems.forEach((item) => {
        result.set(item.id, {
          left: Math.round(x),
          top: Math.round(y + (layerHeights[levelIndex] - item.height) / 2),
        });
        x += item.width + gapX;
      });
      y += layerHeights[levelIndex] + gapY;
    });
  }

  // 整体平移到指定原点（默认与手写坐标的观感一致：左上角在 (80, 80)）
  const minLeft = Math.min(...items.map((item) => result.get(item.id)!.left));
  const minTop = Math.min(...items.map((item) => result.get(item.id)!.top));
  result.forEach((position) => {
    position.left += originX - minLeft;
    position.top += originY - minTop;
  });
  return result;
}
