import { useTheme } from '@mui/material/styles';
import { Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from './LocalizationProvider';

/**
 * The instrument row of the equipment status card - the first piece of the
 * equipmentUi chrome (docs/HEAVY-EQUIPMENT-PHASE1.md).
 *
 * Self-hiding, per gauge: an instrument renders only when the position
 * carries its attribute, the same rule RouteFilter and the POI list follow.
 * A forklift with no CAN shows ignition alone; an FMC650 shows the panel.
 * The row disappears entirely when nothing qualifies, so stock devices on an
 * equipment host lose no space to it.
 *
 * Ranges are data, not code: `rpmMax` and `fuelMax` read from the device's
 * attributes (group inheritance is the server's job, so these are per-device
 * or defaulted). 2,400 rpm redlines a dozer while a bakkie idles at 750 -
 * a hardcoded scale would be wrong for one of them.
 *
 * Live for free: the card re-renders from Redux on every websocket position
 * update, so the needle moves with no timer and no extra fetch.
 */

const useStyles = makeStyles()((theme) => ({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1, 2, 0.5, 2),
  },
  bars: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    minWidth: 0,
  },
  barLine: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  barCaption: {
    width: 34,
    flexShrink: 0,
    color: theme.palette.text.secondary,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.palette.action.hover,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.5s, background-color 0.5s',
  },
  barValue: {
    width: 40,
    flexShrink: 0,
    textAlign: 'right',
  },
  ignition: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background-color 0.5s',
  },
}));

const polar = (cx, cy, r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};

const arcPath = (cx, cy, r, startDeg, endDeg) => {
  const [sx, sy] = polar(cx, cy, r, startDeg);
  const [ex, ey] = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
};

const GAUGE_START = -135;
const GAUGE_END = 135;

const RpmDial = ({ value, max, label }) => {
  const theme = useTheme();
  const fraction = Math.min(Math.max(value / max, 0), 1);
  const end = GAUGE_START + (GAUGE_END - GAUGE_START) * fraction;
  return (
    <svg width={92} height={92} viewBox="0 0 92 92">
      <path
        d={arcPath(46, 46, 38, GAUGE_START, GAUGE_END)}
        fill="none"
        stroke={theme.palette.action.hover}
        strokeWidth={8}
        strokeLinecap="round"
      />
      {fraction > 0 && (
        <path
          d={arcPath(46, 46, 38, GAUGE_START, Math.max(end, GAUGE_START + 1))}
          fill="none"
          stroke={fraction > 0.9 ? theme.palette.error.main : theme.palette.primary.main}
          strokeWidth={8}
          strokeLinecap="round"
        />
      )}
      <text
        x={46}
        y={48}
        textAnchor="middle"
        fill={theme.palette.text.primary}
        fontSize={17}
        fontWeight={600}
        fontFamily={theme.typography.fontFamily}
      >
        {Math.round(value)}
      </text>
      <text
        x={46}
        y={66}
        textAnchor="middle"
        fill={theme.palette.text.secondary}
        fontSize={10}
        fontFamily={theme.typography.fontFamily}
      >
        {label}
      </text>
    </svg>
  );
};

const LevelBar = ({ caption, value, max, text, color }) => {
  const { classes } = useStyles();
  const fraction = Math.min(Math.max(value / max, 0), 1);
  return (
    <div className={classes.barLine}>
      <Typography variant="caption" className={classes.barCaption} noWrap>
        {caption}
      </Typography>
      <div className={classes.barTrack}>
        <div
          className={classes.barFill}
          style={{ width: `${fraction * 100}%`, backgroundColor: color }}
        />
      </div>
      <Typography variant="caption" className={classes.barValue}>
        {text}
      </Typography>
    </div>
  );
};

const EquipmentGauges = ({ position, device }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();

  const attributes = position.attributes || {};
  const has = (key) => Object.prototype.hasOwnProperty.call(attributes, key);
  if (!has('rpm') && !has('fuel') && !has('coolantTemp') && !has('ignition')) {
    return null;
  }

  const rpmMax = Number(device?.attributes?.rpmMax) || 2400;
  const fuelMax = Number(device?.attributes?.fuelMax) || 100;

  const fuelFraction = has('fuel') ? attributes.fuel / fuelMax : 0;
  const fuelColor =
    fuelFraction < 0.1
      ? theme.palette.error.main
      : fuelFraction < 0.25
        ? theme.palette.warning.main
        : theme.palette.success.main;

  const coolant = attributes.coolantTemp;
  const coolantColor =
    coolant >= 100
      ? theme.palette.error.main
      : coolant >= 90
        ? theme.palette.warning.main
        : theme.palette.info.main;

  return (
    <div className={classes.row}>
      {has('rpm') && <RpmDial value={attributes.rpm} max={rpmMax} label={t('positionRpm')} />}
      <div className={classes.bars}>
        {has('fuel') && (
          <LevelBar
            caption={t('positionFuel')}
            value={attributes.fuel}
            max={fuelMax}
            text={`${Math.round(attributes.fuel)}${fuelMax === 100 ? '%' : ''}`}
            color={fuelColor}
          />
        )}
        {has('coolantTemp') && (
          <LevelBar
            caption="°C"
            value={coolant}
            max={120}
            text={`${Math.round(coolant)}°`}
            color={coolantColor}
          />
        )}
        {has('ignition') && (
          <div className={classes.ignition}>
            <span
              className={classes.dot}
              style={{
                backgroundColor: attributes.ignition
                  ? theme.palette.success.main
                  : theme.palette.action.disabled,
              }}
            />
            <Typography variant="caption" color="textSecondary">
              {t('positionIgnition')}
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
};

export default EquipmentGauges;
