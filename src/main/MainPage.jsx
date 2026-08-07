import { lazy, Suspense, useState, useCallback, useEffect, useMemo } from 'react';
import { Paper } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useDispatch, useSelector } from 'react-redux';
import DeviceList from './DeviceList';
import BottomMenu from '../common/components/BottomMenu';
import StatusCard from '../common/components/StatusCard';
import { devicesActions } from '../store';
import usePersistedState from '../common/util/usePersistedState';
import EventsDrawer from './EventsDrawer';
import useFilter from './useFilter';
import MainToolbar from './MainToolbar';
import DeviceListControls from './components/DeviceListControls';
import RouteFilter from './components/RouteFilter';
import { useAttributePreference } from '../common/util/preferences';
import useFavourites from '../common/util/useFavourites';
import useKiosk from '../common/util/useKiosk';
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
  contentList: {
    pointerEvents: 'auto',
    gridArea: '1 / 1',
    zIndex: 4,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
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

  const { favourites } = useFavourites();
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
  const { events: availableEvents } = useRouteFilter(routeFilter);
  const effectiveRouteFilter = useMemo(
    () =>
      availableEvents.length === 1 && !routeFilter.event
        ? { ...routeFilter, event: availableEvents[0] }
        : routeFilter,
    [availableEvents, routeFilter],
  );

  const [devicesOpen, setDevicesOpen] = useState(desktop);
  const [eventsOpen, setEventsOpen] = useState(false);

  const onEventsClick = useCallback(() => setEventsOpen(true), [setEventsOpen]);

  useEffect(() => {
    if (!desktop && mapOnSelect && selectedDeviceId) {
      setDevicesOpen(false);
    }
  }, [desktop, mapOnSelect, selectedDeviceId]);

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
        <Paper square elevation={3} className={classes.header}>
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
          {/*
            In the header rather than with the device list: this filters the
            map, and on a phone the list collapses away entirely while the map
            stays. Left in the list panel it was unreachable in exactly the
            view it affects.

            Always rendered. It was previously hidden on a phone while the list
            was open, on the reasoning that route controls above a list of
            riders are chrome for something you cannot see. Testing killed that:
            spectators never found the controls at all, because the list is
            where they spend their time and switching to the map to change the
            day is not a thing anyone thinks to try. Two rows of chrome is a
            smaller cost than a control nobody knows exists - and on a
            450-entrant field, filtering by class and day is most of the point.
          */}
          <RouteFilter filter={effectiveRouteFilter} setFilter={setRouteFilter} />
        </Paper>
        <div className={classes.middle}>
          {!desktop && (
            <div className={classes.contentMap}>
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
            <DeviceListControls
              mode={effectiveMode}
              setMode={setListMode}
              totalCount={Object.keys(devices).length}
              favouriteCount={favourites.length}
              mapFavouritesOnly={mapFavouritesOnly}
              setMapFavouritesOnly={setMapFavouritesOnly}
              kiosk={kiosk}
            />
            <div className={classes.listWrapper}>
              <DeviceList devices={filteredDevices} />
            </div>
          </Paper>
        </div>
        {desktop && (
          <div className={classes.footer}>
            <BottomMenu />
          </div>
        )}
      </div>
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
