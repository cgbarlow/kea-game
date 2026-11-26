// hud/copy — every line the department says. Deadpan, official, mildly defeated. Pure data (no DOM).

const of = (name) => name + (/s$/i.test(name) ? "'" : "'s"); // The Okonkwos' van, Mr. Tanaka's van

export const END_TEXT = {
  reopened: {
    kicker: 'Incident report · Shift complete',
    heading: 'SH73 has reopened',
    sub: 'Please drive to the conditions. The conditions are: bad. The tourists have been released into the wild.',
  },
  'stood-down': {
    kicker: 'Incident report · Ranger stood down',
    heading: 'You have been stood down',
    sub: 'Pending a review of your drop, cover and hold technique. A refresher course is available (on-site, unpaid).',
  },
  review: {
    kicker: 'Incident report · Visitor feedback received',
    heading: 'A tourist has left a review',
    sub: '',
  },
};

export const REVIEWS = {
  A: '★☆☆☆☆ “Birds ate the window rubber. The ranger was blowing leaves.” — Ingrid & Lars',
  B: '★☆☆☆☆ “A possum is now living in our campervan. It has the good bunk.” — The Okonkwos',
  C: '★☆☆☆☆ “The parrot removed my wipers and looked me in the eye.” — Mr. Tanaka',
};

// van plate status by integrity (first threshold the integrity is above)
export const VAN_STATUS = [
  [0.85, 'Intact (broadly)', 'ok'],
  [0.6, 'Cosmetic damage', 'ok'],
  [0.35, 'Seals compromised', 'warn'],
  [0.15, 'Review being drafted', 'bad'],
  [-1, 'Review imminent', 'bad'],
];

export const HEAT_STATE = [
  [0.5, 'Nominal'],
  [0.8, 'Warm'],
  [1.01, 'Unwise'],
];

export const RATINGS = [
  [0.9, 'Exceeds the minimum'],
  [0.7, 'Meets some expectations'],
  [0.45, 'Under review'],
  [0.2, 'Concerning'],
  [-1, 'Please see your manager'],
];

export const ALERT_COPY = {
  alertTop: 'Aftershock alert · Emergency mobile alert',
  shakeTop: 'Aftershock in progress',
  alertSub: 'Get down now [C]. Find a table or the shelter. Stop blowing.',
  holdOk: 'Compliant. Holding. Cover was available.',
  holdCover: 'Exemplary. Under cover. Noted on your file.',
  holdBad: 'Not compliant: crouch [C], stop moving, stop blowing.',
};

export const TOASTS = {
  start: 'Shift 0417 commenced. The highway is closed. You are not.',
  keaLand: (name) => `Kea on ${of(name)} campervan. Do not feed it. It has already eaten.`,
  keaOffended: (name, n) => `Offended kea (grievance level ${n}) has landed on ${of(name)} campervan.`,
  raid: (name) => `A possum has entered ${of(name)} campervan. They have been informed.`,
  strike: (n) => `Aftershock procedure not followed. Strike ${n} of 3 recorded.`,
  clearCover: 'Shaking has stopped. Exemplary cover. Noted.',
  clearOk: 'Shaking has stopped. Adequate. Cover was available.',
  clearBad: 'Shaking has stopped. You did not hold. This has been noted.',
  overheat: 'Blower overheated. Let it rest. It has been a long day for everyone.',
  lowVan: (name) => `${of(name)} campervan is approaching review territory.`,
};
