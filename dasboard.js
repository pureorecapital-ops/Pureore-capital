// dashboard.js – Main dashboard logic: balance, investments, plans, navigation

// Wait for auth and DOM
document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const balanceSpan = document.getElementById('userBalanceSpan');
    const plansContainer = document.getElementById('plansContainer');
    const depositBtn = document.getElementById('depositBtn');
    const withdrawBtn = document.getElementById('withdrawBtn');

    // Check if user is logged in (auth state is monitored in auth.js, but we also need user data)
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            // Redirect to login if not authenticated (auth.js handles this, but safe)
            window.location.href = 'login.html';
            return;
        }

        const userId = user.uid;

        // Real‑time balance listener
        const userDocRef = db.collection('users').doc(userId);
        userDocRef.onSnapshot((doc) => {
            if (doc.exists) {
                const balance = doc.data().balance || 0;
                if (balanceSpan) balanceSpan.innerText = balance.toFixed(2) + ' ZMW';
            } else {
                if (balanceSpan) balanceSpan.innerText = '0.00 ZMW';
            }
        }, (error) => {
            console.error('Balance listener error:', error);
        });

        // Load investment plans from systemSettings
        try {
            const settingsDoc = await db.collection('systemSettings').doc('investmentPlans').get();
            let plans = [];
            if (settingsDoc.exists) {
                plans = settingsDoc.data().plans || [];
            } else {
                // Fallback default plans if not set
                plans = [
                    { name: "Starter", minAmount: 100, maxAmount: 500, dailyReturn: 2, days: 30 },
                    { name: "Pro", minAmount: 501, maxAmount: 2000, dailyReturn: 3, days: 45 },
                    { name: "Premium", minAmount: 2001, maxAmount: 10000, dailyReturn: 5, days: 60 }
                ];
            }
            renderInvestmentPlans(plans, userId);
        } catch (err) {
            console.error('Error loading plans:', err);
            if (plansContainer) plansContainer.innerHTML = '<p class="error-msg">Failed to load investment plans.</p>';
        }
    });

    // Helper: render investment plans as cards with Invest button
    function renderInvestmentPlans(plans, userId) {
        if (!plansContainer) return;
        if (!plans.length) {
            plansContainer.innerHTML = '<p>No investment plans available.</p>';
            return;
        }
        plansContainer.innerHTML = '';
        plans.forEach(plan => {
            const card = document.createElement('div');
            card.className = 'plan-card';
            card.innerHTML = `
                <h4>${plan.name}</h4>
                <p>Min: ${formatMoney(plan.minAmount)} | Max: ${formatMoney(plan.maxAmount)}</p>
                <p>Daily ${plan.dailyReturn}% for ${plan.days} days</p>
                <button class="invest-btn" data-plan='${JSON.stringify(plan)}'>Invest Now</button>
            `;
            plansContainer.appendChild(card);
        });

        // Attach invest handlers
        document.querySelectorAll('.invest-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const plan = JSON.parse(btn.dataset.plan);
                const amount = prompt(`Enter amount (${formatMoney(plan.minAmount)} - ${formatMoney(plan.maxAmount)})`);
                if (!amount) return;
                const numAmount = parseFloat(amount);
                if (isNaN(numAmount) || numAmount < plan.minAmount || numAmount > plan.maxAmount) {
                    alert(`Amount must be between ${formatMoney(plan.minAmount)} and ${formatMoney(plan.maxAmount)}`);
                    return;
                }

                // Get current user and balance
                const user = auth.currentUser;
                if (!user) return;
                const userDoc = await db.collection('users').doc(user.uid).get();
                const currentBalance = userDoc.exists ? userDoc.data().balance || 0 : 0;
                if (numAmount > currentBalance) {
                    alert('Insufficient balance. Please deposit funds first.');
                    return;
                }

                // Perform transaction: deduct balance, create investment
                try {
                    await db.runTransaction(async (transaction) => {
                        const userRef = db.collection('users').doc(user.uid);
                        const userSnap = await transaction.get(userRef);
                        const newBalance = userSnap.data().balance - numAmount;
                        transaction.update(userRef, { balance: newBalance });

                        const investmentRef = db.collection('investments').doc();
                        transaction.set(investmentRef, {
                            userId: user.uid,
                            planName: plan.name,
                            investAmount: numAmount,
                            dailyReturn: plan.dailyReturn,
                            days: plan.days,
                            startDate: firebase.firestore.FieldValue.serverTimestamp(),
                            status: 'active',
                            totalReturn: 0
                        });
                    });
                    alert('Investment successful! Your balance has been updated.');
                    // Refresh page to reflect new balance (optional, listener will update)
                    location.reload();
                } catch (err) {
                    alert('Investment failed: ' + err.message);
                }
            });
        });
    }

    // Helper: format money (K)
    function formatMoney(amount) {
        return 'K' + parseFloat(amount).toFixed(2);
    }

    // Deposit / Withdraw buttons (already have inline listeners, but add as backup)
    if (depositBtn) {
        depositBtn.addEventListener('click', () => {
            window.location.href = 'deposit.html';
        });
    }
    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', () => {
            window.location.href = 'withdraw.html';
        });
    }

    // Middle row navigation (Treasure, Loan, Voucher)
    const middleItems = document.querySelectorAll('.middle-item');
    middleItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const href = item.getAttribute('onclick');
            if (href) {
                const url = href.match(/location\.href='([^']+)'/);
                if (url && url[1]) window.location.href = url[1];
            }
        });
    });

    // Bottom navigation (already handled in dashboard.html inline script, but ensure no duplication)
    // The bottom nav script is already in HTML; we leave it.
});