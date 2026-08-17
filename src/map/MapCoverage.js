import { useEffect } from 'react';
import { map } from './core/MapView';
import useCoverage from '../common/util/useCoverage';

/**
 * Ground where positions are known to arrive late, drawn under everything else.
 *
 * Mounted straight after MapOverlay in MainMap: layers render in mount order,
 * so coverage sits above the basemap and any tile overlay but under floor
 * plans, geofences, routes and markers. It is context, not content - a rider's
 * marker must never be obscured by it.
 *
 * WHY IT IS HERE RATHER THAN ON manage.html. There is a coverage screen there
 * already, drawn in plain SVG because that page deliberately loads no CDN. It
 * answers "can this data be trusted" - the worst-ground table, the agreement
 * flags, the time scrubber. This answers "where is it", and it needs a real
 * map: pan, zoom, and satellite imagery, because seeing the ridge that causes a
 * shadow is a different kind of understanding from reading its coordinates.
 *
 * DRAWN AS SQUARES, NOT A HEATMAP. maplibre's heatmap layer smooths density,
 * which would invent gradients between cells that were measured separately and
 * blur the sharp edges that make a terrain shadow recognisable - on 2026-08-16
 * one ended within 4 km, and that boundary is the finding. Each square is one
 * measured cell and looks like one.
 *
 * The colour ramp is the same as the manage screen's, so the two views cannot
 * disagree about what red means.
 */
const MapCoverage = () => {
  const { zones, grid } = useCoverage();

  useEffect(() => {
    if (!zones.length) {
      return () => {};
    }

    const half = grid / 2;
    const features = zones.map((zone) => {
      const west = zone.longitude - half;
      const east = zone.longitude + half;
      const south = zone.latitude - half;
      const north = zone.latitude + half;
      return {
        type: 'Feature',
        properties: { share: zone.lateShare, riders: zone.riders },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      };
    });

    map.addSource('coverage', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    });
    map.addLayer({
      id: 'coverage',
      type: 'fill',
      source: 'coverage',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'share'],
          0.4,
          '#9e9d24',
          0.6,
          '#ef6c00',
          0.8,
          '#d84315',
          1.0,
          '#b71c1c',
        ],
        /* Low enough to read the map through. These squares say "expect stale
           positions here", not "something happened here", and an opaque wash
           over a valley reads as the second. */
        'fill-opacity': 0.35,
      },
    });

    return () => {
      if (map.getLayer('coverage')) {
        map.removeLayer('coverage');
      }
      if (map.getSource('coverage')) {
        map.removeSource('coverage');
      }
    };
  }, [zones, grid]);

  return null;
};

export default MapCoverage;
