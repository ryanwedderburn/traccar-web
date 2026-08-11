import { useMemo } from 'react';
import { useSelector } from 'react-redux';

/**
 * Geo-referenced floor plans from the server's `floorPlans` attribute
 * (docs/MESH.md). The value is a JSON array (usually stored as a string,
 * since the attribute editor is free-text):
 *
 *   [{ "id": "demo-warehouse", "name": "Demo Warehouse",
 *      "url": "/floorplans/demo-warehouse.png", "minZoom": 15,
 *      "corners": [[lonTL, latTL], [lonTR, latTR],
 *                  [lonBR, latBR], [lonBL, latBL]] }]
 *
 * Corners are maplibre image-source order: top-left, top-right,
 * bottom-right, bottom-left, each [lon, lat]. Images live in the override
 * directory (deploy/override/floorplans/), so adding a building is a file
 * and an attribute - no build, no schema.
 *
 * Same self-hiding convention as waypoints and the route filter: no
 * attribute means no component, so every existing install is unaffected.
 * Malformed entries are dropped rather than thrown - a typo in a
 * hand-edited attribute must not blank the map.
 */
export default () => {
  const raw = useSelector((state) => state.session.server?.attributes?.floorPlans);
  return useMemo(() => {
    if (!raw) {
      return [];
    }
    let plans = raw;
    if (typeof raw === 'string') {
      try {
        plans = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(plans)) {
      return [];
    }
    return plans.filter(
      (plan) =>
        plan &&
        plan.id &&
        plan.url &&
        Array.isArray(plan.corners) &&
        plan.corners.length === 4 &&
        plan.corners.every((corner) => Array.isArray(corner) && corner.length === 2),
    );
  }, [raw]);
};
