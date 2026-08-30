import { useSelector } from 'react-redux';

/**
 * Whether this host offers the rider tracking-setup wizard.
 *
 * OURS, not upstream. Off by default on the `ui.setup` server attribute - the
 * same self-hiding convention as useEventUi, useCoverage and useFloorPlans, and
 * read from the SERVER rather than the user because HostBranding merges each
 * host's entry into /api/server. One account is then plain Traccar on the
 * platform domain and event-aware on roa.wlab.co.za, which is the whole point
 * of doing it per host.
 *
 * WHY A FLAG RATHER THAN DETECTING A DEVICE. The wizard configures a phone
 * carrying an event identifier - ROA26-NNN-XXXXXXXX - and that shape is
 * deliberately not known here: it lives in setup.html, which is reissued per
 * event, so that a new event is a page change rather than a React change and a
 * rebuild. See SetupResource.IDENTIFIER for the same reasoning server-side.
 *
 * The entry point is hidden rather than disabled where it does not apply. A
 * button that leads to a page saying "there is nothing for you here" reads as
 * the platform being broken rather than the account being wrong - the rule
 * BottomMenu already states for the administrator-only items.
 */
const truthy = (value) => value === true || value === 'true';

export default () => useSelector((state) => truthy(state.session.server?.attributes?.['ui.setup']));
