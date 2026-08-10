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
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PlaceIcon from '@mui/icons-material/Place';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';

import { sessionActions } from '../../store';
import { useTranslation } from './LocalizationProvider';
import { useRestriction } from '../util/permissions';
import { nativePostMessage } from './NativeInterface';
import useWaypoints from '../util/waypoints';
import useEventUi from '../util/useEventUi';
import useEquipmentUi from '../util/useEquipmentUi';
import WaypointsDialog from './WaypointsDialog';
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
          <BottomNavigationAction
            label="Fleet"
            icon={<SpaceDashboardIcon />}
            value="dashboard"
          />
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
        {readonly ? (
          <BottomNavigationAction
            label={t('loginLogout')}
            icon={<ExitToAppIcon />}
            value="logout"
          />
        ) : (
          <BottomNavigationAction label={t('settingsUser')} icon={<PersonIcon />} value="account" />
        )}
      </BottomNavigation>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={handleAccount}>
          <Typography color="textPrimary">{t('settingsUser')}</Typography>
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <Typography color="error">{t('loginLogout')}</Typography>
        </MenuItem>
      </Menu>
      <WaypointsDialog
        open={waypointsOpen}
        onClose={() => setWaypointsOpen(false)}
        routeFilter={routeFilter}
      />
    </Paper>
  );
};

export default BottomMenu;
