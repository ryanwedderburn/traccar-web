import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  Menu,
  MenuItem,
  Typography,
  Badge,
} from '@mui/material';

import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import MapIcon from '@mui/icons-material/Map';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import PersonIcon from '@mui/icons-material/Person';
import PlaceIcon from '@mui/icons-material/Place';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import StorefrontIcon from '@mui/icons-material/Storefront';

import { sessionActions } from '../../store';
import { useTranslation } from './LocalizationProvider';
import { useRestriction, useAdministrator } from '../util/permissions';
import { nativePostMessage } from './NativeInterface';
import useWaypoints from '../util/waypoints';
import useEventUi from '../util/useEventUi';
import useEquipmentUi from '../util/useEquipmentUi';
import useSetupUi from '../util/useSetupUi';
import useKiosk from '../util/useKiosk';
import WaypointsDialog from './WaypointsDialog';
import SponsorsDialog from './SponsorsDialog';
import useSponsors from '../util/useSponsors';
import useSupportWidget from '../util/useSupportWidget';
import { useAttributePreference } from '../util/preferences';

const BottomMenu = ({ routeFilter }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const t = useTranslation();

  const readonly = useRestriction('readonly');
  const disableReports = useRestriction('disableReports');

  /*
   * The admin tools are one link away, and were not reachable from here at all.
   *
   * manage.html links BACK to the live map in its own header; nothing pointed
   * forward, so the only route from the viewer to the event setup was a typed
   * URL. Ryan, 2026-08-30: "enable easy flicking between standard frontend and
   * custom backend. It's a gap." A one-way link is the half of a round trip
   * that gets built first and then looks finished.
   *
   * ADMINISTRATOR, because that is what the page actually needs. The claim
   * operations behind Competitors are `checkAdmin` on MetricsResource
   * (CAPABILITIES.md: platform work is not grantable), so a non-admin who
   * followed this would reach a page whose every panel answers 403. An entry
   * point that leads somewhere unusable is worse than no entry point - it reads
   * as the platform being broken rather than the account being wrong.
   *
   * NOT gated on a host attribute, unlike eventUi/equipmentUi/liveUser. Those
   * switch behaviour per hostname; this is one file in web.override, served by
   * the same Jetty to every host on the install, so there is no host where an
   * administrator has it and another where they do not. A flag here would be a
   * setting that is always the same value.
   */
  const administrator = useAdministrator();

  /*
   * WHERE A READONLY ACCOUNT GOES TO WATCH THE WHOLE FIELD.
   *
   * A competitor signs in to their self-test account, proves their tracking
   * works, and then wants to see the race. Their account shows only their own
   * devices, so they have to get across to the spectator view - and until now
   * the only control offered was Log out, which is the MECHANISM rather than
   * the thing they want. "Log out" also reads as destructive to a rider who is
   * worried about losing their code.
   *
   * LiveLoginServlet compares the session's user id against the live user's,
   * so a competitor's session is not "already signed in": SessionHelper
   * .userLogin invalidates it and recreates it as the kiosk account. Hitting
   * /live while signed in as anybody simply switches them across, which is why
   * this needs no logout and no credentials.
   *
   * Same host attribute the login page's button uses, so a host without /live
   * offers neither. Ryan, 2026-08-29: "I don't want to link to public viewer
   * account just yet."
   */
  const liveEnabled = useSelector((state) => Boolean(state.session.server.attributes?.liveUser));
  /*
   * Cosmetic sibling of the account-level restriction, in upstream's
   * ui.disable* naming. The restriction revokes the report API - which the
   * equipment dashboard's KPIs ride - so hiding Traccar's generic report
   * pages must not use it. Set per host via hostBranding
   * ("ui.disableReports": true) until the proper reporting surface exists.
   */
  const uiReportsValue = useAttributePreference('ui.disableReports');
  const reportsHidden = uiReportsValue === true || uiReportsValue === 'true';
  const devices = useSelector((state) => state.devices.items);
  const user = useSelector((state) => state.session.user);
  const socket = useSelector((state) => state.session.socket);
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const [anchorEl, setAnchorEl] = useState(null);
  const [waypointsOpen, setWaypointsOpen] = useState(false);
  const [sponsorsOpen, setSponsorsOpen] = useState(false);

  // Shown only where there is somewhere to go, the same way RouteFilter hides
  // itself until the data carries an event. An install that has never run a
  // race sees the bar it has always seen.
  //
  // Also gated per host: an admin on the stock platform can see every event
  // waypoint through their permissions, and self-hiding alone would put the
  // POI button back on a bar that is meant to be upstream's.
  const eventUi = useEventUi();
  const equipmentUi = useEquipmentUi();
  const waypoints = useWaypoints(routeFilter);

  /*
   * "Set up my phone" - the way a rider finds the tracking wizard.
   *
   * WITHOUT THIS THERE IS NO DISCOVERY. A rider signs in, lands on the map,
   * sees their own device sitting offline, and nothing anywhere tells them that
   * /setup.html exists. The wizard could be perfect and still never be reached.
   *
   * A RIDER, and the three conditions each exclude somebody real:
   *   readonly        - an organiser or admin is not setting up a competitor's
   *                     handset from their own signed-in browser, and offering
   *                     it to them is how the wrong phone gets configured.
   *   !administrator  - same, and an admin has no device of their own to set up.
   *   !kiosk          - the spectator account is readonly and non-admin too, but
   *                     has no tracker; the button would lead nowhere.
   */
  const setupUi = useSetupUi();
  const kiosk = useKiosk();

  /*
   * THE SPONSORS ITEM IS KIOSK-ONLY, and that is a decision rather than a
   * default. Ryan, 2026-09-01. Spectators are who a sponsor is buying; the
   * people using this as a tool - riders checking their own tracking, crew,
   * administrators - are not, and an admin bar already carries six items on
   * roa.wlab.co.za before anything is added to it.
   *
   * SHOWN ONLY WHERE THERE IS SOMETHING TO SHOW, like POI and Roofus: a host
   * with no `sponsors` in its branding gets no button, so stock Traccar and
   * every other tenant are untouched.
   */
  const { sponsors, title: titleSponsor } = useSponsors();
  const showSponsors = kiosk && sponsors.length > 0;
  const showSetup = setupUi && readonly && !administrator && !kiosk;

  // Roofus. The widget's own floating launcher is hidden by SupportWidget and
  // driven from here instead, so it has one fixed home rather than a button
  // that overlaps this bar on a phone and the map controls on a desktop.
  //
  // `ready` is false until the widget has actually mounted - it appears only
  // after its own /config call resolves, and a rejected token or a disallowed
  // origin means it never appears at all. Hiding the entry until then follows
  // the same rule as POI above: shown only where there is something to show.
  //
  // The LABEL is an attribute because the assistant's name is per-event
  // branding, exactly like class names being derived rather than hard-coded.
  // Roofus is ROA's; the next event's will be something else, and neither
  // should need a build.
  const { ready: supportReady, logo: supportLogo, toggle: toggleSupport } = useSupportWidget();
  // No t() key here on purpose: the default is a placeholder for an unset
  // attribute, not a translated string. Inventing an l10n key for a value that
  // is meant to be overridden per event would render empty in every locale but
  // English - LocalizationProvider has no fallback.
  const supportLabel = useAttributePreference('eiWidgetLabel', 'Help');

  const currentSelection = () => {
    if (location.pathname === `/settings/user/${user.id}`) {
      return 'account';
    }
    if (location.pathname.startsWith('/settings')) {
      return 'settings';
    }
    if (location.pathname.startsWith('/reports')) {
      return 'reports';
    }
    if (location.pathname === '/dashboard') {
      return 'dashboard';
    }
    if (location.pathname === '/') {
      return 'map';
    }
    return null;
  };

  const handleAccount = () => {
    setAnchorEl(null);
    navigate(`/settings/user/${user.id}`);
  };

  /*
   * A FULL NAVIGATION, not navigate(). manage.html is served by
   * OverrideFileFilter and is not a route this app owns, so react-router would
   * match nothing and leave the user on a blank screen with the URL changed -
   * which looks exactly like the page being down.
   *
   * This is the same lesson as the /live button on the login page, and top-level
   * *.html is already in vite.config.js's navigateFallbackDenylist, so the
   * service worker hands the request to the server instead of answering it with
   * the precached index.html. Adding a link to an override page without that
   * entry is the bug that has now been introduced three times; see
   * docs/README.md.
   *
   * SAME TAB on purpose. The return trip already exists - manage.html's header
   * carries a "Live map" link - so a new tab would leave two copies of the app
   * open and a back button that does nothing.
   */
  const handleManage = () => {
    setAnchorEl(null);
    window.location.href = '/manage.html';
  };

  /* A FULL NAVIGATION, like the Event setup entry and the login page's button:
     /live is a servlet, not a route this app owns, so react-router would match
     nothing. Top-level *.html and /live are both in navigateFallbackDenylist,
     so the service worker passes it to the server. */
  const handleWatchLive = () => {
    setAnchorEl(null);
    window.location.href = '/live';
  };

  const handleLogout = async () => {
    setAnchorEl(null);

    const notificationToken = window.localStorage.getItem('notificationToken');
    if (notificationToken && !user.readonly) {
      window.localStorage.removeItem('notificationToken');
      const tokens = user.attributes.notificationTokens?.split(',') || [];
      if (tokens.includes(notificationToken)) {
        const updatedUser = {
          ...user,
          attributes: {
            ...user.attributes,
            notificationTokens:
              tokens.length > 1
                ? tokens.filter((it) => it !== notificationToken).join(',')
                : undefined,
          },
        };
        await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedUser),
        });
      }
    }

    await fetch('/api/session', { method: 'DELETE' });
    nativePostMessage('logout');
    navigate('/login');
    dispatch(sessionActions.updateUser(null));
  };

  const handleSelection = (event, value) => {
    switch (value) {
      case 'map':
        navigate('/');
        break;
      case 'dashboard':
        navigate('/dashboard');
        break;
      case 'reports': {
        let id = selectedDeviceId;
        if (id == null) {
          const deviceIds = Object.keys(devices);
          if (deviceIds.length === 1) {
            id = deviceIds[0];
          }
        }

        if (id != null) {
          navigate(`/reports/combined?deviceId=${id}`);
        } else {
          navigate('/reports/combined');
        }
        break;
      }
      case 'settings':
        navigate('/settings/preferences?menu=true');
        break;
      case 'poi':
        setWaypointsOpen(true);
        break;
      /* An action, not a place, like POI and Roofus: currentSelection() never
         returns 'sponsors', so the Map tab stays highlighted behind it. */
      case 'sponsors':
        setSponsorsOpen(true);
        break;
      /*
       * A FULL PAGE LOAD, not navigate(). setup.html is served from
       * web.override by Jetty and is not a React route - handing it to the
       * router produces a blank screen and no error, which is the worst
       * possible failure for the one button a rider needs.
       *
       * Same origin, so the session cookie goes with it and the page resolves
       * the rider's own device through /api/setup/mine. No identifier in the
       * URL: that value is a write credential, and this is exactly the path
       * that stops it being one.
       */
      case 'setup':
        window.location.assign('/setup.html');
        break;
      case 'support':
        toggleSupport();
        break;
      case 'account':
        setAnchorEl(event.currentTarget);
        break;
      case 'logout':
        handleLogout();
        break;
      default:
        break;
    }
  };

  return (
    <Paper square elevation={3}>
      <BottomNavigation value={currentSelection()} onChange={handleSelection} showLabels>
        <BottomNavigationAction
          label={t('mapTitle')}
          icon={
            <Badge color="error" variant="dot" overlap="circular" invisible={socket !== false}>
              <MapIcon />
            </Badge>
          }
          value="map"
        />
        {/*
          The equipment vertical's fleet overview. Label is literal English by
          the SupportWidget rationale: per-vertical chrome, no l10n key that
          would render empty in every other locale.
        */}
        {equipmentUi && (
          <BottomNavigationAction label="Fleet" icon={<SpaceDashboardIcon />} value="dashboard" />
        )}
        {/*
          Opens a dialog rather than navigating, so `currentSelection()` never
          returns 'poi' and the Map tab stays highlighted behind it. That is
          deliberate: this is an action, not a place.
        */}
        {eventUi && waypoints.length > 0 && (
          <BottomNavigationAction
            label={t('sharedPoints') || 'POI'}
            icon={<PlaceIcon />}
            value="poi"
          />
        )}
        {/*
          Like POI, an action rather than a place: it toggles the chat panel and
          never becomes the selected tab, so Map stays highlighted behind it.
        */}
        {supportReady && (
          <BottomNavigationAction
            label={supportLabel}
            icon={
              supportLogo ? (
                <img
                  src={supportLogo}
                  alt=""
                  /* 24px to match the MUI icons either side of it, and round
                     because the launcher it came from is a circle - a square
                     crop here would read as a different mark. */
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : (
                <SupportAgentIcon />
              )
            }
            value="support"
          />
        )}
        {/*
          Literal English, by the same rule as the Fleet tab and the support
          label: this names one page in this fork, not a platform concept with a
          translation, and an invented l10n key renders empty in every locale
          but English.

          Placed before Reports deliberately. A rider whose phone is not yet
          reporting has nothing to read a report about, and this is the button
          that fixes that.
        */}
        {showSetup && (
          <BottomNavigationAction label="Set up" icon={<PhoneAndroidIcon />} value="setup" />
        )}
        {!disableReports && !reportsHidden && (
          <BottomNavigationAction
            label={t('reportTitle')}
            icon={<DescriptionIcon />}
            value="reports"
          />
        )}
        {!readonly && (
          <BottomNavigationAction
            label={t('settingsTitle')}
            icon={<SettingsIcon />}
            value="settings"
          />
        )}
        {/*
          Sponsors takes the fourth slot on a kiosk bar - Map, POI, Roofus,
          Sponsors - so the title sponsor's wordmark keeps its full width. Five
          items squeezes it to ~41px and it reads as a compressed afterthought.
          Ryan, 2026-09-01: "I do agree four is better than five for sure."

          THE ICON IS THE SPONSOR'S LOGO, following Roofus, which already puts a
          logo here instead of a glyph. Not the same crop though: Roofus is a
          round badge and survives a circle, while a horizontal wordmark cropped
          that way is an unreadable fragment. Contained, not cropped.
        */}
        {showSponsors && (
          <BottomNavigationAction
            label="Sponsors"
            icon={
              titleSponsor?.logo ? (
                <img
                  src={titleSponsor.logo}
                  alt=""
                  style={{ width: 50, height: 22, objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <StorefrontIcon />
              )
            }
            value="sponsors"
          />
        )}
        {/*
          ONE PERSON ICON, where readonly used to get a bare Logout button and
          everybody else got Account. The two bars now behave the same way, and
          a readonly account gains somewhere to put Watch live tracking - the
          thing a testing rider actually wants, rather than Log out, which is
          the mechanism and reads as destructive to somebody worried about
          losing their code.

          HIDDEN WHEN THE SPONSOR SHEET IS CARRYING LOGOUT, which is the only
          way the kiosk bar stays at four. An earlier version of this claimed
          the menu itself freed a slot; it does not - it replaces the Logout
          button one for one. The slot comes from moving logout into the sheet,
          and so this appears again the moment there is no sheet to hold it: a
          kiosk host with no sponsors keeps its Logout button exactly as before.
        */}
        {!showSponsors && (
          <BottomNavigationAction label={t('settingsUser')} icon={<PersonIcon />} value="account" />
        )}
      </BottomNavigation>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {/* A readonly account has no settings page to open, so the entry that
            leads there is not offered to them - an entry that goes somewhere
            unusable is worse than no entry, the same rule as Event setup. */}
        {!readonly && (
          <MenuItem onClick={handleAccount}>
            <Typography color="textPrimary">{t('settingsUser')}</Typography>
          </MenuItem>
        )}
        {/* Literal English, by the same rule as Fleet and the support label:
            per-event chrome, and an invented l10n key renders empty in every
            locale but English. */}
        {/* Not offered to the kiosk account itself: it IS the live view, so the
            entry would lead where they already are. Only the accounts that see
            a narrower map - a competitor's own devices - have somewhere to go. */}
        {readonly && !kiosk && liveEnabled && (
          <MenuItem onClick={handleWatchLive}>
            <Typography color="textPrimary">Watch live tracking</Typography>
          </MenuItem>
        )}
        {/*
          Literal English, by the same rule as the Fleet tab and the support
          label above: this names one page in this fork, not a platform concept
          with a translation. An invented l10n key renders empty in every locale
          but English, and an empty menu item is a worse outcome than an
          untranslated one.
        */}
        {administrator && (
          <MenuItem onClick={handleManage}>
            <Typography color="textPrimary">Event setup</Typography>
          </MenuItem>
        )}
        <MenuItem onClick={handleLogout}>
          <Typography color="error">{t('loginLogout')}</Typography>
        </MenuItem>
      </Menu>
      <WaypointsDialog
        open={waypointsOpen}
        onClose={() => setWaypointsOpen(false)}
        routeFilter={routeFilter}
      />
      {/* onLogout only when this sheet is the only place logout lives - see the
          bar item above. Passing it unconditionally would put a second logout
          in front of accounts that already have one in their menu. */}
      <SponsorsDialog
        open={sponsorsOpen}
        onClose={() => setSponsorsOpen(false)}
        onLogout={showSponsors ? handleLogout : undefined}
      />
    </Paper>
  );
};

export default BottomMenu;
