// ==UserScript==
// @name         Kenjo Attendance Auto-Fill
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Automatically fill missing Kenjo attendance entries with customizable time intervals and random entropy
// @author       Your Name
// @match        https://app.kenjo.io/*
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @connect      api.kenjo.io
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ===========================
    // CONFIGURATION
    // ===========================
    const CONFIG = {
        API_URLS: {
            EXPECTED_HOURS: 'https://api.kenjo.io/controller/user-attendance/attendance-summary/expected-hours/',
            ATTENDANCE_FIND: 'https://api.kenjo.io/user-attendance-db/find',
            ATTENDANCE_CREATE: 'https://api.kenjo.io/user-attendance-db'
        },
        DEFAULT_INTERVALS: [
            { start: '09:00', end: '14:00' },
            { start: '15:00', end: '18:00' }
        ],
        ENTROPY_RANGE: { min: 1, max: 10 }, // Random minutes to add/subtract
        RETRY_DELAY: 1000, // ms between API calls
        BUTTON_POSITION: { bottom: '20px', right: '20px' }
    };

    // ===========================
    // UTILITY FUNCTIONS
    // ===========================

    // Global variables to cache credentials captured from network requests
    let cachedBearerToken = null;
    let cachedUserId = null;

    /**
     * Extract bearer token from localStorage, sessionStorage, cookies, or cached network requests
     */
    function getBearerToken() {
        try {
            // First, check if we've already captured it from network requests
            if (cachedBearerToken) {
                console.log('✅ Using cached bearer token from network request');
                return cachedBearerToken;
            }

            // Try localStorage - common keys
            const localStorageKeys = [
                'token', 'accessToken', 'authToken', 'bearerToken',
                'access_token', 'auth_token', 'bearer_token',
                'jwt', 'jwtToken', 'jwt_token', 'idToken', 'id_token'
            ];

            for (const key of localStorageKeys) {
                const value = localStorage.getItem(key);
                if (value && value.length > 20) {
                    console.log(`✅ Found token in localStorage.${key}`);
                    return value;
                }
            }

            // Try sessionStorage
            for (const key of localStorageKeys) {
                const value = sessionStorage.getItem(key);
                if (value && value.length > 20) {
                    console.log(`✅ Found token in sessionStorage.${key}`);
                    return value;
                }
            }

            // Try to extract from any stored JSON objects in localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                try {
                    const parsed = JSON.parse(value);
                    if (typeof parsed === 'object' && parsed !== null) {
                        // Check for token in nested objects
                        for (const subKey of localStorageKeys) {
                            if (parsed[subKey] && typeof parsed[subKey] === 'string' && parsed[subKey].length > 20) {
                                console.log(`✅ Found token in localStorage.${key}.${subKey}`);
                                return parsed[subKey];
                            }
                        }

                        // Check deeper nesting (e.g., data.token, user.token)
                        if (parsed.data && typeof parsed.data === 'object') {
                            for (const subKey of localStorageKeys) {
                                if (parsed.data[subKey]) {
                                    console.log(`✅ Found token in localStorage.${key}.data.${subKey}`);
                                    return parsed.data[subKey];
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Not JSON, continue
                }
            }

            // Try to extract from sessionStorage JSON objects
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                const value = sessionStorage.getItem(key);
                try {
                    const parsed = JSON.parse(value);
                    if (typeof parsed === 'object' && parsed !== null) {
                        for (const subKey of localStorageKeys) {
                            if (parsed[subKey] && typeof parsed[subKey] === 'string' && parsed[subKey].length > 20) {
                                console.log(`✅ Found token in sessionStorage.${key}.${subKey}`);
                                return parsed[subKey];
                            }
                        }
                    }
                } catch (e) {
                    // Not JSON, continue
                }
            }

            // Try cookies
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                const nameLower = name.toLowerCase();
                if ((nameLower.includes('token') || nameLower.includes('auth')) && value && value.length > 20) {
                    console.log(`✅ Found token in cookie: ${name}`);
                    return decodeURIComponent(value);
                }
            }

            console.warn('⚠️ Bearer token not found in storage. Waiting for network request...');
            return null;
        } catch (e) {
            console.error('❌ Error extracting bearer token:', e);
            return null;
        }
    }

    /**
     * Extract user ID from localStorage, sessionStorage, or cached network requests
     */
    function getUserId() {
        try {
            // First, check if we've already captured it from network requests
            if (cachedUserId) {
                console.log('✅ Using cached user ID from network request');
                return cachedUserId;
            }

            // Try localStorage - common keys
            const userIdKeys = [
                'userId', 'user_id', 'userid', 'uid', 'id',
                '_id', 'user', 'currentUserId', 'current_user_id'
            ];

            for (const key of userIdKeys) {
                const value = localStorage.getItem(key);
                if (value && value.length > 5 && value.length < 100) {
                    // User IDs are typically 20-30 characters
                    console.log(`✅ Found user ID in localStorage.${key}`);
                    return value;
                }
            }

            // Try sessionStorage
            for (const key of userIdKeys) {
                const value = sessionStorage.getItem(key);
                if (value && value.length > 5 && value.length < 100) {
                    console.log(`✅ Found user ID in sessionStorage.${key}`);
                    return value;
                }
            }

            // Try to extract from stored JSON objects
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                try {
                    const parsed = JSON.parse(value);
                    if (typeof parsed === 'object' && parsed !== null) {
                        // Check for user ID in nested objects
                        for (const subKey of userIdKeys) {
                            if (parsed[subKey] && typeof parsed[subKey] === 'string') {
                                console.log(`✅ Found user ID in localStorage.${key}.${subKey}`);
                                return parsed[subKey];
                            }
                        }

                        // Check for user object
                        if (parsed.user && typeof parsed.user === 'object') {
                            for (const subKey of userIdKeys) {
                                if (parsed.user[subKey]) {
                                    console.log(`✅ Found user ID in localStorage.${key}.user.${subKey}`);
                                    return parsed.user[subKey];
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Not JSON, continue
                }
            }

            // Try sessionStorage JSON objects
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                const value = sessionStorage.getItem(key);
                try {
                    const parsed = JSON.parse(value);
                    if (typeof parsed === 'object' && parsed !== null) {
                        for (const subKey of userIdKeys) {
                            if (parsed[subKey] && typeof parsed[subKey] === 'string') {
                                console.log(`✅ Found user ID in sessionStorage.${key}.${subKey}`);
                                return parsed[subKey];
                            }
                        }
                    }
                } catch (e) {
                    // Not JSON, continue
                }
            }

            console.warn('⚠️ User ID not found in storage. Waiting for network request...');
            return null;
        } catch (e) {
            console.error('❌ Error extracting user ID:', e);
            return null;
        }
    }

    /**
     * Intercept network requests to capture credentials
     */
    function interceptNetworkRequests() {
        // Intercept fetch
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const [url, options] = args;

            // Capture Authorization header from outgoing requests
            if (options && options.headers) {
                const headers = options.headers;
                let authHeader = null;

                if (headers instanceof Headers) {
                    authHeader = headers.get('authorization') || headers.get('Authorization');
                } else if (typeof headers === 'object') {
                    authHeader = headers.authorization || headers.Authorization;
                }

                if (authHeader && authHeader.startsWith('Bearer ')) {
                    const token = authHeader.replace('Bearer ', '');
                    if (!cachedBearerToken) {
                        cachedBearerToken = token;
                        console.log('✅ Captured bearer token from fetch request');
                    }
                }
            }

            // Capture user ID from request body
            if (options && options.body) {
                try {
                    const body = JSON.parse(options.body);
                    if (body._userId && !cachedUserId) {
                        cachedUserId = body._userId;
                        console.log('✅ Captured user ID from fetch request body');
                    } else if (body.userId && !cachedUserId) {
                        cachedUserId = body.userId;
                        console.log('✅ Captured user ID from fetch request body');
                    }
                } catch (e) {
                    // Not JSON or couldn't parse
                }
            }

            // Capture user ID from URL patterns
            if (typeof url === 'string' && url.includes('/user')) {
                const matches = url.match(/\/([a-f0-9]{24})\//i); // MongoDB ObjectId pattern
                if (matches && matches[1] && !cachedUserId) {
                    cachedUserId = matches[1];
                    console.log('✅ Captured user ID from fetch URL');
                }
            }

            return originalFetch.apply(this, args);
        };

        // Intercept XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(...args) {
            this._url = args[1];
            return originalOpen.apply(this, args);
        };

        XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
            if (header.toLowerCase() === 'authorization' && value.startsWith('Bearer ')) {
                const token = value.replace('Bearer ', '');
                if (!cachedBearerToken) {
                    cachedBearerToken = token;
                    console.log('✅ Captured bearer token from XHR request');
                }
            }
            return originalSetRequestHeader.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function(body) {
            // Try to capture user ID from request body
            if (body) {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed._userId && !cachedUserId) {
                        cachedUserId = parsed._userId;
                        console.log('✅ Captured user ID from XHR request body');
                    } else if (parsed.userId && !cachedUserId) {
                        cachedUserId = parsed.userId;
                        console.log('✅ Captured user ID from XHR request body');
                    }
                } catch (e) {
                    // Not JSON
                }
            }

            return originalSend.apply(this, arguments);
        };

        console.log('🔍 Network request interceptor active');
    }

    /**
     * Convert time string (HH:MM) to minutes from midnight, with optional random entropy
     */
    function timeToMinutes(timeStr, addEntropy = false) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        let totalMinutes = hours * 60 + minutes;

        if (addEntropy) {
            const { min, max } = CONFIG.ENTROPY_RANGE;
            const entropy = Math.floor(Math.random() * (max - min + 1)) + min;
            const sign = Math.random() > 0.5 ? 1 : -1;
            totalMinutes += sign * entropy;
        }

        return totalMinutes;
    }

    /**
     * Parse time intervals from configuration
     */
    function parseTimeIntervals(intervals) {
        return intervals.map(interval => ({
            start: timeToMinutes(interval.start, true),  // Add entropy to start
            end: timeToMinutes(interval.end, true)       // Add entropy to end
        }));
    }

    /**
     * Get common headers for API requests
     */
    function getCommonHeaders(bearerToken) {
        return {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9',
            'authorization': `Bearer ${bearerToken}`,
            'content-type': 'application/json',
            'origin': 'https://app.kenjo.io',
            'referer': 'https://app.kenjo.io/',
            'user-agent': navigator.userAgent
        };
    }

    // ===========================
    // API FUNCTIONS
    // ===========================

    /**
     * Fetch expected hours for a given month
     */
    function getExpectedHours(bearerToken, userId, month, year) {
        return new Promise((resolve, reject) => {
            const url = `${CONFIG.API_URLS.EXPECTED_HOURS}${userId}/${month - 1}/${year}/true`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: getCommonHeaders(bearerToken),
                onload: function(response) {
                    if (response.status === 200) {
                        try {
                            const data = JSON.parse(response.responseText);
                            resolve(data);
                        } catch (e) {
                            reject(new Error('Failed to parse response'));
                        }
                    } else {
                        reject(new Error(`API returned status ${response.status}`));
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Fetch existing attendance records for a given month
     */
    function getAttendanceRecords(bearerToken, userId, month, year) {
        return new Promise((resolve, reject) => {
            const daysInMonth = new Date(year, month, 0).getDate();
            const startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`;
            const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}T23:59:59.999Z`;

            const payload = {
                "_userId": userId,
                "date": {
                    "$gte": startDate,
                    "$lte": endDate
                },
                "_deleted": false
            };

            GM_xmlhttpRequest({
                method: 'POST',
                url: CONFIG.API_URLS.ATTENDANCE_FIND,
                headers: getCommonHeaders(bearerToken),
                data: JSON.stringify(payload),
                onload: function(response) {
                    if (response.status === 200) {
                        try {
                            const data = JSON.parse(response.responseText);
                            resolve(data);
                        } catch (e) {
                            reject(new Error('Failed to parse response'));
                        }
                    } else {
                        reject(new Error(`API returned status ${response.status}`));
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Create a new attendance entry
     */
    function createAttendanceEntry(bearerToken, userId, dateStr, startTime, endTime) {
        return new Promise((resolve, reject) => {
            const payload = {
                "_userId": userId,
                "ownerId": userId,
                "date": dateStr,
                "startTime": startTime,
                "endTime": endTime,
                "breaks": [],
                "_changesTracking": [],
                "_deleted": false,
                "_approved": false,
                "interface": "attendance-tab"
            };

            GM_xmlhttpRequest({
                method: 'POST',
                url: CONFIG.API_URLS.ATTENDANCE_CREATE,
                headers: getCommonHeaders(bearerToken),
                data: JSON.stringify(payload),
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(true);
                    } else {
                        reject(new Error(`API returned status ${response.status}: ${response.responseText}`));
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // ===========================
    // UI FUNCTIONS
    // ===========================

    /**
     * Show notification
     */
    function showNotification(title, message, type = 'info') {
        const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';

        // Try GM_notification first
        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                title: `${icon} ${title}`,
                text: message,
                timeout: 3000
            });
        } else {
            // Fallback to custom notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                z-index: 10001;
                max-width: 300px;
                animation: slideIn 0.3s ease-out;
            `;
            notification.innerHTML = `<strong>${icon} ${title}</strong><br>${message}`;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    }

    /**
     * Create and inject the main button
     */
    function createMainButton() {
        const button = document.createElement('button');
        button.id = 'kenjo-autofill-btn';
        button.innerHTML = '📅 Auto-Fill';
        button.style.cssText = `
            position: fixed;
            bottom: ${CONFIG.BUTTON_POSITION.bottom};
            right: ${CONFIG.BUTTON_POSITION.right};
            background: #4CAF50;
            color: white;
            border: none;
            padding: 12px 20px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 25px;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            z-index: 10000;
            transition: all 0.3s ease;
        `;

        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.05)';
            button.style.boxShadow = '0 6px 8px rgba(0,0,0,0.4)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
        });

        button.addEventListener('click', openConfigModal);

        document.body.appendChild(button);
    }

    /**
     * Create configuration modal
     */
    function createConfigModal() {
        const modal = document.createElement('div');
        modal.id = 'kenjo-config-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10001;
            justify-content: center;
            align-items: center;
        `;

        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
                <h2 style="margin-top: 0; color: #333;">Kenjo Auto-Fill Configuration</h2>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Month:</label>
                    <input type="number" id="kenjo-month" min="1" max="12" value="${currentMonth}"
                           style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Year:</label>
                    <input type="number" id="kenjo-year" min="2020" max="2030" value="${currentYear}"
                           style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Time Intervals:</label>
                    <div id="kenjo-intervals-container">
                        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                            <input type="text" class="kenjo-interval-start" value="09:00" placeholder="HH:MM"
                                   style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            <span style="padding: 8px;">-</span>
                            <input type="text" class="kenjo-interval-end" value="14:00" placeholder="HH:MM"
                                   style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                            <input type="text" class="kenjo-interval-start" value="15:00" placeholder="HH:MM"
                                   style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            <span style="padding: 8px;">-</span>
                            <input type="text" class="kenjo-interval-end" value="18:00" placeholder="HH:MM"
                                   style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                    </div>
                    <small style="color: #666;">Random entropy of ±1-10 minutes will be applied</small>
                </div>

                <div id="kenjo-missing-dates" style="margin-bottom: 20px; display: none;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Missing Dates:</label>
                    <div id="kenjo-dates-list" style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 4px;">
                    </div>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button id="kenjo-scan-btn" style="flex: 1; padding: 10px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        Scan Missing Dates
                    </button>
                    <button id="kenjo-fill-btn" style="flex: 1; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; display: none;">
                        Fill Selected Dates
                    </button>
                    <button id="kenjo-close-btn" style="padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        Close
                    </button>
                </div>

                <div id="kenjo-progress" style="margin-top: 20px; display: none;">
                    <div style="background: #f0f0f0; border-radius: 10px; overflow: hidden; height: 20px;">
                        <div id="kenjo-progress-bar" style="background: #4CAF50; height: 100%; width: 0%; transition: width 0.3s;"></div>
                    </div>
                    <div id="kenjo-progress-text" style="text-align: center; margin-top: 5px; font-size: 12px; color: #666;"></div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('kenjo-scan-btn').addEventListener('click', scanMissingDates);
        document.getElementById('kenjo-fill-btn').addEventListener('click', fillMissingDates);
        document.getElementById('kenjo-close-btn').addEventListener('click', closeConfigModal);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeConfigModal();
        });
    }

    /**
     * Open configuration modal
     */
    function openConfigModal() {
        const modal = document.getElementById('kenjo-config-modal');
        if (!modal) {
            createConfigModal();
        }
        document.getElementById('kenjo-config-modal').style.display = 'flex';
    }

    /**
     * Close configuration modal
     */
    function closeConfigModal() {
        document.getElementById('kenjo-config-modal').style.display = 'none';
        // Reset modal state
        document.getElementById('kenjo-missing-dates').style.display = 'none';
        document.getElementById('kenjo-fill-btn').style.display = 'none';
        document.getElementById('kenjo-progress').style.display = 'none';
    }

    // ===========================
    // CORE LOGIC
    // ===========================

    let missingDatesCache = [];

    /**
     * Scan for missing dates
     */
    async function scanMissingDates() {
        const bearerToken = getBearerToken();
        const userId = getUserId();

        if (!bearerToken || !userId) {
            showNotification('Error', 'Could not extract credentials from browser', 'error');
            return;
        }

        const month = parseInt(document.getElementById('kenjo-month').value);
        const year = parseInt(document.getElementById('kenjo-year').value);

        if (month < 1 || month > 12) {
            showNotification('Error', 'Invalid month value', 'error');
            return;
        }

        const scanBtn = document.getElementById('kenjo-scan-btn');
        scanBtn.disabled = true;
        scanBtn.textContent = 'Scanning...';

        try {
            // Fetch expected hours
            const expectedData = await getExpectedHours(bearerToken, userId, month, year);

            // Extract dates with expected hours > 0
            const expectedDates = [];
            for (const [dayNum, dayData] of Object.entries(expectedData.expectedHoursByDay)) {
                if (dayData.expectedTime > 0) {
                    const day = parseInt(dayNum);
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;
                    expectedDates.push(dateStr);
                }
            }

            // Fetch existing attendance records
            const attendanceRecords = await getAttendanceRecords(bearerToken, userId, month, year);
            const existingDates = new Set(
                attendanceRecords.map(record => record.date).filter(Boolean)
            );

            // Find missing dates (only past dates)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            missingDatesCache = expectedDates.filter(dateStr => {
                const dateObj = new Date(dateStr);
                return !existingDates.has(dateStr) && dateObj < today;
            }).sort();

            // Display results
            const missingDatesDiv = document.getElementById('kenjo-missing-dates');
            const datesListDiv = document.getElementById('kenjo-dates-list');

            if (missingDatesCache.length === 0) {
                datesListDiv.innerHTML = '<p style="color: #4CAF50; margin: 0;">✓ No missing dates found!</p>';
                missingDatesDiv.style.display = 'block';
                document.getElementById('kenjo-fill-btn').style.display = 'none';
            } else {
                datesListDiv.innerHTML = missingDatesCache.map(dateStr => {
                    const date = new Date(dateStr);
                    const formatted = date.toISOString().split('T')[0];
                    return `
                        <label style="display: block; padding: 5px; cursor: pointer; border-bottom: 1px solid #eee;">
                            <input type="checkbox" class="kenjo-date-checkbox" value="${dateStr}" checked style="margin-right: 10px;">
                            ${formatted}
                        </label>
                    `;
                }).join('');

                missingDatesDiv.style.display = 'block';
                document.getElementById('kenjo-fill-btn').style.display = 'block';
            }

            showNotification('Scan Complete', `Found ${missingDatesCache.length} missing date(s)`, 'success');

        } catch (error) {
            console.error('Error scanning dates:', error);
            showNotification('Error', `Failed to scan: ${error.message}`, 'error');
        } finally {
            scanBtn.disabled = false;
            scanBtn.textContent = 'Scan Missing Dates';
        }
    }

    /**
     * Fill missing dates
     */
    async function fillMissingDates() {
        const bearerToken = getBearerToken();
        const userId = getUserId();

        if (!bearerToken || !userId) {
            showNotification('Error', 'Could not extract credentials from browser', 'error');
            return;
        }

        // Get selected dates
        const checkboxes = document.querySelectorAll('.kenjo-date-checkbox:checked');
        const selectedDates = Array.from(checkboxes).map(cb => cb.value);

        if (selectedDates.length === 0) {
            showNotification('Error', 'No dates selected', 'error');
            return;
        }

        // Parse time intervals
        const intervalStarts = document.querySelectorAll('.kenjo-interval-start');
        const intervalEnds = document.querySelectorAll('.kenjo-interval-end');

        const intervals = [];
        for (let i = 0; i < intervalStarts.length; i++) {
            const start = intervalStarts[i].value.trim();
            const end = intervalEnds[i].value.trim();
            if (start && end) {
                intervals.push({ start, end });
            }
        }

        if (intervals.length === 0) {
            showNotification('Error', 'No valid time intervals defined', 'error');
            return;
        }

        // Disable button and show progress
        const fillBtn = document.getElementById('kenjo-fill-btn');
        fillBtn.disabled = true;
        fillBtn.textContent = 'Filling...';

        const progressDiv = document.getElementById('kenjo-progress');
        const progressBar = document.getElementById('kenjo-progress-bar');
        const progressText = document.getElementById('kenjo-progress-text');
        progressDiv.style.display = 'block';

        let completed = 0;
        let failed = 0;
        const totalOperations = selectedDates.length * intervals.length;

        try {
            for (const dateStr of selectedDates) {
                for (const interval of intervals) {
                    const parsedIntervals = parseTimeIntervals([interval]);
                    const { start, end } = parsedIntervals[0];

                    try {
                        await createAttendanceEntry(bearerToken, userId, dateStr, start, end);
                        completed++;

                        const progress = ((completed + failed) / totalOperations) * 100;
                        progressBar.style.width = `${progress}%`;
                        progressText.textContent = `${completed} successful, ${failed} failed (${Math.round(progress)}%)`;

                        // Delay between requests to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
                    } catch (error) {
                        console.error(`Failed to create entry for ${dateStr}:`, error);
                        failed++;

                        const progress = ((completed + failed) / totalOperations) * 100;
                        progressBar.style.width = `${progress}%`;
                        progressText.textContent = `${completed} successful, ${failed} failed (${Math.round(progress)}%)`;
                    }
                }
            }

            showNotification(
                'Fill Complete',
                `Successfully created ${completed} entries. ${failed > 0 ? `${failed} failed.` : ''}`,
                failed === 0 ? 'success' : 'info'
            );

            // Reset after a delay
            setTimeout(() => {
                closeConfigModal();
            }, 2000);

        } catch (error) {
            console.error('Error filling dates:', error);
            showNotification('Error', `Failed to fill: ${error.message}`, 'error');
        } finally {
            fillBtn.disabled = false;
            fillBtn.textContent = 'Fill Selected Dates';
        }
    }

    // ===========================
    // INITIALIZATION
    // ===========================

    /**
     * Initialize the script when page is ready
     */
    function init() {
        // Wait for page to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // Check if we're on a Kenjo page
        if (window.location.hostname !== 'app.kenjo.io') {
            return;
        }

        // Start network request interception immediately
        interceptNetworkRequests();

        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        // Create main button
        createMainButton();

        console.log('✅ Kenjo Auto-Fill script loaded successfully');
        console.log('💡 TIP: Navigate around Kenjo (especially attendance page) to capture credentials automatically');
        console.log('   Or click the button and credentials will be captured when you scan for dates');
    }

    // Start initialization
    init();

})();
