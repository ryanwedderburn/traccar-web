import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { splitClasses } from './useRouteFilter';

/**
 * "Get me there" for the fixed points of a race - start, finish, DSP, USP,
 * spectator points, HQ.
 *
 * Deliberately not navigation. Tapping a point hands off to Google Maps, which
 * already knows the public road network, already runs in the car, and needs no
 * entitlement from anybody. The same approach the event-intelligence bot uses
 * for its POIs, and for the same reason: the whole feature is a URL.
 *
 * Note what this is *not* for. Navigating to a rider hands over a position
 * frozen at the moment of the tap, which is useless for closing on someone
 * moving. A DSP does not move, so the objection disappears entirely - which is
 * why this exists and "navigate to this rider" does not. See CONTEXT.md.
 */

// Types that describe a path rather than a place. Everything else that is a
// circle is somewhere you can drive to.
//
// Circles are the discriminator on purpose: a route is drawn as a LINESTRING or
// POLYGON and has no single point to navigate to, while a waypoint is a place
// with a proximity radius - the same radius that makes "rider reached the DSP"
// a geofence event later. So the rule needs no maintenance as new types appear.
const ROUTE_TYPES = new Set(['raceRoute', 'accessRoute', 'training']);

// Ordered by what a crew or spectator is looking for on the day, not
// alphabetically. Anything unrecognised sorts last rather than being dropped,
// so a type invented mid-event still appears.
const TYPE_RANK = {
  start: 0,
  finish: 1,
  dsp: 2,
  usp: 3,
  cp: 4,
  tp: 5,
  hq: 6,
  spectator: 7,
  info: 8,
};

// Acronyms stay upper case; anything else is shown as tagged.
const TYPE_LABELS = {
  start: 'Start',
  finish: 'Finish',
  dsp: 'DSP',
  usp: 'USP',
  cp: 'CP',
  tp: 'TP',
  hq: 'HQ',
  spectator: 'Spectator',
  crossing: 'Crossing',
  crossingUnder: 'Under road',
  info: 'Info',
};

export const waypointLabel = (type) => TYPE_LABELS[type] || type || '';

/**
 * The centre of a circular geofence, or null for anything else.
 *
 * Traccar stores a circle as `CIRCLE (lat lon, radius)`. The split mirrors
 * `geofenceToFeature` in map/core/mapUtil.js - same string, same order, and
 * the two must stay in step.
 */
export const geofenceCentre = (geofence) => {
  const area = geofence?.area;
  if (!area || area.indexOf('CIRCLE') < 0) {
    return null;
  }
  const parts = area
    .replace(/CIRCLE|\(|\)|,/g, ' ')
    .trim()
    .split(/ +/);
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
};

/**
 * A Google Maps universal directions link.
 *
 * `dir/?api=1` opens the native app on both platforms, and with no `origin` it
 * routes from wherever the phone currently is - so this works without knowing
 * anything about the user.
 *
 * Always `driving`: everything at a rally is driven to. The mode inference in
 * the event-intelligence version exists because a beer tent is walked to and a
 * campsite is driven to; there is no such split here.
 */
export const mapsDirectionsUrl = (latitude, longitude) =>
  `https://www.google.com/maps/dir/?api=1&destination=${latitude.toFixed(6)},${longitude.toFixed(6)}&travelmode=driving`;

/**
 * The navigable points for the selected event, ready to list.
 *
 * Filtered by event only. Day and class are deliberately *not* applied:
 *
 * - A fixed point is where it is regardless of which day is selected. Crew
 *   driving on Friday still want Saturday's DSP.
 * - Classes are shown as a label instead. A spectator point crossed only by
 *   Gold is worth knowing about even if you are following Bronze - that is
 *   often the best place to stand. Filtering it out means nobody ever learns
 *   it exists, because a hidden row leaves no trace.
 */
export default (filter) => {
  const geofences = useSelector((state) => state.geofences.items);
  const event = filter?.event;

  return useMemo(
    () =>
      Object.values(geofences)
        // Honour `attributes.hide`, as MapGeofence does. Without this a hidden
        // waypoint vanished from the map and stayed in this list, offering
        // directions to a place the map said was not there - the same map-and-
        // list disagreement the day/class filter had, in a different costume.
        // Found when /manage.html gained a switch for it, 2026-08-09.
        .filter((item) => !item.attributes?.hide)
        .filter((item) => !event || item.attributes?.event === event)
        .filter((item) => !ROUTE_TYPES.has(item.attributes?.type))
        .map((item) => ({
          id: item.id,
          name: item.name,
          type: item.attributes?.type || '',
          classes: splitClasses(item),
          centre: geofenceCentre(item),
        }))
        .filter((item) => item.centre)
        .sort(
          (a, b) =>
            (TYPE_RANK[a.type] ?? 99) - (TYPE_RANK[b.type] ?? 99) || a.name.localeCompare(b.name),
        ),
    [geofences, event],
  );
};
