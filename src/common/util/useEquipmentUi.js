import { useSelector } from 'react-redux';

/**
 * The per-host switch for the equipment chrome, starting with the gauge panel
 * in the status card. The heavy-equipment sibling of useEventUi, and the same
 * rules for the same reasons:
 *
 * OFF BY DEFAULT - the base platform stays stock Traccar, and a host opts in
 * through its `hostBranding` entry (`"equipmentUi": true`), so the same
 * account is stock on traccar.wlab.co.za and equipment-shaped on
 * telematics.wlab.co.za.
 *
 * Read from the SERVER attributes, not the user's, because HostBranding
 * delivers the flag per hostname. Deliberately not useAttributePreference,
 * which reads the user first and would weld the choice to the account.
 *
 * Parse, don't coerce: a value set by script arrives as the string "true".
 */
const truthy = (value) => value === true || value === 'true';

export default () => useSelector((state) => truthy(state.session.server?.attributes?.equipmentUi));
