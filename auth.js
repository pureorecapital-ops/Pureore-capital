// ============================================
// AUTHENTICATION STATE MONITOR (GLOBAL)
// ============================================
auth.onAuthStateChanged(async (user) => {
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.includes('login.html') || currentPath === '/' || currentPath === '/index.html';
    const isRegisterPage = currentPath.includes('register.html');
    const isAdminPage = currentPath.includes('admin-dashboard.html') || currentPath.includes('admin.html');

    // If not logged in
    if (!user) {
        // Redirect to login unless already on public pages
        if (!isLoginPage && !isRegisterPage && !isAdminPage) {
            window.location.href = 'login.html';
        }
        return;
    }

    // User is logged in
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        // Check if blocked
        if (userDoc.exists && userDoc.data().isBlocked === true) {
            await auth.signOut();
            alert('Your account has been blocked. Contact support.');
            window.location.href = 'login.html';
            return;
        }
        
        const role = userDoc.exists ? userDoc.data().role : 'user';

        // --- Admin pages: only allow admins ---
        if (isAdminPage && role !== 'admin') {
            window.location.href = 'dashboard.html';
            return;
        }

        // --- Login/register pages: redirect based on role ---
        if (isLoginPage || isRegisterPage) {
            if (role === 'admin') {
                window.location.href = 'admin-dashboard.html';
            } else {
                window.location.href = 'dashboard.html';
            }
            return;
        }
        
    } catch (err) {
        console.error("Error checking user data:", err);
        if (isLoginPage || isRegisterPage) {
            window.location.href = 'dashboard.html';
        }
    }
});

// ============================================
// HELPER: ESCAPE HTML
// ============================================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ============================================
// LOGIN FORM HANDLER (with loading state)
// ============================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    const loginBtn = loginForm.querySelector('button[type="submit"]');
    const originalBtnText = loginBtn ? loginBtn.innerText : 'Login';
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const messageDiv = document.getElementById('message');

        // Disable button and show loading
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerText = 'Logging in...';
        }
        if (messageDiv) messageDiv.innerHTML = '';

        try {
            await auth.signInWithEmailAndPassword(email, password);
            // Redirect handled by onAuthStateChanged
        } catch (error) {
            let errorMsg = error.message;
            if (error.code === 'auth/user-not-found') errorMsg = 'No account found with this email.';
            if (error.code === 'auth/wrong-password') errorMsg = 'Incorrect password.';
            if (error.code === 'auth/invalid-email') errorMsg = 'Invalid email format.';
            if (error.code === 'auth/too-many-requests') errorMsg = 'Too many failed attempts. Try again later.';
            if (messageDiv) {
                messageDiv.innerHTML = `<div class="error">${escapeHtml(errorMsg)}</div>`;
            } else {
                alert(errorMsg);
            }
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerText = originalBtnText;
            }
        }
    });
}

// ============================================
// REGISTER FORM HANDLER (with URL ref auto-fill & loading state)
// ============================================
// Auto-fill referral code from URL parameter ?ref=CODE
(function autoFillReferralCode() {
    const referralInput = document.getElementById('regReferralCode');
    if (referralInput) {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        if (refCode) {
            referralInput.value = refCode;
            // Optional: show a small message
            const note = document.querySelector('.note');
            if (note && note.innerHTML.includes('referral code')) {
                note.innerHTML = '💡 Referral code automatically filled from your invitation link.';
            }
        }
    }
})();

const registerForm = document.getElementById('registerForm');
if (registerForm) {
    const registerBtn = registerForm.querySelector('button[type="submit"]');
    const originalRegisterText = registerBtn ? registerBtn.innerText : 'Register';
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('regFullName').value.trim();
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword');
        const referralCode = document.getElementById('regReferralCode').value.trim();
        const messageDiv = document.getElementById('message');

        // Disable button and show loading
        if (registerBtn) {
            registerBtn.disabled = true;
            registerBtn.innerText = 'Creating account...';
        }
        if (messageDiv) messageDiv.innerHTML = '';

        // Validation
        if (!fullName) {
            if (messageDiv) messageDiv.innerHTML = '<div class="error">Please enter your full name.</div>';
            if (registerBtn) { registerBtn.disabled = false; registerBtn.innerText = originalRegisterText; }
            return;
        }
        if (password.length < 6) {
            if (messageDiv) messageDiv.innerHTML = '<div class="error">Password must be at least 6 characters.</div>';
            if (registerBtn) { registerBtn.disabled = false; registerBtn.innerText = originalRegisterText; }
            return;
        }
        if (confirmPassword && password !== confirmPassword.value) {
            if (messageDiv) messageDiv.innerHTML = '<div class="error">Passwords do not match.</div>';
            if (registerBtn) { registerBtn.disabled = false; registerBtn.innerText = originalRegisterText; }
            return;
        }

        // Optional: validate referral code exists
        if (referralCode) {
            try {
                const referrerQuery = await db.collection('users').where('referralCode', '==', referralCode).get();
                if (referrerQuery.empty) {
                    if (messageDiv) messageDiv.innerHTML = '<div class="error">Invalid referral code.</div>';
                    if (registerBtn) { registerBtn.disabled = false; registerBtn.innerText = originalRegisterText; }
                    return;
                }
            } catch (err) {
                console.warn("Referral check failed:", err);
                // Continue anyway – optional check
            }
        }

        try {
            // 1. Create auth user
            const userCred = await auth.createUserWithEmailAndPassword(email, password);
            const uid = userCred.user.uid;
            const generatedReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

            // 2. Create Firestore user document
            await db.collection('users').doc(uid).set({
                fullName: fullName,
                email: email,
                balance: 20,
                referralCode: generatedReferralCode,
                referredBy: referralCode || null,
                role: 'user',
                isBlocked: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 3. Record welcome bonus transaction
            await db.collection('transactions').add({
                userId: uid,
                type: 'bonus',
                amount: 20,
                description: 'Welcome bonus 20 ZMW',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 4. Show success message
            if (messageDiv) {
                messageDiv.innerHTML = '<div class="success">✅ Registration successful! Redirecting...</div>';
            }

            // 5. Explicitly redirect to dashboard
            window.location.href = 'dashboard.html';

        } catch (error) {
            let errorMsg = error.message;
            if (error.code === 'auth/email-already-in-use') errorMsg = 'Email already registered.';
            if (error.code === 'auth/invalid-email') errorMsg = 'Invalid email address.';
            if (error.code === 'auth/weak-password') errorMsg = 'Password is too weak. Use at least 6 characters.';
            if (messageDiv) {
                messageDiv.innerHTML = `<div class="error">❌ ${escapeHtml(errorMsg)}</div>`;
            } else {
                alert(errorMsg);
            }
            if (registerBtn) {
                registerBtn.disabled = false;
                registerBtn.innerText = originalRegisterText;
            }
        }
    });
}

// ============================================
// LOGOUT BUTTON
// ============================================
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await auth.signOut();
        window.location.href = 'login.html';
    });
}

// ============================================
// TOGGLE BETWEEN LOGIN & REGISTER FORMS (safe)
// ============================================
const showLoginBtn = document.getElementById('showLoginBtn');
const showRegisterBtn = document.getElementById('showRegisterBtn');
const loginFormElem = document.getElementById('loginForm');
const registerFormElem = document.getElementById('registerForm');

if (showLoginBtn && showRegisterBtn && loginFormElem && registerFormElem) {
    showLoginBtn.addEventListener('click', () => {
        loginFormElem.style.display = 'block';
        registerFormElem.style.display = 'none';
        showLoginBtn.classList.add('active');
        showRegisterBtn.classList.remove('active');
    });
    showRegisterBtn.addEventListener('click', () => {
        loginFormElem.style.display = 'none';
        registerFormElem.style.display = 'block';
        showRegisterBtn.classList.add('active');
        showLoginBtn.classList.remove('active');
    });
} else {
    // If toggle buttons are missing but both forms exist, default to showing login
    if (loginFormElem && registerFormElem && registerFormElem.style.display !== 'none') {
        loginFormElem.style.display = 'block';
        registerFormElem.style.display = 'none';
    }
}