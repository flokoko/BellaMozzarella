// A short notification bell sound generated with Web Audio API
// No external files needed — plays a pleasant "ding" tone
let audioCtx: AudioContext | null = null

export function playNotificationSound() {
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext()
    }
    const ctx = audioCtx
    const now = ctx.currentTime

    // Create oscillator for the bell tone
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now)        // A5
    osc.frequency.setValueAtTime(1108.73, now + 0.1) // C#6
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.3) // fade to A4

    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.5)
  } catch (e) {
    console.error('playNotificationSound error:', e)
  }
}