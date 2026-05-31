// withdraw.js – handles withdrawal eligibility, network selection, discount calculation, active loan check, weekend restriction, and Firestore submission
// This script assumes Firebase (auth, db, firebase) is already initialised globally.

(function() {
    // Wait for DOM to load
    document.addEventListener('DOMContentLoaded', () => {
        // Guard: ensure Firebase services are available
        if (typeof auth === 'undefined' || typeof db === 'undefined' || typeof firebase === 'undefined') {
            console.error('Firebase not initialised. Make sure Firebase scripts load before withdraw.js');
            return;
        }

        // DOM elements
        const networkSelect = document.getElementById('networkSelect');
        const mobileGroup = document.getElementById('mobileInputGroup');
        const bankGroup = document.getElementById('bankInputGroup');
        const phoneInput = document.getElementById('phoneNumber');
        const bankCardInput = document.getElementById('bankCardNumber');
        const withdrawAmountInput = document.getElementById('withdrawAmount');
        const discountCard = document.getElementById('discountCard');
        const discountSpan = document.getElementById('discountValue');
        const netAmountSpan = document.getElementById('netAmount');
        const confirmBtn = document.getElementById('confirmWithdrawBtn');
        const phoneErrorDiv = document.getElementById('phoneError');
        const cardErrorDiv = document.getElementById('cardError');
        const amountErrorDiv = document.getElementById('amountError');
        const generalErrorDiv = document.getElementById('generalError');

        let selectedNetwork = '';
        let selectedBank = '';
        let currentAmount = 0;
        let netAfterFee = 0;
        let fireworksAnimationId = null;

        // Bank chip selection
        const bankChips = document.querySelectorAll('.bank-chip');
        bankChips.forEach(chip => {
            chip.addEventListener('click', () => {
                bankChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                selectedBank = chip.dataset.bank;
                validateBankCard();
                validateForm();
            });
        });

        // Network switch
        networkSelect.addEventListener('change', () => {
            selectedNetwork = networkSelect.value;
            if (selectedNetwork === 'bank') {
                mobileGroup.classList.add('hidden');
                bankGroup.classList.remove('hidden');
            } else if (selectedNetwork === 'mtn' || selectedNetwork === 'airtel' || selectedNetwork === 'zamtel') {
                mobileGroup.classList.remove('hidden');
                bankGroup.classList.add('hidden');
                selectedBank = '';
                bankChips.forEach(c => c.classList.remove('active'));
            } else {
                mobileGroup.classList.add('hidden');
                bankGroup.classList.add('hidden');
            }
            validatePhone();
            validateForm();
        });

        // Phone validation (9 digits, prefix checks per network)
        function validatePhone() {
            if (!selectedNetwork || selectedNetwork === 'bank') return true;
            const digits = phoneInput.value.trim();
            if (digits.length !== 9 || !/^\d{9}$/.test(digits)) {
                phoneErrorDiv.innerText = 'Enter exactly 9 digits after +260';
                return false;
            }
            const prefix = digits.substring(0, 2);
            let valid = false;
            if (selectedNetwork === 'mtn') valid = (prefix === '96' || prefix === '76');
            else if (selectedNetwork === 'airtel') valid = (prefix === '97' || prefix === '77' || prefix === '57');
            else if (selectedNetwork === 'zamtel') valid = (prefix === '95' || prefix === '75');
            phoneErrorDiv.innerText = valid ? '' : `Invalid prefix for ${selectedNetwork.toUpperCase()}.`;
            return valid;
        }

        // Bank card validation: exactly 16 digits
        function validateBankCard() {
            if (selectedNetwork !== 'bank') return true;
            const card = bankCardInput.value.trim();
            if (card.length !== 16 || !/^\d{16}$/.test(card)) {
                cardErrorDiv.innerText = 'Enter exactly 16 digits';
                return false;
            }
            if (!selectedBank) {
                cardErrorDiv.innerText = 'Please select a bank';
                return false;
            }
            cardErrorDiv.innerText = '';
            return true;
        }

        phoneInput.addEventListener('input', () => {
            phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 9);
            validatePhone();
            validateForm();
        });
        bankCardInput.addEventListener('input', () => {
            bankCardInput.value = bankCardInput.value.replace(/\D/g, '').slice(0, 16);
            validateBankCard();
            validateForm();
        });

        // Amount + discount
        withdrawAmountInput.addEventListener('input', () => {
            let amount = parseFloat(withdrawAmountInput.value);
            if (isNaN(amount)) amount = 0;
            if (amount < 20 && amount !== 0) {
                amountErrorDiv.innerText = 'Minimum withdrawal amount is 20 ZMW';
            } else {
                amountErrorDiv.innerText = '';
            }
            if (amount >= 20) {
                const discount = amount * 0.2;
                const net = amount - discount;
                discountSpan.innerText = discount.toFixed(2);
                netAmountSpan.innerText = net.toFixed(2);
                discountCard.classList.remove('hidden');
                currentAmount = amount;
                netAfterFee = net;
            } else {
                discountCard.classList.add('hidden');
                currentAmount = 0;
                netAfterFee = 0;
            }
            validateForm();
        });

        // Check if user has any active loan
        async function hasActiveLoan(userId) {
            const loansSnapshot = await db.collection('loans')
                .where('userId', '==', userId)
                .where('status', '==', 'active')
                .limit(1)
                .get();
            return !loansSnapshot.empty;
        }

        // Check if today is weekend (Saturday or Sunday)
        function isWeekend() {
            const today = new Date();
            const day = today.getDay(); // 0 = Sunday, 6 = Saturday
            return day === 0 || day === 6;
        }

        // Eligibility: completed deposit, any investment, no active loan
        async function checkEligibility(userId) {
            const depositsQuery = await db.collection('deposits')
                .where('userId', '==', userId)
                .where('status', '==', 'completed')
                .limit(1)
                .get();
            const hasDeposit = !depositsQuery.empty;
            const investmentsQuery = await db.collection('investments')
                .where('userId', '==', userId)
                .limit(1)
                .get();
            const hasInvestment = !investmentsQuery.empty;
            const activeLoan = await hasActiveLoan(userId);
            return { hasDeposit, hasInvestment, activeLoan };
        }

        function validateForm() {
            const networkOk = selectedNetwork !== '';
            let contactOk = false;
            if (selectedNetwork === 'bank') {
                contactOk = validateBankCard() && selectedBank !== '';
            } else if (selectedNetwork === 'mtn' || selectedNetwork === 'airtel' || selectedNetwork === 'zamtel') {
                contactOk = validatePhone() && phoneInput.value.length === 9;
            }
            const amountOk = currentAmount >= 20;
            confirmBtn.disabled = !(networkOk && contactOk && amountOk);
        }

        // Fireworks helper with cleanup
        function showFireworks() {
            const canvas = document.getElementById('fireworks');
            if (!canvas) return;
            if (fireworksAnimationId) {
                cancelAnimationFrame(fireworksAnimationId);
                fireworksAnimationId = null;
            }
            canvas.classList.remove('hidden');
            const ctx = canvas.getContext('2d');
            let width = window.innerWidth;
            let height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
            const handleResize = () => {
                width = window.innerWidth;
                height = window.innerHeight;
                canvas.width = width;
                canvas.height = height;
            };
            window.addEventListener('resize', handleResize);
            let particles = [];
            for (let i = 0; i < 120; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.5) * 6 - 2,
                    life: 1,
                    color: `hsl(${Math.random() * 360}, 100%, 60%)`
                });
            }
            function animate() {
                ctx.clearRect(0, 0, width, height);
                let anyAlive = false;
                for (let p of particles) {
                    if (p.life <= 0) continue;
                    anyAlive = true;
                    p.x += p.vx;
                    p.y += p.vy;
                    p.life -= 0.02;
                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = p.color;
                    ctx.fillRect(p.x, p.y, 5, 5);
                }
                if (anyAlive) {
                    fireworksAnimationId = requestAnimationFrame(animate);
                } else {
                    canvas.classList.add('hidden');
                    window.removeEventListener('resize', handleResize);
                    fireworksAnimationId = null;
                    ctx.clearRect(0, 0, width, height);
                }
            }
            fireworksAnimationId = requestAnimationFrame(animate);
            setTimeout(() => {
                if (fireworksAnimationId) {
                    cancelAnimationFrame(fireworksAnimationId);
                    fireworksAnimationId = null;
                    canvas.classList.add('hidden');
                    window.removeEventListener('resize', handleResize);
                }
            }, 3000);
        }

        // Confirm withdrawal
        confirmBtn.addEventListener('click', async () => {
            if (confirmBtn.disabled) return;
            generalErrorDiv.innerText = '';
            confirmBtn.disabled = true;
            confirmBtn.innerText = 'Checking eligibility...';

            // Weekend restriction
            if (isWeekend()) {
                generalErrorDiv.innerText = '❌ Withdrawals are only allowed Monday–Friday. Please try again on a weekday.';
                confirmBtn.disabled = false;
                confirmBtn.innerText = 'Confirm Withdrawal';
                return;
            }

            const user = auth.currentUser;
            if (!user) {
                window.location.href = 'login.html';
                return;
            }
            const { hasDeposit, hasInvestment, activeLoan } = await checkEligibility(user.uid);
            if (!hasDeposit) {
                generalErrorDiv.innerText = '❌ You must make a completed deposit before withdrawing.';
                confirmBtn.disabled = false;
                confirmBtn.innerText = 'Confirm Withdrawal';
                return;
            }
            if (!hasInvestment) {
                generalErrorDiv.innerText = '❌ You must purchase at least one investment plan before withdrawing.';
                confirmBtn.disabled = false;
                confirmBtn.innerText = 'Confirm Withdrawal';
                return;
            }
            if (activeLoan) {
                generalErrorDiv.innerText = '❌ You have an active loan. You must repay it before withdrawing.';
                confirmBtn.disabled = false;
                confirmBtn.innerText = 'Confirm Withdrawal';
                return;
            }

            let withdrawData = {
                userId: user.uid,
                amount: currentAmount,
                netAmount: netAfterFee,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                network: selectedNetwork
            };
            if (selectedNetwork === 'bank') {
                withdrawData.bankName = selectedBank;
                withdrawData.cardNumber = bankCardInput.value.trim();
            } else {
                withdrawData.phone = '+260' + phoneInput.value.trim();
            }

            confirmBtn.innerText = 'Submitting...';
            try {
                await db.collection('withdrawals').add(withdrawData);
                showFireworks();
                generalErrorDiv.style.color = '#2ecc71';
                generalErrorDiv.innerText = '🎉 Withdrawal request submitted! Redirecting to history...';
                setTimeout(() => {
                    window.location.href = 'history.html';
                }, 3000);
            } catch (err) {
                generalErrorDiv.style.color = '#ef4444';
                generalErrorDiv.innerText = 'Error: ' + err.message;
                confirmBtn.disabled = false;
                confirmBtn.innerText = 'Confirm Withdrawal';
            }
        });
    });
})();