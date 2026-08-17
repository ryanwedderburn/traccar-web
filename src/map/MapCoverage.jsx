import { useEffect, useRef } from 'react';
import { useTheme } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { createRoot } from 'react-dom/client';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import { map } from './core/MapView';
import useCoverage from '../common/util/useCoverage';

const useStyles = makeStyles()(() => ({
  button: {
    '&&': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#333',
    },
    '&.active': {
      backgroundColor: '#e6e6e6',
      borderRadius: 'inherit',
    },
  },
}));

const STORAGE_KEY = 'coverageLayerVisible';

/**
 * Circles, not squares.
 *
 * The stored grid is 278 m, which drawn as squares looks like a spreadsheet
 * laid over a mountain - and worse, it implies the measurement has hard edges
 * at those coordinates. It does not: a cell is where samples were bucketed, not
 * where the signal stops. Rounded, slightly overlapping shapes read as ground.
 */
const SIDES = 18;

/**
 * Radius as a fraction of the cell. Over 0.5 on purpose, so neighbouring cells
 * touch and a run of bad ground draws as one shape instead of a dotted line.
 *
 * This is the one visual liberty here and it is worth naming: it makes
 * contiguous cells LOOK contiguous, which they are, at the cost of covering a
 * little ground that was not measured. Everything else on this layer is
 * literal.
 */
const RADIUS_FACTOR = 0.62;

/**
 * Ground where positions are known to arrive late.
 *
 * Mounted straight after MapOverlay in MainMap: layers render in mount order,
 * so this sits above the basemap but under floor plans, geofences, routes and
 * markers. It is context - a rider's marker must never be obscured by it.
 *
 * WHY IT IS HERE RATHER THAN ON manage.html. There is a coverage screen there
 * already, in plain SVG because that page deliberately loads no CDN. It answers
 * "can this data be trusted" - the worst-ground table, the agreement flags, the
 * time scrubber. This answers "where is it", and needs a real map: pan, zoom,
 * and satellite imagery, because seeing the ridge that causes a shadow is a
 * different kind of understanding from reading its coordinates.
 *
 * NOT A HEATMAP LAYER. maplibre's heatmap smooths by density, which would
 * invent gradients between cells measured separately and blur the sharp
 * boundaries that make a terrain shadow recognisable - one ended within 4 km on
 * 2026-08-16, and that edge is the finding. Overlapping circles soften the
 * drawing without softening the data.
 *
 * TOGGLEABLE, and remembered. A viewer watching one rider does not always want
 * the whole country's coverage history behind them.
 */
const MapCoverage = () => {
  const theme = useTheme();
  const { classes } = useStyles();
  const { zones, grid } = useCoverage();

  /* Null until the effect runs. Reading localStorage in the render body is the
     same impurity as reading the clock there - see CoverageNotice. */
  const visibleRef = useRef(null);

  useEffect(() => {
    if (visibleRef.current === null) {
      visibleRef.current = localStorage.getItem(STORAGE_KEY) !== 'false';
    }
    if (!zones.length) {
      return () => {};
    }

    const radius = grid * RADIUS_FACTOR;
    const features = zones.map((zone) => {
      /* Longitude is squeezed by cos(latitude), or the circle draws as an
         ellipse that gets worse the further from the equator you are. */
      const kx = Math.cos((zone.latitude * Math.PI) / 180) || 1;
      const ring = [];
      for (let i = 0; i <= SIDES; i += 1) {
        const angle = (2 * Math.PI * i) / SIDES;
        ring.push([
          zone.longitude + (radius * Math.cos(angle)) / kx,
          zone.latitude + radius * Math.sin(angle),
        ]);
      }
      return {
        type: 'Feature',
        properties: { share: zone.lateShare, riders: zone.riders },
        geometry: { type: 'Polygon', coordinates: [ring] },
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
      layout: { visibility: visibleRef.current ? 'visible' : 'none' },
      paint: {
        /* Muted deliberately. The saturated ramp used on the admin screen is
           right there, where the map is a black background and the data is the
           subject. Over satellite imagery the same colours shout. */
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'share'],
          0.4,
          '#b0a14a',
          0.6,
          '#c47a3c',
          0.8,
          '#bf5a3a',
          1.0,
          '#a8443c',
        ],
        /* FADES OUT AS YOU ZOOM OUT, which is the whole answer to "once it is
           all over the map it may become overbearing".
           
           Zoomed in, a viewer is asking about one place and wants to see it.
           Zoomed out they are looking at the whole event, every cell ever
           measured is on screen at once, and the layer would become a wash over
           the country - drowning the riders, who are the point of the screen.
           So it is a whisper at region scale and legible only where somebody is
           actually looking. */
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.04, 10, 0.1, 12, 0.18, 14, 0.24],
      },
    });

    let button;
    const control = {
      onAdd: () => {
        const container = document.createElement('div');
        container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        button = document.createElement('button');
        button.type = 'button';
        button.title = 'Poor coverage areas';
        button.className = `${classes.button}${visibleRef.current ? ' active' : ''}`;
        button.onclick = () => {
          visibleRef.current = !visibleRef.current;
          localStorage.setItem(STORAGE_KEY, String(visibleRef.current));
          if (map.getLayer('coverage')) {
            map.setLayoutProperty(
              'coverage',
              'visibility',
              visibleRef.current ? 'visible' : 'none',
            );
          }
          button.className = `${classes.button}${visibleRef.current ? ' active' : ''}`;
        };
        createRoot(button).render(<SignalCellularAltIcon fontSize="small" />);
        container.appendChild(button);
        return container;
      },
      onRemove: () => {},
    };
    map.addControl(control, theme.direction === 'rtl' ? 'top-left' : 'top-right');

    return () => {
      map.removeControl(control);
      if (map.getLayer('coverage')) {
        map.removeLayer('coverage');
      }
      if (map.getSource('coverage')) {
        map.removeSource('coverage');
      }
    };
  }, [zones, grid, classes, theme]);

  return null;
};

export default MapCoverage;
