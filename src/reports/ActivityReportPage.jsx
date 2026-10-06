// OURS, not upstream. Activities (REPORTING.md, step R1): rides, drives and walks detected from
// positions by the server (/api/activities), per device role. Modelled on TripReportPage.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import {
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import RouteIcon from '@mui/icons-material/Route';
import {
  formatDistance,
  formatSpeed,
  formatTime,
  formatNumericHours,
} from '../common/util/formatter';
import ReportFilter from './components/ReportFilter';
import { useSortedItems } from './components/usePagedItems';
import { useAttributePreference } from '../common/util/preferences';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import ColumnSelect from './components/ColumnSelect';
import ResizeHandle from './components/ResizeHandle';
import usePersistedState from '../common/util/usePersistedState';
import { useCatch, useCatchCallback, useAsyncTask } from '../reactHelper';
import useReportStyles from './common/useReportStyles';
import MapView from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import TableShimmer from '../common/components/TableShimmer';
import MapMarkers from '../map/MapMarkers';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import MapScale from '../map/MapScale';
import fetchOrThrow from '../common/util/fetchOrThrow';
import exportExcel from '../common/util/exportExcel';
import { deviceEquality } from '../common/util/deviceEquality';

// Labels are translation keys where upstream has one, plain English where it does not.
const columnsArray = [
  ['type', 'Type'],
  ['startTime', 'reportStartTime'],
  ['endTime', 'reportEndTime'],
  ['distance', 'sharedDistance'],
  ['duration', 'reportDuration'],
  ['movingTime', 'Moving time'],
  ['stoppedTime', 'Stopped time'],
  ['stops', 'Stops'],
  ['averageSpeed', 'Average moving speed'],
  ['maxSpeed', 'reportMaximumSpeed'],
];
const columnsMap = new Map(columnsArray);

const TYPES = { competitor: 'Ride', rider: 'Ride', vehicle: 'Drive', person: 'On foot' };

const ActivityReportPage = () => {
  const navigate = useNavigate();
  const { classes } = useReportStyles();
  const t = useTranslation();
  const theme = useTheme();
  const label = (key) => t(key) ?? key;

  const devices = useSelector((state) => state.devices.items, deviceEquality(['id', 'name']));

  const distanceUnit = useAttributePreference('distanceUnit');
  const speedUnit = useAttributePreference('speedUnit');

  const [columns, setColumns] = usePersistedState('activityColumns', [
    'type',
    'startTime',
    'distance',
    'duration',
    'movingTime',
    'averageSpeed',
  ]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [route, setRoute] = useState(null);
  // Latest mode: on arrival the page lists the newest stored activities, a page at a time.
  // Pressing Show switches to the chosen devices and period; Latest returns to the feed.
  const [latest, setLatest] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = usePersistedState('activityRowsPerPage', 50);
  const [hasMore, setHasMore] = useState(false);
  const [sortedItems, sortCell] = useSortedItems(items, 'activity');

  const createMarkers = () => [
    { latitude: selectedItem.startLat, longitude: selectedItem.startLon, image: 'start-success' },
    { latitude: selectedItem.endLat, longitude: selectedItem.endLon, image: 'finish-error' },
  ];

  useAsyncTask(
    async ({ signal }) => {
      if (selectedItem) {
        const query = new URLSearchParams({
          deviceId: selectedItem.deviceId,
          from: selectedItem.startTime,
          to: selectedItem.endTime,
        });
        const response = await fetchOrThrow(`/api/reports/route?${query.toString()}`, {
          headers: { Accept: 'application/json' },
          signal,
        });
        setRoute(await response.json());
      } else {
        setRoute(null);
      }
    },
    [selectedItem],
  );

  const loadLatest = useCatchCallback(async (pageIndex, size) => {
    const query = new URLSearchParams({ limit: size + 1, offset: pageIndex * size });
    setLoading(true);
    setSelectedItem(null);
    try {
      const response = await fetchOrThrow(`/api/activities/latest?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const rows = await response.json();
      setHasMore(rows.length > size);
      setItems(rows.slice(0, size));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (latest) {
      loadLatest(page, rowsPerPage);
    }
  }, [latest, page, rowsPerPage, loadLatest]);

  const onShow = useCatchCallback(async ({ deviceIds, groupIds, from, to }) => {
    setLatest(false);
    setPage(0);
    const query = new URLSearchParams({ from, to });
    deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
    groupIds.forEach((groupId) => query.append('groupId', groupId));
    setLoading(true);
    setSelectedItem(null);
    try {
      const response = await fetchOrThrow(`/api/activities?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      setItems(await response.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const formatValue = (item, key) => {
    const value = item[key];
    switch (key) {
      case 'type':
        return `${TYPES[item.role] || item.role}${item.open ? ' (in progress)' : ''}`;
      case 'startTime':
      case 'endTime':
        return formatTime(value, 'minutes');
      case 'distance':
        return formatDistance(value, distanceUnit, t);
      case 'duration':
      case 'movingTime':
      case 'stoppedTime':
        return formatNumericHours(value, t);
      case 'averageSpeed':
      case 'maxSpeed':
        return value > 0 ? formatSpeed(value, speedUnit, t) : null;
      default:
        return value;
    }
  };

  const onExport = useCatch(async () => {
    const sheets = new Map();
    items.forEach((item) => {
      const deviceName = devices[item.deviceId]?.name || String(item.deviceId);
      if (!sheets.has(deviceName)) {
        sheets.set(deviceName, []);
      }
      const row = {};
      columns.forEach((key) => {
        row[label(columnsMap.get(key))] = formatValue(item, key);
      });
      sheets.get(deviceName).push(row);
    });
    await exportExcel('Activities', 'activities.xlsx', sheets, theme);
  });

  const navigateToReplay = (item) => {
    navigate({
      pathname: '/replay',
      search: new URLSearchParams({
        from: item.startTime,
        to: item.endTime,
        deviceId: item.deviceId,
      }).toString(),
    });
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'Activities']}>
      <div className={classes.container}>
        {selectedItem && (
          <>
            <div className={classes.containerMap}>
              <MapView>
                <MapGeofence />
                {route && (
                  <>
                    <MapRoutePath positions={route} />
                    <MapMarkers markers={createMarkers()} />
                    <MapCamera positions={route} />
                  </>
                )}
              </MapView>
              <MapScale />
            </div>
            <ResizeHandle />
          </>
        )}
        <div className={classes.containerMain}>
          <div className={classes.header}>
            <ReportFilter
              onShow={onShow}
              onExport={onExport}
              deviceType="multiple"
              autoLatest={false}
              loading={loading}
              formats={['xlsx']}
            >
              <ColumnSelect
                columns={columns}
                setColumns={setColumns}
                columnsArray={columnsArray.map(([key, string]) => [key, label(string)])}
                rawValues
              />
            </ReportFilter>
          </div>
          {latest && (
            <Typography variant="body2" color="textSecondary" sx={{ px: 2, pt: 1 }}>
              Latest activities across your devices. Choose devices and a period, then Show, to
              search.
            </Typography>
          )}
          <Table>
            <TableHead>
              <TableRow>
                <TableCell className={classes.columnAction} />
                {sortCell('deviceId', t('sharedDevice'))}
                {columns.map((key) => sortCell(key, label(columnsMap.get(key))))}
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading ? (
                (latest
                  ? sortedItems
                  : sortedItems.slice(page * rowsPerPage, (page + 1) * rowsPerPage)
                ).map((item) => (
                  <TableRow key={`${item.deviceId}-${item.startTime}`}>
                    <TableCell className={classes.columnAction} padding="none">
                      <div className={classes.columnActionContainer}>
                        {selectedItem === item ? (
                          <IconButton size="small" onClick={() => setSelectedItem(null)}>
                            <GpsFixedIcon fontSize="small" />
                          </IconButton>
                        ) : (
                          <IconButton size="small" onClick={() => setSelectedItem(item)}>
                            <LocationSearchingIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton size="small" onClick={() => navigateToReplay(item)}>
                          <RouteIcon fontSize="small" />
                        </IconButton>
                      </div>
                    </TableCell>
                    <TableCell>{devices[item.deviceId]?.name}</TableCell>
                    {columns.map((key) => (
                      <TableCell key={key}>{formatValue(item, key)}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableShimmer columns={columns.length + 2} startAction />
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={latest ? (hasMore ? -1 : page * rowsPerPage + items.length) : items.length}
            page={page}
            onPageChange={(event, value) => setPage(value)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[25, 50, 100, 200]}
          />
          {!latest && (
            <Typography
              variant="body2"
              color="primary"
              sx={{ px: 2, pb: 2, cursor: 'pointer' }}
              onClick={() => {
                setPage(0);
                setLatest(true);
              }}
            >
              Back to latest activities
            </Typography>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default ActivityReportPage;
