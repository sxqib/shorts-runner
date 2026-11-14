/* Studio: the control panel for the Shorts channels.
   Static page (GitHub Pages in the public runner repo). Everything private is fetched with your GitHub token,
   which is stored ENCRYPTED in auth.json and unlocked in your browser with your password. */

const FACTORY = "sxqib/shorts-factory";   // private: code, data, kept videos (draft releases)
const RUNNER = "sxqib/shorts-runner";     // public: the workflows run here; this page lives here
const API = "https://api.github.com";
const DEFAULT_CHANNELS = "map,battle,case,milo";

const CH = [
  { key: "case", name: "Case Unsealed", user: "unsealedcase", img: "img/unsealedcase.jpg", secret: "IG_TOKEN_CRIME", file: /(^|__)case\.mp4$/,
    make: "case-episode.yml", ai: true, steps: ["Case: write the episode (Claude Code, your Claude plan)", "Case: render"],
    hints: ["A famous heist", "A cold case solved decades later", "A case in the news this week", "An unsolved disappearance", "A con artist", "An impossible escape"] },
  { key: "milo", name: "Hey Milo", user: "heymilotv", img: "img/heymilotv.jpg", secret: "IG_TOKEN_MILO", file: /(^|__)milo\.mp4$/,
    make: "milo-episode.yml", ai: true, steps: ["Milo: write the episode (Claude Code, your Claude plan)", "Milo: render"],
    hints: ["What if gravity flipped at noon?", "Milo becomes mayor for a day", "Every cat can suddenly read", "The internet turns off for a week", "Milo shrinks to ant size"] },
  { key: "map", name: "Atlas Drop", user: "atlasdropped", img: "img/atlasdrop.jpg", secret: "IG_TOKEN_MAP", file: /(^|__)map_[a-z0-9_]+\.mp4$/,
    steps: ["Render 3 Shorts and deliver to Discord"] },
  { key: "battle", name: "The Flag Ring", user: "theflagring", img: "img/theflagring.jpg", secret: "IG_TOKEN_BATTLE", file: /(^|__)country_battle\.mp4$/,
    steps: ["Render 3 Shorts and deliver to Discord"] },
  { key: "stop", name: "Ditch The Sub", user: "ditchthesub", img: "img/ditchthesub.jpg", secret: "IG_TOKEN_STOP", file: /(^|__)stop_paying\.mp4$/,
    steps: ["Render 3 Shorts and deliver to Discord"] },
];
const chOf = (k) => CH.find((c) => c.key === k);
const WF_NAMES = { "daily-shorts.yml": "Daily videos", "post-instagram.yml": "Posting", "case-episode.yml": "Case Unsealed episode",
  "milo-episode.yml": "Hey Milo episode", "channel-demos.yml": "Channel demos", "story-episode.yml": "Milo (old renderer)",
  "voice-pack.yml": "Voice pack", "audio-probe.yml": "Audio probe" };

/* ------------------------------------------------------------------ small helpers */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M4 12 20 4l-6 16-3-7z"/></svg>',
  redo: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
};

function toast(msg, bad = false) {
  const t = $("#toast");
  t.textContent = msg; t.className = "toast show" + (bad ? " bad" : "");
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = "toast"), 3200);
}
const ago = (iso) => {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const dur = (a, b) => {
  if (!a) return "";
  const s = Math.max(0, ((b ? new Date(b) : new Date()) - new Date(a)) / 1000);
  return s < 60 ? `${Math.round(s)}s` : s < 600 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};
const until = (d) => {
  const m = Math.max(0, Math.round((d - Date.now()) / 60000));
  return m < 60 ? `in ${m}m` : `in ${Math.floor(m / 60)}h ${m % 60}m`;
};
const ymd = (d, tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const hourIn = (d, tz) => +new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(d);
const nyDate = (d = new Date()) => ymd(d, "America/New_York");
/** the 6 PM New York post a daily run made at time d is for (the same rule as daily.py) */
const postDay = (d) => {
  const day = nyDate(d);
  if (hourIn(d, "America/New_York") < 18) return day;
  const t = new Date(day + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10);
};
const prettyDay = (s) => new Date(s + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const localTime = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
/** next time the clock in tz shows hh:mm */
function nextAt(hh, mm, tz) {
  const now = new Date();
  for (let add = 0; add < 3; add++) {
    const day = ymd(new Date(now.getTime() + add * 86400000), tz);
    for (let off = -14; off <= 14; off++) {   // find the UTC instant whose local time in tz is day hh:mm
      const t = new Date(`${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`);
      t.setUTCHours(t.getUTCHours() - off);
      if (ymd(t, tz) === day && hourIn(t, tz) === hh && t > now) return t;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ encryption (password -> token) */
const ITER = 600000;
async function keyFrom(pw, salt, iter = ITER) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function seal(token, pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFrom(pw, salt), new TextEncoder().encode(token)));
  return { v: 1, kdf: "PBKDF2-SHA256", iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}
async function unseal(box, pw) {
  const k = await keyFrom(pw, unb64(box.salt), box.iter);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, k, unb64(box.ct)));
}

/* ------------------------------------------------------------------ GitHub API */
let TOKEN = localStorage.getItem("studio.token") || sessionStorage.getItem("studio.token") || "";
const cache = new Map();
async function gh(path, { method = "GET", body, accept, raw = false, ttl = 20000, fresh = false } = {}) {
  const key = method + path + (accept || "");
  if (method === "GET" && !fresh && cache.has(key) && Date.now() - cache.get(key).t < ttl) return cache.get(key).v;
  const r = await fetch(API + path, {
    method, cache: "no-store",
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: accept || "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) { lock("Your GitHub token stopped working (expired or deleted). Set it up again."); throw new Error("unauthorized"); }
  if (!r.ok) { const e = new Error(`${r.status} ${(await r.text()).slice(0, 200)}`); e.status = r.status; throw e; }
  const v = r.status === 204 ? null : raw ? await r.text() : await r.json();
  if (method === "GET") cache.set(key, { t: Date.now(), v });
  else cache.clear();
  return v;
}
/** a JSON file from the private repo (null if missing) */
async function file(path, opts) {
  try { return JSON.parse(await gh(`/repos/${FACTORY}/contents/${path}`, { accept: "application/vnd.github.raw+json", raw: true, ...opts })); }
  catch (e) { if (e.status === 404) return null; throw e; }
}
async function variable(name, def = "") {
  try { return (await gh(`/repos/${RUNNER}/actions/variables/${name}`)).value; } catch (e) { if (e.status === 404) return def; throw e; }
}
async function setVariable(name, value) {
  try { await gh(`/repos/${RUNNER}/actions/variables/${name}`, { method: "PATCH", body: { name, value } }); }
  catch (e) { if (e.status !== 404) throw e; await gh(`/repos/${RUNNER}/actions/variables`, { method: "POST", body: { name, value } }); }
}
const dispatch = (wf, inputs = {}) => gh(`/repos/${RUNNER}/actions/workflows/${wf}/dispatches`, { method: "POST", body: { ref: "main", inputs } });
const runs = (fresh) => gh(`/repos/${RUNNER}/actions/runs?per_page=40`, { fresh, ttl: 8000 }).then((j) => j.workflow_runs);
const jobs = (id, fresh) => gh(`/repos/${RUNNER}/actions/runs/${id}/jobs`, { fresh, ttl: 8000 }).then((j) => j.jobs);
const wfFile = (run) => (run.path || "").split("/").pop();
/** kept video sets: draft releases "vault-<name>" in the private repo (tools/vault.py) */
async function vault(fresh) {
  const out = [];
  for (let page = 1; page < 4; page++) {
    const j = await gh(`/repos/${FACTORY}/releases?per_page=100&page=${page}`, { fresh, ttl: 30000 });
    out.push(...j.filter((r) => (r.name || "").startsWith("vault-")).map((r) => ({ ...r, set: r.name.slice(6) })));
    if (j.length < 100) break;
  }
  return out;
}

/* ------------------------------------------------------------------ sign-in */
async function authBox() {
  const r = await fetch("auth.json", { cache: "no-store" });
  return r.ok ? r.json() : null;
}
function lock(msg) {
  TOKEN = ""; localStorage.removeItem("studio.token"); sessionStorage.removeItem("studio.token"); cache.clear();
  stopPolling(); showGate(msg);
}
async function showGate(msg = "") {
  $("#app").hidden = true; $("#gate").hidden = false;
  const box = await authBox().catch(() => null);
  const setup = !box;
  $("#f-token").hidden = !setup; $("#f-pw2").hidden = !setup;
  $("#gate-title").textContent = setup ? "Set up Studio" : "Studio";
  $("#gate-sub").textContent = setup ? "One-time setup: your GitHub token is encrypted with a password you choose." : "Enter your password.";
  $("#pw-label").textContent = setup ? "Choose a password" : "Password";
  $("#in-pw").autocomplete = setup ? "new-password" : "current-password";
  $("#gate-btn").textContent = setup ? "Encrypt and save" : "Unlock";
  $("#gate-help").innerHTML = setup
    ? "Use a fine-grained token for <b>shorts-factory</b> and <b>shorts-runner</b> with Actions, Contents and Variables: Read and write. Choose a password of at least 14 characters (four random words work well): the encrypted token is stored in this public page, so a short password could be guessed."
    : "Forgot it? Delete <code>docs/auth.json</code> in shorts-runner and set up again.";
  $("#gate-err").textContent = msg;
  $("#in-pw").focus();
  $("#gate-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = $("#gate-btn"), err = $("#gate-err"), pw = $("#in-pw").value;
    err.textContent = ""; btn.disabled = true;
    try {
      if (setup) {
        const tok = $("#in-token").value.trim();
        if (!tok) throw new Error("Paste your GitHub token.");
        if (pw.length < 14) throw new Error("Use at least 14 characters (four random words work well).");
        if (pw !== $("#in-pw2").value) throw new Error("The passwords don't match.");
        btn.textContent = "Checking token…"; TOKEN = tok;
        await gh(`/repos/${FACTORY}`); await gh(`/repos/${RUNNER}`);
        btn.textContent = "Encrypting…";
        const box2 = await seal(tok, pw);
        let sha;
        try { sha = (await gh(`/repos/${RUNNER}/contents/docs/auth.json`)).sha; } catch (e) { if (e.status !== 404) throw e; }
        await gh(`/repos/${RUNNER}/contents/docs/auth.json`, { method: "PUT", body: {
          message: "Studio: encrypted sign-in", content: btoa(JSON.stringify(box2, null, 1)), ...(sha ? { sha } : {}) } });
        toast("Saved. Other devices can sign in within a minute.");
      } else {
        btn.textContent = "Unlocking…";
        try { TOKEN = await unseal(box, pw); } catch { throw new Error("Wrong password."); }
      }
      ($("#in-remember").checked ? localStorage : sessionStorage).setItem("studio.token", TOKEN);
      $("#in-pw").value = ""; $("#in-pw2").value = ""; $("#in-token").value = "";
      start();
    } catch (e) {
      if (setup) TOKEN = "";
      err.textContent = e.message === "unauthorized" ? "That token doesn't work." : e.message.replace(/^\d{3} /, "GitHub: ");
    } finally { btn.disabled = false; btn.textContent = setup ? "Encrypt and save" : "Unlock"; }
  };
}

/* ------------------------------------------------------------------ app shell, routing, polling */
const VIEWS = { today: viewToday, create: viewCreate, library: viewLibrary, channels: viewChannels, activity: viewActivity };
let current = "", pollT = 0, busy = false;
function start() {
  $("#gate").hidden = true; $("#app").hidden = false;
  route(); schedulePoll();
}
async function route(fresh = false) {
  const name = (location.hash.slice(1) || "today").split("/")[0];
  const v = VIEWS[name] ? name : "today";
  document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("on", a.dataset.view === v));
  if (v !== current) { $("#view").innerHTML = skeleton(); current = v; }
  busy = true; $("#btn-refresh").classList.add("spin");
  try { await VIEWS[v](fresh); }
  catch (e) { if (e.message !== "unauthorized") $("#view").innerHTML = `<div class="card empty">Couldn't load: ${esc(e.message)}</div>`; }
  finally { busy = false; $("#btn-refresh").classList.remove("spin"); }
}
const skeleton = () => `<div class="hero">${'<div class="card"><div class="skel" style="height:14px;width:60%"></div><div class="skel" style="height:26px;width:40%;margin-top:8px"></div></div>'.repeat(3)}</div>
  <div class="grid">${'<div class="card"><div class="skel" style="height:40px"></div><div class="skel" style="height:14px;margin-top:12px"></div></div>'.repeat(4)}</div>`;
function setHead(title, sub = "") { $("#view-title").textContent = title; $("#view-sub").textContent = sub; document.title = `${title} · Studio`; }
let anyRunning = false;
function schedulePoll() {
  stopPolling();
  pollT = setTimeout(async () => {
    if (!document.hidden && !busy && $("#sheet").hidden && !document.activeElement?.matches("input,textarea,select")) await route(true);
    schedulePoll();
  }, anyRunning ? 10000 : 60000);
}
function stopPolling() { clearTimeout(pollT); }
window.addEventListener("hashchange", () => route());
document.addEventListener("visibilitychange", () => { if (!document.hidden && TOKEN) route(true); });
$("#btn-refresh").onclick = () => { cache.clear(); route(true); };
$("#btn-lock").onclick = () => lock("Locked.");
document.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeSheet(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

function openSheet(html) { $("#sheet-body").innerHTML = html; $("#sheet").hidden = false; }
function closeSheet() {
  $("#sheet").hidden = true;
  const v = $("#sheet-body video"); if (v) { v.pause(); URL.revokeObjectURL(v.src); }
  $("#sheet-body").innerHTML = "";
}
async function confirmSheet(title, text, label = "Confirm", danger = false) {
  return new Promise((res) => {
    openSheet(`<h2>${esc(title)}</h2><p class="muted" style="margin:8px 0 18px">${text}</p>
      <div class="row"><button class="btn ${danger ? "danger" : "primary"}" id="cf-yes">${esc(label)}</button><button class="btn" id="cf-no">Cancel</button></div>`);
    $("#cf-yes").onclick = () => { closeSheet(); res(true); };
    $("#cf-no").onclick = () => { closeSheet(); res(false); };
  });
}

/* ------------------------------------------------------------------ shared data for views */
async function channelState(fresh) {
  const [ch, posted, rs, sets] = await Promise.all([variable("DAILY_CHANNELS", DEFAULT_CHANNELS), file("data/ig_posted.json", { fresh }), runs(fresh), vault(fresh)]);
  return { on: new Set(ch.split(",").map((s) => s.trim()).filter(Boolean)), posted: posted || {}, runs: rs, sets };
}
const dailyRunFor = (rs, day) => rs.find((r) => wfFile(r) === "daily-shorts.yml" && postDay(new Date(r.created_at)) === day && r.conclusion !== "skipped"
  && !(r.status === "completed" && new Date(r.updated_at) - new Date(r.run_started_at || r.created_at) < 120000));   // skip check-only runs
const videosIn = (set) => (set?.assets || []).filter((a) => a.name.endsWith(".mp4"));
const findVideo = (sets, names, re) => {
  for (const n of names) { const s = sets.find((x) => x.set === n); const a = videosIn(s).find((x) => re.test(x.name)); if (a) return a; }
  return null;
};
function pill(status) {
  const map = { posted: ["ok", "Posted"], ready: ["warn", "Ready"], made: ["ok", "Made"], making: ["run", "Making…"],
    failed: ["bad", "Failed"], paused: ["", "Paused"], none: ["", "No video"], running: ["run", "Running"], queued: ["run", "Queued"],
    success: ["ok", "Done"], failure: ["bad", "Failed"], cancelled: ["", "Cancelled"], skipped: ["", "Skipped"] };
  const [c, t] = map[status] || ["", status];
  return `<span class="pill ${c}">${t}</span>`;
}
const runStatus = (r) => (r.status === "completed" ? r.conclusion : r.status === "in_progress" ? "running" : "queued");
const runName = (r) => WF_NAMES[wfFile(r)] || r.name;
function runInputsLabel(r) {
  const t = r.display_title || "";
  return t && t !== r.name && t !== runName(r) ? t : "";
}

/* ------------------------------------------------------------------ TODAY */
async function viewToday(fresh) {
  const day = nyDate(), st = await channelState(fresh);
  const daily = dailyRunFor(st.runs, day);
  const djobs = daily ? await jobs(daily.id, fresh) : [];
  const steps = djobs.flatMap((j) => j.steps || []);
  const posting = st.runs.find((r) => wfFile(r) === "post-instagram.yml" && nyDate(new Date(r.created_at)) === day && r.event !== "schedule");
  const running = st.runs.filter((r) => r.status !== "completed");
  anyRunning = running.length > 0;
  const postAt = nextAt(18, 0, "America/New_York"), makeAt = nextAt(4, 15, "UTC");
  const nyH = hourIn(new Date(), "America/New_York");
  setHead("Today", `${prettyDay(day)} · ${nyH < 18 ? `posting ${until(postAt)} (6 PM ET, ${localTime(postAt)} your time)` : "today's posting time has passed"}`);

  const cards = CH.map((c) => {
    const on = st.on.has(c.key), rec = st.posted[day]?.[c.secret];
    const vid = findVideo(st.sets, [`daily-${day}`], c.file);
    const stp = steps.filter((s) => c.steps.includes(s.name));
    let status = "none";
    if (rec) status = "posted";
    else if (stp.some((s) => s.conclusion === "failure")) status = "failed";
    else if (daily && daily.status !== "completed" && on) status = "making";
    else if (vid) status = "ready";
    else if (!on) status = "paused";
    const link = rec?.result?.match(/https:\/\/\S+/)?.[0];
    const note = status === "posted" ? `<a href="${esc(link)}" target="_blank" rel="noopener">View the Reel ${ICON.ext}</a>`
      : status === "failed" ? `Something failed in today's run. <a href="#activity">See activity</a>`
      : status === "making" ? "Today's run is making it now."
      : status === "ready" ? "Made. It posts at 6 PM New York."
      : status === "paused" ? "Paused: turn it on in Channels."
      : daily?.status === "completed" ? "Nothing was made for this channel today." : "Not made yet.";
    return `<div class="card ch-card">
      <div class="row"><img class="avatar" src="${c.img}" alt=""><div class="grow"><h3 class="ellipsis">${c.name}</h3>
        <a class="kv" href="https://instagram.com/${c.user}" target="_blank" rel="noopener">@${c.user}</a></div>${pill(status)}</div>
      <p class="note">${note}</p>
      <div class="actions">
        ${vid ? `<button class="btn small" data-play="${vid.id}" data-name="${esc(c.name)}">${ICON.play}Watch</button>` : ""}
        ${c.ai ? `<a class="btn small" href="#create/${c.key}">${ICON.plus}Make one now</a>` : ""}
      </div></div>`;
  }).join("");

  $("#view").innerHTML = `
    <div class="hero">
      <div class="card"><span class="kv">Next videos made</span><span class="big-num">${until(makeAt).replace("in ", "")}</span><span class="kv">${localTime(makeAt)} your time · 9:15 AM Karachi</span></div>
      <div class="card"><span class="kv">Next posting</span><span class="big-num">${until(postAt).replace("in ", "")}</span><span class="kv">${localTime(postAt)} your time · 6 PM New York</span></div>
      <div class="card"><span class="kv">Running now</span><span class="big-num">${running.length || "None"}</span><span class="kv">${running.length ? running.map(runName).join(", ") : "All quiet"}</span></div>
    </div>
    ${running.length ? `<div class="section"><h2>In progress</h2>${(await Promise.all(running.map((r) => runCard(r, fresh)))).join("")}</div>` : ""}
    <div class="section"><div class="section-head"><h2>Channels today</h2>
      ${posting ? `<span class="kv">Posting run ${ago(posting.created_at)} ${pill(runStatus(posting))}</span>` : ""}</div>
      <div class="grid">${cards}</div></div>
    <div class="section"><h2>Quick actions</h2><div class="row wrap">
      <button class="btn" data-act="post">${ICON.send}Post now</button>
      <button class="btn" data-act="check">${ICON.check}Check accounts</button>
      <button class="btn" data-act="remake">${ICON.redo}Make today's videos again</button>
    </div></div>`;
  bindCommon();
  $("#view").querySelector('[data-act="post"]').onclick = async () => {
    if (!await confirmSheet("Post now?", "Posts every video made for today that isn't posted yet, to all connected accounts, right away.", "Post now")) return;
    await dispatch("post-instagram.yml", { dry_run: "false", report: "false" }); toast("Posting started"); later();
  };
  $("#view").querySelector('[data-act="check"]').onclick = async () => {
    await dispatch("post-instagram.yml", { dry_run: "true", report: "false" }); toast("Checking accounts: the result goes to Discord"); later();
  };
  $("#view").querySelector('[data-act="remake"]').onclick = async () => {
    if (!await confirmSheet("Make today's videos again?", "Runs the whole daily job again (all channels, including the two Claude episodes, which use your Claude plan). Takes about an hour.", "Start")) return;
    await dispatch("daily-shorts.yml", { force: "true" }); toast("Daily run started"); later();
  };
}
const later = () => setTimeout(() => { cache.clear(); route(true); }, 2500);

async function runCard(r, fresh) {
  const js = await jobs(r.id, fresh).catch(() => []);
  const steps = js.flatMap((j) => j.steps || []).filter((s) => !/^(Set up job|Complete job|Post )/.test(s.name) && s.conclusion !== "skipped");
  const done = steps.filter((s) => s.status === "completed").length, now = steps.find((s) => s.status === "in_progress");
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 4;
  return `<div class="card stack">
    <div class="row"><div class="grow"><h3>${esc(runName(r))}</h3><span class="kv">${esc(runInputsLabel(r))} started ${ago(r.run_started_at || r.created_at)} · ${dur(r.run_started_at || r.created_at)}</span></div>${pill(runStatus(r))}</div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="row"><span class="kv grow ellipsis">${now ? esc(now.name) : r.status === "queued" ? "Waiting for a runner…" : "Starting…"}</span>
      <a class="btn small" href="${r.html_url}" target="_blank" rel="noopener">Log ${ICON.ext}</a>
      <button class="btn small danger" data-cancel="${r.id}">Stop</button></div></div>`;
}
function bindCommon() {
  document.querySelectorAll("[data-play]").forEach((b) => (b.onclick = () => playVideo(+b.dataset.play, b.dataset.name)));
  document.querySelectorAll("[data-cancel]").forEach((b) => (b.onclick = async () => {
    if (!await confirmSheet("Stop this run?", "It stops at the next step. Nothing is posted from a stopped run.", "Stop run", true)) return;
    await gh(`/repos/${RUNNER}/actions/runs/${b.dataset.cancel}/cancel`, { method: "POST" }); toast("Stopping…"); later();
  }));
}

/* ------------------------------------------------------------------ video player (kept videos are private) */
async function playVideo(assetId, title = "Video", extra = "") {
  openSheet(`<h2>${esc(title)}</h2>${extra}<div class="video-wrap" style="margin-top:14px"><p class="muted" id="vp-msg">Loading the video…</p></div>`);
  try {
    const r = await fetch(`${API}/repos/${FACTORY}/releases/assets/${assetId}`, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/octet-stream" } });
    if (!r.ok) throw new Error(r.status);
    const total = +r.headers.get("content-length") || 0, reader = r.body.getReader(), parts = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value); got += value.length;
      const m = $("#vp-msg"); if (!m) return;   // closed
      m.textContent = `Loading… ${(got / 1e6).toFixed(1)}${total ? ` / ${(total / 1e6).toFixed(1)}` : ""} MB`;
    }
    const wrap = $("#sheet-body .video-wrap"); if (!wrap) return;
    wrap.innerHTML = `<video class="video" controls playsinline autoplay src="${URL.createObjectURL(new Blob(parts, { type: "video/mp4" }))}"></video>`;
  } catch (e) {
    const wrap = $("#sheet-body .video-wrap");
    if (wrap) wrap.innerHTML = `<p class="muted" style="padding:20px;text-align:center">The browser couldn't load it here.<br>
      <a href="https://github.com/${FACTORY}/releases" target="_blank" rel="noopener">Open the kept videos on GitHub ${ICON.ext}</a> or find it in Discord.</p>`;
  }
}

/* ------------------------------------------------------------------ CREATE */
async function viewCreate(fresh) {
  const pre = location.hash.split("/")[1];
  let sel = chOf(pre)?.ai ? pre : "case";
  setHead("Create", "Make a new episode on demand. Claude writes and builds it (it uses your Claude plan).");
  const rs = await runs(fresh);
  const mine = rs.filter((r) => ["case-episode.yml", "milo-episode.yml"].includes(wfFile(r))).slice(0, 6);
  const running = mine.filter((r) => r.status !== "completed");
  anyRunning = rs.some((r) => r.status !== "completed");
  const draw = async () => {
    const c = chOf(sel);
    $("#view").innerHTML = `
      <div class="card stack" style="gap:18px">
        <div class="picker">${CH.filter((x) => x.ai).map((x) => `<button class="pick ${x.key === sel ? "on" : ""}" data-pick="${x.key}">
          <img class="avatar" src="${x.img}" alt=""><span><b>${x.name}</b><small>${x.key === "case" ? "True crime & mysteries" : "Crazy what-if scenarios"}</small></span></button>`).join("")}</div>
        <label class="field" style="margin:0"><span>What should it be about? <span style="font-weight:400">(optional: leave empty and Claude picks)</span></span>
          <textarea id="c-hint" placeholder="${c.key === "case" ? "e.g. The 2003 Antwerp diamond heist" : "e.g. What if every phone on Earth died at noon?"}"></textarea></label>
        <div class="chips">${c.hints.map((h) => `<button class="chip" data-chip="${esc(h)}">${esc(h)}</button>`).join("")}</div>
        <label class="row" style="justify-content:space-between"><span><b>Post to Instagram when ready</b><br><span class="kv">Off: it goes to Discord and Studio only.</span></span>
          <span class="switch"><input type="checkbox" id="c-post"><span></span></span></label>
        <details><summary class="kv" style="cursor:pointer">Advanced</summary>
          <div style="margin-top:12px" class="stack">
            <label class="field"><span>Episode name</span><input type="text" id="c-ep" value="${c.key}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})(\d{4})$/, "$1-$2")}"></label>
            <label class="check"><input type="checkbox" id="c-ro"> <span>Only re-render this existing episode (no new writing)</span></label>
          </div></details>
        <button class="btn primary" id="c-go" style="justify-self:start">${ICON.plus}Make the video</button>
      </div>
      <div class="section"><h2>Recent on-demand videos</h2>
        ${running.length ? (await Promise.all(running.map((r) => runCard(r, fresh)))).join("") : ""}
        <div class="list">${mine.filter((r) => r.status === "completed").map((r) => `<a class="item" href="${r.html_url}" target="_blank" rel="noopener">
          <img class="avatar sm" src="${(wfFile(r) === "case-episode.yml" ? chOf("case") : chOf("milo")).img}" alt="">
          <div class="grow"><div class="title ellipsis">${esc(runInputsLabel(r) || runName(r))}</div><div class="meta">${ago(r.created_at)} · ${dur(r.run_started_at, r.updated_at)}</div></div>${pill(runStatus(r))}</a>`).join("")
          || `<div class="empty">Nothing yet.</div>`}</div></div>`;
    document.querySelectorAll("[data-pick]").forEach((b) => (b.onclick = () => { sel = b.dataset.pick; draw(); }));
    document.querySelectorAll("[data-chip]").forEach((b) => (b.onclick = () => { $("#c-hint").value = b.dataset.chip; $("#c-hint").focus(); }));
    bindCommon();
    $("#c-go").onclick = async () => {
      const btn = $("#c-go"), ep = $("#c-ep").value.trim().replace(/[^\w.-]+/g, "-");
      if (!ep) return toast("Give the episode a name", true);
      btn.disabled = true; btn.textContent = "Starting…";
      try {
        await dispatch(c.make, { episode: ep, hint: $("#c-hint").value.trim(), render_only: String($("#c-ro").checked), post: String($("#c-post").checked) });
        toast(`${c.name}: started. It takes about 30 minutes.`); later();
      } catch (e) { toast("Couldn't start: " + e.message, true); btn.disabled = false; btn.innerHTML = `${ICON.plus}Make the video`; }
    };
  };
  await draw();
}

/* ------------------------------------------------------------------ LIBRARY */
let libTab = "all";
async function viewLibrary(fresh) {
  setHead("Library", "Episodes Claude made, with their scripts. Videos are kept privately for 7 days.");
  const [cases, story, sets] = await Promise.all([file("data/case/history.json", { fresh }), file("data/story/history.json", { fresh }), vault(fresh)]);
  const items = [
    ...(cases || []).map((h) => ({ ch: "case", ep: h.episode, date: h.date, title: h.title, sub: `${h.case}${h.kind ? " · " + h.kind : ""}` })),
    ...(story || []).filter((h) => h.engine === "hyperframes").map((h) => ({ ch: "milo", ep: h.episode, date: h.date, title: h.title, sub: h.topic })),
  ].sort((a, b) => (b.date + b.ep).localeCompare(a.date + a.ep));
  const shown = items.filter((i) => libTab === "all" || i.ch === libTab);
  const kept = sets.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  $("#view").innerHTML = `
    <div class="tabs">${[["all", "All"], ["case", "Case Unsealed"], ["milo", "Hey Milo"]].map(([k, t]) => `<button class="${libTab === k ? "on" : ""}" data-tab="${k}">${t}</button>`).join("")}</div>
    <div class="list">${shown.map((i, n) => `<div class="item" data-ep="${n}"><img class="avatar sm" src="${chOf(i.ch).img}" alt="">
      <div class="grow"><div class="title ellipsis">${esc(i.title)}</div><div class="meta ellipsis">${prettyDay(i.date)} · ${esc(i.sub || "")}</div></div>
      ${findVideo(sets, [`daily-${i.ep}`, `${i.ch}-${i.ep}`], chOf(i.ch).file) ? `<span class="pill ok">Video</span>` : ""}</div>`).join("") || `<div class="empty">No episodes yet.</div>`}</div>
    <div class="section"><h2>Kept videos</h2><div class="list">${kept.map((s) => `<div class="item" data-set="${esc(s.set)}">
      <div class="grow"><div class="title">${esc(s.set)}</div><div class="meta">${videosIn(s).length} video${videosIn(s).length === 1 ? "" : "s"} · ${ago(s.created_at)} · deleted after 7 days</div></div></div>`).join("")
      || `<div class="empty">Nothing kept yet. New runs keep their videos here.</div>`}</div></div>`;
  document.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { libTab = b.dataset.tab; viewLibrary(); }));
  document.querySelectorAll("[data-ep]").forEach((el) => (el.onclick = () => episodeSheet(shown[+el.dataset.ep], sets)));
  document.querySelectorAll("[data-set]").forEach((el) => (el.onclick = () => {
    const s = kept.find((x) => x.set === el.dataset.set), vids = videosIn(s);
    openSheet(`<h2>${esc(s.set)}</h2><p class="kv" style="margin:4px 0 14px">Kept ${ago(s.created_at)}</p><div class="list">${vids.map((a) => `<div class="item" data-play="${a.id}" data-name="${esc(a.name.split("__").pop())}">
      ${ICON.play}<div class="grow"><div class="title">${esc(a.name.split("__").pop())}</div><div class="meta">${(a.size / 1e6).toFixed(1)} MB</div></div></div>`).join("")
      || `<div class="empty">This set only has the full archive (made before single videos were kept).</div>`}</div>`);
    bindCommon();
  }));
}
async function episodeSheet(i, sets) {
  const c = chOf(i.ch);
  openSheet(`<div class="row"><img class="avatar" src="${c.img}" alt=""><div><h2>${esc(i.title)}</h2><span class="kv">${c.name} · ${prettyDay(i.date)} · ${esc(i.ep)}</span></div></div><div id="ep-body" style="margin-top:16px"><div class="skel" style="height:120px"></div></div>`);
  const e = await file(`data/${i.ch === "case" ? "case" : "milo"}/${i.ep}/episode.json`).catch(() => null);
  const vid = findVideo(sets, [`daily-${i.ep}`, `${i.ch}-${i.ep}`], c.file);
  const m = e?.meta || {};
  $("#ep-body").innerHTML = `
    ${vid ? `<button class="btn primary" id="ep-play">${ICON.play}Watch the video</button>` : `<p class="kv">No kept video (older than 7 days, or made before videos were kept).</p>`}
    ${m.hook ? `<p style="margin-top:16px"><b>${esc([].concat(m.hook).join(" / "))}</b></p>` : ""}
    ${m.case || m.premise ? `<p class="muted" style="margin-top:4px">${esc(m.case || m.premise)}${m.kind ? " · " + esc(m.kind) : ""}</p>` : ""}
    ${e?.lines ? `<h3 style="margin:18px 0 8px">Script</h3><div class="script">${e.lines.map((l) => `<p>${esc(l)}</p>`).join("")}</div>` : ""}
    ${m.question ? `<p class="kv" style="margin-top:12px">Caption question: ${esc(m.question)}</p>` : ""}
    ${m.sources?.length ? `<h3 style="margin:18px 0 6px">Sources</h3><div class="sources">${m.sources.map((s) => `<a href="${esc(s)}" target="_blank" rel="noopener">${esc(s)}</a>`).join("")}</div>` : ""}
    <div class="row" style="margin-top:18px"><a class="btn small" href="https://github.com/${FACTORY}/tree/main/data/${i.ch === "case" ? "case" : "milo"}/${encodeURIComponent(i.ep)}" target="_blank" rel="noopener">Files ${ICON.ext}</a>
      <a class="btn small" href="#create/${i.ch}" data-close>${ICON.plus}Make another</a></div>`;
  if (vid) $("#ep-play").onclick = () => playVideo(vid.id, i.title);
}

/* ------------------------------------------------------------------ CHANNELS */
async function viewChannels(fresh) {
  setHead("Channels", "What runs every day, and notes for the next episodes.");
  const [chs, hintsRaw] = await Promise.all([variable("DAILY_CHANNELS", DEFAULT_CHANNELS), variable("HINTS", "{}")]);
  const on = new Set(chs.split(",").map((s) => s.trim()).filter(Boolean));
  let hints = {}; try { hints = JSON.parse(hintsRaw || "{}"); } catch { hints = {}; }
  const makeAt = nextAt(4, 15, "UTC"), postAt = nextAt(18, 0, "America/New_York");
  $("#view").innerHTML = `
    <div class="list">${CH.map((c) => `<div class="item" style="cursor:default;align-items:flex-start;flex-wrap:wrap">
      <img class="avatar" src="${c.img}" alt="">
      <div class="grow"><div class="title">${c.name}</div><a class="meta" href="https://instagram.com/${c.user}" target="_blank" rel="noopener">@${c.user}</a></div>
      <label class="switch" title="Make a video every day"><input type="checkbox" data-ch="${c.key}" ${on.has(c.key) ? "checked" : ""}><span></span></label>
      ${c.ai ? `<div class="stack hint-box"><textarea data-hint="${c.key}" placeholder="Note for the next daily episode (optional), e.g. ${c.key === "case" ? "cover the Lufthansa heist" : "make it about space"}">${esc(hints[c.key] || "")}</textarea>
        <div class="row wrap"><button class="btn small" data-savehint="${c.key}">Save note</button><span class="kv">Used once by the next daily run, then cleared.</span></div></div>` : ""}</div>`).join("")}</div>
    <div class="grid">
      <div class="card stack"><h3>Schedule</h3>
        <div class="kv">Videos are made every day at <b>9:15 AM Karachi</b> (${localTime(makeAt)} your time), next ${until(makeAt)}.</div>
        <div class="kv">They post at <b>6:00 PM New York</b> (${localTime(postAt)} your time), next ${until(postAt)}.</div>
        <div class="kv">Started by cron-job.org; GitHub's own schedule is the safety net.</div></div>
      <div class="card stack"><h3>Security</h3>
        <div class="kv">Your GitHub token is stored encrypted in this page and unlocked with your password in your browser only.</div>
        <div class="row wrap"><button class="btn small" id="pw-change">Change password</button><button class="btn small danger" id="pw-lock">Lock this device</button></div></div>
    </div>`;
  document.querySelectorAll("[data-ch]").forEach((sw) => (sw.onchange = async () => {
    const keys = [...document.querySelectorAll("[data-ch]")].filter((x) => x.checked).map((x) => x.dataset.ch);
    try { await setVariable("DAILY_CHANNELS", keys.join(",") || "none"); toast(`${chOf(sw.dataset.ch).name}: ${sw.checked ? "on" : "paused"} from the next run`); }
    catch (e) { sw.checked = !sw.checked; toast("Couldn't save: " + e.message, true); }
  }));
  document.querySelectorAll("[data-savehint]").forEach((b) => (b.onclick = async () => {
    const all = {}; document.querySelectorAll("[data-hint]").forEach((t) => { if (t.value.trim()) all[t.dataset.hint] = t.value.trim(); });
    try { await setVariable("HINTS", JSON.stringify(all)); toast("Note saved for the next daily run"); } catch (e) { toast("Couldn't save: " + e.message, true); }
  }));
  $("#pw-lock").onclick = () => lock("Locked.");
  $("#pw-change").onclick = () => {
    openSheet(`<h2>Change password</h2><p class="muted" style="margin:6px 0 16px">At least 14 characters. Other devices will need the new password.</p>
      <label class="field"><span>New password</span><input type="password" id="np1" autocomplete="new-password"></label>
      <label class="field"><span>Repeat</span><input type="password" id="np2" autocomplete="new-password"></label>
      <button class="btn primary" id="np-go">Save</button><p class="err" id="np-err"></p>`);
    $("#np-go").onclick = async () => {
      const a = $("#np1").value, b = $("#np2").value;
      if (a.length < 14) return ($("#np-err").textContent = "Use at least 14 characters.");
      if (a !== b) return ($("#np-err").textContent = "They don't match.");
      $("#np-go").disabled = true; $("#np-go").textContent = "Encrypting…";
      try {
        const sha = (await gh(`/repos/${RUNNER}/contents/docs/auth.json`, { fresh: true })).sha;
        await gh(`/repos/${RUNNER}/contents/docs/auth.json`, { method: "PUT", body: { message: "Studio: new password", content: btoa(JSON.stringify(await seal(TOKEN, a), null, 1)), sha } });
        closeSheet(); toast("Password changed");
      } catch (e) { $("#np-err").textContent = e.message; $("#np-go").disabled = false; $("#np-go").textContent = "Save"; }
    };
  };
}

/* ------------------------------------------------------------------ ACTIVITY */
async function viewActivity(fresh) {
  setHead("Activity", "Every run, newest first. Tap one for its steps.");
  const rs = await runs(fresh);
  anyRunning = rs.some((r) => r.status !== "completed");
  const how = (r) => ({ workflow_dispatch: "manual or cron-job.org", schedule: "GitHub schedule", push: "push" }[r.event] || r.event);
  $("#view").innerHTML = `<div class="list">${rs.map((r) => `<div class="item" data-run="${r.id}">
      <div class="grow"><div class="title ellipsis">${esc(runName(r))}${runInputsLabel(r) ? ` <span class="kv">· ${esc(runInputsLabel(r))}</span>` : ""}</div>
      <div class="meta">${ago(r.created_at)} · ${how(r)}${r.run_started_at ? " · " + dur(r.run_started_at, r.status === "completed" ? r.updated_at : null) : ""}</div></div>
      ${pill(runStatus(r))}</div>`).join("") || `<div class="empty">No runs yet.</div>`}</div>`;
  document.querySelectorAll("[data-run]").forEach((el) => (el.onclick = async () => {
    const r = rs.find((x) => x.id === +el.dataset.run);
    openSheet(`<h2>${esc(runName(r))}</h2><p class="kv" style="margin:4px 0 12px">${esc(runInputsLabel(r))} ${ago(r.created_at)}</p><div id="run-steps"><div class="skel" style="height:120px"></div></div>`);
    const js = await jobs(r.id, true);
    const st = js.flatMap((j) => j.steps || []).filter((s) => !/^(Set up job|Complete job|Post )/.test(s.name));
    $("#run-steps").innerHTML = `<div class="steps">${st.map((s) => `<div class="step"><span class="dot ${s.conclusion === "success" ? "ok" : s.conclusion === "failure" ? "bad" : s.status === "in_progress" ? "run" : ""}"></span>
        <span class="grow">${esc(s.name)}</span><span class="kv">${s.conclusion === "skipped" ? "skipped" : dur(s.started_at, s.completed_at)}</span></div>`).join("") || `<p class="kv">No steps yet.</p>`}</div>
      <div class="row wrap" style="margin-top:16px"><a class="btn small" href="${r.html_url}" target="_blank" rel="noopener">Full log ${ICON.ext}</a>
      ${r.status !== "completed" ? `<button class="btn small danger" data-cancel="${r.id}">Stop</button>` : ""}
      ${r.conclusion === "failure" ? `<button class="btn small" id="rerun">${ICON.redo}Retry failed part</button>` : ""}</div>`;
    bindCommon();
    const rr = $("#rerun"); if (rr) rr.onclick = async () => { await gh(`/repos/${RUNNER}/actions/runs/${r.id}/rerun-failed-jobs`, { method: "POST" }); closeSheet(); toast("Retrying…"); later(); };
  }));
}

/* ------------------------------------------------------------------ boot */
(async () => {
  if (TOKEN) {
    try { await gh(`/repos/${FACTORY}`, { ttl: 0 }); start(); return; }
    catch (e) { if (e.message === "unauthorized") return; }   // the gate is already showing
  }
  showGate();
})();
