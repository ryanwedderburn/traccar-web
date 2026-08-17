import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Alert, Slide } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import useCoverage from '../../common/util/useCoverage';

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: theme.spacing(11),
    zIndex: 1200,
    maxWidth: `calc(100% - ${theme.spacing(4)})`,
    pointerEvents: 'none',
  },
}));

/** Below this there is nothing to say - a position a minute old is current. */
const QUIET_SECONDS = 180;

const minutes = (seconds) => {
  if (seconds < 5400) {
    return `${Math.round(seconds / 60)} minutes`;
  }
  return `${(seconds / 3600).toFixed(1)} hours`;
};

/**
 * Tells a viewer why the rider they are watching has stopped moving.
 *
 * THE WHOLE POINT IS WHAT IT DOES NOT SAY. It never claims the rider is in a
 * dead zone, because it cannot know that: a phone that is off, out of battery,
 * or in a pocket that lost GPS looks identical from here. It states two facts
 * and lets the viewer join them -
 *
 *   "Last position 14 minutes ago. Positions from here usually arrive late."
 *
 * The first is measured. The second is corroborated ground: several
 * independent devices had to agree before that cell was published. Asserting
 * the conclusion instead would be the failure this project keeps producing,
 * except in front of the public and about somebody's relative on a mountain.
 *
 * SILENT WHEN THE RIDER IS SOMEWHERE FINE. A stale position outside a known
 * zone gets no notice at all: the honest reading there is "we do not know why",
 * and a banner saying so on every brief GPS gap would train people to ignore
 * the one that matters.
 *
 * Only appears with a device selected, and only when `coverageUi` is set for
 * the host - the same self-hiding convention as the map layer it accompanies.
 */
const CoverageNotice = () => {
  const { classes } = useStyles();
  const { inZone } = useCoverage();

  const selectedId = useSelector((state) => state.devices.selectedId);
  const position = useSelector((state) =>
    selectedId ? state.session.positions[selectedId] : null,
  );

  /* Ticks on a timer rather than being derived at render, because nothing
     re-renders while a rider is silent - which is exactly when this has to
     appear. A lazy initialiser, not Date.now() in the render body: a component
     must be pure and the clock is not. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  if (!position || !position.fixTime) {
    return null;
  }
  const age = (now - new Date(position.fixTime).getTime()) / 1000;
  const stale = age > QUIET_SECONDS;
  const known = inZone(position.latitude, position.longitude);

  if (!stale || !known) {
    return null;
  }

  return (
    <Slide direction="up" in>
      <div className={classes.root}>
        <Alert severity="info" variant="filled" icon={false}>
          {`Last position ${minutes(age)} ago. Positions from here usually arrive late,
            so this rider may be further along than shown.`}
        </Alert>
      </div>
    </Slide>
  );
};

export default CoverageNotice;
