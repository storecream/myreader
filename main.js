// main.js — robust voices + highlight with boundary-or-fallback
const synth = window.speechSynthesis;

const voiceSel  = document.getElementById("voice");
const rate      = document.getElementById("rate");
const pitch     = document.getElementById("pitch");
const volume    = document.getElementById("volume");
const rateVal   = document.getElementById("rateVal");
const pitchVal  = document.getElementById("pitchVal");
const volumeVal = document.getElementById("volumeVal");
const textEl    = document.getElementById("text");
const preview   = document.getElementById("preview");

let VOICES = [];
let spans = [];
let currentText = "";
let fallbackTimer = null;
let boundarySeen = false;

function updateLabels() {
  rateVal.textContent   = Number(rate.value).toFixed(1);
  pitchVal.textContent  = Number(pitch.value).toFixed(1);
  volumeVal.textContent = Number(volume.value).toFixed(1);
}
[rate, pitch, volume].forEach(x => x.addEventListener("input", updateLabels));
updateLabels();

// ---- voices ----
function populateVoices() {
  VOICES = synth.getVoices().sort((a,b)=>(a.lang+a.name).localeCompare(b.lang+b.name));
  voiceSel.innerHTML = "";
  VOICES.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} — ${v.lang}${v.default ? " (default)" : ""}`;
    voiceSel.appendChild(opt);
  });
  const en = VOICES.find(v => /^en[-_]/i.test(v.lang)) || VOICES[0];
  if (en) voiceSel.value = en.voiceURI;
}
populateVoices();
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = populateVoices;
}
function getSelectedVoice(){
  const uri = voiceSel.value;
  return VOICES.find(v => v.voiceURI === uri) || VOICES[0] || null;
}

// ---- highlight helpers ----
function renderSpans(txt) {
  preview.innerHTML = "";
  spans = [];
  const tokens = txt.match(/\S+|\s+/g) || [];
  tokens.forEach(tok => {
    if (/^\s+$/.test(tok)) {
      preview.appendChild(document.createTextNode(tok));
    } else {
      const s = document.createElement("span");
      s.className = "w";
      s.textContent = tok;
      spans.push(s);
      preview.appendChild(s);
      preview.appendChild(document.createTextNode(" "));
    }
  });
}
function clearHighlight() { spans.forEach(s => s.classList.remove("a")); }
function activateSpan(i) {
  clearHighlight();
  const s = spans[i];
  if (s) { s.classList.add("a"); s.scrollIntoView({ block: "center", inline: "nearest" }); }
}
function highlightByCharIndex(charIndex) {
  const words = currentText.split(/\s+/);
  let cum = 0, target = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (charIndex < cum + w.length + 1) { target = i; break; }
    cum += w.length + 1; target = i;
  }
  activateSpan(target);
}

// ---- fallback highlighter (if no boundary events) ----
function startFallbackHighlighter() {
  stopFallbackHighlighter();
  // estimate words per minute; scale with "rate" (1.0 ≈ ~170 wpm feels natural)
  const words = currentText.split(/\s+/).filter(Boolean);
  let i = 0;
  const wpm = Math.max(80, Math.min(300, 170 * Number(rate.value || 1)));
  const interval = (60_000 / wpm); // ms per word

  fallbackTimer = setInterval(() => {
    if (i >= words.length) { stopFallbackHighlighter(); return; }
    activateSpan(i++);
  }, interval);
}
function stopFallbackHighlighter() {
  if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
}

// ---- make utterance ----
function makeUtterance(txt) {
  const u = new SpeechSynthesisUtterance(txt);
  const v = getSelectedVoice();
  if (v) u.voice = v;
  u.rate   = Number(rate.value);
  u.pitch  = Number(pitch.value);
  u.volume = Number(volume.value);

  boundarySeen = false;

  const onBoundary = (e) => {
    boundarySeen = true;
    // some browsers don’t set e.name consistently; charIndex is enough
    highlightByCharIndex(e.charIndex || 0);
  };

  // bind both styles just in case (some engines prefer addEventListener)
  u.onboundary = onBoundary;
  try { u.addEventListener && u.addEventListener("boundary", onBoundary); } catch {}

  u.onstart = () => {
    // if no boundary arrives within 600ms, start fallback
    setTimeout(() => { if (!boundarySeen) startFallbackHighlighter(); }, 600);
  };
  u.onend = () => { clearHighlight(); stopFallbackHighlighter(); };
  u.onerror = () => { stopFallbackHighlighter(); };

  return u;
}

// ---- controls ----
document.getElementById("speak").onclick = () => {
  const txt = (textEl.value || "").trim();
  if (!txt) return alert("Enter some text first!");
  synth.cancel();
  stopFallbackHighlighter();
  currentText = txt;
  renderSpans(txt);
  synth.speak(makeUtterance(txt));
};
document.getElementById("pause").onclick  = () => { if (synth.speaking && !synth.paused) synth.pause(); };
document.getElementById("resume").onclick = () => { if (synth.paused) synth.resume(); };
document.getElementById("stop").onclick   = () => { synth.cancel(); clearHighlight(); stopFallbackHighlighter(); };

// OPTIONAL: restart speech on slider change to hear effect immediately
// [rate, pitch, volume].forEach(ctrl => ctrl.addEventListener("change", () => {
//   if (!synth.speaking) return;
//   document.getElementById("speak").click();
// }));
