/**
 * J1939 DM1 decoding, client-side - the "dealer's parts-sales trigger" from
 * HEAVY-EQUIPMENT.md, first slice.
 *
 * The FMC650 reports DTC DM1 as a packed unsigned 32 (FMS id 10493, mapped
 * to the `dm1` attribute by computed attribute). Layout assumed per
 * J1939-73: SPN in the top 19 bits, FMI in the next 5, CM 1 bit, OC in the
 * low 7. **Verify against a real FMC650 before trusting in anger** - the
 * simulator packs the same layout, so the demo is self-consistent either
 * way, but Teltonika's byte order needs confirming on hardware
 * (runbook, "Left for the next Phase 2 sessions").
 *
 * FMI meanings are the complete standard table - there are only 22 - so any
 * fault at least says what KIND of wrong. SPN names are a curated subset of
 * the components that matter on diesel plant; an unknown SPN renders as
 * "SPN 1234", which is still enough for a dealer to look up.
 */

const FMI = {
  0: 'above normal - most severe',
  1: 'below normal - most severe',
  2: 'erratic or incorrect data',
  3: 'voltage above normal',
  4: 'voltage below normal',
  5: 'current below normal',
  6: 'current above normal',
  7: 'not responding properly',
  8: 'abnormal frequency',
  9: 'abnormal update rate',
  10: 'abnormal rate of change',
  11: 'root cause unknown',
  12: 'bad device or component',
  13: 'out of calibration',
  14: 'special instructions',
  15: 'above normal - least severe',
  16: 'above normal - moderate',
  17: 'below normal - least severe',
  18: 'below normal - moderate',
  19: 'network data error',
  20: 'data drifted high',
  21: 'data drifted low',
  31: 'condition exists',
};

const SPN = {
  91: 'Accelerator pedal position',
  94: 'Fuel delivery pressure',
  98: 'Engine oil level',
  100: 'Engine oil pressure',
  102: 'Boost pressure',
  105: 'Intake manifold temperature',
  107: 'Air filter differential pressure',
  110: 'Engine coolant temperature',
  111: 'Engine coolant level',
  158: 'Battery potential (switched)',
  168: 'Battery potential',
  173: 'Exhaust gas temperature',
  174: 'Fuel temperature',
  175: 'Engine oil temperature',
  177: 'Transmission oil temperature',
  190: 'Engine speed',
  237: 'VIN',
  611: 'Injector wiring',
  629: 'Engine controller',
  639: 'J1939 data link',
  723: 'Engine speed sensor',
  1761: 'DEF/AdBlue tank level',
  3226: 'NOx sensor (aftertreatment)',
  3251: 'DPF differential pressure',
  3719: 'DPF soot load',
  5246: 'SCR inducement (derate imminent)',
};

const decodeDm1 = (value) => {
  const packed = Number(value);
  if (!packed || Number.isNaN(packed)) {
    return null;
  }
  const spn = (packed >>> 13) & 0x7ffff;
  const fmi = (packed >>> 8) & 0x1f;
  const oc = packed & 0x7f;
  if (!spn) {
    return null;
  }
  return {
    spn,
    fmi,
    oc,
    component: SPN[spn] || `SPN ${spn}`,
    condition: FMI[fmi] || `FMI ${fmi}`,
    // Most-severe FMIs and repeat offenders read as urgent.
    severe: fmi <= 1 || fmi === 12 || oc > 5,
  };
};

export default decodeDm1;
