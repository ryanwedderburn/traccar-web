import { IconButton, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';

/**
 * Sits between the search toolbar and the first device row.
 *
 * Outside kiosk mode Favourites is disabled while nothing is starred, so the
 * tab can never be an empty panel with no explanation.
 *
 * In kiosk mode the order reverses and Favourites leads, enabled even when
 * empty. A spectator at an event with several hundred entrants opening onto
 * All gets every rider plotted at once, which is unreadable and is not what
 * they came for. Starting on an empty Favourites tab means the map starts
 * blank and the first star they add is the first pin they see. DeviceListEmpty
 * covers the blank panel this creates, which is why the disable is safe to
 * drop here.
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
    padding: theme.spacing(1, 1.5, 0),
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
      disabled={!kiosk && !favouriteCount}
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
