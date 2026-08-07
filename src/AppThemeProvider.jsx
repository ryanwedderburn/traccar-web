import { useSelector } from 'react-redux';
import { ThemeProvider, useMediaQuery } from '@mui/material';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
import theme from './common/theme';
import { useLocalization } from './common/components/LocalizationProvider';

const cache = {
  ltr: createCache({
    key: 'muiltr',
    stylisPlugins: [prefixer],
  }),
  rtl: createCache({
    key: 'muirtl',
    stylisPlugins: [prefixer, rtlPlugin],
  }),
};

const AppThemeProvider = ({ children }) => {
  const server = useSelector((state) => state.session.server);
  // Brand colours can come from the signed-in account as well as the server -
  // one install, several events, and a spectator account belongs to exactly
  // one of them. See common/theme/palette.js.
  const user = useSelector((state) => state.session.user);
  const { direction } = useLocalization();

  // Most specific wins: account, then server, then the OS preference. An event
  // brand that only works on a dark map should not be at the mercy of whichever
  // way the spectator's phone happens to be set.
  const userDarkMode = user?.attributes?.darkMode;
  const serverDarkMode = server?.attributes?.darkMode;
  const preferDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  let darkMode = preferDarkMode;
  if (userDarkMode !== undefined) {
    darkMode = userDarkMode;
  } else if (serverDarkMode !== undefined) {
    darkMode = serverDarkMode;
  }

  const themeInstance = theme(server, user, darkMode, direction);

  return (
    <CacheProvider value={cache[direction]}>
      <ThemeProvider theme={themeInstance}>{children}</ThemeProvider>
    </CacheProvider>
  );
};

export default AppThemeProvider;
