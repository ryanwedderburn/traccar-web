import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useTheme } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { createRoot } from 'react-dom/client';
import { useDispatch, useSelector } from 'react-redux';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import { map } from '../core/MapView';
import { toMapCoordinates } from '../core/mapUtil';
import { followActions } from '../../store';

/**
 * "Where am I relative to the rider I am watching."
 *
 * A dot for you and a marker for them, on one screen, at a scale where the gap
 * between them means something. That is the question a spectator is actually
 * asking, and no amount of panning answers it when you do not know the area -
 * you cannot pan towards something you cannot find.
 *
 * Only appears when there is a rider to be relative TO, so it is absent for
 * anyone browsing the field.
 *
 * A ONE-SHOT FIX, not a watch. The button asks for a position, frames the two,
 * and stops - so it costs nothing on a phone that has to last a race day with
 * no charging. `maximumAge` lets it reuse a recent fix, so pressing it while
 * the tracking dot is already running is instant and free.
 */

const useStyles = makeStyles()(() => ({
  button: {
    '&&': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#333',
    },
  },
}));

// Deep enough to be useful when you are almost on top of them, and it only
// binds when the two are close - fitBounds picks the zoom otherwise.
const MAX_ZOOM = 16;

const MapLocateFollowed = () => {
  const theme = useTheme();
  const { classes } = useStyles();
  const dispatch = useDispatch();

  const followId = useSelector((state) => state.follow.deviceId);
  const selectedId = useSelector((state) => state.devices.selectedId);
  // Follow first: if both are set they are usually the same rider, and follow is
  // the more deliberate statement of who is being watched.
  const deviceId = followId || selectedId;
  const position = useSelector((state) => (deviceId ? state.session.positions[deviceId] : null));

  // The click handler is rebuilt as positions arrive; the control is not. A ref
  // keeps the button pointed at the current one without tearing the control
  // down and putting it back on every update.
  const actionRef = useRef(() => {});

  actionRef.current = () => {
    if (!position) {
      return;
    }
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => {
        // Following would undo this within seconds: MapFollow re-centres on the
        // rider's next report, and a moving rider reports constantly. So the
        // camera has one owner at a time, which is the same rule that makes
        // selecting a device cancel follow.
        dispatch(followActions.clear());

        const bounds = new maplibregl.LngLatBounds();
        bounds.extend(toMapCoordinates(position.longitude, position.latitude));
        bounds.extend(toMapCoordinates(coords.longitude, coords.latitude));

        const container = map.getContainer();
        const margin = Math.min(container.clientWidth, container.clientHeight) * 0.15;
        const base = map.getPadding();

        map.fitBounds(bounds, {
          maxZoom: MAX_ZOOM,
          padding: {
            top: base.top + margin,
            bottom: base.bottom + margin,
            left: base.left + margin,
            right: base.right + margin,
          },
        });
      },
      () => {
        // Denied, unavailable, or timed out. Nothing to say that the browser
        // has not already said in its own permission UI, and a map that stays
        // where it was is a readable failure.
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  useEffect(() => {
    if (!deviceId) {
      return () => {};
    }

    let container;
    let root;
    const control = {
      onAdd: () => {
        container = document.createElement('div');
        container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `maplibregl-ctrl-icon ${classes.button}`;
        button.title = 'Show me and this rider';
        button.setAttribute('aria-label', 'Show me and this rider');
        button.onclick = () => actionRef.current();
        container.appendChild(button);
        root = createRoot(button);
        root.render(<ZoomOutMapIcon fontSize="small" />);
        return container;
      },
      onRemove: () => {
        queueMicrotask(() => root.unmount());
        container.remove();
      },
    };

    map.addControl(control, theme.direction === 'rtl' ? 'top-left' : 'top-right');
    return () => map.removeControl(control);
  }, [deviceId, theme.direction, classes.button]);

  return null;
};

export default MapLocateFollowed;
