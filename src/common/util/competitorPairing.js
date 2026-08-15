/**
 * Collapsing a competitor's two devices into one marker, or not.
 *
 * A rider carries a phone and the bike carries a tracker. On a map they are one
 * entry - number 137 - and drawing two dots a few metres apart for every rider
 * makes a field of 439 unreadable. But sometimes the two really are apart, and
 * that is worth seeing: a phone in a support vehicle, a tracker still attached
 * to a bike the rider has walked away from.
 *
 * <b>The rule is that separation only means something when both fixes are
 * current.</b> Two devices 800 m apart where one last reported forty minutes ago
 * says nothing about where they are now - the old fix is a statement about the
 * past, and drawing it as a split invents a separation that may not exist. So a
 * stale partner collapses to one marker and reports its age, and only two fresh
 * fixes that genuinely disagree are drawn apart.
 *
 * Pure on purpose: no hooks, no store, no map. The decision is fiddly enough to
 * be worth reasoning about on its own, and this way it can be.
 */

/** Both devices fresh and together: one marker, they agree. */
export const AGREE = 'agree';

/** Both fresh and genuinely apart: two markers, because that is real. */
export const APART = 'apart';

/** At least one device has not reported recently: one marker, and say so. */
export const STALE = 'stale';

/**
 * Beyond this a fix is history rather than a position. Long enough to survive a
 * tracker's reporting interval and a minute in a valley; short enough that
 * "they are together" is a claim about now.
 */
export const DEFAULT_FRESH_SECONDS = 180;

/**
 * Within this the two devices are the same competitor as far as a map is
 * concerned. Comfortably clear of GPS error on a handset in a gorge, and far
 * below any separation a steward would care about.
 */
export const DEFAULT_TOGETHER_METRES = 250;

const EARTH_RADIUS_METRES = 6371000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** Haversine. Small distances only, which is all this asks of it. */
export const distanceMetres = (a, b) => {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
};

const fixedAt = (position) => {
  const time = position?.fixTime || position?.deviceTime || position?.serverTime;
  const value = time ? Date.parse(time) : NaN;
  return Number.isNaN(value) ? 0 : value;
};

/**
 * Groups positions that are near each other into clusters.
 *
 * Single linkage: A and C join the same cluster if both are near B, even where
 * A and C are not near each other. That is the right reading here - devices
 * strung along a bike, or a rider walking beside it, are one thing - and the
 * alternative would split a competitor on a technicality.
 *
 * @param positions sorted freshest first, so each cluster's first member is
 *                  its most recent fix and can represent it without re-sorting
 * @returns array of clusters, each an array of positions
 */
const clusterByProximity = (positions, togetherMetres) => {
  const clusters = [];
  const assigned = new Array(positions.length).fill(false);

  for (let i = 0; i < positions.length; i += 1) {
    if (assigned[i]) {
      continue;
    }
    const cluster = [positions[i]];
    assigned[i] = true;
    // Grows while it keeps finding neighbours, which is what makes the linkage
    // transitive rather than only pairwise with the seed.
    for (let member = 0; member < cluster.length; member += 1) {
      for (let j = 0; j < positions.length; j += 1) {
        if (!assigned[j] && distanceMetres(cluster[member], positions[j]) <= togetherMetres) {
          assigned[j] = true;
          cluster.push(positions[j]);
        }
      }
    }
    clusters.push(cluster);
  }

  return clusters;
};

/**
 * Groups positions by competitor and decides what to draw.
 *
 * @param positions  one position per device, as the map already receives them
 * @param byDevice   device id to competitor, from useCompetitors
 * @param options    now, freshSeconds, togetherMetres
 * @returns {{positions: Array, pairing: Object}} positions to render, and a
 *          per-device record of what was decided and why, for the card
 */
export const pairPositions = (positions, byDevice, options = {}) => {
  const now = options.now ?? Date.now();
  const freshMillis = (options.freshSeconds ?? DEFAULT_FRESH_SECONDS) * 1000;
  const togetherMetres = options.togetherMetres ?? DEFAULT_TOGETHER_METRES;

  if (!positions?.length || !byDevice || !Object.keys(byDevice).length) {
    return { positions: positions || [], pairing: {} };
  }

  // Anything without a competitor passes straight through. A course marshal's
  // vehicle is not half of a rider.
  const groups = new Map();
  const ungrouped = [];
  positions.forEach((position) => {
    const competitor = byDevice[position.deviceId];
    if (!competitor) {
      ungrouped.push(position);
      return;
    }
    const members = groups.get(competitor.label);
    if (members) {
      members.push(position);
    } else {
      groups.set(competitor.label, [position]);
    }
  });

  const rendered = [...ungrouped];
  const pairing = {};

  groups.forEach((members, label) => {
    const competitor = byDevice[members[0].deviceId];

    // A competitor with only one device reporting is just a device. It still
    // gets a pairing record, because the card wants the race number either way.
    /* Only one of this competitor's devices has a position here. That is not
       always because the other is silent - the map-favourites filter can hand
       us a single device - so no claim is made about why. Ages are recorded
       for what we actually have, and the card renders the rest as unknown
       rather than inventing a state for them. */
    if (members.length < 2) {
      rendered.push(members[0]);
      pairing[members[0].deviceId] = {
        label,
        subjectRef: competitor?.subjectRef,
        state: null,
        deviceIds: competitor?.deviceIds || [members[0].deviceId],
        shown: [members[0].deviceId],
        ages: { [members[0].deviceId]: Math.round((now - fixedAt(members[0])) / 1000) },
      };
      return;
    }

    const sorted = [...members].sort((a, b) => fixedAt(b) - fixedAt(a));
    const fresh = sorted.filter((position) => now - fixedAt(position) <= freshMillis);

    let state;
    let shownPositions;
    let separation = null;

    if (fresh.length >= 2) {
      separation = 0;
      for (let i = 0; i < fresh.length; i += 1) {
        for (let j = i + 1; j < fresh.length; j += 1) {
          separation = Math.max(separation, distanceMetres(fresh[i], fresh[j]));
        }
      }

      /* Clustered, not all-or-nothing. A competitor is not limited to two
         devices - a bike can carry a second tracker - and "any pair is far
         apart, so draw them all separately" would put three markers on a
         rider whose two trackers are bolted to the same bike and whose phone
         is in a support vehicle. There are two things there, so draw two. */
      const clusters = clusterByProximity(fresh, togetherMetres);
      state = clusters.length === 1 ? AGREE : APART;
      // The freshest fix in each cluster represents it: the most recent
      // statement about where that part of the competitor is, chosen without
      // needing to know which device is the phone and which is the bike.
      shownPositions = clusters.map((cluster) => cluster[0]);
    } else if (fresh.length === 1) {
      state = STALE;
      shownPositions = [fresh[0]];
    } else {
      // Nothing current at all. Still draw the competitor - a rider who
      // stopped reporting an hour ago is exactly who someone is looking for -
      // but from their most recent fix and labelled as old.
      state = STALE;
      shownPositions = [sorted[0]];
    }

    const shownIds = shownPositions.map((position) => position.deviceId);
    rendered.push(...shownPositions);

    /* Recorded against every device in the group, not just the drawn ones, so
       selecting the hidden partner in the device list still explains itself.
       The two sources are never merged - each position stays its own record,
       attributed to its own device - and this is only a view over them. */
    members.forEach((position) => {
      pairing[position.deviceId] = {
        label,
        subjectRef: competitor?.subjectRef,
        state,
        separationMetres: separation,
        deviceIds: members.map((member) => member.deviceId),
        shown: shownIds,
        ages: Object.fromEntries(
          members.map((member) => [member.deviceId, Math.round((now - fixedAt(member)) / 1000)]),
        ),
      };
    });
  });

  return { positions: rendered, pairing };
};
