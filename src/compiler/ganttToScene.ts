import type { DslGanttDependency, DslGanttDocument, DslGanttTask } from '../types';

export type CompiledGanttTask = {
  id: string;
  title: string;
  start: string;
  days: number;
  progress: number;
  row: number;
};

export type CompiledGanttDependency = {
  id: string;
  sourceId: string;
  targetId: string;
};

export type CompiledGanttScene = {
  kind: 'gantt';
  nodes: CompiledGanttTask[];
  edges: CompiledGanttDependency[];
  options?: Record<string, any>;
};

/**
 * 甘特文档 → `GanttTask` / `GanttDependency` 构造参数。
 *
 * 与其它文档类型不同，这里**没有几何布局**：横轴是时间（`start` × `days`），
 * 纵轴是行（`row` 或声明顺序）。任务条的位置完全由设计器按 `dayWidth` 与项目起点算出来，
 * 所以文档里不需要（也不应该）写坐标 —— 手写坐标反而会与日期打架。
 *
 * 唯一做的“归一化”是把行号补全（缺省按声明顺序），以及把缺省值补齐。
 */
export function compileGanttDsl(dsl: DslGanttDocument): CompiledGanttScene {
  const options: any = dsl.options || {};
  const nodes: CompiledGanttTask[] = (dsl.nodes || []).map((task: DslGanttTask, index) => ({
    id: task.id,
    title: task.title || task.name || task.id,
    start: String(task.start || ''),
    days: typeof task.days === 'number' ? task.days : 1,
    progress: typeof task.progress === 'number' ? task.progress : 0,
    row: typeof task.row === 'number' ? task.row : index,
  }));

  const edges: CompiledGanttDependency[] = (dsl.edges || []).map((edge: DslGanttDependency, index) => ({
    id: edge.id || `dependency-${index}`,
    sourceId: edge.source,
    targetId: edge.target,
  }));

  return { kind: 'gantt', nodes, edges, options };
}
