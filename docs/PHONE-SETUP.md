# Using Calorie Tracker on your phone

App address: **https://calorie-tracker-pearl-five.vercel.app**

## 1. Put the app on your home screen

Once installed, it opens full-screen like a normal app, with its own green icon.

### Android (Chrome)
1. Open the app address in **Chrome**.
2. Tap the **⋮** menu (top-right).
3. Tap **Add to Home screen** (on some phones it says **Install app**).
4. Tap **Install** / **Add**. The **Calories** icon appears on your home screen (you may need to
   drag it there from the app drawer).

### iPhone (Safari)
1. Open the app address in **Safari** (it must be Safari for this).
2. Tap the **Share** button (the square with an arrow, at the bottom).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**. Open the app from the **Calories** icon from now on.

> On iPhone, notifications only work when the app is opened from this Home Screen icon.

The first time you open it, enter your passcode to unlock it on that phone.

## 2. Turn on reminders (notifications)

This has a one-time setup on the computer, then a tap on each phone.

### One-time setup (computer)
**a. Add the notification keys to Vercel**
1. Open `.env.local` in the `calorie-tracker` folder.
2. In Vercel: your project → **Settings → Environment Variables**. Add these two (copy the values
   from `.env.local`, without quotes or spaces):
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
3. Go to **Deployments**, open the ⋯ menu on the newest one → **Redeploy** (the public key is
   built into the app, so it needs a fresh build).

**b. Update the Google script and switch on the hourly check**
1. Paste the latest `google-apps-script/Code.gs` into Apps Script and **💾 Save**.
2. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
3. In the editor's function dropdown choose **setupNotifications** → **▶ Run**.
   Google asks for one new permission — *"Connect to an external service"* — that's the script
   calling your app to send reminders. Allow it (same "Advanced → Go to …" steps as before).
4. The log should say *"Hourly reminder check scheduled."*

### On each phone
1. Open the app (on iPhone: from the Home Screen icon) → **Settings → 🔔 Phone notifications**.
2. Tap **Turn on notifications on this device** and **Allow** when the phone asks.
3. Tap **Send a test** — a "✅ Notifications are working" notification should arrive within seconds.
4. Choose your **meal reminder** times and whether you want the **"not eaten enough"** reminder.

### How reminders work
- **Meal reminders** arrive at the times you choose, only if you haven't logged that meal yet.
- **"Not eaten enough"** arrives after your alert time (Settings → Alerts) if you're below your chosen share of your target.
- Your Google Sheet checks about **once an hour**, so a reminder may arrive up to an hour after its time.
- Each reminder is sent at most once a day.
- **Locking** the app on a phone (Settings → Lock app on this device) also stops reminders on that phone.

### If notifications don't arrive
- Check the phone allows notifications for the app (Android: long-press the icon → App info →
  Notifications; iPhone: Settings → Notifications → Calories).
- Battery savers can delay notifications — allow Chrome / the app to run in the background.
- In Apps Script → **Executions**, look at the latest `notifyTick` run for a message.
