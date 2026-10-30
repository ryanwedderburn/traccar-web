import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Rnd } from 'react-rnd';
import {
  Card,
  CardContent,
  Typography,
  CardActions,
  IconButton,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Menu,
  MenuItem,
  CardMedia,
  TableFooter,
  Link,
  ButtonBase,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import RouteIcon from '@mui/icons-material/Route';
import SendIcon from '@mui/icons-material/Send';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

import { useTranslation } from './LocalizationProvider';
import RemoveDialog from './RemoveDialog';
import PositionValue from './PositionValue';
import { useDeviceReadonly, useRestriction } from '../util/permissions';
import usePositionAttributes from '../attributes/usePositionAttributes';
import { devicesActions, followActions } from '../../store';
import useFollowUi from '../util/useFollowUi';
import useTools from '../util/useTools';
import { useCatch, useCatchCallback } from '../../reactHelper';
import { useAttributePreference } from '../util/preferences';
import useKiosk from '../util/useKiosk';
import useEquipmentUi from '../util/useEquipmentUi';
import EquipmentGauges from './EquipmentGauges';
import TimingRows from './TimingRows';
import fetchOrThrow from '../util/fetchOrThrow';
import { AGREE, APART, STALE } from '../util/competitorPairing';
import { brandIcons, brandKey } from '../../map/core/preloadImages';
import { speedFromKnots, speedUnitString } from '../util/converter';
import { roleByCategory, roleName } from '../util/deviceRoles';

const CARD_WIDTH = 330;
const DISPLAY_FONT = '"Oswald", "Arial Narrow", sans-serif';

const useStyles = makeStyles()((theme, { desktopPadding }) => ({
  card: {
    pointerEvents: 'auto',
    // OURS: a little wider than stock (288) so three headline tiles fit.
    width: `min(${CARD_WIDTH}px, calc(100vw - 24px))`,
    borderRadius: 14,
    overflow: 'hidden',
  },
  /* ---- OURS: the card redesign (Ryan, 2026-10-30: "The text is bland. We can make it more
     visually appealing"; mock-up approved the same day). Status first, three headline tiles,
     course progress as a bar, then the remaining details. Same data as before. */
  hero: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    padding: theme.spacing(1.25, 1, 1.25, 1.5),
    background: '#1B1A18',
    color: '#fff',
    borderBottom: `3px solid ${theme.palette.primary.main}`,
    cursor: 'move',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    flex: 'none',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    background: '#fff',
    color: '#111',
    fontWeight: 700,
    fontSize: 12,
    '& img': { width: '80%', height: '80%', objectFit: 'contain' },
  },
  avatarNumber: {
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontFamily: DISPLAY_FONT,
    fontWeight: 600,
    fontSize: 16,
  },
  who: { minWidth: 0, flex: 1 },
  whoName: {
    display: 'block',
    fontFamily: DISPLAY_FONT,
    fontWeight: 600,
    fontSize: 17,
    lineHeight: 1.1,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  whoSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,.72)',
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  close: { color: 'rgba(255,255,255,.75)' },
  statusLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25, 1.75, 0.25),
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontWeight: 600,
    fontSize: 12,
    padding: '3px 9px',
    borderRadius: 99,
    background: theme.palette.action.hover,
    color: theme.palette.text.primary,
    '& i': { width: 8, height: 8, borderRadius: '50%', flex: 'none' },
  },
  age: { fontSize: 12, color: theme.palette.text.secondary, whiteSpace: 'nowrap' },
  tiles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25, 1.75),
  },
  tile: {
    background: theme.palette.action.hover,
    borderRadius: 10,
    padding: theme.spacing(0.75, 1.25),
    minWidth: 0,
  },
  tileWarn: { background: alpha(theme.palette.warning.main, 0.16) },
  tileBad: { background: alpha(theme.palette.error.main, 0.14) },
  tileKey: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
  },
  tileValue: {
    fontFamily: DISPLAY_FONT,
    fontWeight: 500,
    fontSize: 25,
    lineHeight: 1.05,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    '& small': {
      fontFamily: theme.typography.fontFamily,
      fontSize: 12,
      color: theme.palette.text.secondary,
      marginLeft: 2,
    },
  },
  tileSub: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  bars: {
    display: 'inline-flex',
    gap: 2,
    alignItems: 'flex-end',
    height: 12,
    marginLeft: 4,
    '& i': { width: 3, borderRadius: 1, background: theme.palette.text.primary },
    '& i.off': { background: theme.palette.divider },
  },
  progress: { padding: theme.spacing(0.25, 1.75, 1.25) },
  progressTop: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginBottom: 5,
    '& b': { color: theme.palette.text.primary, fontWeight: 600 },
  },
  track: {
    height: 8,
    borderRadius: 99,
    background: theme.palette.action.selected,
    position: 'relative',
    overflow: 'hidden',
    '& > i': {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: 99,
      background: theme.palette.primary.main,
    },
    '& > u': {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 2,
      background: theme.palette.background.paper,
    },
  },
  progressBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    fontSize: 12,
    marginTop: 5,
    '& span': { color: theme.palette.text.secondary },
  },
  more: { padding: theme.spacing(0.5, 1.75, 1), fontSize: 12 },
  actionLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1,
    marginTop: 4,
    whiteSpace: 'nowrap',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'column',
    borderRadius: 8,
    padding: theme.spacing(0.75, 0.5),
    color: theme.palette.text.secondary,
    '& svg': { fontSize: 22 },
    '&:hover': { background: theme.palette.action.hover, color: theme.palette.text.primary },
    '&.Mui-disabled': { opacity: 0.4 },
    '&[data-active="true"]': { color: theme.palette.primary.main },
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing(1, 1, 0, 2),
    color: theme.palette.text.secondary,
  },
  media: {
    height: theme.dimensions.popupImageHeight,
    '& > div': {
      color: theme.palette.common.white,
      mixBlendMode: 'difference',
    },
  },
  content: {
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(0.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    maxHeight: theme.dimensions.cardContentMaxHeight,
    overflow: 'auto',
  },
  icon: {
    width: '25px',
    height: '25px',
    filter: 'brightness(0) invert(1)',
  },
  table: {
    '& .MuiTableCell-sizeSmall': {
      paddingLeft: 0,
      paddingRight: 0,
    },
    '& .MuiTableCell-sizeSmall:first-of-type': {
      paddingRight: theme.spacing(1),
    },
  },
  cell: {
    borderBottom: 'none',
  },
  // OURS: detail rows read as label (quiet) and value (strong, right-aligned).
  rowName: { color: theme.palette.text.secondary },
  rowValue: { fontWeight: 600, textAlign: 'right' },
  actions: {
    justifyContent: 'space-between',
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(0.5, 0.75),
  },
  root: {
    pointerEvents: 'none',
    position: 'fixed',
    zIndex: 5,
    left: '50%',
    [theme.breakpoints.up('md')]: {
      left: `calc(50% + ${desktopPadding} / 2)`,
      bottom: theme.spacing(3),
    },
    [theme.breakpoints.down('md')]: {
      left: '50%',
      bottom: `calc(${theme.spacing(3)} + ${theme.dimensions.bottomBarHeight}px)`,
    },
    transform: 'translateX(-50%)',
  },
}));

const StatusRow = ({ name, content }) => {
  const { classes } = useStyles({ desktopPadding: 0 });

  return (
    <TableRow>
      <TableCell className={classes.cell}>
        <Typography variant="body2" className={classes.rowName}>
          {name}
        </Typography>
      </TableCell>
      <TableCell className={classes.cell}>
        <Typography variant="body2" component="div" className={classes.rowValue}>
          {content}
        </Typography>
      </TableCell>
    </TableRow>
  );
};

/**
 * "12 s ago", "4 min ago", "2 h ago". Short enough to sit in a table cell.
 *
 * A dash where there is no age, rather than a word. The client can be missing a
 * device's position for reasons that have nothing to do with the device - the
 * map-favourites filter hands the map a single device - so "unknown" read as a
 * claim about the tracker when it was a claim about the filter.
 */
const relativeAge = (seconds) => {
  if (seconds === undefined || seconds === null) {
    return '—';
  }
  if (seconds < 90) {
    return `${seconds} s ago`;
  }
  if (seconds < 5400) {
    return `${Math.round(seconds / 60)} min ago`;
  }
  if (seconds < 172800) {
    return `${Math.round(seconds / 3600)} h ago`;
  }
  return `${Math.round(seconds / 86400)} d ago`;
};

/**
 * The competitor behind the marker.
 *
 * A rider's phone and their bike's tracker are one entry on the day, and the
 * map draws them as one marker while they agree. That collapse hides something
 * a steward may need, so the card puts it back: <b>every source is listed by
 * name with its own age</b>, and the reading of the two is stated rather than
 * left to be inferred.
 *
 * The underlying records are never merged. Each device keeps its own positions
 * and its own history; this is a view over both, which is why it can afford to
 * say where they disagree.
 */
/**
 * subjectRef is free text by design - "a rider, a vehicle, a consignment" - and
 * the rider provisioning path has settled on a "rider:Name" convention. Showing
 * that raw reads as a bug to anyone who did not write it, and normalising the
 * stored data would only hold until the next importer picked its own prefix. So
 * a leading type qualifier is dropped here, where it is a display concern.
 */
const subjectName = (subjectRef) => {
  if (!subjectRef) {
    return '';
  }
  const separator = subjectRef.indexOf(':');
  // Only a short leading qualifier, so a name that happens to contain a colon
  // survives intact.
  return separator > 0 && separator <= 12 ? subjectRef.slice(separator + 1).trim() : subjectRef;
};

const CompetitorRows = ({ competitor, devices }) => {
  if (!competitor) {
    return null;
  }

  const { state, deviceIds, ages, separationMetres } = competitor;
  const sources = (deviceIds || [])
    .map((id) => `${devices[id]?.name || `Device ${id}`} (${relativeAge(ages?.[id])})`)
    .join(' · ');

  let agreement = null;
  if (state === AGREE) {
    agreement = 'Together — both current';
  } else if (state === APART) {
    agreement = `${Math.round(separationMetres)} m apart — both current`;
  } else if (state === STALE) {
    agreement = 'One source is not current — shown from the most recent fix';
  }

  return (
    <>
      {deviceIds?.length > 1 && <StatusRow name="Sources" content={sources} />}
      {agreement && <StatusRow name="Agreement" content={agreement} />}
    </>
  );
};

/* WHERE ALONG TODAY'S COURSE. Written by RouteProgressHandler on the server
   (route* position attributes) for a rider in a class on an event day - so
   this renders nothing anywhere else, stock hosts included.

   Witness wording throughout, never a result: "seen at the finish", not
   "finished" - the organiser's timing owns that word (CONTEXT, witness-not-
   scorer). The figures are what the tracking saw at the time of this fix. */
const km = (metres) => (Number(metres) / 1000).toFixed(1);
const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/* OURS: course progress as a bar (was two table rows). Same attributes, same witness wording. */
const ProgressBar = ({ position, classes }) => {
  const attributes = position?.attributes || {};
  if (attributes.routeLength == null) {
    return null;
  }
  // An open course (crew record button, no event days) is keyed by its date,
  // not a day name - "Day 2026-10-04" reads as a bug.
  const courseName = /^\d{4}-\d{2}-\d{2}$/.test(String(attributes.routeDay))
    ? 'Course'
    : `Day ${attributes.routeDay}`;
  const laps = Number(attributes.routeLaps) > 1 ? Number(attributes.routeLaps) : 0;
  const length = Number(attributes.routeLength);
  const along = attributes.routeAlong != null ? Number(attributes.routeAlong) : null;
  const share = along != null && length > 0 ? Math.min(Math.max(along / length, 0), 1) : 0;
  const off = along == null && attributes.routeOff;
  let bottomLeft;
  let bottomRight;
  if (along != null) {
    bottomLeft = `${km(along)} km`;
    bottomRight = `${km(attributes.routeToGo)} km to go of ${km(length)}`;
  } else if (off) {
    bottomLeft = 'Not on the course';
    bottomRight =
      Number(attributes.routeFurthest) > 0
        ? `furthest seen ${km(attributes.routeFurthest)} km`
        : '';
  } else {
    bottomLeft = `${km(length)} km`;
    bottomRight = '';
  }
  return (
    <div className={classes.progress}>
      <div className={classes.progressTop}>
        <span>
          <b>{courseName}</b>
          {laps ? ` · lap ${attributes.routeLap} of ${laps}` : ''}
        </span>
        <span>
          {attributes.routeFinished
            ? `Seen at finish ${clock(attributes.routeFinished)}`
            : along != null
              ? `${Math.round(share * 100)} %`
              : ''}
        </span>
      </div>
      <div className={classes.track}>
        <i style={{ width: `${(attributes.routeFinished ? 1 : share) * 100}%` }} />
        {laps > 1 &&
          laps <= 20 &&
          Array.from({ length: laps - 1 }, (_, i) => (
            <u key={i} style={{ left: `${((i + 1) / laps) * 100}%` }} />
          ))}
      </div>
      <div className={classes.progressBottom}>
        <b>{bottomLeft}</b>
        <span>{bottomRight}</span>
      </div>
    </div>
  );
};

/* OURS: what the unit is, for choosing its headline tiles. */
const kindOf = (position) => {
  const a = position?.attributes || {};
  if (position?.protocol === 'osmand') return 'phone';
  if (Number(a.power) > 0) return 'supply';
  if (Number(a.battery) > 0 || a.batteryLevel != null) return 'battery';
  return 'other';
};

/* Provisional limits until the low-voltage alerts (claude/low-voltage-alerts-spec.md) give each
   bike its own learned rest voltage; the card will read the same thresholds then. */
const toneSupply = (v) => (v < 12.4 ? 'bad' : v < 12.8 ? 'warn' : '');
const toneCell = (v) => (v < 3.5 ? 'bad' : v < 3.65 ? 'warn' : '');
const toneLevel = (v) => (v < 10 ? 'bad' : v < 20 ? 'warn' : '');

const ageText = (seconds) => {
  if (seconds < 90) return `${Math.max(0, Math.round(seconds))} s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
};

/* The status line. Facts the record states, in the words Race Operations uses. */
const statusOf = (device, position, theme) => {
  const a = position.attributes || {};
  const now = Date.now();
  const heard = Date.parse(device.lastUpdate || position.fixTime);
  const silent = (now - heard) / 1000;
  const kmh = (Number(position.speed) || 0) * 1.852;
  const onCourse = a.routeAlong != null;
  if (a.routeFinished) {
    return { colour: theme.palette.info.main, text: `Seen at finish ${clock(a.routeFinished)}` };
  }
  if (device.status !== 'online' && silent > 600) {
    return { colour: theme.palette.error.main, text: `No signal ${ageText(silent)}` };
  }
  if (a.routeOff && !onCourse) {
    return { colour: theme.palette.warning.main, text: 'Off the course' };
  }
  if (kmh >= 3) {
    return {
      colour: theme.palette.success.main,
      text: onCourse ? 'Moving · on course' : 'Moving',
      pulse: true,
    };
  }
  if (a.ignition === false && kindOf(position) === 'supply') {
    return { colour: theme.palette.warning.main, text: 'Parked · ignition off' };
  }
  return { colour: theme.palette.warning.main, text: onCourse ? 'Stopped · on course' : 'Stopped' };
};

/* The competitor's name when the entry list has one (the device may be named "FMC-4130"). */
const headerName = (device, competitor) => subjectName(competitor?.subjectRef) || device.name;

/* OURS: a labelled action, as in the approved mock-up (icon over a short word). */
const ActionButton = ({ classes, icon, label, onClick, disabled, active }) => (
  <ButtonBase
    className={classes.actionButton}
    onClick={onClick}
    disabled={disabled}
    data-active={active ? 'true' : undefined}
    aria-pressed={active === undefined ? undefined : active}
  >
    {icon}
    <span className={classes.actionLabel}>{label}</span>
  </ButtonBase>
);

/* Race number for a competitor, else the bike-brand logo, else the name's first letter. */
const Avatar = ({ device, competitor, classes, cx }) => {
  const brand = brandKey(device);
  if (competitor?.label && String(competitor.label).length <= 4) {
    return <div className={cx(classes.avatar, classes.avatarNumber)}>{competitor.label}</div>;
  }
  if (brand) {
    return (
      <div className={classes.avatar}>
        <img src={brandIcons[brand]} alt={brand} />
      </div>
    );
  }
  return (
    <div className={cx(classes.avatar, classes.avatarNumber)}>
      {String(device.name || '?')
        .trim()
        .charAt(0)
        .toUpperCase()}
    </div>
  );
};

const StatusLine = ({ device, position, theme, classes }) => {
  const status = statusOf(device, position, theme);
  const fixAge = (Date.now() - Date.parse(position.fixTime)) / 1000;
  return (
    <div className={classes.statusLine}>
      <span className={classes.pill}>
        <i style={{ background: status.colour }} />
        {status.text}
      </span>
      <span className={classes.age}>fix {relativeAge(Math.round(fixAge))}</span>
    </div>
  );
};

const Bars = ({ value, classes }) => (
  <span className={classes.bars}>
    {[4, 6, 8, 10, 12].map((h, i) => (
      <i key={h} className={i < value ? '' : 'off'} style={{ height: h }} />
    ))}
  </span>
);

const Tile = ({ classes, cx, label, value, unit, sub, tone }) => (
  <div
    className={cx(
      classes.tile,
      tone === 'warn' && classes.tileWarn,
      tone === 'bad' && classes.tileBad,
    )}
  >
    <div className={classes.tileKey}>{label}</div>
    <div className={classes.tileValue}>
      {value}
      {unit && <small>{unit}</small>}
    </div>
    {sub && <div className={classes.tileSub}>{sub}</div>}
  </div>
);

/* Three headline numbers, chosen by what the unit reports. Returns the tiles and the
   position keys they cover, so the detail rows below don't repeat them. */
const headline = (position, speedUnit, t, classes) => {
  const a = position.attributes || {};
  /* An FMC impact-trace record (io257) carries the 100 Hz accelerometer burst and nothing else
     meaningful: no supply voltage, and a satellite field that is not a GNSS count (49 seen on
     2277, 25 Oct). Say what the record is instead of reading numbers off it. */
  if (typeof a.io257 === 'string') {
    return {
      tiles: [
        {
          label: 'Speed',
          value: Math.round(speedFromKnots(Number(position.speed) || 0, speedUnit)),
          unit: speedUnitString(speedUnit, t),
        },
        { label: 'Last record', value: 'Impact', sub: 'g-force trace' },
        { label: 'Supply', value: '—', sub: 'not recorded' },
      ],
      shown: ['speed', 'sat', 'io257', 'priority', 'event'],
    };
  }
  const kind = kindOf(position);
  const tiles = [];
  const shown = ['speed'];
  tiles.push({
    label: 'Speed',
    value: Math.round(speedFromKnots(Number(position.speed) || 0, speedUnit)),
    unit: speedUnitString(speedUnit, t),
    sub: position.altitude ? `alt ${Math.round(position.altitude)} m` : null,
  });
  if (kind === 'supply') {
    const v = Number(a.power);
    tiles.push({
      label: 'Supply',
      value: v.toFixed(2),
      unit: 'V',
      tone: toneSupply(v),
      sub: a.ignition != null ? `ignition ${a.ignition ? 'on' : 'off'}` : null,
    });
    shown.push('power', 'ignition');
  } else if (a.batteryLevel != null) {
    const v = Number(a.batteryLevel);
    tiles.push({
      label: 'Battery',
      value: Math.round(v),
      unit: '%',
      tone: toneLevel(v),
      sub:
        Number(a.battery) > 0 ? `${Number(a.battery).toFixed(2)} V` : a.charge ? 'charging' : null,
    });
    shown.push('batteryLevel', 'battery', 'charge');
  } else if (Number(a.battery) > 0) {
    const v = Number(a.battery);
    tiles.push({ label: 'Battery', value: v.toFixed(2), unit: 'V', tone: toneCell(v) });
    shown.push('battery');
  }
  if (a.rssi != null && a.rssi <= 5) {
    tiles.push({
      label: 'Signal',
      value: (
        <>
          {Math.round(a.rssi)}
          <small>/5</small>
          <Bars value={Math.round(a.rssi)} classes={classes} />
        </>
      ),
      sub: a.sat != null ? `${a.sat} satellites` : null,
    });
    shown.push('rssi', 'sat');
  } else if (a.sat != null) {
    tiles.push({
      label: 'Satellites',
      value: a.sat,
      sub: a.hdop != null ? `HDOP ${a.hdop}` : null,
    });
    shown.push('sat', 'hdop');
  } else if (position.accuracy) {
    tiles.push({ label: 'Accuracy', value: Math.round(position.accuracy), unit: 'm' });
    shown.push('accuracy');
  }
  return { tiles: tiles.slice(0, 3), shown };
};

const StatusCard = ({
  deviceId,
  position,
  competitor,
  onClose,
  disableActions,
  desktopPadding = 0,
}) => {
  const { classes, cx, theme } = useStyles({ desktopPadding });
  const speedUnit = useAttributePreference('speedUnit');
  const followUi = useFollowUi();
  const followed = useSelector((state) => state.follow.deviceId === deviceId);
  const dashboards = useTools().some((tool) => tool.id === 'dashboards');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();

  const readonly = useRestriction('readonly');
  const deviceReadonly = useDeviceReadonly();
  const kiosk = useKiosk();
  const equipmentUi = useEquipmentUi();

  const shareDisabled = useSelector((state) => state.session.server.attributes.disableShare);
  const user = useSelector((state) => state.session.user);
  const devices = useSelector((state) => state.devices.items);
  const device = devices[deviceId];

  const deviceImage = device?.attributes?.deviceImage;

  const positionAttributes = usePositionAttributes(t);
  const positionItems = useAttributePreference(
    'positionItems',
    'fixTime,address,speed,totalDistance',
  );

  const navigationAppLink = useAttributePreference('navigationAppLink');
  const navigationAppTitle = useAttributePreference('navigationAppTitle');

  const [anchorEl, setAnchorEl] = useState(null);

  const [removing, setRemoving] = useState(false);

  const handleRemove = useCatch(async (removed) => {
    if (removed) {
      const response = await fetchOrThrow('/api/devices');
      dispatch(devicesActions.refresh(await response.json()));
    }
    setRemoving(false);
  });

  const handleGeofence = useCatchCallback(async () => {
    const newItem = {
      name: t('sharedGeofence'),
      area: `CIRCLE (${position.latitude} ${position.longitude}, 50)`,
    };
    const response = await fetchOrThrow('/api/geofences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    const item = await response.json();
    await fetchOrThrow('/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: position.deviceId, geofenceId: item.id }),
    });
    navigate(`/settings/geofence/${item.id}`);
  }, [navigate, position, t]);

  return (
    <>
      <div className={classes.root}>
        {device && (
          <Rnd
            default={{ x: 0, y: 0, width: 'auto', height: 'auto' }}
            enableResizing={false}
            dragHandleClassName="draggable-header"
            style={{ position: 'relative' }}
          >
            <Card elevation={3} className={classes.card}>
              {deviceImage && (
                <CardMedia
                  className={`draggable-header ${classes.media}`}
                  image={`/api/media/${device.uniqueId}/${deviceImage}`}
                />
              )}
              <div className={`draggable-header ${classes.hero}`}>
                <Avatar device={device} competitor={competitor} classes={classes} cx={cx} />
                <div className={classes.who}>
                  <span className={classes.whoName}>{headerName(device, competitor)}</span>
                  <span className={classes.whoSub}>
                    {[
                      device.attributes?.brand,
                      roleName(device.attributes?.role || roleByCategory(device.category)),
                      device.model,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <IconButton
                  size="small"
                  className={classes.close}
                  onClick={onClose}
                  onTouchStart={onClose}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </div>
              {/* NO POSITION, ON A SPECTATOR HOST, IS NOT A FAULT.
                  The spectator account only receives positions inside the
                  event area (the public-area filter), so a rider at home, in
                  Maseru or driving in reads as a device with no position at
                  all - an entry that opens a card with nothing in it and a map
                  that does not move. Race control answered that question all
                  evening on go-live night, 2026-09-22, so the card says it
                  itself. Kiosk-only: an admin with no position has a different
                  problem and must not be told this one. */}
              {!position && kiosk && (
                <CardContent className={classes.content}>
                  <Typography variant="body2">
                    This rider is outside the race area. Riders appear on the map once they are on
                    course.
                  </Typography>
                </CardContent>
              )}
              {position && (
                <StatusLine device={device} position={position} theme={theme} classes={classes} />
              )}
              {position && equipmentUi && <EquipmentGauges position={position} device={device} />}
              {position && !equipmentUi && (
                <div className={classes.tiles}>
                  {headline(position, speedUnit, t, classes).tiles.map((tile) => (
                    <Tile key={tile.label} classes={classes} cx={cx} {...tile} />
                  ))}
                </div>
              )}
              {position && <ProgressBar position={position} classes={classes} />}
              {position && (
                <CardContent className={classes.content}>
                  <Table size="small" className={classes.table}>
                    <TableBody>
                      <CompetitorRows competitor={competitor} devices={devices} />
                      <TimingRows deviceId={deviceId} Row={StatusRow} />
                      {positionItems
                        .split(',')
                        .filter(
                          (key) =>
                            position.hasOwnProperty(key) || position.attributes.hasOwnProperty(key),
                        )
                        .filter(
                          (key) =>
                            key !== 'fixTime' &&
                            (equipmentUi ||
                              !headline(position, speedUnit, t, classes).shown.includes(key)),
                        )
                        .map((key) => (
                          <StatusRow
                            key={key}
                            name={positionAttributes[key]?.name || key}
                            content={
                              <PositionValue
                                position={position}
                                property={position.hasOwnProperty(key) ? key : null}
                                attribute={position.hasOwnProperty(key) ? null : key}
                              />
                            }
                          />
                        ))}
                    </TableBody>
                    {!kiosk && (
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={2} className={classes.cell}>
                            <Typography variant="body2">
                              <Link component={RouterLink} to={`/position/${position.id}`}>
                                {t('sharedShowDetails')}
                              </Link>
                            </Typography>
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </CardContent>
              )}
              {/*
                Hidden outright in kiosk mode rather than disabled. readonly
                already greys out Edit and Delete, but a row of five dead icons
                is more distracting than no row at all - and Replay and Send
                Command are not covered by readonly, so they stay live and lead
                a spectator off the map. The extras Menu and RemoveDialog below
                are left mounted: they have no trigger without these buttons.
              */}
              {!kiosk && (
                <CardActions className={classes.actions} disableSpacing>
                  <ActionButton
                    classes={classes}
                    icon={<RouteIcon />}
                    label={t('reportReplay')}
                    onClick={() => navigate(`/replay?deviceId=${deviceId}`)}
                    disabled={disableActions || !position}
                  />
                  {followUi && (
                    <ActionButton
                      classes={classes}
                      icon={<GpsFixedIcon />}
                      label={followed ? 'Following' : 'Follow'}
                      active={followed}
                      onClick={() => dispatch(followActions.toggle(deviceId))}
                      disabled={!position}
                    />
                  )}
                  {dashboards && (
                    <ActionButton
                      classes={classes}
                      icon={<ShowChartIcon />}
                      label="Telemetry"
                      onClick={() => window.location.assign('/telemetry.html#telemetry')}
                    />
                  )}
                  <ActionButton
                    classes={classes}
                    icon={<SendIcon />}
                    label={t('commandTitle')}
                    onClick={() => navigate(`/settings/device/${deviceId}/command`)}
                    disabled={disableActions}
                  />
                  <ActionButton
                    classes={classes}
                    icon={<MoreHorizIcon />}
                    label="More"
                    onClick={(e) => setAnchorEl(e.currentTarget)}
                  />
                </CardActions>
              )}
            </Card>
          </Rnd>
        )}
      </div>
      {/* OURS: the More menu now also holds Edit and Remove (they were two buttons on the
          card; the bar keeps the everyday actions). MUI Menu children must be items, not
          fragments, so each position-only item carries its own condition. */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {position && (
          <MenuItem
            onClick={() => navigate(`/stream?deviceId=${deviceId}`)}
            disabled={position.protocol !== 'jt808'}
          >
            {t('linkLiveVideo')}
          </MenuItem>
        )}
        {position && !readonly && (
          <MenuItem onClick={handleGeofence}>{t('sharedCreateGeofence')}</MenuItem>
        )}
        {position && (
          <MenuItem
            component="a"
            target="_blank"
            href={`https://www.google.com/maps/search/?api=1&query=${position.latitude}%2C${position.longitude}`}
          >
            {t('linkGoogleMaps')}
          </MenuItem>
        )}
        {position && (
          <MenuItem
            component="a"
            target="_blank"
            href={`http://maps.apple.com/?ll=${position.latitude},${position.longitude}`}
          >
            {t('linkAppleMaps')}
          </MenuItem>
        )}
        {position && (
          <MenuItem
            component="a"
            target="_blank"
            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${position.latitude}%2C${position.longitude}&heading=${position.course}`}
          >
            {t('linkStreetView')}
          </MenuItem>
        )}
        {position && navigationAppTitle && navigationAppLink && (
          <MenuItem
            component="a"
            target="_blank"
            href={navigationAppLink
              .replace('{latitude}', position.latitude)
              .replace('{longitude}', position.longitude)}
          >
            {navigationAppTitle}
          </MenuItem>
        )}
        {!shareDisabled && !user.temporary && (
          <MenuItem onClick={() => navigate(`/settings/device/${deviceId}/share`)}>
            <Typography color="secondary">{t('sharedShare')}</Typography>
          </MenuItem>
        )}
        <MenuItem
          onClick={() => navigate(`/settings/device/${deviceId}`)}
          disabled={disableActions || deviceReadonly}
        >
          {t('sharedEdit')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            setRemoving(true);
          }}
          disabled={disableActions || deviceReadonly}
        >
          <Typography color="error">{t('sharedRemove')}</Typography>
        </MenuItem>
      </Menu>
      <RemoveDialog
        open={removing}
        endpoint="devices"
        itemId={deviceId}
        onResult={(removed) => handleRemove(removed)}
      />
    </>
  );
};

export default StatusCard;
