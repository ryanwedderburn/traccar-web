import { useEffect } from 'react';
import { map } from './core/MapView';
import useFloorPlans from '../common/util/useFloorPlans';

/**
 * Draws geo-referenced floor plan images on the map (docs/MESH.md).
 *
 * Mounted between MapOverlay and MapGeofence in MainMap, deliberately:
 * layers render in mount order, so plans sit above the basemap and any
 * tile overlay but under geofence zones, routes and device markers - a
 * tag indoors is drawn on top of the building it is in.
 *
 * minZoom (default 15) keeps a building-sized image from smearing into a
 * smudge when zoomed out to site or country level; the geofence outline
 * still marks the building there. raster-fade-duration 0 because the
 * default 300 ms cross-fade makes the plan blink when crossing the zoom
 * threshold.
 */
const MapFloorPlans = () => {
  const plans = useFloorPlans();

  useEffect(() => {
    plans.forEach((plan) => {
      const id = `floorplan-${plan.id}`;
      map.addSource(id, {
        type: 'image',
        url: plan.url,
        coordinates: plan.corners,
      });
      map.addLayer({
        id,
        type: 'raster',
        source: id,
        minzoom: plan.minZoom ?? 15,
        paint: {
          'raster-opacity': 0.85,
          'raster-fade-duration': 0,
        },
      });
    });
    return () => {
      plans.forEach((plan) => {
        const id = `floorplan-${plan.id}`;
        if (map.getLayer(id)) {
          map.removeLayer(id);
        }
        if (map.getSource(id)) {
          map.removeSource(id);
        }
      });
    };
  }, [plans]);

  return null;
};

export default MapFloorPlans;
