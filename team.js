// team.js – Handles referral code display, team list, bonus calculation
// This script assumes Firebase (auth, db) is already initialised globally.

(function() {
    // Wait for DOM to load
    document.addEventListener('DOMContentLoaded', () => {
        // Guard: ensure Firebase services are available
        if (typeof auth === 'undefined' || typeof db === 'undefined') {
            console.error('Firebase not initialised. Make sure Firebase scripts load before team.js');
            return;
        }

        let currentUser = null;
        const referralCodeSpan = document.getElementById('referralCodeDisplay');
        const copyBtn = document.getElementById('copyReferralBtn');
        const teamCountSpan = document.getElementById('teamCount');
        const totalBonusSpan = document.getElementById('totalBonus');
        const teamListDiv = document.getElementById('teamList');

        if (!referralCodeSpan || !copyBtn || !teamCountSpan || !totalBonusSpan || !teamListDiv) {
            console.error('Required DOM elements missing for team page');
            return;
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

        // Show loading indicator
        function showLoading() {
            teamListDiv.innerHTML = '<div class="loader"></div><div style="text-align:center;">Loading team data...</div>';
        }

        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = 'login.html';
                return;
            }
            currentUser = user;
            showLoading();
            try {
                await loadReferralData();
                await loadTeamList();
            } catch (err) {
                console.error(err);
                teamListDiv.innerHTML = '<div class="error-msg">Failed to load team data. Please refresh.</div>';
            }
        });

        async function loadReferralData() {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (!userDoc.exists) {
                referralCodeSpan.innerText = 'Error';
                return;
            }
            const referralCode = userDoc.data().referralCode;
            const baseUrl = window.location.origin;
            const referralLink = `${baseUrl}/register.html?ref=${referralCode}`;
            referralCodeSpan.innerText = referralCode;

            // Copy button handler
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(referralLink).then(() => {
                    alert('Referral link copied! Share it with friends.');
                }).catch(() => {
                    alert('Could not copy. Please copy manually: ' + referralLink);
                });
            };

            // Calculate total bonus from referralEarnings collection
            const earningsSnap = await db.collection('referralEarnings')
                .where('referrerId', '==', currentUser.uid)
                .get();
            let totalBonus = 0;
            earningsSnap.forEach(doc => {
                totalBonus += doc.data().amount || 0;
            });
            totalBonusSpan.innerText = totalBonus.toFixed(2);
        }

        async function loadTeamList() {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            const myReferralCode = userDoc.data().referralCode;
            if (!myReferralCode) {
                teamListDiv.innerHTML = '<p>No referral code found.</p>';
                teamCountSpan.innerText = '0';
                return;
            }

            // Get all referred users
            const teamQuery = await db.collection('users')
                .where('referredBy', '==', myReferralCode)
                .get();

            const teamCount = teamQuery.size;
            teamCountSpan.innerText = teamCount;

            if (teamQuery.empty) {
                teamListDiv.innerHTML = '<p>No team members yet. Share your referral link!</p>';
                return;
            }

            // Collect all referred user IDs
            const referredIds = [];
            const referredDataMap = new Map(); // id -> { fullName, ... }
            teamQuery.forEach(doc => {
                referredIds.push(doc.id);
                referredDataMap.set(doc.id, doc.data());
            });

            // Batch fetch deposits, investments, and referral earnings for all referred users
            const depositPromises = referredIds.map(id => 
                db.collection('deposits')
                    .where('userId', '==', id)
                    .where('status', '==', 'completed')
                    .limit(1)
                    .get()
            );
            const investmentPromises = referredIds.map(id =>
                db.collection('investments')
                    .where('userId', '==', id)
                    .limit(1)
                    .get()
            );
            const bonusPromises = referredIds.map(id =>
                db.collection('referralEarnings')
                    .where('referrerId', '==', currentUser.uid)
                    .where('referredUserId', '==', id)
                    .limit(1)
                    .get()
            );

            const depositResults = await Promise.all(depositPromises);
            const investmentResults = await Promise.all(investmentPromises);
            const bonusResults = await Promise.all(bonusPromises);

            let html = '';
            for (let i = 0; i < referredIds.length; i++) {
                const memberId = referredIds[i];
                const member = referredDataMap.get(memberId);
                const hasDeposit = !depositResults[i].empty;
                const hasInvestment = !investmentResults[i].empty;
                const bonusQuery = bonusResults[i];
                const bonusPaid = !bonusQuery.empty;
                let statusText = '';
                let statusClass = '';
                let bonusEarned = 0;

                if (bonusPaid) {
                    bonusEarned = bonusQuery.docs[0].data().amount || 0;
                    statusText = ` Bonus K${bonusEarned.toFixed(2)}`;
                    statusClass = 'status-bonus';
                } else if (hasDeposit && hasInvestment) {
                    statusText = ' Eligible for bonus (pending)';
                    statusClass = 'status-pending';
                } else if (hasDeposit) {
                    statusText = ' Deposited, needs investment';
                    statusClass = 'status-pending';
                } else {
                    statusText = ' Registered only';
                    statusClass = 'status-pending';
                }

                html += `
                    <div class="team-member">
                        <div class="member-name">${escapeHtml(member.fullName || 'User')}</div>
                        <div class="member-status ${statusClass}">${escapeHtml(statusText)}</div>
                    </div>
                `;
            }
            teamListDiv.innerHTML = html;
        }
    });
})();