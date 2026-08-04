import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';

/**
 * Sits between the search toolbar and the first device row.
 *
 * Favourites is disabled while nothing is starred, so the tab can never be an
 * empty panel with no explanation.
 */

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(1, 1.5, 0),
    flexShrink: 0,
  },
  group: {
    width: '100%',
  },
  button: {
    flex: 1,
    gap: theme.spacing(0.5),
    minWidth: 0,
    padding: theme.spacing(0.5, 1),
    textTransform: 'none',
    whiteSpace: 'nowrap',
  },
}));

const DeviceListControls = ({ mode, setMode, totalCount, favouriteCount }) => {
  const { classes } = useStyles();
  const t = useTranslation();

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
        <ToggleButton className={classes.button} value="all">
          {`${t('sharedAll') || 'All'} (${totalCount})`}
        </ToggleButton>
        <ToggleButton className={classes.button} value="favourites" disabled={!favouriteCount}>
          <StarIcon fontSize="small" />
          {`${t('sharedFavourites') || 'Favourites'} (${favouriteCount})`}
        </ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
};

export default DeviceListControls;
