// utils.js – Shared helper functions for Pureore Capital

// Format number as ZMW currency
function formatMoney(amount) {
    return 'K' + parseFloat(amount).toFixed(2);
}

// Format a Firestore timestamp or Date object to local string
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
}

// Validate Zambian mobile phone number (9 digits after +260)
function validateZambianPhone(phone, network = null) {
    const digits = phone.replace(/\D/g, '');
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
    toast.style.whiteSpace = 'nowrap';
    toast.style.maxWidth = '90%';
    toast.style.whiteSpace = 'normal';
    toast.style.textAlign = 'center';
    document.body.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 4000);
}

// Simple rate limiter (prevents rapid repeated actions)
const rateLimitStore = new Map();
function checkRateLimit(key, limit = 5, windowMs = 60000) {
    const now = Date.now();
    const records = rateLimitStore.get(key) || [];
    const recent = records.filter(time => now - time < windowMs);
    if (recent.length >= limit) return false;
    recent.push(now);
    rateLimitStore.set(key, recent);
    return true;
}

// Sanitize user input (remove potential HTML tags)
function sanitizeInput(str) {
    if (!str) return '';
    return str.replace(/[<>]/g, '').trim();
}

// Validate email format
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Extract numbers from a string (e.g., from SMS)
function extractNumbers(str) {
    const matches = str.match(/\d+(?:\.\d+)?/g);
    return matches ? matches.map(Number) : [];
}

// Simple firework effect (canvas)
function showFireworks(duration = 2000) {
    const canvas = document.getElementById('fireworks');
    if (!canvas) return;
    canvas.classList.remove('hidden');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let particles = [];
    for (let i = 0; i < 100; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5 - 2,
            life: 1,
            color: `hsl(${Math.random() * 360}, 100%, 60%)`
        });
    }
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let allDead = true;
        for (let p of particles) {
            if (p.life <= 0) continue;
            allDead = false;
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 4, 4);
        }
        if (!allDead) requestAnimationFrame(animate);
        else {
            canvas.classList.add('hidden');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    animate();
    setTimeout(() => canvas.classList.add('hidden'), duration);
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

// Export for module usage (if needed, but works globally)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatMoney,
        formatDate,
        validateZambianPhone,
        showToast,
        checkRateLimit,
        sanitizeInput,
        isValidEmail,
        extractNumbers,
        showFireworks,
        isWeekend,
        addWeekdays,
        businessDaysBetween
    };
}