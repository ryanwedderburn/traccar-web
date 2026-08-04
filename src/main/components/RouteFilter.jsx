import { FormControl, MenuItem, Select, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import useRouteFilter from '../../common/util/useRouteFilter';

/**
 * Event, day and class filtering for the routes and points on the map.
 *
 * Renders nothing until the data carries events, so an install that has never
 * run one is unaffected.
 *
 * Deliberately not a saved-views feature: the dimensions are few even though
 * the combinations are endless, so each is a control and the state persists
 * per browser - whatever combination you leave it in is your preset.
 */

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5, 0),
    flexShrink: 0,
  },
  select: {
    flex: 1,
    minWidth: 110,
  },
  classes: {
    flexBasis: '100%',
    flexWrap: 'wrap',
  },
  class: {
    flex: 1,
    minWidth: 0,
    padding: theme.spacing(0.25, 1),
    textTransform: 'capitalize',
  },
}));

const RouteFilter = ({ filter, setFilter }) => {
  const { classes: styles } = useStyles();
  const { events, classes, days } = useRouteFilter(filter);

  if (!events.length) {
    return null;
  }

  const update = (changes) => setFilter({ ...filter, ...changes });

  return (
    <div className={styles.root}>
      {/*
        Hidden when there is only one event to choose from - a spectator
        granted a single event should not be asked which one.

        No InputLabel anywhere here: with displayEmpty the outline is not
        notched for the floating label, so the two overlap. Prefixing the value
        says the same thing in less vertical space, which matters on a phone.
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
  );
};

export default RouteFilter;
