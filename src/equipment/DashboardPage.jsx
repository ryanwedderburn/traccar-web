import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, IconButton, Typography, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import dayjs from 'dayjs';
import useEquipmentUi from '../common/util/useEquipmentUi';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { devicesActions } from '../store';
import decodeDm1 from './dtc';

/**
 * The fleet dashboard - Phase 2's centrepiece, spec'd by slide 3 of the
 * pitch deck (docs/collateral/heavy-equipment/pitch_deck.js): KPI tiles,
 * machine list with live status, service-due figures. Client-only: every
 * number here is derived from APIs the server already serves.
 *
 * Live for free, same as the gauge card: SocketController mounts at the App
 * layout level, so the positions slice keeps updating on this route and the
 * status column moves without a timer. Only the two report fetches (fuel
 * burned, alerts) poll, once a minute.
 *
 * Deliberately NO embedded map, though the deck mock shows one: `map` is a
 * module-level singleton (map/core/MapView.jsx) and a second instance is a
 * fight with the main page. The Map tab is one tap away.
 *
 * Labels are literal English rather than l10n keys, the SupportWidget
 * rationale: this is per-vertical chrome, and inventing keys that render
 * empty in every other locale is worse than the English until a real
 * translation need appears.
 */

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.default,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing(2),
    maxWidth: 800,
    width: '100%',
    margin: '0 auto',
  },
  kpis: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  kpi: {
    padding: theme.spacing(1.5),
  },
  section: {
    color: theme.palette.text.secondary,
    letterSpacing: 2,
    margin: theme.spacing(1, 0),
  },
  machine: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    flexShrink: 0,
  },
  machineText: {
    flex: 1,
    minWidth: 0,
  },
  machineRight: {
    textAlign: 'right',
    flexShrink: 0,
  },
}));

const HOUR = 3600000;
const SHIFT_START_HOUR = 6;

/**
 * An idling diesel turns ~600-900 rpm, so `rpm > 0` cannot mean working -
 * the first version made exactly that mistake and called every lunch-break
 * idle "Working". Working is motion, or rpm at genuine load. The threshold
 * is per-device data (`workingRpm`) with a diesel-plant default, same rule
 * as the gauge ranges.
 */
const DEFAULT_WORKING_RPM = 1000;

/**
 * rank orders the machine list EXCEPTIONS FIRST - the industry's
 * "exception-based view": what needs a decision sits on top, healthy
 * machines below, offline at the bottom. Sorting by name would make the
 * manager do the prioritising that the dashboard exists to do.
 */
const machineState = (device, position, theme) => {
  if (device.status !== 'online') {
    return { label: 'Offline', color: theme.palette.action.disabled, rank: 4, idling: false };
  }
  const a = position?.attributes || {};
  const workingRpm = Number(device?.attributes?.workingRpm) || DEFAULT_WORKING_RPM;
  if (a.motion && !a.ignition) {
    return {
      label: 'Moving · no ignition',
      color: theme.palette.error.main,
      rank: 0,
      idling: false,
    };
  }
  if (a.ignition && (a.motion || a.rpm >= workingRpm)) {
    return { label: 'Working', color: theme.palette.success.main, rank: 2, idling: false };
  }
  if (a.ignition) {
    return { label: 'Idling', color: theme.palette.warning.main, rank: 1, idling: true };
  }
  return { label: 'Static · OK', color: theme.palette.text.secondary, rank: 3, idling: false };
};

const DashboardPage = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const equipmentUi = useEquipmentUi();

  // Drill-down in two taps: row -> that machine selected on the map.
  const handleRowClick = (deviceId) => {
    dispatch(devicesActions.selectId(deviceId));
    navigate('/');
  };

  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const groups = useSelector((state) => state.groups.items);

  const [engineHours, setEngineHours] = useState(null);
  const [hoursByDevice, setHoursByDevice] = useState({});
  const [idleSince, setIdleSince] = useState({});
  const [alerts, setAlerts] = useState(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [maintenances, setMaintenances] = useState([]);

  useEffect(() => {
    if (!equipmentUi) {
      navigate('/');
    }
  }, [equipmentUi, navigate]);

  useEffect(() => {
    const load = async () => {
      const deviceIds = Object.keys(devices);
      if (!deviceIds.length) {
        return;
      }
      const query = new URLSearchParams();
      deviceIds.forEach((id) => query.append('deviceId', id));
      query.append('from', dayjs().startOf('day').toISOString());
      query.append('to', dayjs().toISOString());
      try {
        const summaryResponse = await fetchOrThrow(`/api/reports/summary?${query.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        const summary = await summaryResponse.json();
        // NOT spentFuel: it sums level deltas, and percent-based fuel with
        // refill boundaries yields negative litres (seen live, 2026-08-10).
        setEngineHours(summary.reduce((sum, item) => sum + (item.engineHours || 0), 0));
        setHoursByDevice(
          Object.fromEntries(summary.map((item) => [item.deviceId, item.engineHours || 0])),
        );
      } catch {
        setEngineHours(null);
        setHoursByDevice({});
      }
      try {
        const eventsResponse = await fetchOrThrow(`/api/reports/events?${query.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        const events = await eventsResponse.json();
        const alertTypes = [
          'deviceFuelDrop',
          'maintenance',
          'geofenceExit',
          'alarm',
          'deviceOverspeed',
        ];
        setAlerts(
          events
            .filter((event) => alertTypes.includes(event.type))
            .sort((a, b) => b.eventTime.localeCompare(a.eventTime)),
        );
        // "Idling 42 min": a machine idling now has been idle since its
        // last stop / ignition-on event today. Event-derived, so it is an
        // approximation at day boundaries - good enough for the glance.
        const since = {};
        events
          .filter((event) => ['deviceStopped', 'ignitionOn'].includes(event.type))
          .forEach((event) => {
            if (!since[event.deviceId] || event.eventTime > since[event.deviceId]) {
              since[event.deviceId] = event.eventTime;
            }
          });
        setIdleSince(since);
      } catch {
        setAlerts(null);
        setIdleSince({});
      }
      try {
        const maintenanceResponse = await fetchOrThrow('/api/maintenance');
        setMaintenances((await maintenanceResponse.json()).filter((item) => item.type === 'hours'));
      } catch {
        setMaintenances([]);
      }
    };
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [devices]);

  // Utilisation, OEM-portal definition: engine hours today over shift
  // elapsed. The finer working-vs-idle split needs history and is queued.
  const shiftElapsed = Math.max(
    dayjs().diff(dayjs().startOf('day').add(SHIFT_START_HOUR, 'hour')),
    HOUR,
  );

  const rows = useMemo(
    () =>
      Object.values(devices)
        .map((device) => {
          const position = positions[device.id];
          const state = machineState(device, position, theme);
          const attributes = position?.attributes || {};

          if (state.idling && idleSince[device.id]) {
            const minutes = dayjs().diff(dayjs(idleSince[device.id]), 'minute');
            if (minutes > 0) {
              state.label = `Idling ${minutes} min`;
            }
          }

          let service = null;
          if (attributes.hours && maintenances.length) {
            const remaining = Math.min(
              ...maintenances.map((m) => {
                const period = m.period || Infinity;
                const next =
                  m.start + (Math.floor((attributes.hours - m.start) / period) + 1) * period;
                return next - attributes.hours;
              }),
            );
            if (Number.isFinite(remaining)) {
              service = Math.round(remaining / HOUR);
            }
          }

          const dayHours = hoursByDevice[device.id];
          const utilisation =
            dayHours != null ? Math.min(Math.round((dayHours / shiftElapsed) * 100), 100) : null;

          return {
            device,
            group: groups[device.groupId]?.name,
            state,
            fuel: attributes.fuel,
            hours: attributes.hours,
            service,
            utilisation,
            fault: decodeDm1(attributes.dm1),
          };
        })
        .sort((a, b) => a.state.rank - b.state.rank || a.device.name.localeCompare(b.device.name)),
    [devices, positions, groups, maintenances, hoursByDevice, idleSince, shiftElapsed, theme],
  );

  const online = rows.filter((row) => row.device.status === 'online').length;
  const alertRow = rows.some((row) => row.state.label.startsWith('Moving'));
  const faults = rows.filter((row) => row.fault);

  const onlineUtils = rows
    .filter((row) => row.device.status === 'online')
    .map((row) => row.utilisation || 0);
  const utilisation = onlineUtils.length
    ? Math.round(onlineUtils.reduce((sum, u) => sum + u, 0) / onlineUtils.length)
    : null;

  const kpis = [
    {
      value: `${online} / ${rows.length}`,
      caption: 'machines online',
      color: online === rows.length ? theme.palette.success.main : theme.palette.warning.main,
    },
    {
      value: utilisation != null ? `${utilisation}%` : '—',
      caption: 'utilisation today',
      color: theme.palette.success.main,
    },
    {
      value: engineHours != null ? `${Math.round(engineHours / HOUR)} h` : '—',
      caption: 'engine hours today',
      color: theme.palette.text.primary,
    },
    {
      value: alerts != null ? String(alerts.length) : '—',
      caption: 'alerts today',
      color: alerts?.length ? theme.palette.error.main : theme.palette.text.primary,
      onClick: alerts?.length ? () => setAlertsOpen((open) => !open) : null,
    },
  ];

  const alertLabel = (event) =>
    ({
      deviceFuelDrop: 'Fuel drop',
      maintenance: 'Service due',
      geofenceExit: 'Left site',
      geofenceEnter: 'Entered site',
      alarm: `Alarm${event.attributes?.alarm ? ` · ${event.attributes.alarm}` : ''}`,
      deviceOverspeed: 'Overspeed',
    })[event.type] || event.type;

  return (
    <div className={classes.root}>
      <AppBar position="static" color="inherit" elevation={1}>
        <Toolbar variant="dense">
          <IconButton edge="start" onClick={() => navigate('/')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" style={{ flex: 1 }}>
            Fleet overview
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {dayjs().format('ddd D MMM · HH:mm')}
          </Typography>
        </Toolbar>
      </AppBar>
      <div className={classes.content}>
        <div className={classes.kpis}>
          {kpis.map((kpi) => (
            <Paper
              key={kpi.caption}
              className={classes.kpi}
              onClick={kpi.onClick || undefined}
              style={kpi.onClick ? { cursor: 'pointer' } : undefined}
            >
              <Typography variant="h5" fontWeight={600} style={{ color: kpi.color }}>
                {kpi.value}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {kpi.caption}
                {kpi.onClick ? (alertsOpen ? ' ▾' : ' ▸') : ''}
              </Typography>
            </Paper>
          ))}
        </div>
        {alertsOpen && alerts?.length > 0 && (
          <>
            <Typography variant="overline" className={classes.section} component="div">
              Alerts today
            </Typography>
            {alerts.map((event) => (
              <Paper
                key={event.id}
                className={classes.machine}
                onClick={() => handleRowClick(event.deviceId)}
                style={{ cursor: 'pointer' }}
              >
                <span
                  className={classes.dot}
                  style={{ backgroundColor: theme.palette.error.main }}
                />
                <div className={classes.machineText}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {alertLabel(event)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" noWrap component="div">
                    {devices[event.deviceId]?.name || `Device ${event.deviceId}`}
                  </Typography>
                </div>
                <div className={classes.machineRight}>
                  <Typography variant="caption" color="textSecondary">
                    {dayjs(event.eventTime).format('HH:mm')}
                  </Typography>
                </div>
              </Paper>
            ))}
          </>
        )}
        {faults.length > 0 && (
          <>
            <Typography variant="overline" className={classes.section} component="div">
              Machine health
            </Typography>
            {faults.map(({ device, fault }) => (
              <Paper
                key={`fault-${device.id}`}
                className={classes.machine}
                onClick={() => handleRowClick(device.id)}
                style={{ cursor: 'pointer' }}
              >
                <span
                  className={classes.dot}
                  style={{
                    backgroundColor: fault.severe
                      ? theme.palette.error.main
                      : theme.palette.warning.main,
                  }}
                />
                <div className={classes.machineText}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {fault.component}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" noWrap component="div">
                    {`${device.name} · ${fault.condition}`}
                  </Typography>
                </div>
                <div className={classes.machineRight}>
                  <Typography variant="caption" color="textSecondary" component="div">
                    {`SPN ${fault.spn} · FMI ${fault.fmi}`}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" component="div">
                    {`seen ${fault.oc}×`}
                  </Typography>
                </div>
              </Paper>
            ))}
          </>
        )}
        <Typography variant="overline" className={classes.section} component="div">
          Machines
          {alertRow ? ' · attention needed' : ''}
        </Typography>
        {rows.map(({ device, group, state, fuel, hours, service, utilisation: util }) => (
          <Paper
            key={device.id}
            className={classes.machine}
            onClick={() => handleRowClick(device.id)}
            style={{ cursor: 'pointer' }}
          >
            <span className={classes.dot} style={{ backgroundColor: state.color }} />
            <div className={classes.machineText}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {device.name}
              </Typography>
              <Typography variant="caption" color="textSecondary" noWrap component="div">
                {[device.model, group].filter(Boolean).join(' · ')}
              </Typography>
            </div>
            <div className={classes.machineRight}>
              <Typography variant="body2" style={{ color: state.color }}>
                {state.label}
              </Typography>
              <Typography variant="caption" color="textSecondary" component="div">
                {[
                  util != null && util > 0 ? `Util ${util}%` : null,
                  fuel != null ? `Fuel ${Math.round(fuel)}%` : null,
                  hours != null ? `${Math.round(hours / HOUR)} h` : null,
                  service != null ? `Service in ${service} h` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </div>
          </Paper>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
