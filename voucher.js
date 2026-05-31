// voucher.js – Handles voucher code redemption for Pureore Capital
// This script assumes Firebase (auth, db) is already initialised globally.

(function() {
    // Wait for DOM to load
    document.addEventListener('DOMContentLoaded', () => {
        // Guard: ensure Firebase services are available
        if (typeof auth === 'undefined' || typeof db === 'undefined' || typeof firebase === 'undefined') {
            console.error('Firebase not initialised. Make sure Firebase scripts load before voucher.js');
            return;
        }

        const claimBtn = document.getElementById('claimBtn');
        const messageDiv = document.getElementById('message');

        if (!claimBtn) return;

        function showMessage(msg, isError = true) {
            if (!messageDiv) return;
            // Escape HTML to prevent XSS
            const safeMsg = msg.replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
            messageDiv.innerHTML = `<div class="message ${isError ? 'error' : 'success'}">${safeMsg}</div>`;
            setTimeout(() => {
                if (messageDiv.innerHTML.includes(safeMsg)) messageDiv.innerHTML = '';
            }, 5000);
        }

        claimBtn.addEventListener('click', async () => {
            const userName = document.getElementById('userName').value.trim();
            const userPassword = document.getElementById('userPassword').value;
            const agentNumber = document.getElementById('agentNumber').value.trim();
            const agentName = document.getElementById('agentName').value.trim();
            let voucherCode = document.getElementById('voucherCode').value.trim();

            if (!userName || !userPassword || !agentNumber || !agentName || !voucherCode) {
                showMessage('Please fill in all fields.', true);
                return;
            }

            const user = auth.currentUser;
            if (!user) {
                window.location.href = 'login.html';
                return;
            }

            try {
                // 1. Verify user name from Firestore
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (!userDoc.exists) {
                    showMessage('User profile not found.', true);
                    return;
                }
                const userData = userDoc.data();
                if (userData.fullName !== userName) {
                    showMessage('Name does not match your registered name.', true);
                    return;
                }

                // 2. Re-authenticate user with password
                const credential = firebase.auth.EmailAuthProvider.credential(user.email, userPassword);
                try {
                    await user.reauthenticateWithCredential(credential);
                } catch (err) {
                    showMessage('Incorrect password.', true);
                    return;
                }

                // 3. Verify agent exists in agents collection
                const agentQuery = await db.collection('agents')
                    .where('number', '==', agentNumber)
                    .where('name', '==', agentName)
                    .limit(1)
                    .get();
                if (agentQuery.empty) {
                    showMessage('Agent not found. Please check the number and name.', true);
                    return;
                }

                // 4. Validate voucher code format (10 chars, first 6 = amount, last 4 = letters)
                if (voucherCode.length !== 10) {
                    showMessage('Voucher code must be exactly 10 characters.', true);
                    return;
                }
                const amountPart = voucherCode.substring(0, 6);
                const suffix = voucherCode.substring(6, 10);
                const amountValue = parseFloat(amountPart);
                if (isNaN(amountValue) || amountValue <= 0) {
                    showMessage('Invalid amount in voucher code (first 6 characters).', true);
                    return;
                }
                if (!/^[A-Za-z]{4}$/.test(suffix)) {
                    showMessage('Last 4 characters must be letters (A-Z).', true);
                    return;
                }

                // 5. Check voucher code in Firestore
                const codeQuery = await db.collection('vouchers')
                    .where('code', '==', voucherCode)
                    .limit(1)
                    .get();
                if (codeQuery.empty) {
                    showMessage('Invalid voucher code. No such code exists.', true);
                    return;
                }
                const voucherDoc = codeQuery.docs[0];
                const voucherData = voucherDoc.data();

                if (voucherData.used === true) {
                    showMessage('This voucher code has already been used.', true);
                    return;
                }
                if (Math.abs(voucherData.amount - amountValue) > 0.01) {
                    showMessage('Voucher amount mismatch. Please contact support.', true);
                    return;
                }

                // 6. All checks passed – credit amount to user balance
                claimBtn.disabled = true;
                claimBtn.innerText = 'Processing...';

                await db.runTransaction(async (transaction) => {
                    const userRef = db.collection('users').doc(user.uid);
                    const userSnap = await transaction.get(userRef);
                    const newBalance = (userSnap.data().balance || 0) + amountValue;
                    transaction.update(userRef, { balance: newBalance });
                    transaction.update(voucherDoc.ref, {
                        used: true,
                        usedBy: user.uid,
                        usedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });

                await db.collection('transactions').add({
                    userId: user.uid,
                    type: 'voucher',
                    amount: amountValue,
                    description: `Voucher code: ${voucherCode} (Agent: ${agentName} ${agentNumber})`,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                showMessage(` Success! K${amountValue.toFixed(2)} added to your balance.`, false);
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 2000);
            } catch (err) {
                console.error(err);
                showMessage('Server error. Please try again later.', true);
                claimBtn.disabled = false;
                claimBtn.innerText = ' Redeem Voucher';
            }
        });

        // Bottom navigation active state (if present)
        const navItems = document.querySelectorAll('.nav-item');
        if (navItems.length) {
            const currentPage = window.location.pathname.split('/').pop() || 'vouchers.html';
            navItems.forEach(item => {
                const targetPage = item.getAttribute('data-page');
                if (currentPage === targetPage) item.classList.add('active');
                item.addEventListener('click', () => {
                    if (targetPage && !window.location.pathname.includes(targetPage)) {
                        window.location.href = targetPage;
                    }
                });
            });
        }
    });
})();