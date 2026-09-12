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

/** 一份 DSL 文档：ER（默认）、流程图、BPMN、UML 或 状态机 */
export type DslDocument =
  | DslErDocument
  | DslFlowDocument
  | DslBpmnDocument
  | DslUmlDocument
  | DslStatechartDocument
  | DslGanttDocument;

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

/* ------------------------------------------------------------------------- *
 * UML 类图文档（kind: 'uml'）
 *
 * 与流程图同一套「节点 + 连线」模型：节点 = 类/接口/枚举，连线 = 六种关系。
 * 成员是**自由文本**（`- id: string` / `+ pay(): void`），与 PlantUML/Mermaid 写法一致。
 * ------------------------------------------------------------------------- */

export type DslUmlNodeKind = 'class' | 'interface' | 'enum';

export type DslUmlRelationType =
  | 'inheritance'
  | 'realization'
  | 'association'
  | 'aggregation'
  | 'composition'
  | 'dependency';

export type DslUmlNode = {
  id: string;
  /** 节点类型，默认 class */
  kind?: DslUmlNodeKind;
  /** 类名（title / name 二者取一，name 兼容其它文档写法） */
  title?: string;
  name?: string;
  /** 抽象类（`class` 才有意义；接口与枚举自带构造型） */
  abstract?: boolean;
  /** 属性区文本，例如 `['- id: string', '+ total: number']` */
  attributes?: string[];
  /** 方法区文本，例如 `['+ pay(amount: number): void']` */
  methods?: string[];
  left?: number;
  top?: number;
  width?: number;
  height?: number;
};

export type DslUmlEdge = {
  id?: string;
  source: string;
  target: string;
  /** 关系种类，默认 association；方向语义见 SKILL/README（继承时 source=子类、target=父类） */
  type?: DslUmlRelationType;
  /** 兼容别名：relation 与 type 等价（type 优先） */
  relation?: DslUmlRelationType;
  label?: string;
};

export type DslUmlDocumentOptions = {
  /** 是否自动适应视图，默认 true */
  fitViewport?: boolean;
  fitViewportPadding?: number;
  viewport?: { scale: number; tx: number; ty: number };
  /** 缺坐标时的分层布局（继承关系自上而下），默认 layered */
  layout?: 'layered' | 'none';
  gapX?: number;
  gapY?: number;
};

export type DslUmlDocument = {
  schemaVersion?: number;
  kind: 'uml';
  nodes: DslUmlNode[];
  edges?: DslUmlEdge[];
  options?: DslUmlDocumentOptions;
};

/** 运行时判别：带 kind: 'uml' 的按类图文档处理 */
export function isUmlDsl(dsl: any): dsl is DslUmlDocument {
  return !!dsl && typeof dsl === 'object' && dsl.kind === 'uml';
}

/* ------------------------------------------------------------------------- *
 * 状态机文档（kind: 'statechart'）
 *
 * 节点 = 伪状态 / 状态 / 复合状态（复合状态是容器，子状态用 parent 声明归属）；
 * 连线 = 转移，标签是 `事件 [守卫] / 动作`。
 * ------------------------------------------------------------------------- */

export type DslStatechartNodeKind = 'initial' | 'final' | 'state' | 'composite';

export type DslStatechartNode = {
  id: string;
  /** 节点类型，默认 state */
  kind?: DslStatechartNodeKind;
  /** 状态名（title / name 二者取一） */
  title?: string;
  name?: string;
  /** 归属容器：子状态写所属复合状态的 id；缺省时按坐标自动嵌套 */
  parent?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
};

export type DslStatechartEdge = {
  id?: string;
  source: string;
  target: string;
  /** 触发事件 */
  event?: string;
  /** 守卫条件（画成 `[guard]`） */
  guard?: string;
  /** 动作（画成 `/ action`） */
  action?: string;
  /** 显式标签（给了就不由 event/guard/action 拼） */
  label?: string;
};

export type DslStatechartDocumentOptions = {
  fitViewport?: boolean;
  fitViewportPadding?: number;
  viewport?: { scale: number; tx: number; ty: number };
  /** 缺坐标时是否自动排布（转移流向自左而右），默认 auto */
  layout?: 'auto' | 'none';
  gapX?: number;
  gapY?: number;
};

export type DslStatechartDocument = {
  schemaVersion?: number;
  kind: 'statechart';
  nodes: DslStatechartNode[];
  edges?: DslStatechartEdge[];
  options?: DslStatechartDocumentOptions;
};

/** 运行时判别：带 kind: 'statechart' 的按状态机文档处理 */
export function isStatechartDsl(dsl: any): dsl is DslStatechartDocument {
  return !!dsl && typeof dsl === 'object' && dsl.kind === 'statechart';
}

/* ------------------------------------------------------------------------- *
 * 甘特图文档（kind: 'gantt'）
 *
 * 节点 = 任务（起始日期 + 持续天数 + 进度），连线 = 依赖（完成 → 开始）。
 * **不需要坐标**：横轴是时间（由 start/days 算），纵轴是行（按声明顺序）。
 * ------------------------------------------------------------------------- */

export type DslGanttTask = {
  id: string;
  /** 任务名（title / name 二者取一） */
  title?: string;
  name?: string;
  /** 起始日期 `YYYY-MM-DD` */
  start: string;
  /** 持续天数，默认 1 */
  days?: number;
  /** 完成度 0..1，默认 0 */
  progress?: number;
  /** 行号（0 起）；缺省按声明顺序 */
  row?: number;
  /** 负责人 / 资源名（用于资源冲突检查；空表示不参与） */
  resource?: string;
};

export type DslGanttDependency = {
  id?: string;
  source: string;
  target: string;
};

export type DslGanttDocumentOptions = {
  fitViewport?: boolean;
  fitViewportPadding?: number;
  viewport?: { scale: number; tx: number; ty: number };
  /** 每天多少像素，默认 28 */
  dayWidth?: number;
  /** 渲染时按依赖自动排程（把任务推到前置结束之后），默认 false */
  autoSchedule?: boolean;
};

export type DslGanttDocument = {
  schemaVersion?: number;
  kind: 'gantt';
  nodes: DslGanttTask[];
  edges?: DslGanttDependency[];
  options?: DslGanttDocumentOptions;
};

/** 运行时判别：带 kind: 'gantt' 的按甘特文档处理 */
export function isGanttDsl(dsl: any): dsl is DslGanttDocument {
  return !!dsl && typeof dsl === 'object' && dsl.kind === 'gantt';
}
