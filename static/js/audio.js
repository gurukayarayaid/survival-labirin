/* ============================================================
   EFEK SUARA — disintesis langsung dengan Web Audio API
   (tanpa file audio, aman offline, hemat memori)
   ============================================================ */
'use strict';

const SFX = (() => {
  let ctx = null, master = null;
  let muted = localStorage.getItem('ss_mute') === '1';

  function ensure() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.5;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* abaikan */ }
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    if (!ctx || muted) return;
    try {
      const t0 = ctx.currentTime + (when || 0);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) { /* abaikan */ }
  }

  const sfx = {
    tap()      { tone(560, .07, 'triangle', .5); },
    move()     { tone(300, .04, 'sine', .10); },
    coin()     { tone(920, .08, 'square', .3); tone(1380, .1, 'square', .25, .06); },
    hit()      { tone(170, .28, 'sawtooth', .5, 0, 80); tone(90, .3, 'square', .3, .03); },
    correct()  { [523, 659, 784, 1046].forEach((f, i) => tone(f, .13, 'triangle', .5, i * .09)); },
    wrong()    { tone(230, .18, 'sawtooth', .4); tone(165, .28, 'sawtooth', .4, .16); },
    stage()    { [392, 523, 659, 784].forEach((f, i) => tone(f, .12, 'triangle', .5, i * .08)); },
    win()      { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, .16, 'triangle', .5, i * .12)); },
    over()     { [392, 330, 262, 196].forEach((f, i) => tone(f, .22, 'sawtooth', .32, i * .16)); },
    tick()     { tone(1050, .03, 'square', .16); },
    splash()   { tone(660, .3, 'sine', .22); tone(880, .42, 'sine', .18, .14); },
  };

  // buka audio pada interaksi pertama (kebijakan autoplay HP)
  document.addEventListener('touchstart', ensure, { passive: true, capture: true });
  document.addEventListener('mousedown', ensure, { passive: true, capture: true });
  document.addEventListener('keydown', ensure, { passive: true, capture: true });

  return {
    sfx,
    ensure,
    isMuted: () => muted,
    toggle() {
      muted = !muted;
      localStorage.setItem('ss_mute', muted ? '1' : '0');
      ensure();
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    }
  };
})();

function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* abaikan */ }
}
