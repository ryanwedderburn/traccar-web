import { useSelector } from 'react-redux';

/**
 * Kiosk mode: strip the UI to the map and the riders on it.
 *
 * For spectator and crew accounts following a race, where every control that
 * is not the map is a way to get lost. Set `kiosk` in the user's attributes,
 * alongside the `readonly` and `disableReports` flags that trim the bottom bar
 * down to Map and Logout. See docs/EVENTS.md "Spectator accounts".
 *
 * Deliberately reads the user's own attributes rather than going through
 * useAttributePreference, which falls back to the server's. This is a
 * per-account decision - a server-wide default would put an admin into kiosk
 * mode with no visible way out of it.
 */

// The attribute editor stores a real boolean, but only because `kiosk` is
// declared in useUserAttributes.js. Typed by hand into a fresh key, or set by
// a script through the API, it arrives as the string "true" - and the string
// "false" is every bit as truthy. So parse rather than coerce.
const truthy = (value) => value === true || value === 'true';

export default () => useSelector((state) => truthy(state.session.user?.attributes?.kiosk));
