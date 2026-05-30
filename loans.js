// loan.js – Handles loan eligibility, amount selection, interest calculation, request submission, and repayment

// Helper: show toast message
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

// Generate loan amount buttons from 6000 to 100000 step 6000
function generateLoanButtons() {
    const container = document.getElementById('loanAmountBtns');
    if (!container) return;
    const amounts = [];
    for (let i = 6000; i <= 100000; i += 6000) amounts.push(i);
    amounts.forEach(amt => {
        const btn = document.createElement('button');
        btn.className = 'loan-amount-btn';
        btn.innerText = amt.toLocaleString() + ' ZMW';
        btn.dataset.amount = amt;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.loan-amount-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('loanAmountInput').value = amt;
            calculatePayback(amt);
        });
        container.appendChild(btn);
    });
}

// Calculate payback amount (15% interest)
function calculatePayback(amount) {
    if (!amount || amount < 6000) return;
    const interest = amount * 0.15;
    const total = amount + interest;
    const resultDiv = document.getElementById('paybackResult');
    if (resultDiv) resultDiv.innerHTML = `You need to pay back: ${total.toFixed(2)} ZMW after 15 days`;
}

// Check if user has any active loan
async function hasActiveLoan(userId) {
    const loansSnapshot = await db.collection('loans')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get();
    return !loansSnapshot.empty;
}

// Check if account is restricted (admin toggled)
async function isAccountRestricted(userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    return userDoc.exists && userDoc.data().restricted === true;
}

// Eligibility checks: balance > 10000, has investment, 15 qualified referrals
async function checkEligibility(userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    const balance = userDoc.exists ? userDoc.data().balance || 0 : 0;
    if (balance < 10000) {
        return { eligible: false, reason: '❌ Balance must be at least 10,000 ZMW to request a loan.' };
    }

    // Has at least one investment (any status)
    const investments = await db.collection('investments').where('userId', '==', userId).limit(1).get();
    if (investments.empty) {
        return { eligible: false, reason: '❌ You must purchase at least one investment plan before applying for a loan.' };
    }

    // Referred at least 15 members who have deposited & invested
    const referralCode = userDoc.data().referralCode;
    const referredUsers = await db.collection('users').where('referredBy', '==', referralCode).get();
    let qualifiedReferred = 0;
    for (const doc of referredUsers.docs) {
        const refId = doc.id;
        const deposits = await db.collection('deposits').where('userId', '==', refId).where('status', '==', 'completed').limit(1).get();
        const hasDeposit = !deposits.empty;
        const inv = await db.collection('investments').where('userId', '==', refId).limit(1).get();
        const hasInvestment = !inv.empty;
        if (hasDeposit && hasInvestment) qualifiedReferred++;
    }
    if (qualifiedReferred < 15) {
        return { eligible: false, reason: `❌ You need at least 15 team members who have both deposited and invested. Current: ${qualifiedReferred}/15` };
    }

    return { eligible: true, balance, qualifiedReferred };
}

// Show restriction alert if needed
async function showRestrictionAlert(userId) {
    const restricted = await isAccountRestricted(userId);
    const alertContainer = document.getElementById('alertContainer');
    const loanContent = document.getElementById('loanContent');
    const repaySection = document.getElementById('repaySection');
    if (restricted) {
        alertContainer.innerHTML = `
            <div class="alert-card">
                <img src="https://i.ibb.co/jP1hv722/file-000000005c4071fd8f0804a576ae6ac1.png" class="warning-img" alt="Alert">
                <h3>⚠️ Account Restricted</h3>
                <p>Your account has been flagged due to suspicious activity or large withdrawals. Please contact admin to resolve.</p>
                <button id="talkToAdminBtn" class="btn-primary" style="background:#ef4444; margin-top:0.5rem;">Talk to Admin</button>
            </div>
        `;
        if (loanContent) loanContent.style.display = 'none';
        if (repaySection) repaySection.style.display = 'none';
        document.getElementById('talkToAdminBtn')?.addEventListener('click', () => {
            window.open('https://wa.me/260951359357', '_blank');
        });
    } else {
        if (alertContainer) alertContainer.innerHTML = '';
        if (loanContent) loanContent.style.display = 'block';
        if (repaySection) repaySection.style.display = 'block';
    }
}

// Request loan submission
async function requestLoan(loanAmount, userId) {
    const repayTotal = loanAmount * 1.15;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15);
    await db.collection('loans').add({
        userId: userId,
        amount: loanAmount,
        repayTotal: repayTotal,
        status: 'pending',
        dueDate: firebase.firestore.Timestamp.fromDate(dueDate),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

// Load active loans for repayment
async function loadActiveLoans(userId) {
    const snapshot = await db.collection('loans')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .orderBy('dueDate', 'asc')
        .get();
    const container = document.getElementById('activeLoansList');
    if (!container) return;
    if (snapshot.empty) {
        container.innerHTML = '<p>No active loans to repay.</p>';
        return;
    }
    let html = '';
    snapshot.forEach(doc => {
        const loan = doc.data();
        const dueDate = loan.dueDate.toDate().toLocaleDateString();
        html += `
            <div class="loan-item">
                <div class="loan-details">
                    <strong>Amount: K${loan.amount}</strong><br>
                    To Repay: K${loan.repayTotal}<br>
                    Due: ${dueDate}
                </div>
                <button class="btn-primary btn-repay repay-btn" data-id="${doc.id}" data-amount="${loan.repayTotal}">Repay K${loan.repayTotal}</button>
            </div>
        `;
    });
    container.innerHTML = html;

    // Attach repay handlers
    document.querySelectorAll('.repay-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const loanId = btn.dataset.id;
            const repayAmount = parseFloat(btn.dataset.amount);
            await repayLoan(loanId, repayAmount);
        });
    });
}

// Repay loan function
async function repayLoan(loanId, repayAmount) {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(user.uid);
            const userSnap = await transaction.get(userRef);
            const currentBalance = userSnap.data().balance || 0;
            if (currentBalance < repayAmount) {
                throw new Error('Insufficient balance to repay this loan.');
            }
            const newBalance = currentBalance - repayAmount;
            transaction.update(userRef, { balance: newBalance });

            const loanRef = db.collection('loans').doc(loanId);
            transaction.update(loanRef, { status: 'paid' });

            // Record transaction
            const txRef = db.collection('transactions').doc();
            transaction.set(txRef, {
                userId: user.uid,
                type: 'loan_repayment',
                amount: repayAmount,
                description: `Loan repayment of K${repayAmount}`,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        showToast('✅ Loan repaid successfully!', false);
        // Refresh active loans list
        await loadActiveLoans(user.uid);
    } catch (err) {
        showToast(err.message, true);
    }
}

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    const userId = user.uid;

    // Generate loan amount buttons
    generateLoanButtons();

    // Show restriction alert (if any)
    await showRestrictionAlert(userId);

    // Load active loans for repayment section
    await loadActiveLoans(userId);

    const loanAmountInput = document.getElementById('loanAmountInput');
    const paybackInput = document.getElementById('paybackInput');
    const requestBtn = document.getElementById('requestLoanBtn');
    const loanMessage = document.getElementById('loanMessage');

    // Loan amount input listener
    loanAmountInput.addEventListener('input', () => {
        let val = parseFloat(loanAmountInput.value);
        if (!isNaN(val) && val >= 6000) {
            calculatePayback(val);
        } else {
            const resultDiv = document.getElementById('paybackResult');
            if (resultDiv) resultDiv.innerHTML = '';
        }
    });

    // Payback calculator input listener (extra)
    paybackInput.addEventListener('input', () => {
        let val = parseFloat(paybackInput.value);
        if (!isNaN(val) && val >= 6000) {
            const interest = val * 0.15;
            const total = val + interest;
            const resultDiv = document.getElementById('paybackResult');
            if (resultDiv) resultDiv.innerHTML = `You need to pay back: ${total.toFixed(2)} ZMW after 15 days`;
        } else {
            const resultDiv = document.getElementById('paybackResult');
            if (resultDiv && !loanAmountInput.value) resultDiv.innerHTML = '';
        }
    });

    // Request loan button click
    requestBtn.addEventListener('click', async () => {
        const loanAmount = parseFloat(loanAmountInput.value);
        if (isNaN(loanAmount) || loanAmount < 6000 || loanAmount > 100000) {
            if (loanMessage) loanMessage.innerHTML = '<div class="eligibility-fail">Enter a loan amount between 6,000 and 100,000 ZMW (in multiples of 6,000).</div>';
            return;
        }

        // Check eligibility again
        const eligibility = await checkEligibility(userId);
        if (!eligibility.eligible) {
            if (loanMessage) loanMessage.innerHTML = `<div class="eligibility-fail">${eligibility.reason}</div>`;
            return;
        }

        // Check restriction again
        const restricted = await isAccountRestricted(userId);
        if (restricted) {
            if (loanMessage) loanMessage.innerHTML = '<div class="eligibility-fail">Your account is restricted. Contact admin first.</div>';
            return;
        }

        // Check active loan already exists
        const activeLoan = await hasActiveLoan(userId);
        if (activeLoan) {
            if (loanMessage) loanMessage.innerHTML = '<div class="eligibility-fail">You already have an active loan. Repay it before applying for a new one.</div>';
            return;
        }

        try {
            await requestLoan(loanAmount, userId);
            if (loanMessage) loanMessage.innerHTML = '<div class="success-msg">✅ Loan request submitted! Admin will review.</div>';
            loanAmountInput.value = '';
            const resultDiv = document.getElementById('paybackResult');
            if (resultDiv) resultDiv.innerHTML = '';
            // Clear active button highlight
            document.querySelectorAll('.loan-amount-btn').forEach(btn => btn.classList.remove('active'));
        } catch (err) {
            if (loanMessage) loanMessage.innerHTML = `<div class="eligibility-fail">Error: ${err.message}</div>`;
        }
    });

    // Bottom navigation active state (if present)
    const navItems = document.querySelectorAll('.nav-item');
    const currentPage = window.location.pathname.split('/').pop() || 'loan.html';
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