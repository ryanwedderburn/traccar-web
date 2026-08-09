import { useMemo } from 'react';

export default (t) =>
  useMemo(
    () => ({
      language: {
        name: t('loginLanguage'),
        type: 'string',
      },
      mapGeofences: {
        name: t('attributeShowGeofences'),
        type: 'boolean',
      },
      mapLiveRoutes: {
        name: t('mapLiveRoutes'),
        type: 'string',
      },
      mapDirection: {
        name: t('mapDirection'),
        type: 'string',
      },
      mapFollow: {
        name: t('deviceFollow'),
        type: 'boolean',
      },
      mapCluster: {
        name: t('mapClustering'),
        type: 'boolean',
      },
      mapOnSelect: {
        name: t('mapOnSelect'),
        type: 'boolean',
      },
      activeMapStyles: {
        name: t('mapActive'),
        type: 'string',
      },
      devicePrimary: {
        name: t('devicePrimaryInfo'),
        type: 'string',
      },
      deviceSecondary: {
        name: t('deviceSecondaryInfo'),
        type: 'string',
      },
      soundEvents: {
        name: t('eventsSoundEvents'),
        type: 'string',
      },
      soundAlarms: {
        name: t('eventsSoundAlarms'),
        type: 'string',
      },
      positionItems: {
        name: t('attributePopupInfo'),
        type: 'string',
      },
      googleKey: {
        name: t('mapGoogleKey'),
        type: 'string',
      },
      locationIqKey: {
        name: t('mapLocationIqKey'),
        type: 'string',
      },
      mapboxAccessToken: {
        name: t('mapMapboxKey'),
        type: 'string',
      },
      mapTilerKey: {
        name: t('mapMapTilerKey'),
        type: 'string',
      },
      bingMapsKey: {
        name: t('mapBingKey'),
        type: 'string',
      },
      openWeatherKey: {
        name: t('mapOpenWeatherKey'),
        type: 'string',
      },
      tomTomKey: {
        name: t('mapTomTomKey'),
        type: 'string',
      },
      hereKey: {
        name: t('mapHereKey'),
        type: 'string',
      },
      notificationTokens: {
        name: t('attributeNotificationTokens'),
        type: 'string',
      },
      'ui.disableSavedCommands': {
        name: t('attributeUiDisableSavedCommands'),
        type: 'boolean',
      },
      'ui.disableGroups': {
        name: t('attributeUiDisableGroups'),
        type: 'boolean',
      },
      'ui.disableAttributes': {
        name: t('attributeUiDisableAttributes'),
        type: 'boolean',
      },
      'ui.disableEvents': {
        name: t('attributeUiDisableEvents'),
        type: 'boolean',
      },
      'ui.disableVehicleFeatures': {
        name: t('attributeUiDisableVehicleFeatures'),
        type: 'boolean',
      },
      'ui.disableDrivers': {
        name: t('attributeUiDisableDrivers'),
        type: 'boolean',
      },
      'ui.disableComputedAttributes': {
        name: t('attributeUiDisableComputedAttributes'),
        type: 'boolean',
      },
      'ui.disableCalendars': {
        name: t('attributeUiDisableCalendars'),
        type: 'boolean',
      },
      'ui.disableMaintenance': {
        name: t('attributeUiDisableMaintenance'),
        type: 'boolean',
      },
      'web.liveRouteLength': {
        name: t('attributeWebLiveRouteLength'),
        type: 'number',
      },
      mapLineWidth: {
        name: t('attributeMapLineWidth'),
        type: 'number',
      },
      mapLineOpacity: {
        name: t('attributeMapLineOpacity'),
        type: 'number',
      },
      'web.selectZoom': {
        name: t('attributeWebSelectZoom'),
        type: 'number',
      },
      'web.maxZoom': {
        name: t('attributeWebMaxZoom'),
        type: 'number',
      },
      iconScale: {
        name: t('sharedIconScale'),
        type: 'number',
      },
      navigationAppLink: {
        name: t('attributeNavigationAppLink'),
        type: 'string',
      },
      navigationAppTitle: {
        name: t('attributeNavigationAppTitle'),
        type: 'string',
      },
      // Ours. Declared HERE rather than in useUserAttributes or
      // useServerAttributes because this file is the one both the Account page
      // and the Server page pull in, and the widget is meant to be settable in
      // both places: on your own account to test it live without spectators
      // seeing it, then on the server to release it to everybody.
      //
      // Declared at all because the alternative is typing the key by hand into
      // a freeSolo autocomplete, and a mistyped key here fails exactly the way
      // a mistyped geofence attribute does - silently, with no error anywhere
      // and no widget. Same reasoning as the raceRoute convention note in
      // docs/CONTEXT.md, except this one is cheap to prevent.
      //
      // The `|| literal` fallbacks are the house pattern: a key added to
      // en.json alone renders EMPTY in every other locale, because
      // LocalizationProvider has no English fallback.
      eiWidgetToken: {
        name: t('attributeEiWidgetToken') || 'Support Widget: Token',
        type: 'string',
      },
      eiWidgetUrl: {
        name: t('attributeEiWidgetUrl') || 'Support Widget: Script URL',
        type: 'string',
      },
      eiWidgetCss: {
        name: t('attributeEiWidgetCss') || 'Support Widget: CSS',
        type: 'string',
      },
      // The bottom-bar label. An attribute because the assistant's name is
      // per-event branding - Roofus is ROA's - and the next event should not
      // need a build to be called something else.
      eiWidgetLabel: {
        name: t('attributeEiWidgetLabel') || 'Support Widget: Label',
        type: 'string',
      },
    }),
    [t],
  );
