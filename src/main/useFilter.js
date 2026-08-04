import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';

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
        return [device.name, device.uniqueId, device.phone, device.model, device.contact].some(
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

    if (mapFavouritesOnly && !showFavourites) {
      // Browsing the whole field while the map stays on the watch list. The
      // selected device is always included, so tapping an entrant you have not
      // starred yet still shows you where it is.
      const ids = new Set(favourites);
      if (selectedId) {
        ids.add(selectedId);
      }
      setFilteredPositions([...ids].map((id) => positions[id]).filter(Boolean));
    } else if (filterMap) {
      setFilteredPositions(filtered.map((device) => positions[device.id]).filter(Boolean));
    } else {
      setFilteredPositions(Object.values(positions));
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
    setFilteredDevices,
    setFilteredPositions,
  ]);
};
