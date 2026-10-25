/**
 * 나이스가이 통합 스크립트 — 문의 + 예약 (좌석 관리 포함)
 *
 * POST (본문: JSON 문자열)
 * - type: "contact"     → 문의 처리
 * - type: "booking"     → 예약 처리 (좌석 충돌 체크 + Sheets + Calendar)
 * - action: "getSlots"  → 특정 날짜의 빈 시간대 조회
 * - action: "getData"   → 관리자 데이터 조회 (adminKey 필요)
 * GET action=getSlots   → 빈 시간대 조회 (이전 버전 호환)
 *
 * 스크립트 속성 (프로젝트 설정 → 스크립트 속성)
 * - ADMIN_KEY            관리자 키 (12자 이상)
 * - RECAPTCHA_SECRET_KEY reCAPTCHA 비밀 키
 * - CALENDAR_ID          예약을 등록할 캘린더 (생략 시 기본 캘린더)
 *
 * 보안 기능
 * - reCAPTCHA 필수 검증, 허니팟(봇 차단), 입력값 검증 및 길이 제한
 * - 시트 수식 주입 차단, 요청 횟수 제한, 동시 예약 잠금
 * - 관리자 키 연속 실패 시 잠금 + 알림 메일, 보유기간 지난 개인정보 자동 파기
 *
 * 최초 1회: 편집기에서 setupSecurityTriggers 실행 → 매일 새벽 자동 파기 등록
 */

// ===== 설정 =====
var CONFIG = {
  notificationEmail: 'contact@paranduru.me',
  shopName: '나이스가이 광명 소하점',
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
  slotInterval: 30,
  maxAdvanceDays: 90,        // 며칠 뒤까지 예약 가능한지
  retentionDays: 365,        // 개인정보 보유기간 (동의서 문구와 맞춰 주세요)
  syncCalendarBlocks: true,  // 구글 캘린더에 등록된 '[휴무]' 또는 종일 일정을 예약 불가로 반영
  allowInsecureNoRecaptcha: false, // true로 바꾸면 RECAPTCHA_SECRET_KEY 없이도 동작 (테스트 전용)
  rateLimit: { windowSec: 600, maxGlobal: 60, maxPerPhone: 3 },  // 10분 동안 전체 60건, 같은 번호 3건
  adminLock: { maxFails: 5, lockSec: 900 },                      // 5회 실패 시 15분 잠금
  limits: { name: 50, phone: 20, email: 100, message: 2000, memo: 500 }
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

    if (data.action === 'getSlots') {
      return handleGetSlots(data.date, data.service);
    }
    if (data.action === 'getData') {
      return handleAdmin(data.adminKey, function() {
        return handleGetData(data.sheet);
      });
    }
    if (data.action === 'updateBookingStatus') {
      return handleAdmin(data.adminKey, function() {
        return handleUpdateBookingStatus(data.bookingId, data.rowNumber, data.status);
      });
    }

    // 허니팟: 사람에게는 보이지 않는 칸이 채워져 있으면 봇으로 보고 저장하지 않음
    if (data.website) {
      return jsonResponse(200, { status: 'ok', message: '접수되었습니다' });
    }

    if (!data.privacyConsent) {
      return jsonResponse(400, { status: 'error', message: '개인정보 동의가 필요합니다' });
    }

    if (CONFIG.recaptchaSecret) {
      if (!verifyRecaptcha(data.recaptchaToken)) {
        return jsonResponse(403, { status: 'error', message: '스팸 방지 확인에 실패했습니다. 다시 시도해 주세요.' });
      }
    } else if (!CONFIG.allowInsecureNoRecaptcha) {
      console.error('RECAPTCHA_SECRET_KEY가 설정되지 않았습니다.');
      return jsonResponse(503, { status: 'error', message: '스팸 방지 설정(RECAPTCHA_SECRET_KEY)이 완료되지 않았습니다. 관리자에게 문의해 주세요.' });
    }

    var invalid = validateCommon(data);
    if (invalid) {
      return jsonResponse(400, { status: 'error', message: invalid });
    }

    if (isRateLimited(data.phone)) {
      return jsonResponse(429, { status: 'error', message: '요청이 너무 많습니다. 잠시 후 다시 시도하시거나 전화로 문의해 주세요.' });
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
    // 관리자 키가 주소(URL)에 남지 않도록 POST로만 받습니다
    return jsonResponse(400, { status: 'error', message: '관리자 페이지를 최신 버전으로 업데이트해 주세요' });
  }

  return jsonResponse(200, { status: 'ok', message: 'Service is running', version: 'v3.0-secure' });
}

// ===== 빈 시간대 조회 =====

function handleGetSlots(dateStr, serviceId) {
  if (!isValidDateStr(dateStr)) {
    return jsonResponse(400, { status: 'error', message: '날짜를 지정해 주세요' });
  }

  var service = serviceId ? SERVICES[serviceId] : null;
  var duration = service ? service.duration : CONFIG.slotInterval;

  var hoursConfig = getHoursForDate(dateStr);
  if (!hoursConfig) {
    return jsonResponse(200, { status: 'ok', slots: [], message: '휴무일입니다' });
  }

  var today = todayStr();
  if (dateStr < today || dateStr > maxBookingDateStr()) {
    return jsonResponse(200, { status: 'ok', slots: [], message: '예약할 수 없는 날짜입니다' });
  }
  var nowMin = dateStr === today ? nowMinutes() : -1;

  var bookings = getBookingsForDate(dateStr);
  var slots = [];

  for (var t = hoursConfig.open; t + duration <= hoursConfig.close; t += CONFIG.slotInterval) {
    var availableSeats = t <= nowMin ? [] : getAvailableSeats(bookings, t, duration);

    slots.push({
      time: minutesToTime(t),
      available: availableSeats.length,
      seats: availableSeats
    });
  }

  return jsonResponse(200, { status: 'ok', slots: slots, totalSeats: CONFIG.totalSeats });
}

function getHoursForDate(dateStr) {
  var day = new Date(dateStr + 'T00:00:00+09:00').getDay();
  if (day === 0) return CONFIG.hours.sunday;
  if (day === 6) return CONFIG.hours.saturday;
  return CONFIG.hours.weekday;
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

    var seatVal = seatIdx >= 0 ? parseInt(row[seatIdx], 10) : 0;
    if (seatVal >= 1) {
      bookings.push({ startMin: startMin, endMin: startMin + dur, seat: seatVal });
    } else {
      for (var s = 1; s <= CONFIG.totalSeats; s++) {
        bookings.push({ startMin: startMin, endMin: startMin + dur, seat: s });
      }
    }
  }

  // Google Calendar에 점주가 직접 등록한 일정('[휴무]' 또는 전화/현장 예약)도 반영
  if (CONFIG.syncCalendarBlocks) {
    try {
      var calBlocks = getCalendarBlocksForDate(dateStr);
      bookings = bookings.concat(calBlocks);
    } catch (calErr) {
      console.warn('캘린더 일정 조회 생략:', calErr);
    }
  }

  return bookings;
}

/**
 * 구글 캘린더에서 해당 날짜의 외부 일정을 읽어 좌석 점유 목록으로 변환합니다.
 * - 제목에 '[휴무]' 또는 '휴무'가 포함되거나 종일(All-day) 일정이면 전체 좌석을 차단합니다.
 * - 제목에 '[좌석N]'이 있으면 이미 시트에서 반영된 웹 예약이므로 중복 계산하지 않습니다.
 * - 그 외 일반 일정(예: 전화 예약 메모)은 1개 좌석을 점유한 것으로 계산합니다.
 */
function getCalendarBlocksForDate(dateStr) {
  var calendar = CalendarApp.getCalendarById(CONFIG.calendarId);
  if (!calendar) return [];

  var dayStart = new Date(dateStr + 'T00:00:00+09:00');
  var dayEnd = new Date(dateStr + 'T23:59:59+09:00');
  var events = calendar.getEvents(dayStart, dayEnd);
  var blocks = [];

  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    var title = String(ev.getTitle() || '');

    // 웹 예약으로 자동 생성된 일정('[좌석1] ...')은 시트 데이터와 중복되므로 건너뜀
    if (/^\[좌석\d+\]/.test(title)) continue;

    if (ev.isAllDayEvent() || /\[휴무\]|임시\s*휴무/.test(title)) {
      var sMin = ev.isAllDayEvent() ? 0 : Math.max(0, Math.floor((ev.getStartTime().getTime() - dayStart.getTime()) / 60000));
      var eMin = ev.isAllDayEvent() ? 1440 : Math.min(1440, Math.ceil((ev.getEndTime().getTime() - dayStart.getTime()) / 60000));
      for (var s = 1; s <= CONFIG.totalSeats; s++) {
        blocks.push({ startMin: sMin, endMin: eMin, seat: s });
      }
    }
  }
  return blocks;
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

  var submittedAt = now();
  var sheet = getOrCreateSheet(CONFIG.contactSheetName,
    ['접수일시', '이름', '연락처', '이메일', '문의내용', '개인정보동의']);

  sheet.appendRow(safeRow([
    submittedAt,
    data.name || '',
    data.phone || '',
    data.email || '',
    data.message || '',
    'Y'
  ]));

  MailApp.sendEmail({
    to: CONFIG.notificationEmail,
    subject: '[나이스가이] 새 문의: ' + oneLine(data.name || '이름 없음'),
    htmlBody: buildContactEmail(data, submittedAt)
  });

  return jsonResponse(200, { status: 'ok', message: '문의가 접수되었습니다' });
}

// ===== 예약 처리 =====

function handleBooking(data) {
  if (!data.name || !data.phone || !data.service || !data.date || !data.time) {
    return jsonResponse(400, { status: 'error', message: '필수 항목을 모두 입력해 주세요' });
  }

  var service = SERVICES[data.service];
  if (!service) {
    return jsonResponse(400, { status: 'error', message: '유효하지 않은 서비스입니다' });
  }

  var slotError = validateBookingSlot(data.date, data.time, service.duration);
  if (slotError) {
    return jsonResponse(400, { status: 'error', message: slotError });
  }

  var startMin = timeToMinutes(data.time);

  // 같은 시간에 두 사람이 동시에 예약해도 좌석이 겹치지 않도록 잠금
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return jsonResponse(503, { status: 'error', message: '예약이 몰리고 있습니다. 잠시 후 다시 시도해 주세요.' });
  }

  var assignedSeat;
  var bookingId = 'BK-' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyMMdd') + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  var sheet;
  var newRowIndex;
  try {
    var bookings = getBookingsForDate(data.date);
    var availableSeats = getAvailableSeats(bookings, startMin, service.duration);

    if (availableSeats.length === 0) {
      return jsonResponse(409, { status: 'error', message: '해당 시간에 빈 좌석이 없습니다. 다른 시간을 선택해 주세요.' });
    }

    if (data.seat && availableSeats.indexOf(parseInt(data.seat, 10)) >= 0) {
      assignedSeat = parseInt(data.seat, 10);
    } else {
      assignedSeat = availableSeats[0];
    }

    sheet = getOrCreateSheet(CONFIG.bookingSheetName,
      ['접수일시', '서비스', '가격', '고객명', '연락처', '이메일', '예약날짜', '예약시간', '좌석', '요청사항', '상태', '개인정보동의', '예약번호', '캘린더ID']);

    sheet.appendRow(safeRow([
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
      'Y',
      bookingId,
      ''
    ]));
    newRowIndex = sheet.getLastRow();
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  try {
    var startTime = new Date(data.date + 'T' + data.time + ':00+09:00');
    var endTime = new Date(startTime.getTime() + service.duration * 60 * 1000);
    var calendar = CalendarApp.getCalendarById(CONFIG.calendarId);
    var calEvent = calendar.createEvent(
      '[좌석' + assignedSeat + '] ' + service.name + ' - ' + oneLine(data.name),
      startTime, endTime,
      {
        description: '예약번호: ' + bookingId + '\n서비스: ' + service.name + ' (' + service.price + ')\n좌석: ' + assignedSeat + '번\n고객명: ' + data.name + '\n연락처: ' + (data.phone || '-') + '\n요청사항: ' + (data.memo || '없음'),
        location: CONFIG.shopName
      }
    );
    if (calEvent && sheet && newRowIndex) {
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var calCol = headers.indexOf('캘린더ID') + 1;
      if (calCol > 0) {
        sheet.getRange(newRowIndex, calCol).setValue(calEvent.getId());
      }
    }
  } catch (calErr) {
    console.error('Calendar error (non-fatal):', calErr);
  }

  MailApp.sendEmail({
    to: CONFIG.notificationEmail,
    subject: '[' + CONFIG.shopName + '] 새 예약: ' + service.name + ' - ' + oneLine(data.name) + ' (좌석' + assignedSeat + ')',
    htmlBody: buildBookingEmail(data, service, assignedSeat, bookingId)
  });

  return jsonResponse(200, { status: 'ok', message: '예약이 완료되었습니다', seat: assignedSeat, bookingId: bookingId });
}

// ===== 관리자 인증 및 데이터 관리 =====

function handleAdmin(key, onSuccess) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return jsonResponse(503, { status: 'error', message: '요청이 몰리고 있습니다. 잠시 후 다시 시도해 주세요.' });
  }
  try {
    var cache = CacheService.getScriptCache();
    var fails = parseInt(cache.get('admin_fails') || '0', 10);
    if (fails >= CONFIG.adminLock.maxFails) {
      return jsonResponse(429, { status: 'error', message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.' });
    }

    var adminKey = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || '';
    if (adminKey.length < 12) {
      console.error('ADMIN_KEY가 없거나 12자 미만입니다.');
      return jsonResponse(500, { status: 'error', message: '관리자 키 설정을 확인해 주세요 (12자 이상)' });
    }

    if (!safeEqual(String(key || ''), adminKey)) {
      fails++;
      cache.put('admin_fails', String(fails), CONFIG.adminLock.lockSec);
      if (fails === CONFIG.adminLock.maxFails) {
        MailApp.sendEmail({
          to: CONFIG.notificationEmail,
          subject: '[' + CONFIG.shopName + '] 보안 알림: 관리자 로그인 실패 반복',
          htmlBody: '<p>관리자 페이지 로그인이 ' + fails + '회 연속 실패하여 15분간 잠겼습니다.</p>'
            + '<p>본인이 아니라면 스크립트 속성의 <b>ADMIN_KEY</b>를 새 값으로 바꿔 주세요.</p>'
            + '<p style="color:#999;font-size:12px">' + escapeHtml(now()) + '</p>'
        });
      }
      return jsonResponse(403, { status: 'error', message: '인증 실패' });
    }

    cache.remove('admin_fails');
  } finally {
    lock.releaseLock();
  }

  return onSuccess();
}

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
  return rows.map(function(row, idx) {
    var obj = { _rowNumber: idx + 2 };
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  }).reverse();
}

function handleUpdateBookingStatus(bookingId, rowNumber, newStatus) {
  var allowed = ['확정', '취소', '완료'];
  if (allowed.indexOf(newStatus) < 0) {
    return jsonResponse(400, { status: 'error', message: '유효하지 않은 상태값입니다' });
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return jsonResponse(503, { status: 'error', message: '잠시 후 다시 시도해 주세요' });
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.bookingSheetName);
    if (!sheet || sheet.getLastRow() < 2) {
      return jsonResponse(404, { status: 'error', message: '예약 내역을 찾을 수 없습니다' });
    }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var statusIdx = headers.indexOf('상태');
    var idIdx = headers.indexOf('예약번호');
    var calIdx = headers.indexOf('캘린더ID');

    if (statusIdx < 0) {
      return jsonResponse(500, { status: 'error', message: '시트에 상태 열이 없습니다' });
    }

    var targetRow = -1;
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

    if (bookingId && idIdx >= 0) {
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][idIdx]) === String(bookingId)) {
          targetRow = i + 2;
          break;
        }
      }
    } else if (rowNumber && rowNumber >= 2 && rowNumber <= sheet.getLastRow()) {
      targetRow = parseInt(rowNumber, 10);
    }

    if (targetRow < 2) {
      return jsonResponse(404, { status: 'error', message: '해당 예약을 찾을 수 없습니다' });
    }

    sheet.getRange(targetRow, statusIdx + 1).setValue(newStatus);

    // 예약 취소 시 연동된 Google Calendar 일정도 함께 삭제
    if (newStatus === '취소' && calIdx >= 0) {
      var eventId = rows[targetRow - 2][calIdx];
      if (eventId) {
        try {
          var calendar = CalendarApp.getCalendarById(CONFIG.calendarId);
          var ev = calendar ? calendar.getEventById(String(eventId)) : null;
          if (ev) ev.deleteEvent();
        } catch (calErr) {
          console.warn('캘린더 일정 삭제 생략:', calErr);
        }
      }
    }

    SpreadsheetApp.flush();
    return jsonResponse(200, { status: 'ok', message: '예약 상태가 변경되었습니다', statusValue: newStatus });
  } finally {
    lock.releaseLock();
  }
}

// ===== 입력 검증 =====

function validateCommon(data) {
  var L = CONFIG.limits;
  if (tooLong(data.name, L.name)) return '이름은 ' + L.name + '자 이내로 입력해 주세요';
  if (tooLong(data.email, L.email)) return '이메일이 너무 깁니다';
  if (tooLong(data.message, L.message)) return '문의 내용은 ' + L.message + '자 이내로 입력해 주세요';
  if (tooLong(data.memo, L.memo)) return '요청사항은 ' + L.memo + '자 이내로 입력해 주세요';

  if (data.phone) {
    var digits = String(data.phone).replace(/\D/g, '');
    if (tooLong(data.phone, L.phone) || !/^[0-9+\-\s()]+$/.test(data.phone) || digits.length < 9) {
      return '연락처 형식이 올바르지 않습니다';
    }
  }
  if (data.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.email)) {
    return '이메일 형식이 올바르지 않습니다';
  }
  return '';
}

function validateBookingSlot(dateStr, timeStr, duration) {
  if (!isValidDateStr(dateStr) || !/^\d{2}:\d{2}$/.test(String(timeStr))) {
    return '날짜와 시간 형식이 올바르지 않습니다';
  }
  var today = todayStr();
  if (dateStr < today) return '지난 날짜는 예약할 수 없습니다';
  if (dateStr > maxBookingDateStr()) return CONFIG.maxAdvanceDays + '일 이내의 날짜만 예약할 수 있습니다';

  var hoursConfig = getHoursForDate(dateStr);
  if (!hoursConfig) return '휴무일입니다. 다른 날짜를 선택해 주세요';

  var start = timeToMinutes(timeStr);
  if (start < hoursConfig.open || start + duration > hoursConfig.close
      || (start - hoursConfig.open) % CONFIG.slotInterval !== 0) {
    return '영업시간 안의 예약 가능한 시간을 선택해 주세요';
  }
  if (dateStr === today && start <= nowMinutes()) return '이미 지난 시간입니다';
  return '';
}

function tooLong(value, max) {
  return value != null && String(value).length > max;
}

function isValidDateStr(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

// ===== 요청 횟수 제한 =====

function isRateLimited(phone) {
  var cache = CacheService.getScriptCache();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return true;
  try {
    var win = CONFIG.rateLimit.windowSec;
    var globalCount = parseInt(cache.get('rl_global') || '0', 10);
    if (globalCount >= CONFIG.rateLimit.maxGlobal) return true;

    var phoneKey = phone ? 'rl_p_' + String(phone).replace(/\D/g, '') : '';
    var phoneCount = phoneKey ? parseInt(cache.get(phoneKey) || '0', 10) : 0;
    if (phoneKey && phoneCount >= CONFIG.rateLimit.maxPerPhone) return true;

    cache.put('rl_global', String(globalCount + 1), win);
    if (phoneKey) cache.put(phoneKey, String(phoneCount + 1), win);
    return false;
  } finally {
    lock.releaseLock();
  }
}

// ===== 개인정보 자동 파기 =====

/** 보유기간이 지난 예약·문의 행을 삭제합니다. setupSecurityTriggers()가 매일 자동 실행되게 등록합니다. */
function purgeExpiredData() {
  var cutoff = new Date(Date.now() - CONFIG.retentionDays * 24 * 60 * 60 * 1000);
  var removed = purgeSheet(CONFIG.bookingSheetName, '예약날짜', cutoff)
    + purgeSheet(CONFIG.contactSheetName, '접수일시', cutoff);
  console.log('보유기간(' + CONFIG.retentionDays + '일) 경과 데이터 ' + removed + '건 파기');
  return removed;
}

function purgeSheet(sheetName, dateHeader, cutoff) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = headers.indexOf(dateHeader);
  if (idx < 0) return 0;
  var calIdx = headers.indexOf('캘린더ID');
  var calendar = calIdx >= 0 ? CalendarApp.getCalendarById(CONFIG.calendarId) : null;

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var removed = 0;
  for (var r = rows.length - 1; r >= 0; r--) {
    var d = parseSheetDate(rows[r][idx]);
    if (d && d < cutoff) {
      if (calendar && calIdx >= 0 && rows[r][calIdx]) {
        try {
          var ev = calendar.getEventById(String(rows[r][calIdx]));
          if (ev) ev.deleteEvent();
        } catch (e) {}
      }
      sheet.deleteRow(r + 2);
      removed++;
    }
  }
  return removed;
}

function parseSheetDate(value) {
  if (value instanceof Date) return value;
  var m = String(value).match(/(\d{4})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** 편집기에서 한 번 실행하세요. 매일 새벽 4시에 purgeExpiredData가 돌도록 등록합니다. */
function setupSecurityTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'purgeExpiredData') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('purgeExpiredData').timeBased().everyDays(1).atHour(4).create();
  console.log('자동 파기 트리거 등록 완료');
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

/** =, +, -, @ 로 시작하는 입력이 시트에서 수식으로 실행되지 않도록 문자열로 고정합니다. */
function safeCell(value) {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
}

function safeRow(values) {
  return values.map(safeCell);
}

function oneLine(text) {
  return String(text).replace(/[\r\n]+/g, ' ');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function now() {
  return new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function todayStr() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
}

function maxBookingDateStr() {
  return Utilities.formatDate(new Date(Date.now() + CONFIG.maxAdvanceDays * 24 * 60 * 60 * 1000), 'Asia/Seoul', 'yyyy-MM-dd');
}

function nowMinutes() {
  return timeToMinutes(Utilities.formatDate(new Date(), 'Asia/Seoul', 'HH:mm'));
}

function timeToMinutes(timeStr) {
  var parts = String(timeStr).split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function minutesToTime(t) {
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}

function verifyRecaptcha(token) {
  if (!token) return false;
  var response = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'post',
    payload: { secret: CONFIG.recaptchaSecret, response: token },
    muteHttpExceptions: true
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

function buildContactEmail(data, submittedAt) {
  return '<div style="font-family:sans-serif;max-width:600px;margin:0 auto">'
    + '<h2 style="color:#5a4a3a;border-bottom:2px solid #c9a96e;padding-bottom:10px">새로운 문의가 접수되었습니다</h2>'
    + '<table style="width:100%;border-collapse:collapse;margin:20px 0">'
    + emailRow('이름', data.name) + emailRow('연락처', data.phone || '-')
    + emailRow('이메일', data.email || '-') + emailRow('접수 시간', submittedAt)
    + '</table>'
    + '<div style="background:#faf7f2;padding:16px;border-radius:8px">'
    + '<h3 style="color:#5a4a3a;margin-bottom:8px">문의 내용</h3>'
    + '<p style="color:#555;line-height:1.7;white-space:pre-wrap">' + escapeHtml(data.message || '') + '</p>'
    + '</div></div>';
}

function buildBookingEmail(data, service, seat, bookingId) {
  var html = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto">'
    + '<h2 style="color:#5a4a3a;border-bottom:2px solid #c9a96e;padding-bottom:10px">새로운 예약이 접수되었습니다</h2>'
    + '<table style="width:100%;border-collapse:collapse;margin:20px 0">'
    + (bookingId ? emailRow('예약번호', bookingId) : '')
    + emailRow('서비스', service.name + ' (' + service.price + ', 약 ' + service.duration + '분)')
    + emailRow('예약 일시', data.date + ' ' + data.time)
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
