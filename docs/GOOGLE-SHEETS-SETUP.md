# Connecting the app to Google Sheets

About 10 minutes. Do these steps on a computer, signed in to Google as
**kevincmathews20112003@gmail.com** (the account that will own the sheet).

## 1. Create the sheet
1. Go to <https://sheets.new> (make sure the account picker at top-right shows the right account).
2. Rename it (click "Untitled spreadsheet") to **Calorie Tracker**.

## 2. Add the script
1. In the sheet, open **Extensions → Apps Script**. A new tab opens.
2. Delete everything in the editor (the `function myFunction() {}` placeholder).
3. Open `google-apps-script/Code.gs` from this project, copy **all** of it, and paste it in.
4. Click the 💾 **Save** icon. If asked, name the project **Calorie Tracker**.

## 3. Run setup once
1. In the toolbar, make sure the function dropdown says **setup**, then click **▶ Run**.
2. Google asks for permission:
   - Click **Review permissions** and choose the account.
   - You'll see **"Google hasn't verified this app."** This is expected — it's your own script.
     Click **Advanced → Go to Calorie Tracker (unsafe)**.
   - Click **Allow**. (The script can only edit this spreadsheet and run the nightly cleanup.)
3. The **Execution log** at the bottom shows "Setup complete" and a long **secret**.
   Copy that secret — you'll need it in step 5.
4. Back in the sheet you'll now see three tabs: **Preferences**, **FoodLog**, **Weight**.

## 4. Deploy as a web app
1. In Apps Script, click **Deploy → New deployment**.
2. Click the ⚙️ next to "Select type" and choose **Web app**.
3. Set:
   - **Description:** Calorie Tracker
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**
4. Click **Deploy**, then copy the **Web app URL** (it ends in `/exec`).

> "Anyone" is needed so the app's server can reach the script. Nobody can read or change
> your data without the secret, which only lives in your app's private settings.

## 5. Put the values in the app
Open `.env.local` in the `calorie-tracker` folder and fill it in:

```
SHEETS_WEBAPP_URL=paste the /exec URL here
SHEETS_SECRET=paste the secret from step 3 here
APP_PASSCODE=choose a passcode
```

Save the file, then tell Claude it's done — the app's server needs a restart to pick it up.

## 6. Unlock the app with your passcode
The app opens on a lock screen until it's unlocked on that device. Type the same passcode and tap
**Unlock** — your data is then downloaded from the sheet. Anything already on the device is uploaded
the first time it connects. **Settings → Google Sheets sync → Lock app on this device** removes the
data from that device again (it stays in your sheet).

---

## Updating the script (when the app gets new features)
Some new features need a newer version of `google-apps-script/Code.gs` — for example
**taught foods** (⭐ My foods). Until you update, those features keep their data on your device
and the app shows a notice in **Settings → Google Sheets sync**; everything else keeps syncing.

1. Open your sheet → **Extensions → Apps Script**.
2. Select everything in the editor (**Ctrl+A**), delete it, and paste the whole new `Code.gs`. Click 💾 **Save**.
3. **Deploy → Manage deployments** → select your deployment → ✏️ **Edit**.
4. **Version: New version** (keep *Execute as: Me* and *Who has access: Anyone*) → **Deploy**.

The web app URL stays the same, so nothing changes in `.env.local` or Vercel. You don't need to run
`setup` again — new tabs (like **DailyTotals**, **MyFoods** and **MyFoodPhotos**) and new columns (like
**heightCm** in **Weight**) are created automatically on first use.

From script version 3 on, the script tells the app what it supports and skips anything it doesn't know,
so a newer app never breaks syncing with an older script.

## How the data is kept
| Tab | Contents | Kept |
|---|---|---|
| Preferences | Your details, calorie target, alert settings | Forever |
| FoodLog | Every food entry | 30 days — older rows are deleted nightly around 3 AM |
| Weight | Weigh-ins, with optional height | Forever |
| DailyTotals | One row per day: total calories, protein, carbs, fat and that day's target | Forever |
| MyFoods | Foods you taught the photo recogniser (name, serving, calories, macros) | Forever |
| MyFoodPhotos | A compact visual fingerprint of each photo of those foods (not the photo itself) | Forever |

You can look at the sheet any time. Avoid editing it by hand while the app is open;
if you do, the app picks up the changes the next time it syncs.

## If something goes wrong
- **"Couldn't reach Google Sheets (sheets_unreachable)"** — check the URL ends in `/exec` and
  the deployment's access is **Anyone**.
- **"sheets_secret_mismatch"** — the secret in `.env.local` doesn't match. Re-run `setup` to see it again.
- **Changed the script later?** Use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**
  so the URL stays the same.
