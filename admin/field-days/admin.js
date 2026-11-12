/* Field Days admin — works only at the Vercel-protected address (Vercel sign-in). */
(function () {
  var API = '/api/fd';
  var ADMIN_URL = 'https://studio-syntropy-website-studiosyntropys-projects.vercel.app/admin/field-days';
  var TYPE = { learning: 'Learning day 學習日', volunteer: 'Volunteer day 志工日', paid: 'Paid work 有薪工作', course: 'Course 課程' };
  var ORG = {
    learning: ['Studio Syntropy', '趨合工作室'], paid: ['Studio Syntropy', '趨合工作室'], course: ['Studio Syntropy', '趨合工作室'],
    volunteer: ['Tzu Chi University USR Center', '慈濟大學USR教學研究中心']
  };
  var STATUS = { confirmed: 'Confirmed', waitlist: 'Waiting list', review: 'To review', declined: 'Declined', cancelled: 'Cancelled' };
  var EXP = { planting: 'Planting', pruning: 'Pruning', chopdrop: 'Chop and drop', nursery: 'Nursery', mulching: 'Mulching', none: 'No experience yet' };
  var AVAIL = { full: 'Whole day', am: 'Morning', pm: 'Afternoon' };
  var RTW = { citizen: 'Citizen', permit: 'Open permit / residence', student: 'Student permit', none: 'No permit' };
  var S = null;
  var $ = function (id) { return document.getElementById(id); };
  var msg = $('msg');

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function post(a, body) {
    return fetch(API + '?a=' + a, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' }).then(function (r) { return r.json(); });
  }
  function level(h, days) { return h >= 50 ? 'Climax stage 頂極階段' : h >= 10 ? 'Secondary 次生' : days > 0 ? 'Pioneer 先鋒' : '—'; }
  function hoursOf(d) { var a = d.start.split(':'), b = d.end.split(':'); return Math.round(((+b[0] * 60 + +b[1]) - (+a[0] * 60 + +a[1])) / 15) / 4; }
  function fmt(d) { var p = d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  function person(id) { return S.people.find(function (p) { return p.id === id; }) || {}; }

  function mailto(p, a, d) {
    var zh = p.lang === 'zh', title = (zh ? d.title.zh || d.title.en : d.title.en) || TYPE[d.type];
    var lines = zh ? {
      confirmed: '您的名額已確認。', waitlist: '這一天目前已額滿，您在候補名單上。若有名額釋出，我們會與您聯絡。',
      review: '謝謝您的申請，我們正在審核中。', declined: '謝謝您的申請。這次我們無法為您安排名額，期待在其他日子見到您。', cancelled: '您的申請已取消。'
    } : {
      confirmed: 'Your place is confirmed.', waitlist: 'This day is full at the moment, and you are on the waiting list. We will contact you if a place opens.',
      review: 'Thank you for your application; we are reviewing it.', declined: 'Thank you for your application. We cannot offer you a place this time and hope to see you on another day.', cancelled: 'Your application has been cancelled.'
    };
    var place = (zh ? d.place.zh || d.place.en : d.place.en) || '';
    var subject = zh ? '田間日 ' + d.date + '：' + title : 'Field Days ' + d.date + ': ' + title;
    var gft = /gengfutian|耕福田/i.test((d.place.en || '') + ' ' + (d.place.zh || ''));
    var dir = gft ? (zh ? '\n入口：花蓮縣吉安鄉建國路二段，慈濟大學宿舍入口（明義五街口）\nGoogle 地圖：https://maps.app.goo.gl/kjoQpfYQiZW8n7XJ6\n地圖與路線：https://studio-syntropy.com/zh/field-days#getting-there'
                     : '\nEntrance: Tzu Chi University dormitory entrance, Sec. 2, Jianguo Rd., Ji’an Township, Hualien County (corner of Mingyi 5th St.)\nGoogle Maps: https://maps.app.goo.gl/kjoQpfYQiZW8n7XJ6\nMap and directions: https://studio-syntropy.com/field-days#getting-there') : '';
    var url = p.key ? 'https://studio-syntropy.com/' + (zh ? 'zh/' : '') + 'field-days#me=' + p.key : '';
    var rec = url ? (zh ? '\n\n您的田間日紀錄：\n' + url + '\n此連結僅供您本人使用，請勿轉寄。' : '\n\nYour Field Days record:\n' + url + '\nThis link is personal; please keep it to yourself.') : '';
    var body = zh
      ? p.name + ' 您好：\n\n' + (lines[a.status] || '') + '\n\n' + title + '\n日期：' + d.date + '，' + d.start + '–' + d.end + '\n地點：' + place + dir + '\n申請編號：' + a.ref + rec + '\n\n趨合工作室 Studio Syntropy'
      : 'Dear ' + p.name + ',\n\n' + (lines[a.status] || '') + '\n\n' + title + '\nDate: ' + d.date + ', ' + d.start + '–' + d.end + '\nPlace: ' + place + dir + '\nReference: ' + a.ref + rec + '\n\nStudio Syntropy 趨合工作室';
    return 'mailto:' + encodeURIComponent(p.email) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  // ---------------------------------------------------------------- days
  function dayCard(d, past) {
    var apps = S.apps.filter(function (a) { return a.dayId === d.id; }).sort(function (a, b) { return a.created.localeCompare(b.created); });
    var n = function (st) { return apps.filter(function (a) { return a.status === st; }).length; };
    var box = document.createElement('article');
    box.className = 'day-card t-' + d.type;
    box.innerHTML = '<div class="row" style="justify-content:space-between"><h3>' + esc(fmt(d.date)) + ' · ' + esc(d.start) + '–' + esc(d.end) + ' · ' + esc(d.title.en || TYPE[d.type]) + '</h3>' +
      '<div class="row"><button class="btn small ghost" data-edit>Edit</button><button class="btn small" data-toggle aria-expanded="false">Applications (' + apps.length + ')</button></div></div>' +
      '<p class="counts muted"><span>' + esc(TYPE[d.type]) + '</span><span>' + (d.status === 'open' ? 'Open' : d.status === 'closed' ? 'Closed' : 'Cancelled') + (d.review ? ' · reviewed' : '') + '</span>' +
      '<span>Confirmed ' + n('confirmed') + ' / ' + d.capacity + '</span><span>Waiting ' + n('waitlist') + '</span><span>To review ' + n('review') + '</span></p>' +
      '<div data-apps hidden></div>';
    box.querySelector('[data-edit]').addEventListener('click', function () { edit(d); });
    var tg = box.querySelector('[data-toggle]'), list = box.querySelector('[data-apps]');
    tg.addEventListener('click', function () {
      var open = tg.getAttribute('aria-expanded') === 'true';
      tg.setAttribute('aria-expanded', String(!open)); list.hidden = open;
      if (!open) list.replaceChildren(appTable(d, apps, past));
    });
    if (past && apps.some(function (a) { return a.status === 'confirmed' && a.attended === null; })) { tg.click(); }
    return box;
  }
  function appTable(d, apps, past) {
    var wrap = document.createElement('div'); wrap.className = 'scroll';
    if (!apps.length) { wrap.innerHTML = '<p class="muted">No applications yet.</p>'; return wrap; }
    var t = document.createElement('table');
    t.innerHTML = '<thead><tr><th>Person</th><th>Details</th><th>Status</th><th>Attended</th><th>Hours</th><th>Tasks</th><th></th></tr></thead><tbody></tbody>';
    var tb = t.querySelector('tbody');
    apps.forEach(function (a) {
      var p = person(a.personId), h = S.health[a.id], tr = document.createElement('tr');
      var hours = a.hours != null ? a.hours : hoursOf(d);
      tr.innerHTML = '<td><b>' + esc(p.name) + '</b><br><a href="' + mailto(p, a, d) + '">Email</a> · ' + esc(p.email) +
        (p.phone ? '<br>' + esc(p.phone) : '') + (p.line ? '<br>LINE ' + esc(p.line) : '') + '<br><span class="muted">' + esc(a.ref) + ' · ' + (p.lang === 'zh' ? '中文' : 'English') + '</span></td>' +
        '<td>' + esc(AVAIL[a.avail] || '') + (a.rtw ? '<br>Work: ' + esc(RTW[a.rtw]) : '') + '<br>' + esc((p.exp || []).map(function (x) { return EXP[x]; }).join(', ')) +
        (p.expNote ? '<br><span class="muted">' + esc(p.expNote) + '</span>' : '') + (a.photo ? '<br>Photos OK' : '<br>No photos') +
        (h ? '<br><span class="health">' + (h.fit === 'limit' ? 'Has a limitation: please contact' : 'Fit for tasks') + '</span>' + (h.safety ? '<br><span class="health">Safety: ' + esc(h.safety) + '</span>' : '') : '') + '</td>' +
        '<td><select data-k="status" aria-label="Status for ' + esc(p.name) + '">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (a.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>'; }).join('') + '</select></td>' +
        '<td><select data-k="attended" aria-label="Attendance for ' + esc(p.name) + '"' + (past || d.date <= S.today ? '' : ' disabled') + '><option value="">—</option><option value="yes"' + (a.attended === true ? ' selected' : '') + '>Attended</option><option value="no"' + (a.attended === false ? ' selected' : '') + '>No-show</option></select></td>' +
        '<td><input type="number" data-k="hours" min="0" max="24" step="0.25" value="' + esc(hours) + '" aria-label="Hours for ' + esc(p.name) + '"></td>' +
        '<td><input class="tasks" data-k="tasks" value="' + esc((a.tasks || []).join(', ')) + '" placeholder="planting, pruning" aria-label="Tasks for ' + esc(p.name) + '"></td>' +
        '<td><button class="btn small" data-save>Save</button> <span data-ok role="status"></span></td>';
      tr.querySelector('[data-save]').addEventListener('click', function () {
        var att = tr.querySelector('[data-k=attended]').value;
        var body = { id: a.id, status: tr.querySelector('[data-k=status]').value, attended: att === 'yes' ? true : att === 'no' ? false : null,
                     hours: att === 'yes' ? tr.querySelector('[data-k=hours]').value : null,
                     tasks: tr.querySelector('[data-k=tasks]').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean) };
        var ok = tr.querySelector('[data-ok]'); ok.textContent = 'Saving…';
        post('admin-app', body).then(function (r) { if (r.ok) { ok.textContent = 'Saved'; load(true); } else ok.textContent = 'Not saved'; }, function () { ok.textContent = 'Not saved'; });
      });
      tb.appendChild(tr);
    });
    wrap.appendChild(t);
    return wrap;
  }

  // ---------------------------------------------------------------- day editor
  var form = $('dayform');
  function edit(d) {
    form.reset(); $('dayerr').textContent = '';
    var f = form.elements;
    if (d) {
      f.id.value = d.id; f.date.value = d.date; f.start.value = d.start; f.end.value = d.end; f.type.value = d.type; f.capacity.value = d.capacity;
      f.status.value = d.status; f.review.checked = !!d.review; f.title_en.value = d.title.en; f.title_zh.value = d.title.zh;
      f.place_en.value = d.place.en; f.place_zh.value = d.place.zh; f.org_en.value = d.organiser.en; f.org_zh.value = d.organiser.zh;
      f.desc_en.value = d.desc.en; f.desc_zh.value = d.desc.zh;
    } else { f.id.value = ''; setOrg(); }
    $('deleteDay').hidden = !d;
    $('editor').hidden = false; f.date.focus();
  }
  function setOrg() { var f = form.elements, o = ORG[f.type.value]; f.org_en.value = o[0]; f.org_zh.value = o[1]; if (f.type.value === 'paid') f.review.checked = true; }
  form.elements.type.addEventListener('change', function () { if (!form.elements.id.value) setOrg(); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements;
    var day = { id: f.id.value || undefined, date: f.date.value, start: f.start.value, end: f.end.value, type: f.type.value, capacity: f.capacity.value,
                status: f.status.value, review: f.review.checked, title: { en: f.title_en.value, zh: f.title_zh.value }, place: { en: f.place_en.value, zh: f.place_zh.value },
                organiser: { en: f.org_en.value, zh: f.org_zh.value }, desc: { en: f.desc_en.value, zh: f.desc_zh.value } };
    $('dayerr').textContent = 'Saving…';
    post('admin-day', { day: day }).then(function (r) {
      if (r.ok) { $('editor').hidden = true; $('dayerr').textContent = ''; load(); }
      else $('dayerr').textContent = 'Please check: ' + (r.fields || ['the form']).join(', ');
    }, function () { $('dayerr').textContent = 'Not saved. Please try again.'; });
  });
  $('cancelEdit').addEventListener('click', function () { $('editor').hidden = true; });
  $('deleteDay').addEventListener('click', function () {
    var id = form.elements.id.value; if (!id) return;
    var n = S.apps.filter(function (a) { return a.dayId === id; }).length;
    if (!window.confirm('Delete this day' + (n ? ' and its ' + n + ' application(s), including any confirmed hours' : '') + '? This cannot be undone.')) return;
    post('admin-day-delete', { dayId: id }).then(function () { $('editor').hidden = true; load(); });
  });
  $('add').addEventListener('click', function () { edit(null); });
  $('reload').addEventListener('click', function () { load(); });

  // ---------------------------------------------------------------- people
  function renderPeople() {
    var q = $('q').value.trim().toLowerCase(), tb = document.querySelector('#people tbody');
    tb.innerHTML = '';
    S.people.filter(function (p) { return !q || (p.name + ' ' + p.email).toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return b.hours - a.hours || a.name.localeCompare(b.name); })
      .forEach(function (p) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td><b>' + esc(p.name) + '</b></td><td>' + esc(p.email) + (p.phone ? '<br>' + esc(p.phone) : '') + (p.line ? '<br>LINE ' + esc(p.line) : '') + '</td>' +
          '<td>' + p.hours + '</td><td>' + p.days + '</td><td>' + p.noShows + '</td><td class="lvl">' + level(p.hours, p.days) + '</td><td>' + esc(p.lastDay) + '</td>' +
          '<td>' + esc((p.exp || []).map(function (x) { return EXP[x]; }).join(', ')) + '</td><td><button class="btn small danger" data-erase>Delete record</button></td>';
        tr.querySelector('[data-erase]').addEventListener('click', function () {
          if (!window.confirm('Delete ' + p.name + ' and all their applications and hours? This cannot be undone.')) return;
          post('admin-erase', { personId: p.id }).then(function () { load(); });
        });
        tb.appendChild(tr);
      });
  }
  $('q').addEventListener('input', renderPeople);
  $('csv').addEventListener('click', function () {
    var rows = [['Name', 'Email', 'Phone', 'LINE', 'Language', 'Verified hours', 'Days attended', 'No-shows', 'Level', 'Last day', 'Experience', 'First registered']];
    S.people.forEach(function (p) { rows.push([p.name, p.email, p.phone, p.line, p.lang, p.hours, p.days, p.noShows, level(p.hours, p.days), p.lastDay, (p.exp || []).join(' '), (p.created || '').slice(0, 10)]); });
    var csv = '﻿' + rows.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'field-days-people-' + S.today + '.csv'; a.click();
  });

  // ---------------------------------------------------------------- load
  function load(keepOpen) {
    var open = keepOpen ? [].map.call(document.querySelectorAll('[data-toggle][aria-expanded=true]'), function (b) { return b.closest('.day-card').querySelector('h3').textContent; }) : [];
    msg.textContent = 'Loading…';
    fetch(API + '?a=admin', { credentials: 'same-origin' }).then(function (r) { return r.json().then(function (j) { return [r.status, j]; }); }).then(function (x) {
      if (x[0] === 403) {
        msg.innerHTML = '<p class="note warn">This page works only at the protected address, after signing in to Vercel: <a href="' + ADMIN_URL + '">' + ADMIN_URL + '</a></p>';
        return;
      }
      if (x[0] !== 200) { msg.innerHTML = '<p class="note warn">Could not load the data. Please reload.</p>'; return; }
      S = x[1]; msg.textContent = S.healthRemoved ? 'Fitness and safety answers of ' + S.healthRemoved + ' past application(s) were deleted.' : '';
      $('app').hidden = false; $('mailnote').hidden = !!S.mail;
      var up = $('upcoming'), past = $('past');
      up.innerHTML = ''; past.innerHTML = '';
      var days = S.days.slice().sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
      days.filter(function (d) { return d.date >= S.today; }).forEach(function (d) { up.appendChild(dayCard(d, false)); });
      days.filter(function (d) { return d.date < S.today; }).reverse().forEach(function (d) { past.appendChild(dayCard(d, true)); });
      if (!up.children.length) up.innerHTML = '<p class="muted">No upcoming days. Use “Add a day”.</p>';
      if (!past.children.length) past.innerHTML = '<p class="muted">No past days yet.</p>';
      document.querySelectorAll('.day-card').forEach(function (c) {
        if (open.indexOf(c.querySelector('h3').textContent) >= 0) { var b = c.querySelector('[data-toggle]'); if (b.getAttribute('aria-expanded') !== 'true') b.click(); }
      });
      renderPeople();
    }, function () { msg.innerHTML = '<p class="note warn">Could not load the data. Please reload.</p>'; });
  }
  load();
})();
