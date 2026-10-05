// OURS, not upstream: Settings - Connected services (docs/RIDER-HEALTH.md, increments 1-4).
// A user links Polar or Strava to their own account; an administrator enters the platform's
// client credentials. Every step is on this screen - no .env edits, no scripts.
import { Fragment, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  Switch,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import useSettingsStyles from './common/useSettingsStyles';
import { useAdministrator } from '../common/util/permissions';
import { useAsyncTask } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';

// Bump together with AthleteDataResource.CONSENT_VERSION when this wording changes.
const CONSENT_TEXT =
  'I agree that WLAB may store heart-rate and workout data from this service against my ' +
  'account, to show it to me and to compare it with my tracking and bike data. It is health information: ' +
  'it is never shown publicly or used for race results, nobody else sees it unless I share it, and ' +
  'disconnecting stops collection and deletes the link. Riders under 18 need a parent or guardian to agree.';

const PROVIDER_NAMES = { polar: 'Polar Flow', strava: 'Strava', file: 'File' };

// "HighIntensityIntervalTraining" (Strava) or "FITNESS_EQUIPMENT" (FIT/Polar) -> "High intensity interval training".
const formatSport = (sport) => {
  if (!sport) {
    return '-';
  }
  const words = sport
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// Garmin's brand terms require the source to be named wherever its data is shown.
const sourceLabel = (s) =>
  s.provider === 'file' && s.device ? `File (${s.device})` : PROVIDER_NAMES[s.provider];

const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`;
};

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '-');

const errorText = (error) => {
  try {
    return JSON.parse(error.message).message || error.message;
  } catch {
    return error.message;
  }
};

const ProviderCard = ({ provider, onChanged }) => {
  const { classes } = useSettingsStyles();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const { link } = provider;

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetchOrThrow(`/api/athlete/providers/${provider.provider}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: true }),
      });
      const { url } = await response.json();
      window.location.assign(url);
    } catch (error) {
      setMessage({ severity: 'error', text: errorText(error) });
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetchOrThrow(`/api/athlete/providers/${provider.provider}/sync`, {
        method: 'POST',
      });
      const result = await response.json();
      setMessage(
        result.error
          ? { severity: 'warning', text: result.error }
          : {
              severity: 'success',
              text: `${result.added} new session(s), ${result.seen} checked.`,
            },
      );
      onChanged();
    } catch (error) {
      setMessage({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetchOrThrow(`/api/athlete/providers/${provider.provider}/link`, {
        method: 'DELETE',
      });
      const result = await response.json();
      const warning =
        `Disconnected here, but ${provider.name} reported: ${result.revokeError}. ` +
        `Remove WLAB in your ${provider.name} settings too.`;
      setMessage(
        result.revokeError
          ? { severity: 'warning', text: warning }
          : {
              severity: 'success',
              text: `${provider.name} disconnected, ${result.sessionsDeleted ?? 0} session(s) deleted.`,
            },
      );
      onChanged();
    } catch (error) {
      setMessage({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">
          {provider.name}
          {link ? ' - connected' : ''}
        </Typography>
      </AccordionSummary>
      <AccordionDetails className={classes.details}>
        {message && <Alert severity={message.severity}>{message.text}</Alert>}
        {link ? (
          <>
            <Typography variant="body2">
              {`Connected ${formatDate(link.created)}`}
              {link.externalUserId ? ` (${provider.name} user ${link.externalUserId})` : ''}
            </Typography>
            <Typography variant="body2">{`Consent given ${formatDate(link.consentAt)}`}</Typography>
            <Typography variant="body2">{`Last sync ${formatDate(link.lastSync)}`}</Typography>
            {link.lastError && <Alert severity="warning">{link.lastError}</Alert>}
            <Button variant="contained" disabled={busy} onClick={syncNow}>
              Sync now
            </Button>
            <Button variant="outlined" color="error" disabled={busy} onClick={disconnect}>
              {`Disconnect ${provider.name}`}
            </Button>
          </>
        ) : (
          <>
            {!provider.available && (
              <Alert severity="info">{`${provider.name} is not available on this platform yet.`}</Alert>
            )}
            <FormControlLabel
              control={
                <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              }
              label={<Typography variant="body2">{CONSENT_TEXT}</Typography>}
              disabled={!provider.available}
            />
            <Button
              variant="contained"
              disabled={!provider.available || !consent || busy}
              onClick={connect}
            >
              {`Connect ${provider.name}`}
            </Button>
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

// One callback host serves every brand (the callback sends each user back to the host they
// started on), so a new integration reuses the host already registered for another provider and
// only falls back to the host this page is open on when nothing is registered yet.
const defaultRedirect = (provider, integrations) => {
  const registered = integrations.find((i) => i.redirectUri)?.redirectUri;
  let origin = window.location.origin;
  if (registered) {
    try {
      origin = new URL(registered).origin;
    } catch {
      // keep the current host
    }
  }
  return `${origin}/api/athlete/callback/${provider}`;
};

const IntegrationCard = ({ integration, integrations, onSaved }) => {
  const { classes } = useSettingsStyles();
  const [clientId, setClientId] = useState(integration.clientId || '');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState(
    integration.redirectUri || defaultRedirect(integration.provider, integrations),
  );
  const [enabled, setEnabled] = useState(integration.enabled);
  const [message, setMessage] = useState(null);

  const save = async () => {
    setMessage(null);
    try {
      await fetchOrThrow(`/api/athlete/integrations/${integration.provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret, redirectUri, enabled }),
      });
      setClientSecret('');
      setMessage({ severity: 'success', text: 'Saved.' });
      onSaved();
    } catch (error) {
      setMessage({ severity: 'error', text: errorText(error) });
    }
  };

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">
          {`Platform credentials - ${integration.name}`}
          {integration.enabled ? ' (enabled)' : ''}
        </Typography>
      </AccordionSummary>
      <AccordionDetails className={classes.details}>
        {!integration.keyConfigured && (
          <Alert severity="error">
            The server encryption key (WLAB_HEALTH_KEY) is not set, so secrets cannot be stored yet.
          </Alert>
        )}
        {message && <Alert severity={message.severity}>{message.text}</Alert>}
        <Typography variant="body2">
          {`Register this redirect URL with ${integration.name} exactly as shown, ` +
            'then paste the client ID and secret it gives you.'}
        </Typography>
        <TextField
          label="Redirect URL"
          value={redirectUri}
          onChange={(e) => setRedirectUri(e.target.value)}
          helperText={
            integration.redirectUri
              ? 'Registered - change only if you change it with the provider too.'
              : 'Suggested - check the host is the one registered with the provider.'
          }
        />
        <TextField
          label="Client ID"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        />
        <TextField
          label={
            integration.secretSet ? 'Client secret (stored - leave blank to keep)' : 'Client secret'
          }
          type="password"
          autoComplete="new-password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
        />
        <FormControlLabel
          control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
          label="Offer to users"
        />
        <Button variant="contained" onClick={save}>
          Save
        </Button>
        {integration.updated && (
          <Typography variant="caption">{`Last saved ${formatDate(integration.updated)}`}</Typography>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

const SessionChart = ({ sessionId }) => {
  const [data, setData] = useState(null);
  useAsyncTask(
    async ({ signal }) => {
      const response = await fetchOrThrow(`/api/athlete/sessions/${sessionId}/samples`, { signal });
      const samples = await response.json();
      const start = samples.length ? samples[0][0] : 0;
      setData(samples.map(([time, hr]) => ({ minute: (time - start) / 60000, hr })));
    },
    [sessionId],
  );
  if (!data) {
    return <Typography variant="caption">Loading...</Typography>;
  }
  if (!data.length) {
    return <Typography variant="caption">No heart-rate samples in this session.</Typography>;
  }
  // Round axis: 60, 80 ... 180, not 65 ... 161.
  const values = data.map((d) => d.hr);
  const low = Math.floor((Math.min(...values) - 5) / 10) * 10;
  const step = Math.max(...values) - low > 100 ? 20 : 10;
  const high = low + Math.ceil((Math.max(...values) + 5 - low) / step) * step;
  const ticks = Array.from({ length: (high - low) / step + 1 }, (_, i) => low + i * step);
  return (
    <Box sx={{ width: '100%', height: 200 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <XAxis
            dataKey="minute"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => `${Math.round(v)}`}
            unit=" min"
          />
          <YAxis domain={[low, high]} ticks={ticks} allowDataOverflow={false} />
          <Tooltip
            formatter={(value) => [`${value} bpm`, 'Heart rate']}
            labelFormatter={(v) => `${v.toFixed(1)} min`}
          />
          <Line
            type="monotone"
            dataKey="hr"
            dot={false}
            strokeWidth={1.5}
            stroke="#e53935"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

const UploadCard = ({ onChanged, onShow }) => {
  const { classes } = useSettingsStyles();
  const [state, setState] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);
  const [version, setVersion] = useState(0);

  useAsyncTask(
    async ({ signal }) => {
      const response = await fetchOrThrow('/api/athlete/uploads', { signal });
      setState(await response.json());
    },
    [version],
  );

  const agreed = Boolean(state?.consentAt);

  const upload = async (files) => {
    setBusy(true);
    const results = [];
    for (const file of files) {
      try {
        const response = await fetchOrThrow(`/api/athlete/upload${agreed ? '' : '?consent=true'}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file,
        });
        const result = await response.json();
        const show = { id: result.sessionId, start: result.start };
        results.push(
          result.duplicate
            ? { severity: 'info', text: `${file.name}: already uploaded.`, show }
            : {
                severity: 'success',
                text: `${file.name}: ${formatSport(result.sport)}, ${formatDate(result.start)}, ${formatDuration(result.duration)}, ${result.samples} heart-rate samples.`,
                show,
              },
        );
      } catch (error) {
        results.push({ severity: 'error', text: `${file.name}: ${errorText(error)}` });
      }
    }
    setMessages(results);
    setBusy(false);
    setVersion((v) => v + 1);
    onChanged();
  };

  const remove = async () => {
    setBusy(true);
    try {
      const response = await fetchOrThrow('/api/athlete/uploads', { method: 'DELETE' });
      const result = await response.json();
      setMessages([
        { severity: 'success', text: `${result.sessionsDeleted} uploaded session(s) deleted.` },
      ]);
      setConsent(false);
      setVersion((v) => v + 1);
      onChanged();
    } catch (error) {
      setMessages([{ severity: 'error', text: errorText(error) }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">
          {`Upload workout files${state?.sessions ? ` (${state.sessions})` : ''}`}
        </Typography>
      </AccordionSummary>
      <AccordionDetails className={classes.details}>
        <Typography variant="body2">
          For Garmin and any other device: export the activity file and upload it here. In Garmin
          Connect open the activity, then the gear icon and Export Original. .fit, .fit.gz and .zip
          files are accepted; several can be chosen at once.
        </Typography>
        {messages.map((m) => (
          <Alert
            key={m.text}
            severity={m.severity}
            action={
              m.show?.id ? (
                <Button color="inherit" size="small" onClick={() => onShow(m.show)}>
                  View
                </Button>
              ) : null
            }
          >
            {m.text}
          </Alert>
        ))}
        {!agreed && (
          <FormControlLabel
            control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} />}
            label={<Typography variant="body2">{CONSENT_TEXT}</Typography>}
          />
        )}
        <Button variant="contained" component="label" disabled={busy || (!agreed && !consent)}>
          {busy ? 'Uploading...' : 'Choose files'}
          <input
            hidden
            multiple
            type="file"
            accept=".fit,.zip,.gz"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              if (files.length) {
                upload(files);
              }
            }}
          />
        </Button>
        {agreed && (
          <>
            <Typography variant="body2">{`Consent given ${formatDate(state.consentAt)}`}</Typography>
            <Button variant="outlined" color="error" disabled={busy} onClick={remove}>
              Delete uploaded sessions
            </Button>
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

const PERIODS = [
  { days: 60, label: '60 days' },
  { days: 365, label: '1 year' },
  { days: 0, label: 'All' },
];

const periodTitle = (days) => (days ? `last ${PERIODS.find((p) => p.days === days).label}` : 'all');

// The smallest period that still contains a session that started at the given time.
const periodFor = (start) => {
  const age = (Date.now() - new Date(start).getTime()) / 86_400_000;
  return PERIODS.find((p) => p.days && age < p.days - 1)?.days ?? 0;
};

const SessionsCard = ({ version, focus }) => {
  const { classes } = useSettingsStyles();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [period, setPeriod] = useState(60);
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const scrollTo = useRef(null);

  // "View" on an upload: widen the period if the session is older than it, open its chart.
  useEffect(() => {
    if (focus?.id) {
      const needed = periodFor(focus.start);
      setPeriod((current) => (current === 0 || (needed && needed <= current) ? current : needed));
      setOpen(focus.id);
      setExpanded(true);
      scrollTo.current = focus.id;
    }
  }, [focus]);

  useAsyncTask(
    async ({ signal }) => {
      const response = await fetchOrThrow(`/api/athlete/sessions?days=${period}`, { signal });
      setSessions(await response.json());
    },
    [version, period],
  );

  useEffect(() => {
    if (scrollTo.current && sessions.some((s) => s.id === scrollTo.current)) {
      document
        .getElementById(`session-${scrollTo.current}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      scrollTo.current = null;
    }
  }, [sessions, open]);

  const primaries = sessions.filter((s) => !s.duplicateOf);
  const alsoOn = (id) => sessions.filter((s) => s.duplicateOf === id).map(sourceLabel);
  const sources = (s) => [sourceLabel(s), ...alsoOn(s.id)].join(' + ');
  const heartRate = (s) => (s.avgHr ? `${s.avgHr} / ${s.maxHr ?? '-'}` : '-');
  const toggle = (id) => setOpen(open === id ? null : id);

  const table = (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>When</TableCell>
          <TableCell>Activity</TableCell>
          <TableCell>Time</TableCell>
          <TableCell>HR avg / max</TableCell>
          <TableCell>Source</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {primaries.map((s) => (
          <Fragment key={s.id}>
            <TableRow
              id={`session-${s.id}`}
              hover
              selected={open === s.id}
              sx={{ cursor: 'pointer' }}
              onClick={() => toggle(s.id)}
            >
              <TableCell>{formatDate(s.start)}</TableCell>
              <TableCell>{formatSport(s.sport)}</TableCell>
              <TableCell>{formatDuration(s.duration)}</TableCell>
              <TableCell>{heartRate(s)}</TableCell>
              <TableCell>{sources(s)}</TableCell>
            </TableRow>
            {open === s.id && (
              <TableRow>
                <TableCell colSpan={5}>
                  <SessionChart sessionId={s.id} />
                </TableCell>
              </TableRow>
            )}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );

  // Phones: one two-line entry per session instead of five squeezed columns.
  const list = (
    <List dense disablePadding>
      {primaries.map((s) => (
        <Fragment key={s.id}>
          <ListItemButton
            id={`session-${s.id}`}
            divider
            selected={open === s.id}
            onClick={() => toggle(s.id)}
          >
            <ListItemText
              primary={`${formatSport(s.sport)} - ${formatDuration(s.duration)}${s.avgHr ? ` - ${heartRate(s)} bpm` : ''}`}
              secondary={`${formatDate(s.start)} - ${sources(s)}`}
            />
          </ListItemButton>
          {open === s.id && (
            <Box sx={{ py: 1 }}>
              <SessionChart sessionId={s.id} />
            </Box>
          )}
        </Fragment>
      ))}
    </List>
  );

  return (
    <Accordion expanded={expanded} onChange={(e, value) => setExpanded(value)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">
          {`Sessions - ${periodTitle(period)} (${primaries.length})`}
        </Typography>
      </AccordionSummary>
      <AccordionDetails className={classes.details}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={period}
          onChange={(e, value) => value !== null && setPeriod(value)}
        >
          {PERIODS.map((p) => (
            <ToggleButton key={p.days} value={p.days}>
              {p.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {!primaries.length ? (
          <Typography variant="body2">
            {period
              ? 'No sessions in this period. New workouts appear within 30 minutes of reaching ' +
                'Polar Flow or Strava, or use Sync now. Polar only shares workouts uploaded after ' +
                'you connected.'
              : 'No sessions yet.'}
          </Typography>
        ) : phone ? (
          list
        ) : (
          table
        )}
      </AccordionDetails>
    </Accordion>
  );
};

const HealthPage = () => {
  const { classes } = useSettingsStyles();
  const admin = useAdministrator();
  const [searchParams, setSearchParams] = useSearchParams();

  const [providers, setProviders] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [version, setVersion] = useState(0);
  const [banner, setBanner] = useState(null);
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    const result = searchParams.get('result');
    if (result) {
      const id = searchParams.get('provider');
      const name = PROVIDER_NAMES[id] || id;
      const detail = searchParams.get('message');
      if (result === 'connected') {
        setBanner({ severity: 'success', text: `${name} connected.` });
      } else if (result === 'denied') {
        setBanner({
          severity: 'info',
          text: `${name} was not connected - permission was not granted.`,
        });
      } else {
        setBanner({
          severity: 'error',
          text: `${name} could not be connected${detail ? `: ${detail}` : '.'}`,
        });
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useAsyncTask(
    async ({ signal }) => {
      const response = await fetchOrThrow('/api/athlete/providers', { signal });
      setProviders(await response.json());
      if (admin) {
        const adminResponse = await fetchOrThrow('/api/athlete/integrations', { signal });
        setIntegrations(await adminResponse.json());
      }
    },
    [admin, version],
  );

  const refresh = () => setVersion((v) => v + 1);

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['Connected services']}>
      <Container maxWidth="md" className={classes.container}>
        {banner && (
          <Alert severity={banner.severity} onClose={() => setBanner(null)}>
            {banner.text}
          </Alert>
        )}
        <Typography variant="body2" sx={{ my: 2 }}>
          Link the apps that record your heart rate and workouts. Your data stays private to you.
        </Typography>
        {providers.map((provider) => (
          <ProviderCard key={provider.provider} provider={provider} onChanged={refresh} />
        ))}
        <UploadCard onChanged={refresh} onShow={(show) => setFocus({ ...show })} />
        <SessionsCard version={version} focus={focus} />
        {admin && integrations.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 4, mb: 1 }}>
              Administrator
            </Typography>
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.provider}
                integration={integration}
                integrations={integrations}
                onSaved={refresh}
              />
            ))}
          </>
        )}
      </Container>
    </PageLayout>
  );
};

export default HealthPage;
