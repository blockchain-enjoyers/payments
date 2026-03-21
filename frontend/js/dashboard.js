    // ============================================
    // PROD MODE — DASHBOARD DATA
    // ============================================
    function renderProdDashboard(data) {
      if (!data) return;
      var totalUsd = parseFloat(data.total || 0);
      _renderProdDashboardInner(data, totalUsd);
    }

    async function loadProdDashboard() {
      if (!isProd() || !isAuthenticated) return;
      try {
        var data = await apiGet('wallet/balances');
        renderProdDashboard(data);
      } catch (e) {
        console.error('Failed to load dashboard data:', e);
      }
    }

    function _renderProdDashboardInner(data, totalUsd) {
        var chainTotals = {};
        // Merge on-chain balances (multi-token per chain)
        if (data.onChainBalances) {
          Object.entries(data.onChainBalances).forEach(function(entry) {
            var chain = entry[0], tokens = entry[1];
            Object.values(tokens).forEach(function(tb) {
              var amt = parseFloat(tb.balance || 0);
              if (amt > 0) chainTotals[chain] = (chainTotals[chain] || 0) + amt;
            });
          });
        }
        // Add gateway balances (USDC only)
        if (data.gatewayBalances) {
          Object.entries(data.gatewayBalances).forEach(function(entry) {
            var chain = entry[0], amt = parseFloat(entry[1] || 0);
            if (amt > 0) chainTotals[chain] = (chainTotals[chain] || 0) + amt;
          });
        }

        // Update all balance displays (nav, dashboard, payout)
        var formattedTotal = '$' + totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        var navBalEl = document.getElementById('nav-balance');
        if (navBalEl) { navBalEl.textContent = formattedTotal; navBalEl.style.display = 'block'; }

        var dashBalEl = document.querySelector('#view-dashboard .balance-amount');
        if (dashBalEl) dashBalEl.textContent = formattedTotal;

        var payoutBalEl = document.querySelector('#payout-balance span');
        if (payoutBalEl) payoutBalEl.textContent = formattedTotal;

        // Cache for source selector balance display
        _payoutBalanceData = data;
        payoutUpdateSourceBalance();

        // Store detailed balance data for the popup
        _payoutBalanceDetails = [];
        var DETAIL_TOKEN_ICONS = {
          USDC: 'icons/tokens/usdc.svg', USDT: 'icons/tokens/usdt.svg',
          DAI: 'icons/tokens/dai.svg', WETH: 'icons/tokens/eth.svg',
          WBTC: 'icons/tokens/wbtc.svg'
        };
        var DETAIL_CHAIN_LABELS = {
          polygon: 'Polygon', base: 'Base', arbitrum: 'Arbitrum',
          optimism: 'Optimism', avalanche: 'Avalanche'
        };
        if (data.gatewayBalances) {
          Object.entries(data.gatewayBalances).forEach(function(e) {
            var amt = parseFloat(e[1] || 0);
            if (amt >= 0.01) _payoutBalanceDetails.push({ token: 'USDC', amount: amt, label: 'Gateway', icon: DETAIL_TOKEN_ICONS.USDC });
          });
        }
        if (data.onChainBalances) {
          Object.entries(data.onChainBalances).forEach(function(e) {
            var chain = e[0], tokens = e[1];
            Object.values(tokens).forEach(function(tb) {
              var amt = parseFloat(tb.balance || 0);
              if (amt >= 0.01) _payoutBalanceDetails.push({
                token: tb.symbol, amount: amt,
                label: DETAIL_CHAIN_LABELS[chain] || chain,
                icon: DETAIL_TOKEN_ICONS[tb.symbol] || ''
              });
            });
          });
        }
        _payoutBalanceDetails.sort(function(a, b) { return b.amount - a.amount; });

        // Update chain chips
        var chipContainer = document.querySelector('#view-dashboard .chain-chips');
        if (chipContainer && Object.keys(chainTotals).length > 0) {
          var CHAIN_ICONS = {
            'base': 'icons/chains/base.svg', 'base-sepolia': 'icons/chains/base.svg',
            'arbitrum': 'icons/chains/arb.svg', 'arbitrum-sepolia': 'icons/chains/arb.svg',
            'ethereum': 'icons/chains/eth_chain.svg', 'ethereum-sepolia': 'icons/chains/eth_chain.svg',
            'polygon': 'icons/chains/polygon.svg', 'optimism': 'icons/chains/optimism.svg',
            'arc-testnet': 'icons/chains/eth_chain.svg'
          };
          chipContainer.innerHTML = Object.entries(chainTotals).map(function(entry) {
            var chain = entry[0], val = entry[1];
            var icon = CHAIN_ICONS[chain] || 'icons/chains/eth_chain.svg';
            var label = chain.replace('-sepolia', '').replace('-testnet', '').replace(/^\w/, function(c) { return c.toUpperCase(); });
            return '<div class="chain-chip"><img src="' + resolveIcon(icon) + '" alt="' + label + '"> $' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '</div>';
          }).join('');
        }
    }

    // Refresh dashboard when navigating to it in prod mode
    var _origHandleRoute = handleRoute;
    handleRoute = function() {
      _origHandleRoute();
      var hash = location.hash.slice(1) || 'home';
      if ((hash === 'dashboard' || hash === 'payout') && isProd() && isAuthenticated) {
        loadProdDashboard();
      }
      if (hash === 'settings' && isProd() && isAuthenticated) {
        loadSettingsPage();
      }
    };

    // ============================================
    // SETTINGS PAGE
    // ============================================
    var CHAIN_NAMES = {
      polygon: 'Polygon', base: 'Base', arbitrum: 'Arbitrum',
      avalanche: 'Avalanche', optimism: 'Optimism'
    };

    async function loadSettingsPage() {
      if (!isProd() || !isAuthenticated) {
        var container = document.getElementById('settings-chains-list');
        if (container) container.innerHTML = '<div style="text-align:center;color:#c4b5fd;font-size:12px;padding:20px 0;">Available in prod mode</div>';
        return;
      }

      // Show wallet address
      var addrEl = document.getElementById('settings-wallet-address');
      var userAddr = CURRENT_USER && (CURRENT_USER.smartAccountAddress || CURRENT_USER.walletAddress);
      if (addrEl && userAddr) {
        addrEl.textContent = userAddr;
      }

      var container = document.getElementById('settings-chains-list');
      if (!container) return;
      container.innerHTML = '<div style="text-align:center;color:#9ca3af;font-size:12px;padding:20px 0;">Loading status...</div>';

      try {
        var data = await apiGet('wallet/executor-status');
        if (!data || !data.chains) {
          container.innerHTML = '<div style="color:#ef4444;font-size:12px;">Failed to load status</div>';
          return;
        }

        var html = '';
        Object.entries(data.chains).forEach(function(entry) {
          var chain = entry[0], status = entry[1];
          var name = CHAIN_NAMES[chain] || chain;
          var allGood = status.delegateConfirmed && status.ecdsaValidatorEnabled;

          html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#f9fafb;border-radius:10px;border:1px solid ' + (allGood ? '#d1fae5' : '#fee2e2') + ';">';
          html += '<div>';
          html += '<div style="font-size:13px;font-weight:700;">' + name + '</div>';
          html += '<div style="font-size:11px;color:#6b7280;margin-top:2px;">';

          if (allGood) {
            html += '<span style="color:#065f46;">Active</span>';
          } else {
            var steps = [];
            if (!status.delegateConfirmed) steps.push('Delegate');
            if (!status.ecdsaValidatorEnabled) steps.push('ECDSA module');
            html += '<span style="color:#991b1b;">Needs setup: ' + steps.join(', ') + '</span>';
          }

          html += '</div></div>';

          if (allGood) {
            html += '<div style="font-size:16px;color:#065f46;">&#x2713;</div>';
          } else {
            html += '<button onclick="setupChain(\'' + chain + '\')" style="padding:6px 16px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;background:linear-gradient(135deg,#7c3aed,#6366f1);color:#fff;">Setup</button>';
          }

          html += '</div>';
        });

        container.innerHTML = html;

        // Show "Setup All" button if any chain needs setup
        var needsSetup = Object.values(data.chains).some(function(s) {
          return !s.delegateConfirmed || !s.ecdsaValidatorEnabled;
        });
        var setupAllWrap = document.getElementById('settings-setup-all-wrap');
        if (setupAllWrap) setupAllWrap.style.display = needsSetup ? 'block' : 'none';
      } catch (e) {
        container.innerHTML = '<div style="color:#ef4444;font-size:12px;">Error: ' + e.message + '</div>';
      }
    }

    async function setupAllChains() {
      if (!isProd() || !isAuthenticated) return;

      var btn = document.getElementById('btn-setup-all');
      var progress = document.getElementById('settings-setup-all-progress');
      if (btn) { btn.disabled = true; btn.textContent = 'Setting up...'; }
      if (progress) { progress.style.display = 'block'; }

      try {
        // Get current status to find chains that need setup
        var data = await apiGet('wallet/executor-status');
        if (!data || !data.chains) throw new Error('Failed to load status');

        var chainsToSetup = [];
        Object.entries(data.chains).forEach(function(entry) {
          var chain = entry[0], status = entry[1];
          if (!status.delegateConfirmed || !status.ecdsaValidatorEnabled) {
            chainsToSetup.push(chain);
          }
        });

        if (chainsToSetup.length === 0) {
          showToast('All chains already configured!');
          if (btn) { btn.disabled = false; btn.textContent = 'Setup All Chains'; }
          if (progress) progress.style.display = 'none';
          return;
        }

        for (var i = 0; i < chainsToSetup.length; i++) {
          var chain = chainsToSetup[i];
          var name = CHAIN_NAMES[chain] || chain;
          var step = (i + 1) + '/' + chainsToSetup.length;
          if (progress) progress.textContent = step + ' — ' + name + '...';

          await setupChainSilent(chain);
        }

        showToast('All chains configured!');
        loadSettingsPage();
      } catch (e) {
        showToast('Setup failed: ' + e.message);
      }

      if (btn) { btn.disabled = false; btn.textContent = 'Setup All Chains'; }
      if (progress) progress.style.display = 'none';
    }

    /** Setup a single chain without UI button manipulation — used by setupAllChains */
    async function setupChainSilent(chain) {
      var name = CHAIN_NAMES[chain] || chain;

      var data = await apiPost('wallet/setup-settlement', { chain: chain });
      if (data.alreadySetup) return;

      var submitBody = { chain: chain };

      if (data.needsUninstall) {
        var uninstallSigned = await signHashWithPasskey(data.uninstallUserOpHash);
        submitBody.uninstallRequestId = data.uninstallRequestId;
        submitBody.uninstallSignature = uninstallSigned.signature;
        submitBody.uninstallWebauthn = uninstallSigned.webauthn;
      }

      showToast('Sign passkey for ' + name + '...');
      var enableSigned = await signHashWithPasskey(data.enableHash);
      submitBody.enableSignature = enableSigned.signature;
      submitBody.webauthn = enableSigned.webauthn;

      showToast('Submitting ' + name + '...');
      await apiPost('wallet/setup-settlement/submit', submitBody);
    }

    async function setupChain(chain) {
      if (!isProd() || !isAuthenticated) return;
      var name = CHAIN_NAMES[chain] || chain;

      var btns = document.querySelectorAll('#settings-chains-list button');
      var btn = null;
      btns.forEach(function(b) { if (b.getAttribute('onclick') && b.getAttribute('onclick').indexOf(chain) >= 0) btn = b; });
      if (btn) { btn.textContent = 'Setting up...'; btn.disabled = true; }

      try {
        // Step 1: Prepare combined setup (delegate + ECDSA in one UserOp)
        showToast('Preparing settlement on ' + name + '...');
        var data = await apiPost('wallet/setup-settlement', { chain: chain });

        if (data.alreadySetup) {
          showToast(name + ' already configured!');
          loadSettingsPage();
          return;
        }

        var submitBody = { chain: chain };

        // Step 2: If needs uninstall, sign that first
        if (data.needsUninstall) {
          showToast('Sign to uninstall old module on ' + name + '...');
          var uninstallSigned = await signHashWithPasskey(data.uninstallUserOpHash);
          submitBody.uninstallRequestId = data.uninstallRequestId;
          submitBody.uninstallSignature = uninstallSigned.signature;
          submitBody.uninstallWebauthn = uninstallSigned.webauthn;
        }

        // Step 3: Sign enable hash (single passkey signature for everything)
        showToast('Sign with passkey to enable settlement...');
        var enableSigned = await signHashWithPasskey(data.enableHash);
        submitBody.enableSignature = enableSigned.signature;
        submitBody.webauthn = enableSigned.webauthn;

        // Step 4: Submit — backend does delegate + ECDSA enable in one tx
        showToast('Submitting on ' + name + '...');
        await apiPost('wallet/setup-settlement/submit', submitBody);

        showToast(name + ' setup complete!');
        loadSettingsPage();
      } catch (e) {
        showToast('Setup failed: ' + e.message);
        if (btn) { btn.textContent = 'Setup'; btn.disabled = false; }
      }
    }


    // ============================================
    // EXPOSE DASHBOARD GLOBALS
    // ============================================
    window.renderProdDashboard = renderProdDashboard;
    window.loadProdDashboard = loadProdDashboard;
    window.loadSettingsPage = loadSettingsPage;
    window.setupAllChains = setupAllChains;
    window.setupChain = setupChain;
    window.setupChainSilent = setupChainSilent;
