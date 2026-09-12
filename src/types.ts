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

/* ------------------------------------------------------------------------- *
 * BPMN 2.0 文档（kind: 'bpmn'）
 *
 * 与流程图同一个「节点 + 连线」模型，只是节点词汇换成 BPMN 记法，并多了
 * **容器**（池 / 泳道）。容器不是另造一套：池/泳道也是节点，靠 `parent` 声明
 * 归属（缺省时由 designer 按坐标自动嵌套），因此文档依然是一张平坦的列表。
 * ------------------------------------------------------------------------- */

export type DslBpmnNodeKind =
  | 'pool'
  | 'lane'
  | 'task'
  | 'event'
  | 'gateway'
  | 'subprocess'
  | 'dataObject'
  | 'annotation';

/** 事件种类 / 触发 / 网关 / 任务类型（取值与编辑器属性面板一致） */
export type DslBpmnEventKind = 'start' | 'intermediate' | 'end';
export type DslBpmnTrigger = 'none' | 'message' | 'timer' | 'error' | 'terminate';
export type DslBpmnGatewayType = 'exclusive' | 'parallel' | 'inclusive' | 'event';
export type DslBpmnTaskType = 'none' | 'user' | 'service' | 'script' | 'send' | 'receive' | 'manual';
/** 连线类型：sequence 顺序流 / message 消息流（跨池）/ association 关联（数据对象、注释） */
export type DslBpmnFlowType = 'sequence' | 'message' | 'association';

export type DslBpmnNode = {
  id: string;
  /** 节点类型，默认 task */
  kind?: DslBpmnNodeKind;
  /** 节点文字（title / name 二者取一，name 兼容 ER 文档写法） */
  title?: string;
  name?: string;
  /**
   * 归属容器：泳道写所属池的 id，流程节点写所属泳道（或池）的 id。
   * 缺省时不报错 —— 有坐标的按坐标自动嵌套，没坐标的按「唯一的池」兜底并自动排布。
   */
  parent?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  /** event 用 */
  eventKind?: DslBpmnEventKind;
  trigger?: DslBpmnTrigger;
  /** gateway 用 */
  gatewayType?: DslBpmnGatewayType;
  /** task / subprocess 用 */
  taskType?: DslBpmnTaskType;
  fillColor?: string;
  strokeColor?: string;
};

export type DslBpmnEdge = {
  id?: string;
  source: string;
  target: string;
  /** 连线类型，默认 sequence；message / association 才能跨池 */
  type?: DslBpmnFlowType;
  /** 兼容别名：与 type 等价（type 优先） */
  flowType?: DslBpmnFlowType;
  label?: string;
  /** 顺序流的条件表达式（画在线上） */
  condition?: string;
  /** 默认流（画斜杠标记） */
  isDefault?: boolean;
  linkShape?: 'visio' | 'bezier';
};

export type DslBpmnDocumentOptions = {
  /** 是否自动适应视图，默认 true */
  fitViewport?: boolean;
  fitViewportPadding?: number;
  viewport?: {
    scale: number;
    tx: number;
    ty: number;
  };
  /** 缺坐标时是否自动排布（分层 + 容器内落位），默认 auto */
  layout?: 'auto' | 'none';
  /** 自动排布的同层间距 */
  gapX?: number;
  /** 自动排布的层间距 */
  gapY?: number;
};

export type DslBpmnDocument = {
  schemaVersion?: number;
  kind: 'bpmn';
  nodes: DslBpmnNode[];
  edges?: DslBpmnEdge[];
  options?: DslBpmnDocumentOptions;
};

/** 一份 DSL 文档：ER（默认）、流程图（kind: 'flowchart'）或 BPMN（kind: 'bpmn'） */
export type DslDocument = DslErDocument | DslFlowDocument | DslBpmnDocument;

export type DslValidationResult = {
  valid: boolean;
  errors: string[];
};

/** 运行时判别：带 kind: 'flowchart' 的按流程图文档处理 */
export function isFlowDsl(dsl: any): dsl is DslFlowDocument {
  return !!dsl && typeof dsl === 'object' && dsl.kind === 'flowchart';
}

/** 运行时判别：带 kind: 'bpmn' 的按 BPMN 文档处理 */
export function isBpmnDsl(dsl: any): dsl is DslBpmnDocument {
  return !!dsl && typeof dsl === 'object' && dsl.kind === 'bpmn';
}
