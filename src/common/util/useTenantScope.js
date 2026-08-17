import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

const truthy = (value) => value === true || value === 'true';

/**
 * The devices this host's tenant claims, for narrowing the list to one product.
 *
 * WHY THIS EXISTS. Traccar decides visibility from user-device links, and links
 * are host-blind. So an account that spans two products sees both fleets merged
 * with one product's chrome around them - Graham on telematics.wlab.co.za got
 * the ROA devices and not the telematics machines. Nobody saw data they should
 * not; the product simply stopped being the product.
 *
 * CONTEXT, NOT AUTHORISATION. changelog-wlab-2 is explicit that claims are
 * "attribution, not authorisation" and that tc_user_device remains the only
 * thing deciding who may see what. This narrows a list the account was already
 * entitled to. It must never be the thing that grants, and it is deliberately
 * client-side to keep that obvious - a filter in the browser cannot be mistaken
 * for a security boundary by someone reading it later.
 *
 * OFF BY DEFAULT, on the `tenantScope` server attribute - the same self-hiding
 * convention as coverageUi and eventUi, and for a sharper reason here. Claims
 * are incomplete by design (39 of 69 devices carry none, and always will), so
 * switching this on for a host whose claims are not yet right would empty
 * somebody's device list. A flag means it can be turned on one host at a time
 * and turned off again in one edit, rather than discovered during an event.
 *
 * FAILS OPEN, ALWAYS. A failed request, an unreachable endpoint, a host with no
 * tenant - every one of them returns "do not filter". A device list that is too
 * broad is a cosmetic problem; a device list that is empty during an event is
 * indistinguishable from the platform being down, and someone will be looking at
 * it on a phone in Lesotho at 11pm.
 */
export default () => {
  const enabled = useSelector((state) => truthy(state.session.server?.attributes?.tenantScope));
  const [ids, setIds] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setIds(null);
      return () => {};
    }
    const controller = new AbortController();
    fetch('/api/tenant/scope', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        /* scoped:false is a host with no tenant - the platform view - and is
           NOT the same as a tenant that claims nothing. Collapsing the two would
           blank the list on traccar.wlab.co.za, which is the one host that must
           always show everything. */
        if (body && body.scoped && Array.isArray(body.deviceIds)) {
          setIds(body.deviceIds);
        } else {
          setIds(null);
        }
      })
      .catch(() => setIds(null));
    return () => controller.abort();
  }, [enabled]);

  /* A Set, because this runs inside the device filter on every keystroke and
     every position update. */
  const index = useMemo(() => (ids === null ? null : new Set(ids)), [ids]);

  const inScope = useMemo(() => (deviceId) => index === null || index.has(deviceId), [index]);

  return { scoped: index !== null, inScope };
};
