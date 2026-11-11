// Field Days · 田間日 — applications, profiles and hours for studio-syntropy.com
// Storage: one encrypted JSON document in the private Vercel Blob store "field-days" (Tokyo),
// plus one encrypted file per application with fitness/safety answers, deleted after the day.
// Admin actions only work on the Vercel-protected address (Vercel sign-in required):
//   https://studio-syntropy-website-studiosyntropys-projects.vercel.app/admin/field-days
import { put, get, del } from '@vercel/blob';
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
  const r = await readBlob(DB);
  if (!r) return { db: { v: 1, days: [], apps: [], people: [] }, etag: null };
  return { db: dec(r.txt), etag: r.etag };
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
      if (e && (e.name === 'BlobPreconditionFailedError' || /precondition/i.test(e.message || ''))) { await sleep(120 + Math.random() * 400); continue; }
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
function verifiedHours(db, personId) {
  return db.apps.filter(a => a.personId === personId && a.attended === true).reduce((s, a) => s + (+a.hours || 0), 0);
}

// ---------------------------------------------------------------- email (active once RESEND_API_KEY and FD_FROM are set)
async function mail(to, subject, body) {
  const k = process.env.RESEND_API_KEY, from = process.env.FD_FROM;
  if (!k || !from || !to) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text: body, reply_to: process.env.FD_NOTIFY || undefined }),
    });
    return r.ok;
  } catch { return false; }
}
function applicantMail(p, a, d) {
  const zh = p.lang === 'zh';
  const t = (d.title && (zh ? d.title.zh || d.title.en : d.title.en)) || TYPE_LABEL[d.type][zh ? 1 : 0];
  const st = zh ? { confirmed: '您的名額已確認。', waitlist: '這一天已額滿，您已列入候補名單。若有名額釋出，我們會與您聯絡。', review: '我們已收到您的申請，將在幾天內回覆。' }
                : { confirmed: 'Your place is confirmed.', waitlist: 'This day is full. You are on the waiting list, and we will contact you if a place opens.', review: 'Your application has been received; we will reply within a few days.' };
  const subject = zh ? `田間日 ${d.date}：${t}` : `Field Days ${d.date}: ${t}`;
  const body = zh
    ? `${p.name} 您好：\n\n${st[a.status] || ''}\n\n${t}\n日期：${d.date}，${d.start}–${d.end}\n地點：${(d.place && (d.place.zh || d.place.en)) || ''}\n申請編號：${a.ref}\n\n查詢或取消申請：https://studio-syntropy.com/zh/field-days\n\n趨合工作室 Studio Syntropy`
    : `Dear ${p.name},\n\n${st[a.status] || ''}\n\n${t}\nDate: ${d.date}, ${d.start}–${d.end}\nPlace: ${(d.place && d.place.en) || ''}\nReference: ${a.ref}\n\nCheck or cancel your application: https://studio-syntropy.com/field-days\n\nStudio Syntropy 趨合工作室`;
  return [subject, body];
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
      const [s, m] = applicantMail(p, a, d);
      await mail(p.email, s, m);
      await mail(process.env.FD_NOTIFY, `Field Days: new application for ${d.date} (${a.status})`,
        `${p.name} applied for ${d.date} ${d.start}–${d.end} (${TYPE_LABEL[d.type][0]}). Status: ${a.status}.\nOpen the admin page: https://studio-syntropy-website-studiosyntropys-projects.vercel.app/admin/field-days`);
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
  let out = { error: 'notfound' };
  await mutate(async db => {
    const own = await findOwn(db, b);
    if (!own) return { noSave: true };
    const d = db.days.find(x => x.id === own.a.dayId);
    if (['cancelled', 'declined'].includes(own.a.status) || own.a.attended !== null || (d && d.date < today())) { out = { ok: true, ref: own.a.ref, status: own.a.status, unchanged: true }; return { noSave: true }; }
    const was = own.a.status;
    own.a.status = 'cancelled'; own.a.updated = now();
    if (was === 'confirmed') promote(db, d);
    out = { ok: true, ref: own.a.ref, status: 'cancelled' };
  });
  return out;
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
  await mutate(async db => { removed = await purgeHealth(db); if (!removed.length) return { noSave: true }; });
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
    }
    if (a.startsWith('admin')) {
      if (!admin) return res.status(403).json({ error: 'admin', open: 'https://studio-syntropy-website-studiosyntropys-projects.vercel.app/admin/field-days' });
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
