// keagame/copy — everything the Department says to the kea in Kea mode. The kea ignores all of it.
// Deadpan, official, addressed to the bird. The joke is on the procedures: never on the tourists or the ranger.
// Pure data (no DOM). Template lines are functions, called only on events (never per frame).

const of = (name) => name + (/s$/i.test(name) ? "'" : "'s");

export const PART_NAME = { wiper: 'Wiper blade', seal: 'Seal strip', mirror: 'Wing mirror', strap: 'Roof-pod strap', cone: 'Road cone' };

export const KEA_COPY = {
  start: [
    'Notice to kea: this is not your car park.',
    'Shift 0417 commenced. The highway is closed. The kea has been informed. The kea was not listening.',
  ],
  pullStart: [
    'Notice to kea: campervan rubber is not a native food source.',
    'A kea has been observed near a campervan. The Department is concerned. The kea is not.',
    'Notice to kea: please step away from the vehicle. This notice has been laminated.',
  ],
  pulled: {
    wiper: 'Wiper blade removed. The Department has noted this.',
    seal: 'Seal strip removed. A draught has been reported. The Department has noted this as well.',
    mirror: 'Wing mirror removed. The tourists can no longer see the kea behind them. The kea is behind them.',
    strap: 'Roof-pod strap removed. The roof pod is now held on by optimism.',
    cone: 'The Department\'s road cone has left the road. The road remains closed, out of habit.',
  },
  banked: [
    (n, q) => `Items held for research: ${n} of ${q}. The Department did not authorise this count.`,
    (n, q) => `Item lodged on the north scree (${n} of ${q}). Classified as "held for research". Research has not been defined.`,
    (n, q) => `Another item on the ledge (${n} of ${q}). The ledge is not an approved storage facility.`,
  ],
  coneBanked: 'Road cone sighted on the north scree. It is being used as a monument. A monument has not been approved.',
  quota: 'Quota of 9 recorded. The Department notes there is no quota. The Department also notes the cone.',
  quotaNoCone: 'Nine items held for research. The road cone remains at the gate. The Department is relieved, provisionally.',
  coneReturned: 'The road cone has been returned to the gate. The paperwork took longer than the walk.',
  coneDropped: 'Road cone dropped in transit. Its location has been noted. Recovery has been scheduled for after the shift.',
  offended: [
    (n) => `Kea offended (${n}). Offence has been logged.`,
    (n) => `Kea offended (${n}). A grievance has been lodged. The grievance is a squawk.`,
  ],
  offendedMax: 'Kea offended (3). Maximum offence reached. The Department did not know there was a maximum.',
  notice: [
    'Notice 1 of 3 issued: removing campervan parts during an airflow event. Please read the notice.',
    'Notice 2 of 3 issued. The previous notice has been chewed.',
    'Notice 3 of 3 issued. Relocation has been scheduled. The kea has not been consulted.',
  ],
  shakeClear: 'Shaking has stopped. The ranger held. The kea did not. Noted, not actioned.',
  possumLock: (name) => `A possum has entered ${of(name)} campervan. Notice to kea: this van is occupied. Please wait your turn.`,
  possumGone: (name) => `${of(name)} campervan is no longer occupied by a possum. That is not an invitation.`,
  perch: (name) => `Kea on ${of(name)} campervan. Notice to kea: this is not a perch.`,
  perchOffended: (name, n) => `Offended kea (grievance level ${n}) on ${of(name)} campervan. The tourists have been told it is fine.`,
  squawk: 'Loud squawk reported. The ranger has investigated. The investigation found a squawk.',
  minute: [
    [300, 'Reopening estimate unchanged. The kea is reminded that the road will reopen. The kea has not asked.'],
    [180, 'A geotechnical engineer has looked at the slip. A kea has looked at the engineer. Both have concerns.'],
    [60, 'One minute to reopening. The road cone is a key part of reopening. Please return the road cone.'],
    [20, 'Final checks. Tourists are asked to locate their wiper blades.'],
  ],
};

// aftershock banner (kea mode): same drop, cover, hold, same procedure, different audience
export const KEA_ALERT = {
  alertTop: 'Aftershock alert · Emergency mobile alert',
  shakeTop: 'Aftershock in progress',
  alertSub: 'Drop, cover and hold. This applies to kea. It does not apply to kea.',
  holdSub: 'The ranger is holding. The Department asks that you do not take advantage of this.',
};

// advisory ticker under the reopening estimate (kea mode)
export const KEA_TICKER = [
  'Kea are a protected species. Campervan parts are not. This is under review.',
  'Do not feed the kea. The kea is not hungry. The kea is curious, and has a beak.',
  'Drop, cover and hold applies to all visitors, staff and wildlife. Wildlife has not confirmed.',
  'The road cone is Department property. Department property is not to be taken up the scree.',
  'Items found on the north scree will be returned once the Department can reach the north scree.',
  'The possum is a pest. The kea is not a pest. The kea is reminded not to behave like one.',
];

export const KEA_END = {
  'kea:won': {
    kicker: 'Incident report · Kea activity · Shift 0417',
    heading: 'Road open',
    sub: 'Road open. The kea have kept the cone.',
  },
  'kea:reopened': {
    kicker: 'Incident report · Kea activity · Shift 0417',
    heading: 'Road open',
    sub: 'Road open. The kea have not kept the cone. Yet.',
  },
  'kea:relocated': {
    kicker: 'Notice of relocation · Kea, adult, olive',
    heading: 'Relocated',
    sub: 'You have been relocated to a quieter car park. You will find your way back.',
  },
};

export const CONE_STATUS = { gate: 'At the gate (Department property)', carried: 'In transit (unauthorised)', dropped: 'Dropped (location noted)', banked: 'Held by the kea' };

export const CONE_HUD = { gate: 'At the gate', carried: 'In transit', dropped: 'Dropped (noted)', banked: 'Held by the kea' };

export const KEA_RATINGS = [
  [0.9, 'Risk confirmed'],
  [0.7, 'Under active investigation'],
  [0.45, 'Of ongoing concern'],
  [0.2, 'Noted'],
  [-1, 'Largely ignored'],
];
