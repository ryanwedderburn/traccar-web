import { useEffect } from 'react';
import { useAttributePreference } from '../util/preferences';

/**
 * Loads the event-intelligence web widget - "Roofus" - into the tracking app.
 *
 * The whole thing is one script tag. What is not one script tag is *where* the
 * tag comes from, and that is the only interesting decision here.
 *
 * CONFIGURED BY ATTRIBUTE, NOT BAKED IN. `eiWidgetToken` is read the same way
 * as `colorPrimary` and `logo` - user attributes first, then server - so Roofus
 * can be switched on, switched off, re-tokened or given to one account and not
 * another from the admin UI, with no rebuild and no deploy. During an event
 * that is the difference between a thirty-second fix and a build-and-ship, and
 * the token stays out of git either way.
 *
 * WHY NOT index.html. Two reasons, both about the service worker. Workbox
 * precaches the built index.html and answers every navigation from precache
 * (`registerType: 'autoUpdate'`), so a tag added to an *overridden* index.html
 * in web.override would never be seen - the browser does not ask the server at
 * all. The Vite source index.html would work, but it hard-codes the token in
 * the repo and needs a build to change. This costs one component and buys the
 * runtime switch.
 *
 * The trade accepted: attributes need a session, so Roofus appears after login
 * rather than on the login screen.
 */

// Attribute names, all optional except the token:
//
//   eiWidgetToken  the embed token. Absent means no widget at all.
//   eiWidgetUrl    the script, so a staging build can be pointed elsewhere.
//   eiWidgetCss    raw CSS, injected alongside. See below.
const DEFAULT_URL = 'https://ei.wlab.co.za/widget.js';

const SCRIPT_ID = 'ei-widget-script';
const STYLE_ID = 'ei-widget-style';

const SupportWidget = () => {
  const token = useAttributePreference('eiWidgetToken');
  const url = useAttributePreference('eiWidgetUrl', DEFAULT_URL);
  const css = useAttributePreference('eiWidgetCss');

  useEffect(() => {
    if (!token) {
      return;
    }
    // Idempotent, and deliberately never removed. The widget appends its own
    // DOM, which is not ours to tidy up, so tearing the script out on unmount
    // would leave the launcher behind and then add a second one on the way
    // back. Load once per page load; changing the token takes a reload.
    if (document.getElementById(SCRIPT_ID)) {
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = url;
    script.dataset.eiToken = token;
    // `defer` is meaningless on a dynamically inserted script - it is async by
    // definition - so it is left off rather than written down and ignored.
    document.body.appendChild(script);
  }, [token, url]);

  /**
   * An escape hatch for placement, and it earns its keep.
   *
   * Bottom-right is the busiest corner of this app: maplibre's attribution
   * control sits there, the phone bottom bar is 56px of Map/POI/Logout, and the
   * StatusCard opens across the bottom whenever a rider is selected. The
   * launcher will need an offset, and the selector to hang it on cannot be
   * known until the widget has rendered on a real screen.
   *
   * Shipping a guessed selector would be worse than shipping none. So the
   * offset is an attribute: look at it on the handset, write the rule, paste it
   * into Server attributes. Nudging a button during race week should not
   * require a deploy.
   */
  useEffect(() => {
    if (!css) {
      return () => {};
    }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
    return () => style.remove();
  }, [css]);

  return null;
};

export default SupportWidget;
