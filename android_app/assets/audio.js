/**
 * Motor de Audio Táctico Sintetizado (Web Audio API)
 * Genera efectos de sonido procedimentales de grado militar sin archivos externos.
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
    }

    init() {
        try {
            if (!this.ctx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    this.ctx = new AudioContext();
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
        } catch (e) {}
    }

    setMuted(mute) {
        this.muted = mute;
    }

    // Ping Sonar suave y resonante
    playSonarPing() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(440, now + 0.6);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.6);
        } catch (e) {}
    }

    // Alerta de intruso / Alarma de amenaza
    playAlertSiren() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(450, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.15);
            osc.frequency.linearRampToValueAtTime(450, now + 0.3);
            osc.frequency.linearRampToValueAtTime(800, now + 0.45);

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.45);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.6);
        } catch (e) {}
    }

    // Sonido de bloqueo / Cierre electromagnético
    playLockdownSound() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            
            // Golpe grave (Bass thump)
            const subOsc = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            subOsc.type = 'sine';
            subOsc.frequency.setValueAtTime(140, now);
            subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

            subGain.gain.setValueAtTime(0.4, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            subOsc.connect(subGain);
            subGain.connect(this.ctx.destination);
            subOsc.start(now);
            subOsc.stop(now + 0.35);

            // Click cibernético
            const clickOsc = this.ctx.createOscillator();
            const clickGain = this.ctx.createGain();
            clickOsc.type = 'triangle';
            clickOsc.frequency.setValueAtTime(1200, now + 0.05);
            clickOsc.frequency.exponentialRampToValueAtTime(200, now + 0.15);

            clickGain.gain.setValueAtTime(0.3, now + 0.05);
            clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            clickOsc.connect(clickGain);
            clickGain.connect(this.ctx.destination);
            clickOsc.start(now + 0.05);
            clickOsc.stop(now + 0.15);
        } catch (e) {}
    }

    // Beep sutil de confirmación
    playBeep(freq = 900) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.08);
        } catch (e) {}
    }
}

window.sound = new SoundEngine();
