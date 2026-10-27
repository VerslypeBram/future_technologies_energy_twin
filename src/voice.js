import { parseCommand, runCommand, EXAMPLES, HELP } from './voice-commands.js';

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const BUTTONS = [
  { label: 'Zon 12 u', text: 'zet de zon op 12 uur' },
  { label: 'Zon 15 u', text: 'zet de zon op 15 uur' },
  { label: 'Productie?', text: 'hoeveel energie produceren we' },
  { label: 'Meer wind', text: 'meer wind' },
  { label: 'Minder wind', text: 'minder wind' },
  { label: 'Leeg regenput', text: 'leeg de regenput' },
  { label: 'Batterij?', text: 'hoe vol is de batterij' },
  { label: 'Bewolkt', text: 'maak het bewolkt' },
  { label: 'Toon dak', text: 'ga naar het dak' },
  { label: 'Ramen open', text: 'ramen open' },
];

const ERRORS = {
  'not-allowed': 'Microfoon geweigerd. Gebruik de knoppen of typ een commando.',
  'service-not-allowed': 'Spraakdienst niet toegestaan. Gebruik de knoppen of typ een commando.',
  'no-speech': 'Niets gehoord. Probeer opnieuw.',
  'audio-capture': 'Geen microfoon gevonden. Gebruik de knoppen of typ een commando.',
  network: 'Geen verbinding met de spraakdienst. Gebruik de knoppen of typ een commando.',
};

// Sectie "Spraak": microfoon (Web Speech API), toont wat verstaan werd en wat het gevolg was.
// Knoppen en tekstveld sturen dezelfde commando's aan, voor browsers zonder spraakherkenning.
export function createVoice({ actions = {}, toast } = {}) {
  const panel = document.getElementById('panel');
  const section = document.createElement('details');
  section.open = true;
  section.innerHTML = `
    <summary>Spraak</summary>
    <div class="sec-body">
      <div class="ctl"><span class="k">Microfoon</span><button id="micBtn" class="btn" aria-pressed="false" ${Recognition ? '' : 'disabled'}>Spreek</button></div>
      <div class="ctl"><span class="k">Antwoord uitspreken</span><button id="ttsBtn" class="switch" role="switch" aria-checked="false" aria-label="Antwoord uitspreken">UIT</button></div>
      <div class="status-line" id="voiceHeard" role="status" aria-live="polite">Verstaan: -</div>
      <div class="status-line" id="voiceResult" role="status" aria-live="polite">Gevolg: -</div>
      <form id="voiceForm" class="voice-form">
        <input id="voiceText" type="text" placeholder="Typ een commando" aria-label="Typ een commando" autocomplete="off">
        <button class="btn" type="submit">Voer uit</button>
      </form>
      <div class="voice-buttons" role="group" aria-label="Snelle commando's">${BUTTONS.map((b, i) => `<button class="btn" data-cmd="${i}">${b.label}</button>`).join('')}</div>
      <details class="voice-help"><summary>Alle commando's</summary><div class="note" style="white-space:pre-line">${HELP}</div></details>
      <div class="note">${Recognition ? 'Klik op Spreek en zeg bijvoorbeeld' : 'Spraakherkenning werkt in Chrome en Edge. Typ bijvoorbeeld'}: "${EXAMPLES.join('", "')}".</div>
    </div>
  `;
  panel.prepend(section);
  const $ = (sel) => section.querySelector(sel);
  const heard = $('#voiceHeard');
  const result = $('#voiceResult');
  const mic = $('#micBtn');
  const tts = $('#ttsBtn');
  let speak = false;

  function say(text) {
    if (!speak || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'nl-BE';
    speechSynthesis.speak(u);
  }

  function handle(text) {
    heard.textContent = `Verstaan: "${text}"`;
    const cmd = parseCommand(text);
    if (!cmd) {
      result.textContent = `Gevolg: niet begrepen. Probeer "${EXAMPLES[0]}".`;
      return;
    }
    const reply = runCommand(cmd, actions);
    result.textContent = `Gevolg: ${reply}`;
    toast?.(reply, 'info');
    say(reply);
  }

  tts.onclick = () => {
    speak = !speak;
    tts.setAttribute('aria-checked', String(speak));
    tts.textContent = speak ? 'AAN' : 'UIT';
    if (!speak && 'speechSynthesis' in window) speechSynthesis.cancel();
  };
  section.querySelectorAll('[data-cmd]').forEach((b) => (b.onclick = () => handle(BUTTONS[+b.dataset.cmd].text)));
  $('#voiceForm').onsubmit = (e) => {
    e.preventDefault();
    const input = $('#voiceText');
    if (input.value.trim()) handle(input.value.trim());
    input.value = '';
  };

  if (Recognition) {
    const rec = new Recognition();
    rec.lang = 'nl-BE';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 3;
    let listening = false;
    const setListening = (on) => {
      listening = on;
      mic.setAttribute('aria-pressed', String(on));
      mic.textContent = on ? 'Luistert…' : 'Spreek';
    };
    rec.onresult = (e) => {
      const r = e.results[e.results.length - 1];
      const text = r[0].transcript.trim();
      if (!r.isFinal) {
        heard.textContent = `Verstaan: "${text}"…`;
        return;
      }
      // Kies het eerste alternatief dat een commando oplevert, anders het beste
      const best = Array.from(r).find((a) => parseCommand(a.transcript)) ?? r[0];
      handle(best.transcript.trim());
    };
    rec.onerror = (e) => {
      result.textContent = `Gevolg: ${ERRORS[e.error] ?? 'Spraakfout: ' + e.error}`;
    };
    rec.onend = () => setListening(false);
    mic.onclick = () => {
      if (listening) {
        rec.stop();
        return;
      }
      try {
        rec.start();
        setListening(true);
        heard.textContent = 'Verstaan: luistert…';
      } catch {
        setListening(false);
      }
    };
  }

  return { handle };
}
