// team.js – Handles referral code display, team list, bonus calculation

let currentUser = null;

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = user;
    await loadReferralData();
    loadTeamList();
});

async function loadReferralData() {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (!userDoc.exists) return;
    const referralCode = userDoc.data().referralCode;
    const baseUrl = window.location.origin;
    const referralLink = `${baseUrl}/register.html?ref=${referralCode}`;
    document.getElementById('referralCodeDisplay').innerText = referralCode;
    
    // Copy button
    document.getElementById('copyReferralBtn').onclick = () => {
        navigator.clipboard.writeText(referralLink);
        alert('Referral link copied! Share it with friends.');
    };
    
    // Calculate total bonus from referralEarnings collection
    const earningsSnap = await db.collection('referralEarnings')
        .where('referrerId', '==', currentUser.uid)
        .get();
    let totalBonus = 0;
    earningsSnap.forEach(doc => {
        totalBonus += doc.data().amount;
    });
    document.getElementById('totalBonus').innerText = totalBonus.toFixed(2);
}

async function loadTeamList() {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const myReferralCode = userDoc.data().referralCode;
    
    // Find all users who registered with this code
    const teamQuery = await db.collection('users')
        .where('referredBy', '==', myReferralCode)
        .get();
    
    const teamCount = teamQuery.size;
    document.getElementById('teamCount').innerText = teamCount;
    
    if (teamQuery.empty) {
        document.getElementById('teamList').innerHTML = '<p>No team members yet. Share your referral link!</p>';
        return;
    }
    
    let html = '';
    for (const doc of teamQuery.docs) {
        const member = doc.data();
        const memberId = doc.id;
        
        // Check if they have made a deposit (completed) and at least one investment
        const depositsSnap = await db.collection('deposits')
            .where('userId', '==', memberId)
            .where('status', '==', 'completed')
            .limit(1)
            .get();
        const hasDeposit = !depositsSnap.empty;
        
        const investmentsSnap = await db.collection('investments')
            .where('userId', '==', memberId)
            .limit(1)
            .get();
        const hasInvestment = !investmentsSnap.empty;
        
        let statusText = '';
        let statusClass = '';
        let bonusEarned = 0;
        
        // Check if bonus was already awarded for this member
        const bonusQuery = await db.collection('referralEarnings')
            .where('referrerId', '==', currentUser.uid)
            .where('referredUserId', '==', memberId)
            .limit(1)
            .get();
        const bonusPaid = !bonusQuery.empty;
        if (bonusPaid) {
            bonusEarned = bonusQuery.docs[0].data().amount;
            statusText = `✅ Bonus K${bonusEarned.toFixed(2)}`;
            statusClass = 'status-bonus';
        } else if (hasDeposit && hasInvestment) {
            // Bonus eligible but not yet paid – should be paid by cloud function or admin trigger
            statusText = '⏳ Eligible for bonus (pending)';
            statusClass = 'status-pending';
        } else if (hasDeposit) {
            statusText = '💸 Deposited, needs investment';
            statusClass = 'status-pending';
        } else {
            statusText = '📝 Registered only';
            statusClass = 'status-pending';
        }
        
        html += `
            <div class="team-member">
                <div class="member-name">${member.fullName || 'User'}</div>
                <div class="member-status ${statusClass}">${statusText}</div>
            </div>
        `;
    }
    document.getElementById('teamList').innerHTML = html;
}