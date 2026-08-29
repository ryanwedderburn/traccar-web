import { useEffect, useMemo, useState } from 'react';
import {
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import NearMeIcon from '@mui/icons-material/NearMe';
import SearchIcon from '@mui/icons-material/Search';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from './LocalizationProvider';
import useWaypoints, { mapsDirectionsUrl, waypointLabel } from '../util/waypoints';

/**
 * The list behind the POI button on the bottom bar. One tap per point, and the
 * tap leaves for Google Maps.
 *
 * A dialog rather than a route: the map keeps its state and its selected rider,
 * and the Map tab stays highlighted underneath.
 *
 * Each row is a real anchor rather than a `window.open`. The Traccar Manager
 * wrapper is an InAppWebView, and a tapped `<a>` goes through its navigation
 * delegate where a scripted open may not - the same lesson the rider setup page
 * taught with deep links.
 */

const useStyles = makeStyles()((theme) => ({
  content: {
    padding: 0,
  },
  row: {
    gap: theme.spacing(1),
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(0.5),
  },
  icon: {
    color: theme.palette.primary.main,
    flexShrink: 0,
  },
  empty: {
    padding: theme.spacing(2, 3),
  },
  filters: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(0, 3, 2),
  },
}));

/*
 * Below this many points the controls are hidden entirely.
 *
 * Ryan, 2026-08-29: "When short it's fine. When long we'll need a filter." A
 * search box above five rows is clutter that makes the common case worse to
 * serve the rare one. Eight is roughly a phone screen: at that length you are
 * still reading the whole list, past it you are hunting.
 */
const FILTER_FROM = 8;

const WaypointsDialog = ({ open, onClose, routeFilter }) => {
  const { classes } = useStyles();
  const t = useTranslation();

  const waypoints = useWaypoints(routeFilter);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');

  /*
   * Reset when the dialog opens, never on close.
   *
   * Clearing on close animates the list back to full length while it is fading
   * out, which reads as the filter having been undone by the tap that left. And
   * a dialog that reopens still filtered to something chosen minutes ago looks
   * like an empty POI list - the failure this whole screen exists to avoid.
   */
  useEffect(() => {
    if (open) {
      setQuery('');
      setType('');
    }
  }, [open]);

  /*
   * The types actually present, in the order useWaypoints already sorted them
   * (TYPE_RANK, so DSP and the start/finish come before the long tail). Derived
   * rather than listed: a chip for a type nothing carries is a dead end, and
   * the set differs per event.
   */
  const types = useMemo(() => {
    const seen = [];
    waypoints.forEach((w) => {
      if (w.type && !seen.includes(w.type)) seen.push(w.type);
    });
    return seen;
  }, [waypoints]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return waypoints.filter(
      (w) => (!type || w.type === type) && (!needle || w.name.toLowerCase().includes(needle)),
    );
  }, [waypoints, query, type]);

  const filtering = waypoints.length >= FILTER_FROM;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('sharedNavigateTo') || 'Navigate to'}</DialogTitle>
      {filtering && (
        <div className={classes.filters}>
          <TextField
            size="small"
            fullWidth
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('sharedSearch') || 'Search'}
            slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" color="disabled" /> } }}
          />
          <div className={classes.chips}>
            {/*
              Tapping the selected chip clears it, so the way out is the same
              gesture as the way in. On a phone there is no room for a separate
              "All" control and nowhere obvious to put it.
            */}
            {types.map((key) => (
              <Chip
                key={key}
                size="small"
                label={waypointLabel(key)}
                color={type === key ? 'primary' : 'default'}
                variant={type === key ? 'filled' : 'outlined'}
                onClick={() => setType(type === key ? '' : key)}
              />
            ))}
          </div>
          <Typography variant="caption" color="textSecondary">
            {shown.length === waypoints.length
              ? `${waypoints.length} points`
              : `${shown.length} of ${waypoints.length}`}
          </Typography>
        </div>
      )}
      <DialogContent className={classes.content} dividers>
        {shown.length ? (
          <List disablePadding>
            {shown.map((waypoint) => (
              <ListItemButton
                key={waypoint.id}
                className={classes.row}
                component="a"
                href={mapsDirectionsUrl(waypoint.centre.latitude, waypoint.centre.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
              >
                <ListItemText
                  primary={waypoint.name}
                  secondary={
                    (waypoint.type || waypoint.classes.length) && (
                      <span className={classes.chips}>
                        {waypoint.type && (
                          <Chip size="small" label={waypointLabel(waypoint.type)} />
                        )}
                        {/*
                          Classes are shown, never filtered on. An untagged
                          point serves everyone, so a tag only appears where
                          someone deliberately set one - which is exactly the
                          spectator point crossed by a single class.
                        */}
                        {waypoint.classes.map((name) => (
                          <Chip key={name} size="small" variant="outlined" label={name} />
                        ))}
                      </span>
                    )
                  }
                  slotProps={{ secondary: { component: 'span' } }}
                />
                <NearMeIcon className={classes.icon} fontSize="small" />
              </ListItemButton>
            ))}
          </List>
        ) : (
          <Typography className={classes.empty} color="textSecondary" variant="body2">
            {/*
              Two different emptinesses. "Nothing matches" is a filter the user
              set and can undo; "no points yet" is a provisioning state they
              cannot. Saying the second when the first is true sends someone
              looking for a fault that does not exist.
            */}
            {waypoints.length
              ? (t('sharedNoMatches') || 'Nothing matches that filter.')
              : (t('sharedNoPoints') || 'No points for this event yet.')}
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WaypointsDialog;
