import maplibregl from 'maplibre-gl';
import { useEffect } from 'react';
import { map } from './core/MapView';
import { useTheme } from '@mui/material';

/**
 * "You are here".
 *
 * Upstream uses this control as a one-shot fly-to: it pans to your location and
 * leaves nothing behind. That is fine for a fleet operator at a desk, who knows
 * where they are, and useless for a spectator standing on a mountain in a
 * country they have never been to. Being able to see yourself and your rider on
 * one map is the whole problem - every tracking tool at this event has failed
 * at it - and it is the thing the map can answer for free.
 *
 * So: tracking on, dot left behind, heading shown.
 *
 * - `trackUserLocation` watches rather than fixes once, but ONLY after the
 *   button is pressed. Nothing starts on load, so nobody's battery is spent on
 *   a feature they did not ask for, and no permission prompt greets a first
 *   visit. Pressing again releases it.
 * - `showUserHeading` is the compass cone. Standing still with a dot tells you
 *   where you are; it does not tell you which way you are facing, which is
 *   exactly what you need to walk towards something.
 * - Geolocation requires a SECURE CONTEXT. Production is https behind Caddy and
 *   localhost counts, but plain http to the mini over the tailnet does not -
 *   the control will simply fail there, which reads as a bug and is not one.
 */

const MapCurrentLocation = () => {
  const theme = useTheme();

  useEffect(() => {
    const control = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 5000,
      },
      trackUserLocation: true,
      showUserLocation: true,
      showUserHeading: true,
    });
    map.addControl(control, theme.direction === 'rtl' ? 'top-left' : 'top-right');
    return () => map.removeControl(control);
  }, [theme.direction]);

  return null;
};

export default MapCurrentLocation;
