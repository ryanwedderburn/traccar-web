import maplibregl from 'maplibre-gl';
import { useEffect } from 'react';
import { map } from './core/MapView';
import { useTheme } from '@mui/material';
import { savePersistedState } from '../common/util/usePersistedState';
import useEventUi from '../common/util/useEventUi';

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
 * - `showUserHeading` is the compass cone. Standing still with a dot tells you
 *   where you are; it does not tell you which way you are facing, which is
 *   exactly what you need to walk towards something.
 * - Geolocation requires a SECURE CONTEXT. Production is https behind Caddy and
 *   localhost counts, but plain http to the mini over the tailnet does not -
 *   the control will simply fail there, which reads as a bug and is not one.
 *
 * NOT HIGH ACCURACY, deliberately. `enableHighAccuracy` means the GPS radio,
 * continuously, for as long as the dot is up - on a phone that has to last a
 * race day with no charging, at exactly the point in the day when the battery
 * matters most. Coarse positioning is good to roughly a block, and the question
 * being asked is "am I north or south of my rider", not "which side of the road
 * am I on". `maximumAge` lets a fix up to half a minute old answer, which
 * removes most of the wakeups again. The frame-both control still asks for a
 * high-accuracy fix on demand, where the cost is paid once.
 */

// Set once this browser has run tracking successfully. It is a record of
// consent as much as preference: permission has already been granted, so
// starting again raises no prompt.
const ENABLED_KEY = 'userLocationEnabled';

const wasEnabled = () => {
  try {
    return JSON.parse(window.localStorage.getItem(ENABLED_KEY)) === true;
  } catch {
    return false;
  }
};

// Module-level, like `map` itself, so the frame-both control can turn the dot
// on after a spectator grants location through IT rather than through the
// crosshair. That is the important discoverability path: the crosshair is an
// unlabelled glyph in a stack of six, while "show me and this rider" appears
// only when it is relevant and says what it does. Whichever one they press
// first, the dot is on from then on.
let geolocateControl = null;
// Mirrored from the control's own events rather than read off its internal
// `_watchState`. Same answer, no dependency on a private field that a maplibre
// upgrade is free to rename.
let tracking = false;

export const enableUserLocation = () => {
  savePersistedState(ENABLED_KEY, true);
  // `trigger()` is a toggle: called while tracking it would switch the dot OFF,
  // which is the opposite of what every caller wants.
  if (geolocateControl && !tracking) {
    geolocateControl.trigger();
  }
};

const MapCurrentLocation = () => {
  const theme = useTheme();
  // Everything above is event chrome. A stock host gets upstream's control
  // back, verbatim: a one-shot high-accuracy fly-to, no tracking, no dot, no
  // remembered consent - an operator at a desk knows where they are.
  const eventUi = useEventUi();

  useEffect(() => {
    if (!eventUi) {
      const control = new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
          timeout: 5000,
        },
        trackUserLocation: false,
      });
      map.addControl(control, theme.direction === 'rtl' ? 'top-left' : 'top-right');
      return () => map.removeControl(control);
    }

    const control = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: false,
        maximumAge: 30000,
        timeout: 10000,
      },
      trackUserLocation: true,
      showUserLocation: true,
      showUserHeading: true,
    });
    map.addControl(control, theme.direction === 'rtl' ? 'top-left' : 'top-right');
    geolocateControl = control;

    // Remember the choice in both directions, so turning the dot off stays off
    // on the next load rather than coming back uninvited.
    const started = () => {
      tracking = true;
      savePersistedState(ENABLED_KEY, true);
    };
    const ended = () => {
      tracking = false;
      window.localStorage.removeItem(ENABLED_KEY);
    };
    // Permission revoked in the OS after it was granted here, or a position
    // that never arrives. Forget the preference rather than retrying into the
    // same failure on every load.
    const failed = () => {
      tracking = false;
      window.localStorage.removeItem(ENABLED_KEY);
    };
    control.on('trackuserlocationstart', started);
    control.on('trackuserlocationend', ended);
    control.on('error', failed);

    /**
     * ON BY DEFAULT, but only from the second visit.
     *
     * A cold visitor arriving from a QR code should not meet a permission
     * dialog before they have seen anything - prompts fired with no context get
     * denied, and on iOS a denial is STICKY per site, recoverable only through
     * Safari settings that nobody at a rally will find. One badly-timed prompt
     * disables the feature permanently for that person.
     *
     * Once they have granted it, though, starting again raises no prompt at
     * all. Race week is four days on one phone, so almost every load after the
     * first is this case: the dot simply comes up, which is what "on by
     * default" was actually asking for.
     *
     * Deferred a tick because the control has to be in the DOM before
     * `trigger()` will do anything.
     */
    let timeout;
    if (wasEnabled()) {
      timeout = setTimeout(() => control.trigger(), 0);
    }

    return () => {
      clearTimeout(timeout);
      control.off('trackuserlocationstart', started);
      control.off('trackuserlocationend', ended);
      control.off('error', failed);
      geolocateControl = null;
      tracking = false;
      map.removeControl(control);
    };
  }, [theme.direction, eventUi]);

  return null;
};

export default MapCurrentLocation;
