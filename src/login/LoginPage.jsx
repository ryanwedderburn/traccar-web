import { useEffect, useRef, useState } from 'react';
import {
  useMediaQuery,
  Select,
  MenuItem,
  FormControl,
  Button,
  TextField,
  Link,
  Snackbar,
  IconButton,
  Tooltip,
  InputAdornment,
  Typography,
} from '@mui/material';
import CountryFlag from 'react-country-flag';
import { makeStyles } from 'tss-react/mui';
import CloseIcon from '@mui/icons-material/Close';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useTheme } from '@mui/material/styles';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { sessionActions } from '../store';
import { useLocalization, useTranslation } from '../common/components/LocalizationProvider';
import LoginLayout from './LoginLayout';
import usePersistedState from '../common/util/usePersistedState';
import {
  generateLoginToken,
  handleLoginTokenListeners,
  nativeEnvironment,
  nativePostMessage,
} from '../common/components/NativeInterface';
import LogoImage from './LogoImage';
import useSponsors from '../common/util/useSponsors';
import { useCatch } from '../reactHelper';
import QrCodeDialog from '../common/components/QrCodeDialog';
import fetchOrThrow from '../common/util/fetchOrThrow';

const useStyles = makeStyles()((theme) => ({
  options: {
    position: 'fixed',
    top: theme.spacing(2),
    right: theme.spacing(2),
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(1),
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  extraContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing(4),
    marginTop: theme.spacing(2),
  },
  registerButton: {
    minWidth: 'unset',
  },
  link: {
    cursor: 'pointer',
  },
  /*
   * The sponsor block. Ryan, 2026-09-01: "login page should probably only
   * contain the title sponsor which is currently Lenderu."
   *
   * NOT A LINK, deliberately. A link on a login page is a trap: somebody who
   * came to sign in, taps away and comes back has lost their place, and on a
   * phone may have to retype credentials. The tap-through lives on the map's
   * sponsor sheet, where leaving costs nothing.
   *
   * HIDDEN WHEN THERE IS NO ROOM. Measured on real handsets: an iPhone 12 mini
   * has ~150 CSS px of slack below the button, and the /live button - which
   * sits ABOVE the fields and pushes the whole stack down - takes ~55 of it
   * once liveUser is set. That leaves 80-90px, which is one row and no more.
   * A short or landscape viewport gets nothing rather than a login button
   * pushed off the bottom: this is the existing "shown only where there is
   * something to show" rule (POI, Roofus, /live) extended to "shown only where
   * there is room to show it". A rider who cannot reach LOGIN because of a
   * sponsor is the worst possible version of this feature.
   */
  sponsor: {
    display: 'none',
    [`@media (min-height: 600px)`]: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginTop: theme.spacing(3),
    },
  },
  sponsorCaption: {
    /* The caption is what keeps the ROA mark the hero. Two logos on one page
       with no framing read as a partnership of equals, which is not what is
       being sold. Muted and small, so it frames rather than competes. */
    color: theme.palette.text.secondary,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  sponsorLogo: {
    /* Height caps the hierarchy: roughly a third of the ROA mark, so nobody
       confuses which is the event and which is the sponsor. Width follows the
       aspect ratio - Lenderu is 77x34, so 28px tall is 63px wide. No border,
       no chip, no glow: the ROA mark already has one and should stay the only
       thing that does. */
    height: 28,
    width: 'auto',
    maxWidth: '70%',
    display: 'block',
  },
  flag: {
    marginRight: theme.spacing(1),
  },
}));

const LoginPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const t = useTranslation();

  const { languages, language, setLocalLanguage } = useLocalization();
  const languageList = Object.entries(languages).map((values) => ({
    code: values[0],
    country: values[1].country,
    name: values[1].name,
  }));

  const [failed, setFailed] = useState(false);
  /* Normally null, and then the generic "invalid username or password" stands.
     Carries a specific reason only when the server gave one worth repeating -
     today that is the wrong-host refusal, where the credentials were right and
     saying "invalid password" would send somebody round the same loop twice. */
  const [failure, setFailure] = useState(null);

  const [email, setEmail] = usePersistedState('loginEmail', '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showServerTooltip, setShowServerTooltip] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const registrationEnabled = useSelector((state) => state.session.server.registration);
  const languageEnabled = useSelector((state) => {
    const attributes = state.session.server.attributes;
    return !attributes.language && !attributes['ui.disableLoginLanguage'];
  });
  const changeEnabled = useSelector((state) => !state.session.server.attributes.disableChange);
  const emailEnabled = useSelector((state) => state.session.server.emailEnabled);
  /*
   * Per-host switch to hide the reset-password link: `emailEnabled` is
   * server-wide (SMTP is configured for the event hosts), but a shared demo
   * account must not invite a visitor to reset its password and lock out
   * everyone else. Delivered per hostname through hostBranding like the
   * feature flags; parse-don't-coerce, same as useEventUi.
   */
  const resetDisabled = useSelector((state) => {
    const value = state.session.server.attributes?.['ui.disableLoginReset'];
    return value === true || value === 'true';
  });
  /*
   * OURS. Hide the live-tracking button for a host that still has a working
   * `/live`. The two are deliberately separable: before an event, spectators
   * must not walk in off the login page while riders are still being
   * onboarded, but the QR link has to stay testable - and removing `liveUser`
   * to hide the button would 404 the servlet and take the QR with it.
   *
   * COSMETIC ONLY, and that is the whole point. Anyone who has the URL can
   * still reach `/live`. If the requirement is ever to actually close the
   * door, remove `liveUser` from the host's entry; this flag is for the
   * period where the door should be open but unadvertised.
   *
   * parse-don't-coerce, same as `ui.disableLoginReset` above.
   */
  /* Title sponsor only. The full partner board - roughly eighteen marks for
     2026 - lives on the map's sponsor sheet, which is the only surface with
     room for it. One non-wrapping row is all this page can hold. */
  const { title: sponsor } = useSponsors();

  const liveDisabled = useSelector((state) => {
    const value = state.session.server.attributes?.['ui.disableLoginLive'];
    return value === true || value === 'true';
  });
  /* OURS. Truthy only when this host's branding names a live account. Read
     defensively: attributes is absent before /api/server resolves, and a
     login page that throws is a login page nobody can use. */
  const liveEnabled = useSelector((state) => Boolean(state.session.server.attributes?.liveUser));
  const openIdEnabled = useSelector((state) => state.session.server.openIdEnabled);
  const openIdForced = useSelector(
    (state) => state.session.server.openIdEnabled && state.session.server.openIdForce,
  );
  const [codeEnabled, setCodeEnabled] = useState(false);

  const [announcementShown, setAnnouncementShown] = useState(false);
  const announcement = useSelector((state) => state.session.server.announcement);

  const handlePasswordLogin = async (event) => {
    event.preventDefault();
    setFailed(false);
    setFailure(null);
    try {
      const query = `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
      const response = await fetch('/api/session', {
        method: 'POST',
        body: new URLSearchParams(code.length ? `${query}&code=${code}` : query),
      });
      if (response.ok) {
        const user = await response.json();
        generateLoginToken();
        dispatch(sessionActions.updateUser(user));
        const target = window.sessionStorage.getItem('postLogin') || '/';
        window.sessionStorage.removeItem('postLogin');
        navigate(target, { replace: true });
      } else if (response.status === 401 && response.headers.get('WWW-Authenticate') === 'TOTP') {
        setCodeEnabled(true);
      } else if (response.status === 403) {
        /* The password was right and the address was not. See
           HostBranding.allows - an account can be bound to a hostname, and a
           rider who mistyped it needs to be told where to go, not told their
           password is wrong. */
        const body = await response.json().catch(() => null);
        setFailure(body?.error || 'This account cannot sign in on this address');
        setFailed(true);
        setPassword('');
        return;
      } else {
        throw Error(await response.text());
      }
    } catch {
      setFailed(true);
      setPassword('');
    }
  };

  const handleTokenLogin = useCatch(async (token) => {
    const response = await fetchOrThrow(`/api/session?token=${encodeURIComponent(token)}`);
    const user = await response.json();
    dispatch(sessionActions.updateUser(user));
    navigate('/');
  });

  const handleTokenLoginRef = useRef(handleTokenLogin);
  handleTokenLoginRef.current = handleTokenLogin;

  const handleOpenIdLogin = () => {
    document.location = '/api/session/openid/auth';
  };

  useEffect(() => nativePostMessage('authentication'), []);

  useEffect(() => {
    const listener = (token) => handleTokenLoginRef.current(token);
    handleLoginTokenListeners.add(listener);
    return () => handleLoginTokenListeners.delete(listener);
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem('hostname') !== window.location.hostname) {
      window.localStorage.setItem('hostname', window.location.hostname);
      setShowServerTooltip(true);
    }
  }, []);

  return (
    <LoginLayout>
      <div className={classes.options}>
        {nativeEnvironment && changeEnabled && (
          <IconButton color="primary" onClick={() => navigate('/change-server')}>
            <Tooltip
              title={`${t('settingsServer')}: ${window.location.hostname}`}
              open={showServerTooltip}
              arrow
            >
              <VpnLockIcon />
            </Tooltip>
          </IconButton>
        )}
        {!nativeEnvironment && (
          <IconButton color="primary" onClick={() => setShowQr(true)}>
            <QrCode2Icon />
          </IconButton>
        )}
        {languageEnabled && (
          <FormControl>
            <Select value={language} onChange={(e) => setLocalLanguage(e.target.value)}>
              {languageList.map((it) => (
                <MenuItem key={it.code} value={it.code}>
                  <span className={classes.flag}>
                    <CountryFlag countryCode={it.country} svg />
                  </span>
                  {it.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </div>
      <div className={classes.container}>
        {useMediaQuery(theme.breakpoints.down('lg')) && (
          <LogoImage color={theme.palette.primary.main} />
        )}
        {/*
          OURS. Watch the race without an account, on a host that has one.

          ABOVE THE CREDENTIAL FIELDS ON PURPOSE. Nearly everyone reaching this
          page at an event is a spectator who has no login and never will - a
          rider's family sent a link, or someone typed the domain off a banner.
          Putting this under the form would have them read, and fail to use,
          two fields first.

          `liveUser` is already public: HostBranding.apply merges the host's
          branding entry into the Server attributes and /api/server is
          @PermitAll, which is what makes this a purely client-side change. It
          is a USER ID, never a password - see LiveLoginServlet, which refuses
          unless the target account is readonly, non-administrator and kiosk.

          A FULL NAVIGATION, not react-router. /live is a servlet on the same
          origin, not a route in this app: it establishes the session server-side
          and redirects to /. Calling navigate() would look for a route that does
          not exist and land on the map with no session.

          A host without liveUser shows nothing at all, which is the same
          opt-in-per-host rule the servlet itself applies.
        */}
        {liveEnabled && !liveDisabled && (
          <Button
            onClick={() => {
              window.location.href = '/live';
            }}
            variant="contained"
            color="primary"
          >
            {t('loginLive')}
          </Button>
        )}
        {!openIdForced && (
          <>
            <TextField
              required
              error={failed}
              label={t('userEmail')}
              name="email"
              value={email}
              autoComplete="email"
              autoFocus={!email}
              onChange={(e) => setEmail(e.target.value)}
              helperText={failed && (failure || 'Invalid username or password')}
            />
            <TextField
              required
              error={failed}
              label={t('userPassword')}
              name="password"
              value={password}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              autoFocus={!!email}
              onChange={(e) => setPassword(e.target.value)}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            {codeEnabled && (
              <TextField
                required
                error={failed}
                label={t('loginTotpCode')}
                name="code"
                value={code}
                type="number"
                onChange={(e) => setCode(e.target.value)}
              />
            )}
            <Button
              onClick={handlePasswordLogin}
              type="submit"
              variant="contained"
              color="secondary"
              disabled={!email || !password || (codeEnabled && !code)}
            >
              {t('loginLogin')}
            </Button>
          </>
        )}
        {openIdEnabled && (
          <Button onClick={() => handleOpenIdLogin()} variant="contained" color="secondary">
            {t('loginOpenId')}
          </Button>
        )}
        {!openIdForced && (
          <div className={classes.extraContainer}>
            {registrationEnabled && (
              <Link
                onClick={() => navigate('/register')}
                className={classes.link}
                underline="none"
                variant="caption"
              >
                {t('loginRegister')}
              </Link>
            )}
            {emailEnabled && !resetDisabled && (
              <Link
                onClick={() => navigate('/reset-password')}
                className={classes.link}
                underline="none"
                variant="caption"
              >
                {t('loginReset')}
              </Link>
            )}
          </div>
        )}
        {/*
          LAST IN THE FORM CONTAINER, so it sits below everything including the
          register and reset links when a host has them. Renders nothing at all
          when no host has declared a title sponsor, which keeps stock Traccar
          and every other tenant exactly as they were.

          Literal English on the caption, by the same rule as the Fleet tab and
          the support label: this is per-event chrome, and an invented l10n key
          renders empty in every locale but English.
        */}
        {sponsor?.logo && (
          <div className={classes.sponsor}>
            <Typography variant="caption" className={classes.sponsorCaption}>
              Proudly sponsored by
            </Typography>
            {/*
              alt is the sponsor's name so a screen reader says who it is, and
              a broken path shows the name rather than a silent empty box -
              which is the difference between "they fixed the URL" and "nobody
              noticed for three weeks".
            */}
            <img className={classes.sponsorLogo} src={sponsor.logo} alt={sponsor.name} />
          </div>
        )}
      </div>
      <QrCodeDialog open={showQr} onClose={() => setShowQr(false)} />
      <Snackbar
        open={!!announcement && !announcementShown}
        message={announcement}
        action={
          <IconButton size="small" color="inherit" onClick={() => setAnnouncementShown(true)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </LoginLayout>
  );
};

export default LoginPage;
