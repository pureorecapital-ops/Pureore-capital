// utils.js – Shared helper functions for Pureore Capital

// Format number as ZMW currency
function formatMoney(amount) {
    let parsed = parseFloat(amount);
    if (isNaN(parsed)) return 'K0.00';
    return 'K' + parsed.toFixed(2);
}

// Format a Firestore timestamp or Date object to local string
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
}

// Validate Zambian mobile phone number 
// Expects exactly 9 digits (without country code). E.g., "966123456"
function validateZambianPhone(phone, network = null) {
    const digits = phone.replace(/\D/g, '');
    // Must be exactly 9 digits (Zambian local number)
    if (digits.length !== 9) return false;
    if (!network) return true;
    const prefix = digits.substring(0, 2);
    if (network === 'mtn') return (prefix === '96' || prefix === '76');
    if (network === 'airtel') return (prefix === '97' || prefix === '77' || prefix === '57');
    if (network === 'zamtel') return (prefix === '95' || prefix === '75');
    return true;
}

// Show temporary toast message
function showToast(message, isError = false) {
    // Remove existing toast if any
    const oldToast = document.querySelector('.custom-toast');
    if (oldToast) oldToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.innerText = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = isError ? '#ef4444' : '#2ecc71';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '40px';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = '9999';
    toast.style.fontSize = '0.9rem';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    toast.style.maxWidth = '90%';
    toast.style.whiteSpace = 'normal';   // was duplicated, now fixed
    toast.style.textAlign = 'center';
    document.body.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 4000);
}

// Simple rate limiter with automatic cleanup of old entries
const rateLimitStore = new Map();
function checkRateLimit(key, limit = 5, windowMs = 60000) {
    const now = Date.now();
    let records = rateLimitStore.get(key) || [];
    // Remove entries older than windowMs
    records = records.filter(time => now - time < windowMs);
    if (records.length >= limit) return false;
    records.push(now);
    rateLimitStore.set(key, records);
    return true;
}
// Optional: periodically clean the entire map (every hour)
setInterval(() => {
    const now = Date.now();
    for (const [key, times] of rateLimitStore.entries()) {
        const filtered = times.filter(t => now - t < 60000); // keep last 60 seconds
        if (filtered.length === 0) rateLimitStore.delete(key);
        else rateLimitStore.set(key, filtered);
    }
}, 3600000); // every hour

// Sanitize user input (remove potential HTML tags)
function sanitizeInput(str) {
    if (!str) return '';
    return str.replace(/[<>]/g, '').trim();
}

// Validate email format (simple but effective)
function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Extract numbers from a string (e.g., from SMS)
function extractNumbers(str) {
    const matches = str.match(/\d+(?:\.\d+)?/g);
    return matches ? matches.map(Number) : [];
}

// Simple firework effect using canvas (with proper resize handling)
let fireworksAnimationId = null;
function showFireworks(duration = 2000) {
    const canvas = document.getElementById('fireworks');
    if (!canvas) return;
    
    // Stop any existing fireworks animation
    if (fireworksAnimationId) {
        cancelAnimationFrame(fireworksAnimationId);
        fireworksAnimationId = null;
    }
    
    canvas.classList.remove('hidden');
    const ctx = canvas.getContext('2d');
    
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    let particles = [];
    const particleCount = 100;
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5 - 2,
            life: 1,
            color: `hsl(${Math.random() * 360}, 100%, 60%)`
        });
    }
    
    let startTime = performance.now();
    function animate(now) {
        const elapsed = now - startTime;
        if (elapsed >= duration) {
            // Time's up – clear canvas and hide
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.classList.add('hidden');
            window.removeEventListener('resize', resizeCanvas);
            fireworksAnimationId = null;
            return;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let anyAlive = false;
        for (let p of particles) {
            if (p.life <= 0) continue;
            anyAlive = true;
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02; // fade out
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 4, 4);
        }
        if (anyAlive) {
            fireworksAnimationId = requestAnimationFrame(animate);
        } else {
            // All particles dead
            canvas.classList.add('hidden');
            window.removeEventListener('resize', resizeCanvas);
            fireworksAnimationId = null;
        }
    }
    fireworksAnimationId = requestAnimationFrame(animate);
    
    // Fallback: ensure canvas is hidden after duration + 1s
    setTimeout(() => {
        if (fireworksAnimationId) {
            cancelAnimationFrame(fireworksAnimationId);
            fireworksAnimationId = null;
        }
        canvas.classList.add('hidden');
        window.removeEventListener('resize', resizeCanvas);
    }, duration + 1000);
}

// ========== BUSINESS DAY HELPERS (weekday calculations) ==========
// Check if a date is weekend (Saturday or Sunday)
function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
}

// Add a number of weekdays to a start date (skipping weekends)
function addWeekdays(startDate, days) {
    let result = new Date(startDate);
    let added = 0;
    while (added < days) {
        result.setDate(result.getDate() + 1);
        if (!isWeekend(result)) added++;
    }
    return result;
}

// Calculate number of weekdays (business days) between two dates (inclusive)
function businessDaysBetween(startDate, endDate) {
    let count = 0;
    let current = new Date(startDate);
    while (current <= endDate) {
        if (!isWeekend(current)) count++;
        current.setDate(current.getDate() + 1);
    }
    return count;
}

// ========== EXPOSE FUNCTIONS GLOBALLY (for browser) ==========
// Attach all public functions to window so they can be called from HTML event handlers
if (typeof window !== 'undefined') {
    window.formatMoney = formatMoney;
    window.formatDate = formatDate;
    window.validateZambianPhone = validateZambianPhone;
    window.showToast = showToast;
    window.checkRateLimit = checkRateLimit;
    window.sanitizeInput = sanitizeInput;
    window.isValidEmail = isValidEmail;
    window.extractNumbers = extractNumbers;
    window.showFireworks = showFireworks;
    window.isWeekend = isWeekend;
    window.addWeekdays = addWeekdays;
    window.businessDaysBetween = businessDaysBetween;
}