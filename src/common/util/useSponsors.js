import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material';

/**
 * The event's sponsors, per host.
 *
 * OURS, not upstream. Read from the SERVER attributes rather than the user's,
 * for the same reason useEventUi does: HostBranding merges each host's
 * `hostBranding` entry into /api/server, so `sponsors` on roa.wlab.co.za is
 * ROA's list and every other host is untouched. Nu-Tec or next year's event
 * gets the whole feature by adding an entry of their own - no code.
 *
 * ANYTHING IN hostBranding IS PUBLIC. /api/server is @PermitAll and the whole
 * entry is merged into it, which BRANDING.md is explicit about for liveUser.
 * For sponsor names, logos and links that is exactly right - they are meant to
 * be seen - and it is worth stating because the same fact made the rider's
 * phone number the wrong thing to put anywhere near here.
 *
 * <p><b>The shape.</b> An ordered list, from the first sponsor:
 *
 * <pre>
 *   "sponsors": [
 *     { "name": "Lenderu", "tier": "title",
 *       "url": "https://lenderu.co.ls",
 *       "logoDark":  "/roa/sponsors/lenderu-on-dark.svg",
 *       "logoLight": "/roa/sponsors/lenderu-on-light.svg" }
 *   ]
 * </pre>
 *
 * A LIST EVEN WITH ONE ENTRY, deliberately. ROA 2026 has one title sponsor and
 * roughly eighteen partners; shaping this as a single object now would make the
 * second one a code change instead of a config change.
 *
 * <p><b>Two logo files, not one.</b> Traccar has a light theme as well as a
 * dark one, and a reversed logo on a light background is an invisible logo -
 * which reads as a broken image rather than as a missing sponsor. Lenderu ships
 * both variants; a sponsor supplying only one gets that one in both themes,
 * which is better than nothing and visibly wrong in a way somebody will fix.
 *
 * NEVER recolour a brand's logo to fit a theme. Picking between the files they
 * gave us is ours to do; changing their colours is not.
 *
 * <p><b>Files, not data URIs.</b> The logos live under deploy/override/ and are
 * referenced by path, the same as favicon and appIcon in BRANDING.md. Inlining
 * eighteen logos into the branding attribute would put them in /api/server,
 * which every client fetches on load - a real cost for riders on a tethered
 * phone who will never look at a sponsor.
 */

/**
 * Parse whatever the attribute holds into a usable list. Pure, so it can be
 * asserted without React - see scripts/test-sponsors.mjs.
 *
 * NEVER THROWS. This is hand-edited JSON in a free-text attribute field
 * (BRANDING.md's own "known gaps"), so a stray comma is not a hypothetical. A
 * malformed list must cost the sponsor block, not the login page - nobody
 * should be locked out of tracking because a logo path had a typo.
 */
export const parseSponsors = (value) => {
  let list = value;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) {
    return [];
  }
  return (
    list
      .filter((item) => item && typeof item === 'object')
      /* A sponsor with no logo at all cannot be rendered, and a name-only entry
       would draw an empty box that looks like a failed image. Dropped quietly:
       the operator sees it missing and fixes the entry. */
      .filter((item) => item.logoDark || item.logoLight || item.logo)
      .map((item) => ({
        name: String(item.name || '').trim(),
        tier: String(item.tier || '')
          .trim()
          .toLowerCase(),
        url: String(item.url || '').trim(),
        logoDark: String(item.logoDark || item.logo || item.logoLight || '').trim(),
        logoLight: String(item.logoLight || item.logo || item.logoDark || '').trim(),
      }))
  );
};

/** The title sponsor, or nothing. The login page shows this one and no others. */
export const titleSponsor = (sponsors) => sponsors.find((item) => item.tier === 'title') || null;

export default () => {
  const attribute = useSelector((state) => state.session.server?.attributes?.sponsors);
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';

  return useMemo(() => {
    const sponsors = parseSponsors(attribute).map((item) => ({
      ...item,
      logo: dark ? item.logoDark : item.logoLight,
    }));
    return { sponsors, title: titleSponsor(sponsors) };
  }, [attribute, dark]);
};
