/**
 * Calorie Tracker — Google Sheets backend.
 *
 * Paste this whole file into Extensions → Apps Script of your Google Sheet,
 * run `setup` once, then deploy as a web app (see docs/GOOGLE-SHEETS-SETUP.md).
 *
 * Tabs:
 *   Preferences — profile and alert settings (kept forever)
 *   FoodLog     — food entries (rows older than 30 days are deleted nightly)
 *   Weight      — weigh-ins with optional height (kept forever)
 *   DailyTotals — one row per day: calories, macros and that day's target (kept forever)
 *   Water       — one row per day: water drunk (ml) and that day's goal (kept forever)
 *   MyFoods     — foods you taught the photo recogniser (kept forever)
 *   MyFoodPhotos — visual fingerprints of your photos of those foods (kept forever)
 *
 * Phone reminders: run `setupNotifications` once (it checks hourly via notifyTick).
 *
 * After pasting a new version of this file: Deploy → Manage deployments → ✏️ Edit →
 * Version: New version → Deploy (the web app URL stays the same).
 */

/** Data the app can ask for. The app holds back changes for anything missing here. */
var FEATURES = ['myFoods', 'dailyTotals', 'height', 'notifications', 'water'];

var LOG_RETENTION_DAYS = 30;

var SHEETS = {
  prefs: { name: 'Preferences', headers: ['key', 'value', 'updatedAt'] },
  food: {
    name: 'FoodLog',
    headers: ['id', 'date', 'meal', 'name', 'amount', 'calories', 'protein', 'carbs', 'fat', 'createdAt'],
  },
  // New columns are only ever added at the end, so older rows stay valid.
  weight: { name: 'Weight', headers: ['id', 'date', 'weightKg', 'createdAt', 'heightCm'] },
  dailyTotals: {
    name: 'DailyTotals',
    headers: ['id', 'date', 'calories', 'protein', 'carbs', 'fat', 'target', 'entries', 'updatedAt'],
  },
  myFoods: {
    name: 'MyFoods',
    headers: ['id', 'name', 'serving', 'calories', 'protein', 'carbs', 'fat', 'createdAt'],
  },
  myFoodPhotos: { name: 'MyFoodPhotos', headers: ['id', 'foodId', 'embedding', 'createdAt'] },
  water: { name: 'Water', headers: ['id', 'date', 'ml', 'goal', 'updatedAt'] },
};

var NUMBER_FIELDS = {
  calories: true,
  protein: true,
  carbs: true,
  fat: true,
  createdAt: true,
  updatedAt: true,
  weightKg: true,
  heightCm: true,
  target: true,
  entries: true,
  ml: true,
  goal: true,
};

// ---------------------------------------------------------------- setup

/** Run once from the Apps Script editor. Safe to run again. */
function setup() {
  Object.keys(SHEETS).forEach(function (k) {
    getSheet_(SHEETS[k]);
  });

  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('SECRET', secret);
  }

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'cleanupOldLogs') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('cleanupOldLogs').timeBased().everyDays(1).atHour(3).create();

  Logger.log('Setup complete. Tabs created and nightly cleanup scheduled (around 3 AM).');
  Logger.log('Your secret (copy into SHEETS_SECRET in .env.local):');
  Logger.log(secret);
}

// ---------------------------------------------------------------- web app

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || body.secret !== secret) return json_({ ok: false, error: 'unauthorized' });

    var skipped = [];
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      (body.ops || []).forEach(function (op) {
        // An operation from a newer app version is skipped rather than failing the whole sync.
        if (!applyOp_(op)) skipped.push(op.type);
      });
    } finally {
      lock.releaseLock();
    }
    var state = readState_();
    state.skipped = skipped;
    return json_(state);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, message: 'Calorie Tracker backend is running.' });
}

function applyOp_(op) {
  switch (op.type) {
    case 'setPref':
      upsertRow_(SHEETS.prefs, op.key, { key: op.key, value: JSON.stringify(op.value), updatedAt: Date.now() });
      break;
    case 'upsertEntry':
      upsertRow_(SHEETS.food, op.entry.id, op.entry);
      break;
    case 'deleteEntry':
      deleteRow_(SHEETS.food, op.id);
      break;
    case 'upsertWeight':
      upsertRow_(SHEETS.weight, op.weight.id, op.weight);
      break;
    case 'deleteWeight':
      deleteRow_(SHEETS.weight, op.id);
      break;
    case 'upsertMyFood':
      upsertRow_(SHEETS.myFoods, op.food.id, op.food);
      break;
    case 'deleteMyFood':
      deleteRow_(SHEETS.myFoods, op.id);
      deleteRowsWhere_(SHEETS.myFoodPhotos, 'foodId', op.id);
      break;
    case 'upsertMyFoodPhoto':
      upsertRow_(SHEETS.myFoodPhotos, op.photo.id, op.photo);
      break;
    case 'deleteMyFoodPhoto':
      deleteRow_(SHEETS.myFoodPhotos, op.id);
      break;
    case 'upsertDailyTotal':
      upsertRow_(SHEETS.dailyTotals, op.total.date, Object.assign({ id: op.total.date, updatedAt: Date.now() }, op.total));
      break;
    case 'deleteDailyTotal':
      deleteRow_(SHEETS.dailyTotals, op.date);
      break;
    case 'upsertWater':
      upsertRow_(SHEETS.water, op.day.date, Object.assign({ id: op.day.date, updatedAt: Date.now() }, op.day));
      break;
    default:
      return false;
  }
  return true;
}

function readPrefs_() {
  var prefs = {};
  readObjects_(SHEETS.prefs).forEach(function (row) {
    try {
      prefs[row.key] = JSON.parse(row.value);
    } catch (e) {
      // Ignore a hand-edited cell that isn't valid JSON.
    }
  });
  return prefs;
}

function readState_() {
  var prefs = readPrefs_();
  return {
    ok: true,
    features: FEATURES,
    prefs: prefs,
    entries: readObjects_(SHEETS.food),
    weights: readObjects_(SHEETS.weight),
    dailyTotals: readObjects_(SHEETS.dailyTotals),
    water: readObjects_(SHEETS.water),
    myFoods: readObjects_(SHEETS.myFoods),
    myFoodPhotos: readObjects_(SHEETS.myFoodPhotos),
  };
}

// ---------------------------------------------------------------- phone notifications

/**
 * Run once from the editor to turn on phone reminders: checks about once an
 * hour whether a reminder is due. (Google will ask permission to "connect to an
 * external service" — that's this script calling your app.) Safe to run again.
 */
function setupNotifications() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'notifyTick') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('notifyTick').timeBased().everyHours(1).create();
  Logger.log('Hourly reminder check scheduled.');
  notifyTick();
}

/** Asks the app whether any reminder is due now; it sends them and reports back. */
function notifyTick() {
  var prefs = readPrefs_();
  var appUrl = prefs.appUrl;
  var hasDevices = Object.keys(prefs).some(function (k) {
    return k.indexOf('push-') === 0 && prefs[k];
  });
  if (!appUrl || !hasDevices || !prefs.notifications) {
    Logger.log('Nothing to do: notifications are not turned on in the app yet.');
    return;
  }

  // Only recent food is needed (today in any time zone).
  var since = Utilities.formatDate(new Date(Date.now() - 2 * 86400000), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var entries = readObjects_(SHEETS.food)
    .filter(function (e) {
      return String(e.date) >= since;
    })
    .map(function (e) {
      return { date: e.date, meal: e.meal, calories: e.calories };
    });

  var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  var res = UrlFetchApp.fetch(String(appUrl).replace(/\/$/, '') + '/api/notify', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ secret: secret, prefs: prefs, entries: entries }),
    muteHttpExceptions: true,
  });
  var data;
  try {
    data = JSON.parse(res.getContentText());
  } catch (e) {
    Logger.log('Unexpected answer from the app (HTTP ' + res.getResponseCode() + ').');
    return;
  }
  if (!data.ok) {
    Logger.log('The app reported: ' + data.error);
    return;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (data.sent && data.sent.length) {
      var log = prefs['notify-sent'];
      var keys = log && log.date === data.date ? log.keys.concat(data.sent) : data.sent;
      upsertRow_(SHEETS.prefs, 'notify-sent', { key: 'notify-sent', value: JSON.stringify({ date: data.date, keys: keys }), updatedAt: Date.now() });
    }
    (data.gone || []).forEach(function (key) {
      deleteRow_(SHEETS.prefs, key); // that device turned notifications off or was reset
    });
  } finally {
    lock.releaseLock();
  }
  Logger.log('Sent: ' + (data.sent.length ? data.sent.join(', ') : 'nothing due'));
}

// ---------------------------------------------------------------- cleanup

/** Deletes FoodLog rows older than LOG_RETENTION_DAYS. Runs nightly via trigger. */
function cleanupOldLogs() {
  var tz = Session.getScriptTimeZone();
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOG_RETENTION_DAYS);
  var cutoffKey = Utilities.formatDate(cutoff, tz, 'yyyy-MM-dd');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_(SHEETS.food);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    var width = SHEETS.food.headers.length;
    var rows = sheet.getRange(2, 1, lastRow - 1, width).getValues();
    var dateCol = SHEETS.food.headers.indexOf('date');
    var keep = rows.filter(function (r) {
      return String(r[dateCol]) >= cutoffKey;
    });
    if (keep.length === rows.length) return;
    sheet.getRange(2, 1, lastRow - 1, width).clearContent();
    if (keep.length) sheet.getRange(2, 1, keep.length, width).setValues(keep);
    Logger.log('Deleted ' + (rows.length - keep.length) + ' old food log rows (before ' + cutoffKey + ').');
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- helpers

var checkedHeaders_ = {};

function getSheet_(def) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(def.name);
  if (!sheet) {
    sheet = ss.insertSheet(def.name);
    sheet.setFrozenRows(1);
    writeHeaders_(sheet, def, 0);
  } else if (!checkedHeaders_[def.name]) {
    // A tab created by an older version may be missing columns added since (e.g. heightCm).
    var have = sheet.getLastColumn();
    if (have < def.headers.length) writeHeaders_(sheet, def, have);
  }
  checkedHeaders_[def.name] = true;
  return sheet;
}

/** Writes header cells from column index `from` onwards and formats new text columns as plain text. */
function writeHeaders_(sheet, def, from) {
  var headers = def.headers.slice(from);
  sheet.getRange(1, from + 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  // Store text columns as plain text so Sheets doesn't turn "2026-10-25" or "1/2 cup" into dates.
  headers.forEach(function (h, i) {
    if (!NUMBER_FIELDS[h]) sheet.getRange(1, from + i + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
  });
}

function readObjects_(def) {
  var sheet = getSheet_(def);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var rows = sheet.getRange(2, 1, lastRow - 1, def.headers.length).getValues();
  return rows
    .filter(function (r) {
      return r[0] !== '';
    })
    .map(function (r) {
      var obj = {};
      def.headers.forEach(function (h, i) {
        var v = r[i];
        if (v === '' || v === null) return;
        obj[h] = NUMBER_FIELDS[h] ? Number(v) : String(v);
      });
      return obj;
    });
}

function upsertRow_(def, id, obj) {
  var sheet = getSheet_(def);
  var row = def.headers.map(function (h) {
    var v = obj[h];
    if (v === undefined || v === null) return '';
    if (NUMBER_FIELDS[h]) return Number(v);
    v = String(v);
    // Never let user text be treated as a formula.
    return /^[=+\-@]/.test(v) ? "'" + v : v;
  });
  var index = findRow_(sheet, id);
  if (index > 0) sheet.getRange(index, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
}

function deleteRow_(def, id) {
  var sheet = getSheet_(def);
  var index = findRow_(sheet, id);
  if (index > 0) sheet.deleteRow(index);
}

/** Deletes every row whose `column` equals `value` (bottom-up, so row numbers stay valid). */
function deleteRowsWhere_(def, column, value) {
  var sheet = getSheet_(def);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var col = def.headers.indexOf(column) + 1;
  var values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === String(value)) sheet.deleteRow(i + 2);
  }
}

/** 1-based row number for the id in column A, or -1. */
function findRow_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
