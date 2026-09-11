import { ICE, EntityDesigner, ICELayeredLayout } from 'ice-entity-designer';
import type { DslDocument } from '../types';
import { compileDsl } from '../compiler/dslToScene';
import { validateDsl } from '../validate';

export type RenderDslResult = {
  ice: any;
  designer: any;
};

function positionLinks(designer: any, scene: any): any[] {
  const entityBox = new Map();
  designer.entities.forEach((entity: any) => {
    entityBox.set(entity.state.id, entity.getMinBoundingBox(true));
  });
  return scene.relations.map((relation: any) => {
    const source = entityBox.get(relation.sourceId);
    const target = entityBox.get(relation.targetId);
    let start = 'R';
    let end = 'L';
    if (source && target) {
      const dx = target.center[0] - source.center[0];
      const dy = target.center[1] - source.center[1];
      if (Math.abs(dx) > Math.abs(dy)) {
        start = dx >= 0 ? 'R' : 'L';
        end = dx >= 0 ? 'L' : 'R';
      } else {
        start = dy >= 0 ? 'B' : 'T';
        end = dy >= 0 ? 'T' : 'B';
      }
    }
    return {
      ...relation,
      routeType: relation.routeType || 'orthogonal',
      linkShape: relation.linkShape || 'visio',
      links: {
        start: { id: relation.sourceId, position: start },
        end: { id: relation.targetId, position: end },
      },
    };
  });
}

export function renderDsl(canvasOrId: any, dsl: DslDocument): RenderDslResult {
  const validation = validateDsl(dsl);
  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'));
  }

  const scene = compileDsl(dsl);
  const ice: any = new ICE().init(canvasOrId);
  const designer: any = new EntityDesigner(ice);

  scene.entities.forEach((entity: any) => {
    designer.createEntity(entity);
  });

  positionLinks(designer, scene).forEach((relation: any) => {
    designer.createRelation(relation);
  });

  if (scene.layout === 'layered' || scene.layout === 'horizontal') {
    const options = scene.options || {};
    new ICELayeredLayout({
      gapX: options.gapX || 120,
      gapY: options.gapY || 50,
    }).layoutContainer(ice);
  }

  return { ice, designer };
}
