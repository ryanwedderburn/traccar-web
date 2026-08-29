import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import useTenantScope from '../common/util/useTenantScope';
import useKiosk from '../common/util/useKiosk';
import useCompetitors from '../common/util/useCompetitors';

/* Same parse-don't-coerce rule as useKiosk: a value typed by hand or set by a
   script arrives as the STRING "true", and the string "false" is every bit as
   truthy. A test marker that cannot be turned off would be worse than one that
   was never set. */
const truthyTest = (value) => value === true || value === 'true';

export default (
  keyword,
  filter,
  filterSort,
  filterMap,
  favourites,
  showFavourites,
  mapFavouritesOnly,
  positions,
  setFilteredDevices,
  setFilteredPositions,
) => {
  const groups = useSelector((state) => state.groups.items);
  const devices = useSelector((state) => state.devices.items);
  const selectedId = useSelector((state) => state.devices.selectedId);

  /* Which product this host is. Off unless `tenantScope` is set for the host,
     and returns "everything" on any failure - see useTenantScope. */
  const { inScope } = useTenantScope();

  /* SEARCHABLE BY RACE NUMBER, because the list now shows one.
     DeviceRow prefixes a device with its number when the name does not already
     carry it - "926 · ROA-1395" - and a list that displays a value the search
     box cannot find is worse than one that never showed it: the number is on
     screen, typing it returns nothing, and the operator concludes the search is
     broken. The label lives on the claim, so it is not among the device columns
     below and has to be added deliberately. */
  const competitors = useCompetitors();

  /* TEST RIDERS ARE HIDDEN FROM KIOSK ACCOUNTS ONLY.
   *
   * A device carrying `attributes.test` is somebody rehearsing the setup, not
   * an entrant. Before an event that is harmless; once the field is real, a
   * spectator scrolling past "919 Test 919" is being shown something that is
   * not in the race.
   *
   * WHY A MARKER RATHER THAN `disabled`. ConnectionManager:202 calls
   * device.checkDisabled() when opening a device session, so a disabled device
   * STOPS REPORTING - which is the opposite of what a test rider is for. The
   * marker hides them from the audience while they keep working, and it is one
   * attribute to clear when they become real.
   *
   * WHY KIOSK. It is the flag the spectator and crew accounts already carry
   * (see useKiosk, docs/EVENTS.md). An administrator, or anyone on a named
   * non-kiosk account, keeps seeing everything - so the operator marking a
   * rider can always still see who they marked.
   *
   * NOT SILENT ON THE ADMIN SIDE. manage.html counts and names marked
   * competitors rather than dropping them from its checks, deliberately: "a
   * marker still on a real rider in September is on screen rather than silently
   * suppressing the check for them". This hides them from the audience and from
   * nobody else. */
  const kiosk = useKiosk();
  const hiddenTest = (deviceId) => kiosk && truthyTest(devices[deviceId]?.attributes?.test);

  /* inScope AND the test marker, together, because they are applied in four
     places and splitting them is how one of the four gets forgotten. */
  const shown = (deviceId) => inScope(deviceId) && !hiddenTest(deviceId);

  useEffect(() => {
    const deviceGroups = (device) => {
      const groupIds = [];
      let { groupId } = device;
      while (groupId) {
        groupIds.push(groupId);
        groupId = groups[groupId]?.groupId || 0;
      }
      return groupIds;
    };

    const filtered = Object.values(devices)
      /* First, because it is the only filter that is about which product the
         viewer is looking at rather than what they are looking for. Everything
         below narrows within a fleet; this decides which fleet. */
      .filter((device) => shown(device.id))
      .filter((device) => !showFavourites || favourites.includes(device.id))
      .filter((device) => !filter.statuses.length || filter.statuses.includes(device.status))
      .filter(
        (device) =>
          !filter.groups.length || deviceGroups(device).some((id) => filter.groups.includes(id)),
      )
      .filter(
        (device) =>
          !filter.geofences.length ||
          (positions[device.id]?.geofenceIds || []).some((id) => filter.geofences.includes(id)),
      )
      .filter((device) => {
        const lowerCaseKeyword = keyword.toLowerCase();
        const competitor = competitors[device.id];
        return [device.name, device.uniqueId, device.phone, device.model, device.contact,
          competitor?.label, competitor?.subjectRef].some(
          (s) => s && s.toLowerCase().includes(lowerCaseKeyword),
        );
      });
    switch (filterSort) {
      case 'name':
        filtered.sort((device1, device2) => device1.name.localeCompare(device2.name));
        break;
      case 'lastUpdate':
        filtered.sort((device1, device2) => {
          const time1 = device1.lastUpdate ? dayjs(device1.lastUpdate).valueOf() : 0;
          const time2 = device2.lastUpdate ? dayjs(device2.lastUpdate).valueOf() : 0;
          return time2 - time1;
        });
        break;
      default:
        break;
    }
    setFilteredDevices(filtered);

    /* Tenant scope applies to the MAP in every branch, not just the list.
       Two of these paths do not derive from `filtered` - the favourites set is
       built from starred ids, and the default draws every position there is - so
       without this the list would show one product and the map would show them
       all. A list and a map that disagree is worse than no filter at all: it
       reads as the platform losing riders. */
    if (mapFavouritesOnly && !showFavourites) {
      // Browsing the whole field while the map stays on the watch list. The
      // selected device is always included, so tapping an entrant you have not
      // starred yet still shows you where it is.
      const ids = new Set(favourites);
      if (selectedId) {
        ids.add(selectedId);
      }
      setFilteredPositions(
        [...ids]
          .filter((id) => shown(id))
          .map((id) => positions[id])
          .filter(Boolean),
      );
    } else if (filterMap) {
      setFilteredPositions(filtered.map((device) => positions[device.id]).filter(Boolean));
    } else {
      setFilteredPositions(Object.values(positions).filter((p) => shown(p.deviceId)));
    }
  }, [
    keyword,
    filter,
    filterSort,
    filterMap,
    favourites,
    showFavourites,
    mapFavouritesOnly,
    selectedId,
    groups,
    devices,
    positions,
    inScope,
    competitors,
    /* Without this the effect keeps whichever value kiosk had when it last ran.
       A session change - signing in as the spectator account to check what they
       see - would leave test riders showing, or hidden, from the wrong one. */
    kiosk,
    setFilteredDevices,
    setFilteredPositions,
  ]);
};
