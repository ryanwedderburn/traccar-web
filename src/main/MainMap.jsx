import { useCallback, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useDispatch, useSelector } from 'react-redux';
import MapView from '../map/core/MapView';
import MapSelectedDevice from '../map/main/MapSelectedDevice';
import MapFollow from '../map/main/MapFollow';
import MapRouteCamera from '../map/main/MapRouteCamera';
import MapAccuracy from '../map/main/MapAccuracy';
import MapGeofence from '../map/MapGeofence';
import MapFloorPlans from '../map/MapFloorPlans';
import MapCoverage from '../map/MapCoverage';
import MapCurrentLocation from '../map/MapCurrentLocation';
import PoiMap from '../map/main/PoiMap';
import MapPadding from '../map/MapPadding';
import { devicesActions } from '../store';
import MapDefaultCamera from '../map/main/MapDefaultCamera';
import MapLiveRoutes from '../map/main/MapLiveRoutes';
import MapPositions from '../map/MapPositions';
import MapOverlay from '../map/overlay/MapOverlay';
import MapGeocoder from '../map/control/MapGeocoder';
import MapScale from '../map/MapScale';
import MapRuler from '../map/control/MapRuler';
import MapLocateFollowed from '../map/control/MapLocateFollowed';
import MapNotification from '../map/control/MapNotification';
import useFeatures from '../common/util/useFeatures';
import useEventUi from '../common/util/useEventUi';
import useFollowUi from '../common/util/useFollowUi';

/**
 * @param filteredPositions every device's position, one each
 * @param pairedPositions   what to actually draw: a competitor whose phone and
 *                          tracker agree is one marker, not two. Computed in
 *                          MainPage so the status card cannot disagree with the
 *                          map. Falls back to filteredPositions on a stock host,
 *                          where there are no competitors and nothing collapses.
 */
const MainMap = ({
  filteredPositions,
  pairedPositions,
  selectedPosition,
  onEventsClick,
  routeFilter,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const eventsAvailable = useSelector((state) => !!state.events.items.length);

  const features = useFeatures();
  // Follow, the route camera and the frame-both control are event chrome; a
  // stock host gets upstream's map. routeFilter arrives as null there already -
  // MainPage owns that - so MapGeofence needs no gate of its own.
  const eventUi = useEventUi();
  const followUi = useFollowUi();

  const [rulerActive, setRulerActive] = useState(false);

  /* No fallback to filteredPositions. One used to be here, and it is why a
     missing prop degraded silently to upstream's one-marker-per-device instead
     of failing where anyone would notice. A guard that quietly disables a
     feature is worse than the mistake it guards against - the same lesson as
     MapRouteCamera's selection guard. pairPositions already returns its input
     unchanged when there are no competitors, so there is nothing to defend. */
  const markerPositions = pairedPositions;

  const onMarkerClick = useCallback(
    (_, deviceId) => {
      dispatch(devicesActions.selectId(deviceId));
    },
    [dispatch],
  );

  return (
    <>
      <MapView>
        <MapOverlay />
        {/* Context, under everything: coverage is where positions arrive late,
            and a rider's marker must never be obscured by it. */}
        <MapCoverage />
        {/* Above overlays, below geofences and markers - see the component. */}
        <MapFloorPlans />
        <MapGeofence filter={routeFilter} />
        <MapAccuracy positions={markerPositions} />
        {/* Trails stay per device. Two sources are never merged into one
            recorded track - the blending is a view, and a rider's phone and
            their bike's tracker each keep their own history. */}
        <MapLiveRoutes deviceIds={filteredPositions.map((p) => p.deviceId)} />
        <MapPositions
          positions={markerPositions}
          onMarkerClick={onMarkerClick}
          selectedPosition={selectedPosition}
          showStatus
          disabled={rulerActive}
        />
        <MapDefaultCamera filteredPositions={filteredPositions} />
        <MapSelectedDevice />
        {followUi && <MapFollow />}
        {/* After MapDefaultCamera, which owns the opening frame. */}
        {eventUi && <MapRouteCamera filter={routeFilter} />}
        <PoiMap />
        <MapRuler positions={markerPositions} onActiveChange={setRulerActive} />
        {/* Only present while a rider is being watched - see the component. */}
        {followUi && <MapLocateFollowed />}
        {!features.disableEvents && (
          <MapNotification enabled={eventsAvailable} onClick={onEventsClick} />
        )}
      </MapView>
      <MapScale />
      <MapCurrentLocation />
      <MapGeocoder />
      {desktop && (
        <MapPadding
          start={
            parseInt(theme.dimensions.drawerWidthDesktop, 10) + parseInt(theme.spacing(1.5), 10)
          }
        />
      )}
    </>
  );
};

export default MainMap;
