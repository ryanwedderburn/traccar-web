import { useCallback, useEffect, useState } from 'react';

/**
 * Driving the event-intelligence chat widget from our own UI.
 *
 * The widget ships its own floating launcher, bottom-right. That corner is
 * already the busiest part of this app - maplibre's controls, the attribution,
 * and on a phone the 56px bottom bar - so the launcher lands on top of the
 * navigation. `SupportWidget` hides it and this drives it from a bottom-bar
 * entry instead, which gives it one fixed home on a phone and on the desktop
 * sidebar alike.
 *
 * HOW IT IS DRIVEN, and why it looks like this. Read the source before
 * changing it: `event_intelligence/integrations/channels/widget/static/widget.js`.
 *
 * - The widget is an **IIFE and exports nothing**. There is no `window` API to
 *   call, so the only handle on it is the DOM.
 * - Its launcher is `button.eiw-bubble` and the click handler is
 *   `setOpen(!open)`, so **one synthetic click is a toggle** - exactly the
 *   semantics wanted, with no state to mirror on our side.
 * - `HTMLElement.click()` fires on a `display: none` element, which is what
 *   makes hiding the launcher and driving it from elsewhere work at all.
 * - No shadow DOM. Everything is plain DOM on `document.body`, which is also
 *   why `eiWidgetCss` can reach it.
 *
 * This couples us to a class name in another repo. The clean fix is five lines
 * on the EI side - `window.eiWidget = { open, close, toggle }` - and the toggle
 * below already prefers it, so adding it there needs no change here.
 */

// The launcher. A class rather than an id because widget.js sets `className`
// and never an id, and the root container it lives in is unmarked entirely.
export const LAUNCHER_SELECTOR = 'button.eiw-bubble';

export default () => {
  // The widget mounts only after its /config fetch resolves, so it is never
  // present on our first render and may never appear at all - a rejected token
  // or an origin the EI side does not allow both end with no widget and no
  // error. Watching for it means the bottom-bar entry can hide itself until
  // Roofus is genuinely there, the same self-hiding rule POI and RouteFilter
  // already follow. A control that quietly does nothing is the thing being
  // avoided.
  const [ready, setReady] = useState(false);

  // The assistant's own avatar, lifted off the launcher we are already
  // watching. Roofus is the recognisable thing about this channel and a generic
  // headset icon throws that away.
  //
  // Read as a STRING, once, and never held as a node: `setOpen(true)` replaces
  // the launcher's innerHTML with a × and `applyLogo()` rebuilds the image on
  // close, so any reference to the element itself would be detached the first
  // time anyone opened the panel.
  //
  // Taken from the DOM rather than by calling /api/widget/{token}/config
  // ourselves: it is the same coupling we already have for the click, it costs
  // no second request, and it cannot disagree with what the widget is showing.
  // Absent when the edition has no logo configured - widget.js falls back to a
  // speech-balloon glyph, and so do we, to a MUI icon.
  const [logo, setLogo] = useState(null);

  useEffect(() => {
    const found = (launcher) => {
      // Prefer the API. `window.eiWidget.logo()` was added on the EI side on
      // 2026-08-09 for exactly this, so a host rendering its own launcher does
      // not have to read the avatar back out of the widget's DOM. The scrape
      // stays as the fallback: an embed served by an older build has no API,
      // and this must not go blank on one.
      setLogo(window.eiWidget?.logo?.() || launcher.querySelector('img')?.src || null);
      setReady(true);
    };

    const existing = document.querySelector(LAUNCHER_SELECTOR);
    if (existing) {
      found(existing);
      return () => {};
    }
    const observer = new MutationObserver(() => {
      const launcher = document.querySelector(LAUNCHER_SELECTOR);
      if (launcher) {
        found(launcher);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, []);

  const toggle = useCallback(() => {
    // Preferred if the EI side ever grows a real API; the click is the
    // fallback that works today.
    if (typeof window.eiWidget?.toggle === 'function') {
      window.eiWidget.toggle();
      return;
    }
    document.querySelector(LAUNCHER_SELECTOR)?.click();
  }, []);

  return { ready, logo, toggle };
};
