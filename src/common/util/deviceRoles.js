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
