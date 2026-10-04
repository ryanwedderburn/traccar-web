import { useSelector } from 'react-redux';

/**
 * The per-host switch for rider health data - Settings / Connected services
 * (docs/RIDER-HEALTH.md). Same pattern and reasons as useEquipmentUi: off by
 * default, a host opts in through its hostBranding entry ("athleteUi": true),
 * read from the SERVER attributes because HostBranding delivers it per host.
 *
 * Why gated at all: the event host carries ~500 read-only rider accounts, and a
 * health-data entry appearing in their menu before the feature is offered there
 * would be a question at the scrutineering desk nobody can answer yet.
 */
const truthy = (value) => value === true || value === 'true';

export default () => useSelector((state) => truthy(state.session.server?.attributes?.athleteUi));
