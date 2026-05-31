// deposit.js – handles deposit flow: amount, network, phone, agent, date/time, SMS, screenshot, 24h check
// Assumes Firebase (auth, db, storage) are already initialised globally.

(function() {
    // Wait for DOM and Firebase auth to be ready
    document.addEventListener('DOMContentLoaded', () => {
        // Ensure Firebase services exist
        if (typeof auth === 'undefined' || typeof db === 'undefined' || typeof storage === 'undefined') {
            console.error('Firebase not initialised. Make sure Firebase scripts load before deposit.js');
            return;
        }

        // Wait for user to be authenticated before showing/interacting with the page
        auth.onAuthStateChanged((user) => {
            if (!user) {
                window.location.href = 'login.html';
                return;
            }
            // User is logged in – initialise the deposit UI
            initDepositUI();
        });
    });

    // Global variables for the deposit flow
    let selectedAmount = null;
    let selectedNetwork = null;
    let currentAgent = null;
    let fireworksAnimationId = null;

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

    function initDepositUI() {
        // DOM elements
        const step1Card = document.getElementById('step1Card');
        const step2Card = document.getElementById('step2Card');
        const customAmountInput = document.getElementById('customAmount');
        const amountBtns = document.querySelectorAll('.amount-btn');
        const networkOptions = document.querySelectorAll('.network-option');
        const phoneInput = document.getElementById('phoneNumber');
        const readyCheckbox = document.getElementById('readyToPay');
        const payNowBtn = document.getElementById('payNowBtn');
        const amountError = document.getElementById('amountError');
        const phoneError = document.getElementById('phoneError');
        const agentInfoDiv = document.getElementById('agentInfo');
        const smsTextarea = document.getElementById('smsText');
        const screenshotUpload = document.getElementById('screenshotUpload');
        const verifyBtn = document.getElementById('verifyBtn');
        const verifyMessage = document.getElementById('verifyMessage');
        const fileNameDisplay = document.getElementById('fileNameDisplay');
        const transactionDateInput = document.getElementById('transactionDate');
        const transactionTimeInput = document.getElementById('transactionTime');

        // Set default date/time
        const now = new Date();
        if (transactionDateInput) transactionDateInput.value = now.toISOString().split('T')[0];
        if (transactionTimeInput) transactionTimeInput.value = now.toTimeString().slice(0,5);

        function getFullPhone() {
            const digits = phoneInput.value.trim();
            return digits ? '+260' + digits : '';
        }

        function validatePhone() {
            const digits = phoneInput.value.trim();
            if (!selectedNetwork) return false;
            if (digits.length !== 9 || !/^\d{9}$/.test(digits)) {
                phoneError.innerText = 'Enter exactly 9 digits after +260';
                return false;
            }
            const prefix = digits.substring(0, 2);
            let valid = false;
            if (selectedNetwork === 'mtn') valid = (prefix === '96' || prefix === '76');
            else if (selectedNetwork === 'airtel') valid = (prefix === '97' || prefix === '77' || prefix === '57');
            else if (selectedNetwork === 'zamtel') valid = (prefix === '95' || prefix === '75');
            phoneError.innerText = valid ? '' : `Invalid prefix for ${selectedNetwork.toUpperCase()}.`;
            return valid;
        }

        function validatePayButton() {
            const amountOk = selectedAmount && selectedAmount >= 70;
            const networkOk = selectedNetwork !== null;
            const phoneOk = validatePhone();
            const ready = readyCheckbox.checked;
            payNowBtn.disabled = !(amountOk && networkOk && phoneOk && ready);
        }

        // Amount buttons
        amountBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                selectedAmount = parseInt(btn.dataset.amt);
                customAmountInput.value = selectedAmount;
                amountBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                amountError.innerText = '';
                validatePayButton();
            });
        });

        // Custom amount
        customAmountInput.addEventListener('input', () => {
            let val = parseFloat(customAmountInput.value);
            if (!isNaN(val) && val >= 70) {
                selectedAmount = val;
                amountBtns.forEach(b => b.classList.remove('active'));
                amountError.innerText = '';
            } else {
                selectedAmount = null;
                if (customAmountInput.value !== '') amountError.innerText = 'Minimum amount is 70 ZMW';
            }
            validatePayButton();
        });

        // Network selection
        networkOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                networkOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                selectedNetwork = opt.dataset.network;
                validatePhone();
                validatePayButton();
            });
        });

        // Phone input
        phoneInput.addEventListener('input', () => {
            phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 9);
            validatePhone();
            validatePayButton();
        });

        readyCheckbox.addEventListener('change', validatePayButton);

        // Pay Now button
        payNowBtn.addEventListener('click', () => {
            if (payNowBtn.disabled) return;
            const fullPhone = getFullPhone();
            sessionStorage.setItem('depositAmount', selectedAmount);
            sessionStorage.setItem('depositNetwork', selectedNetwork);
            sessionStorage.setItem('depositPhone', fullPhone);
            sessionStorage.setItem('depositPhoneDigits', phoneInput.value);
            sessionStorage.setItem('depositDate', transactionDateInput.value);
            sessionStorage.setItem('depositTime', transactionTimeInput.value);

            let agentHtml = '';
            if (selectedNetwork === 'mtn') {
                const agents = [
                    { number: '0961391022', name: 'John Kabwe' },
                    { number: '0960338304', name: 'Getrude Sonpo' }
                ];
                const index = Math.floor(Date.now() / 60000) % 2;
                currentAgent = agents[index];
                agentHtml = `<div class="agent-card"><div class="agent-header"> AGENT (MTN)</div><div class="agent-name">${escapeHtml(currentAgent.name)}</div><div><span class="agent-number">${currentAgent.number}</span><button class="copy-number" data-number="${currentAgent.number}">Copy</button></div></div>`;
            } else if (selectedNetwork === 'airtel') {
                currentAgent = { number: '0775552002', name: 'John Kabwe' };
                agentHtml = `<div class="agent-card"><div class="agent-header"> AGENT (Airtel)</div><div class="agent-name">${escapeHtml(currentAgent.name)}</div><div><span class="agent-number">${currentAgent.number}</span><button class="copy-number" data-number="${currentAgent.number}">Copy</button></div></div>`;
            } else if (selectedNetwork === 'zamtel') {
                currentAgent = { number: '0951359357', name: 'Jeremiah Ilunga' };
                agentHtml = `<div class="agent-card"><div class="agent-header"> AGENT (Zamtel)</div><div class="agent-name">${escapeHtml(currentAgent.name)}</div><div><span class="agent-number">${currentAgent.number}</span><button class="copy-number" data-number="${currentAgent.number}">Copy</button></div></div>`;
            }
            agentInfoDiv.innerHTML = agentHtml;
            document.querySelectorAll('.copy-number').forEach(btn => {
                btn.addEventListener('click', () => {
                    navigator.clipboard.writeText(btn.dataset.number);
                    alert('Agent number copied!');
                });
            });
            step1Card.classList.add('hidden');
            step2Card.classList.remove('hidden');
        });

        // File upload display
        if (screenshotUpload) {
            screenshotUpload.addEventListener('change', () => {
                fileNameDisplay.textContent = screenshotUpload.files[0] ? screenshotUpload.files[0].name : 'No file chosen';
            });
            const uploadTrigger = document.getElementById('fileUploadTrigger');
            if (uploadTrigger) uploadTrigger.addEventListener('click', () => screenshotUpload.click());
        }

        // Verification & Firestore submission
        verifyBtn.addEventListener('click', async () => {
            // Disable button to prevent double submission
            verifyBtn.disabled = true;
            const originalBtnText = verifyBtn.innerText;
            verifyBtn.innerText = 'Verifying...';

            const sms = smsTextarea.value;
            const screenshotFile = screenshotUpload.files[0];
            const userDate = transactionDateInput.value;
            const userTime = transactionTimeInput.value;

            // Helper to show error and re-enable button
            function showError(msg) {
                verifyMessage.innerHTML = `<div class="error-msg">${escapeHtml(msg)}</div>`;
                verifyBtn.disabled = false;
                verifyBtn.innerText = originalBtnText;
            }

            if (!sms || !screenshotFile) {
                showError('Please paste SMS and upload screenshot.');
                return;
            }
            if (!userDate || !userTime) {
                showError('Please set the transaction date and time.');
                return;
            }

            const transactionTimestamp = new Date(`${userDate}T${userTime}:00`);
            if (isNaN(transactionTimestamp.getTime())) {
                showError('Invalid date/time format.');
                return;
            }

            const nowTime = new Date();
            const hoursDiff = (nowTime - transactionTimestamp) / (1000 * 60 * 60);
            if (hoursDiff > 24) {
                showError(' This transaction is more than 24 hours old. Please contact support or initiate a new deposit.');
                return;
            }

            verifyMessage.innerHTML = '<div class="loader"></div><div>Verifying...</div>';

            const amount = parseFloat(sessionStorage.getItem('depositAmount'));
            const agent = currentAgent;
            if (!agent) {
                showError(' Agent data missing. Please go back and select payment method again.');
                return;
            }

            const smsLower = sms.toLowerCase();
            const amountMatch = smsLower.includes(amount.toString());
            const agentMatch = smsLower.includes(agent.name.toLowerCase()) || smsLower.includes(agent.number);
            // Optional keyword check (not enforced as error)
            // const hasKeyword = /received|sent|deposit|money|paid|transfer/.test(smsLower);

            if (!amountMatch) {
                showError(' SMS amount does not match your deposit amount.');
                return;
            }
            if (!agentMatch) {
                showError(' SMS does not contain the correct agent name or number.');
                return;
            }

            const user = auth.currentUser;
            if (!user) {
                window.location.href = 'login.html';
                return;
            }
            try {
                const storageRef = storage.ref(`deposits/${user.uid}/${Date.now()}_${screenshotFile.name}`);
                await storageRef.put(screenshotFile);
                const screenshotUrl = await storageRef.getDownloadURL();

                await db.collection('deposits').add({
                    userId: user.uid,
                    amount: amount,
                    paymentMethod: sessionStorage.getItem('depositNetwork'),
                    phone: sessionStorage.getItem('depositPhone'),
                    screenshotUrl: screenshotUrl,
                    status: 'pending',
                    userProvidedTimestamp: firebase.firestore.Timestamp.fromDate(transactionTimestamp),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                showFireworks();
                verifyMessage.innerHTML = '<div class="success-msg"> Your deposit is successful! Wait for admin approval. Redirecting...</div>';
                setTimeout(() => {
                    window.location.href = 'history.html';
                }, 3000);
            } catch (err) {
                console.error(err);
                showError(`Error: ${err.message}`);
                verifyBtn.disabled = false;
                verifyBtn.innerText = originalBtnText;
            }
        });
    }

    // Improved fireworks with proper cleanup and resize handling
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
        for (let i = 0; i < 100; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5 - 2,
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
                ctx.fillRect(p.x, p.y, 4, 4);
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
        // Fallback timeout to avoid infinite animation
        setTimeout(() => {
            if (fireworksAnimationId) {
                cancelAnimationFrame(fireworksAnimationId);
                fireworksAnimationId = null;
                canvas.classList.add('hidden');
                window.removeEventListener('resize', handleResize);
            }
        }, 3000);
    }
})();