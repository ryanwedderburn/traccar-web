import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

const truthy = (value) => value === true || value === 'true';

/**
 * Known poor-coverage ground, from /api/coverage/zones.
 *
 * OFF BY DEFAULT, on the `coverageUi` server attribute - the same self-hiding
 * convention as useEventUi and useFloorPlans, and read from the SERVER rather
 * than the user because HostBranding merges each host's entry into
 * /api/server. One account is then stock on one origin and coverage-aware on
 * another, which is the whole point of doing it per host.
 *
 * WHAT THE ZONES ARE. Every position ever recorded is a coverage sample: how
 * much longer than that device's own normal it took to arrive. The platform
 * rolls those into a 278 m grid daily and publishes only cells that several
 * independent devices agree on. So this is corroborated ground, not one
 * handset's bad afternoon - which matters, because the viewer being shown this
 * has no way to check it.
 *
 * FETCHED ONCE, DELIBERATELY. The sweep runs hourly and the answer changes on
 * that scale, so re-requesting on every render or every position would be
 * pointless load on an endpoint every spectator hits. If a session outlives a
 * sweep it shows slightly stale zones, which is the correct trade: coverage is
 * a property of terrain and masts, not of the last five minutes.
 *
 * A FAILED FETCH IS SILENT AND EMPTY. No zones means no layer and no alert -
 * the map is exactly upstream's. A coverage feature that breaks the map it
 * annotates would be worse than not having it.
 */
export default () => {
  const enabled = useSelector((state) => truthy(state.session.server?.attributes?.coverageUi));
  const [zones, setZones] = useState([]);
  const [grid, setGrid] = useState(0.0025);

  useEffect(() => {
    if (!enabled) {
      setZones([]);
      return () => {};
    }
    /* AbortController rather than an ignore-the-result flag: a host switching
       coverage off mid-flight should cancel the request, not merely discard it. */
    const controller = new AbortController();
    fetch('/api/coverage/zones', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body && Array.isArray(body.zones)) {
          setZones(body.zones);
          if (body.gridDegrees) {
            setGrid(body.gridDegrees);
          }
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [enabled]);

  /* A Set of cell keys, so "is this position in a bad cell" is a hash lookup
     rather than a scan over a few hundred polygons on every position update.
     Cells are anchored on the equator and prime meridian server-side, so the
     same floor division reproduces the key exactly. */
  const index = useMemo(() => {
    const keys = new Set();
    zones.forEach((zone) => {
      keys.add(`${Math.floor(zone.latitude / grid)}:${Math.floor(zone.longitude / grid)}`);
    });
    return keys;
  }, [zones, grid]);

  const inZone = useMemo(
    () => (latitude, longitude) => {
      if (!index.size || latitude === undefined || longitude === undefined) {
        return false;
      }
      return index.has(`${Math.floor(latitude / grid)}:${Math.floor(longitude / grid)}`);
    },
    [index, grid],
  );

  return { zones, grid, inZone };
};
