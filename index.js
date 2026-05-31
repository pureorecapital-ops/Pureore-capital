const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * Core logic to give referral bonus on first completed deposit.
 * Reused by both onCreate and onUpdate triggers.
 */
async function handleDepositCompleted(deposit, depositId) {
    const userId = deposit.userId;
    const depositAmount = deposit.amount;

    // 1. Check if this is the user's first completed deposit
    const userDeposits = await admin.firestore()
        .collection('deposits')
        .where('userId', '==', userId)
        .where('status', '==', 'completed')
        .get();
    if (userDeposits.size > 1) {
        console.log(`User ${userId} already had a completed deposit before. Skipping bonus.`);
        return null;
    }

    // 2. Check if user has at least one investment
    const investments = await admin.firestore()
        .collection('investments')
        .where('userId', '==', userId)
        .limit(1)
        .get();
    if (investments.empty) {
        console.log(`User ${userId} has no investments. No bonus.`);
        return null;
    }

    // 3. Get user's referral code (who referred them)
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const referredBy = userDoc.data().referredBy;
    if (!referredBy) {
        console.log(`User ${userId} was not referred. No bonus.`);
        return null;
    }

    // 4. Find referrer (the person who owns that referral code)
    const referrerQuery = await admin.firestore()
        .collection('users')
        .where('referralCode', '==', referredBy)
        .limit(1)
        .get();
    if (referrerQuery.empty) {
        console.log(`Referrer code ${referredBy} not found. No bonus.`);
        return null;
    }
    const referrer = referrerQuery.docs[0];
    const referrerId = referrer.id;

    // 5. Prevent self‑referral
    if (referrerId === userId) {
        console.log(`User ${userId} tried to refer themselves. Skipping bonus.`);
        return null;
    }

    // 6. Check if referrer is blocked
    const referrerData = referrer.data();
    if (referrerData.isBlocked === true) {
        console.log(`Referrer ${referrerId} is blocked. No bonus.`);
        return null;
    }

    // 7. Check if bonus already given for this referred user
    const existingBonus = await admin.firestore()
        .collection('referralEarnings')
        .where('referrerId', '==', referrerId)
        .where('referredUserId', '==', userId)
        .get();
    if (!existingBonus.empty) {
        console.log(`Bonus already given for referrer ${referrerId} for user ${userId}. Skipping.`);
        return null;
    }

    // 8. Calculate bonus (5% of deposit amount)
    const bonusAmount = depositAmount * 0.05;

    // 9. Run transaction to add bonus and record earnings
    await admin.firestore().runTransaction(async (transaction) => {
        // Update referrer's balance
        const referrerRef = admin.firestore().collection('users').doc(referrerId);
        const referrerSnap = await transaction.get(referrerRef);
        const currentBalance = referrerSnap.data().balance || 0;
        const newBalance = currentBalance + bonusAmount;
        transaction.update(referrerRef, { balance: newBalance });

        // Record referral earning
        const earningsRef = admin.firestore().collection('referralEarnings').doc();
        transaction.set(earningsRef, {
            referrerId: referrerId,
            referredUserId: userId,
            amount: bonusAmount,
            depositId: depositId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Log transaction in referrer's history
        const txRef = admin.firestore().collection('transactions').doc();
        transaction.set(txRef, {
            userId: referrerId,
            type: 'referral_bonus',
            amount: bonusAmount,
            description: `Referral bonus for user ${userId} (deposit K${depositAmount})`,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    console.log(`✅ Bonus K${bonusAmount} added to referrer ${referrerId}`);
    return null;
}

// Trigger when a deposit is CREATED (e.g., admin manually creates a completed deposit)
exports.onDepositCreated = functions.firestore
    .document('deposits/{depositId}')
    .onCreate(async (snap, context) => {
        const deposit = snap.data();
        if (deposit.status === 'completed') {
            try {
                await handleDepositCompleted(deposit, context.params.depositId);
            } catch (err) {
                console.error(`Error in onDepositCreated for ${context.params.depositId}:`, err);
            }
        }
        return null;
    });

// Trigger when a deposit is UPDATED (status changes from pending to completed)
exports.onDepositCompleted = functions.firestore
    .document('deposits/{depositId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        // Only trigger when status changes to 'completed' and wasn't completed before
        if (before.status === 'completed' || after.status !== 'completed') {
            return null;
        }
        try {
            await handleDepositCompleted(after, context.params.depositId);
        } catch (err) {
            console.error(`Error in onDepositCompleted for ${context.params.depositId}:`, err);
        }
        return null;
    });