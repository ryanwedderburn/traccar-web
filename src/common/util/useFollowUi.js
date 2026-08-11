import { useSelector } from 'react-redux';
import useEventUi from './useEventUi';
import useEquipmentUi from './useEquipmentUi';

/**
 * Gate for the follow chrome: the crosshair on the device row, MapFollow,
 * and the frame-both control. On by default for both verticals - a site
 * manager tracking a hauler is the same job as a spectator tracking a
 * rider - and grantable to any other host with `"ui.followButton": true`
 * in its hostBranding entry, so a control is a config away rather than a
 * build away. Same server-attribute delivery and parse rule as the
 * vertical flags themselves.
 */
const truthy = (value) => value === true || value === 'true';

export default () => {
  const eventUi = useEventUi();
  const equipmentUi = useEquipmentUi();
  const granted = useSelector((state) =>
    truthy(state.session.server?.attributes?.['ui.followButton']),
  );
  return eventUi || equipmentUi || granted;
};
