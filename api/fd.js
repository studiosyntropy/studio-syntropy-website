// Field Days · 田間日 — applications, profiles and hours for studio-syntropy.com
// Storage: one encrypted JSON document in the private Vercel Blob store "field-days" (Tokyo),
// plus one encrypted file per application with fitness/safety answers, deleted after the day.
// Admin actions only work on the Vercel-protected address (Vercel sign-in required):
//   https://studio-syntropy-website-studiosyntropys-projects.vercel.app/admin/field-days
import { put, get, del, head, BlobNotFoundError, BlobPreconditionFailedError } from '@vercel/blob';
import crypto from 'node:crypto';

const DB = 'fd/db.json';
const TZ = 'Asia/Taipei';
const ADMIN_HOST = /^[a-z0-9-]+-studiosyntropys-projects\.vercel\.app$/;
const TYPES = ['learning', 'volunteer', 'paid', 'course'];
const EXP = ['planting', 'pruning', 'chopdrop', 'nursery', 'mulching', 'none'];
const AVAIL = ['full', 'am', 'pm'];
const RTW = ['citizen', 'permit', 'student', 'none'];
const STATUS = ['confirmed', 'waitlist', 'review', 'declined', 'cancelled'];
const TYPE_LABEL = { learning: ['Learning day', '學習日'], volunteer: ['Volunteer day', '志工日'], paid: ['Paid work', '有薪工作'], course: ['Course', '課程'] };
const STATUS_LABEL = { confirmed: 'Confirmed', waitlist: 'Waiting list', review: 'To review', declined: 'Declined', cancelled: 'Cancelled' };
const SITE = 'https://studio-syntropy.com';
const ADMIN_URL = 'https://studio-syntropy-website-studiosyntropys-projects.vercel.app/admin/field-days';

// ---------------------------------------------------------------- helpers
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const now = () => new Date().toISOString();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const str = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const rid = (n = 12) => crypto.randomBytes(n).toString('base64url');
const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ref = () => 'FD-' + Array.from(crypto.randomBytes(5), b => REF_CHARS[b % REF_CHARS.length]).join('');
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 200;
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
const isTime = t => /^\d{2}:\d{2}$/.test(t);
const mins = t => (isTime(t) ? +t.slice(0, 2) * 60 + +t.slice(3) : 0);
const bi = (v, max) => ({ en: str(v && v.en, max), zh: str(v && v.zh, max) });
const biText = (v, max) => ({ en: text(v && v.en, max), zh: text(v && v.zh, max) });

function key() {
  const k = process.env.FD_KEY;
  if (!k) throw new Error('FD_KEY is not set');
  return Buffer.from(k, 'base64');
}
function enc(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') });
}
function dec(txt) {
  const o = JSON.parse(txt);
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(o.iv, 'base64'));
  d.setAuthTag(Buffer.from(o.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(o.data, 'base64')), d.final()]).toString('utf8'));
}

// ---------------------------------------------------------------- storage
const PUT_OPTS = { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' };
async function readBlob(path) {
  const r = await get(path, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return { txt: await new Response(r.stream).text(), etag: r.blob.etag };
}
async function load() {
  // The version tag (etag) must come from the Blob API (head), not from the file download:
  // only the API's etag is accepted by put(..., { ifMatch }). Read the tag first, then the content,
  // so a write in between makes the save fail and retry instead of overwriting newer data.
  let etag = null;
  try { etag = (await head(DB)).etag; } catch (e) { if (!(e instanceof BlobNotFoundError || /does not exist|not.?found/i.test((e && e.message) || ''))) throw e; }
  const r = etag ? await readBlob(DB) : null;
  if (!r) return { db: { v: 1, days: [], apps: [], people: [] }, etag: null };
  return { db: dec(r.txt), etag };
}
// Read, change and write the document; retries when someone else wrote in between.
async function mutate(fn) {
  for (let i = 0; i < 6; i++) {
    const { db, etag } = await load();
    const out = await fn(db);
    if (out && out.noSave) return out;
    try {
      await put(DB, enc(db), etag ? { ...PUT_OPTS, ifMatch: etag } : PUT_OPTS);
      return out;
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError || /precondition/i.test((e && e.message) || '')) { await sleep(120 + Math.random() * 400); continue; }
      throw e;
    }
  }
  throw new Error('busy');
}
const healthPath = id => `fd/health/${id}.json`;

// ---------------------------------------------------------------- domain
const count = (db, dayId, status) => db.apps.filter(a => a.dayId === dayId && a.status === status).length;
function publicDay(db, d) {
  const taken = count(db, d.id, 'confirmed');
  return { id: d.id, date: d.date, start: d.start, end: d.end, type: d.type, title: d.title, place: d.place, organiser: d.organiser,
           desc: d.desc, capacity: d.capacity, left: Math.max(0, d.capacity - taken), review: !!d.review, status: d.status };
}
// When a confirmed place frees up, the first person on the waiting list moves up.
function promote(db, day) {
  if (!day || day.review) return null;
  if (count(db, day.id, 'confirmed') >= day.capacity) return null;
  const next = db.apps.filter(a => a.dayId === day.id && a.status === 'waitlist').sort((a, b) => a.created.localeCompare(b.created))[0];
  if (next) { next.status = 'confirmed'; next.updated = now(); next.promoted = now(); }
  return next || null;
}
// Personal record link: a long random key per person, sent only to their own email address.
// It sits after # in the address, so it never reaches server logs or visitor statistics.
function ensureKey(p) { if (!p.key) p.key = rid(24); return p.key; }
const recordUrl = p => `${SITE}/${p.lang === 'zh' ? 'zh/' : ''}field-days#me=${p.key}`;
const levelOf = (h, days) => (h >= 50 ? 'climax' : h >= 10 ? 'secondary' : days > 0 ? 'pioneer' : '');
function verifiedHours(db, personId) {
  return db.apps.filter(a => a.personId === personId && a.attended === true).reduce((s, a) => s + (+a.hours || 0), 0);
}

// ---------------------------------------------------------------- email (active once RESEND_API_KEY and FD_FROM are set)
async function mail(to, subject, body, html) {
  const k = process.env.RESEND_API_KEY, from = process.env.FD_FROM;
  if (!k || !from || !to) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text: body, html: html || undefined, reply_to: process.env.FD_NOTIFY || undefined }),
    });
    return r.ok;
  } catch { return false; }
}
// Gengfutian Farm: map links and the directions map (img/gengfutian-directions.png, made from OpenStreetMap data)
const GFT = {
  map: 'https://maps.app.goo.gl/kjoQpfYQiZW8n7XJ6',
  forest: 'https://www.google.com/maps/search/?api=1&query=23.9950603%2C121.5615374',
  img: `${SITE}/img/gengfutian-directions.png`,
  addr: ['Tzu Chi University dormitory entrance, Sec. 2, Jianguo Rd., Ji’an Township, Hualien County (corner of Mingyi 5th St.)', '花蓮縣吉安鄉建國路二段，慈濟大學宿舍入口（明義五街口）'],
  route: ['From the entrance (A), go straight for about 30 m, then turn right onto the paved campus road. Follow it through all its turns, west along the north side of the dormitories, then left (south) along the Zhimei Building (致美樓) to where the pavement ends. Turn right, then left onto the unpaved path; the classroom (B) is straight ahead. The food forest lies about 80 m further south-west.',
          '從入口（A）直行約 30 公尺後，右轉進入校園柏油路。沿著道路的每個轉彎前行，經宿舍北側向西，再沿致美樓向左（南）轉，走到柏油路盡頭。接著先右轉再左轉走上未鋪面小徑，教室（B）就在正前方。食物森林位於教室西南方約 80 公尺處。'],
};
const isGft = d => /gengfutian|耕福田/i.test((d.place && `${d.place.en} ${d.place.zh}`) || '');
const dirUrl = zh => `${SITE}/${zh ? 'zh/' : ''}field-days#getting-there`;
const h = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function applicantMail(p, a, d) {
  const zh = p.lang === 'zh', L = zh ? 1 : 0, gft = isGft(d);
  const t = (d.title && (zh ? d.title.zh || d.title.en : d.title.en)) || TYPE_LABEL[d.type][L];
  const place = (d.place && (zh ? d.place.zh || d.place.en : d.place.en || d.place.zh)) || '';
  const st = zh ? { confirmed: '您的名額已確認。', waitlist: '這一天已額滿，您已列入候補名單。若有名額釋出，我們會與您聯絡。', review: '我們已收到您的申請，將在幾天內回覆。' }
                : { confirmed: 'Your place is confirmed.', waitlist: 'This day is full. You are on the waiting list, and we will contact you if a place opens.', review: 'Your application has been received; we will reply within a few days.' };
  const W = zh ? { hi: `${p.name} 您好：`, date: '日期', place: '地點', entrance: '入口', maps: 'Google 地圖', dir: '地圖與路線', forest: '在 Google 地圖開啟食物森林', ref: '申請編號',
                   rec: '您的田間日紀錄（時數與即將參加的日子，也可在此取消申請）：', open: '開啟我的紀錄', priv: '此連結僅供您本人使用，請勿轉寄。', sig: '趨合工作室 Studio Syntropy', osm: '地圖資料 © OpenStreetMap 貢獻者',
                   alt: '前往耕福田農場的路線圖：從宿舍入口（A）到教室（B），星號為食物森林。' }
                 : { hi: `Dear ${p.name},`, date: 'Date', place: 'Place', entrance: 'Entrance', maps: 'Google Maps', dir: 'Map and directions', forest: 'Food forest in Google Maps', ref: 'Reference',
                   rec: 'Your Field Days record, with your hours and upcoming days, where you can also cancel:', open: 'Open my record', priv: 'This link is personal; please keep it to yourself.', sig: 'Studio Syntropy 趨合工作室', osm: 'Map data © OpenStreetMap contributors',
                   alt: 'Map of the route to Gengfutian Farm: from the dormitory entrance (A) to the classroom (B); the star marks the food forest.' };
  const sep = zh ? '：' : ': ', when = zh ? `${d.date}，${d.start}–${d.end}` : `${d.date}, ${d.start}–${d.end}`;
  const subject = zh ? `田間日 ${d.date}：${t}` : `Field Days ${d.date}: ${t}`;
  const text = [W.hi, '', st[a.status] || '', '', t, W.date + sep + when, W.place + sep + place,
    ...(gft ? [W.entrance + sep + GFT.addr[L], W.maps + sep + GFT.map, W.dir + sep + dirUrl(zh)] : []),
    W.ref + sep + a.ref, '', W.rec, recordUrl(p), W.priv, '', W.sig].join('\n');
  const row = (k, v) => `<tr><td style="padding:3px 16px 3px 0;color:#3F5444;vertical-align:top;white-space:nowrap">${h(k)}</td><td style="padding:3px 0;vertical-align:top">${v}</td></tr>`;
  const link = (u, txt) => `<a href="${h(u)}" style="color:#1D3A26;font-weight:700">${h(txt)}</a>`;
  const html = `<div style="font-family:'Atkinson Hyperlegible Next',Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1D3A26;max-width:600px">
<p style="margin:0 0 12px">${h(W.hi)}</p>
<p style="margin:0 0 16px;font-weight:700">${h(st[a.status] || '')}</p>
<p style="margin:0 0 6px;font-size:18px;font-weight:700">${h(t)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">
${row(W.date, h(when))}
${row(W.place, gft ? link(GFT.map, place) : h(place))}
${gft ? row(W.entrance, link(GFT.map, GFT.addr[L])) : ''}
${row(W.ref, h(a.ref))}
</table>
${gft ? `<p style="margin:0 0 8px"><a href="${h(dirUrl(zh))}"><img src="${GFT.img}" width="560" alt="${h(W.alt)}" style="display:block;width:100%;max-width:560px;height:auto;border:1px solid #CFC5AC;border-radius:6px"></a></p>
<p style="margin:0 0 16px;font-size:15px;color:#3F5444">${h(GFT.route[L])}<br>${link(dirUrl(zh), W.dir)} · ${link(GFT.forest, W.forest)}</p>` : ''}
<p style="margin:0 0 4px">${h(W.rec)}</p>
<p style="margin:0 0 4px">${link(recordUrl(p), W.open)}</p>
<p style="margin:0 0 16px;font-size:14px;color:#3F5444">${h(W.priv)}</p>
<p style="margin:0">${h(W.sig)}</p>
${gft ? `<p style="margin:16px 0 0;font-size:12px;color:#777">${h(W.osm)}</p>` : ''}
</div>`;
  return [subject, text, html];
}
function linkMail(p) {
  return p.lang === 'zh'
    ? ['您的田間日紀錄', `${p.name} 您好：\n\n這是您田間日紀錄的連結，可查看您的時數與即將參加的日子，也可在此取消申請：\n${recordUrl(p)}\n此連結僅供您本人使用，請勿轉寄。\n\n趨合工作室 Studio Syntropy`]
    : ['Your Field Days record', `Dear ${p.name},\n\nHere is the link to your Field Days record, with your hours and upcoming days, where you can also cancel:\n${recordUrl(p)}\nThis link is personal; please keep it to yourself.\n\nStudio Syntropy 趨合工作室`];
}
// Notices for the studio inbox only (FD_NOTIFY). Never sent to applicants.
function studioNotice(kind, p, a, d) {
  const day = `${d.date}, ${d.start}–${d.end} · ${TYPE_LABEL[d.type][0]}${d.title && d.title.en ? ' · ' + d.title.en : ''}`;
  const who = [`Name: ${p.name}`, `Email: ${p.email}`, p.phone ? `Phone: ${p.phone}` : '', p.line ? `LINE: ${p.line}` : ''].filter(Boolean).join('\n');
  const head = kind === 'cancel' ? 'Cancelled application' : 'New application';
  return mail(process.env.FD_NOTIFY, `Field Days: ${kind === 'cancel' ? 'cancellation' : 'new application'} for ${d.date} (${STATUS_LABEL[a.status] || a.status})`,
    `${head} · for the studio only\n\n${who}\nDay: ${day}\nStatus: ${STATUS_LABEL[a.status] || a.status}\nReference: ${a.ref}\n\nAdmin page (studio only; opens after signing in to Vercel):\n${ADMIN_URL}`);
}

// ---------------------------------------------------------------- public actions
async function listDays() {
  const { db } = await load();
  const t = today();
  return { days: db.days.filter(d => d.status === 'open' && d.date >= t).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).map(d => publicDay(db, d)) };
}

async function apply(b) {
  if (b.website) return { ok: true, ref: ref(), status: 'review' };   // spam trap: humans never fill this field
  const errors = [];
  const name = str(b.name, 100), email = str(b.email, 200).toLowerCase();
  if (name.length < 2) errors.push('name');
  if (!emailOk(email)) errors.push('email');
  if (!AVAIL.includes(b.avail)) errors.push('avail');
  if (!['yes', 'limit'].includes(b.fit)) errors.push('fit');
  if (b.healthConsent !== true) errors.push('healthConsent');
  if (b.privacy !== true) errors.push('privacy');
  const fields = {
    phone: str(b.phone, 40), line: str(b.line, 60), lang: b.lang === 'zh' ? 'zh' : 'en',
    exp: Array.isArray(b.exp) ? [...new Set(b.exp.filter(x => EXP.includes(x)))] : [], expNote: text(b.expNote, 600),
  };
  const safety = text(b.safety, 600);
  let result = null, mailArgs = null;
  await mutate(db => {
    const d = db.days.find(x => x.id === b.dayId);
    if (!d || d.status !== 'open' || d.date < today()) { result = { error: 'closed' }; return { noSave: true }; }
    let rtw = '';
    if (d.type === 'paid') {
      if (!RTW.includes(b.rtw)) errors.push('rtw');
      else if (b.rtw === 'none') errors.push('rtwNone');
      rtw = RTW.includes(b.rtw) ? b.rtw : '';
    }
    if (errors.length) { result = { error: 'invalid', fields: errors }; return { noSave: true }; }
    let p = db.people.find(x => x.email === email);
    if (!p) { p = { id: rid(9), email, created: now() }; db.people.push(p); }
    Object.assign(p, { name, phone: fields.phone || p.phone || '', line: fields.line || p.line || '', lang: fields.lang,
                       exp: [...new Set([...(p.exp || []).filter(x => x !== 'none'), ...fields.exp])], expNote: fields.expNote || p.expNote || '', updated: now() });
    ensureKey(p);
    const dup = db.apps.find(a => a.personId === p.id && a.dayId === d.id && !['cancelled', 'declined'].includes(a.status));
    if (dup) { result = { ok: true, dup: true, ref: dup.ref, status: dup.status, day: publicDay(db, d) }; return; }
    const status = d.review ? 'review' : (count(db, d.id, 'confirmed') < d.capacity ? 'confirmed' : 'waitlist');
    const a = { id: rid(9), ref: ref(), dayId: d.id, personId: p.id, created: now(), updated: now(), status, avail: b.avail, rtw,
                photo: b.photo === true, attended: null, hours: null, tasks: [], health: true };
    db.apps.push(a);
    result = { ok: true, ref: a.ref, status, day: publicDay(db, d), appId: a.id };
    mailArgs = [p, a, d];
  });
  if (result && result.appId) {
    try { await put(healthPath(result.appId), enc({ fit: b.fit, safety }), PUT_OPTS); } catch (e) { console.error('health write failed', e.message); }
    delete result.appId;
    if (mailArgs) {
      const [p, a, d] = mailArgs;
      const [s, m, html] = applicantMail(p, a, d);
      await mail(p.email, s, m, html);
      await studioNotice('new', p, a, d);
    }
  }
  return result;
}

async function findOwn(db, b) {
  const email = str(b.email, 200).toLowerCase(), r = str(b.ref, 20).toUpperCase();
  const a = db.apps.find(x => x.ref === r);
  const p = a && db.people.find(x => x.id === a.personId);
  return a && p && p.email === email ? { a, p } : null;
}
async function status(b) {
  const { db } = await load();
  const own = await findOwn(db, b);
  if (!own) return { error: 'notfound' };
  const d = db.days.find(x => x.id === own.a.dayId);
  return { ok: true, ref: own.a.ref, status: own.a.status, day: d ? publicDay(db, d) : null };
}
async function cancel(b) {
  let out = { error: 'notfound' }, notice = null;
  await mutate(async db => {
    const own = await findOwn(db, b);
    if (!own) return { noSave: true };
    const d = db.days.find(x => x.id === own.a.dayId);
    if (['cancelled', 'declined'].includes(own.a.status) || own.a.attended !== null || (d && d.date < today())) { out = { ok: true, ref: own.a.ref, status: own.a.status, unchanged: true }; return { noSave: true }; }
    const was = own.a.status;
    own.a.status = 'cancelled'; own.a.updated = now();
    if (was === 'confirmed') promote(db, d);
    out = { ok: true, ref: own.a.ref, status: 'cancelled' };
    notice = [{ ...own.p }, { ...own.a }, { ...d }];
  });
  if (notice) await studioNotice('cancel', ...notice);
  return out;
}

// ---------------------------------------------------------------- personal record (link with key)
function personByKey(db, b) {
  const key = str(b.key, 64);
  return key.length >= 20 ? db.people.find(x => x.key && x.key === key) : null;
}
async function record(b) {
  const { db } = await load();
  const p = personByKey(db, b);
  if (!p) return { error: 'notfound' };
  const t = today();
  const apps = db.apps.filter(a => a.personId === p.id).map(a => {
    const d = db.days.find(x => x.id === a.dayId);
    if (!d) return null;
    return { ref: a.ref, status: a.status, attended: a.attended, hours: a.attended === true ? (+a.hours || 0) : null, past: d.date < t,
             canCancel: !['cancelled', 'declined'].includes(a.status) && a.attended === null && d.date >= t,
             day: { date: d.date, start: d.start, end: d.end, type: d.type, title: d.title, place: d.place } };
  }).filter(Boolean).sort((x, y) => (x.day.date + x.day.start).localeCompare(y.day.date + y.day.start));
  const hours = verifiedHours(db, p.id), days = apps.filter(a => a.attended === true).length;
  return { ok: true, name: p.name, hours, days, level: levelOf(hours, days), apps };
}
async function recordCancel(b) {
  const r = str(b.ref, 20).toUpperCase();
  let out = { error: 'notfound' }, notice = null;
  await mutate(db => {
    const p = personByKey(db, b);
    const a = p && db.apps.find(x => x.ref === r && x.personId === p.id);
    if (!a) return { noSave: true };
    const d = db.days.find(x => x.id === a.dayId);
    if (['cancelled', 'declined'].includes(a.status) || a.attended !== null || (d && d.date < today())) { out = { ok: true, unchanged: true, status: a.status }; return { noSave: true }; }
    const was = a.status;
    a.status = 'cancelled'; a.updated = now();
    if (was === 'confirmed') promote(db, d);
    out = { ok: true, status: 'cancelled' };
    notice = [{ ...p }, { ...a }, { ...d }];
  });
  if (notice) await studioNotice('cancel', ...notice);
  return out;
}
// Sends the record link again. Same answer whether or not the address is known; at most once per 10 minutes per person.
async function sendLink(b) {
  const email = str(b.email, 200).toLowerCase();
  if (!emailOk(email)) return { error: 'invalid' };
  if (!(process.env.RESEND_API_KEY && process.env.FD_FROM)) return { ok: true, mail: false };
  let target = null;
  await mutate(db => {
    const p = db.people.find(x => x.email === email);
    if (!p || (p.linkSent && Date.now() - Date.parse(p.linkSent) < 10 * 60 * 1000)) return { noSave: true };
    ensureKey(p); p.linkSent = now();
    target = { ...p };
  });
  if (target) { const [s, m] = linkMail(target); await mail(target.email, s, m); }
  return { ok: true };
}

// ---------------------------------------------------------------- admin actions
async function purgeHealth(db) {
  const t = today(), gone = [];
  for (const a of db.apps) {
    const d = db.days.find(x => x.id === a.dayId);
    if (a.health && (!d || d.date < t || ['cancelled', 'declined'].includes(a.status))) {
      try { await del(healthPath(a.id)); } catch (e) { console.error('health delete failed', e.message); continue; }
      a.health = false; gone.push(a.id);
    }
  }
  return gone;
}
async function adminState() {
  let removed = [];
  await mutate(async db => {
    removed = await purgeHealth(db);
    let keys = 0;
    db.people.forEach(p => { if (!p.key) { ensureKey(p); keys++; } });
    if (!removed.length && !keys) return { noSave: true };
  });
  const { db } = await load();
  const health = {};
  await Promise.all(db.apps.filter(a => a.health).map(async a => {
    try { const r = await readBlob(healthPath(a.id)); if (r) health[a.id] = dec(r.txt); } catch {}
  }));
  const people = db.people.map(p => {
    const apps = db.apps.filter(a => a.personId === p.id);
    const done = apps.filter(a => a.attended === true);
    return { ...p, hours: verifiedHours(db, p.id), days: done.length, noShows: apps.filter(a => a.attended === false).length,
             lastDay: done.map(a => (db.days.find(d => d.id === a.dayId) || {}).date || '').sort().pop() || '' };
  });
  return { today: today(), days: db.days, apps: db.apps, people, health, healthRemoved: removed.length,
           mail: !!(process.env.RESEND_API_KEY && process.env.FD_FROM) };
}
async function saveDay(b) {
  const day = b.day || {};
  const errors = [];
  if (!isDate(day.date)) errors.push('date');
  if (!isTime(day.start) || !isTime(day.end) || mins(day.end) <= mins(day.start)) errors.push('time');
  if (!TYPES.includes(day.type)) errors.push('type');
  const capacity = Math.max(1, Math.min(200, parseInt(day.capacity, 10) || 0));
  if (!parseInt(day.capacity, 10)) errors.push('capacity');
  if (errors.length) return { error: 'invalid', fields: errors };
  let saved;
  await mutate(db => {
    let d = day.id && db.days.find(x => x.id === day.id);
    if (!d) { d = { id: rid(6), created: now() }; db.days.push(d); }
    Object.assign(d, { date: day.date, start: day.start, end: day.end, type: day.type, capacity, review: day.review === true,
                       title: bi(day.title, 120), place: bi(day.place, 160), organiser: bi(day.organiser, 160), desc: biText(day.desc, 1500),
                       status: ['open', 'closed', 'cancelled'].includes(day.status) ? day.status : 'open', updated: now() });
    for (let i = 0; i < 200 && promote(db, d); i++);   // capacity raised: move people up from the waiting list
    saved = d;
  });
  return { ok: true, day: saved };
}
async function saveApp(b) {
  let out = { error: 'notfound' };
  await mutate(db => {
    const a = db.apps.find(x => x.id === b.id);
    if (!a) return { noSave: true };
    const d = db.days.find(x => x.id === a.dayId);
    const was = a.status;
    if (STATUS.includes(b.status)) a.status = b.status;
    if (b.attended === true || b.attended === false || b.attended === null) a.attended = b.attended;
    if (b.hours === null || b.hours === '') a.hours = null;
    else if (b.hours !== undefined && !isNaN(+b.hours)) a.hours = Math.max(0, Math.min(24, Math.round(+b.hours * 4) / 4));
    if (Array.isArray(b.tasks)) a.tasks = b.tasks.map(t => str(t, 40)).filter(Boolean).slice(0, 12);
    if (typeof b.note === 'string') a.note = text(b.note, 600);
    a.updated = now();
    if (was === 'confirmed' && a.status !== 'confirmed') promote(db, d);
    out = { ok: true, app: a };
  });
  return out;
}
async function deleteDay(b) {
  let ids = [];
  await mutate(db => {
    if (!db.days.some(d => d.id === b.dayId)) return { noSave: true };
    ids = db.apps.filter(a => a.dayId === b.dayId).map(a => a.id);
    db.apps = db.apps.filter(a => a.dayId !== b.dayId);
    db.days = db.days.filter(d => d.id !== b.dayId);
  });
  await Promise.all(ids.map(id => del(healthPath(id)).catch(() => {})));
  return { ok: true, removed: ids.length };
}
async function erasePerson(b) {
  let ids = [];
  await mutate(db => {
    const p = db.people.find(x => x.id === b.personId);
    if (!p) return { noSave: true };
    ids = db.apps.filter(a => a.personId === p.id).map(a => a.id);
    db.apps = db.apps.filter(a => a.personId !== p.id);
    db.people = db.people.filter(x => x.id !== p.id);
  });
  await Promise.all(ids.map(id => del(healthPath(id)).catch(() => {})));
  return { ok: true, removed: ids.length };
}

// ---------------------------------------------------------------- handler
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const a = (req.query && req.query.a) || '';
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  const admin = ADMIN_HOST.test(host);
  try {
    if (req.method === 'GET' && a === 'days') return res.status(200).json(await listDays());
    if (req.method === 'POST') {
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({ error: 'json' });
      const b = req.body && typeof req.body === 'object' ? req.body : {};
      if (a === 'apply') { const r = await apply(b); return res.status(r.error === 'invalid' ? 422 : r.error ? 409 : 200).json(r); }
      if (a === 'status') { const r = await status(b); return res.status(r.error ? 404 : 200).json(r); }
      if (a === 'cancel') { const r = await cancel(b); return res.status(r.error ? 404 : 200).json(r); }
      if (a === 'me') { const r = await record(b); return res.status(r.error ? 404 : 200).json(r); }
      if (a === 'me-cancel') { const r = await recordCancel(b); return res.status(r.error ? 404 : 200).json(r); }
      if (a === 'link') { const r = await sendLink(b); return res.status(r.error ? 422 : 200).json(r); }
    }
    if (a.startsWith('admin')) {
      if (!admin) return res.status(403).json({ error: 'admin' });
      if (req.method === 'GET' && a === 'admin') return res.status(200).json(await adminState());
      if (req.method === 'POST') {
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({ error: 'json' });
        const b = req.body && typeof req.body === 'object' ? req.body : {};
        if (a === 'admin-day') { const r = await saveDay(b); return res.status(r.error ? 422 : 200).json(r); }
        if (a === 'admin-app') { const r = await saveApp(b); return res.status(r.error ? 404 : 200).json(r); }
        if (a === 'admin-erase') return res.status(200).json(await erasePerson(b));
        if (a === 'admin-day-delete') return res.status(200).json(await deleteDay(b));
      }
    }
    return res.status(404).json({ error: 'unknown' });
  } catch (e) {
    console.error('fd error', e);
    return res.status(500).json({ error: 'server' });
  }
}
