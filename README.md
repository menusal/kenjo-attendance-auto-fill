# Kenjo Attendance Auto-Fill - Tampermonkey Userscript

A Tampermonkey userscript that automatically fills missing Kenjo attendance entries with customizable time intervals and random time entropy (±1-10 minutes).

## Features

- **Automatic Detection**: Scans for missing attendance entries in any month/year
- **Smart Filtering**: Only shows past working days that need to be filled
- **Custom Time Intervals**: Configure multiple time ranges (default: 09:00-14:00, 15:00-18:00)
- **Random Entropy**: Adds 1-10 minutes randomization to arrival/departure times for natural variation
- **Manual Selection**: Choose exactly which dates to fill via checkboxes
- **Progress Tracking**: Real-time progress bar and notifications
- **User-Friendly UI**: Clean floating button and modal interface

## Installation

### Step 1: Install Tampermonkey

1. Install the Tampermonkey browser extension:
   - **Chrome**: [Tampermonkey on Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojnmoofnbnafgjabi)
   - **Firefox**: [Tampermonkey on Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - **Edge**: [Tampermonkey on Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
   - **Safari**: [Tampermonkey on Mac App Store](https://apps.apple.com/us/app/tampermonkey/id1482490089)

### Step 2: Install the Script

1. Click on the Tampermonkey icon in your browser
2. Select **"Create a new script..."**
3. Delete the default template
4. Copy the entire contents of `kenjo-autofill.user.js`
5. Paste into the Tampermonkey editor
6. Press **Ctrl+S** (or **Cmd+S** on Mac) to save
7. The script will now be active

## Usage

### Step 1: Navigate to Kenjo

1. Go to [https://app.kenjo.io](https://app.kenjo.io)
2. Log in to your account
3. You should see a green **"📅 Auto-Fill"** button in the bottom-right corner of any Kenjo page

### Step 2: Scan for Missing Dates

1. Click the **"📅 Auto-Fill"** button
2. A configuration modal will appear
3. Set the **Month** and **Year** you want to check
4. (Optional) Customize the time intervals:
   - Default is `09:00-14:00` and `15:00-18:00`
   - You can edit these to match your work schedule
   - Multiple intervals are supported (e.g., morning shift + afternoon shift)
5. Click **"Scan Missing Dates"**

### Step 3: Review and Fill

1. The script will display all missing dates that need to be filled
   - Only shows **past working days** (not today or future dates)
   - Each date has a checkbox (all checked by default)
2. **Uncheck** any dates you don't want to fill
3. Click **"Fill Selected Dates"**
4. Watch the progress bar as entries are created
5. You'll see a success notification when complete

### Step 4: Verify

1. Navigate to the Kenjo attendance page
2. Refresh the page
3. Verify that your attendance entries have been created
4. Note: Times will have random variations (±1-10 minutes) for natural appearance

## Configuration

### Time Intervals

The default time intervals are:
- Morning: 09:00 - 14:00
- Afternoon: 15:00 - 18:00

You can customize these in the modal to match your work schedule:
- Part-time: `09:00-14:00` (single interval)
- Full-time: `09:00-18:00` (single interval)
- Split shift: `09:00-13:00,14:00-18:00` (lunch break)

### Random Entropy

The script automatically adds ±1-10 minutes of randomization to all times:
- Arrival time might be: 08:55, 09:03, 09:07, etc. (instead of exactly 09:00)
- Departure time might be: 13:54, 14:05, 14:09, etc. (instead of exactly 14:00)

This makes your attendance entries look more natural and human.

## Credential Extraction

The script automatically extracts your credentials from the browser:

1. **Bearer Token**: Extracted from `localStorage` (keys: `token`, `accessToken`, `authToken`)
2. **User ID**: Extracted from `localStorage` (keys: `userId`, `user_id`, or from user objects)

If credentials cannot be extracted automatically:
- Make sure you're logged into Kenjo
- Refresh the page and try again
- Check the browser console for error messages

## Troubleshooting

### Button Not Appearing

- Make sure Tampermonkey is enabled
- Check that the script is enabled in Tampermonkey dashboard
- Refresh the Kenjo page
- Check browser console for errors (F12)

### "Could not extract credentials" Error

- Log out and log back into Kenjo
- Refresh the page
- Try manually checking `localStorage` in browser console:
  ```javascript
  console.log(localStorage);
  ```
- Look for keys containing "token" or "userId"

### API Errors

- Check your internet connection
- Verify you're still logged into Kenjo
- Try logging out and back in to refresh your session
- Check browser console for detailed error messages

### Dates Not Being Created

- Make sure dates are checked in the modal
- Verify you have permission to create attendance entries
- Check that the dates are in the past (not today or future)
- Look for error notifications or check browser console

## Advanced Usage

### Customizing Button Position

Edit the `CONFIG.BUTTON_POSITION` in the script:

```javascript
BUTTON_POSITION: { bottom: '20px', right: '20px' }
```

Change `bottom`/`right` to `top`/`left` if you prefer a different corner.

### Adjusting Entropy Range

Edit the `CONFIG.ENTROPY_RANGE` in the script:

```javascript
ENTROPY_RANGE: { min: 1, max: 10 }
```

- Increase `max` for more variation (e.g., `max: 15`)
- Decrease for less variation (e.g., `max: 5`)
- Set both to `0` for no randomization

### Changing API Delay

Edit the `CONFIG.RETRY_DELAY` to adjust time between API calls:

```javascript
RETRY_DELAY: 1000  // milliseconds (1 second)
```

Increase if you're getting rate-limited, decrease for faster filling.

## Security Notes

- This script only works on `app.kenjo.io` domain
- Your credentials never leave your browser
- All API calls go directly to Kenjo's API
- The script has no external dependencies or analytics
- Source code is fully visible and auditable

## Comparison with Python Script

| Feature | Python Script | Tampermonkey Script |
|---------|--------------|---------------------|
| **Installation** | Requires Python + packages | Just install browser extension |
| **Credentials** | Manual or Selenium extraction | Automatic from browser |
| **UI** | Command-line interface | Visual modal interface |
| **Date Selection** | Fills all missing dates | Manual checkbox selection |
| **Time Entropy** | No randomization | ±1-10 minutes automatic |
| **Progress** | Text output | Visual progress bar |
| **Platform** | Any OS with Python | Any browser |

## License

This script is provided as-is for personal use. Use responsibly and in accordance with your company's policies.

## Support

For issues or questions:
1. Check the browser console for error messages (F12)
2. Verify you're using the latest version of the script
3. Try disabling other browser extensions temporarily
4. Check Tampermonkey's dashboard for script conflicts

## Changelog

### Version 1.0.0 (2025-10-30)
- Initial release
- Auto-fill missing attendance entries
- Custom time intervals
- Random time entropy (±1-10 minutes)
- Manual date selection
- Progress tracking and notifications
- Floating button UI
- Configuration modal
