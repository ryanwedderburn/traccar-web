import { useState } from 'react';
import { useAsyncTask } from '../../reactHelper';
import fetchOrThrow from './fetchOrThrow';
import useEventUi from './useEventUi';

/**
 * Which devices are one competitor.
 *
 * A rider carries a phone and the bike carries a tracker. Both hold the same
 * race number, which lives on the claim rather than on the device, and
 * `/api/competitors` is what turns that into "these two device ids are number
 * 137".
 *
 * Returns a map keyed by device id:
 *
 *   { 12: { label: '137', subjectRef: 'G. Jones', deviceIds: [12, 48] } }
 *
 * Both members of a pair are present and share one entry, so a lookup from
 * either device finds the whole competitor.
 *
 * Fetched once rather than subscribed to. A claim changes when somebody
 * provisions a rider, not while a ride is happening, and putting this on the
 * websocket would spend a live channel on data that is static for the day.
 *
 * Self-hiding, like the rest of the event chrome: a stock host gets an empty
 * map and every consumer degrades to one marker per device, which is upstream's
 * behaviour.
 */
export default () => {
  const eventUi = useEventUi();
  const [byDevice, setByDevice] = useState({});

  useAsyncTask(
    async ({ signal }) => {
      if (!eventUi) {
        return undefined;
      }
      const response = await fetchOrThrow('/api/competitors', { signal });
      const competitors = await response.json();
      const map = {};
      competitors.forEach((competitor) => {
        competitor.deviceIds.forEach((deviceId) => {
          map[deviceId] = competitor;
        });
      });
      setByDevice(map);
      return undefined;
    },
    [eventUi],
  );

  return byDevice;
};
