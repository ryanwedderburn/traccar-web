// OURS, not upstream. What a device is, for deciding which features apply to it.
// Mirrors org.traccar.track.DeviceRole on the server - KEEP IN STEP.
// Stored as the device attribute "role"; unset means the default from its category.

export const DEVICE_ROLES = [
  {
    id: 'competitor',
    name: 'Competitor',
    help: 'Racing: course progress, laps and finish apply.',
  },
  { id: 'rider', name: 'Rider', help: 'Rides, but not in a race - no course progress.' },
  { id: 'vehicle', name: 'Vehicle', help: 'Support or private vehicle - no course progress.' },
  { id: 'person', name: 'Person', help: 'On foot - no course progress.' },
  { id: 'asset', name: 'Asset', help: 'Equipment, trailer, anything else.' },
];

const RIDERS = ['motorcycle', 'bicycle', 'scooter'];
const VEHICLES = ['car', 'van', 'truck', 'bus', 'camper', 'tractor'];

export const roleByCategory = (category) => {
  if (RIDERS.includes(category)) {
    return 'rider';
  }
  if (VEHICLES.includes(category)) {
    return 'vehicle';
  }
  return category === 'person' ? 'person' : 'asset';
};

export const roleName = (id) => DEVICE_ROLES.find((role) => role.id === id)?.name || id;

// OURS: who carries a unit that is not fitted to a bike or vehicle (Ryan, 30 Oct: "Personal is
// quite generic ... split that into Athlete, Crew, etc"). Device attribute `carrier`; it names the
// activity type for handhelds and phones. Unset: Athlete for a competitor or rider, else Personal.
export const CARRIERS = [
  { id: 'athlete', name: 'Athlete', help: 'Carried by the rider or competitor.' },
  { id: 'crew', name: 'Crew', help: 'Support crew, pit or chase.' },
  { id: 'official', name: 'Official', help: 'Race officials, sweep, marshals.' },
  { id: 'media', name: 'Media', help: 'Media or camera crew.' },
  { id: 'medic', name: 'Medic', help: 'Medical staff.' },
  { id: 'personal', name: 'Personal', help: 'Anyone else.' },
];

export const BIKE_CATEGORIES = RIDERS;

/* The activity type for a unit: an `activityType` override, else Drive for a vehicle, Bike for a
   unit on a bike, else who carries it. `role` is the activity's stored role. */
export const activityTypeOf = (role, device) => {
  const named = device?.attributes?.activityType;
  if (named) return String(named);
  if (role === 'vehicle') return 'Drive';
  if (RIDERS.includes(device?.category)) return 'Bike';
  const carrier = CARRIERS.find((c) => c.id === device?.attributes?.carrier);
  if (carrier) return carrier.name;
  return role === 'competitor' || role === 'rider' ? 'Athlete' : 'Personal';
};
