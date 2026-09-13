/**
 * 稳定诊断码（`IED_DSL_*`）。
 *
 * 契约（见 ice-render `docs/architecture/17-i18n-boundary.md`）：
 * - `errors` 保持原来的英文句子（兼容既有调用方，也给人类看）；
 * - `diagnostics` 是给机器读的：`code` 是合同（Agent / 工具据此分支、纠错、转述），`path` 指出位置；
 * - 两者一一对应，**不要**让消费者去匹配 `errors` 里的自然语言。
 */
import { validateDsl } from '../src/validate';
import { IED_DSL_CODES } from '../src/types';

describe('entity-designer DSL · 诊断码', () => {
  it('根不是对象 / schemaVersion 不支持', () => {
    const root = validateDsl(null as any);
    expect(root.valid).toBe(false);
    expect(root.errors).toEqual(['DSL root must be an object']);
    expect(root.diagnostics[0]).toMatchObject({
      severity: 'error',
      code: IED_DSL_CODES.ROOT_NOT_OBJECT,
    });

    const version = validateDsl({ schemaVersion: 99, entities: [] } as any);
    expect(version.diagnostics[0]).toMatchObject({ code: IED_DSL_CODES.SCHEMA_VERSION_UNSUPPORTED });
  });

  it('id 缺失 / 重复 / 节点不是对象：三种码 + path', () => {
    const missingId = validateDsl({ entities: [{ entityName: 'A' }] } as any);
    expect(missingId.diagnostics[0]).toMatchObject({ code: IED_DSL_CODES.ID_INVALID, path: 'entities[0]' });

    const duplicated = validateDsl({ entities: [{ id: 'a' }, { id: 'a' }] } as any);
    expect(duplicated.diagnostics.map((d) => d.code)).toContain(IED_DSL_CODES.ID_DUPLICATED);

    const notObject = validateDsl({ entities: [null] } as any);
    expect(notObject.diagnostics[0]).toMatchObject({ code: IED_DSL_CODES.NOT_OBJECT, path: 'entities[0]' });
  });

  it('连线端点指向不存在的节点 → EDGE_ENDPOINT_UNKNOWN', () => {
    const r = validateDsl({
      kind: 'flowchart',
      schemaVersion: 1,
      nodes: [{ id: 'a', kind: 'process' }],
      edges: [{ source: 'a', target: 'ghost' }],
    } as any);
    expect(r.valid).toBe(false);
    expect(r.diagnostics.map((d) => d.code)).toContain(IED_DSL_CODES.EDGE_ENDPOINT_UNKNOWN);
  });

  it('diagnostics 与 errors 一一对应（同一条错误两处都在，顺序一致）', () => {
    const r = validateDsl({ entities: [{ id: 'a' }, { id: 'a' }, null] } as any);
    expect(r.diagnostics.map((d) => d.message)).toEqual(r.errors);
    expect(r.diagnostics.every((d) => d.severity === 'error' && typeof d.code === 'string')).toBe(true);
  });
});
