export type DslRelationType = 'one-to-many' | 'many-to-one' | 'one-to-one' | 'many-to-many';

export type DslField = {
  name: string;
  type?: string;
  length?: number | string;
  primary?: boolean;
  foreignKey?: boolean;
  generated?: boolean;
  autoIncrement?: boolean;
  nullable?: boolean;
  unique?: boolean;
  default?: any;
  comment?: string;
  index?: boolean;
};

export type DslEntity = {
  id: string;
  name?: string;
  entityName?: string;
  fields?: DslField[];
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  style?: Record<string, any>;
  headerStyle?: Record<string, any>;
  fieldStyle?: Record<string, any>;
  dividerStyle?: Record<string, any>;
  draggable?: boolean;
  interactive?: boolean;
};

export type DslRelation = {
  id?: string;
  source: string;
  target: string;
  type?: DslRelationType;
  relationType?: DslRelationType;
  sourceField?: string;
  targetField?: string;
  nullable?: boolean;
  onDelete?: string;
  onUpdate?: string;
  joinTableName?: string;
  fromKey?: string;
  toKey?: string;
  sourceCardinality?: string;
  targetCardinality?: string;
  label?: string;
  style?: Record<string, any>;
  arrow?: string;
  linkShape?: string;
  routeType?: string;
  routeOffset?: number;
  curveType?: string;
  lineDash?: number[];
};

export type DslLayout = 'grid' | 'layered' | 'horizontal' | 'vertical';

/** ER 文档（实体 / 关系） */
export type DslErDocument = {
  schemaVersion?: number;
  entities: DslEntity[];
  relations?: DslRelation[];
  layout?: DslLayout;
  options?: {
    fitViewport?: boolean;
    routeType?: string;
    gapX?: number;
    gapY?: number;
  };
};

/* ------------------------------------------------------------------------- *
 * 流程图文档（kind: 'flowchart'）
 *
 * AI Agent 只需要给出「节点 + 连线」；坐标可以省略，缺省时按分层自动布局。
 * ------------------------------------------------------------------------- */

export type DslPort = 'T' | 'R' | 'B' | 'L' | 'C';
export type DslFlowNodeKind = 'terminator' | 'process' | 'decision' | 'io';

export type DslFlowNode = {
  id: string;
  /** 节点类型，默认 process */
  kind?: DslFlowNodeKind;
  /** 节点文字（title / name 二者取一，name 兼容 ER 文档写法） */
  title?: string;
  name?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  fillColor?: string;
  strokeColor?: string;
};

export type DslFlowEdge = {
  id?: string;
  source: string;
  target: string;
  /** 分支标签，例如「是 / 否」 */
  label?: string;
  /** 连线离开源节点的位置，默认 B（下） */
  sourcePort?: DslPort;
  /** 连线进入目标节点的位置，默认 T（上） */
  targetPort?: DslPort;
  linkShape?: 'visio' | 'bezier';
};

export type DslFlowDocumentOptions = {
  /** 是否自动适应视图，默认 true */
  fitViewport?: boolean;
  fitViewportPadding?: number;
  viewport?: {
    scale: number;
    tx: number;
    ty: number;
  };
  /** 节点缺坐标时的自动布局，默认 layered */
  layout?: 'layered' | 'none';
  gapX?: number;
  gapY?: number;
};

export type DslFlowDocument = {
  schemaVersion?: number;
  kind: 'flowchart';
  nodes: DslFlowNode[];
  edges?: DslFlowEdge[];
  options?: DslFlowDocumentOptions;
};

/** 一份 DSL 文档：ER（默认）或 流程图（kind: 'flowchart'） */
export type DslDocument = DslErDocument | DslFlowDocument;

export type DslValidationResult = {
  valid: boolean;
  errors: string[];
};

/** 运行时判别：带 kind: 'flowchart' 的按流程图文档处理 */
export function isFlowDsl(dsl: any): dsl is DslFlowDocument {
  return !!dsl && typeof dsl === 'object' && dsl.kind === 'flowchart';
}
