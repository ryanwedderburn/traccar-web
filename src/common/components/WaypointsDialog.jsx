import {
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import NearMeIcon from '@mui/icons-material/NearMe';
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
}));

const WaypointsDialog = ({ open, onClose, routeFilter }) => {
  const { classes } = useStyles();
  const t = useTranslation();

  const waypoints = useWaypoints(routeFilter);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('sharedNavigateTo') || 'Navigate to'}</DialogTitle>
      <DialogContent className={classes.content} dividers>
        {waypoints.length ? (
          <List disablePadding>
            {waypoints.map((waypoint) => (
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
            {t('sharedNoPoints') || 'No points for this event yet.'}
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WaypointsDialog;
