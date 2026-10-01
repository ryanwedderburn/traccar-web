import { useEffect, useMemo, useState } from 'react';
import useEventUi from './useEventUi';

/**
 * Which date each day of an event is, and which day is today.
 *
 * OURS. Ryan, 2026-09-29: some spectators did not know to change the Day
 * selector and watched the previous day's routes. Days are bare labels - TT,
 * 2, 3 - so nothing could choose for them. The dates now live on the event
 * group (manage.html, Event tab) and come back from /api/eventdays, which any
 * signed-in account can read - rider accounts cannot see the event group
 * itself.
 *
 * Fetched once. A race calendar does not change mid-session, and an install
 * without the endpoint (or with no dates set) just leaves the selector as it
 * was: no error, no toast - this is a convenience, not a dependency.
 *
 * `today` is the event's local date, re-read every minute so a page left open
 * overnight rolls over to the next day without a reload.
 */

const localDate = (timeZone) => {
  try {
    // en-CA formats as YYYY-MM-DD, the same shape the dates are stored in.
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA').format(new Date());
  }
};

/** "Fri 25 Sep" - short, because it sits inside a select on a phone. */
export const formatEventDate = (isoDate) => {
  if (!isoDate) {
    return '';
  }
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
};

export default (event) => {
  const eventUi = useEventUi();
  const [calendars, setCalendars] = useState([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!eventUi) {
      return undefined;
    }
    const controller = new AbortController();
    fetch('/api/eventdays', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((items) => setCalendars(Array.isArray(items) ? items : []))
      .catch(() => {});
    return () => controller.abort();
  }, [eventUi]);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    /* Matched the way manage.html matches an event to its group - case and
       punctuation stripped - because ROA2026 against ROA-2026 is exactly the
       difference that has bitten before. */
    const key = (value) =>
      String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    const calendar = event ? calendars.find((item) => key(item.event) === key(event)) : null;
    if (!calendar) {
      return { dates: {}, today: null, todayDay: null };
    }
    const today = localDate(calendar.timezone);
    const dates = calendar.days || {};
    const todayDay = Object.keys(dates).find((day) => dates[day] === today) || null;
    return { dates, today, todayDay };
    // tick re-evaluates the date once a minute
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [calendars, event, tick]);
};
