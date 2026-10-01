import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

/*
 * The tool pages beside the live map - Event setup, Record the course, Who is
 * still out, and whatever comes next - for the Account menu.
 *
 * THE LIST IS /tools.json, NOT THIS BUILD. It is served from web.override, so a
 * new tool is a page plus one line there, live on `git pull` with no rebuild of
 * this app. The tool pages read the same file through /tools.js and draw the
 * same list as a strip with "Live map" back, so every hop has a return trip.
 *
 * toolsVisible() MUST MATCH the copy in deploy/override/tools.js. Two copies
 * because one side is this bundle and the other is a plain script on pages this
 * app does not own; the rule is four lines and docs/TOOLS.md states it once.
 *
 * A missing or broken tools.json means no tool entries, never a broken menu:
 * the failure is an absent link, which is what a host without tools gets anyway.
 */
const truthy = (value) => value === true || value === 'true';

export const toolsVisible = (tools, user, server) => {
  if (!user) return [];
  const admin = Boolean(user.administrator);
  const kiosk = truthy(user.attributes?.kiosk);
  const listed = String(server?.attributes?.tools || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return (tools || []).filter((t) => {
    if (t.perHost && !admin && !listed.includes(t.id)) return false;
    if (t.who === 'admin') return admin;
    if (t.who === 'writer') return admin || !user.readonly;
    return admin || !kiosk;
  });
};

let registry = null;

export default () => {
  const user = useSelector((state) => state.session.user);
  const server = useSelector((state) => state.session.server);
  const [tools, setTools] = useState(registry || []);

  useEffect(() => {
    if (registry) return undefined;
    const controller = new AbortController();
    fetch('/tools.json', {
      // Served max-age=3600; without this a new tool is invisible for an hour.
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        registry = Array.isArray(json?.tools) ? json.tools : [];
        setTools(registry);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return toolsVisible(tools, user, server);
};
