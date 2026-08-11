import { useSelector } from 'react-redux';
import useEventUi from './useEventUi';

/**
 * Gate for the favourites chrome: the star on the device row, the
 * All/Favourites tabs, and the map funnel. Event hosts get it by default -
 * picking a handful of riders out of ~450 entrants is the feature's whole
 * reason to exist - and any other host can turn it on with
 * `"ui.favourites": true` in its hostBranding entry. Deliberately NOT
 * defaulted on for equipment hosts: starring five machines solves nothing
 * the exception-sorted dashboard doesn't, but a customer with a 200-machine
 * fleet is one config key away from it.
 *
 * The ?follow= spectator deep link stays event-only regardless - it matches
 * rider numbers in device names, which is event data by construction.
 */
const truthy = (value) => value === true || value === 'true';

export default () => {
  const eventUi = useEventUi();
  const granted = useSelector((state) =>
    truthy(state.session.server?.attributes?.['ui.favourites']),
  );
  return eventUi || granted;
};
