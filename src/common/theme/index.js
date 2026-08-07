import { useMemo } from 'react';
import { createTheme } from '@mui/material/styles';
import palette from './palette';
import dimensions from './dimensions';
import components from './components';

export default (server, user, darkMode, direction) =>
  useMemo(
    () =>
      createTheme({
        typography: {
          fontFamily: 'Roboto,Segoe UI,Helvetica Neue,Arial,sans-serif',
        },
        palette: palette(server, user, darkMode),
        direction,
        dimensions,
        components,
      }),
    [server, user, darkMode, direction],
  );
