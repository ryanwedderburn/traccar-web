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
export default () => useSelector((state) => Boolean(state.session.user?.attributes?.kiosk));
