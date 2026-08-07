import { IconButton, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';

/**
 * Sits between the search toolbar and the first device row.
 *
 * Favourites is disabled while nothing is starred, so the tab can never be an
 * empty panel - and more to the point, so the search box always has something
 * to search.
 *
 * In kiosk mode the order reverses and Favourites leads, because that is where
 * a spectator ends up once they have starred someone. Until then MainPage
 * falls back to All, and the map stays empty regardless because the map filter
 * is independent of which tab is showing.
 *
 * The filter icon only appears on All, and restricts the *map* to favourites
 * while leaving the list complete. That is the point: with several hundred
 * entrants you want to scroll and search the whole field to star the ones you
 * care about, without the map turning into a wall of pins. On Favourites the
 * list is already the watch list, so the control would have nothing to do.
 */

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    // Bottom padding matters now that this sits in the header rather than in
    // the list panel: the first device row begins immediately below it, and
    // react-window's container has no margin of its own. It carries the full
    // 12px on its own for that reason, where the rows above split it between
    // neighbours.
    padding: theme.spacing(0.75, 1.5, 1.5),
    flexShrink: 0,
  },
  group: {
    flex: 1,
    minWidth: 0,
  },
  button: {
    flex: 1,
    gap: theme.spacing(0.5),
    minWidth: 0,
    padding: theme.spacing(0.5, 1),
    textTransform: 'none',
    whiteSpace: 'nowrap',
  },
  mapFilter: {
    flexShrink: 0,
  },
  mapFilterOn: {
    color: theme.palette.primary.main,
  },
}));

const DeviceListControls = ({
  mode,
  setMode,
  totalCount,
  favouriteCount,
  mapFavouritesOnly,
  setMapFavouritesOnly,
  kiosk,
}) => {
  const { classes } = useStyles();
  const t = useTranslation();

  const mapFilterLabel = t('sharedFilterMap') || 'Filter on Map';

  const allButton = (
    <ToggleButton key="all" className={classes.button} value="all">
      {`${t('sharedAll') || 'All'} (${totalCount})`}
    </ToggleButton>
  );

  const favouritesButton = (
    <ToggleButton
      key="favourites"
      className={classes.button}
      value="favourites"
      disabled={!favouriteCount}
    >
      <StarIcon fontSize="small" />
      {`${t('sharedFavourites') || 'Favourites'} (${favouriteCount})`}
    </ToggleButton>
  );

  return (
    <div className={classes.root}>
      <ToggleButtonGroup
        className={classes.group}
        size="small"
        exclusive
        value={mode}
        onChange={(event, value) => {
          if (value !== null) {
            setMode(value);
          }
        }}
      >
        {kiosk ? [favouritesButton, allButton] : [allButton, favouritesButton]}
      </ToggleButtonGroup>
      {mode === 'all' && (
        <Tooltip title={mapFilterLabel}>
          <span>
            <IconButton
              className={classes.mapFilter}
              size="small"
              disabled={!favouriteCount}
              aria-label={mapFilterLabel}
              aria-pressed={mapFavouritesOnly}
              onClick={() => setMapFavouritesOnly(!mapFavouritesOnly)}
            >
              {mapFavouritesOnly ? (
                <FilterAltIcon fontSize="small" className={classes.mapFilterOn} />
              ) : (
                <FilterAltOffIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>
      )}
    </div>
  );
};

export default DeviceListControls;
