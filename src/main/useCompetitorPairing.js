import { useEffect, useMemo, useState } from 'react';
import useCompetitors from '../common/util/useCompetitors';
import { pairPositions } from '../common/util/competitorPairing';

/**
 * How often to re-decide pairing when nothing has moved.
 *
 * Staleness is a function of now, so a pair that agreed two minutes ago has to
 * become stale on its own. Incoming positions usually force this, but a rider
 * who stops reporting is exactly the case where they do not - and that is
 * precisely when the map must stop claiming the two devices are together.
 */
const PAIRING_TICK_MS = 30000;

/**
 * One competitor's devices, resolved into what to draw and what to say.
 *
 * Computed once here rather than in each consumer, because the map and the
 * status card must agree: a card that says "phone and tracker together" beside
 * two separate markers is worse than either alone.
 *
 * @param positions one position per device, already filtered
 * @returns {{positions: Array, pairing: Object}}
 */
export default (positions) => {
  const competitors = useCompetitors();
  const [tick, setTick] = useState(0);

  const paired = Object.keys(competitors).length > 0;

  useEffect(() => {
    if (!paired) {
      return undefined;
    }
    const timer = setInterval(() => setTick((value) => value + 1), PAIRING_TICK_MS);
    return () => clearInterval(timer);
  }, [paired]);

  return useMemo(
    () => pairPositions(positions, competitors),
    // tick is the point: it re-evaluates freshness when nothing moved.
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [positions, competitors, tick],
  );
};
