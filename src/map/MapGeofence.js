import { useId, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import { map } from './core/MapView';
import { findFonts, geofenceToFeature } from './core/mapUtil';
import { matchesRouteFilter } from '../common/util/useRouteFilter';
import { useAttributePreference } from '../common/util/preferences';

const MapGeofence = ({ filter }) => {
  const id = useId();

  const theme = useTheme();

  const mapGeofences = useAttributePreference('mapGeofences', true);

  const geofences = useSelector((state) => state.geofences.items);

  useEffect(() => {
    if (mapGeofences) {
      map.addSource(id, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });
      map.addLayer({
        source: id,
        id: 'geofences-fill',
        type: 'fill',
        filter: ['all', ['==', '$type', 'Polygon']],
        paint: {
          'fill-color': ['get', 'color'],
          'fill-outline-color': ['get', 'color'],
          'fill-opacity': 0.1,
        },
      });
      map.addLayer({
        source: id,
        id: 'geofences-line',
        type: 'line',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
          'line-opacity': ['get', 'opacity'],
        },
      });
      map.addLayer({
        source: id,
        id: 'geofences-title',
        type: 'symbol',
        layout: {
          'text-field': '{name}',
          'text-font': findFonts(map),
          'text-size': 12,
        },
        paint: {
          'text-halo-color': 'white',
          'text-halo-width': 1,
        },
      });

      return () => {
        if (map.getLayer('geofences-fill')) {
          map.removeLayer('geofences-fill');
        }
        if (map.getLayer('geofences-line')) {
          map.removeLayer('geofences-line');
        }
        if (map.getLayer('geofences-title')) {
          map.removeLayer('geofences-title');
        }
        if (map.getSource(id)) {
          map.removeSource(id);
        }
      };
    }
    return () => {};
  }, [mapGeofences, id]);

  useEffect(() => {
    if (mapGeofences) {
      map.getSource(id)?.setData({
        type: 'FeatureCollection',
        features: Object.values(geofences)
          .filter((geofence) => !geofence.attributes.hide)
          .filter((geofence) => matchesRouteFilter(geofence, filter))
          .map((geofence) => geofenceToFeature(theme, geofence))
          // WIDEST FIRST, so the thinnest line ends up on top.
          //
          // maplibre draws features in source order within a layer, and the
          // class widths only mean anything if that order is controlled: a
          // 2px Gold route under a 6px Bronze one is not thin, it is absent.
          // Until this, the order was whatever `Object.values` gave - creation
          // order - so whether two classes sharing a section were both visible
          // depended on which was imported first.
          //
          // Sorting here rather than at import means it also fixes data that
          // is already in the database, and cannot be undone by the next
          // import.
          .sort((a, b) => (b.properties.width || 0) - (a.properties.width || 0)),
      });
    }
  }, [mapGeofences, geofences, id, theme, filter]);

  return null;
};

export default MapGeofence;
