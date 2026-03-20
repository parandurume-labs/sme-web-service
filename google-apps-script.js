/**
 * 나이스가이 통합 스크립트 — 문의 + 예약 (좌석 관리 포함)
 *
 * - type: "contact" → 문의 처리
 * - type: "booking" → 예약 처리 (좌석 충돌 체크 + Sheets + Calendar)
 * - GET action=getSlots → 특정 날짜의 빈 시간대 조회
 * - GET action=getData  → 관리자 데이터 조회
 */

// ===== 설정 =====
var CONFIG = {
  notificationEmail: 'contact@paranduru.me',
  contactSheetName: '문의내역',
  bookingSheetName: '예약내역',
  totalSeats: 3,
  calendarId: PropertiesService.getScriptProperties().getProperty('CALENDAR_ID') || 'primary',
  recaptchaSecret: PropertiesService.getScriptProperties().getProperty('RECAPTCHA_SECRET_KEY') || '',
  hours: {
    weekday: { open: 600, close: 1200 },
    saturday: { open: 600, close: 1080 },
    sunday: null
  },
  slotInterval: 30
};

var SERVICES = {
  'mens-cut':   { name: '남성 커트',  duration: 30,  price: '15,000원' },
  'womens-cut': { name: '여성 커트',  duration: 45,  price: '20,000원' },
  'perm':       { name: '펌',         duration: 120, price: '50,000원~' },
  'coloring':   { name: '염색',       duration: 90,  price: '40,000원~' },
  'clinic':     { name: '클리닉',     duration: 60,  price: '30,000원~' },
  'styling':    { name: '스타일링',   duration: 30,  price: '10,000원~' }
};

// ===== 메인 핸들러 =====

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (CONFIG.recaptchaSecret && data.recaptchaToken) {
      if (!verifyRecaptcha(data.recaptchaToken)) {
        return jsonResponse(403, { status: 'error', message: 'reCAPTCHA 검증 실패' });
      }
    }

    if (!data.privacyConsent) {
      return jsonResponse(400, { status: 'error', message: '개인정보 동의가 필요합니다' });
    }

    if (data.type === 'booking') {
      return handleBooking(data);
    } else {
      return handleContact(data);
    }
  } catch (error) {
    console.error('Error:', error);
    return jsonResponse(500, { status: 'error', message: '서버 오류가 발생했습니다' });
  }
}

function doGet(e) {
  var params = e ? e.parameter : {};

  if (params.action === 'getSlots') {
    return handleGetSlots(params.date, params.service);
  }

  if (params.action === 'getData') {
    var adminKey = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || '';
    if (!adminKey || params.key !== adminKey) {
      return jsonResponse(403, { status: 'error', message: '인증 실패' });
    }
    return handleGetData(params.sheet);
  }

  return jsonResponse(200, { status: 'ok', message: 'Service is running', version: 'v2.0-seats' });
}

// ===== 빈 시간대 조회 =====

function handleGetSlots(dateStr, serviceId) {
  if (!dateStr) {
    return jsonResponse(400, { status: 'error', message: '날짜를 지정해 주세요' });
  }

  var service = serviceId ? SERVICES[serviceId] : null;
  var duration = service ? service.duration : CONFIG.slotInterval;

  var date = new Date(dateStr + 'T00:00:00+09:00');
  var day = date.getDay();
  var hoursConfig;
  if (day === 0) hoursConfig = CONFIG.hours.sunday;
  else if (day === 6) hoursConfig = CONFIG.hours.saturday;
  else hoursConfig = CONFIG.hours.weekday;

  if (!hoursConfig) {
    return jsonResponse(200, { status: 'ok', slots: [], message: '휴무일입니다' });
  }

  var bookings = getBookingsForDate(dateStr);
  var slots = [];

  for (var t = hoursConfig.open; t + duration <= hoursConfig.close; t += CONFIG.slotInterval) {
    var hour = String(Math.floor(t / 60)).padStart(2, '0');
    var min = String(t % 60).padStart(2, '0');
    var timeStr = hour + ':' + min;
    var availableSeats = getAvailableSeats(bookings, t, duration);

    slots.push({
      time: timeStr,
      available: availableSeats.length,
      seats: availableSeats
    });
  }

  return jsonResponse(200, { status: 'ok', slots: slots, totalSeats: CONFIG.totalSeats });
}

function getBookingsForDate(dateStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.bookingSheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  var dateIdx = headers.indexOf('예약날짜');
  var timeIdx = headers.indexOf('예약시간');
  var seatIdx = headers.indexOf('좌석');
  var serviceIdx = headers.indexOf('서비스');
  var statusIdx = headers.indexOf('상태');

  var bookings = [];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];

    var rowDate = row[dateIdx];
    if (rowDate instanceof Date) {
      var y = rowDate.getFullYear();
      var m = String(rowDate.getMonth() + 1).padStart(2, '0');
      var d = String(rowDate.getDate()).padStart(2, '0');
      rowDate = y + '-' + m + '-' + d;
    }
    if (String(rowDate) !== dateStr) continue;

    if (statusIdx >= 0 && row[statusIdx] === '취소') continue;

    var timeVal = row[timeIdx];
    if (timeVal instanceof Date) {
      timeVal = String(timeVal.getHours()).padStart(2, '0') + ':' + String(timeVal.getMinutes()).padStart(2, '0');
    }
    var parts = String(timeVal).split(':');
    var startMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);

    var serviceName = row[serviceIdx];
    var dur = CONFIG.slotInterval;
    for (var key in SERVICES) {
      if (SERVICES[key].name === serviceName) { dur = SERVICES[key].duration; break; }
    }

    var seatVal = seatIdx >= 0 ? parseInt(row[seatIdx]) : 0;
    if (seatVal >= 1) {
      bookings.push({ startMin: startMin, endMin: startMin + dur, seat: seatVal });
    } else {
      for (var s = 1; s <= CONFIG.totalSeats; s++) {
        bookings.push({ startMin: startMin, endMin: startMin + dur, seat: s });
      }
    }
  }

  return bookings;
}

function getAvailableSeats(bookings, requestStart, requestDuration) {
  var requestEnd = requestStart + requestDuration;
  var available = [];

  for (var seat = 1; seat <= CONFIG.totalSeats; seat++) {
    var conflict = false;
    for (var i = 0; i < bookings.length; i++) {
      var b = bookings[i];
      if (b.seat === seat && b.startMin < requestEnd && b.endMin > requestStart) {
        conflict = true;
        break;
      }
    }
    if (!conflict) available.push(seat);
  }

  return available;
}

// ===== 문의 처리 =====

function handleContact(data) {
  if (!data.name || !data.message) {
    return jsonResponse(400, { status: 'error', message: '이름과 문의 내용을 입력해 주세요' });
  }

  var sheet = getOrCreateSheet(CONFIG.contactSheetName,
    ['접수일시', '이름', '연락처', '이메일', '문의내용', '개인정보동의']);

  sheet.appendRow([
    data.submittedAt || now(),
    data.name || '',
    data.phone || '',
    data.email || '',
    data.message || '',
    data.privacyConsent ? 'Y' : 'N'
  ]);

  MailApp.sendEmail({
    to: CONFIG.notificationEmail,
    subject: '[나이스가이] 새 문의: ' + (data.name || '이름 없음'),
    htmlBody: buildContactEmail(data)
  });

  return jsonResponse(200, { status: 'ok', message: '문의가 접수되었습니다' });
}

// ===== 예약 처리 =====

function handleBooking(data) {
  if (!data.name || !data.service || !data.date || !data.time) {
    return jsonResponse(400, { status: 'error', message: '필수 항목을 모두 입력해 주세요' });
  }

  var service = SERVICES[data.service];
  if (!service) {
    return jsonResponse(400, { status: 'error', message: '유효하지 않은 서비스입니다' });
  }

  var timeParts = data.time.split(':');
  var startMin = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);

  var bookings = getBookingsForDate(data.date);
  var availableSeats = getAvailableSeats(bookings, startMin, service.duration);

  if (availableSeats.length === 0) {
    return jsonResponse(409, { status: 'error', message: '해당 시간에 빈 좌석이 없습니다. 다른 시간을 선택해 주세요.' });
  }

  var assignedSeat;
  if (data.seat && availableSeats.indexOf(parseInt(data.seat)) >= 0) {
    assignedSeat = parseInt(data.seat);
  } else {
    assignedSeat = availableSeats[0];
  }

  var sheet = getOrCreateSheet(CONFIG.bookingSheetName,
    ['접수일시', '서비스', '가격', '고객명', '연락처', '이메일', '예약날짜', '예약시간', '좌석', '요청사항', '상태', '개인정보동의']);

  sheet.appendRow([
    now(),
    service.name,
    service.price,
    data.name || '',
    data.phone || '',
    data.email || '',
    data.date,
    data.time,
    assignedSeat,
    data.memo || '',
    '확정',
    data.privacyConsent ? 'Y' : 'N'
  ]);

  try {
    var startTime = new Date(data.date + 'T' + data.time + ':00');
    var endTime = new Date(startTime.getTime() + service.duration * 60 * 1000);
    var calendar = CalendarApp.getCalendarById(CONFIG.calendarId);
    calendar.createEvent(
      '[좌석' + assignedSeat + '] ' + service.name + ' - ' + data.name,
      startTime, endTime,
      {
        description: '서비스: ' + service.name + ' (' + service.price + ')\n좌석: ' + assignedSeat + '번\n고객명: ' + data.name + '\n연락처: ' + (data.phone || '-') + '\n요청사항: ' + (data.memo || '없음'),
        location: '나이스가이 광명 소하점'
      }
    );
  } catch (calErr) {
    console.error('Calendar error (non-fatal):', calErr);
  }

  MailApp.sendEmail({
    to: CONFIG.notificationEmail,
    subject: '[나이스가이] 새 예약: ' + service.name + ' - ' + data.name + ' (좌석' + assignedSeat + ')',
    htmlBody: buildBookingEmail(data, service, assignedSeat)
  });

  return jsonResponse(200, { status: 'ok', message: '예약이 완료되었습니다', seat: assignedSeat });
}

// ===== 관리자 데이터 =====

function handleGetData(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (sheetName === 'all' || !sheetName) {
    return jsonResponse(200, {
      status: 'ok',
      contacts: getSheetData(ss, CONFIG.contactSheetName),
      bookings: getSheetData(ss, CONFIG.bookingSheetName)
    });
  }
  var targetSheet = sheetName === 'booking' ? CONFIG.bookingSheetName : CONFIG.contactSheetName;
  return jsonResponse(200, { status: 'ok', data: getSheetData(ss, targetSheet) });
}

function getSheetData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  return rows.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  }).reverse();
}

// ===== 유틸리티 =====

function getOrCreateSheet(sheetName, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange('1:1').setFontWeight('bold');
  } else {
    var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (currentHeaders.length < headers.length) {
      for (var i = currentHeaders.length; i < headers.length; i++) {
        sheet.getRange(1, i + 1).setValue(headers[i]).setFontWeight('bold');
      }
    }
  }
  return sheet;
}

function now() {
  return new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function verifyRecaptcha(token) {
  var response = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'post',
    payload: { secret: CONFIG.recaptchaSecret, response: token }
  });
  return JSON.parse(response.getContentText()).success === true;
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function jsonResponse(statusCode, body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

// ===== 이메일 템플릿 =====

function buildContactEmail(data) {
  return '<div style="font-family:sans-serif;max-width:600px;margin:0 auto">'
    + '<h2 style="color:#5a4a3a;border-bottom:2px solid #c9a96e;padding-bottom:10px">새로운 문의가 접수되었습니다</h2>'
    + '<table style="width:100%;border-collapse:collapse;margin:20px 0">'
    + emailRow('이름', data.name) + emailRow('연락처', data.phone || '-')
    + emailRow('이메일', data.email || '-') + emailRow('접수 시간', data.submittedAt || '')
    + '</table>'
    + '<div style="background:#faf7f2;padding:16px;border-radius:8px">'
    + '<h3 style="color:#5a4a3a;margin-bottom:8px">문의 내용</h3>'
    + '<p style="color:#555;line-height:1.7;white-space:pre-wrap">' + escapeHtml(data.message || '') + '</p>'
    + '</div></div>';
}

function buildBookingEmail(data, service, seat) {
  var html = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto">'
    + '<h2 style="color:#5a4a3a;border-bottom:2px solid #c9a96e;padding-bottom:10px">새로운 예약이 접수되었습니다</h2>'
    + '<table style="width:100%;border-collapse:collapse;margin:20px 0">'
    + emailRow('서비스', escapeHtml(service.name) + ' (' + escapeHtml(service.price) + ', 약 ' + service.duration + '분)')
    + emailRow('예약 일시', escapeHtml(data.date) + ' ' + escapeHtml(data.time))
    + emailRow('좌석', seat + '번')
    + emailRow('고객명', data.name) + emailRow('연락처', data.phone || '-') + emailRow('이메일', data.email || '-')
    + '</table>';
  if (data.memo) {
    html += '<div style="background:#faf7f2;padding:16px;border-radius:8px">'
      + '<h3 style="color:#5a4a3a;margin-bottom:8px">요청사항</h3>'
      + '<p style="color:#555;line-height:1.7;white-space:pre-wrap">' + escapeHtml(data.memo) + '</p></div>';
  }
  html += '<p style="color:#999;font-size:12px;margin-top:20px">Google Calendar에 자동으로 등록되었습니다.</p></div>';
  return html;
}

function emailRow(label, value) {
  return '<tr style="border-bottom:1px solid #eee">'
    + '<td style="padding:10px;font-weight:bold;color:#5a4a3a;width:100px">' + escapeHtml(label) + '</td>'
    + '<td style="padding:10px">' + escapeHtml(value) + '</td></tr>';
}
