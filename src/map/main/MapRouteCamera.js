import { useEffect, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import { map } from '../core/MapView';
import { geofenceToFeature } from '../core/mapUtil';
import { matchesRouteFilter, isPlace } from '../../common/util/useRouteFilter';
import { useAttributePreference } from '../../common/util/preferences';
import { usePrevious } from '../../reactHelper';
import { followActions } from '../../store';

/**
 * Moves the camera to whatever the track filter just selected.
 *
 * Without this the selectors are an act of faith. A four-day event covers a
 * district; a test install covers a country. Either way, changing Day or Class
 * redraws lines somewhere off screen and the map in front of you does not
 * move, so the only feedback that anything happened is that something you
 * could not see has been replaced by something else you cannot see.
 *
 * A spectator who does not know the area cannot recover from that, and they
 * are the entire audience for these controls.
 */

// Deep enough to make a single spectator point legible, shallow enough that a
// full race day still reads as a route rather than a street. Without a cap,
// fitting a lone circle zooms to the individual buildings around it.
const MAX_ZOOM = 14;

// Extends the bounds over any GeoJSON coordinate nesting - Point through
// MultiPolygon - without caring which it is. Coordinates arrive already
// converted to the map's coordinate system by geofenceToFeature, so nothing
// here needs to know about gcj02.
const extend = (bounds, coordinates) => {
  if (!Array.isArray(coordinates)) {
    return;
  }
  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    bounds.extend(coordinates);
    return;
  }
  coordinates.forEach((item) => extend(bounds, item));
};

const MapRouteCamera = ({ filter }) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const geofences = useSelector((state) => state.geofences.items);
  const mapGeofences = useAttributePreference('mapGeofences', true);

  // Follow owns the camera continuously - it re-centres on every report - so a
  // filter change cannot simply frame the routes and expect the framing to
  // survive. It is released instead. See the effect below.
  //
  // NOTE what is deliberately NOT consulted here: the selected device. An
  // earlier version treated a selection as owning the camera too, which was
  // wrong twice over. MapSelectedDevice pans ONCE when the selection changes
  // and then lets go, so there is nothing to fight. And a selection persists
  // until the StatusCard is closed, so tapping any rider - which on a phone is
  // the first thing anybody does - killed this feature permanently and
  // silently. Found the only way it could be, by someone who could not say
  // which click had done it.
  const followId = useSelector((state) => state.follow.deviceId);

  // Compared as a string rather than by object identity: `filter` is rebuilt on
  // every render of MainPage, so identity alone would re-frame the map on
  // unrelated state changes - including, since this reads positions
  // indirectly, on every incoming device update.
  const key = useMemo(
    () =>
      JSON.stringify([filter?.event || '', filter?.day || '', [...(filter?.classes || [])].sort()]),
    [filter],
  );
  const previousKey = usePrevious(key);

  useEffect(() => {
    // First render. MapDefaultCamera owns the opening frame - it honours the
    // account's configured latitude/longitude/zoom, which is a deliberate
    // setting and not ours to overrule before the user has touched anything.
    if (previousKey === undefined || previousKey === key) {
      return;
    }
    if (!mapGeofences) {
      return;
    }

    // Changing the filter is a deliberate request to be shown something, so it
    // takes the camera - and taking it from MapFollow means releasing follow
    // rather than being outvoted by it on the next position report, seconds
    // later.
    //
    // Same rule as selecting a device, and as the locate-both control: the last
    // deliberate camera act wins, and there is never a control that quietly
    // does nothing. Follow is one tap on the crosshair to get back.
    if (followId) {
      dispatch(followActions.clear());
    }

    const matching = Object.values(geofences)
      .filter((geofence) => !geofence.attributes.hide)
      .filter((geofence) => matchesRouteFilter(geofence, filter));

    // Frame the ROUTES, and ONLY the routes.
    //
    // This used to fall back to framing the places when a selection had no
    // routes, on the reasoning that it "beats not moving" - a selector that
    // appears to do nothing being the exact problem this component was built to
    // solve (see docs/CONTEXT.md, 2026-08-09).
    //
    // Reversed 2026-08-29. Ryan, twice: "this nonsense auto-zooming crap is
    // back". Framing the places means fitting the WHOLE EVENT's waypoints -
    // 35 of them spread across a district - so a selection with no routes threw
    // the camera out to a view of nothing in particular. That is not better
    // than not moving; it is worse, because it destroys whatever the viewer had
    // set up and replaces it with a frame that answers no question.
    //
    // The original concern still stands and is answered elsewhere rather than
    // ignored: RouteFilter's summary line now says "no routes" when a selection
    // matches none, so the control reports its result instead of the camera
    // acting one out. No control quietly does nothing - it just says so in
    // words now, which is cheaper than a camera move.
    const routes = matching.filter((geofence) => !isPlace(geofence));
    if (!routes.length) {
      return;
    }
    const subject = routes;

    const bounds = new maplibregl.LngLatBounds();
    subject.forEach((geofence) => {
      try {
        extend(bounds, geofenceToFeature(theme, geofence).geometry.coordinates);
      } catch {
        // A malformed `area` should cost one route on the camera, not the
        // whole frame. Nothing here is enforced - see the attribute convention
        // note in docs/CONTEXT.md.
      }
    });
    if (bounds.isEmpty()) {
      return;
    }

    // maplibre's fitBounds padding REPLACES the map's own padding rather than
    // adding to it, so the desktop drawer offset set by MapPadding has to be
    // carried through by hand or the tracks end up behind the sidebar.
    //
    // Measured off the container in CSS pixels. The canvas is in device
    // pixels, which is three times larger on a phone and would leave almost no
    // room for the map itself.
    const container = map.getContainer();
    const margin = Math.min(container.clientWidth, container.clientHeight) * 0.12;
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
  }, [key, previousKey, filter, geofences, mapGeofences, followId, theme, dispatch]);

  return null;
};

export default MapRouteCamera;
