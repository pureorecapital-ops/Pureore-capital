// ============================================
// AUTHENTICATION STATE MONITOR (GLOBAL)
// ============================================
auth.onAuthStateChanged(async (user) => {
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.includes('login.html') || currentPath === '/' || currentPath === '/index.html';
    const isRegisterPage = currentPath.includes('register.html');
    const isAdminPage = currentPath.includes('admin-dashboard.html') || currentPath.includes('admin.html');

    if (user) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists && userDoc.data().isBlocked === true) {
                await auth.signOut();
                alert('Your account has been blocked. Contact support.');
                window.location.href = 'login.html';
                return;
            }
            const role = userDoc.exists ? userDoc.data().role : 'user';

            if (isLoginPage || isRegisterPage) {
                if (role === 'admin') {
                    window.location.href = 'admin-dashboard.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            }
        } catch (err) {
            console.error("Error checking user data:", err);
            if (isLoginPage || isRegisterPage) {
                window.location.href = 'dashboard.html';
            }
        }
    } else {
        if (!isLoginPage && !isRegisterPage && !isAdminPage) {
            window.location.href = 'login.html';
        }
    }
});

// ============================================
// LOGIN FORM HANDLER (only if form exists)
// ============================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const messageDiv = document.getElementById('message');

        try {
            await auth.signInWithEmailAndPassword(email, password);
            // Redirect handled by onAuthStateChanged
        } catch (error) {
            let errorMsg = error.message;
            if (error.code === 'auth/user-not-found') errorMsg = 'No account found with this email.';
            if (error.code === 'auth/wrong-password') errorMsg = 'Incorrect password.';
            if (error.code === 'auth/invalid-email') errorMsg = 'Invalid email format.';
            if (messageDiv) {
                messageDiv.innerHTML = `<div class="error">${errorMsg}</div>`;
            } else {
                alert(errorMsg);
            }
        }
    });
}

// ============================================
// REGISTER FORM HANDLER (only if form exists)
// ============================================
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('regFullName').value.trim();
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const referralCode = document.getElementById('regReferralCode').value.trim();
        const messageDiv = document.getElementById('message');

        if (password.length < 6) {
            if (messageDiv) messageDiv.innerHTML = '<div class="error">Password must be at least 6 characters.</div>';
            return;
        }

        try {
            const userCred = await auth.createUserWithEmailAndPassword(email, password);
            const uid = userCred.user.uid;
            const generatedReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

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

            await db.collection('transactions').add({
                userId: uid,
                type: 'bonus',
                amount: 20,
                description: 'Welcome bonus 20 ZMW',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (messageDiv) {
                messageDiv.innerHTML = '<div class="success">✅ Registration successful! Redirecting...</div>';
            }
            // Redirect handled by onAuthStateChanged
        } catch (error) {
            let errorMsg = error.message;
            if (error.code === 'auth/email-already-in-use') errorMsg = 'Email already registered.';
            if (error.code === 'auth/invalid-email') errorMsg = 'Invalid email address.';
            if (error.code === 'auth/weak-password') errorMsg = 'Password is too weak.';
            if (messageDiv) {
                messageDiv.innerHTML = `<div class="error">${errorMsg}</div>`;
            } else {
                alert(errorMsg);
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
// TOGGLE BETWEEN LOGIN & REGISTER FORMS
// ============================================
const showLoginBtn = document.getElementById('showLoginBtn');
const showRegisterBtn = document.getElementById('showRegisterBtn');
if (showLoginBtn && showRegisterBtn) {
    showLoginBtn.addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
        showLoginBtn.classList.add('active');
        showRegisterBtn.classList.remove('active');
    });
    showRegisterBtn.addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
        showRegisterBtn.classList.add('active');
        showLoginBtn.classList.remove('active');
    });
}