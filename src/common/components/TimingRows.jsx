import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { TableCell, TableRow, Typography, useMediaQuery, useTheme } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import usePersistedState from '../util/usePersistedState';

/**
 * The timekeeper's line for this rider, under the card's GPS rows.
 *
 * OURS (docs/TIMING-INTEGRATION.md). RACE RESULT's live list, read by the
 * server for race control. OPERATORS ONLY - Ryan, 2026-10-11: "we do not own or
 * display the timing data". A read-only account (every rider, the /live kiosk)
 * never asks, and the server refuses it if it does.
 *
 * Shown only when the event switched timing on for the card and this device's
 * race number has a row. Every value is as the list states it, labelled with
 * its source and its age; nothing is worked out here. If RACE RESULT is down
 * the block says so and the GPS rows carry on.
 *
 * Collapsed by default on a phone, where the card is already tall.
 */

const REFRESH_MS = 30000;

/** The event group above a device: the top of its group chain. */
const eventGroupOf = (device, groups) => {
  let group = device ? groups[device.groupId] : null;
  let guard = 0;
  while (group && group.groupId && groups[group.groupId] && guard < 10) {
    group = groups[group.groupId];
    guard += 1;
  }
  return group && !group.groupId ? group.id : null;
};

const clockIn = (iso, timeZone) => {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    });
  } catch {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
};

const updated = (iso, timeZone) => {
  if (!iso) {
    return 'not read yet';
  }
  const there = clockIn(iso, timeZone);
  const here = clockIn(iso);
  const place = String(timeZone || '')
    .split('/')
    .pop()
    .replace(/_/g, ' ');
  return there === here ? `updated ${here}` : `updated ${there} ${place} (${here} here)`;
};

const TimingRows = ({ deviceId, Row }) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('md'));
  const user = useSelector((state) => state.session.user);
  const device = useSelector((state) => state.devices.items[deviceId]);
  const groups = useSelector((state) => state.groups.items);
  const [open, setOpen] = usePersistedState('timingCardOpen', null);
  const [timing, setTiming] = useState(null);

  const operator = user && (user.administrator || !user.readonly);
  const groupId = eventGroupOf(device, groups);

  useEffect(() => {
    setTiming(null);
    if (!operator || !groupId || !deviceId) {
      return undefined;
    }
    const controller = new AbortController();
    const load = () => {
      fetch(`/api/timing?groupId=${groupId}&deviceId=${deviceId}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => setTiming(data))
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [operator, groupId, deviceId]);

  if (!timing || !timing.enabled || !(timing.show || []).includes('card')) {
    return null;
  }
  const rider = (timing.riders || [])[0];
  if (!rider && !timing.error) {
    return null;
  }
  const expanded = open == null ? !phone : open;
  const source =
    `${timing.replay ? 'REPLAY · ' : ''}RACE RESULT · ${updated(timing.fetchedAt, timing.timezone)}` +
    `${timing.stale ? ' · not current' : ''}`;

  const rows = [];
  if (rider) {
    [
      ['Position', rider.rank],
      ['Race time', rider.time],
      ['Gap', rider.gap],
      ['Last CP', rider.lastCp],
      ['Status', rider.status],
    ].forEach(([name, value]) => {
      if (value) {
        rows.push(<Row key={name} name={name} content={value} />);
      }
    });
    (rider.extra || []).forEach((pair) => {
      rows.push(<Row key={`x-${pair.label}`} name={pair.label} content={pair.value} />);
    });
  }

  return (
    <>
      <TableRow hover style={{ cursor: 'pointer' }} onClick={() => setOpen(!expanded)}>
        <TableCell colSpan={2} style={{ borderBottom: 'none', paddingLeft: 0, paddingRight: 0 }}>
          <Typography variant="body2" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            {`Timing${rider && rider.rank ? ` · ${rider.rank}` : ''}${rider && rider.time ? ` · ${rider.time}` : ''}`}
          </Typography>
        </TableCell>
      </TableRow>
      {expanded && rows}
      {expanded && (
        <TableRow>
          <TableCell colSpan={2} style={{ paddingLeft: 0, paddingRight: 0 }}>
            <Typography variant="caption" color="textSecondary">
              {timing.error && !rider ? `RACE RESULT unavailable: ${timing.error}` : source}
            </Typography>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default TimingRows;
