import { grey, green, indigo } from '@mui/material/colors';

const validatedColor = (color) => (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color) ? color : null);

/**
 * The account's own colours win over the server's.
 *
 * Upstream reads these from the server record only, which is one install and
 * one brand. We run several events off one install and a spectator account is
 * granted exactly one of them, so the account is a perfectly good proxy for
 * "which event is this person here for" - and it needs no new entity, no redux
 * change and nothing lifted out of MainPage.
 *
 * Per-EVENT theming, keyed off the route filter, is the fuller answer and is
 * open in docs/CONTEXT.md. It only earns its keep for an account granted more
 * than one event, which today is only the admin.
 *
 * Note what this deliberately does not touch: the tab title, the PWA name and
 * the browser theme colour come from OverrideTextFilter.java, which runs
 * server-side before any session exists. Those stay server-wide, and that is
 * fine while one event runs at a time.
 */
const brand = (server, user, key) =>
  validatedColor(user?.attributes?.[key]) || validatedColor(server?.attributes?.[key]);

export default (server, user, darkMode) => ({
  mode: darkMode ? 'dark' : 'light',
  background: {
    default: darkMode ? grey[900] : grey[50],
  },
  primary: {
    main: brand(server, user, 'colorPrimary') || (darkMode ? indigo[200] : indigo[900]),
  },
  secondary: {
    main: brand(server, user, 'colorSecondary') || (darkMode ? green[200] : green[800]),
  },
  neutral: {
    main: grey[500],
  },
  geometry: {
    main: '#3bb2d0',
  },
  alwaysDark: {
    main: grey[900],
  },
});
