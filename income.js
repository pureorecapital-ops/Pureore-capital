// income.js – Manages investment plans, hourly progress, total pending, and daily income claims (business days only)

// Helper: format money
function formatMoney(amount) {
    return 'K' + parseFloat(amount).toFixed(2);
}

// Helper: show temporary message
function showToast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.innerText = msg;
    toast.style.position = 'fixed';
    toast.style.bottom = '90px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = isError ? '#ef4444' : '#2ecc71';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '40px';
    toast.style.zIndex = '9999';
    toast.style.fontWeight = 'bold';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Helper: check if a date is weekend (Saturday or Sunday)
function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
}

// Helper: add weekdays to a start date (skip weekends)
function addWeekdays(startDate, days) {
    let result = new Date(startDate);
    let added = 0;
    while (added < days) {
        result.setDate(result.getDate() + 1);
        if (!isWeekend(result)) added++;
    }
    return result;
}

// Helper: calculate business days between two dates (only weekdays)
function businessDaysBetween(startDate, endDate) {
    let count = 0;
    let current = new Date(startDate);
    while (current <= endDate) {
        if (!isWeekend(current)) count++;
        current.setDate(current.getDate() + 1);
    }
    return count;
}

// Helper: compute pending claimable amount for an investment (proportional to time since last claim)
function getPendingAmount(inv, now) {
    const dailyAmount = inv.investAmount * (inv.dailyReturn / 100);
    const lastClaim = inv.lastClaimed ? inv.lastClaimed.toDate() : inv.startDate.toDate();
    const hoursSince = (now - lastClaim) / (1000 * 60 * 60);
    if (hoursSince >= 24) return dailyAmount;
    return (hoursSince / 24) * dailyAmount;
}

let currentUserId = null;
let updateInterval = null;

// Load investments when user is authenticated
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    currentUserId = user.uid;
    loadInvestments();
    // Update hourly display every minute
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => {
        const normalTab = document.getElementById('normalTab');
        if (normalTab && normalTab.classList.contains('active')) {
            loadInvestments(); // refresh to update pending amounts
        }
    }, 60000);
});

// Fetch all investments for the current user and split into active/expired using business days
async function loadInvestments() {
    if (!currentUserId) return;

    const snapshot = await db.collection('investments')
        .where('userId', '==', currentUserId)
        .orderBy('startDate', 'desc')
        .get();

    const active = [];
    const expired = [];
    const now = new Date();

    for (const doc of snapshot.docs) {
        const inv = doc.data();
        let startDate = inv.startDate.toDate();
        let businessDays = inv.businessDays || inv.days; // fallback to calendar days if not set
        let endDate = inv.businessEndDate ? inv.businessEndDate.toDate() : addWeekdays(startDate, businessDays);

        const today = new Date();
        today.setHours(0,0,0,0);
        const isExpired = inv.status !== 'active' || today > endDate;

        if (!isExpired) {
            active.push({ id: doc.id, ...inv, startDate, businessDays, endDate, dailyAmount: inv.investAmount * (inv.dailyReturn / 100) });
        } else {
            expired.push({ id: doc.id, ...inv, startDate, businessDays, endDate, dailyAmount: inv.investAmount * (inv.dailyReturn / 100) });
        }
    }

    renderActive(active);
    renderExpired(expired);
    refreshTotalPending(active);
}

// Render active investments with hourly progress and claim button (weekend blocked)
function renderActive(investments) {
    const container = document.getElementById('activeInvestments');
    if (!investments.length) {
        container.innerHTML = '<div class="empty-msg">📭 No active investment plans.</div>';
        refreshTotalPending([]);
        return;
    }

    let html = '';
    const now = new Date();
    const todayIsWeekend = isWeekend(now);

    for (const inv of investments) {
        const dailyAmount = inv.dailyAmount;
        const elapsedBusinessDays = businessDaysBetween(inv.startDate, now);
        const totalBusinessDays = inv.businessDays;
        const progressPercent = Math.min(100, (elapsedBusinessDays / totalBusinessDays) * 100);
        const daysLeft = Math.max(0, totalBusinessDays - elapsedBusinessDays);

        const lastClaim = inv.lastClaimed ? inv.lastClaimed.toDate() : inv.startDate.toDate();
        const hoursSince = (now - lastClaim) / (1000 * 60 * 60);
        const pending = getPendingAmount(inv, now);
        const progressHours = Math.min(24, hoursSince);

        // Can claim only if 24 hours have passed AND today is a weekday
        const canClaim = (!todayIsWeekend && hoursSince >= 24);

        html += `
            <div class="plan-card" data-id="${inv.id}">
                <div class="plan-header">
                    <span class="plan-name">${inv.planName}</span>
                    <span class="plan-amount">${formatMoney(inv.investAmount)}</span>
                </div>
                <div class="plan-details">
                    <span>📅 Started: ${inv.startDate.toLocaleDateString()}</span>
                    <span>💰 Daily: ${inv.dailyReturn}% (${formatMoney(dailyAmount)})</span>
                    <span>⏱️ Days left: ${daysLeft}</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${(progressHours/24)*100}%;"></div>
                    </div>
                    <div class="progress-text">⏱️ ${Math.floor(hoursSince)}h ${Math.floor((hoursSince%1)*60)}m / 24h to next claim</div>
                    <div class="pending-amount">💰 Pending: ${formatMoney(pending)}</div>
                </div>
                <button class="claim-btn ${canClaim ? 'active' : ''}" ${canClaim ? '' : 'disabled'} data-id="${inv.id}" data-daily="${dailyAmount}">
                    💰 Claim Daily Income (${formatMoney(dailyAmount)})
                </button>
                ${todayIsWeekend ? '<div class="weekend-warning">⛔ Claiming only available Monday–Friday. Come back on weekday.</div>' : ''}
            </div>
        `;
    }

    container.innerHTML = html;

    // Attach click handlers to active claim buttons
    document.querySelectorAll('.claim-btn.active').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const invId = btn.dataset.id;
            const dailyAmount = parseFloat(btn.dataset.daily);
            await claimDailyIncome(invId, dailyAmount);
        });
    });
}

// Claim daily income for an investment (runs in a transaction)
async function claimDailyIncome(investmentId, dailyAmount) {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    const now = new Date();
    if (isWeekend(now)) {
        showToast('❌ Daily income can only be claimed on weekdays (Monday–Friday).', true);
        return;
    }

    try {
        await db.runTransaction(async (transaction) => {
            const invRef = db.collection('investments').doc(investmentId);
            const invSnap = await transaction.get(invRef);
            if (!invSnap.exists) throw new Error('Investment not found');

            const invData = invSnap.data();
            const lastClaimed = invData.lastClaimed ? invData.lastClaimed.toDate() : invData.startDate.toDate();
            const hoursSince = (now - lastClaimed) / (1000 * 60 * 60);
            if (hoursSince < 24) throw new Error('Not yet 24 hours since last claim');

            // Update user balance
            const userRef = db.collection('users').doc(user.uid);
            const userSnap = await transaction.get(userRef);
            const newBalance = (userSnap.data().balance || 0) + dailyAmount;
            transaction.update(userRef, { balance: newBalance });

            // Update last claimed timestamp
            transaction.update(invRef, {
                lastClaimed: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Log transaction
            const txRef = db.collection('transactions').doc();
            transaction.set(txRef, {
                userId: user.uid,
                type: 'daily_income',
                amount: dailyAmount,
                description: `Daily income from ${invData.planName}`,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        showToast(`✅ K${dailyAmount.toFixed(2)} claimed!`, false);
        loadInvestments(); // refresh the list
    } catch (err) {
        showToast(err.message || 'Claim failed', true);
    }
}

// Update the total pending amount display
function refreshTotalPending(investments) {
    const totalPendingElement = document.getElementById('totalPending');
    if (!totalPendingElement) return;
    const now = new Date();
    let total = 0;
    for (const inv of investments) {
        total += getPendingAmount(inv, now);
    }
    totalPendingElement.innerText = total.toFixed(2);
}

// Render expired/completed investments (no claim button)
function renderExpired(investments) {
    const container = document.getElementById('expiredInvestments');
    if (!investments.length) {
        container.innerHTML = '<div class="empty-msg">📭 No expired or completed plans.</div>';
        return;
    }

    let html = '';
    for (const inv of investments) {
        const dailyAmount = inv.dailyAmount;
        html += `
            <div class="plan-card">
                <div class="plan-header">
                    <span class="plan-name">${inv.planName}</span>
                    <span class="plan-amount">${formatMoney(inv.investAmount)}</span>
                </div>
                <div class="plan-details">
                    <span>📅 Started: ${inv.startDate.toLocaleDateString()}</span>
                    <span>💰 Daily: ${inv.dailyReturn}% (${formatMoney(dailyAmount)})</span>
                    <span>⏱️ Status: ${inv.status === 'completed' ? 'Completed' : 'Expired'}</span>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// Tab switching (called from HTML on page load)
document.addEventListener('DOMContentLoaded', () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabs = {
        normal: document.getElementById('normalTab'),
        expired: document.getElementById('expiredTab')
    };

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            Object.values(tabs).forEach(tab => tab.classList.remove('active'));
            if (tabs[tabId]) tabs[tabId].classList.add('active');
            if (tabId === 'normal') loadInvestments(); // refresh data when switching to normal
        });
    });

    // Bottom navigation (if present)
    const navItems = document.querySelectorAll('.nav-item');
    const currentPage = window.location.pathname.split('/').pop() || 'income.html';
    navItems.forEach(item => {
        const targetPage = item.getAttribute('data-page');
        if (currentPage === targetPage) item.classList.add('active');
        item.addEventListener('click', () => {
            if (targetPage && !window.location.pathname.includes(targetPage)) {
                window.location.href = targetPage;
            }
        });
    });
});