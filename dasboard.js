// dashboard.js – Main dashboard logic: balance, investments, plans, navigation
// This script assumes Firebase (auth, db, firebase) is already initialised in the HTML.

(function() {
    // Wait for DOM and Firebase to be ready
    document.addEventListener('DOMContentLoaded', () => {
        // Check if global Firebase services are available
        if (typeof auth === 'undefined' || typeof db === 'undefined' || typeof firebase === 'undefined') {
            console.error('Firebase not initialised. Make sure Firebase scripts load before dashboard.js');
            return;
        }

        // Elements
        const balanceSpan = document.getElementById('userBalanceSpan');
        const plansContainer = document.getElementById('plansContainer'); // may be missing – safe
        const depositBtn = document.getElementById('depositBtn');
        const withdrawBtn = document.getElementById('withdrawBtn');

        // Helper: format money (K)
        function formatMoney(amount) {
            return 'K' + parseFloat(amount).toFixed(2);
        }

        // Helper: escape HTML to prevent XSS
        function escapeHtml(str) {
            if (!str) return '';
            return str.replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
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

        // Auth state and real‑time balance
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = 'login.html';
                return;
            }

            const userId = user.uid;

            // Real‑time balance listener
            const userDocRef = db.collection('users').doc(userId);
            userDocRef.onSnapshot((doc) => {
                if (doc.exists && balanceSpan) {
                    const balance = doc.data().balance || 0;
                    balanceSpan.innerText = balance.toFixed(2) + ' ZMW';
                } else if (balanceSpan) {
                    balanceSpan.innerText = '0.00 ZMW';
                }
            }, (error) => {
                console.error('Balance listener error:', error);
                if (balanceSpan) balanceSpan.innerText = '0.00 ZMW';
            });

            // Load investment plans ONLY if plansContainer exists
            if (plansContainer) {
                try {
                    const settingsDoc = await db.collection('systemSettings').doc('investmentPlans').get();
                    let plans = [];
                    if (settingsDoc.exists) {
                        plans = settingsDoc.data().plans || [];
                    } else {
                        // Fallback default plans
                        plans = [
                            { name: "Starter", minAmount: 100, maxAmount: 500, dailyReturn: 2, days: 30 },
                            { name: "Pro", minAmount: 501, maxAmount: 2000, dailyReturn: 3, days: 45 },
                            { name: "Premium", minAmount: 2001, maxAmount: 10000, dailyReturn: 5, days: 60 }
                        ];
                    }
                    renderInvestmentPlans(plans, userId);
                } catch (err) {
                    console.error('Error loading plans:', err);
                    plansContainer.innerHTML = '<p class="error-msg">Failed to load investment plans.</p>';
                }
            }
        });

        // Render investment plans (only called if plansContainer exists)
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
                    <h4>${escapeHtml(plan.name)}</h4>
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

                    const user = auth.currentUser;
                    if (!user) return;
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    const currentBalance = userDoc.exists ? userDoc.data().balance || 0 : 0;
                    if (numAmount > currentBalance) {
                        alert('Insufficient balance. Please deposit funds first.');
                        return;
                    }

                    // Disable all invest buttons to prevent double submission
                    const allBtns = document.querySelectorAll('.invest-btn');
                    allBtns.forEach(btn => btn.disabled = true);

                    try {
                        // Compute startDate: if weekend, move to next Monday
                        let startDate = new Date();
                        if (isWeekend(startDate)) {
                            startDate.setDate(startDate.getDate() + (8 - startDate.getDay()));
                            startDate.setHours(0, 0, 0, 0);
                        }
                        const businessDays = plan.days;
                        const businessEndDate = addWeekdays(startDate, businessDays);
                        const dailyReturnPercent = plan.dailyReturn; // already percentage

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
                                dailyReturn: dailyReturnPercent,
                                days: plan.days,
                                businessDays: businessDays,
                                startDate: firebase.firestore.Timestamp.fromDate(startDate),
                                businessEndDate: firebase.firestore.Timestamp.fromDate(businessEndDate),
                                status: 'active',
                                totalReturn: 0
                            });
                        });

                        // Log transaction
                        await db.collection('transactions').add({
                            userId: user.uid,
                            type: 'investment',
                            amount: numAmount,
                            description: `Invested in ${plan.name}`,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });

                        alert('Investment successful! Your balance has been updated.');
                        // Refresh to show updated balance (listener will also update, but reload ensures UI)
                        location.reload();
                    } catch (err) {
                        alert('Investment failed: ' + err.message);
                        allBtns.forEach(btn => btn.disabled = false);
                    }
                });
            });
        }

        // Deposit / Withdraw buttons (only add listeners if not already handled by inline onclick)
        if (depositBtn && !depositBtn.hasAttribute('data-listener')) {
            depositBtn.setAttribute('data-listener', 'true');
            depositBtn.addEventListener('click', () => window.location.href = 'deposit.html');
        }
        if (withdrawBtn && !withdrawBtn.hasAttribute('data-listener')) {
            withdrawBtn.setAttribute('data-listener', 'true');
            withdrawBtn.addEventListener('click', () => window.location.href = 'withdraw.html');
        }

        // Optional: middle row navigation – if you prefer JS over inline onclick, uncomment below
        // const middleItems = document.querySelectorAll('.middle-item');
        // middleItems.forEach(item => {
        //     item.addEventListener('click', () => {
        //         const href = item.getAttribute('onclick');
        //         if (href) {
        //             const url = href.match(/location\.href='([^']+)'/);
        //             if (url && url[1]) window.location.href = url[1];
        //         }
        //     });
        // });

        // Bottom navigation is already handled by inline script in dashboard.html – no action needed.
    });
})();