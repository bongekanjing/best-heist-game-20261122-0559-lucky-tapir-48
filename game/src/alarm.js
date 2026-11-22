// alarm.js — the alarm meter. Everything that sees you feeds it, everything
// that stops seeing you drains it. At full it trips: the room locks down, you
// lose an attempt, and the room resets. Snatching loot knocks it up a notch,
// so the order you take the room in is a real decision.

import { ALARM } from './config.js';

export class Alarm {
  constructor() {
    this.value = 0;
    this.tripped = false;
    this.lastSource = '';
    this.wasSeen = false;
  }

  reset() {
    this.value = 0;
    this.tripped = false;
    this.lastSource = '';
    this.wasSeen = false;
  }

  // `exposure` is a list of { rate, source } for everything that can see you.
  update(dt, exposure, noise) {
    let rate = 0;
    let source = '';

    for (const e of exposure) {
      if (e.rate <= 0) continue;
      rate += e.rate;
      if (!source) source = e.source;
    }

    if (rate > 0) {
      this.value += rate * dt;
      this.lastSource = source;
      this.wasSeen = true;
    } else {
      // Nothing has eyes on you: cool down, faster if you are hidden.
      const decay = noise ? ALARM.decay * 0.55 : ALARM.decay;
      this.value -= decay * dt;
      this.wasSeen = false;
    }

    this.value = Math.max(0, Math.min(ALARM.max, this.value));
    if (this.value >= ALARM.max && !this.tripped) {
      this.tripped = true;
      return true;
    }
    return false;
  }

  // Taking a prize rings the bell a little: greed has a price.
  bump(source) {
    this.value = Math.min(ALARM.max, this.value + ALARM.snatchBump);
    this.lastSource = source;
  }

  get fraction() {
    return this.value / ALARM.max;
  }

  get level() {
    const f = this.fraction;
    if (f >= 0.75) return 'critical';
    if (f >= 0.45) return 'rising';
    if (f > 0.02) return 'warm';
    return 'quiet';
  }
}
