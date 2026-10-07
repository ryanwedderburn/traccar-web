// OURS, not upstream. Activities (REPORTING.md, step R1): rides, drives and walks detected from
// positions by the server (/api/activities), per device role. Modelled on TripReportPage.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  TextField,
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
import { saveAs } from 'file-saver';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { speedFromKnots, speedUnitString } from '../common/util/converter';
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

// Trip classification for the travel logbook (REPORTING.md, R9): vehicle trips only, once finished.
const VEHICLE_CATEGORIES = ['car', 'van', 'truck', 'bus', 'camper', 'tractor'];
const classifiable = (item) => item.role === 'vehicle' && !item.open;

// SA tax year: 1 March to end February, named by the year it ends in.
const currentTaxYear = () => {
  const now = new Date();
  return now.getMonth() >= 2 ? now.getFullYear() + 1 : now.getFullYear();
};

const fileNameOf = (response, fallback) => {
  const header = response.headers.get('Content-Disposition') || '';
  const match = header.match(/filename="([^"]+)"/);
  return match ? match[1] : fallback;
};

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
  // The signed-in user's own heart rate during the selected activity (REPORTING.md, R4). Owner
  // only: the server returns nothing for anyone else's data and refuses impersonated sessions.
  const [heartRate, setHeartRate] = useState(null);
  // Latest mode: on arrival the page lists the newest stored activities, a page at a time.
  // Pressing Show switches to the chosen devices and period; Latest returns to the feed.
  const [latest, setLatest] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = usePersistedState('activityRowsPerPage', 50);
  const [hasMore, setHasMore] = useState(false);
  const [sortedItems, sortCell] = useSortedItems(items, 'activity');
  const showClass = items.some((item) => item.role === 'vehicle');
  const [logbookOpen, setLogbookOpen] = useState(false);
  const [logbookDevice, setLogbookDevice] = useState('');
  const [logbookYear, setLogbookYear] = useState(currentTaxYear());
  const [logbookKm, setLogbookKm] = useState('');
  const vehicles = Object.values(devices).filter((device) =>
    VEHICLE_CATEGORIES.includes(device.category),
  );

  const saveClass = useCatch(async (item, tripClass, purpose) => {
    await fetchOrThrow('/api/activities/class', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: item.deviceId,
        startTime: item.startTime,
        endTime: item.endTime,
        tripClass: tripClass || null,
        purpose: tripClass ? purpose || null : null,
      }),
    });
    setItems((current) =>
      current.map((other) =>
        other === item
          ? {
              ...other,
              tripClass: tripClass || undefined,
              purpose: tripClass ? purpose : undefined,
            }
          : other,
      ),
    );
  });

  // Bulk: the trips on this page that have no answer yet, all at once (e.g. a day of site visits).
  const visibleItems = latest
    ? sortedItems
    : sortedItems.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const unanswered = visibleItems.filter((item) => classifiable(item) && !item.tripClass);
  const classifyAll = useCatch(async (tripClass) => {
    await Promise.all(
      unanswered.map((item) =>
        fetchOrThrow('/api/activities/class', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: item.deviceId,
            startTime: item.startTime,
            endTime: item.endTime,
            tripClass,
          }),
        }),
      ),
    );
    const done = new Set(unanswered);
    setItems((current) => current.map((item) => (done.has(item) ? { ...item, tripClass } : item)));
  });

  const downloadLogbook = useCatch(async () => {
    const query = new URLSearchParams({ deviceId: logbookDevice, year: logbookYear });
    if (logbookKm !== '') {
      query.append('openingKm', logbookKm);
    }
    const response = await fetchOrThrow(`/api/activities/logbook?${query.toString()}`);
    saveAs(await response.blob(), fileNameOf(response, `logbook-${logbookYear}.xlsx`));
    setLogbookOpen(false);
  });

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

  useAsyncTask(
    async ({ signal }) => {
      setHeartRate(null);
      if (selectedItem && !selectedItem.open) {
        const query = new URLSearchParams({
          deviceId: selectedItem.deviceId,
          from: selectedItem.startTime,
          to: selectedItem.endTime,
        });
        // Plain fetch: no session, or an impersonated one, is not an error worth showing.
        const response = await fetch(`/api/athlete/overlay?${query.toString()}`, { signal });
        if (response.ok) {
          const result = await response.json();
          setHeartRate(result.samples ? result : null);
        }
      }
    },
    [selectedItem],
  );

  const chartData = () => {
    const start = new Date(selectedItem.startTime).getTime();
    const points = heartRate.samples.map(([time, hr]) => ({ minute: (time - start) / 60000, hr }));
    (route || []).forEach((position) => {
      points.push({
        minute: (new Date(position.fixTime).getTime() - start) / 60000,
        speed: speedFromKnots(position.speed, speedUnit),
      });
    });
    return points.sort((a, b) => a.minute - b.minute);
  };

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
          {selectedItem && heartRate && (
            <Box sx={{ px: 2, pt: 1 }}>
              <Typography variant="subtitle2">
                {`Your heart rate on this activity: average ${heartRate.avgHr} bpm, maximum ${heartRate.maxHr} bpm`}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {`Source: ${heartRate.source}. Your own recorded session, matched by time. Only you can see this.`}
              </Typography>
              <Box sx={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData()} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
                    <XAxis
                      dataKey="minute"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(v) => `${Math.round(v)}`}
                      unit=" min"
                    />
                    <YAxis
                      yAxisId="hr"
                      domain={['dataMin - 5', 'dataMax + 5']}
                      allowDecimals={false}
                    />
                    <YAxis yAxisId="speed" orientation="right" allowDecimals={false} />
                    <Tooltip
                      formatter={(value, name) =>
                        name === 'Heart rate'
                          ? [`${value} bpm`, name]
                          : [`${value} ${speedUnitString(speedUnit, t)}`, name]
                      }
                      labelFormatter={(v) => `${v.toFixed(1)} min`}
                    />
                    <Legend />
                    <Line
                      yAxisId="hr"
                      name="Heart rate"
                      dataKey="hr"
                      dot={false}
                      connectNulls
                      strokeWidth={1.5}
                      stroke="#e53935"
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="speed"
                      name="Speed"
                      dataKey="speed"
                      dot={false}
                      connectNulls
                      strokeWidth={1}
                      stroke="#2a78d6"
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          )}
          {unanswered.length > 0 && (
            <Typography variant="body2" sx={{ px: 2, pt: 1 }}>
              {`${unanswered.length} trip${unanswered.length > 1 ? 's' : ''} on this page not yet marked. Mark them all: `}
              <Button size="small" onClick={() => classifyAll('business')}>
                Business
              </Button>
              <Button size="small" onClick={() => classifyAll('personal')}>
                Personal
              </Button>
            </Typography>
          )}
          {vehicles.length > 0 && (
            <Button size="small" sx={{ mx: 1, mt: 1 }} onClick={() => setLogbookOpen(true)}>
              Travel logbook
            </Button>
          )}
          <Dialog open={logbookOpen} onClose={() => setLogbookOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle>Travel logbook</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                select
                label={t('sharedDevice')}
                value={logbookDevice}
                onChange={(event) => setLogbookDevice(event.target.value)}
                sx={{ mt: 1 }}
              >
                {vehicles.map((device) => (
                  <MenuItem key={device.id} value={device.id}>
                    {device.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Tax year"
                value={logbookYear}
                onChange={(event) => setLogbookYear(event.target.value)}
              >
                {[0, 1, 2].map((back) => {
                  const year = currentTaxYear() - back;
                  return (
                    <MenuItem key={year} value={year}>
                      {`${year} (1 Mar ${year - 1} to Feb ${year})`}
                    </MenuItem>
                  );
                })}
              </TextField>
              <TextField
                type="number"
                label="Odometer on 1 March (km, optional)"
                helperText="Your dashboard reading. Without it the vehicle's or tracker's own odometer is used where reported."
                value={logbookKm}
                onChange={(event) => setLogbookKm(event.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setLogbookOpen(false)}>{t('sharedCancel')}</Button>
              <Button disabled={!logbookDevice} onClick={downloadLogbook}>
                Download
              </Button>
            </DialogActions>
          </Dialog>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell className={classes.columnAction} />
                {sortCell('deviceId', t('sharedDevice'))}
                {columns.map((key) => sortCell(key, label(columnsMap.get(key))))}
                {showClass && sortCell('tripClass', 'Business / personal')}
                {showClass && sortCell('purpose', 'Reason / client')}
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading ? (
                visibleItems.map((item) => (
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
                    {showClass && (
                      <TableCell padding="none">
                        {classifiable(item) && (
                          <Select
                            size="small"
                            variant="standard"
                            displayEmpty
                            value={item.tripClass || ''}
                            onChange={(event) => saveClass(item, event.target.value, item.purpose)}
                          >
                            <MenuItem value="">
                              <em>Not set</em>
                            </MenuItem>
                            <MenuItem value="business">Business</MenuItem>
                            <MenuItem value="personal">Personal</MenuItem>
                          </Select>
                        )}
                      </TableCell>
                    )}
                    {showClass && (
                      <TableCell padding="none">
                        {classifiable(item) && (
                          <TextField
                            key={`${item.startTime}-${item.tripClass || ''}`}
                            size="small"
                            variant="standard"
                            disabled={!item.tripClass}
                            placeholder={item.tripClass ? 'Reason or client' : ''}
                            defaultValue={item.purpose || ''}
                            onBlur={(event) => {
                              if (event.target.value !== (item.purpose || '')) {
                                saveClass(item, item.tripClass, event.target.value);
                              }
                            }}
                          />
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableShimmer columns={columns.length + (showClass ? 4 : 2)} startAction />
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
