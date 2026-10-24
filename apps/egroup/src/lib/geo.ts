/**
 * 經緯度投影到 SVG 座標。
 * 以站點自身的外框自動縮放，站點少時不會擠成一團，站點多時也不會超出畫布。
 * 使用等距圓柱投影並依緯度修正經度比例，台北都會區的變形可忽略。
 */
export type GeoPoint = { readonly lat: number; readonly lng: number };

export type Projected = { readonly x: number; readonly y: number };

export type Projector = {
  readonly width: number;
  readonly height: number;
  readonly project: (point: GeoPoint) => Projected;
};

const MIN_SPAN_DEG = 0.01;

export function createProjector(
  points: readonly GeoPoint[],
  width = 720,
  height = 420,
  padding = 56,
): Projector {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = lats.length > 0 ? Math.min(...lats) : 25.0;
  const maxLat = lats.length > 0 ? Math.max(...lats) : 25.1;
  const minLng = lngs.length > 0 ? Math.min(...lngs) : 121.5;
  const maxLng = lngs.length > 0 ? Math.max(...lngs) : 121.6;

  const midLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180);

  const spanLat = Math.max(maxLat - minLat, MIN_SPAN_DEG);
  const spanLng = Math.max((maxLng - minLng) * lngScale, MIN_SPAN_DEG);

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const scale = Math.min(innerWidth / spanLng, innerHeight / spanLat);

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  return {
    width,
    height,
    project: (point) => ({
      x: width / 2 + (point.lng - centerLng) * lngScale * scale,
      y: height / 2 - (point.lat - centerLat) * scale,
    }),
  };
}
