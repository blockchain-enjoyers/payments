    // ============================================
    // AUTH MODAL
    // ============================================
    var isAuthenticated = false;
    var _authCallback = null;

    function openAuthModal(callback) {
      if (isAuthenticated) {
        if (callback) callback();
        return;
      }
      _authCallback = callback || null;
      document.getElementById('auth-modal').classList.add('active');
      document.getElementById('email-input').focus();
    }

    function closeAuthModal() {
      document.getElementById('auth-modal').classList.remove('active');
      _authCallback = null;
    }

    function authenticate() {
      if (isProd()) {
        authenticateProd();
        return;
      }
      // Demo mode — instant fake auth
      isAuthenticated = true;
      var cb = _authCallback;
      _authCallback = null;
      document.getElementById('auth-modal').classList.remove('active');

      // Switch to auth state
      document.getElementById('nav-connect').style.display = 'none';
      document.getElementById('nav-balance').style.display = 'block';
      document.getElementById('wallet-pill').style.display = 'flex';

      // Show activity + shift layout
      document.getElementById('main').classList.add('auth-active');
      document.getElementById('activity').style.display = 'block';

      // Continue the interrupted action
      if (cb) cb();
    }

    function authenticateRegister() {
      if (isProd()) {
        authenticateProdRegister();
        return;
      }
      // Demo mode — same as login
      authenticate();
    }

    async function authenticateProdRegister() {
      var emailInput = document.getElementById('email-input');
      var username = emailInput ? emailInput.value.trim() : '';
      if (!username) {
        showToast('Please enter your email');
        return;
      }
      try {
        await passkeyRegister(username);
      } catch (e) {
        showToast('Registration failed: ' + e.message);
        console.error('Register error:', e);
      }
    }

    async function authenticateProd() {
      var emailInput = document.getElementById('email-input');
      var username = emailInput ? emailInput.value.trim() : '';
      if (!username) {
        showToast('Please enter your email');
        return;
      }

      try {
        // 1. Get WebAuthn options from server
        var existsRes;
        try {
          // Try login first — if user exists, we do login flow
          existsRes = await apiPost('auth/passkey/options', { mode: 'login', username: username });
        } catch (e) {
          // User doesn't exist → register flow
          existsRes = null;
        }

        if (existsRes && existsRes.challenge) {
          // LOGIN flow
          await passkeyLogin(username, existsRes);
        } else {
          // REGISTER flow
          await passkeyRegister(username);
        }
      } catch (e) {
        showToast('Auth failed: ' + e.message);
        console.error('Auth error:', e);
      }
    }

    async function passkeyRegister(username) {
      // 1. Get registration options
      var options = await apiPost('auth/passkey/options', { mode: 'register', username: username });

      // 2. Create credential via WebAuthn
      var publicKeyOptions = {
        challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), function(c) { return c.charCodeAt(0); }),
        rp: { name: options.rp.name, id: options.rp.id },
        user: {
          id: Uint8Array.from(atob(options.user.id.replace(/-/g, '+').replace(/_/g, '/')), function(c) { return c.charCodeAt(0); }),
          name: options.user.name,
          displayName: options.user.displayName
        },
        pubKeyCredParams: options.pubKeyCredParams,
        timeout: options.timeout || 60000,
        attestation: options.attestation || 'none',
        authenticatorSelection: options.authenticatorSelection
      };
      if (options.excludeCredentials) {
        publicKeyOptions.excludeCredentials = options.excludeCredentials.map(function(c) {
          return { type: c.type, id: Uint8Array.from(atob(c.id.replace(/-/g, '+').replace(/_/g, '/')), function(ch) { return ch.charCodeAt(0); }) };
        });
      }

      var credential = await navigator.credentials.create({ publicKey: publicKeyOptions });

      // 3. Encode response
      var credentialData = {
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          attestationObject: bufferToBase64url(credential.response.attestationObject),
          clientDataJSON: bufferToBase64url(credential.response.clientDataJSON)
        }
      };
      if (credential.authenticatorAttachment) {
        credentialData.authenticatorAttachment = credential.authenticatorAttachment;
      }

      // 4. Extract public key from attestation for Circle MSCA
      var publicKeyBytes = extractPublicKeyFromAttestation(credential.response);
      var publicKeyHex = '0x' + Array.from(new Uint8Array(publicKeyBytes)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');

      // 5. Register with backend
      var result = await apiPost('auth/register', {
        username: username,
        credential: credentialData,
        publicKey: publicKeyHex
      });

      AUTH_TOKEN = result.accessToken || result.token;
      localStorage.setItem('omniflow_token', AUTH_TOKEN);
      CURRENT_USER = result.user || result;
      isAuthenticated = true;

      document.getElementById('auth-modal').classList.remove('active');
      applyAuthUI(CURRENT_USER);
      showToast('Registered successfully!');

      var cb = _authCallback;
      _authCallback = null;
      if (cb) cb();
    }

    async function passkeyLogin(username, options) {
      // 1. Build assertion request
      var publicKeyOptions = {
        challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), function(c) { return c.charCodeAt(0); }),
        rpId: options.rpId,
        timeout: options.timeout || 60000,
        userVerification: options.userVerification || 'preferred'
      };
      if (options.allowCredentials && options.allowCredentials.length > 0) {
        publicKeyOptions.allowCredentials = options.allowCredentials.map(function(c) {
          return { type: c.type || 'public-key', id: Uint8Array.from(atob(c.id.replace(/-/g, '+').replace(/_/g, '/')), function(ch) { return ch.charCodeAt(0); }) };
        });
      }

      var assertion = await navigator.credentials.get({ publicKey: publicKeyOptions });

      // 2. Encode response
      var credentialData = {
        id: assertion.id,
        rawId: bufferToBase64url(assertion.rawId),
        type: assertion.type,
        response: {
          authenticatorData: bufferToBase64url(assertion.response.authenticatorData),
          clientDataJSON: bufferToBase64url(assertion.response.clientDataJSON),
          signature: bufferToBase64url(assertion.response.signature)
        }
      };
      if (assertion.response.userHandle) {
        credentialData.response.userHandle = bufferToBase64url(assertion.response.userHandle);
      }
      if (assertion.authenticatorAttachment) {
        credentialData.authenticatorAttachment = assertion.authenticatorAttachment;
      }

      // 3. Login with backend
      var result = await apiPost('auth/login', {
        username: username,
        credential: credentialData
      });

      AUTH_TOKEN = result.accessToken || result.token;
      localStorage.setItem('omniflow_token', AUTH_TOKEN);
      CURRENT_USER = result.user || result;
      isAuthenticated = true;

      document.getElementById('auth-modal').classList.remove('active');
      applyAuthUI(CURRENT_USER);
      showToast('Logged in successfully!');

      var cb = _authCallback;
      _authCallback = null;
      if (cb) cb();
    }

    // ---- WebAuthn utility functions ----
    function bufferToBase64url(buffer) {
      var bytes = new Uint8Array(buffer);
      var str = '';
      for (var i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
      return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    function extractPublicKeyFromAttestation(response) {
      if (!response.getPublicKey) return new Uint8Array(0);
      var spkiBytes = new Uint8Array(response.getPublicKey());
      // SPKI for P-256 has 26-byte header, then 65-byte uncompressed point (04 + x + y)
      // Header: 3059301306072a8648ce3d020106082a8648ce3d03010703420004
      if (spkiBytes.length === 91) {
        return spkiBytes.slice(26); // raw uncompressed point: 04 + 32x + 32y = 65 bytes
      }
      return spkiBytes;
    }

    // Close modal on overlay click
    document.getElementById('auth-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeAuthModal();
    });

    // Close modal + dropdowns on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAuthModal();
        if (typeof topupCloseAllDropdowns === 'function') topupCloseAllDropdowns();
        if (typeof payinCloseAllDropdowns === 'function') payinCloseAllDropdowns();
      }
    });


    /**
     * Sign a hex hash with WebAuthn passkey.
     * Returns { signature: '0x{r}{s}', webauthn: { authenticatorData, clientDataJSON, challengeIndex, typeIndex } }
     * Compatible with Kernel passkey validator format.
     */
    async function signHashWithPasskey(hash) {
      var hexClean = hash.startsWith('0x') ? hash.slice(2) : hash;
      var challenge = hexToBytes(hexClean);

      var publicKeyOptions = {
        challenge: challenge,
        rpId: window.location.hostname,
        userVerification: 'required',
        timeout: 120000,
      };

      // Pre-select the user's credential so browser doesn't show picker
      var credId = CURRENT_USER && CURRENT_USER.credentialId;
      if (credId) {
        var rawId = Uint8Array.from(atob(credId.replace(/-/g, '+').replace(/_/g, '/')), function(c) { return c.charCodeAt(0); });
        publicKeyOptions.allowCredentials = [{ type: 'public-key', id: rawId }];
      }

      var assertion = await navigator.credentials.get({ publicKey: publicKeyOptions });

      // Convert DER signature to r||s (64 bytes each, zero-padded)
      var derSig = new Uint8Array(assertion.response.signature);
      var rs = derToRS(derSig);
      var sigHex = '0x' + bytesToHex(rs.r, 32) + bytesToHex(rs.s, 32);

      // authenticatorData as hex
      var authDataHex = '0x' + bytesToHex(new Uint8Array(assertion.response.authenticatorData));

      // clientDataJSON as string
      var clientDataStr = new TextDecoder().decode(assertion.response.clientDataJSON);

      // Find challengeIndex and typeIndex in clientDataJSON
      var challengeIndex = clientDataStr.indexOf('"challenge"');
      var typeIndex = clientDataStr.indexOf('"type"');

      return {
        signature: sigHex,
        webauthn: {
          authenticatorData: authDataHex,
          clientDataJSON: clientDataStr,
          challengeIndex: challengeIndex,
          typeIndex: typeIndex,
        }
      };
    }

    /** Parse DER-encoded ECDSA signature into r, s Uint8Arrays */
    function derToRS(der) {
      // DER: 0x30 [len] 0x02 [rLen] [r...] 0x02 [sLen] [s...]
      var offset = 2; // skip 0x30 + total length
      if (der[0] !== 0x30) throw new Error('Invalid DER signature');

      // R
      if (der[offset] !== 0x02) throw new Error('Invalid DER: expected 0x02 for R');
      offset++;
      var rLen = der[offset]; offset++;
      var r = der.slice(offset, offset + rLen);
      offset += rLen;
      // Strip leading zero if present (DER pads positive ints)
      if (r[0] === 0x00 && r.length > 32) r = r.slice(1);

      // S
      if (der[offset] !== 0x02) throw new Error('Invalid DER: expected 0x02 for S');
      offset++;
      var sLen = der[offset]; offset++;
      var s = der.slice(offset, offset + sLen);
      if (s[0] === 0x00 && s.length > 32) s = s.slice(1);

      return { r: r, s: s };
    }

    /** Convert Uint8Array to hex string, zero-padded to targetLen bytes */
    function bytesToHex(bytes, targetLen) {
      var hex = '';
      for (var i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
      }
      if (targetLen) {
        hex = hex.padStart(targetLen * 2, '0');
      }
      return hex;
    }

    function hexToBytes(hex) {
      var bytes = new Uint8Array(hex.length / 2);
      for (var i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      }
      return bytes.buffer;
    }

    // ============================================
    // EXPOSE AUTH GLOBALS
    // ============================================
    // isAuthenticated is already on window via top-level var declaration
    window.openAuthModal = openAuthModal;
    window.closeAuthModal = closeAuthModal;
    window.authenticate = authenticate;
    window.authenticateRegister = authenticateRegister;
    window.bufferToBase64url = bufferToBase64url;
    window.extractPublicKeyFromAttestation = extractPublicKeyFromAttestation;
    window.derToRS = derToRS;
    window.bytesToHex = bytesToHex;
    window.hexToBytes = hexToBytes;
    window.signHashWithPasskey = signHashWithPasskey;
