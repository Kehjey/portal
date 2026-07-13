const triggerZone = document.getElementById('audio-trigger-zone');
const textSpans = triggerZone.querySelectorAll('.read-aloud');

let hasBeenRead = false;
let isPlaying = false;
let currentAudio = null; // Holds the audio file currently playing
let currentIndex = 0;    // Tracks which sentence we are on

// Function to play the audio files in a sequence
const playSequence = (startIndex) => {
    // 1. If an audio file is currently playing, stop it instantly
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    isPlaying = true;
    currentIndex = startIndex;

    // Start the recursive playback loop
    playNextInQueue();
};

const playNextInQueue = () => {
    // 2. Check if we reached the end of the sentences
    if (currentIndex >= textSpans.length) {
        isPlaying = false; // Turn off the active state
        return;
    }

    // 3. Grab the correct .mp3 file name from the HTML data-audio attribute
    const audioSrc = textSpans[currentIndex].getAttribute('data-audio');

    // 4. Create and play the audio object
    currentAudio = new Audio(audioSrc);
    currentAudio.play();

    // 5. When this specific audio file finishes playing, automatically move to the next one
    currentAudio.addEventListener('ended', () => {
        currentIndex++;
        playNextInQueue();
    });
};

// Handle hovering over individual sentences
textSpans.forEach((span, index) => {
    span.addEventListener('mouseenter', () => {

        // Case 1: First interaction
        if (!hasBeenRead) {
            hasBeenRead = true;
            playSequence(0);
        }
        // Case 2: Audio is actively playing, user skips to a new line
        else if (isPlaying) {
            playSequence(index);
        }

    });
});

// Handle clicking anywhere in the text zone
triggerZone.addEventListener('click', () => {
    // Force restart from the beginning
    hasBeenRead = true;
    playSequence(0);
});

document.querySelectorAll('[data-speech]').forEach((element) => {
    element.addEventListener('click', () => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(element.dataset.speech));
    });
});

/* --- Student Login Page Transition --- */
const studentLoginLink = document.getElementById('student-login-link');
const studentLoginForm = document.getElementById('student-login-form');
const loginFormFields = document.getElementById('login-form-fields');
const loginSuccess = document.getElementById('login-success');
const loginError = document.getElementById('login-error');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const studentNameEl = document.getElementById('student-name');
const studentLogoutBtn = document.getElementById('student-logout-btn');

const jumpToPageTop = () => {
    const previousScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    document.documentElement.style.scrollBehavior = previousScrollBehavior;
};

const syncStudentView = () => {
    const isStudentLogin = window.location.hash === '#student-login';
    if (isStudentLogin) {
        jumpToPageTop();
    }
    document.body.classList.toggle('student-view', isStudentLogin);
};

studentLoginLink.addEventListener('click', () => {
    jumpToPageTop();
    history.pushState(null, '', '#student-login');
    syncStudentView();
});

window.addEventListener('hashchange', syncStudentView);
window.addEventListener('popstate', syncStudentView);
syncStudentView();

const setLoginError = (message = '') => {
    if (!message) {
        loginError.hidden = true;
        loginError.textContent = '';
        return;
    }

    loginError.textContent = message;
    loginError.hidden = false;
};

/* --- Student Space Calendar Logic --- */

const formatTime12Hour = (timeStr) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    if (isNaN(hours)) return timeStr;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
};

const getDefaultEvents = (year, month) => {
    return [];
};

let calendarEventsCache = {};

const loadEventsForMonth = async (studentId, year, month) => {
    const cacheKey = `portal_events_v2_${studentId}_${year}_${month}`;
    const docId = `${year}_${month}`;
    
    if (!isFirebaseConfigured() || !firestoreDb) {
        if (!calendarEventsCache[cacheKey]) {
            const events = localStorage.getItem(cacheKey);
            calendarEventsCache[cacheKey] = events ? JSON.parse(events) : getDefaultEvents(year, month);
        }
        return calendarEventsCache[cacheKey];
    }

    try {
        const docRef = firestoreDb.collection('students').doc(studentId).collection('months').doc(docId);
        const docSnap = await docRef.get();
        
        let events = [];
        if (docSnap.exists) {
            events = docSnap.data().events || [];
        } else {
            const local = localStorage.getItem(cacheKey);
            events = local ? JSON.parse(local) : getDefaultEvents(year, month);
            await docRef.set({
                events: events,
                lastUpdated: new Date().toISOString()
            });
        }
        
        calendarEventsCache[cacheKey] = events;
        localStorage.setItem(cacheKey, JSON.stringify(events));
        return events;
    } catch (error) {
        console.error(`Failed to load events for ${cacheKey} from Firestore:`, error);
        if (!calendarEventsCache[cacheKey]) {
            const events = localStorage.getItem(cacheKey);
            calendarEventsCache[cacheKey] = events ? JSON.parse(events) : getDefaultEvents(year, month);
        }
        return calendarEventsCache[cacheKey];
    }
};

const getEventsForMonth = (studentId, year, month) => {
    const cacheKey = `portal_events_v2_${studentId}_${year}_${month}`;
    if (!calendarEventsCache[cacheKey]) {
        loadEventsForMonth(studentId, year, month).then(() => {
            renderCalendar();
            if (selectedDayForModal && selectedDayForModal.year === year && selectedDayForModal.month === month) {
                const monthEvents = calendarEventsCache[cacheKey] || [];
                const updatedDayEvents = monthEvents.filter(evt => evt.day === selectedDayForModal.day);
                renderModalEventsList(updatedDayEvents);
            }
        });
        const local = localStorage.getItem(cacheKey);
        calendarEventsCache[cacheKey] = local ? JSON.parse(local) : getDefaultEvents(year, month);
    }
    return calendarEventsCache[cacheKey];
};

const saveEventsForMonth = async (studentId, year, month, events) => {
    const cacheKey = `portal_events_v2_${studentId}_${year}_${month}`;
    const docId = `${year}_${month}`;
    
    calendarEventsCache[cacheKey] = events;
    localStorage.setItem(cacheKey, JSON.stringify(events));
    
    if (!isFirebaseConfigured() || !firestoreDb) {
        return;
    }
    
    try {
        await firestoreDb.collection('students').doc(studentId).collection('months').doc(docId).set({
            events: events,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error(`Failed to save events for ${cacheKey} to Firestore:`, error);
    }
};

let currentStudentId = 'STU001';
let currentCalendarDate = new Date();
let selectedDayForModal = null;

const renderCalendar = () => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Update Month and Year Header
    const monthsNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthYearTitle = document.getElementById('calendar-month-year');
    if (monthYearTitle) {
        const nameEl = monthYearTitle.querySelector('.month-name');
        const yearEl = monthYearTitle.querySelector('.year-val');
        if (nameEl) nameEl.textContent = monthsNames[month].toUpperCase();
        if (yearEl) yearEl.textContent = year;
    }

    // Update Dropdown Year Value
    const dropdownYearVal = document.getElementById('dropdown-year-val');
    if (dropdownYearVal) {
        dropdownYearVal.textContent = year;
    }
    
    // Update Dropdown Active Month Highlight
    const monthButtons = document.querySelectorAll('.month-select-btn');
    monthButtons.forEach(btn => {
        const btnMonth = parseInt(btn.getAttribute('data-month'));
        if (btnMonth === month) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    const daysGrid = document.getElementById('calendar-days');
    if (!daysGrid) return;
    daysGrid.innerHTML = '';
    
    const today = new Date();
    
    let startDayIndex = new Date(year, month, 1).getDay();
    startDayIndex = startDayIndex === 0 ? 6 : startDayIndex - 1;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const daysArray = [];
    
    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;
    for (let i = daysInPrevMonth - startDayIndex + 1; i <= daysInPrevMonth; i++) {
        daysArray.push({
            day: i,
            month: prevMonth,
            year: prevMonthYear,
            isOtherMonth: true
        });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
        daysArray.push({
            day: i,
            month: month,
            year: year,
            isOtherMonth: false
        });
    }
    
    const totalCells = daysArray.length;
    const nextMonthPadding = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    
    for (let i = 1; i <= nextMonthPadding; i++) {
        daysArray.push({
            day: i,
            month: nextMonth,
            year: nextMonthYear,
            isOtherMonth: true
        });
    }
    
    const monthEvents = getEventsForMonth(currentStudentId, year, month);
    
    daysArray.forEach(dayObj => {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        if (dayObj.isOtherMonth) {
            cell.classList.add('other-month');
        }
        
        const isToday = dayObj.day === today.getDate() && 
                        dayObj.month === today.getMonth() && 
                        dayObj.year === today.getFullYear();
        if (isToday) {
            cell.classList.add('today');
        }
        
        let cellEvents = [];
        if (dayObj.isOtherMonth) {
            const cellMonthEvents = getEventsForMonth(currentStudentId, dayObj.year, dayObj.month);
            cellEvents = cellMonthEvents.filter(e => e.day === dayObj.day);
        } else {
            cellEvents = monthEvents.filter(e => e.day === dayObj.day);
        }
        
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'day-events';
        
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'event-dots';
        
        cellEvents.forEach(evt => {
            const evtEl = document.createElement('div');
            evtEl.className = `calendar-event ${evt.type || 'lesson'}`;
            if (evt.type === 'task' && evt.completed) {
                evtEl.classList.add('completed');
            }
            evtEl.textContent = `${evt.time && evt.time !== 'All Day' ? evt.time + ' ' : ''}${evt.title}`;
            eventsContainer.appendChild(evtEl);
            
            const dot = document.createElement('span');
            dot.className = `event-dot ${evt.type || 'lesson'}`;
            if (evt.type === 'task' && evt.completed) {
                dot.classList.add('completed');
            }
            dotsContainer.appendChild(dot);
        });
        
        cell.appendChild(eventsContainer);
        cell.appendChild(dotsContainer);

        const numberWrapper = document.createElement('div');
        numberWrapper.className = 'day-number-wrapper';
        const numSpan = document.createElement('span');
        numSpan.className = 'day-number';
        numSpan.textContent = dayObj.day;
        numberWrapper.appendChild(numSpan);
        cell.appendChild(numberWrapper);
        
        cell.addEventListener('click', () => {
            openDayModal(dayObj, cellEvents);
        });
        
        daysGrid.appendChild(cell);
    });
};

const openDayModal = (dayObj, dayEvents) => {
    selectedDayForModal = dayObj;
    
    const daysOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthsNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const dateObj = new Date(dayObj.year, dayObj.month, dayObj.day);
    const dayName = daysOfWeekNames[dateObj.getDay()];
    const monthName = monthsNames[dayObj.month];
    
    const modalDayName = document.getElementById('calendar-modal-day-name');
    const modalDateTitle = document.getElementById('calendar-modal-date-title');
    if (modalDayName) modalDayName.textContent = dayName;
    if (modalDateTitle) modalDateTitle.textContent = `${monthName} ${dayObj.day}, ${dayObj.year}`;
    
    renderModalEventsList(dayEvents);
    
    const addTaskForm = document.getElementById('add-task-form');
    const showAddTaskBtn = document.getElementById('show-add-task-btn');
    if (addTaskForm) addTaskForm.style.display = 'none';
    if (showAddTaskBtn) showAddTaskBtn.style.display = 'block';
    
    const modal = document.getElementById('calendar-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
};

const renderModalEventsList = (dayEvents) => {
    const listContainer = document.getElementById('calendar-modal-events-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    
    if (dayEvents.length === 0) {
        listContainer.innerHTML = '<div class="no-events-text">No sessions or tasks scheduled.</div>';
        return;
    }
    
    dayEvents.forEach(evt => {
        if (evt.type === 'lesson') {
            const item = document.createElement('div');
            item.className = 'modal-event-item';
            item.innerHTML = `
                <div class="event-meta">
                    <span>${evt.time}</span>
                    <span>${evt.duration || '60 mins'}</span>
                </div>
                <div class="event-title">${evt.title}</div>
                ${evt.description ? `<div class="event-desc">${evt.description}</div>` : ''}
                ${evt.boardLink ? `<a href="${evt.boardLink}" target="_blank" class="board-btn">Join Board</a>` : ''}
            `;
            
            const boardBtn = item.querySelector('.board-btn');
            if (boardBtn) {
                boardBtn.addEventListener('click', () => {
                    const clickSound = document.getElementById('click-sound');
                    if (clickSound) {
                        clickSound.currentTime = 0;
                        clickSound.play();
                    }
                });
            }
            
            listContainer.appendChild(item);
        } else {
            const item = document.createElement('div');
            item.className = 'modal-task-item';
            item.innerHTML = `
                <div class="task-checkbox-wrapper">
                    <div class="task-checkbox ${evt.completed ? 'checked' : ''}"></div>
                </div>
                <div class="task-text-content ${evt.completed ? 'completed' : ''}">
                    <span class="task-title">${evt.title}</span>
                    ${evt.time && evt.time !== 'All Day' ? `<span class="task-time">${evt.time}</span>` : ''}
                </div>
                <button type="button" class="task-delete-btn" title="Delete Task">&times;</button>
            `;
            
            const checkbox = item.querySelector('.task-checkbox-wrapper');
            if (checkbox) {
                checkbox.addEventListener('click', () => {
                    const monthEvents = getEventsForMonth(currentStudentId, selectedDayForModal.year, selectedDayForModal.month);
                    const targetEvent = monthEvents.find(e => e.id === evt.id);
                    if (targetEvent) {
                        targetEvent.completed = !targetEvent.completed;
                        saveEventsForMonth(currentStudentId, selectedDayForModal.year, selectedDayForModal.month, monthEvents);
                    }
                    
                    const clickSound = document.getElementById('click-sound');
                    if (clickSound) {
                        clickSound.currentTime = 0;
                        clickSound.play();
                    }
                    
                    const updatedDayEvents = monthEvents.filter(e => e.day === selectedDayForModal.day);
                    renderCalendar();
                    renderModalEventsList(updatedDayEvents);
                });
            }
            
            const deleteBtn = item.querySelector('.task-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const monthEvents = getEventsForMonth(currentStudentId, selectedDayForModal.year, selectedDayForModal.month);
                    const updatedEvents = monthEvents.filter(e => e.id !== evt.id);
                    saveEventsForMonth(currentStudentId, selectedDayForModal.year, selectedDayForModal.month, updatedEvents);
                    
                    const clickSound = document.getElementById('click-sound');
                    if (clickSound) {
                        clickSound.currentTime = 0;
                        clickSound.play();
                    }
                    
                    const updatedDayEvents = updatedEvents.filter(e => e.day === selectedDayForModal.day);
                    renderCalendar();
                    renderModalEventsList(updatedDayEvents);
                });
            }
            
            listContainer.appendChild(item);
        }
    });
};

const showLoggedInState = (name, uid) => {
    studentNameEl.textContent = name;
    loginFormFields.hidden = true;
    loginSuccess.hidden = false;
    setLoginError('');
    document.body.classList.add('student-authenticated');

    currentStudentId = uid || name || 'STU001';

    studentLoginForm.style.display = 'none';
    const studentDashboard = document.getElementById('student-dashboard');
    if (studentDashboard) {
        studentDashboard.style.display = 'flex';
        const dashboardStudentName = document.getElementById('dashboard-student-name');
        if (dashboardStudentName) {
            dashboardStudentName.textContent = name;
        }
    }

    renderCalendar();
};

const showLoggedOutState = () => {
    calendarEventsCache = {};
    loginFormFields.hidden = false;
    loginSuccess.hidden = true;
    studentNameEl.textContent = '';
    studentLoginForm.reset();
    setLoginError('');
    document.body.classList.remove('student-authenticated');

    studentLoginForm.style.display = 'block';
    const studentDashboard = document.getElementById('student-dashboard');
    if (studentDashboard) {
        studentDashboard.style.display = 'none';
    }
    
    const calendarModal = document.getElementById('calendar-modal');
    if (calendarModal) {
        calendarModal.style.display = 'none';
    }
};

const isFirebaseConfigured = () => (
    firebaseConfig
    && firebaseConfig.apiKey
    && firebaseConfig.apiKey !== 'YOUR_API_KEY'
);

let firestoreDb = null;
let firebaseAuth = null;

if (isFirebaseConfigured()) {
    firebase.initializeApp(firebaseConfig);
    firestoreDb = firebase.app().firestore('default');
    firebaseAuth = firebase.auth();
} else {
    console.warn('Firebase is not configured. Copy firebase-config.example.js to firebase-config.js and add your project settings.');
}

studentLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoginError('');

    const studentId = studentLoginForm.studentId.value.trim();
    const password = studentLoginForm.password.value;

    if (!studentId || !password) {
        setLoginError('Enter your Student ID and password.');
        return;
    }

    if (!isFirebaseConfigured() || !firestoreDb || !firebaseAuth) {
        console.warn('Firebase not configured. Entering Offline Demo Mode.');
        showLoggedInState(studentId, studentId);
        return;
    }

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'Verifying...';

    try {
        const email = `${studentId.toLowerCase()}@portal.local`;
        await firebaseAuth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error('Login failed:', error);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            setLoginError('Invalid Student ID or password.');
        } else if (error.code === 'auth/user-disabled') {
            setLoginError('This account is inactive.');
        } else if (error.code === 'auth/unauthorized-domain') {
            setLoginError(`This domain (${window.location.hostname}) is not authorized in Firebase. Please add it to the "Authorized Domains" list in your Firebase Console (Authentication > Settings > Authorized Domains).`);
        } else {
            setLoginError(`Could not sign in: ${error.message || error.code || 'Check your internet connection and try again.'}`);
        }
    } finally {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.textContent = 'Verify';
    }
});

studentLogoutBtn.addEventListener('click', () => {
    if (firebaseAuth) {
        firebaseAuth.signOut();
    } else {
        showLoggedOutState();
    }
});

if (firebaseAuth) {
    firebaseAuth.onAuthStateChanged((user) => {
        if (user) {
            showLoggedInState(user.displayName || user.uid, user.uid);
        } else {
            showLoggedOutState();
        }
    });
}

/* --- Realistic Rope Physics & Dark Mode --- */
const handle = document.getElementById('handle');
const cordPath = document.getElementById('cord-path');

const clickSound = document.getElementById('click-sound');
const pullSound = document.getElementById('pull-sound');

let isDragging = false;
let hasToggled = false;

// Physics properties
let startX = window.innerWidth - 55; // Anchor X (Top right)
let startY = 0;                      // Anchor Y (Ceiling)
let handleX = startX;                // Bulb X
let handleY = 150;                   // Bulb Y
let vx = 0;                          // X velocity
let vy = 0;                          // Y velocity

const restingLength = 150;
const maxStretch = 300;
const toggleThreshold = 220;

// True physics constants
const gravity = 0.8;      // Pulls the bulb down
const stiffness = 0.15;   // How strongly the rope resists stretching
const dampening = 0.88;   // Air resistance / friction

// Keep anchor tied to the top right even if the window is resized
window.addEventListener('resize', () => {
    startX = window.innerWidth - 55;
});

// Main physics loop (runs 60 frames per second)
function updatePhysics() {
    if (!isDragging) {
        // 1. Apply gravity to the bulb
        vy += gravity;

        // 2. Calculate distance between anchor and bulb
        const dx = handleX - startX;
        const dy = handleY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 3. If the bulb falls past the resting length, the rope catches it (Spring tension)
        if (distance > restingLength) {
            const difference = distance - restingLength;
            const force = difference * stiffness;
            const angle = Math.atan2(dy, dx);

            vx -= Math.cos(angle) * force;
            vy -= Math.sin(angle) * force;
        }

        // 4. Apply friction and update position
        vx *= dampening;
        vy *= dampening;
        handleX += vx;
        handleY += vy;
    }

    // --- Draw the SVG Rope (Catenary/Bezier Curve) ---
    const dx = handleX - startX;
    const dy = handleY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Find the midpoint of the rope
    let cx = (startX + handleX) / 2;
    let cy = (startY + handleY) / 2;

    // If the rope is slack (distance is less than resting length), make it droop
    if (distance < restingLength) {
        const slack = restingLength - distance;
        cy += slack * 1.5; // Gravity pulls the slack center downwards
    }

    // Update the SVG path using a Quadratic Bezier Curve (M = Move to, Q = Curve via control point)
    cordPath.setAttribute('d', `M ${startX} ${startY} Q ${cx} ${cy} ${handleX} ${handleY}`);

    // Update the HTML handle position
    handle.style.left = `${handleX}px`;
    handle.style.top = `${handleY}px`;

    requestAnimationFrame(updatePhysics);
}

// Start the loop
updatePhysics();

// --- Mouse Interaction ---

// Variables to track if the user is clicking or pulling
let clickStartX = 0;
let clickStartY = 0;

const getPointerPosition = (e) => {
    if (e.touches && e.touches.length) {
        return {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
        };
    }
    if (e.changedTouches && e.changedTouches.length) {
        return {
            x: e.changedTouches[0].clientX,
            y: e.changedTouches[0].clientY,
        };
    }
    return {
        x: e.clientX,
        y: e.clientY,
    };
};

const beginDrag = (x, y) => {
    isDragging = true;
    hasToggled = false;
    vx = 0;
    vy = 0;
    clickStartX = x;
    clickStartY = y;
};

const updateDrag = (x, y) => {
    let targetX = x;
    let targetY = y;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > maxStretch) {
        const angle = Math.atan2(dy, dx);
        targetX = startX + Math.cos(angle) * maxStretch;
        targetY = startY + Math.sin(angle) * maxStretch;
    }

    if (targetY < 20) targetY = 20;

    handleX = targetX;
    handleY = targetY;

    if (distance > toggleThreshold && !hasToggled) {
        document.body.classList.toggle('dark-mode');
        hasToggled = true;
        pullSound.currentTime = 0;
        pullSound.play();
    }
};

const endDrag = (x, y) => {
    if (isDragging) {
        const moveX = x - clickStartX;
        const moveY = y - clickStartY;
        const dragDistance = Math.sqrt(moveX * moveX + moveY * moveY);

        if (dragDistance < 5) {
            // CHANGE THIS LINE to toggle 'plain-theme'
            document.body.classList.toggle('plain-theme');

            // Play the click sound
            clickSound.currentTime = 0;
            clickSound.play();
        }
    }

    isDragging = false;
};

const globalMoveHandler = (e) => {
    if (!isDragging) return;
    const { x, y } = getPointerPosition(e);
    updateDrag(x, y);
    if (e.cancelable) e.preventDefault();
};

const globalEndHandler = (e) => {
    const { x, y } = getPointerPosition(e);
    endDrag(x, y);
};

if (window.PointerEvent) {
    handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const { x, y } = getPointerPosition(e);
        beginDrag(x, y);
    });

    window.addEventListener('pointermove', globalMoveHandler);
    window.addEventListener('pointerup', globalEndHandler);
} else {
    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const { x, y } = getPointerPosition(e);
        beginDrag(x, y);
    });

    window.addEventListener('mousemove', globalMoveHandler);
    window.addEventListener('mouseup', globalEndHandler);
}
/* --- Modal Popup Logic --- */
const modalOverlay = document.getElementById('modal-overlay');
const openModalBtn = document.getElementById('open-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

// Open Modal
openModalBtn.addEventListener('click', () => {
    modalOverlay.classList.add('active');

    // Optional: Pause rope physics while modal is open to save processing
    isDragging = false;
});

// Close Modal via 'X' button
closeModalBtn.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
});

// Close Modal by clicking the blurred background
modalOverlay.addEventListener('click', (e) => {
    // Ensure we are clicking the overlay itself, not the cloud inside it
    if (e.target === modalOverlay) {
        modalOverlay.classList.remove('active');
    }
});

/* --- Auto-Expanding Textarea --- */
const messageBox = document.querySelector('#booking-form textarea');

messageBox.addEventListener('input', function () {
    // 1. Reset the height so it can shrink if the user deletes text
    this.style.height = 'auto';

    // 2. Set the height to match the exact physical height of the text inside it
    this.style.height = this.scrollHeight + 'px';
});

/* ==========================================
   4. GOOGLE SHEETS SUBMISSION HANDLING
   ========================================== */
const bookingForm = document.getElementById('booking-form');

bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 

    // Convert form data to URL encoded format for Google Apps Script compatibility
    const formData = new URLSearchParams(new FormData(bookingForm));
    
    try {
        // Send data directly to your Google Sheet
        await fetch(bookingForm.action, {
            method: 'POST',
            body: formData,
            mode: 'no-cors' // Bypasses browser CORS redirects smoothly
        });
        
        // Since 'no-cors' hides the server response status, 
        // we execute the success UI as soon as the fetch request fires successfully.
        alert('Thank you! Your session booking has been recorded in my system.');
        
        // UI Clean up
        bookingForm.reset();
        const textarea = bookingForm.querySelector('textarea');
        if (textarea) textarea.style.height = 'auto';
        document.getElementById('modal-overlay').classList.remove('active'); 
        
    } catch (error) {
        alert('Could not connect to the server. Please check your internet connection.');
    }
});

const initCalendar = () => {
    const prevYearBtn = document.getElementById('dropdown-prev-year-btn');
    if (prevYearBtn) {
        prevYearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentCalendarDate.setFullYear(currentCalendarDate.getFullYear() - 1);
            renderCalendar();
            const clickSound = document.getElementById('click-sound');
            if (clickSound) {
                clickSound.currentTime = 0;
                clickSound.play();
            }
        });
    }
    
    const nextYearBtn = document.getElementById('dropdown-next-year-btn');
    if (nextYearBtn) {
        nextYearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentCalendarDate.setFullYear(currentCalendarDate.getFullYear() + 1);
            renderCalendar();
            const clickSound = document.getElementById('click-sound');
            if (clickSound) {
                clickSound.currentTime = 0;
                clickSound.play();
            }
        });
    }
    
    const monthsGrid = document.getElementById('dropdown-months-grid');
    if (monthsGrid) {
        monthsGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.month-select-btn');
            if (btn) {
                const selectedMonth = parseInt(btn.getAttribute('data-month'));
                currentCalendarDate.setMonth(selectedMonth);
                renderCalendar();
                
                const clickSound = document.getElementById('click-sound');
                if (clickSound) {
                    clickSound.currentTime = 0;
                    clickSound.play();
                }
            }
        });
    }
    
    const closeBtn = document.getElementById('close-calendar-modal-btn');
    const modal = document.getElementById('calendar-modal');
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    const showAddTaskBtn = document.getElementById('show-add-task-btn');
    const addTaskForm = document.getElementById('add-task-form');
    if (showAddTaskBtn && addTaskForm) {
        showAddTaskBtn.addEventListener('click', () => {
            showAddTaskBtn.style.display = 'none';
            addTaskForm.style.display = 'flex';
            const titleInput = document.getElementById('task-title');
            if (titleInput) titleInput.focus();
        });
    }
    
    const timeInput = document.getElementById('task-time');
    if (timeInput) {
        timeInput.addEventListener('click', () => {
            try {
                if (typeof timeInput.showPicker === 'function') {
                    timeInput.showPicker();
                }
            } catch (err) {
                console.log('Native time picker show fell back', err);
            }
        });
    }
    
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const titleInput = document.getElementById('task-title');
            const timeInput = document.getElementById('task-time');
            
            const title = titleInput.value.trim();
            const time = timeInput.value.trim();
            const formattedTime = formatTime12Hour(time);
            
            if (!title || !selectedDayForModal) return;
            
            const monthEvents = getEventsForMonth(currentStudentId, selectedDayForModal.year, selectedDayForModal.month);
            
            const newTask = {
                id: `evt-task-${Date.now()}`,
                day: selectedDayForModal.day,
                title: title,
                time: formattedTime || 'All Day',
                description: '',
                type: 'task',
                completed: false
            };
            
            monthEvents.push(newTask);
            saveEventsForMonth(currentStudentId, selectedDayForModal.year, selectedDayForModal.month, monthEvents);
            
            const clickSound = document.getElementById('click-sound');
            if (clickSound) {
                clickSound.currentTime = 0;
                clickSound.play();
            }
            
            titleInput.value = '';
            timeInput.value = '';
            addTaskForm.style.display = 'none';
            showAddTaskBtn.style.display = 'block';
            
            const updatedDayEvents = monthEvents.filter(evt => evt.day === selectedDayForModal.day);
            renderCalendar();
            renderModalEventsList(updatedDayEvents);
        });
    }
    
    const dashboardLogoutBtn = document.getElementById('dashboard-logout-btn');
    if (dashboardLogoutBtn) {
        dashboardLogoutBtn.addEventListener('click', () => {
            if (firebaseAuth) {
                firebaseAuth.signOut();
            } else {
                showLoggedOutState();
            }
        });
    }
};

initCalendar();
