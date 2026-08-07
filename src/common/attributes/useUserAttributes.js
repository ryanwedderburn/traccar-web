import { useMemo } from 'react';

export default (t) =>
  useMemo(
    () => ({
      telegramChatId: {
        name: t('attributeTelegramChatId'),
        type: 'string',
      },
      'notificator.telegram.sendLocation': {
        name: t('attributeTelegramSendLocation'),
        type: 'boolean',
      },
      pushoverUserKey: {
        name: t('attributePushoverUserKey'),
        type: 'string',
      },
      pushoverDeviceNames: {
        name: t('attributePushoverDeviceNames'),
        type: 'string',
      },
      'mail.smtp.host': {
        name: t('attributeMailSmtpHost'),
        type: 'string',
      },
      'mail.smtp.port': {
        name: t('attributeMailSmtpPort'),
        type: 'number',
      },
      'mail.smtp.starttls.enable': {
        name: t('attributeMailSmtpStarttlsEnable'),
        type: 'boolean',
      },
      'mail.smtp.starttls.required': {
        name: t('attributeMailSmtpStarttlsRequired'),
        type: 'boolean',
      },
      'mail.smtp.ssl.enable': {
        name: t('attributeMailSmtpSslEnable'),
        type: 'boolean',
      },
      'mail.smtp.ssl.trust': {
        name: t('attributeMailSmtpSslTrust'),
        type: 'string',
      },
      'mail.smtp.ssl.protocols': {
        name: t('attributeMailSmtpSslProtocols'),
        type: 'string',
      },
      'mail.smtp.from': {
        name: t('attributeMailSmtpFrom'),
        type: 'string',
      },
      'mail.smtp.auth': {
        name: t('attributeMailSmtpAuth'),
        type: 'boolean',
      },
      'mail.smtp.username': {
        name: t('attributeMailSmtpUsername'),
        type: 'string',
      },
      'mail.smtp.password': {
        name: t('attributeMailSmtpPassword'),
        type: 'string',
      },
      termsAccepted: {
        name: t('userTermsAccepted'),
        type: 'boolean',
      },
      billingLink: {
        name: t('userBilling'),
        type: 'string',
      },
      // Ours. Declared here mainly so the editor renders a checkbox and stores
      // a real boolean - typed by hand it becomes the string "true", and the
      // string "false" is every bit as truthy. See common/util/useKiosk.js.
      kiosk: {
        name: t('attributeUiKiosk'),
        type: 'boolean',
      },
      // Ours. Same keys the server record uses, so the meaning is already
      // familiar - these simply win over it for this account. Declared here so
      // the editor renders a colour picker rather than a text box, which also
      // keeps the value in the #rrggbb form palette.js will accept: anything
      // else is silently ignored and falls back to indigo.
      colorPrimary: {
        name: t('serverColorPrimary'),
        type: 'string',
        dataType: 'color',
      },
      colorSecondary: {
        name: t('serverColorSecondary'),
        type: 'string',
        dataType: 'color',
      },
      darkMode: {
        name: t('settingsDarkMode'),
        type: 'boolean',
      },
    }),
    [t],
  );
