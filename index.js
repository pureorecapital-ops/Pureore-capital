const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Trigger when a deposit status changes to 'completed'
exports.onDepositCompleted = functions.firestore
    .document('deposits/{depositId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        // Only trigger when status changes from something else to 'completed'
        if (before.status === 'completed' || after.status !== 'completed') return null;

        const deposit = after;
        const userId = deposit.userId;
        const depositAmount = deposit.amount;

        // 1. Check if this is the user's first completed deposit
        const userDeposits = await admin.firestore()
            .collection('deposits')
            .where('userId', '==', userId)
            .where('status', '==', 'completed')
            .get();
        if (userDeposits.size > 1) return null; // not first deposit

        // 2. Check if user has at least one investment
        const investments = await admin.firestore()
            .collection('investments')
            .where('userId', '==', userId)
            .limit(1)
            .get();
        if (investments.empty) return null;

        // 3. Get user's referral code (who referred them)
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        const referredBy = userDoc.data().referredBy;
        if (!referredBy) return null;

        // 4. Find referrer (the person who owns that referral code)
        const referrerQuery = await admin.firestore()
            .collection('users')
            .where('referralCode', '==', referredBy)
            .limit(1)
            .get();
        if (referrerQuery.empty) return null;
        const referrer = referrerQuery.docs[0];
        const referrerId = referrer.id;

        // 5. Check if bonus already given for this referred user
        const existingBonus = await admin.firestore()
            .collection('referralEarnings')
            .where('referrerId', '==', referrerId)
            .where('referredUserId', '==', userId)
            .get();
        if (!existingBonus.empty) return null;

        // 6. Calculate bonus (5% of deposit amount)
        const bonusAmount = depositAmount * 0.05;

        // 7. Run transaction to add bonus and record earnings
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
                depositId: context.params.depositId,
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

        console.log(`Bonus K${bonusAmount} added to referrer ${referrerId}`);
        return null;
    });