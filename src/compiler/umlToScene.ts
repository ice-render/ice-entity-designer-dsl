import type { DslUmlDocument, DslUmlEdge, DslUmlNode, DslUmlNodeKind, DslUmlRelationType } from '../types';
import { buildLayeredLayoutSpec, layeredLayout } from './layout';

export type CompiledUmlNode = {
  id: string;
  kind: DslUmlNodeKind;
  className: string;
  abstract: boolean;
  attributes: string[];
  methods: string[];
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CompiledUmlEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  relationKind: DslUmlRelationType;
  label: string;
};

export type CompiledUmlScene = {
  kind: 'uml';
  nodes: CompiledUmlNode[];
  edges: CompiledUmlEdge[];
  layout: string;
  /** 布局意图（引擎布局描述符）：运行期/再次自动布局照单执行，与编译期坐标一致 */
  layoutSpec?: import('./layout').DslLayoutSpec | null;
  options?: Record<string, any>;
};

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 120;

function nodeKind(node: DslUmlNode): DslUmlNodeKind {
  return node.kind || 'class';
}

/**
 * UML 文档 → `UmlClass` / `UmlRelation` 构造参数。
 *
 * 与流程图/BPMN 同一套自动布局：只要有一个节点缺坐标，就对整张图做分层布局。
 * 类图的分层方向是**继承自上而下**（父类在上、子类在下），所以用 `direction: 'vertical'`
 * 并且把继承/实现边当作层级关系 —— 读起来就是标准的类图排布。
 */
export function compileUmlDsl(dsl: DslUmlDocument): CompiledUmlScene {
  const options: any = dsl.options || {};
  const nodes: CompiledUmlNode[] = (dsl.nodes || []).map((item) => ({
    id: item.id,
    kind: nodeKind(item),
    className: item.title || item.name || item.id,
    abstract: !!item.abstract,
    attributes: Array.isArray(item.attributes) ? item.attributes.map((text) => String(text)) : [],
    methods: Array.isArray(item.methods) ? item.methods.map((text) => String(text)) : [],
    left: typeof item.left === 'number' ? item.left : Number.NaN,
    top: typeof item.top === 'number' ? item.top : Number.NaN,
    width: typeof item.width === 'number' ? item.width : DEFAULT_WIDTH,
    // 高度由类框按成员自动算；这里给的只是「布局用的估计值」
    height:
      typeof item.height === 'number'
        ? item.height
        : DEFAULT_HEIGHT + (item.attributes ? item.attributes.length : 0) * 24 + (item.methods ? item.methods.length : 0) * 24,
  }));

  const edges: CompiledUmlEdge[] = (dsl.edges || []).map((item: DslUmlEdge, index) => ({
    id: item.id || `relation-${index}`,
    sourceId: item.source,
    targetId: item.target,
    relationKind: item.type || item.relation || 'association',
    label: item.label || '',
  }));

  const layout = options.layout || 'layered';
  const needsLayout = layout !== 'none' && nodes.some((node) => Number.isNaN(node.left) || Number.isNaN(node.top));
  if (needsLayout) {
    nodes.forEach((node) => {
      if (Number.isNaN(node.left)) node.left = 0;
      if (Number.isNaN(node.top)) node.top = 0;
    });
    // 只有继承/实现参与分层：关联/依赖/聚合/组合是横向语义，不该把类推到下一层。
    //
    // 注意方向要**翻过来**：模型里继承边是「子 → 父」（target 是父类），
    // 而分层布局的语义是「source 在前、target 在后」。不翻的话父类会被排到子类下面，
    // 整张类图上下颠倒。
    const hierarchyEdges = edges
      .filter((edge) => edge.relationKind === 'inheritance' || edge.relationKind === 'realization')
      .map((edge) => ({ sourceId: edge.targetId, targetId: edge.sourceId }));
    const positions = layeredLayout(nodes, hierarchyEdges, {
      gapX: Number(options.gapX) || 80,
      gapY: Number(options.gapY) || 110,
      originX: 80,
      originY: 80,
      direction: 'vertical',
    });
    nodes.forEach((node) => {
      const position = positions.get(node.id);
      if (position) {
        node.left = position.left;
        node.top = position.top;
      }
    });
  }
  nodes.forEach((node) => {
    if (Number.isNaN(node.left)) node.left = 0;
    if (Number.isNaN(node.top)) node.top = 0;
  });

  const gapX = Number(options.gapX) || 80;
  const gapY = Number(options.gapY) || 110;
  return {
    kind: 'uml',
    nodes,
    edges,
    layout,
    // 与编译期算坐标用的是同一套参数（方向 vertical：父类在上、子类在下）
    layoutSpec: layout === 'none' ? null : buildLayeredLayoutSpec({ gapX, gapY, direction: 'vertical' }),
    options,
  };
}
