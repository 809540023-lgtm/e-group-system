import { describe, expect, it } from 'vitest';
import { createProjector } from '../src/lib/geo.ts';

const TAIPEI = [
  { lat: 25.0526, lng: 121.5205 },
  { lat: 25.0577, lng: 121.5206 },
  { lat: 25.0626, lng: 121.5192 },
  { lat: 25.0714, lng: 121.52 },
];

describe('createProjector', () => {
  it('把北邊的點畫在畫布上方', () => {
    const projector = createProjector(TAIPEI);
    const south = projector.project(TAIPEI[0]!);
    const north = projector.project(TAIPEI[3]!);
    expect(north.y).toBeLessThan(south.y);
  });

  it('把東邊的點畫在畫布右方', () => {
    const projector = createProjector(TAIPEI);
    const west = projector.project({ lat: 25.06, lng: 121.51 });
    const east = projector.project({ lat: 25.06, lng: 121.53 });
    expect(east.x).toBeGreaterThan(west.x);
  });

  it('所有點都落在畫布內', () => {
    const projector = createProjector(TAIPEI);
    for (const point of TAIPEI) {
      const { x, y } = projector.project(point);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(projector.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(projector.height);
    }
  });

  it('單一站點不會除以零，且置中', () => {
    const projector = createProjector([{ lat: 25.05, lng: 121.52 }]);
    const { x, y } = projector.project({ lat: 25.05, lng: 121.52 });
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
    expect(x).toBeCloseTo(projector.width / 2, 6);
    expect(y).toBeCloseTo(projector.height / 2, 6);
  });

  it('空清單也能建立投影器', () => {
    const projector = createProjector([]);
    const { x, y } = projector.project({ lat: 25.05, lng: 121.52 });
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });
});
