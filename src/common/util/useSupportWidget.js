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

  useEffect(() => {
    if (document.querySelector(LAUNCHER_SELECTOR)) {
      setReady(true);
      return () => {};
    }
    const observer = new MutationObserver(() => {
      if (document.querySelector(LAUNCHER_SELECTOR)) {
        setReady(true);
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

  return { ready, toggle };
};
