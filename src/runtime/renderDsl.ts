import { ICE, EntityDesigner, ICELayeredLayout } from 'ice-entity-designer';
import type { DslDocument } from '../types';
import { compileDsl } from '../compiler/dslToScene';
import { validateDsl } from '../validate';

export type RenderDslResult = {
  ice: any;
  designer: any;
};

function positionLinks(designer: any, scene: any, defaultRouteType: string): any[] {
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
      routeType: relation.routeType || defaultRouteType || 'orthogonal',
      linkShape: relation.linkShape || 'visio',
      links: {
        start: { id: relation.sourceId, position: start },
        end: { id: relation.targetId, position: end },
      },
    };
  });
}

function fitViewport(ice: any, designer: any, padding: number): void {
  const entities = designer.entities || [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  entities.forEach((entity: any) => {
    const box = entity.getMinBoundingBox(true);
    const bounds = box.getMinAndMaxPoint();
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  });

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  const canvasWidth = ice.canvasWidth || 0;
  const canvasHeight = ice.canvasHeight || 0;
  if (!canvasWidth || !canvasHeight || contentWidth <= 0 || contentHeight <= 0) {
    return;
  }

  const pad = Number.isFinite(padding) && padding >= 0 ? padding : 40;
  const availableWidth = Math.max(1, canvasWidth - pad * 2);
  const availableHeight = Math.max(1, canvasHeight - pad * 2);
  const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1);
  const tx = (canvasWidth - contentWidth * scale) / 2 - minX * scale;
  const ty = (canvasHeight - contentHeight * scale) / 2 - minY * scale;
  ice.setViewport(scale, tx, ty);
}

export function renderDsl(canvasOrId: any, dsl: DslDocument): RenderDslResult {
  const validation = validateDsl(dsl);
  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'));
  }

  const scene = compileDsl(dsl);
  const options: any = scene.options || {};
  const ice: any = new ICE().init(canvasOrId);
  const designer: any = new EntityDesigner(ice);

  scene.entities.forEach((entity: any) => {
    designer.createEntity(entity);
  });

  positionLinks(designer, scene, options.routeType).forEach((relation: any) => {
    designer.createRelation(relation);
  });

  if (scene.layout === 'layered' || scene.layout === 'horizontal') {
    new ICELayeredLayout({
      gapX: options.gapX || 120,
      gapY: options.gapY || 50,
    }).layoutContainer(ice);
  }

  if (options.viewport) {
    ice.setViewport(options.viewport.scale, options.viewport.tx, options.viewport.ty);
  } else if (options.fitViewport) {
    fitViewport(ice, designer, options.fitViewportPadding);
  }

  return { ice, designer };
}
