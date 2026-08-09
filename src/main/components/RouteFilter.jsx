import { useMemo } from 'react';
import {
  Collapse,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import RouteIcon from '@mui/icons-material/Route';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { makeStyles } from 'tss-react/mui';
import useRouteFilter from '../../common/util/useRouteFilter';
import usePersistedState from '../../common/util/usePersistedState';

/**
 * Event, day and class filtering for the routes and points on the map.
 *
 * Renders nothing until the data carries events, so an install that has never
 * run one is unaffected.
 *
 * Deliberately not a saved-views feature: the dimensions are few even though
 * the combinations are endless, so each is a control and the state persists
 * per browser - whatever combination you leave it in is your preset.
 *
 * COLLAPSIBLE, AND NAMED. Two unlabelled rows of selects and toggle buttons at
 * the top of a phone say nothing about what they act on, and a spectator reads
 * them as more device filtering - the search box is directly below them. So the
 * block leads with a row that says what it is and what is currently applied,
 * and the controls themselves fold away behind it.
 *
 * Collapsed by default, which is a different thing from the route controls
 * being hidden on a phone - that was tried, and spectators never found them,
 * because there was nothing on screen to find. Here the row is always present,
 * always says "Tracks on map", and always shows the selection in force. The
 * state persists, so anyone who wants the controls open keeps them open.
 */

const useStyles = makeStyles()((theme) => ({
  root: {
    // 12px everywhere: the gap between the rows inside this block, the gap to
    // the search row below, and the margin to the screen edge. One rhythm for
    // the whole header.
    padding: theme.spacing(0.75, 1.5),
    flexShrink: 0,
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    cursor: 'pointer',
    minWidth: 0,
  },
  icon: {
    color: theme.palette.text.secondary,
    flexShrink: 0,
  },
  label: {
    flexShrink: 0,
  },
  // The selection in force, so a collapsed block is still informative. Ellipsis
  // rather than wrap: this row must never grow, or collapsing has bought
  // nothing back.
  value: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: theme.palette.text.secondary,
  },
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    paddingTop: theme.spacing(1.5),
  },
  select: {
    flex: 1,
    minWidth: 110,
  },
  classes: {
    flexBasis: '100%',
    flexWrap: 'wrap',
  },
  // Selected classes carry the account's brand colour rather than MUI's grey
  // "selected" wash. On a phone in daylight the default is barely a state
  // change at all, and which classes are showing is the single most consequential
  // thing this header says.
  class: {
    flex: 1,
    minWidth: 0,
    padding: theme.spacing(0.25, 1),
    textTransform: 'capitalize',
    '&.Mui-selected': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
  },
}));

const RouteFilter = ({ filter, setFilter }) => {
  const { classes: styles } = useStyles();
  const { events, classes, days } = useRouteFilter(filter);

  const [open, setOpen] = usePersistedState('routeFilterOpen', false);

  // Reads back what is applied, in the order the controls appear. "All tracks"
  // rather than an empty string when nothing is set - a blank value looks like
  // a control that failed to load.
  const summary = useMemo(() => {
    const parts = [];
    if (events.length > 1 && filter.event) {
      parts.push(filter.event);
    }
    parts.push(`Day ${filter.day || 'all'}`);
    if (filter.classes?.length) {
      parts.push(filter.classes.join(', '));
    }
    return parts.join(' · ');
  }, [events.length, filter.event, filter.day, filter.classes]);

  if (!events.length) {
    return null;
  }

  const update = (changes) => setFilter({ ...filter, ...changes });

  return (
    <div className={styles.root}>
      <div
        className={styles.summary}
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <RouteIcon className={styles.icon} fontSize="small" />
        <Typography className={styles.label} variant="body2">
          Tracks on map
        </Typography>
        <Typography className={styles.value} variant="body2">
          {summary}
        </Typography>
        <IconButton className={styles.icon} size="small" tabIndex={-1} aria-hidden>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </div>

      <Collapse in={open} unmountOnExit>
        <div className={styles.controls}>
          {/*
            Hidden when there is only one event to choose from - a spectator
            granted a single event should not be asked which one.

            No InputLabel anywhere here: with displayEmpty the outline is not
            notched for the floating label, so the two overlap. Prefixing the
            value says the same thing in less vertical space, which matters on
            a phone.
          */}
          {events.length > 1 && (
            <FormControl className={styles.select} size="small">
              <Select
                value={filter.event || ''}
                // Changing event invalidates the class and day chosen under the
                // previous one - Senqu's "lite" does not exist at ROA.
                onChange={(e) => update({ event: e.target.value || null, classes: [], day: null })}
                renderValue={(value) => `Event: ${value || 'All'}`}
                displayEmpty
              >
                <MenuItem value="">All</MenuItem>
                {events.map((event) => (
                  <MenuItem key={event} value={event}>
                    {event}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {days.length > 0 && (
            <FormControl className={styles.select} size="small">
              <Select
                value={filter.day || ''}
                onChange={(e) => update({ day: e.target.value || null })}
                renderValue={(value) => `Day: ${value || 'All'}`}
                displayEmpty
              >
                <MenuItem value="">All</MenuItem>
                {days.map((day) => (
                  <MenuItem key={day} value={day}>
                    {day}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {classes.length > 0 && (
            <ToggleButtonGroup
              className={styles.classes}
              size="small"
              value={filter.classes || []}
              onChange={(event, value) => update({ classes: value })}
            >
              {classes.map((name) => (
                <ToggleButton key={name} className={styles.class} value={name}>
                  {name}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </div>
      </Collapse>
    </div>
  );
};

export default RouteFilter;
