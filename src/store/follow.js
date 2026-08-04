import { createSlice } from '@reduxjs/toolkit';

/**
 * The single device the map is following, if any.
 *
 * Deliberately not persisted. Favourites are a durable choice; following is a
 * live viewing mode you turn on for a stretch and expect to lapse when the tab
 * reloads or the phone locks.
 *
 * This exists rather than reusing the mapFollow user attribute because that
 * attribute is stored on the account: on a shared spectator login it would be
 * one setting for everyone, and a read-only user cannot write it at all.
 */

const { reducer, actions } = createSlice({
  name: 'follow',
  initialState: {
    deviceId: null,
  },
  reducers: {
    toggle(state, action) {
      state.deviceId = state.deviceId === action.payload ? null : action.payload;
    },
    clear(state) {
      state.deviceId = null;
    },
  },
});

export { actions as followActions };
export { reducer as followReducer };
