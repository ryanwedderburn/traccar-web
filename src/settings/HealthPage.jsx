// OURS, not upstream: Settings - Connected services (docs/RIDER-HEALTH.md, increment 1).
// A user links Polar or Strava to their own account; an administrator enters the platform's
// client credentials. Every step is on this screen - no .env edits, no scripts.
import { Fragment, useEffect, useState } from 'react';
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
  Switch,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
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

const IntegrationCard = ({ integration, onSaved }) => {
  const { classes } = useSettingsStyles();
  const [clientId, setClientId] = useState(integration.clientId || '');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState(
    integration.redirectUri ||
      `${window.location.origin}/api/athlete/callback/${integration.provider}`,
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
          <YAxis domain={['dataMin - 5', 'dataMax + 5']} unit="" />
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

const UploadCard = ({ onChanged }) => {
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
        results.push(
          result.duplicate
            ? { severity: 'info', text: `${file.name}: already uploaded.` }
            : {
                severity: 'success',
                text: `${file.name}: ${formatSport(result.sport)}, ${formatDate(result.start)}, ${formatDuration(result.duration)}, ${result.samples} heart-rate samples.`,
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
          <Alert key={m.text} severity={m.severity}>
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

const SessionsCard = ({ version }) => {
  const { classes } = useSettingsStyles();
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      const response = await fetchOrThrow('/api/athlete/sessions?days=60', { signal });
      setSessions(await response.json());
    },
    [version],
  );

  const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));
  const primaries = sessions.filter((s) => !s.duplicateOf);
  const alsoOn = (id) => sessions.filter((s) => s.duplicateOf === id).map(sourceLabel);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">{`Sessions - last 60 days (${primaries.length})`}</Typography>
      </AccordionSummary>
      <AccordionDetails className={classes.details}>
        {!primaries.length ? (
          <Typography variant="body2">
            No sessions yet. New workouts appear within 30 minutes of reaching Polar Flow or Strava,
            or use Sync now. Polar only shares workouts uploaded after you connected.
          </Typography>
        ) : (
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
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setOpen(open === s.id ? null : s.id)}
                  >
                    <TableCell>{formatDate(s.start)}</TableCell>
                    <TableCell>{formatSport(s.sport)}</TableCell>
                    <TableCell>{formatDuration(s.duration)}</TableCell>
                    <TableCell>{s.avgHr ? `${s.avgHr} / ${s.maxHr ?? '-'}` : '-'}</TableCell>
                    <TableCell>{[sourceLabel(s), ...alsoOn(s.id)].join(' + ')}</TableCell>
                  </TableRow>
                  {open === s.id && byId[s.id] && (
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
      <Container maxWidth="sm" className={classes.container}>
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
        <UploadCard onChanged={refresh} />
        <SessionsCard version={version} />
        {admin && integrations.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 4, mb: 1 }}>
              Administrator
            </Typography>
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.provider}
                integration={integration}
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
