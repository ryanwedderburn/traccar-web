import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';

import { useTranslation } from './LocalizationProvider';
import useSponsors from '../util/useSponsors';

/**
 * The event's partners, opened from the bottom bar.
 *
 * OURS, not upstream. Sibling of WaypointsDialog and built the same way, so it
 * looks like the rest of the event chrome rather than like an advert bolted on.
 *
 * <p><b>Why a sheet rather than more logos on the map.</b> ROA asked for a
 * sponsor logo floating on the tracking map. Ryan's rule settled it: "it should
 * never inhibit the actual purpose which is actually tracking", and then "we
 * keep map totally clean". The map carries nothing; the bottom bar carries the
 * title sponsor's mark as its icon, and this is what that icon opens.
 *
 * <p><b>It is also the only surface with room.</b> The 2026 partner board runs
 * to roughly eighteen marks. The login page shows the title sponsor and no
 * others, because one non-wrapping row inside 80-90px is all an iPhone 12 mini
 * has. Everybody else is here.
 *
 * <p><b>Order is the config's, not ours.</b> The list renders in the order the
 * `sponsors` attribute declares, with the title sponsor lifted to the top. That
 * makes priority an operator decision, which is what it should be - sponsorship
 * tiers are sold, not computed.
 */
const useStyles = makeStyles()((theme) => ({
  content: {
    padding: theme.spacing(0, 1),
  },
  row: {
    gap: theme.spacing(2),
  },
  /* Contained in a chip rather than floating. On a dark sheet a transparent
     logo has no edge, and eighteen of them in a column read as clutter; the
     chip gives each one the same footprint whatever its aspect ratio, which is
     what stops a wordmark looking half the weight of a square badge. */
  chip: {
    flex: '0 0 auto',
    width: 72,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.action.hover,
  },
  /* The title sponsor is bigger. Size is the whole of the hierarchy here -
     no badge, no highlight, no "TITLE SPONSOR" caption shouting at a spectator
     who did not come here for that. */
  chipTitle: {
    width: 104,
    height: 56,
  },
  logo: {
    maxWidth: '80%',
    maxHeight: '70%',
    /* contain, so the aspect ratio decides the shape rather than the box.
       Roofus can be cropped to a circle because it is a round badge; a
       horizontal wordmark cropped the same way is an unreadable fragment. */
    objectFit: 'contain',
  },
}));

const SponsorsDialog = ({ open, onClose, onLogout }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const { sponsors, title } = useSponsors();

  /* Title first, then the rest in the order they were configured. Sorting by
     tier beyond that would invent a ranking the operator did not ask for. */
  const ordered = title ? [title, ...sponsors.filter((item) => item !== title)] : sponsors;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      {/* Literal English, by the same rule as the Fleet tab and the support
          label: per-event chrome, and an invented l10n key renders empty in
          every locale but English. */}
      <DialogTitle>Our partners</DialogTitle>
      <DialogContent className={classes.content} dividers>
        <List disablePadding>
          {ordered.map((sponsor) => (
            <ListItemButton
              key={sponsor.name + sponsor.logo}
              className={classes.row}
              /*
                A NEW TAB, always. A spectator who navigates away mid-race has
                lost the live map, which is the one way this feature could
                actually hurt the thing it sits on top of. rel closes the
                opener, so a sponsor's page cannot reach back into the tab
                still showing the race.
              */
              component="a"
              href={sponsor.url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              disabled={!sponsor.url}
            >
              <div className={cx(classes.chip, sponsor === title && classes.chipTitle)}>
                {/* alt is the name, so a screen reader says who it is and a
                    broken path shows the name rather than an empty box - the
                    difference between somebody fixing the URL and nobody
                    noticing for three weeks. */}
                <img className={classes.logo} src={sponsor.logo} alt={sponsor.name} />
              </div>
              <ListItemText
                primary={sponsor.name}
                secondary={sponsor === title ? 'Title sponsor' : undefined}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        {/*
          LOGOUT LIVES HERE FOR KIOSK ACCOUNTS, which is odd bedfellows and was
          chosen deliberately. Ryan, 2026-09-01: "Sponsors, logout inside the
          sheet." The kiosk bar is Map, POI, Roofus and Sponsors - four, so the
          title sponsor's wordmark keeps its full width - and this is where the
          escape hatch went rather than disappearing.

          Only passed in when there is nothing else holding it: a kiosk host
          with no sponsors keeps its Logout button on the bar exactly as before,
          because there would be no sheet to find it in.
        */}
        {onLogout && (
          <Button onClick={onLogout} color="error" size="small">
            {t('loginLogout')}
          </Button>
        )}
        <Button onClick={onClose}>{t('sharedClose') || 'Close'}</Button>
      </DialogActions>
    </Dialog>
  );
};

/** Nothing renders when no host has configured sponsors - see useSponsors. */
export const useHasSponsors = () => useSponsors().sponsors.length > 0;

export default SponsorsDialog;
