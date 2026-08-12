import { useMemo, useState } from 'react';
import { IconButton, Paper, Typography, useMediaQuery } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

// OBD telemetry overlay for the replay page. Renders only when the loaded
// positions actually carry OBD attributes (rpm is the marker - a device
// plugged into a vehicle sends it, phones and bare trackers never do), so
// there is nothing to configure and no change for non-OBD devices.
//
// Channel notes for the raw io ids (Teltonika AVL ids the decoder does not
// name, verified against RW-DMAX data 2026-08-12, docs/FOTA.md):
//   io37 - OBD vehicle speed, km/h (tracks GPS speed within ~5 km/h)
//   io42 - runtime since engine start, seconds
//   io45 - direct fuel rail pressure, x10 kPa (/100 = MPa)
//   io50 - barometric pressure, kPa

const useStyles = makeStyles()((theme) => ({
  card: {
    position: 'fixed',
    zIndex: 4,
    right: theme.spacing(1.5),
    bottom: theme.spacing(3),
    width: theme.dimensions.drawerWidthDesktop,
    padding: theme.spacing(1, 1.5, 1.5),
    [theme.breakpoints.down('md')]: {
      left: 0,
      right: 0,
      // Sit on top of the bottom navigation bar, the same offset StatusCard
      // and CollectionFab use. The bar owns the safe-area inset below it.
      bottom: `${theme.dimensions.bottomBarHeight}px`,
      width: 'auto',
      margin: 0,
      borderRadius: 0,
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dials: {
    display: 'flex',
    justifyContent: 'space-around',
  },
  sparks: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(1),
  },
  sparkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  sparkLabel: {
    width: 64,
    flexShrink: 0,
  },
  sparkValue: {
    width: 48,
    flexShrink: 0,
    textAlign: 'right',
  },
  sparkSvg: {
    flexGrow: 1,
    display: 'block',
  },
  tiles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(1),
  },
  tile: {
    textAlign: 'center',
  },
}));

// Arc from -120deg to +120deg (240deg sweep), the usual instrument shape.
const arcPath = (cx, cy, r, fromDeg, toDeg) => {
  const rad = (deg) => ((deg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(fromDeg));
  const y1 = cy + r * Math.sin(rad(fromDeg));
  const x2 = cx + r * Math.cos(rad(toDeg));
  const y2 = cy + r * Math.sin(rad(toDeg));
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
};

const Dial = ({ label, value, unit, max, warn, trackColor, valueColor, warnColor, textColor }) => {
  const missing = value == null;
  const fraction = missing ? 0 : Math.min(Math.max(value / max, 0), 1);
  const angle = -120 + fraction * 240;
  const hot = !missing && warn != null && value >= warn;
  return (
    <svg width="72" height="60" viewBox="0 0 72 60">
      <path
        d={arcPath(36, 32, 26, -120, 120)}
        fill="none"
        stroke={trackColor}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {!missing && fraction > 0 && (
        <path
          d={arcPath(36, 32, 26, -120, angle)}
          fill="none"
          stroke={hot ? warnColor : valueColor}
          strokeWidth="5"
          strokeLinecap="round"
        />
      )}
      <text x="36" y="32" textAnchor="middle" fontSize="13" fontWeight="bold" fill={textColor}>
        {missing ? '—' : Math.round(value)}
      </text>
      <text x="36" y="43" textAnchor="middle" fontSize="8" fill={textColor} opacity="0.7">
        {unit}
      </text>
      <text x="36" y="57" textAnchor="middle" fontSize="9" fill={textColor} opacity="0.7">
        {label}
      </text>
    </svg>
  );
};

const Sparkline = ({ values, index, color, cursorColor }) => {
  // Ignition-off gaps arrive as nulls; the polyline simply breaks there,
  // which reads correctly as "engine off".
  const points = useMemo(() => {
    const finite = values.filter((v) => v != null);
    if (!finite.length) {
      return [];
    }
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const span = max - min || 1;
    const last = values.length - 1 || 1;
    return values.map((v, i) =>
      v == null
        ? null
        : `${((i / last) * 100).toFixed(2)},${(20 - ((v - min) / span) * 16).toFixed(2)}`,
    );
  }, [values]);
  const segments = useMemo(() => {
    const result = [];
    let current = [];
    points.forEach((p) => {
      if (p == null) {
        if (current.length) {
          result.push(current);
        }
        current = [];
      } else {
        current.push(p);
      }
    });
    if (current.length) {
      result.push(current);
    }
    return result;
  }, [points]);
  const cursorX = (index / (values.length - 1 || 1)) * 100;
  return (
    <svg viewBox="0 0 100 22" preserveAspectRatio="none" height="22" style={{ width: '100%' }}>
      {segments.map((segment) => (
        <polyline
          key={segment[0]}
          points={segment.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <line
        x1={cursorX}
        y1="0"
        x2={cursorX}
        y2="22"
        stroke={cursorColor}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

const formatRuntime = (seconds) => {
  if (seconds == null) {
    return '—';
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
};

const ReplayObdCard = ({ positions, index }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  // Phones get the dials-only strip by default - expanded, the card would
  // cover half the map. Desktop has the room, so it opens fully.
  const [expanded, setExpanded] = useState(desktop);

  const hasObd = useMemo(() => positions.some((p) => p.attributes.rpm != null), [positions]);

  const series = useMemo(
    () => ({
      rpm: positions.map((p) => p.attributes.rpm ?? null),
      coolant: positions.map((p) => p.attributes.coolantTemp ?? null),
      rail: positions.map((p) => (p.attributes.io45 != null ? p.attributes.io45 / 100 : null)),
    }),
    [positions],
  );

  const rpmMax = useMemo(() => {
    const finite = series.rpm.filter((v) => v != null);
    return Math.max(1000, Math.ceil(Math.max(0, ...finite) / 1000) * 1000);
  }, [series]);

  if (!hasObd || index >= positions.length) {
    return null;
  }

  const attributes = positions[index].attributes;
  const trackColor =
    theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[300];
  const textColor = theme.palette.text.primary;
  const faults = attributes.faultCount;

  return (
    <Paper elevation={3} className={classes.card}>
      <div className={classes.header}>
        <Typography variant="caption" color="textSecondary">
          OBD
        </Typography>
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
        </IconButton>
      </div>
      <div className={classes.dials}>
        <Dial
          label="RPM"
          value={attributes.rpm}
          unit={`/ ${rpmMax}`}
          max={rpmMax}
          warn={rpmMax * 0.85}
          trackColor={trackColor}
          valueColor={theme.palette.primary.main}
          warnColor={theme.palette.error.main}
          textColor={textColor}
        />
        <Dial
          label="Coolant"
          value={attributes.coolantTemp}
          unit="°C"
          max={130}
          warn={105}
          trackColor={trackColor}
          valueColor={theme.palette.primary.main}
          warnColor={theme.palette.error.main}
          textColor={textColor}
        />
        <Dial
          label="Load"
          value={attributes.engineLoad}
          unit="%"
          max={100}
          trackColor={trackColor}
          valueColor={theme.palette.primary.main}
          warnColor={theme.palette.error.main}
          textColor={textColor}
        />
        <Dial
          label="Speed"
          value={attributes.io37}
          unit="km/h"
          max={160}
          trackColor={trackColor}
          valueColor={theme.palette.primary.main}
          warnColor={theme.palette.error.main}
          textColor={textColor}
        />
      </div>
      {expanded && (
        <>
          <div className={classes.sparks}>
            {[
              ['RPM', series.rpm, attributes.rpm],
              ['Coolant', series.coolant, attributes.coolantTemp],
              [
                'Rail MPa',
                series.rail,
                attributes.io45 != null ? Math.round(attributes.io45 / 100) : null,
              ],
            ].map(([label, values, current]) => (
              <div key={label} className={classes.sparkRow}>
                <Typography variant="caption" color="textSecondary" className={classes.sparkLabel}>
                  {label}
                </Typography>
                <Sparkline
                  values={values}
                  index={index}
                  color={theme.palette.primary.main}
                  cursorColor={theme.palette.error.main}
                />
                <Typography variant="caption" className={classes.sparkValue}>
                  {current != null ? current : '—'}
                </Typography>
              </div>
            ))}
          </div>
          <div className={classes.tiles}>
            {[
              ['Runtime', formatRuntime(attributes.io42)],
              ['Baro', attributes.io50 != null ? `${attributes.io50} kPa` : '—'],
              ['Power', attributes.power != null ? `${attributes.power.toFixed(1)} V` : '—'],
              ['Faults', faults != null ? String(faults) : '—'],
            ].map(([label, value]) => (
              <div key={label} className={classes.tile}>
                <Typography
                  variant="body2"
                  color={label === 'Faults' && faults > 0 ? 'error' : 'textPrimary'}
                >
                  {value}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {label}
                </Typography>
              </div>
            ))}
          </div>
        </>
      )}
    </Paper>
  );
};

export default ReplayObdCard;
