import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { map } from '../core/MapView';
import { usePrevious } from '../../reactHelper';
import { toMapCoordinates } from '../core/mapUtil';

/**
 * Keeps the followed device centred as it reports.
 *
 * Distinct from MapSelectedDevice, which pans once when the selection changes.
 * This reacts only to the followed device's own position updates, so a
 * stationary device leaves the map completely still.
 *
 * It deliberately does not change zoom. Forcing a zoom level on every update is
 * what made the earlier version feel like it was fighting the user; panning
 * alone leaves the scale under their control.
 */

const MapFollow = () => {
  const deviceId = useSelector((state) => state.follow.deviceId);
  const position = useSelector((state) => (deviceId ? state.session.positions[deviceId] : null));

  const previousPosition = usePrevious(position);

  useEffect(() => {
    if (!deviceId || !position) {
      return;
    }

    const moved =
      !previousPosition ||
      previousPosition.deviceId !== position.deviceId ||
      position.latitude !== previousPosition.latitude ||
      position.longitude !== previousPosition.longitude;

    if (moved) {
      map.easeTo({ center: toMapCoordinates(position.longitude, position.latitude) });
    }
  }, [deviceId, position, previousPosition]);

  return null;
};

export default MapFollow;
