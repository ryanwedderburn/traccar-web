import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Paper, IconButton, Typography, Badge } from '@mui/material';
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

  useEffect(() => {
    const onMessage = (event) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frameRef.current?.contentWindow
      ) {
        return;
      }
      const { type, deviceId, out, quiet } = event.data || {};
      if (type === 'wlab:locate' && Number.isFinite(deviceId)) {
        dispatch(devicesActions.selectId(deviceId));
      } else if (type === 'wlab:raceops') {
        setCounts({ out, quiet });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [dispatch]);

  useEffect(() => {
    map.setPadding({ top: 0, bottom: 0, left: 0, right: open ? WIDTH : 0 });
    return () => map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
  }, [open]);

  if (!open) {
    return (
      <Paper className={classes.tab} elevation={3} onClick={() => setOpen(true)}>
        <Badge color="error" badgeContent={counts?.out || 0} invisible={!counts?.out}>
          <FlagIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
        </Badge>
        <Typography variant="body2" fontWeight={600}>
          Who is still out
        </Typography>
      </Paper>
    );
  }
  return (
    <Paper className={classes.pane} elevation={3}>
      <div className={classes.bar}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Who is still out
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
        title="Who is still out"
        src="/race-ops.html?embed"
      />
    </Paper>
  );
};

export default RaceOpsPane;
