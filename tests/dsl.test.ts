import { validateDsl, compileDsl } from '../src';

describe('ice-render-dsl', () => {
  it('validates a minimal document', () => {
    const result = validateDsl({
      entities: [{ id: 'customer', name: 'Customer', fields: [] }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects duplicate entity ids and invalid relation endpoints', () => {
    const result = validateDsl({
      entities: [
        { id: 'customer' },
        { id: 'customer' },
      ],
      relations: [{ source: 'customer', target: '' }],
    } as any);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('duplicated');
    expect(result.errors.join('\n')).toContain('relations[0].target');
  });

  it('compiles DSL into Entity/Relation props', () => {
    const scene = compileDsl({
      layout: 'layered',
      entities: [
        { id: 'customer', name: 'Customer', fields: [{ name: 'id', type: 'number', primary: true }] },
        { id: 'order', name: 'Order', fields: [] },
      ],
      relations: [
        {
          source: 'customer',
          target: 'order',
          type: 'one-to-many',
          sourceField: 'id',
          targetField: 'customerId',
        },
      ],
    });

    expect(scene.entities).toHaveLength(2);
    expect(scene.entities[0].entityName).toBe('Customer');
    expect(scene.relations).toHaveLength(1);
    expect(scene.relations[0].relationType).toBe('one-to-many');
    expect(scene.relations[0].sourceId).toBe('customer');
  });
});
