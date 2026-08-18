import maplibregl from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { usePreference } from '../../common/util/preferences';
import { map } from '../core/MapView';
import { toMapCoordinates } from '../core/mapUtil';

const MapDefaultCamera = ({ filteredPositions }) => {
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const positions = useSelector((state) => state.session.positions);

  const defaultLatitude = usePreference('latitude');
  const defaultLongitude = usePreference('longitude');
  const defaultZoom = usePreference('zoom', 0);

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (selectedDeviceId) {
      const position = positions[selectedDeviceId];
      if (position) {
        map.jumpTo({
          center: toMapCoordinates(position.longitude, position.latitude),
          zoom: Math.max(defaultZoom > 0 ? defaultZoom : map.getZoom(), 10),
        });
        setInitialized(true);
      }
    } else {
      if (defaultLatitude && defaultLongitude) {
        map.jumpTo({
          center: toMapCoordinates(defaultLongitude, defaultLatitude),
          zoom: defaultZoom,
        });
        setInitialized(true);
      } else {
        /* EMPTY IS NOT ABSENT, and `filteredPositions || …` treats it as though
           it were: an empty array is truthy, so a viewer whose filter matches
           nothing got zero coordinates, no branch ran, `initialized` stayed
           false, and the map sat wherever MapLibre constructed it - zoom 0, the
           whole world.

           That is the DEFAULT state for a new spectator. Favourites start empty
           and `mapFavouritesOnly` narrows the map to them, so the first thing
           every QR scan at a start venue produced was a view of the planet.
           Invisible to anyone testing in a browser they had used before, which
           is why it survived: localStorage carried a filter that happened to
           match something.

           Falling back for the CAMERA only. What is drawn stays filtered - the
           question here is "where should the map open", and the honest answer
           when the filter matches nothing is "where the fleet is", not "the
           Atlantic". */
        const framing = filteredPositions?.length ? filteredPositions : Object.values(positions);
        const coordinates = framing.map((item) => toMapCoordinates(item.longitude, item.latitude));
        if (coordinates.length > 1) {
          const bounds = coordinates.reduce(
            (bounds, item) => bounds.extend(item),
            new maplibregl.LngLatBounds(coordinates[0], coordinates[1]),
          );
          const canvas = map.getCanvas();
          map.fitBounds(bounds, {
            duration: 0,
            padding: Math.min(canvas.width, canvas.height) * 0.1,
          });
          setInitialized(true);
        } else if (coordinates.length) {
          const [individual] = coordinates;
          map.jumpTo({
            center: individual,
            zoom: Math.max(defaultZoom > 0 ? defaultZoom : map.getZoom(), 10),
          });
          setInitialized(true);
        }
      }
    }
  }, [
    selectedDeviceId,
    initialized,
    defaultLatitude,
    defaultLongitude,
    defaultZoom,
    positions,
    filteredPositions,
  ]);

  return null;
};

export default MapDefaultCamera;
