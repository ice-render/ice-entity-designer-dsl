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

export type DslDocument = {
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

export type DslValidationResult = {
  valid: boolean;
  errors: string[];
};
