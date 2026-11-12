/* Field Days · 田間日 — public list of open days and application form (studio-syntropy.com/field-days) */
(function () {
  var root = document.getElementById('fd-app');
  if (!root) return;
  var ZH = document.documentElement.lang === 'zh-Hant';
  var LOC = ZH ? 'zh-TW' : 'en-GB';
  var API = '/api/fd';
  var MAIL = 'studiosyntropy@proton.me';

  var T = ZH ? {
    loading: '正在載入開放的日子……', loadErr: '無法載入開放的日子。請重新整理頁面。',
    empty: '目前沒有開放的日子。新的日期將公布於此。',
    left: function (n) { return '尚餘 ' + n + ' 個名額'; }, full: '已額滿：開放候補', review: '申請將經審核',
    place: '地點', org: '主辦單位', time: '時間', apply: '申請這一天', close: '關閉申請表',
    formH: '申請：', req: '必填', opt: '選填',
    name: '您的姓名', email: '電子郵件', emailHint: '我們會用它與您聯絡這一天的事宜。', phone: '電話', line: 'LINE ID', lang: '偏好語言',
    exp: '經驗（可複選）', expList: { planting: '種植', pruning: '修剪', chopdrop: '砍下覆蓋', nursery: '育苗', mulching: '鋪設覆蓋物', none: '尚無經驗' },
    expNote: '關於您經驗的其他說明', avail: '這一天可參加的時間', availList: { full: '全天', am: '僅上午', pm: '僅下午' },
    rtw: '在台灣工作的資格', rtwHint: '有薪工作須具備在台灣工作的資格。', rtwList: { citizen: '台灣國民', permit: '具開放工作許可或可工作之居留身分（例如永久居留、依親）', student: '持有工作許可的學生', none: '沒有在台灣的工作許可' },
    fit: '這一天的工作內容如上所述。您的身體狀況是否適合？', fitList: { yes: '是，我適合這些工作', limit: '我有一些限制，請與我聯絡' },
    safety: '為了您的安全，有什麼我們應該知道的嗎？', safetyHint: '例如對蜂螫過敏。',
    healthConsent: '我同意趨合工作室僅為這一天的安全使用我關於身體狀況與安全的回答，並於當天結束後刪除。',
    photo: '當天拍攝到我的照片，可用於工作室的網站與社群媒體。',
    privacyH: '我們如何使用您的資料',
    privacy: '趨合工作室（花蓮）蒐集本表單中的資料，用於安排這一天、與您聯絡、保障您的安全，並在您參加後記錄您的時數。您的姓名、聯絡方式、經驗與時數將保存至您要求刪除為止；關於身體狀況與安全的回答於當天結束後刪除。資料以加密形式儲存於 Vercel Inc. 位於日本的伺服器。資料僅提供給該日標示的主辦單位，課程與有薪工作另提供給保險公司。您可來信 ' + MAIL + '，要求查詢、更正或刪除您的資料，或停止使用。若未提供必填資料，我們將無法處理您的申請。',
    privacyOk: '我已閱讀資料的使用方式。', send: '送出申請', sending: '正在送出……',
    errH: '請檢查以下項目：',
    errs: { name: '請輸入您的姓名。', email: '請輸入有效的電子郵件地址。', avail: '請選擇您可參加的時間。', fit: '請回答關於身體狀況的問題。',
            healthConsent: '請同意我們使用您關於身體狀況與安全的回答。', privacy: '請確認您已閱讀資料的使用方式。', rtw: '請告訴我們您在台灣工作的資格。',
            rtwNone: '有薪工作須具備在台灣工作的資格。歡迎您參加學習日與課程。' },
    netErr: '申請未能送出。請再試一次，或來信 ' + MAIL + '。', closed: '這一天已不再開放。',
    ok: { confirmed: '您的名額已確認。', waitlist: '這一天已額滿。您已列入候補名單，若有名額釋出，我們會與您聯絡。', review: '謝謝您。我們已收到您的申請，將在幾天內回覆。' },
    dup: '您已申請過這一天。', refLine: function (r) { return '您的申請編號：' + r + '。確認信將寄到您的信箱，內含您個人紀錄的連結，也可在那裡取消申請。'; },
    ics: '加入我的行事曆', st: { confirmed: '已確認', waitlist: '候補中', review: '審核中', declined: '這次未獲選', cancelled: '已取消' },
    notfound: '找不到符合此電子郵件與編號的申請。', confirmCancel: '確定要取消這項申請嗎？', cancelled: '您的申請已取消。', unchanged: '這項申請已無法再更改。', stLine: '申請狀態：',
    dir: '地圖與路線', recH: '您的田間日紀錄', hello: function (n) { return n + ' 您好。'; }, level: '階段', levels: { pioneer: '先鋒', secondary: '次生', climax: '頂極階段', '': '參加第一天後開始' },
    hours: '已確認時數', daysDone: '已參加天數', upcoming: '即將參加', past: '過去的日子', noUpcoming: '目前沒有即將參加的日子。請在下方選擇日期。',
    h: function (x) { return x + ' 小時'; }, attended: '已參加', noShow: '未出席', cancelBtn: '取消這一天',
    recNote: '每一天結束後，經工作室確認即會加入時數。階段依循生態演替：參加第一天後為「先鋒」，滿 10 小時為「次生」，滿 50 小時為「頂極階段」。',
    recPrivate: '此頁面僅供您本人使用。如需查詢、更正或刪除您的資料，請來信 ' + MAIL + '。', recBad: '此連結無效。請在下方申請新的連結。', recLoading: '正在載入您的紀錄……',
    linkSent: '若此電子郵件在我們的紀錄中，我們已寄出連結。請一併查看垃圾郵件匣。', linkInvalid: '請輸入有效的電子郵件地址。'
  } : {
    loading: 'Loading open days…', loadErr: 'The open days could not be loaded. Please reload the page.',
    empty: 'There are no open days at the moment. New dates will appear here.',
    left: function (n) { return n === 1 ? '1 place left' : n + ' places left'; }, full: 'Full: waiting list open', review: 'Applications are reviewed',
    place: 'Place', org: 'Organised by', time: 'Time', apply: 'Apply for this day', close: 'Close the form',
    formH: 'Apply: ', req: 'required', opt: 'optional',
    name: 'Your name', email: 'Email', emailHint: 'We use it to contact you about this day.', phone: 'Phone', line: 'LINE ID', lang: 'Preferred language',
    exp: 'Experience (choose all that apply)', expList: { planting: 'Planting', pruning: 'Pruning', chopdrop: 'Chop and drop', nursery: 'Nursery and seedlings', mulching: 'Mulching', none: 'No experience yet' },
    expNote: 'Anything else about your experience', avail: 'Time available on this day', availList: { full: 'Whole day', am: 'Morning only', pm: 'Afternoon only' },
    rtw: 'Right to work in Taiwan', rtwHint: 'Paid work requires the right to work in Taiwan.', rtwList: { citizen: 'Taiwan citizen', permit: 'Open work permit or residence with work rights (for example APRC or spouse)', student: 'Student with a work permit', none: 'No permit to work in Taiwan' },
    fit: 'The tasks for this day are described above. Are you fit for them?', fitList: { yes: 'Yes, I am fit for these tasks', limit: 'I have a limitation; please contact me' },
    safety: 'Anything we should know to keep you safe?', safetyHint: 'For example an allergy to bee stings.',
    healthConsent: 'I agree that Studio Syntropy uses my answers about fitness and safety only for my safety on this day and deletes them after the day.',
    photo: 'Photos of me taken on this day may be used on the studio’s website and social media.',
    privacyH: 'How we use your data',
    privacy: 'Studio Syntropy (趨合工作室, Hualien) collects the details in this form to arrange this day, contact you, keep you safe and, if you take part, record your hours. Your name, contacts, experience and hours are kept until you ask us to delete them; answers about fitness and safety are deleted after the day. The data is stored in encrypted form on servers of Vercel Inc. in Japan. It is shared only with the organiser named for the day and, for courses and paid work, with the insurer. You may ask to see, correct or delete your data, or stop its use, by writing to ' + MAIL + '. Without the required details we cannot process your application.',
    privacyOk: 'I have read how my data is used.', send: 'Send application', sending: 'Sending…',
    errH: 'Please check the following:',
    errs: { name: 'Please enter your name.', email: 'Please enter a valid email address.', avail: 'Please choose the time you are available.', fit: 'Please answer the question about fitness.',
            healthConsent: 'Please agree to the use of your fitness and safety answers.', privacy: 'Please confirm that you have read how your data is used.', rtw: 'Please tell us about your right to work in Taiwan.',
            rtwNone: 'Paid work requires the right to work in Taiwan. Learning days and courses are open to you.' },
    netErr: 'The application could not be sent. Please try again, or write to ' + MAIL + '.', closed: 'This day is no longer open.',
    ok: { confirmed: 'Your place is confirmed.', waitlist: 'This day is full. You are on the waiting list, and we will contact you if a place opens.', review: 'Thank you. Your application has been received; we will reply within a few days.' },
    dup: 'You have already applied for this day.', refLine: function (r) { return 'Your reference: ' + r + '. A confirmation is on its way to your inbox, with a personal link to your record, where you can also cancel.'; },
    ics: 'Add to my calendar', st: { confirmed: 'Confirmed', waitlist: 'On the waiting list', review: 'Being reviewed', declined: 'Not selected this time', cancelled: 'Cancelled' },
    notfound: 'No application found with this email and reference.', confirmCancel: 'Do you want to cancel this application?', cancelled: 'Your application has been cancelled.', unchanged: 'This application can no longer be changed.', stLine: 'Status: ',
    dir: 'Map and directions', recH: 'Your Field Days record', hello: function (n) { return 'Welcome, ' + n + '.'; }, level: 'Level', levels: { pioneer: 'Pioneer', secondary: 'Secondary', climax: 'Climax stage', '': 'Starts with your first day' },
    hours: 'Confirmed hours', daysDone: 'Days attended', upcoming: 'Upcoming', past: 'Earlier days', noUpcoming: 'No upcoming days. Choose a date below.',
    h: function (x) { return x + ' h'; }, attended: 'Attended', noShow: 'Did not attend', cancelBtn: 'Cancel this day',
    recNote: 'Hours are added once the studio confirms them after each day. Levels follow ecological succession: Pioneer after your first day, Secondary from 10 hours, Climax stage from 50 hours.',
    recPrivate: 'This page is personal. To see, correct or delete your data, write to ' + MAIL + '.', recBad: 'This link is not valid. Request a new link below.', recLoading: 'Loading your record…',
    linkSent: 'If this address is in our records, we have sent you a link. Please also check your spam folder.', linkInvalid: 'Please enter a valid email address.'
  };
  var TYPE = {
    learning: ZH ? '學習日' : 'Learning day', volunteer: ZH ? '志工日' : 'Volunteer day',
    paid: ZH ? '有薪工作' : 'Paid work', course: ZH ? '課程' : 'Course'
  };

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function pick(o) { return (o && (ZH ? (o.zh || o.en) : (o.en || o.zh))) || ''; }
  function parseDate(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDay(s) { return new Intl.DateTimeFormat(LOC, { weekday: 'long', day: 'numeric', month: 'long' }).format(parseDate(s)); }
  function fmtMonth(s) { return new Intl.DateTimeFormat(LOC, { month: 'long', year: 'numeric' }).format(parseDate(s)); }
  function icon(type) { var t = document.getElementById('fd-ico-' + type); return t ? t.content.cloneNode(true) : null; }
  // Days at Gengfutian Farm link to the map and directions on this page
  function placeNode(d) {
    var txt = pick(d.place) || '—';
    if (!/gengfutian|耕福田/i.test((d.place && (d.place.en + ' ' + d.place.zh)) || '') || !document.getElementById('getting-there')) return document.createTextNode(txt);
    return el('span', {}, [txt + ' · ', el('a', { href: '#getting-there', 'class': 'fd-dir', text: T.dir })]);
  }
  function badge(type) { return el('span', { 'class': 'fd-badge fd-' + type }, [icon(type), el('span', { text: TYPE[type] })]); }
  function post(a, body) {
    return fetch(API + '?a=' + a, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return j; }, function () { return { error: 'server' }; }); });
  }
  function ics(d) {
    var dt = d.date.replace(/-/g, ''), s = d.start.replace(':', '') + '00', e = d.end.replace(':', '') + '00';
    var esc = function (t) { return String(t || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); };
    var body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Studio Syntropy//Field Days//EN', 'BEGIN:VEVENT',
      'UID:' + d.id + '-' + dt + '@studio-syntropy.com', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART;TZID=Asia/Taipei:' + dt + 'T' + s, 'DTEND;TZID=Asia/Taipei:' + dt + 'T' + e,
      'SUMMARY:' + esc((ZH ? '田間日：' : 'Field Days: ') + (pick(d.title) || TYPE[d.type])), 'LOCATION:' + esc(pick(d.place)),
      'DESCRIPTION:' + esc(pick(d.desc)), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var a = el('a', { 'class': 'btn ghost', href: URL.createObjectURL(new Blob([body], { type: 'text/calendar' })), download: 'field-day-' + d.date + '.ics' }, [T.ics]);
    return a;
  }

  // ---------------------------------------------------------------- list
  var days = [];
  function render() {
    root.innerHTML = '';
    if (!days.length) { root.appendChild(el('p', { 'class': 'fd-empty', text: T.empty })); return; }
    var month = '', ul;
    days.forEach(function (d) {
      var m = d.date.slice(0, 7);
      if (m !== month) {
        month = m;
        root.appendChild(el('h3', { 'class': 'fd-month', 'aria-level': '2', text: fmtMonth(d.date) }));
        ul = el('ul', { 'class': 'fd-list' }); root.appendChild(ul);
      }
      ul.appendChild(card(d));
    });
  }
  function card(d) {
    var hid = 'fd-d-' + d.id;
    var avail = d.review ? T.review : (d.left > 0 ? T.left(d.left) : T.full);
    var li = el('li', { 'class': 'fd-day fd-' + d.type });
    var art = el('article', { 'aria-labelledby': hid }, [
      el('p', { 'class': 'fd-date' }, [el('time', { datetime: d.date, text: fmtDay(d.date) }), ' · ', d.start + '–' + d.end]),
      el('h4', { id: hid, 'aria-level': '3', text: pick(d.title) || TYPE[d.type] }),
      el('p', { 'class': 'fd-meta' }, [badge(d.type), el('span', { 'class': 'fd-places' + (d.left > 0 || d.review ? '' : ' is-full'), text: avail })]),
      el('dl', { 'class': 'fd-facts' }, [el('dt', { text: T.place }), el('dd', {}, [placeNode(d)]), el('dt', { text: T.org }), el('dd', { text: pick(d.organiser) || '—' })]),
      pick(d.desc) ? el('p', { 'class': 'fd-desc', text: pick(d.desc) }) : null
    ]);
    var btn = el('button', { type: 'button', 'class': 'btn', 'aria-expanded': 'false', 'aria-controls': 'fd-f-' + d.id }, [T.apply]);
    var slot = el('div', { id: 'fd-f-' + d.id, 'class': 'fd-formslot', hidden: true });
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      if (open) { slot.hidden = true; slot.innerHTML = ''; btn.setAttribute('aria-expanded', 'false'); btn.textContent = T.apply; return; }
      slot.appendChild(form(d)); slot.hidden = false; btn.setAttribute('aria-expanded', 'true'); btn.textContent = T.close;
      var h = slot.querySelector('h5'); h.setAttribute('tabindex', '-1'); h.focus();
    });
    art.appendChild(el('p', { 'class': 'btn-row' }, [btn]));
    art.appendChild(slot);
    li.appendChild(art);
    return li;
  }

  // ---------------------------------------------------------------- form
  var uid = 0;
  function field(id, label, input, opts) {
    opts = opts || {};
    var lab = el('label', { 'for': id }, [label, ' ', el('span', { 'class': 'fd-opt', text: '(' + (opts.required ? T.req : T.opt) + ')' })]);
    var kids = [lab];
    if (opts.hint) { kids.push(el('span', { 'class': 'fd-hint', id: id + '-h', text: opts.hint })); input.setAttribute('aria-describedby', id + '-h'); }
    kids.push(el('span', { 'class': 'fd-err', id: id + '-e', hidden: true }));
    kids.push(input);
    return el('div', { 'class': 'fd-field', 'data-f': opts.name || '' }, kids);
  }
  function group(name, legend, items, type, opts) {
    opts = opts || {};
    var fs = el('fieldset', { 'class': 'fd-field fd-group', 'data-f': name }, [
      el('legend', {}, [legend, ' ', el('span', { 'class': 'fd-opt', text: '(' + (opts.required ? T.req : T.opt) + ')' })])]);
    if (opts.hint) fs.appendChild(el('span', { 'class': 'fd-hint', text: opts.hint }));
    fs.appendChild(el('span', { 'class': 'fd-err', id: 'fd-' + name + '-e-' + uid, hidden: true }));
    Object.keys(items).forEach(function (k) {
      var id = 'fd-' + name + '-' + k + '-' + uid;
      fs.appendChild(el('div', { 'class': 'fd-choice' }, [el('input', { type: type, id: id, name: name, value: k }), el('label', { 'for': id, text: items[k] })]));
    });
    return fs;
  }
  function check(name, label, required) {
    var id = 'fd-' + name + '-' + uid;
    return el('div', { 'class': 'fd-field fd-check', 'data-f': name }, [
      el('span', { 'class': 'fd-err', id: id + '-e', hidden: true }),
      el('div', { 'class': 'fd-choice' }, [el('input', { type: 'checkbox', id: id, name: name }), el('label', { 'for': id }, [label, required ? el('span', { 'class': 'fd-opt', text: ' (' + T.req + ')' }) : null])])]);
  }
  function form(d) {
    uid++;
    var u = uid, f = el('form', { 'class': 'fd-form', novalidate: true });
    f.appendChild(el('h5', { 'aria-level': '4', text: T.formH + (pick(d.title) || TYPE[d.type]) + ', ' + fmtDay(d.date) }));
    var sum = el('div', { 'class': 'fd-summary', role: 'alert', tabindex: '-1', hidden: true }); f.appendChild(sum);
    f.appendChild(field('fd-name-' + u, T.name, el('input', { type: 'text', id: 'fd-name-' + u, name: 'name', autocomplete: 'name', maxlength: '100', required: true }), { required: true, name: 'name' }));
    f.appendChild(field('fd-email-' + u, T.email, el('input', { type: 'email', id: 'fd-email-' + u, name: 'email', autocomplete: 'email', maxlength: '200', required: true }), { required: true, name: 'email', hint: T.emailHint }));
    f.appendChild(field('fd-phone-' + u, T.phone, el('input', { type: 'tel', id: 'fd-phone-' + u, name: 'phone', autocomplete: 'tel', maxlength: '40' }), { name: 'phone' }));
    f.appendChild(field('fd-line-' + u, T.line, el('input', { type: 'text', id: 'fd-line-' + u, name: 'line', maxlength: '60', autocapitalize: 'none' }), { name: 'line' }));
    var lg = group('lang', T.lang, { en: 'English', zh: '中文' }, 'radio'); lg.querySelector('input[value="' + (ZH ? 'zh' : 'en') + '"]').checked = true; f.appendChild(lg);
    f.appendChild(group('exp', T.exp, T.expList, 'checkbox'));
    f.appendChild(field('fd-expnote-' + u, T.expNote, el('textarea', { id: 'fd-expnote-' + u, name: 'expNote', rows: '3', maxlength: '600' }), { name: 'expNote' }));
    f.appendChild(group('avail', T.avail, T.availList, 'radio', { required: true }));
    if (d.type === 'paid') f.appendChild(group('rtw', T.rtw, T.rtwList, 'radio', { required: true, hint: T.rtwHint }));
    f.appendChild(group('fit', T.fit, T.fitList, 'radio', { required: true }));
    f.appendChild(field('fd-safety-' + u, T.safety, el('textarea', { id: 'fd-safety-' + u, name: 'safety', rows: '2', maxlength: '600' }), { name: 'safety', hint: T.safetyHint }));
    f.appendChild(check('healthConsent', T.healthConsent, true));
    f.appendChild(check('photo', T.photo, false));
    f.appendChild(el('div', { 'class': 'fd-privacy' }, [el('h6', { 'aria-level': '5', text: T.privacyH }), el('p', { text: T.privacy })]));
    f.appendChild(check('privacy', T.privacyOk, true));
    var trap = el('div', { 'class': 'fd-trap', 'aria-hidden': 'true' }, [el('label', { 'for': 'fd-web-' + u, text: 'Website' }), el('input', { type: 'text', id: 'fd-web-' + u, name: 'website', tabindex: '-1', autocomplete: 'off' })]);
    f.appendChild(trap);
    var submit = el('button', { type: 'submit', 'class': 'btn' }, [T.send]);
    f.appendChild(el('p', { 'class': 'btn-row' }, [submit]));
    var out = el('div', { 'class': 'fd-result', role: 'status' }); f.appendChild(out);

    function val(n) { var x = f.elements[n]; return x ? (x.value || '').trim() : ''; }
    function radio(n) { var x = f.querySelector('input[name="' + n + '"]:checked'); return x ? x.value : ''; }
    function showErrors(list) {
      f.querySelectorAll('.fd-err').forEach(function (e) { e.hidden = true; e.textContent = ''; });
      f.querySelectorAll('[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });
      sum.innerHTML = ''; sum.hidden = !list.length;
      if (!list.length) return;
      sum.appendChild(el('h6', { 'aria-level': '5', text: T.errH }));
      var ul = el('ul'); sum.appendChild(ul);
      list.forEach(function (k) {
        var box = f.querySelector('[data-f="' + (k === 'rtwNone' ? 'rtw' : k) + '"]'); if (!box) return;
        var err = box.querySelector('.fd-err'); err.textContent = T.errs[k]; err.hidden = false;
        var inp = box.querySelector('input,textarea'); inp.setAttribute('aria-invalid', 'true');
        var a = el('a', { href: '#' + inp.id, text: T.errs[k] });
        a.addEventListener('click', function (e) { e.preventDefault(); inp.focus(); });
        ul.appendChild(el('li', {}, [a]));
      });
      sum.focus();
    }
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {
        dayId: d.id, name: val('name'), email: val('email'), phone: val('phone'), line: val('line'), lang: radio('lang') || (ZH ? 'zh' : 'en'),
        exp: [].map.call(f.querySelectorAll('input[name="exp"]:checked'), function (x) { return x.value; }), expNote: val('expNote'),
        avail: radio('avail'), rtw: radio('rtw'), fit: radio('fit'), safety: val('safety'),
        healthConsent: f.querySelector('input[name="healthConsent"]').checked, photo: f.querySelector('input[name="photo"]').checked,
        privacy: f.querySelector('input[name="privacy"]').checked, website: val('website')
      };
      var errs = [];
      if (data.name.length < 2) errs.push('name');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) errs.push('email');
      if (!data.avail) errs.push('avail');
      if (d.type === 'paid' && !data.rtw) errs.push('rtw');
      if (d.type === 'paid' && data.rtw === 'none') errs.push('rtwNone');
      if (!data.fit) errs.push('fit');
      if (!data.healthConsent) errs.push('healthConsent');
      if (!data.privacy) errs.push('privacy');
      showErrors(errs);
      if (errs.length) return;
      submit.disabled = true; submit.textContent = T.sending; out.textContent = '';
      post('apply', data).then(function (r) {
        submit.disabled = false; submit.textContent = T.send;
        if (r.error === 'invalid') return showErrors(r.fields || []);
        if (r.error === 'closed') { out.textContent = T.closed; return; }
        if (!r.ok) { out.textContent = T.netErr; return; }
        var done = el('div', { 'class': 'fd-done', tabindex: '-1' }, [
          el('p', { 'class': 'fd-done-h', text: r.dup ? T.dup + ' ' + (T.st[r.status] || '') : (T.ok[r.status] || T.ok.review) }),
          el('p', { text: T.refLine(r.ref) }),
          r.status === 'confirmed' && r.day ? el('p', { 'class': 'btn-row' }, [ics(r.day)]) : null]);
        f.replaceWith(done); done.focus();
      }, function () { submit.disabled = false; submit.textContent = T.send; out.textContent = T.netErr; });
    });
    return f;
  }

  // ---------------------------------------------------------------- check or cancel
  var cf = document.getElementById('fd-check');
  if (cf) {
    var cout = document.getElementById('fd-check-out');
    function run(action) {
      var body = { email: cf.elements.email.value.trim(), ref: cf.elements.ref.value.trim() };
      if (!body.email || !body.ref) { cout.textContent = T.notfound; return; }
      cout.textContent = '…';
      post(action, body).then(function (r) {
        if (r.error) { cout.textContent = r.error === 'notfound' ? T.notfound : T.netErr; return; }
        if (action === 'cancel') { cout.textContent = r.unchanged ? T.unchanged + ' ' + T.stLine + (T.st[r.status] || r.status) : T.cancelled; load(); return; }
        cout.textContent = r.ref + ' · ' + T.stLine + (T.st[r.status] || r.status) + (r.day ? ' · ' + fmtDay(r.day.date) + ' ' + r.day.start + '–' + r.day.end + ' · ' + (pick(r.day.title) || TYPE[r.day.type]) : '');
      }, function () { cout.textContent = T.netErr; });
    }
    cf.addEventListener('submit', function (e) { e.preventDefault(); run('status'); });
    document.getElementById('fd-cancel').addEventListener('click', function () { if (window.confirm(T.confirmCancel)) run('cancel'); });
  }

  // ---------------------------------------------------------------- personal record (link from the confirmation email)
  var meKey = (location.hash.match(/^#me=([A-Za-z0-9_-]{20,64})$/) || [])[1] || '';
  var meBox = null;
  function showRecord(focus) {
    if (!meKey) return;
    if (!meBox) {
      meBox = el('section', { 'class': 'fd-me', id: 'fd-me', 'aria-labelledby': 'fd-me-h', tabindex: '-1' });
      var head = document.querySelector('#field-days .sec-head');
      if (head) head.parentNode.insertBefore(meBox, head.nextSibling); else root.parentNode.insertBefore(meBox, root);
    }
    meBox.innerHTML = '';
    meBox.appendChild(el('h3', { id: 'fd-me-h', text: T.recH }));
    var status = el('p', { 'class': 'muted', role: 'status', text: T.recLoading }); meBox.appendChild(status);
    post('me', { key: meKey }).then(function (r) {
      status.remove();
      if (!r.ok) { meBox.appendChild(el('p', { text: r.error === 'notfound' ? T.recBad : T.netErr })); return; }
      meBox.appendChild(el('p', { 'class': 'fd-me-hello', text: T.hello(r.name) }));
      meBox.appendChild(el('dl', { 'class': 'fd-stats' }, [
        el('div', {}, [el('dt', { text: T.level }), el('dd', { text: T.levels[r.level] || T.levels[''] })]),
        el('div', {}, [el('dt', { text: T.hours }), el('dd', { text: T.h(r.hours) })]),
        el('div', {}, [el('dt', { text: T.daysDone }), el('dd', { text: String(r.days) })])]));
      var up = r.apps.filter(function (a) { return !a.past && a.status !== 'cancelled' && a.status !== 'declined'; });
      var past = r.apps.filter(function (a) { return a.past || a.status === 'cancelled' || a.status === 'declined'; }).reverse();
      meBox.appendChild(el('h4', { text: T.upcoming }));
      if (!up.length) meBox.appendChild(el('p', { text: T.noUpcoming }));
      else meBox.appendChild(el('ul', { 'class': 'fd-mylist' }, up.map(function (a) { return myItem(a, true); })));
      if (past.length) { meBox.appendChild(el('h4', { text: T.past })); meBox.appendChild(el('ul', { 'class': 'fd-mylist' }, past.map(function (a) { return myItem(a, false); }))); }
      meBox.appendChild(el('p', { 'class': 'fd-note', text: T.recNote }));
      meBox.appendChild(el('p', { 'class': 'fd-note', text: T.recPrivate }));
      if (focus) { meBox.focus(); }
    }, function () { status.textContent = T.netErr; });
  }
  function myItem(a, upcoming) {
    var d = a.day, info = el('div', {}, [
      el('p', { 'class': 'fd-date' }, [el('time', { datetime: d.date, text: fmtDay(d.date) }), ' · ', d.start + '–' + d.end]),
      el('p', { 'class': 'fd-my-t' }, [el('b', { text: pick(d.title) || TYPE[d.type] }), pick(d.place) ? ' · ' : '', pick(d.place) ? placeNode(d) : null]),
      el('p', { 'class': 'fd-my-s', text: a.attended === true ? T.attended + ' · ' + T.h(a.hours) : a.attended === false ? T.noShow : (T.st[a.status] || a.status) + ' · ' + a.ref })]);
    var li = el('li', { 'class': 'fd-' + d.type }, [info]);
    if (upcoming && a.canCancel) {
      var b = el('button', { type: 'button', 'class': 'btn danger', 'aria-label': T.cancelBtn + ': ' + fmtDay(d.date) }, [T.cancelBtn]);
      b.addEventListener('click', function () {
        if (!window.confirm(T.confirmCancel)) return;
        b.disabled = true;
        post('me-cancel', { key: meKey, ref: a.ref }).then(function () { showRecord(true); load(); }, function () { b.disabled = false; });
      });
      li.appendChild(b);
    }
    return li;
  }
  window.addEventListener('hashchange', function () {
    var k = (location.hash.match(/^#me=([A-Za-z0-9_-]{20,64})$/) || [])[1] || '';
    if (k && k !== meKey) { meKey = k; showRecord(true); }
  });

  var lf = document.getElementById('fd-link');
  if (lf) {
    var lout = document.getElementById('fd-link-out');
    lf.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = lf.elements.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { lout.textContent = T.linkInvalid; return; }
      lout.textContent = '…';
      post('link', { email: email }).then(function (r) { lout.textContent = r.error ? T.linkInvalid : T.linkSent; }, function () { lout.textContent = T.netErr; });
    });
  }

  function load() {
    root.setAttribute('aria-busy', 'true');
    if (!days.length) root.innerHTML = '<p class="muted">' + T.loading + '</p>';
    fetch(API + '?a=days').then(function (r) { return r.json(); }).then(function (j) {
      days = j.days || []; root.removeAttribute('aria-busy'); render();
    }, function () { root.removeAttribute('aria-busy'); root.innerHTML = ''; root.appendChild(el('p', { text: T.loadErr })); });
  }
  load();
  showRecord(true);
})();
