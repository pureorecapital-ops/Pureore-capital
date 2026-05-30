// deposit.js – handles deposit flow: amount, network, phone, agent, date/time, SMS, screenshot, 24h check

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

let selectedAmount = null;
let selectedNetwork = null;
let currentAgent = null;

// Set default date/time to current moment
const now = new Date();
if (transactionDateInput) transactionDateInput.value = now.toISOString().split('T')[0];
if (transactionTimeInput) transactionTimeInput.value = now.toTimeString().slice(0,5);

// Helper: get full phone with +260
function getFullPhone() {
    const digits = phoneInput.value.trim();
    return digits ? '+260' + digits : '';
}

// Validate phone digits (9 digits + prefix per network)
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
    if (!valid) {
        phoneError.innerText = `Invalid number for ${selectedNetwork.toUpperCase()}. Must start with appropriate prefix.`;
    } else {
        phoneError.innerText = '';
    }
    return valid;
}

// Enable/disable Pay Now button
function validatePayButton() {
    const amountOk = selectedAmount && selectedAmount >= 70;
    const networkOk = selectedNetwork !== null;
    const phoneOk = validatePhone();
    const ready = readyCheckbox.checked;
    payNowBtn.disabled = !(amountOk && networkOk && phoneOk && ready);
}

// Amount button clicks
amountBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.amt);
        selectedAmount = val;
        customAmountInput.value = val;
        amountBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        amountError.innerText = '';
        validatePayButton();
    });
});

// Custom amount input
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

// Phone input formatting & validation
phoneInput.addEventListener('input', () => {
    phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 9);
    validatePhone();
    validatePayButton();
});

readyCheckbox.addEventListener('change', validatePayButton);

// Pay Now: store session data, show agent info and second card
payNowBtn.addEventListener('click', async () => {
    if (payNowBtn.disabled) return;
    const fullPhone = getFullPhone();
    sessionStorage.setItem('depositAmount', selectedAmount);
    sessionStorage.setItem('depositNetwork', selectedNetwork);
    sessionStorage.setItem('depositPhone', fullPhone);
    sessionStorage.setItem('depositPhoneDigits', phoneInput.value);

    // Store default date/time (user can still modify)
    const defaultDate = transactionDateInput.value;
    const defaultTime = transactionTimeInput.value;
    sessionStorage.setItem('depositDate', defaultDate);
    sessionStorage.setItem('depositTime', defaultTime);

    let agentHtml = '';
    if (selectedNetwork === 'mtn') {
        const agents = [
            { number: '0961391022', name: 'John Kabwe' },
            { number: '0960338304', name: 'Getrude Sonpo' }
        ];
        const index = Math.floor(Date.now() / 60000) % 2;
        currentAgent = agents[index];
        agentHtml = `
            <div class="agent-card">
                <div class="agent-header"> AGENT (MTN)</div>
                <div class="agent-name">${currentAgent.name}</div>
                <div>
                    <span class="agent-number">${currentAgent.number}</span>
                    <button class="copy-number" data-number="${currentAgent.number}">Copy</button>
                </div>
            </div>
        `;
    } else if (selectedNetwork === 'airtel') {
        currentAgent = { number: '0775552002', name: 'John Kabwe' };
        agentHtml = `
            <div class="agent-card">
                <div class="agent-header"> AGENT (Airtel)</div>
                <div class="agent-name">${currentAgent.name}</div>
                <div>
                    <span class="agent-number">${currentAgent.number}</span>
                    <button class="copy-number" data-number="${currentAgent.number}">Copy</button>
                </div>
            </div>
        `;
    } else if (selectedNetwork === 'zamtel') {
        currentAgent = { number: '0951359357', name: 'Jeremiah Ilunga' };
        agentHtml = `
            <div class="agent-card">
                <div class="agent-header"> AGENT (Zamtel)</div>
                <div class="agent-name">${currentAgent.name}</div>
                <div>
                    <span class="agent-number">${currentAgent.number}</span>
                    <button class="copy-number" data-number="${currentAgent.number}">Copy</button>
                </div>
            </div>
        `;
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
        if (screenshotUpload.files.length > 0) {
            fileNameDisplay.textContent = screenshotUpload.files[0].name;
        } else {
            fileNameDisplay.textContent = 'No file chosen';
        }
    });
    document.getElementById('fileUploadTrigger')?.addEventListener('click', () => {
        screenshotUpload.click();
    });
}

// Verification & Firestore submission with 24-hour check
verifyBtn.addEventListener('click', async () => {
    const sms = smsTextarea.value;
    const screenshotFile = screenshotUpload.files[0];
    const userDate = transactionDateInput.value;
    const userTime = transactionTimeInput.value;

    if (!sms || !screenshotFile) {
        verifyMessage.innerHTML = '<div class="error-msg">Please paste SMS and upload screenshot.</div>';
        return;
    }
    if (!userDate || !userTime) {
        verifyMessage.innerHTML = '<div class="error-msg">Please set the transaction date and time.</div>';
        return;
    }

    // Combine date and time into a timestamp
    const transactionTimestamp = new Date(`${userDate}T${userTime}:00`);
    if (isNaN(transactionTimestamp.getTime())) {
        verifyMessage.innerHTML = '<div class="error-msg">Invalid date/time format.</div>';
        return;
    }

    // Check if transaction is older than 24 hours
    const now = new Date();
    const hoursDiff = (now - transactionTimestamp) / (1000 * 60 * 60);
    if (hoursDiff > 24) {
        verifyMessage.innerHTML = '<div class="error-msg"> This transaction is more than 24 hours old. Please contact support or initiate a new deposit.</div>';
        return;
    }

    verifyMessage.innerHTML = '<div class="loader"></div><div>Verifying...</div>';

    const amount = parseFloat(sessionStorage.getItem('depositAmount'));
    const agent = currentAgent;

    const smsLower = sms.toLowerCase();
    // 1. Amount must appear
    const amountMatch = smsLower.includes(amount.toString());
    // 2. Agent name OR number must appear
    const agentMatch = smsLower.includes(agent.name.toLowerCase()) || smsLower.includes(agent.number);
    // 3. Optional keyword check (warning only)
    const hasKeyword = /received|sent|deposit|money|paid|transfer/.test(smsLower);

    if (!amountMatch) {
        verifyMessage.innerHTML = '<div class="error-msg"> SMS amount does not match your deposit amount.</div>';
        return;
    }
    if (!agentMatch) {
        verifyMessage.innerHTML = '<div class="error-msg"> SMS does not contain the correct agent name or number.</div>';
        return;
    }
    if (!hasKeyword) {
        console.log("Warning: No transaction keyword found, but verification passed.");
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
        verifyMessage.innerHTML = `<div class="error-msg">Error: ${err.message}</div>`;
    }
});

// Fireworks effect (simple canvas)
function showFireworks() {
    const canvas = document.getElementById('fireworks');
    if (!canvas) return;
    canvas.classList.remove('hidden');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let particles = [];
    for (let i = 0; i < 100; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5 - 2,
            life: 1,
            color: `hsl(${Math.random() * 360}, 100%, 60%)`
        });
    }
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let allDead = true;
        for (let p of particles) {
            if (p.life <= 0) continue;
            allDead = false;
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 4, 4);
        }
        if (!allDead) requestAnimationFrame(animate);
        else {
            canvas.classList.add('hidden');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    animate();
    setTimeout(() => canvas.classList.add('hidden'), 2000);
}