import { createSlice, current } from '@reduxjs/toolkit';

/**
 * Favourite devices, held per browser rather than per account.
 *
 * This is deliberate. The driving use case is an event where many spectators
 * share a single read-only login: storing favourites against the user would
 * give hundreds of people one shared list, and each of them would overwrite
 * the others. localStorage is scoped to the browser profile, which is the
 * granularity we actually want - one list per phone.
 *
 * It also means no API writes, so the shared account can stay genuinely
 * read-only with no permission exceptions carved out for it.
 *
 * Values are still namespaced by user id so that a spectator login and an
 * administrator login on the same browser do not collide.
 */

const STORAGE_KEY = 'favourites';

const storageKeyFor = (userId) => String(userId ?? 'anonymous');

const readAll = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
};

const writeAll = (all) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage can be full, disabled, or evicted by the browser. Favourites are
    // a convenience, so losing them must never break the page.
  }
};

const { reducer, actions } = createSlice({
  name: 'favourites',
  initialState: {
    all: readAll(),
  },
  reducers: {
    toggle(state, action) {
      const { userId, deviceId } = action.payload;
      const key = storageKeyFor(userId);
      const list = state.all[key] || [];
      state.all[key] = list.includes(deviceId)
        ? list.filter((id) => id !== deviceId)
        : [...list, deviceId];
      writeAll(current(state).all);
    },
    clear(state, action) {
      const key = storageKeyFor(action.payload);
      delete state.all[key];
      writeAll(current(state).all);
    },
  },
});

export { actions as favouritesActions };
export { reducer as favouritesReducer };
