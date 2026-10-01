import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Paper, IconButton, Typography, Badge, Alert, Button } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CloseIcon from '@mui/icons-material/Close';
import FlagIcon from '@mui/icons-material/Flag';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { devicesActions } from '../store';
import { map } from '../map/core/MapView';
import usePersistedState from '../common/util/usePersistedState';

/*
 * "Who is still out" beside the live map, for race ops. Ryan, 2026-10-01:
 * "having this visible next to map, with ability to quickly click on locate
 * rider on map would be ideal".
 *
 * THE BOARD IS race-ops.html, IN AN IFRAME, not a React copy of it. One board,
 * hot on `git pull`, tested by scripts/test-race-ops.mjs; the pane only hosts
 * it. The two talk by postMessage, same origin only:
 *   board -> map  {type: 'wlab:locate', deviceId}   select the rider here
 *   board -> map  {type: 'wlab:raceops', out, quiet} counts for the tab
 *
 * Desktop only - on a phone the map IS the screen and the board has its own
 * page. The map is padded on the right while the pane is open, so a located
 * rider lands in the visible part of the map rather than under the pane.
 */
const WIDTH = 460;

/* Three short tones. May be silent until the page has had a click - browsers
   block audio before any interaction - which on a race-control screen it has. */
const beep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((at) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + at);
      gain.gain.setValueAtTime(0, ctx.currentTime + at + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.22);
    });
  } catch {
    // no audio: the banner and the open pane still carry the alarm
  }
};

const useStyles = makeStyles()((theme) => ({
  pane: {
    position: 'fixed',
    top: theme.spacing(1.5),
    right: theme.spacing(1.5),
    bottom: theme.spacing(1.5),
    width: WIDTH,
    zIndex: 5,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0.5, 0.5, 1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  frame: {
    flex: 1,
    border: 0,
    width: '100%',
  },
  tab: {
    position: 'fixed',
    right: 0,
    top: '40%',
    zIndex: 5,
    writingMode: 'vertical-rl',
    padding: theme.spacing(1.5, 0.75),
    borderRadius: `${theme.shape.borderRadius}px 0 0 ${theme.shape.borderRadius}px`,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    userSelect: 'none',
  },
}));

const RaceOpsPane = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const frameRef = useRef(null);
  const [open, setOpen] = usePersistedState('raceOpsPane', false);
  const [counts, setCounts] = useState(null);
  const [alarms, setAlarms] = useState(0);
  const [latest, setLatest] = useState('');
  const seenRef = useRef(null);

  useEffect(() => {
    const onMessage = (event) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frameRef.current?.contentWindow
      ) {
        return;
      }
      const {
        type,
        deviceId,
        out,
        quiet,
        open: openAlarms,
        keys,
        latest: newest,
      } = event.data || {};
      if (type === 'wlab:locate' && Number.isFinite(deviceId)) {
        dispatch(devicesActions.selectId(deviceId));
      } else if (type === 'wlab:raceops') {
        setCounts({ out, quiet });
      } else if (type === 'wlab:alarms') {
        setAlarms(Number(openAlarms) || 0);
        setLatest(newest || '');
        /* A press not seen before - a new incident or another press on an open
           one - opens the pane and sounds, so an SOS cannot sit unnoticed behind
           a closed tab. The first report after loading only records what is
           already open: reloading the map must not replay old alarms. */
        const current = new Set(keys || []);
        if (seenRef.current && [...current].some((k) => !seenRef.current.has(k))) {
          setOpen(true);
          beep();
        }
        seenRef.current = current;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [dispatch, setOpen]);

  useEffect(() => {
    map.setPadding({ top: 0, bottom: 0, left: 0, right: open ? WIDTH : 0 });
    return () => map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
  }, [open]);

  /* The board keeps running while the pane is closed - the iframe stays
     mounted, hidden - so an SOS still turns the tab red. */
  const tab = !open && (
    <Paper
      className={classes.tab}
      elevation={3}
      onClick={() => setOpen(true)}
      sx={alarms ? { bgcolor: 'error.main', color: 'error.contrastText' } : undefined}
    >
      <Badge
        color={alarms ? 'warning' : 'error'}
        badgeContent={alarms || counts?.out || 0}
        invisible={!alarms && !counts?.out}
      >
        <FlagIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
      </Badge>
      <Typography variant="body2" fontWeight={600}>
        {alarms ? `SOS · ${alarms} to action` : 'Race Operations'}
      </Typography>
    </Paper>
  );
  return (
    <>
      {tab}
      {!open && alarms > 0 && (
        <Alert
          severity="error"
          variant="filled"
          sx={{
            position: 'fixed',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 6,
            maxWidth: 'calc(100% - 24px)',
          }}
          action={
            <Button color="inherit" size="small" onClick={() => setOpen(true)}>
              Open
            </Button>
          }
        >
          {alarms > 1 ? `${alarms} SOS to action · ` : 'SOS to action · '}
          {latest || 'open the pane for details'}
        </Alert>
      )}
      <Paper className={classes.pane} elevation={3} style={open ? undefined : { display: 'none' }}>
        <div className={classes.bar}>
          <Typography variant="subtitle2" sx={{ flex: 1 }} color={alarms ? 'error' : undefined}>
            {alarms ? `SOS · ${alarms} to action · ` : ''}
            Race Operations
            {counts ? ` · ${counts.out} out${counts.quiet ? `, ${counts.quiet} quiet` : ''}` : ''}
          </Typography>
          <IconButton size="small" title="Open as a page" href="/race-ops.html" target="_blank">
            <OpenInNewIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" title="Hide" onClick={() => setOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <iframe
          ref={frameRef}
          className={classes.frame}
          title="Race Operations"
          src="/race-ops.html?embed"
          allow="clipboard-write"
        />
      </Paper>
    </>
  );
};

export default RaceOpsPane;
