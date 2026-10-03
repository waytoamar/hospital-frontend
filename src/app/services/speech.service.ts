import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SpeechService {
  private audioCtx?: AudioContext;
  // Chrome can silently drop an utterance if it is garbage collected, so we keep a reference
  private keep: SpeechSynthesisUtterance[] = [];

  /** Call this from a button click once, so the browser allows sound. */
  unlock(): void {
    try {
      this.audioCtx = this.audioCtx || new AudioContext();
      void this.audioCtx.resume();
    } catch {
      /* ignore */
    }
  }

  /** Two-tone "ding-dong" before the voice, so people look up. */
  private chime(): void {
    try {
      const ctx = this.audioCtx;
      if (!ctx) return;
      const now = ctx.currentTime;
      [
        [880, 0],
        [660, 0.3],
      ].forEach(([freq, offset]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.6, now + offset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.32);
      });
    } catch {
      /* ignore */
    }
  }

  speak(text: string, repeat = 2, withChime = true): void {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;

    synth.cancel();
    if (withChime) this.chime();

    const voices = synth.getVoices();
    const voice =
      voices.find((v) => v.lang === 'en-IN') ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
      null;

    // small delay: after cancel() Chrome sometimes ignores an immediate speak()
    setTimeout(
      () => {
        synth.resume();
        for (let i = 0; i < repeat; i++) {
          const u = new SpeechSynthesisUtterance(text);
          if (voice) u.voice = voice;
          u.lang = voice?.lang || 'en-IN';
          u.volume = 1;
          u.rate = 0.85;
          u.pitch = 1;
          this.keep.push(u);
          u.onend = u.onerror = () => {
            this.keep = this.keep.filter((x) => x !== u);
          };
          synth.speak(u);
        }
      },
      withChime ? 700 : 100,
    );
  }
}
