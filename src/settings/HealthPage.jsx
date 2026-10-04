// OURS, not upstream: Settings - Connected services (docs/RIDER-HEALTH.md, increment 1).
// A user links Polar or Strava to their own account; an administrator enters the platform's
// client credentials. Every step is on this screen - no .env edits, no scripts.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import useSettingsStyles from './common/useSettingsStyles';
import { useAdministrator } from '../common/util/permissions';
import { useAsyncTask } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';

// Bump together with AthleteDataResource.CONSENT_VERSION when this wording changes.
const CONSENT_TEXT = 'I agree that WLAB may store heart-rate and workout data from this service against my '
  + 'account, to show it to me and to compare it with my tracking and bike data. It is health information: '
  + 'it is never shown publicly or used for race results, nobody else sees it unless I share it, and '
  + 'disconnecting stops collection and deletes the link. Riders under 18 need a parent or guardian to agree.';

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

  const disconnect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetchOrThrow(`/api/athlete/providers/${provider.provider}/link`, { method: 'DELETE' });
      const result = await response.json();
      const warning = `Disconnected here, but ${provider.name} reported: ${result.revokeError}. `
        + `Remove WLAB in your ${provider.name} settings too.`;
      setMessage(result.revokeError
        ? { severity: 'warning', text: warning }
        : { severity: 'success', text: `${provider.name} disconnected.` });
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
              control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} />}
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
    integration.redirectUri || `${window.location.origin}/api/athlete/callback/${integration.provider}`,
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
          {`Register this redirect URL with ${integration.name} exactly as shown, `
            + 'then paste the client ID and secret it gives you.'}
        </Typography>
        <TextField label="Redirect URL" value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} />
        <TextField label="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} />
        <TextField
          label={integration.secretSet ? 'Client secret (stored - leave blank to keep)' : 'Client secret'}
          type="password"
          autoComplete="new-password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
        />
        <FormControlLabel
          control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
          label="Offer to users"
        />
        <Button variant="contained" onClick={save}>Save</Button>
        {integration.updated && (
          <Typography variant="caption">{`Last saved ${formatDate(integration.updated)}`}</Typography>
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
      const name = searchParams.get('provider');
      const detail = searchParams.get('message');
      if (result === 'connected') {
        setBanner({ severity: 'success', text: `${name} connected.` });
      } else if (result === 'denied') {
        setBanner({ severity: 'info', text: `${name} was not connected - permission was not granted.` });
      } else {
        setBanner({ severity: 'error', text: `${name} could not be connected${detail ? `: ${detail}` : '.'}` });
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useAsyncTask(async ({ signal }) => {
    const response = await fetchOrThrow('/api/athlete/providers', { signal });
    setProviders(await response.json());
    if (admin) {
      const adminResponse = await fetchOrThrow('/api/athlete/integrations', { signal });
      setIntegrations(await adminResponse.json());
    }
  }, [admin, version]);

  const refresh = () => setVersion((v) => v + 1);

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['Connected services']}>
      <Container maxWidth="sm" className={classes.container}>
        {banner && <Alert severity={banner.severity} onClose={() => setBanner(null)}>{banner.text}</Alert>}
        <Typography variant="body2" sx={{ my: 2 }}>
          Link the apps that record your heart rate and workouts. Your data stays private to you.
        </Typography>
        {providers.map((provider) => (
          <ProviderCard key={provider.provider} provider={provider} onChanged={refresh} />
        ))}
        {admin && integrations.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 4, mb: 1 }}>Administrator</Typography>
            {integrations.map((integration) => (
              <IntegrationCard key={integration.provider} integration={integration} onSaved={refresh} />
            ))}
          </>
        )}
      </Container>
    </PageLayout>
  );
};

export default HealthPage;
