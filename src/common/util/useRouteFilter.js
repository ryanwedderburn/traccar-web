import { useMemo } from 'react';
import { useSelector } from 'react-redux';

/**
 * Filtering geofences by event, class and day.
 *
 * Traccar has no event concept and this fork deliberately doesn't add one - the
 * dimensions live in geofence attributes. See docs/EVENTS.md.
 *
 * Options are derived from the data rather than hard-coded, because class names
 * are per-event branding: Senqu runs Lite where ROA runs Iron, and Romaniacs
 * adds Atom. A fixed list would either flatten those or need editing per event.
 */

export const splitClasses = (geofence) =>
  String(geofence.attributes?.classes || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

// Classes have a difficulty order, hardest first, and it is not alphabetical.
// Ranked by tier rather than by name so branding still works: Lite is Senqu's
// Iron, and Atom is Romaniacs' entry tier below both. Anything unrecognised
// sorts last, alphabetically, rather than being dropped.
const CLASS_RANK = { gold: 0, silver: 1, bronze: 2, iron: 3, lite: 3, atom: 4 };

const compareClasses = (a, b) => {
  const rankA = CLASS_RANK[a] ?? 99;
  const rankB = CLASS_RANK[b] ?? 99;
  return rankA - rankB || a.localeCompare(b);
};

// A time trial or prologue always runs before the numbered race days. After
// that: numerics ascending, then anything else alphabetically - which happens
// to put Senqu's "fri" before "sat", though that is luck rather than design.
const DAY_FIRST = /^(tt|prologue|prolog)$/i;

const compareDays = (a, b) => {
  const firstA = DAY_FIRST.test(a);
  const firstB = DAY_FIRST.test(b);
  if (firstA !== firstB) return firstA ? -1 : 1;

  const numberA = Number(a);
  const numberB = Number(b);
  const isNumberA = !Number.isNaN(numberA);
  const isNumberB = !Number.isNaN(numberB);
  if (isNumberA && isNumberB) return numberA - numberB;
  if (isNumberA !== isNumberB) return isNumberA ? -1 : 1;
  return a.localeCompare(b);
};

/**
 * A place rather than a path.
 *
 * Traccar draws a route as a LINESTRING or POLYGON and a fixed point as a
 * circle with a proximity radius, so the geometry alone tells them apart and
 * no list of types needs maintaining as new ones appear. Same discriminator
 * the POI list uses - see common/util/waypoints.js, and keep the two in step.
 */
export const isPlace = (geofence) => String(geofence?.area || '').indexOf('CIRCLE') >= 0;

export const matchesRouteFilter = (geofence, filter) => {
  if (!filter?.event) {
    return true;
  }
  if (geofence.attributes?.event !== filter.event) {
    return false;
  }

  // Recce rides are associated with the event they were ridden for, but nobody
  // watching wants an August test lap drawn over a November race.
  if (geofence.attributes?.type === 'training') {
    return false;
  }

  // Day and class filter ROUTES. A fixed point is where it is regardless of
  // which day or class is selected, so a place survives every combination once
  // its event matches.
  //
  // This is the same rule the POI list already applies (see waypoints.js), and
  // it has to be, or the two disagree: Music Box tagged with a class would be
  // listed under POI and offer directions while being absent from the map that
  // is supposed to show you where it is. The reasoning is also the same -
  // a spectator following Bronze who learns Gold alone crosses at Free Fall
  // Pass may well go and watch anyway, and nobody can act on the point they
  // were never shown.
  if (isPlace(geofence)) {
    return true;
  }

  // A geofence carrying no classes is not class-specific - a DSP serves
  // everyone on the day - so it survives any class selection rather than
  // being filtered out for lacking data.
  const own = splitClasses(geofence);
  if (
    filter.classes?.length &&
    own.length &&
    !own.some((value) => filter.classes.includes(value))
  ) {
    return false;
  }

  // Same reasoning for day.
  const day = geofence.attributes?.day;
  if (filter.day && day && String(day) !== String(filter.day)) {
    return false;
  }

  return true;
};

export default (filter) => {
  const geofences = useSelector((state) => state.geofences.items);
  const selectedEvent = filter?.event;

  return useMemo(() => {
    const all = Object.values(geofences);
    const events = [...new Set(all.map((item) => item.attributes?.event).filter(Boolean))].sort();

    const scoped = selectedEvent
      ? all.filter((item) => item.attributes?.event === selectedEvent)
      : [];
    const classes = [...new Set(scoped.flatMap(splitClasses))].sort(compareClasses);
    const days = [
      ...new Set(
        scoped
          .map((item) => item.attributes?.day)
          .filter(Boolean)
          .map(String),
      ),
    ].sort(compareDays);

    return { events, classes, days };
  }, [geofences, selectedEvent]);
};
