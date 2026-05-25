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

/* Replace your old form submission logic with this AJAX handler */
const bookingForm = document.getElementById('booking-form');

bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Stop page reload

    const formData = new FormData(bookingForm);

    // Send data to Formspree in the background
    const response = await fetch(bookingForm.action, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
        alert('Thank you! Your session booking has been recorded.');
        bookingForm.reset();
        document.getElementById('modal-overlay').classList.remove('active'); // Close modal
    } else {
        alert('Oops! There was a problem submitting your form.');
    }
});