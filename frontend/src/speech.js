export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

export function speak(text, rate = 0.85) {
  if (!canSpeak) return;
  window.speechSynthesis.cancel();
  const phrase = new SpeechSynthesisUtterance(text);
  phrase.lang = "ru-RU";
  phrase.rate = rate;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("ru"));
  if (voice) phrase.voice = voice;
  window.speechSynthesis.speak(phrase);
}

export function hush() {
  if (canSpeak) window.speechSynthesis.cancel();
}
