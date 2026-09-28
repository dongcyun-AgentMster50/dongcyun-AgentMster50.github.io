'use strict';

/* =========================================================
 *  실시간 통역 — EN / RU ⇄ KO
 *  STT: Web Speech API · MT: Google gtx → MyMemory 폴백 · TTS: speechSynthesis
 * ========================================================= */

const LANGS = {
  ko: { stt: 'ko-KR', tts: 'ko-KR', name: '한국어', short: 'KO' },
  en: { stt: 'en-US', tts: 'en-US', name: 'English', short: 'EN' },
  ru: { stt: 'ru-RU', tts: 'ru-RU', name: 'Русский', short: 'RU' },
};

const ICONS = {
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>',
  flip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  keyboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  retry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/></svg>',
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;

/* ---------- 저장소 (실패해도 앱은 동작) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode 등 */ } },
};

const settings = Object.assign(
  { autoSpeak: true, handsFree: true, rate: 1, koTargets: 'both', faceToFace: false },
  store.get('rtx.settings', {}),
);
let history = store.get('rtx.history', []);
const saveSettings = () => store.set('rtx.settings', settings);
const saveHistory = () => store.set('rtx.history', history.slice(-200));

const state = {
  lang: null,        // 현재 세션 언어
  session: false,    // 사용자가 마이크를 "켜둔" 상태
  rec: null,         // 활성 SpeechRecognition
  heard: '',         // 현재 발화의 최신 텍스트 (interim 포함)
  speaking: false,
  translating: 0,
  emptyRuns: 0,      // 연속으로 아무 말도 없던 횟수
  partnerLang: 'en', // 마지막으로 대화한 외국어
  live: { busy: false, pending: false, seq: 0 },
  wakeLock: null,
};

/* =========================================================
 *  번역
 * ========================================================= */
const cache = new Map();

function fetchWithTimeout(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { signal: ctl.signal }).finally(() => clearTimeout(t));
}

async function viaGoogle(text, sl, tl) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  const r = await fetchWithTimeout(url, 6000);
  if (!r.ok) throw new Error('gtx ' + r.status);
  const j = await r.json();
  return j[0].map(seg => seg[0]).join('');
}

async function viaMyMemory(text, sl, tl) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sl}|${tl}`;
  const r = await fetchWithTimeout(url, 8000);
  const j = await r.json();
  if (j.responseStatus !== 200) throw new Error('mymemory ' + j.responseStatus);
  return j.responseData.translatedText;
}

async function translate(text, from, to) {
  text = text.trim();
  if (!text) return '';
  const key = `${from}>${to}:${text}`;
  if (cache.has(key)) return cache.get(key);
  let out;
  try { out = await viaGoogle(text, from, to); }
  catch { out = await viaMyMemory(text, from, to); }
  cache.set(key, out);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return out;
}

function targetsFor(src) {
  if (src !== 'ko') return ['ko'];
  return settings.koTargets === 'both' ? ['en', 'ru'] : [settings.koTargets];
}

/* 텍스트 입력 시 어떤 언어인지 판별 (음성은 버튼으로 언어가 정해짐) */
function detectLang(text) {
  // 해당 문자가 하나라도 있으면 그 언어로 판정 (우선순위: 라틴 → 한글 → 키릴)
  if (/[A-Za-z]/.test(text)) return 'en';
  if (/[ㄱ-ㆎ가-힣]/.test(text)) return 'ko';
  if (/[Ѐ-ӿ]/.test(text)) return 'ru';
  return 'en'; // 숫자·이모지·기호만 있는 경우
}

/* =========================================================
 *  TTS
 * ========================================================= */
let voices = [];
function loadVoices() { voices = synth ? synth.getVoices() : []; }
if (synth) { loadVoices(); synth.addEventListener?.('voiceschanged', loadVoices); }

function pickVoice(lang) {
  const norm = v => v.lang.toLowerCase().replace('_', '-');
  const tag = LANGS[lang].tts.toLowerCase();
  const same = voices.filter(v => norm(v).startsWith(lang));
  return same.find(v => norm(v) === tag && /google|natural|neural|premium|enhanced|siri/i.test(v.name))
    || same.find(v => norm(v) === tag)
    || same[0] || null;
}

function speak(text, lang) {
  return new Promise(resolve => {
    if (!synth || !text) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANGS[lang].tts;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.rate = settings.rate;
    let done = false;
    // 일부 브라우저는 onend 를 빼먹는다 → 워치독
    const guard = setTimeout(() => finish(), 4000 + (text.length * 170) / settings.rate);
    function finish() { if (done) return; done = true; clearTimeout(guard); resolve(); }
    u.onend = finish;
    u.onerror = finish;
    synth.speak(u);
  });
}

async function speakQueue(items) {
  if (!items.length) return;
  stopSpeaking();
  state.speaking = true;
  refreshUI();
  const token = (state.speakToken = Symbol());
  for (const it of items) {
    if (state.speakToken !== token) break;
    it.el?.classList.add('playing');
    await speak(it.text, it.lang);
    it.el?.classList.remove('playing');
  }
  if (state.speakToken === token) state.speaking = false;
  refreshUI();
}

function stopSpeaking() {
  state.speakToken = null;
  state.speaking = false;
  synth?.cancel();
  $$('.tr.playing').forEach(e => e.classList.remove('playing'));
}

// iOS: 첫 TTS 는 반드시 사용자 제스처 안에서 호출되어야 이후 자동 재생이 가능
let ttsUnlocked = false;
function unlockTTS() {
  if (ttsUnlocked || !synth) return;
  ttsUnlocked = true;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  synth.speak(u);
}

/* =========================================================
 *  음성 인식
 * ========================================================= */
function stopRec() {
  const rec = state.rec;
  if (!rec) return false;
  state.rec = null;           // onend 에서 무시되도록 먼저 분리
  try { rec.abort(); } catch { /* noop */ }
  return true;
}

function startListening(lang) {
  if (!SR) {
    toast('이 브라우저는 음성 인식을 지원하지 않아요.\nAndroid Chrome 또는 iOS Safari를 사용하세요.');
    return;
  }
  stopSpeaking();
  const hadRec = stopRec();
  state.lang = lang;
  state.session = true;
  if (lang !== 'ko') state.partnerLang = lang;
  // 직전 인식기를 abort 한 직후 바로 start 하면 Android 에서 무시되는 경우가 있음
  if (hadRec) setTimeout(() => state.session && state.lang === lang && !state.rec && beginRec(lang), 220);
  else beginRec(lang);
  requestWakeLock();
  refreshUI();
}

function beginRec(lang) {
  const rec = new SR();
  rec.lang = LANGS[lang].stt;
  rec.interimResults = true;
  rec.continuous = false;     // 발화 단위로 끊어서 번역 (Android 중복 버그 회피)
  rec.maxAlternatives = 1;

  let finalText = '';
  state.heard = '';
  state.rec = rec;

  rec.onstart = () => { showLive(lang); refreshUI(); };

  rec.onresult = e => {
    if (state.rec !== rec) return;
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    updateLive(lang, `${finalText} ${interim}`.replace(/\s+/g, ' ').trim());
  };

  rec.onerror = e => {
    if (state.rec !== rec) return;
    const err = e.error;
    if (err === 'not-allowed' || err === 'service-not-allowed') {
      endSession();
      toast('마이크 권한이 필요해요.\n(HTTPS 주소에서 열었는지 확인하세요)');
    } else if (err === 'network') {
      endSession();
      toast('네트워크 오류 — 음성 인식 서버에 연결할 수 없어요');
    } else if (err === 'language-not-supported') {
      endSession();
      toast(`${LANGS[lang].name} 음성 인식을 지원하지 않는 기기예요`);
    }
    // no-speech / aborted 는 조용히 넘어감
  };

  rec.onend = () => {
    if (state.rec !== rec) return;   // 다른 세션으로 교체됨
    state.rec = null;
    const text = state.heard.trim();
    hideLive();
    if (text) {
      state.emptyRuns = 0;
      commit(lang, text);
    } else if (state.session && state.lang === lang) {
      // 무음: 몇 번까지는 자동 재시작, 이후 절전
      if (++state.emptyRuns >= 4) { endSession(); setHint('한동안 말이 없어 마이크를 껐어요'); }
      else beginRec(lang);
    }
    refreshUI();
  };

  try { rec.start(); }
  catch { state.rec = null; endSession(); toast('마이크를 시작할 수 없어요. 다시 눌러 주세요.'); }
}

function endSession() {
  state.session = false;
  state.emptyRuns = 0;
  stopRec();
  hideLive();
  releaseWakeLock();
  refreshUI();
}

function onMicTap(lang) {
  unlockTTS();
  navigator.vibrate?.(12);
  if (state.session && state.lang === lang) {
    // 같은 버튼 재탭 → 지금까지 들은 말은 번역하고 종료
    state.session = false;
    if (state.rec) { try { state.rec.stop(); } catch { /* noop */ } }
    else stopSpeaking();
    releaseWakeLock();
    refreshUI();
    return;
  }
  state.emptyRuns = 0;
  startListening(lang);
}

/* =========================================================
 *  한 발화 확정 → 번역 → 읽기 → (핸즈프리) 재청취
 * ========================================================= */
async function commit(src, text, { fromKeyboard = false } = {}) {
  const msg = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), src, text, targets: targetsFor(src), tr: {}, ts: Date.now() };
  history.push(msg);
  $('#empty').hidden = true;
  const el = renderMessage(msg);
  scrollToBottom();

  state.translating++;
  refreshUI();
  await Promise.all(msg.targets.map(async t => {
    try { msg.tr[t] = await translate(text, src, t); }
    catch { msg.tr[t] = null; }
    paintTranslations(el, msg);
  }));
  state.translating--;
  saveHistory();
  updatePartner(msg);
  scrollToBottom();

  const queue = msg.targets
    .filter(t => msg.tr[t])
    .map(t => ({ text: msg.tr[t], lang: t, el: $(`.tr[data-lang="${t}"]`, el) }));

  // 발화 도중 다른 버튼을 눌렀다면(state.rec 존재) 읽지 않는다 — 새 발화가 우선
  if (settings.autoSpeak && queue.length && !state.rec) await speakQueue(queue);

  if (!fromKeyboard && state.session && state.lang === src && !state.rec && !state.speaking) {
    if (settings.handsFree) beginRec(src);
    else endSession();
  }
  refreshUI();
}

/* =========================================================
 *  렌더링
 * ========================================================= */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('data-') || k.startsWith('aria-')) el.setAttribute(k, v);
    else el[k] = v;
  }
  for (const k of kids) if (k != null) el.append(k);
  return el;
}

const fmtTime = ts => new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

function renderMessage(msg) {
  const L = LANGS[msg.src];
  const el = h('article', { class: `bubble ${msg.src === 'ko' ? 'me' : 'them'}`, 'data-id': msg.id, 'data-src': msg.src },
    h('div', { class: 'b-head' },
      h('span', { class: `chip c-${msg.src}`, textContent: L.short }),
      h('span', { class: 'b-name', textContent: msg.src === 'ko' ? '나' : L.name }),
      h('time', { textContent: fmtTime(msg.ts) }),
      h('button', { class: 'mini', 'data-act': 'copy', 'aria-label': '복사', html: ICONS.copy }),
    ),
    h('p', { class: 'orig', textContent: msg.text }),
    h('div', { class: 'trs' }),
  );
  $('#messages').append(el);
  paintTranslations(el, msg);
  return el;
}

function paintTranslations(el, msg) {
  const box = $('.trs', el);
  box.replaceChildren(...msg.targets.map(t => {
    const v = msg.tr[t];
    const text = v === undefined
      ? h('p', { class: 'tr-text pending', textContent: '번역 중' })
      : v === null
        ? h('p', { class: 'tr-text failed', textContent: '번역 실패 — 다시 시도' })
        : h('p', { class: 'tr-text', textContent: v });
    const btn = v === null
      ? h('button', { class: 'play', 'data-act': 'retry', 'data-lang': t, 'aria-label': '다시 시도', html: ICONS.retry })
      : h('button', { class: 'play', 'data-act': 'play', 'data-lang': t, 'aria-label': '듣기', html: ICONS.play });
    return h('div', { class: 'tr', 'data-lang': t },
      h('span', { class: `chip c-${t}`, textContent: LANGS[t].short }), text, btn);
  }));
}

/* ---------- 실시간 카드 ---------- */
function showLive(lang) {
  const live = $('#live');
  live.dataset.src = lang;
  $('#liveChip').className = `chip c-${lang}`;
  $('#liveChip').textContent = LANGS[lang].short;
  $('#liveName').textContent = lang === 'ko' ? '듣는 중 · 한국어' : `Listening · ${LANGS[lang].name}`;
  $('#liveOrig').textContent = '';
  $('#liveTrs').replaceChildren();
  live.hidden = false;
  $('#empty').hidden = true;
  scrollToBottom();
}

function hideLive() {
  $('#live').hidden = true;
  state.live.seq++;
  if (!history.length) $('#empty').hidden = false;
}

function updateLive(lang, text) {
  state.heard = text;
  $('#liveOrig').textContent = text;
  if (settings.faceToFace && lang !== 'ko') setPartnerText(text, 'Listening…');
  scrollToBottom();
  liveTranslate(lang);
}

/* 실시간 번역: 요청이 진행 중이면 최신 텍스트 1건만 대기시킨다 (in-flight coalescing) */
function liveTranslate(lang) {
  const L = state.live;
  if (L.busy) { L.pending = true; return; }
  L.busy = true;
  const seq = L.seq;
  const text = state.heard;
  const targets = targetsFor(lang);
  Promise.all(targets.map(t => translate(text, lang, t).catch(() => '')))
    .then(outs => {
      if (seq !== L.seq || $('#live').hidden) return;
      $('#liveTrs').replaceChildren(...targets.map((t, i) => h('div', { class: 'tr', 'data-lang': t },
        h('span', { class: `chip c-${t}`, textContent: LANGS[t].short }),
        h('p', { class: 'tr-text', textContent: outs[i] || '…' }),
        h('span'),
      )));
      scrollToBottom();
    })
    .finally(() => {
      L.busy = false;
      if (L.pending) { L.pending = false; if (!$('#live').hidden) liveTranslate(lang); }
    });
}

/* ---------- 마주보기 패널 ---------- */
function setPartnerText(main, label, sub) {
  $('#partnerLabel').textContent = label;
  const box = $('#partnerText');
  box.replaceChildren(document.createTextNode(main));
  if (sub) box.append(h('span', { class: 'sub', textContent: sub }));
}

function updatePartner(msg) {
  if (msg.src === 'ko') {
    const lines = msg.targets.map(t => msg.tr[t]).filter(Boolean);
    const prefer = msg.tr[state.partnerLang] ? state.partnerLang : msg.targets[0];
    const others = lines.filter(l => l !== msg.tr[prefer]);
    setPartnerText(msg.tr[prefer] || '…', prefer === 'ru' ? 'Собеседник говорит:' : 'They said:', others.join('\n'));
  } else {
    setPartnerText(msg.text, msg.src === 'ru' ? '✓ Переведено на корейский' : '✓ Translated to Korean');
  }
}

/* ---------- 상태 표시 ---------- */
function refreshUI() {
  let status = 'idle', label = '대기 중';
  if (state.rec) { status = 'listening'; label = `듣는 중 · ${LANGS[state.lang].name}`; }
  else if (state.translating) { status = 'translating'; label = '번역 중…'; }
  else if (state.speaking) { status = 'speaking'; label = '읽는 중…'; }
  else if (state.session) { status = 'listening'; label = `대기 · ${LANGS[state.lang].name}`; }
  document.body.dataset.status = status;
  $('#statusText .st').textContent = label;

  $$('.mic').forEach(b => {
    const on = state.session && state.lang === b.dataset.lang;
    b.classList.toggle('listening', on && !!state.rec);
    b.classList.toggle('armed', on && !state.rec);
  });

  if (state.rec) setHint('다시 누르면 멈추고 번역해요');
  else if (state.speaking) setHint('버튼을 누르면 읽기를 끊고 바로 들어요');
  else if (!state.session) setHint('언어 버튼을 누르고 말하세요');

  $('#targetsLabel').textContent = settings.koTargets === 'both' ? 'EN·RU' : settings.koTargets.toUpperCase();
  $('#btnF2F').classList.toggle('on', settings.faceToFace);
  $('#partnerPanel').hidden = !settings.faceToFace;
  document.body.classList.toggle('f2f', settings.faceToFace);
}

function setHint(t) { $('#hint').textContent = t; }

function scrollToBottom() {
  const f = $('#feed');
  requestAnimationFrame(() => { f.scrollTop = f.scrollHeight; });
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.style.whiteSpace = 'pre-line';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- 화면 꺼짐 방지 ---------- */
async function requestWakeLock() {
  try { if ('wakeLock' in navigator && !state.wakeLock) state.wakeLock = await navigator.wakeLock.request('screen'); }
  catch { /* 미지원 */ }
}
function releaseWakeLock() { state.wakeLock?.release().catch(() => {}); state.wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && state.session) endSession();
});

/* =========================================================
 *  이벤트 바인딩
 * ========================================================= */
function bind() {
  $$('[data-icon]').forEach(el => { el.innerHTML = ICONS[el.dataset.icon] || ''; });

  $$('.mic').forEach(b => b.addEventListener('click', () => onMicTap(b.dataset.lang)));

  $('#messages').addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const el = btn.closest('.bubble');
    const msg = history.find(m => m.id === el.dataset.id);
    if (!msg) return;
    unlockTTS();
    const act = btn.dataset.act;
    if (act === 'play') {
      const t = btn.dataset.lang;
      speakQueue([{ text: msg.tr[t], lang: t, el: btn.closest('.tr') }]);
    } else if (act === 'retry') {
      const t = btn.dataset.lang;
      msg.tr[t] = undefined; paintTranslations(el, msg);
      try { msg.tr[t] = await translate(msg.text, msg.src, t); } catch { msg.tr[t] = null; }
      paintTranslations(el, msg); saveHistory();
    } else if (act === 'copy') {
      const body = [msg.text, ...msg.targets.map(t => msg.tr[t]).filter(Boolean)].join('\n');
      try { await navigator.clipboard.writeText(body); toast('복사했어요'); } catch { toast('복사할 수 없어요'); }
    }
  });

  $('#btnF2F').addEventListener('click', () => {
    settings.faceToFace = !settings.faceToFace; saveSettings(); refreshUI();
    const last = history[history.length - 1];
    if (settings.faceToFace && last) updatePartner(last);
  });

  $('#btnKeyboard').addEventListener('click', () => {
    const c = $('#composer');
    c.hidden = !c.hidden;
    $('#btnKeyboard').classList.toggle('on', !c.hidden);
    if (!c.hidden) $('#composerInput').focus();
  });
  $('#composer').addEventListener('submit', e => {
    e.preventDefault();
    unlockTTS();
    const input = $('#composerInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    const src = detectLang(text);
    if (src !== 'ko') state.partnerLang = src;
    commit(src, text, { fromKeyboard: true });
  });

  $('#btnTargets').addEventListener('click', () => {
    const order = ['both', 'en', 'ru'];
    settings.koTargets = order[(order.indexOf(settings.koTargets) + 1) % order.length];
    saveSettings(); syncSheet(); refreshUI();
    toast(`한국어 → ${settings.koTargets === 'both' ? '영어 + 러시아어' : settings.koTargets === 'en' ? '영어' : '러시아어'}`);
  });

  // 설정 시트
  $('#btnSettings').addEventListener('click', () => { syncSheet(); $('#sheet').hidden = false; });
  $$('#sheet [data-close]').forEach(b => b.addEventListener('click', () => { $('#sheet').hidden = true; }));
  $('#optAutoSpeak').addEventListener('change', e => { settings.autoSpeak = e.target.checked; saveSettings(); });
  $('#optHandsFree').addEventListener('change', e => { settings.handsFree = e.target.checked; saveSettings(); });
  $('#optRate').addEventListener('input', e => {
    settings.rate = Number(e.target.value); saveSettings();
    $('#rateLabel').textContent = settings.rate.toFixed(1) + '×';
  });
  $$('#optTargets button').forEach(b => b.addEventListener('click', () => {
    settings.koTargets = b.dataset.v; saveSettings(); syncSheet(); refreshUI();
  }));
  $('#btnClear').addEventListener('click', () => {
    if (!confirm('대화 기록을 모두 지울까요?')) return;
    history = []; saveHistory();
    $('#messages').replaceChildren();
    $('#empty').hidden = false;
    $('#sheet').hidden = true;
  });
}

function syncSheet() {
  $('#optAutoSpeak').checked = settings.autoSpeak;
  $('#optHandsFree').checked = settings.handsFree;
  $('#optRate').value = settings.rate;
  $('#rateLabel').textContent = Number(settings.rate).toFixed(1) + '×';
  $$('#optTargets button').forEach(b => b.classList.toggle('on', b.dataset.v === settings.koTargets));
  const has = l => voices.some(v => v.lang.toLowerCase().replace('_', '-').startsWith(l));
  $('#diag').textContent = [
    `음성 인식: ${SR ? '지원 ✓' : '미지원 ✗ (Chrome/Safari 필요)'}`,
    `보안 연결(HTTPS): ${window.isSecureContext ? '✓' : '✗ — 마이크 사용 불가'}`,
    `음성 출력: KO ${has('ko') ? '✓' : '✗'} · EN ${has('en') ? '✓' : '✗'} · RU ${has('ru') ? '✓' : '✗'}`,
  ].join('\n');
}

function init() {
  bind();
  for (const msg of history) renderMessage(msg);
  $('#empty').hidden = history.length > 0;
  refreshUI();
  scrollToBottom();
  if (!SR) setHint('⚠ 음성 인식 미지원 브라우저 — 입력 기능은 사용 가능');
  else if (!window.isSecureContext) setHint('⚠ HTTPS로 열어야 마이크를 쓸 수 있어요');

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
