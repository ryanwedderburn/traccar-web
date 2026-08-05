import { Button, Typography } from '@mui/material';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';

/**
 * Shown in place of the device list when Favourites is selected and nothing is
 * starred yet.
 *
 * Only reachable in kiosk mode, where Favourites is the landing tab and is
 * deliberately not disabled when empty. Outside kiosk the tab disables itself
 * instead, so this never renders there.
 *
 * It exists because the alternative is a blank white panel, which reads as a
 * failed load rather than as a starting point. The button is the whole point of
 * the component: the next thing to do is go to All and find a rider, so say so
 * and take them there.
 */

const useStyles = makeStyles()((theme) => ({
  root: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(4, 3),
    textAlign: 'center',
  },
  icon: {
    fontSize: 40,
    color: theme.palette.neutral.main,
  },
}));

const DeviceListEmpty = ({ onBrowse }) => {
  const { classes } = useStyles();
  const t = useTranslation();

  return (
    <div className={classes.root}>
      <StarBorderIcon className={classes.icon} />
      <Typography variant="subtitle1">
        {t('deviceFavouritesEmpty') || 'No favourites yet'}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        {t('deviceFavouritesEmptyHint') ||
          'Search the full list by number or name, then tap the star to follow a rider here.'}
      </Typography>
      <Button size="small" onClick={onBrowse}>
        {t('deviceFavouritesEmptyAction') || 'Browse all'}
      </Button>
    </div>
  );
};

export default DeviceListEmpty;
