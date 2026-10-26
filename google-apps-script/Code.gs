/**
 * Calorie Tracker — Google Sheets backend.
 *
 * Paste this whole file into Extensions → Apps Script of your Google Sheet,
 * run `setup` once, then deploy as a web app (see docs/GOOGLE-SHEETS-SETUP.md).
 *
 * Tabs:
 *   Preferences — profile and alert settings (kept forever)
 *   FoodLog     — food entries (rows older than 30 days are deleted nightly)
 *   Weight      — weight entries (kept forever)
 *   MyFoods     — foods you taught the photo recogniser (kept forever)
 *   MyFoodPhotos — visual fingerprints of your photos of those foods (kept forever)
 *
 * After pasting a new version of this file: Deploy → Manage deployments → ✏️ Edit →
 * Version: New version → Deploy (the web app URL stays the same).
 */

var LOG_RETENTION_DAYS = 30;

var SHEETS = {
  prefs: { name: 'Preferences', headers: ['key', 'value', 'updatedAt'] },
  food: {
    name: 'FoodLog',
    headers: ['id', 'date', 'meal', 'name', 'amount', 'calories', 'protein', 'carbs', 'fat', 'createdAt'],
  },
  weight: { name: 'Weight', headers: ['id', 'date', 'weightKg', 'createdAt'] },
  myFoods: {
    name: 'MyFoods',
    headers: ['id', 'name', 'serving', 'calories', 'protein', 'carbs', 'fat', 'createdAt'],
  },
  myFoodPhotos: { name: 'MyFoodPhotos', headers: ['id', 'foodId', 'embedding', 'createdAt'] },
};

var NUMBER_FIELDS = { calories: true, protein: true, carbs: true, fat: true, createdAt: true, weightKg: true };

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

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      (body.ops || []).forEach(applyOp_);
    } finally {
      lock.releaseLock();
    }
    return json_(readState_());
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
    default:
      throw new Error('Unknown operation: ' + op.type);
  }
}

function readState_() {
  var prefs = {};
  readObjects_(SHEETS.prefs).forEach(function (row) {
    try {
      prefs[row.key] = JSON.parse(row.value);
    } catch (e) {
      // Ignore a hand-edited cell that isn't valid JSON.
    }
  });
  return {
    ok: true,
    prefs: prefs,
    entries: readObjects_(SHEETS.food),
    weights: readObjects_(SHEETS.weight),
    myFoods: readObjects_(SHEETS.myFoods),
    myFoodPhotos: readObjects_(SHEETS.myFoodPhotos),
  };
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

function getSheet_(def) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(def.name);
  if (!sheet) {
    sheet = ss.insertSheet(def.name);
    sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    // Store text columns as plain text so Sheets doesn't turn "2026-10-25" or "1/2 cup" into dates.
    def.headers.forEach(function (h, i) {
      if (!NUMBER_FIELDS[h]) sheet.getRange(1, i + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
    });
  }
  return sheet;
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
