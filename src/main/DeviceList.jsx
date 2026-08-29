import { useEffect, useReducer } from 'react';
import { useDispatch } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import { List } from 'react-window';
import { devicesActions } from '../store';
import { useAsyncTask } from '../reactHelper';
import DeviceRow from './DeviceRow';
import fetchOrThrow from '../common/util/fetchOrThrow';
import useCompetitors from '../common/util/useCompetitors';

const useStyles = makeStyles()((theme) => ({
  list: {
    height: '100%',
    direction: theme.direction,
  },
  listInner: {
    position: 'relative',
    margin: theme.spacing(1.5, 0),
  },
}));

const DeviceList = ({ devices }) => {
  const { classes } = useStyles();
  const dispatch = useDispatch();

  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  /* FETCHED ONCE HERE, PASSED DOWN. useCompetitors holds its own state and
     issues its own request per call, so calling it inside DeviceRow would be
     one request per visible row. The list is the right level: it already owns
     the device fetch for the same reason. */
  const competitors = useCompetitors();

  useEffect(() => {
    const interval = setInterval(forceUpdate, 60000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  useAsyncTask(
    async ({ signal }) => {
      const response = await fetchOrThrow('/api/devices', { signal });
      dispatch(devicesActions.refresh(await response.json()));
    },
    [dispatch],
  );

  return (
    <List
      className={classes.list}
      rowComponent={DeviceRow}
      rowCount={devices.length}
      rowHeight={72}
      rowProps={{ devices, competitors }}
      overscanCount={5}
    />
  );
};

export default DeviceList;
