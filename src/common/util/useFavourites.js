import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { favouritesActions } from '../../store';

const EMPTY = [];

/**
 * Favourite devices for the current browser. See store/favourites.js for why
 * these are not stored against the user account.
 */
export default () => {
  const dispatch = useDispatch();

  const userId = useSelector((state) => state.session.user?.id);
  const devices = useSelector((state) => state.devices.items);
  const all = useSelector((state) => state.favourites.all);

  const stored = all[String(userId ?? 'anonymous')] || EMPTY;

  // Trackers get reassigned between events, so a stored id can outlive the
  // device it pointed at. Drop anything that no longer resolves rather than
  // letting dangling ids accumulate.
  const favourites = useMemo(() => stored.filter((id) => devices[id]), [stored, devices]);

  const isFavourite = useCallback((deviceId) => stored.includes(deviceId), [stored]);

  const toggleFavourite = useCallback(
    (deviceId) => dispatch(favouritesActions.toggle({ userId, deviceId })),
    [dispatch, userId],
  );

  return { favourites, isFavourite, toggleFavourite };
};
