import { useSelector } from 'react-redux';

/**
 * The per-host switch for the event chrome: favourites and follow, the
 * "Tracks on map" filter, the POI list, and the tracking location dot.
 *
 * OFF BY DEFAULT. The base platform is meant to look like stock Traccar - it
 * is also the front door for non-event work, heavy-equipment telematics first -
 * so the event features are opt-in per hostname rather than baked in.
 *
 * Read from the SERVER attributes, not the user's, because the flag is
 * delivered per hostname: HostBranding merges each host's `hostBranding` entry
 * into the /api/server response, so `"eventUi": true` in roa.wlab.co.za's
 * entry turns the event UI on for that origin and nothing else. The same
 * account is stock on traccar.wlab.co.za and event-shaped on roa.wlab.co.za,
 * which is why this is deliberately NOT useAttributePreference - that reads
 * the user first and would weld the choice to the account instead of the host.
 *
 * ServerProvider fetches /api/server before the app renders at all, so this is
 * settled by first paint and never flickers on.
 *
 * Same parsing rule as useKiosk: a value set by script arrives as the string
 * "true", and the string "false" is every bit as truthy. Parse, don't coerce.
 */
const truthy = (value) => value === true || value === 'true';

export default () => useSelector((state) => truthy(state.session.server?.attributes?.eventUi));
