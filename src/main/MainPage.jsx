import { lazy, Suspense, useState, useCallback, useEffect, useMemo } from 'react';
import { Paper } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import DeviceList from './DeviceList';
import BottomMenu from '../common/components/BottomMenu';
import StatusCard from '../common/components/StatusCard';
import { devicesActions, followActions } from '../store';
import usePersistedState from '../common/util/usePersistedState';
import EventsDrawer from './EventsDrawer';
import useFilter from './useFilter';
import MainToolbar from './MainToolbar';
import DeviceListControls from './components/DeviceListControls';
import RouteFilter from './components/RouteFilter';
import { useAttributePreference } from '../common/util/preferences';
import useFavourites from '../common/util/useFavourites';
import useKiosk from '../common/util/useKiosk';
import SupportWidget from '../common/components/SupportWidget';
import useRouteFilter from '../common/util/useRouteFilter';

const MainMap = lazy(() => import('./MainMap'));

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
  },
  sidebar: {
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    [theme.breakpoints.up('md')]: {
      position: 'fixed',
      left: 0,
      top: 0,
      height: `calc(100% - ${theme.spacing(3)})`,
      width: theme.dimensions.drawerWidthDesktop,
      margin: theme.spacing(1.5),
      zIndex: 3,
    },
    [theme.breakpoints.down('md')]: {
      height: '100%',
      width: '100%',
    },
  },
  header: {
    pointerEvents: 'auto',
    zIndex: 6,
  },
  footer: {
    pointerEvents: 'auto',
    zIndex: 5,
  },
  middle: {
    flex: 1,
    display: 'grid',
    minHeight: 0,
  },
  contentMap: {
    pointerEvents: 'auto',
    gridArea: '1 / 1',
  },
  // The strip of map left uncovered by the list is a target you tap to get the
  // map back - and the maplibre control stack sits in exactly that strip, hard
  // against the right edge. Zoom, compass, layers, geolocate, search and ruler
  // are all in the way of the one gesture the strip exists for, and hitting one
  // by accident leaves a spectator somewhere they did not ask to be with the
  // list still open on top.
  //
  // Hidden rather than covered: the controls belong to the map, so they come
  // back the moment the map does. Bottom-left scale and bottom-right
  // attribution are left alone - neither navigates anywhere.
  mapControlsHidden: {
    '& .maplibregl-ctrl-top-right, & .maplibregl-ctrl-top-left': {
      display: 'none',
    },
  },
  contentList: {
    pointerEvents: 'auto',
    gridArea: '1 / 1',
    zIndex: 4,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    // On a phone the list and the map share one grid cell, and the list used to
    // cover it completely. That removed any sense that a map was there at all,
    // and left no way back to it short of finding the toggle in the bottom bar.
    // Leaving a strip uncovered restores both: the map shows behind it, and
    // tapping the strip closes the list.
    [theme.breakpoints.down('md')]: {
      width: theme.dimensions.deviceListWidthPhone,
      justifySelf: 'start',
    },
  },
  listWrapper: {
    flex: 1,
    display: 'flex',
    minHeight: 0,
  },
}));

const MainPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const theme = useTheme();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const mapOnSelect = useAttributePreference('mapOnSelect', true);

  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const [filteredPositions, setFilteredPositions] = useState([]);
  const selectedPosition = filteredPositions.find(
    (position) => selectedDeviceId && position.deviceId === selectedDeviceId,
  );

  const [filteredDevices, setFilteredDevices] = useState([]);

  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = usePersistedState('deviceFilter', {
    statuses: [],
    groups: [],
    geofences: [],
  });
  const [filterSort, setFilterSort] = usePersistedState('filterSort', '');
  const [filterMap, setFilterMap] = usePersistedState('filterMap', false);

  const { favourites, stored: storedFavourites, isFavourite, toggleFavourite } = useFavourites();
  // Kiosk prefers Favourites; everyone else prefers All. It is a preference
  // rather than a landing state - with nothing starred yet, effectiveMode
  // below falls back to All either way, so this only decides where a spectator
  // returns to once they have a watch list.
  //
  // App.jsx holds MainPage behind a loader until the session is fetched, so
  // kiosk is known at first render and usePersistedState captures the right
  // default rather than a stale one.
  const kiosk = useKiosk();
  const [listMode, setListMode] = usePersistedState('deviceListMode', kiosk ? 'favourites' : 'all');
  // Fall back to All whenever nothing is starred - kiosk included. Landing on
  // an empty Favourites tab was the original kiosk design, on the grounds that
  // a blank map beats 450 pins. It does, but the list has to be usable too: a
  // spectator tapping the search box on an empty Favourites tab is searching
  // nothing, which is the one thing they came to do.
  //
  // The map stays blank anyway, because mapFavouritesOnly is on in kiosk and
  // the All tab does not change that. So this gives both halves - empty map,
  // searchable list - rather than trading one for the other.
  //
  // Derived rather than written back, so unstarring everything and starring
  // again returns you to the tab you chose.
  const effectiveMode = favourites.length ? listMode : 'all';
  const showFavourites = effectiveMode === 'favourites';
  // Favourites filters the map as well as the list. Filtering only the list is
  // half a feature with hundreds of devices - you get a clean list and a wall
  // of pins. The filterMap checkbox in the toolbar popover still stands on its
  // own for the case where a complete map is actually wanted.
  const filterMapOrFavourites = filterMap || showFavourites;
  // On All, restrict the map to favourites while leaving the list whole.
  // On by default in kiosk, or the flood Favourites-first exists to avoid comes
  // straight back the moment a spectator taps All to search for a rider. The
  // funnel still turns it off for anyone who wants the whole field.
  const [mapFavouritesOnly, setMapFavouritesOnly] = usePersistedState('mapFavouritesOnly', kiosk);
  // Which event's routes and points to show. Per browser, like every other
  // filter here - so a spectator's last combination is their preset.
  const [routeFilter, setRouteFilter] = usePersistedState('routeFilter', {
    event: null,
    classes: [],
    day: null,
  });
  // A spectator granted one event should not be asked to choose it. Derived
  // rather than written back, so granting a second event later just makes the
  // selector appear.
  //
  // A persisted event that no longer exists is discarded rather than applied.
  // Renaming an event - ROA2026 to ROA-2026, 2026-08-07 - leaves every browser
  // holding a value nothing matches, and the failure is silent and total: the
  // routes, the day and class options and the POI list all scope to the event
  // first, so all three empty at once. Worse, there is then no control to fix
  // it with, because the event selector hides itself when only one event
  // exists. Treating an unknown value as unset makes it self-healing.
  const { events: availableEvents } = useRouteFilter(routeFilter);
  const effectiveRouteFilter = useMemo(() => {
    if (routeFilter.event && availableEvents.includes(routeFilter.event)) {
      return routeFilter;
    }
    // Nothing selected, or a selection that has gone away. Fall back to the
    // only event when there is exactly one, otherwise show everything - both
    // of which leave the user somewhere they can see and act on.
    const event = availableEvents.length === 1 ? availableEvents[0] : null;
    return event === routeFilter.event ? routeFilter : { ...routeFilter, event };
  }, [availableEvents, routeFilter]);

  // On a phone the list used to start closed, and the map starts empty by
  // design, so a spectator opening a signage link landed on a blank screen with
  // nothing to act on. Feedback from a first-time viewer, 2026-08-08: "very
  // complicated, lots of steps, you might need to send a video out with the
  // link" - and every step they were talked through was recovering from that
  // first screen.
  //
  // So: open the list when this browser has never starred anyone. A returning
  // spectator, who has a watch list and wants the map, still lands on the map.
  // Reads the raw stored list rather than `favourites`, which is empty on the
  // first paint until the websocket delivers devices.
  const [devicesOpen, setDevicesOpen] = useState(desktop || storedFavourites.length === 0);
  const [eventsOpen, setEventsOpen] = useState(false);

  const onEventsClick = useCallback(() => setEventsOpen(true), [setEventsOpen]);

  useEffect(() => {
    if (!desktop && mapOnSelect && selectedDeviceId) {
      setDevicesOpen(false);
    }
  }, [desktop, mapOnSelect, selectedDeviceId]);

  /**
   * `?follow=906` - open straight onto one rider, starred and followed.
   *
   * A spectator sent a bare signage link has to find the list, search a field
   * of several hundred, star the right person and switch tabs. Family sent a
   * link for their own rider should have to do none of it, and this is what
   * the rider's own "share with crew and supporters" step hands out.
   *
   * MATCHED ON RACE NUMBER, not uniqueId. Devices are named "906 Vivian
   * Maclachlan" by both generators, so the number is the first token - and
   * uniqueId is deliberately withheld from accounts that cannot edit devices
   * (it is a bearer credential), so a spectator session cannot see it at all.
   * The number is on the bike anyway.
   *
   * The parameter is consumed once and removed from the URL. Otherwise a
   * spectator who un-stars the rider would find them starred again on the next
   * refresh, which is the kind of thing that makes an app feel haunted.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const followParam = searchParams.get('follow');

  useEffect(() => {
    if (!followParam) {
      return;
    }
    const wanted = parseInt(followParam, 10);
    if (Number.isNaN(wanted)) {
      return;
    }
    const items = Object.values(devices);
    if (!items.length) {
      return; // devices arrive over the websocket; try again when they do
    }
    const target = items.find((device) => {
      const lead = (device.name || '').match(/^(\d+)\b/);
      return lead && parseInt(lead[1], 10) === wanted;
    });
    if (target) {
      if (!isFavourite(target.id)) {
        toggleFavourite(target.id);
      }
      dispatch(devicesActions.selectId(target.id));
      dispatch(followActions.toggle(target.id));
      setDevicesOpen(false);
    }
    // Consumed either way. A number that matches nothing - a scratched entry,
    // a typo - should not retry on every device update for the rest of the
    // session, and the spectator still has a working map and list.
    searchParams.delete('follow');
    setSearchParams(searchParams, { replace: true });
  }, [followParam, devices, isFavourite, toggleFavourite, dispatch, searchParams, setSearchParams]);

  useFilter(
    keyword,
    filter,
    filterSort,
    filterMapOrFavourites,
    favourites,
    showFavourites,
    mapFavouritesOnly,
    positions,
    setFilteredDevices,
    setFilteredPositions,
  );

  return (
    <div className={classes.root}>
      {desktop && (
        <Suspense fallback={null}>
          <MainMap
            filteredPositions={filteredPositions}
            selectedPosition={selectedPosition}
            onEventsClick={onEventsClick}
            routeFilter={effectiveRouteFilter}
          />
        </Suspense>
      )}
      <div className={classes.sidebar}>
        {/*
          Header order is deliberate, and it is grouped by what each control
          acts on rather than by what it is.

            Day      \  filter the ROUTES drawn on the map
            Class    /
            Search   \  filter the RIDER LIST
            Fav/All  /

          The last two are adjacent because they are one idea: Favourites/All
          is the scope the search runs against. Separated - which they were,
          with the route filter between them - a search returning nothing is
          indistinguishable from a rider who is not in the event, and the
          spectator has no way to tell that flipping to All would find them.

          Both are always rendered, including while the map is showing. Route
          controls were hidden on a phone once and spectators simply never
          found them; the same argument applies to knowing which set you are
          looking at.
        */}
        <Paper square elevation={3} className={classes.header}>
          <RouteFilter filter={effectiveRouteFilter} setFilter={setRouteFilter} />
          <MainToolbar
            filteredDevices={filteredDevices}
            devicesOpen={devicesOpen}
            setDevicesOpen={setDevicesOpen}
            keyword={keyword}
            setKeyword={setKeyword}
            filter={filter}
            setFilter={setFilter}
            filterSort={filterSort}
            setFilterSort={setFilterSort}
            filterMap={filterMap}
            setFilterMap={setFilterMap}
          />
          <DeviceListControls
            mode={effectiveMode}
            setMode={setListMode}
            totalCount={Object.keys(devices).length}
            favouriteCount={favourites.length}
            mapFavouritesOnly={mapFavouritesOnly}
            setMapFavouritesOnly={setMapFavouritesOnly}
            kiosk={kiosk}
          />
        </Paper>
        <div className={classes.middle}>
          {!desktop && (
            /* Tapping the exposed strip closes the list. It is only reachable
               while the list is open, because otherwise the Paper covers
               everything except that strip - and with the list shut this is a
               no-op, so a normal map tap costs nothing. */
            <div
              className={`${classes.contentMap}${devicesOpen ? ` ${classes.mapControlsHidden}` : ''}`}
              onClick={() => devicesOpen && setDevicesOpen(false)}
            >
              <Suspense fallback={null}>
                <MainMap
                  filteredPositions={filteredPositions}
                  selectedPosition={selectedPosition}
                  onEventsClick={onEventsClick}
                  routeFilter={effectiveRouteFilter}
                />
              </Suspense>
            </div>
          )}
          <Paper
            square
            className={classes.contentList}
            style={devicesOpen ? {} : { visibility: 'hidden' }}
          >
            <div className={classes.listWrapper}>
              <DeviceList devices={filteredDevices} />
            </div>
          </Paper>
        </div>
        {desktop && (
          <div className={classes.footer}>
            {/*
              The filter is passed rather than read from localStorage inside
              BottomMenu: usePersistedState instances do not notify each other,
              so a second reader would show the previous event until remount.
            */}
            <BottomMenu routeFilter={effectiveRouteFilter} />
          </div>
        )}
      </div>
      {/*
        Mounted here rather than in App.jsx. A spectator account is readonly
        with reports disabled, so the bottom bar is Map, POI and Logout - they
        never leave this page, and this keeps the fork's edit surface off
        App.jsx, which kiosk mode deliberately left alone.
      */}
      <SupportWidget />
      <EventsDrawer open={eventsOpen} onClose={() => setEventsOpen(false)} />
      {selectedDeviceId && (
        <StatusCard
          deviceId={selectedDeviceId}
          position={selectedPosition}
          onClose={() => dispatch(devicesActions.selectId(null))}
          desktopPadding={theme.dimensions.drawerWidthDesktop}
        />
      )}
    </div>
  );
};

export default MainPage;
