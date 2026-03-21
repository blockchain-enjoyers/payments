    // ============================================
    // PAYOUT — BALANCE DETAIL POPUP
    // ============================================
    var _payoutBalanceDetails = [];

    function openPayoutBalanceDetail() {
      if (_payoutBalanceDetails.length === 0) return;
      var body = document.getElementById('payout-balance-detail-body');
      body.innerHTML = _payoutBalanceDetails.map(function(d) {
        var iconHtml = d.icon ? '<img src="' + resolveIcon(d.icon) + '" alt="' + d.token + '">' : '';
        return '<div class="payout-detail-row">' +
          iconHtml +
          '<span class="payout-detail-amount">' +
            d.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
            ' ' + d.token +
          '</span>' +
          '<span class="payout-detail-label">' + d.label + '</span>' +
        '</div>';
      }).join('');
      document.getElementById('payout-balance-detail-overlay').style.display = 'block';
      document.getElementById('payout-balance-detail').style.display = 'block';
    }

    function closePayoutBalanceDetail() {
      document.getElementById('payout-balance-detail-overlay').style.display = 'none';
      document.getElementById('payout-balance-detail').style.display = 'none';
    }

    // PAYOUT — STATE & DATA
    // ============================================
    var PAYOUT_TOKENS = {
      USDC: { icon: 'icons/tokens/usdc.svg', rate: 1 },
      USDT: { icon: 'icons/tokens/usdt.svg', rate: 1 },
      DAI:  { icon: 'icons/tokens/dai.svg',  rate: 1 }
    };

    var PAYOUT_CHAINS = {
      Base:      { icon: 'icons/chains/base.svg',      explorer: 'https://basescan.org/tx/' },
      Arbitrum:  { icon: 'icons/chains/arb.svg',       explorer: 'https://arbiscan.io/tx/' },
      Optimism:  { icon: 'icons/chains/optimism.svg',  explorer: 'https://optimistic.etherscan.io/tx/' },
      Polygon:   { icon: 'icons/chains/polygon.svg',   explorer: 'https://polygonscan.com/tx/' },
      Ethereum:  { icon: 'icons/chains/eth_chain.svg', explorer: 'https://etherscan.io/tx/' },
      'BNB Chain': { icon: 'icons/chains/bnb.svg',     explorer: 'https://bscscan.com/tx/' }
    };

    var payoutState = {
      balance: isProd() ? 0 : 15730,
      recipients: isProd()
        ? [{ address: '', amount: '', token: 'USDC', chain: 'Base' }]
        : [
            { address: '0x1a2B3c4D5e6F7890aBcDeF1234567890abCDeF12', amount: '500',  token: 'USDC', chain: 'Base' },
            { address: '0x3c4D5e6F7890AbCdEf1234567890aBcDeF345678', amount: '0.1',   token: 'ETH',  chain: 'Arbitrum' },
            { address: '0x7e8F9a0B1c2D3e4F5a6B7c8D9e0F1a2B3c4D9A01', amount: '1200', token: 'USDC', chain: 'Optimism' }
          ],
      memo: ''
    };

    // ============================================
    // PAYOUT — MINI DROPDOWNS
    // ============================================
    // ── Payout source chain/token selectors ──
    var payoutSource = { chain: 'polygon', token: 'USDC' };
    var _payoutBalanceData = null; // cached from loadProdDashboard

    function payoutToggleSourceDropdown(type) {
      var select = document.getElementById('payout-source-' + type + '-select');
      var menu = document.getElementById('payout-source-' + type + '-dropdown');
      var isOpen = menu.classList.contains('open');
      payoutCloseSourceDropdowns();
      if (!isOpen) { select.classList.add('open'); menu.classList.add('open'); }
    }

    function payoutCloseSourceDropdowns() {
      ['chain', 'token'].forEach(function(t) {
        var m = document.getElementById('payout-source-' + t + '-dropdown');
        var s = document.getElementById('payout-source-' + t + '-select');
        if (m) m.classList.remove('open');
        if (s) s.classList.remove('open');
      });
    }

    function payoutSelectSource(type, value, label, icon) {
      payoutSource[type] = value;
      var select = document.getElementById('payout-source-' + type + '-select');
      select.innerHTML = '<img src="' + resolveIcon(icon) + '" alt="' + label + '"> ' + label + ' <span class="chevron">&#9660;</span>';
      var dropdown = document.getElementById('payout-source-' + type + '-dropdown');
      dropdown.querySelectorAll('.dropdown-option').forEach(function(opt) {
        opt.classList.toggle('selected', opt.dataset.value === value);
      });
      payoutCloseSourceDropdowns();
      payoutUpdateSourceBalance();
    }

    function payoutUpdateSourceBalance() {
      var el = document.getElementById('payout-source-balance');
      if (!el || !_payoutBalanceData) return;
      var bal = 0;
      var data = _payoutBalanceData;
      // Check on-chain balance for selected chain+token
      if (data.onChainBalances && data.onChainBalances[payoutSource.chain]) {
        var tb = data.onChainBalances[payoutSource.chain][payoutSource.token];
        if (tb) bal += parseFloat(tb.balance || 0);
      }
      // Add gateway balance (USDC only)
      if (payoutSource.token === 'USDC' && data.gatewayBalances && data.gatewayBalances[payoutSource.chain]) {
        bal += parseFloat(data.gatewayBalances[payoutSource.chain] || 0);
      }
      el.textContent = bal > 0
        ? 'Available: ' + bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) + ' ' + payoutSource.token
        : 'No ' + payoutSource.token + ' on ' + payoutSource.chain;
    }

    // Init source dropdown icons
    document.addEventListener('DOMContentLoaded', function() {
      var chainImg = document.getElementById('payout-source-chain-img');
      if (chainImg) chainImg.src = resolveIcon('icons/chains/polygon.svg');
      var tokenImg = document.getElementById('payout-source-token-img');
      if (tokenImg) tokenImg.src = resolveIcon('icons/tokens/usdc.svg');
      document.querySelectorAll('.payout-src-chain-img').forEach(function(img) {
        var p = img.getAttribute('data-icon'); if (p) img.src = resolveIcon(p);
      });
      document.querySelectorAll('.payout-src-token-img').forEach(function(img) {
        var p = img.getAttribute('data-icon'); if (p) img.src = resolveIcon(p);
      });
    });

    // Close source dropdowns on outside click
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#view-payout .dropdown-wrapper')) {
        payoutCloseSourceDropdowns();
      }
    });

    function payoutCloseMiniDropdowns() {
      document.querySelectorAll('#view-payout .mini-dropdown-menu').forEach(function(m) { m.classList.remove('open'); });
      document.querySelectorAll('#view-payout .mini-select').forEach(function(s) { s.classList.remove('open'); });
    }

    function payoutToggleMiniDropdown(rowIdx, type, el) {
      var menu = el.nextElementSibling;
      var isOpen = menu.classList.contains('open');
      payoutCloseMiniDropdowns();
      if (!isOpen) {
        el.classList.add('open');
        menu.classList.add('open');
      }
    }

    document.addEventListener('click', function(e) {
      if (!e.target.closest('#view-payout .mini-dropdown-wrapper')) {
        payoutCloseMiniDropdowns();
      }
    });

    function payoutSelectMiniOption(rowIdx, type, value) {
      payoutState.recipients[rowIdx][type] = value;
      payoutRenderRecipients();
      payoutUpdateSummary();
    }

    // ── Token addresses per chain (for API calls) ──
    var TOKEN_ADDRESSES = {
      polygon: {
        USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        DAI:  '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      },
      base: {
        USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
        DAI:  '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      },
      arbitrum: {
        USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        DAI:  '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      },
      optimism: {
        USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
        USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
        DAI:  '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      },
      avalanche: {
        USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
        USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
        DAI:  '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
      },
    };

    function resolveTokenAddress(symbol, chain) {
      var chainKey = chain.toLowerCase();
      return TOKEN_ADDRESSES[chainKey] && TOKEN_ADDRESSES[chainKey][symbol] || null;
    }

    // ============================================
    // PAYOUT — RECIPIENTS CRUD
    // ============================================
    function payoutTruncateAddr(addr) {
      if (!addr || addr.length < 12) return addr;
      return addr.slice(0, 6) + '...' + addr.slice(-4);
    }

    function payoutRenderRecipients() {
      var list = document.getElementById('payout-recipient-list');
      list.innerHTML = payoutState.recipients.map(function(r, i) {
        var tokenData = PAYOUT_TOKENS[r.token] || PAYOUT_TOKENS.USDC;
        var chainData = PAYOUT_CHAINS[r.chain] || PAYOUT_CHAINS.Base;

        var tokenOptions = Object.keys(PAYOUT_TOKENS).map(function(t) {
          return '<div class="mini-dropdown-option ' + (t === r.token ? 'selected' : '') + '" onclick="payoutSelectMiniOption(' + i + ',\'token\',\'' + t + '\')">' +
            '<img src="' + resolveIcon(PAYOUT_TOKENS[t].icon) + '" alt="' + t + '"> ' + t +
          '</div>';
        }).join('');

        var chainOptions = Object.keys(PAYOUT_CHAINS).map(function(c) {
          return '<div class="mini-dropdown-option ' + (c === r.chain ? 'selected' : '') + '" onclick="payoutSelectMiniOption(' + i + ',\'chain\',\'' + c + '\')">' +
            '<img src="' + resolveIcon(PAYOUT_CHAINS[c].icon) + '" alt="' + c + '"> ' + c +
          '</div>';
        }).join('');

        return '<div class="recipient-row">' +
          '<div class="recipient-num">' + (i + 1) + '</div>' +
          '<input class="recipient-address" type="text" placeholder="0x..." value="' + r.address + '" oninput="payoutUpdateRecipientField(' + i + ',\'address\',this.value)">' +
          '<input class="recipient-amount" type="text" placeholder="0" value="' + r.amount + '" oninput="payoutUpdateRecipientField(' + i + ',\'amount\',this.value)">' +
          '<div class="mini-dropdown-wrapper token-dd">' +
            '<div class="mini-select" onclick="payoutToggleMiniDropdown(' + i + ',\'token\',this)">' +
              '<img src="' + resolveIcon(tokenData.icon) + '" alt="' + r.token + '">' +
              '<span class="mini-label">' + r.token + '</span>' +
              '<span class="chevron">&#9660;</span>' +
            '</div>' +
            '<div class="mini-dropdown-menu">' + tokenOptions + '</div>' +
          '</div>' +
          '<div class="mini-dropdown-wrapper chain-dd">' +
            '<div class="mini-select" onclick="payoutToggleMiniDropdown(' + i + ',\'chain\',this)">' +
              '<img src="' + resolveIcon(chainData.icon) + '" alt="' + r.chain + '">' +
              '<span class="mini-label">' + r.chain + '</span>' +
              '<span class="chevron">&#9660;</span>' +
            '</div>' +
            '<div class="mini-dropdown-menu">' + chainOptions + '</div>' +
          '</div>' +
          '<button class="delete-btn" onclick="payoutRemoveRecipient(' + i + ')" title="Remove">&#10005;</button>' +
        '</div>';
      }).join('');
    }

    function payoutUpdateRecipientField(idx, field, value) {
      payoutState.recipients[idx][field] = value;
      payoutUpdateSummary();
    }

    function payoutAddRecipient() {
      payoutState.recipients.push({ address: '', amount: '', token: 'USDC', chain: 'Base' });
      payoutRenderRecipients();
      payoutUpdateSummary();
      setTimeout(function() {
        var inputs = document.querySelectorAll('#payout-recipient-list .recipient-address');
        if (inputs.length) inputs[inputs.length - 1].focus();
      }, 50);
    }

    function payoutRemoveRecipient(idx) {
      if (payoutState.recipients.length <= 1) {
        showToast('Need at least 1 recipient');
        return;
      }
      payoutState.recipients.splice(idx, 1);
      payoutRenderRecipients();
      payoutUpdateSummary();
    }

    // ============================================
    // PAYOUT — CSV IMPORT
    // ============================================
    function payoutImportCSV() {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';
      input.onchange = function(e) {
        var reader = new FileReader();
        reader.onload = function(ev) {
          var lines = ev.target.result.split('\n').filter(function(l) { return l.trim(); });
          var parsed = [];
          for (var j = 0; j < lines.length; j++) {
            var cols = lines[j].split(',').map(function(c) { return c.trim(); });
            if (cols[0] && cols[0].toLowerCase().includes('address')) continue;
            if (cols.length >= 2 && cols[0].startsWith('0x')) {
              parsed.push({
                address: cols[0],
                amount: cols[1] || '0',
                token: (cols[2] || 'USDC').toUpperCase(),
                chain: cols[3] || 'Base'
              });
            }
          }
          if (parsed.length > 0) {
            payoutState.recipients = parsed;
            payoutRenderRecipients();
            payoutUpdateSummary();
            showToast(parsed.length + ' recipient' + (parsed.length > 1 ? 's' : '') + ' imported');
          } else {
            showToast('No valid rows found in CSV');
          }
        };
        reader.readAsText(e.target.files[0]);
      };
      input.click();
    }

    // ============================================
    // PAYOUT — SUMMARY
    // ============================================
    function payoutCalcTotal() {
      var total = 0;
      for (var i = 0; i < payoutState.recipients.length; i++) {
        var r = payoutState.recipients[i];
        var amt = parseFloat(r.amount) || 0;
        var rate = (PAYOUT_TOKENS[r.token] || PAYOUT_TOKENS.USDC).rate;
        total += amt * rate;
      }
      return total;
    }

    function payoutCountChains() {
      var s = {};
      for (var i = 0; i < payoutState.recipients.length; i++) {
        s[payoutState.recipients[i].chain] = true;
      }
      return Object.keys(s).length;
    }

    function payoutFormatUSD(n) {
      return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function payoutUpdateSummary() {
      var total = payoutCalcTotal();
      var chains = payoutCountChains();
      var count = payoutState.recipients.length;
      document.getElementById('payout-summary').innerHTML =
        '<span>' + count + '</span> recipient' + (count !== 1 ? 's' : '') +
        ' &middot; <span>' + chains + '</span> chain' + (chains !== 1 ? 's' : '') +
        ' &middot; ~<span>' + payoutFormatUSD(total) + '</span> total';
    }

    // ============================================
    // PAYOUT — STATE NAVIGATION
    // ============================================
    function payoutHandleReview() {
      if (!isAuthenticated) {
        openAuthModal(function() { payoutHandleReview(); });
        return;
      }
      var valid = payoutState.recipients.some(function(r) { return r.address && r.amount; });
      if (!valid) {
        showToast('Add at least one recipient with address and amount');
        return;
      }
      payoutShowReview();
    }

    function payoutShowReview() {
      var table = document.getElementById('payout-review-table');
      var headerHtml =
        '<div class="review-header">' +
          '<div class="col-num">#</div>' +
          '<div class="col-addr">Recipient</div>' +
          '<div class="col-amount">Amount</div>' +
          '<div class="col-delivery">Delivery</div>' +
        '</div>';

      var rowsHtml = payoutState.recipients.filter(function(r) { return r.address && r.amount; }).map(function(r, i) {
        var tokenData = PAYOUT_TOKENS[r.token] || PAYOUT_TOKENS.USDC;
        var chainData = PAYOUT_CHAINS[r.chain] || PAYOUT_CHAINS.Base;
        var amt = parseFloat(r.amount) || 0;
        var usdVal = amt * tokenData.rate;
        return '<div class="review-row">' +
          '<div class="col-num">' + (i + 1) + '</div>' +
          '<div class="col-addr">' + payoutTruncateAddr(r.address) + '</div>' +
          '<div class="col-amount">' + payoutFormatUSD(usdVal) + '</div>' +
          '<div class="col-delivery">' +
            '<img src="' + resolveIcon(tokenData.icon) + '" alt="' + r.token + '"> ' +
            r.token + ' &middot; ' + r.chain +
          '</div>' +
        '</div>';
      }).join('');

      table.innerHTML = headerHtml + rowsHtml;

      var total = payoutCalcTotal();
      var chains = payoutCountChains();
      var count = payoutState.recipients.filter(function(r) { return r.address && r.amount; }).length;
      var memo = document.getElementById('payout-memo-input').value;
      payoutState.memo = memo;

      var totalsHtml =
        '<div class="total-amount">' + payoutFormatUSD(total) + '</div>' +
        '<div class="total-label">from unified balance</div>' +
        '<div class="total-meta">Recipients: ' + count + ' &middot; Chains: ' + chains + '</div>';
      if (memo) {
        totalsHtml += '<div class="total-memo">Memo: ' + memo + '</div>';
      }
      document.getElementById('payout-review-totals').innerHTML = totalsHtml;

      document.getElementById('payout-form').style.display = 'none';
      document.getElementById('payout-review').style.display = 'block';
      document.getElementById('payout-review').style.animation = 'fadeInUp 0.35s ease';
    }

    function payoutShowForm() {
      document.getElementById('payout-review').style.display = 'none';
      document.getElementById('payout-form').style.display = 'block';
    }

    function payoutHandleSend() {
      if (isProd()) {
        payoutSendProd();
      } else {
        payoutShowPayoutResult();
      }
    }

    async function payoutSendProd() {
      var validRecipients = payoutState.recipients.filter(function(r) { return r.address && r.amount; });
      if (validRecipients.length === 0) {
        showToast('No valid recipients');
        return;
      }

      // Map chain display names to chain keys
      var CHAIN_KEY_MAP = {
        'Base': 'base', 'Arbitrum': 'arbitrum', 'Optimism': 'optimism',
        'Polygon': 'polygon', 'Avalanche': 'avalanche', 'Ethereum': 'ethereum'
      };

      try {
        // 1. Prepare via POST /v1/operations/send (supports batch)
        var sourceChainKey = payoutSource.chain;
        var sourceTokenAddr = resolveTokenAddress(payoutSource.token, sourceChainKey);

        var recipients = validRecipients.map(function(r) {
          var destChain = CHAIN_KEY_MAP[r.chain] || r.chain.toLowerCase();
          var destTokenAddr = resolveTokenAddress(r.token, destChain);
          var rec = {
            address: r.address,
            chain: destChain,
            amount: r.amount,
          };
          // If dest token differs from source token, set outputToken for swap
          if (destTokenAddr && destTokenAddr !== sourceTokenAddr) {
            rec.outputToken = destTokenAddr;
          }
          return rec;
        });

        var sendPayload = {
          recipients: recipients,
          sourceChain: sourceChainKey,
          sourceToken: sourceTokenAddr,
        };
        var operation = await apiPost('operations/send', sendPayload);

        // 2. Group signRequests by chain, batch all calls into one UserOp per chain
        var userSignRequests = (operation.signRequests || []).filter(function(sr) { return !sr.serverSide && sr.calls; });
        if (userSignRequests.length > 0) {
          // Group by chain
          var byChain = {};
          userSignRequests.forEach(function(sr) {
            if (!byChain[sr.chain]) byChain[sr.chain] = [];
            byChain[sr.chain].push(sr);
          });

          var signatures = [];
          var chainKeys = Object.keys(byChain);
          for (var ci = 0; ci < chainKeys.length; ci++) {
            var chain = chainKeys[ci];
            var chainSRs = byChain[chain];

            // Merge all calls from all signRequests on this chain
            var allCalls = [];
            chainSRs.forEach(function(sr) {
              if (sr.calls) sr.calls.forEach(function(c) { allCalls.push(c); });
            });

            // 2a. Prepare single batched UserOp
            var prepared = await apiPost('wallet/userop/prepare', {
              chain: chain,
              calls: allCalls,
            });

            // 2b. Sign once with passkey
            var signed = await signUserOpWithPasskey(prepared);

            // 2c. Submit → one txHash
            var result = await apiPost('wallet/userop/submit', signed);

            // Map txHash to all steps on this chain
            chainSRs.forEach(function(sr) {
              signatures.push({ stepId: sr.stepId, txHash: result.txHash });
            });
          }

          // 3. Submit all txHashes to operation
          await apiPost('operations/' + operation.id + '/submit', { signatures: signatures });
        }

        payoutShowPayoutResult();
        showToast('Payout sent!');
      } catch (e) {
        showToast('Payout failed: ' + e.message);
        console.error('Payout error:', e);
      }
    }

    async function signUserOpWithPasskey(prepared) {
      // prepared = { requestId, chain, userOpHash }
      var hashHex = prepared.userOpHash;
      if (!hashHex) throw new Error('No userOpHash to sign');

      // Convert hex hash to bytes for WebAuthn challenge
      var hashBytes = new Uint8Array(hashHex.replace('0x', '').match(/.{2}/g).map(function(b) { return parseInt(b, 16); }));

      var publicKeyOptions = {
        challenge: hashBytes,
        rpId: window.location.hostname,
        timeout: 60000,
        userVerification: 'preferred'
      };

      // Pre-select credential so browser doesn't show picker
      var credId = CURRENT_USER && CURRENT_USER.credentialId;
      if (credId) {
        var rawId = Uint8Array.from(atob(credId.replace(/-/g, '+').replace(/_/g, '/')), function(c) { return c.charCodeAt(0); });
        publicKeyOptions.allowCredentials = [{ type: 'public-key', id: rawId }];
      }

      var assertion = await navigator.credentials.get({ publicKey: publicKeyOptions });

      // Convert DER signature to r||s hex (same as delegate signing flow)
      var derSig = new Uint8Array(assertion.response.signature);
      var rs = derToRS(derSig);
      var sigHex = '0x' + bytesToHex(rs.r, 32) + bytesToHex(rs.s, 32);

      var authDataHex = '0x' + bytesToHex(new Uint8Array(assertion.response.authenticatorData));
      var clientDataStr = new TextDecoder().decode(assertion.response.clientDataJSON);
      var challengeIndex = clientDataStr.indexOf('"challenge"');
      var typeIndex = clientDataStr.indexOf('"type"');

      return {
        requestId: prepared.requestId,
        signature: sigHex,
        webauthn: {
          authenticatorData: authDataHex,
          clientDataJSON: clientDataStr,
          challengeIndex: challengeIndex,
          typeIndex: typeIndex,
          userVerificationRequired: true,
        },
      };
    }

    function payoutShowPayoutResult() {
      var total = payoutCalcTotal();
      var chains = payoutCountChains();
      var validRecipients = payoutState.recipients.filter(function(r) { return r.address && r.amount; });
      var count = validRecipients.length;

      document.getElementById('payout-result-total-amount').textContent = payoutFormatUSD(total);
      document.getElementById('payout-result-total-meta').textContent =
        count + ' recipient' + (count !== 1 ? 's' : '') + ' \u00b7 ' + chains + ' chain' + (chains !== 1 ? 's' : '');

      var resultList = document.getElementById('payout-result-list');
      resultList.innerHTML = validRecipients.map(function(r, i) {
        var tokenData = PAYOUT_TOKENS[r.token] || PAYOUT_TOKENS.USDC;
        var chainData = PAYOUT_CHAINS[r.chain] || PAYOUT_CHAINS.Base;
        var amt = parseFloat(r.amount) || 0;
        var usdVal = amt * tokenData.rate;
        var fakeTx = '0x' + Array.from({length: 8}, function() { return Math.floor(Math.random()*16).toString(16); }).join('') + '...';
        return '<div class="result-row">' +
          '<div class="result-row-check">&#10003;</div>' +
          '<div class="result-row-addr">' + payoutTruncateAddr(r.address) + '</div>' +
          '<div class="result-row-amount">' + payoutFormatUSD(usdVal) + '</div>' +
          '<div class="result-row-delivery">' +
            '<img src="' + resolveIcon(tokenData.icon) + '" alt="' + r.token + '"> ' +
            r.token + ' &middot; ' + r.chain +
          '</div>' +
          '<a class="result-row-explorer" href="' + chainData.explorer + fakeTx + '" target="_blank" title="View on explorer">&#128279;</a>' +
        '</div>';
      }).join('');

      document.getElementById('payout-review').style.display = 'none';
      document.getElementById('payout-result').style.display = 'block';
      document.getElementById('payout-result').style.animation = 'fadeInUp 0.35s ease';
    }

    function payoutResetForm() {
      payoutState.recipients = [
        { address: '', amount: '', token: 'USDC', chain: 'Base' }
      ];
      document.getElementById('payout-memo-input').value = '';
      payoutState.memo = '';
      payoutRenderRecipients();
      payoutUpdateSummary();
      document.getElementById('payout-result').style.display = 'none';
      document.getElementById('payout-form').style.display = 'block';
    }

    // ============================================
    // PAYOUT — DOWNLOAD RECEIPT
    // ============================================
    function payoutDownloadReceipt() {
      var validRecipients = payoutState.recipients.filter(function(r) { return r.address && r.amount; });
      var csv = 'Recipient,Amount,Token,Chain,USD Value,Status,TX Hash\n';
      for (var i = 0; i < validRecipients.length; i++) {
        var r = validRecipients[i];
        var tokenData = PAYOUT_TOKENS[r.token] || PAYOUT_TOKENS.USDC;
        var amt = parseFloat(r.amount) || 0;
        var usdVal = (amt * tokenData.rate).toFixed(2);
        var fakeTx = '0x' + Array.from({length: 64}, function() { return Math.floor(Math.random()*16).toString(16); }).join('');
        csv += r.address + ',' + r.amount + ',' + r.token + ',' + r.chain + ',' + usdVal + ',Completed,' + fakeTx + '\n';
      }
      csv += '\nTotal,,,,' + payoutFormatUSD(payoutCalcTotal()) + ',,\n';
      csv += 'Memo: ' + (payoutState.memo || 'N/A') + '\n';
      csv += 'Date: ' + new Date().toISOString() + '\n';

      var blob = new Blob([csv], { type: 'text/csv' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'omniflow-payout-' + Date.now() + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Receipt downloaded');
    }


    // ============================================
    // PAYOUT — INIT
    // ============================================
    window.addEventListener('DOMContentLoaded', function() {
      payoutRenderRecipients();
      payoutUpdateSummary();
      historyInitTabs();
      historyInitIcons();
      historyRenderTransactions();
    });

    // ============================================
    // EXPOSE PAYOUT GLOBALS
    // ============================================
    window.payoutState = payoutState;
    window.openPayoutBalanceDetail = openPayoutBalanceDetail;
    window.closePayoutBalanceDetail = closePayoutBalanceDetail;
    window.payoutToggleSourceDropdown = payoutToggleSourceDropdown;
    window.payoutCloseSourceDropdowns = payoutCloseSourceDropdowns;
    window.payoutSelectSource = payoutSelectSource;
    window.payoutUpdateSourceBalance = payoutUpdateSourceBalance;
    window.payoutToggleMiniDropdown = payoutToggleMiniDropdown;
    window.payoutCloseMiniDropdowns = payoutCloseMiniDropdowns;
    window.payoutSelectMiniOption = payoutSelectMiniOption;
    window.payoutRenderRecipients = payoutRenderRecipients;
    window.payoutUpdateRecipientField = payoutUpdateRecipientField;
    window.payoutAddRecipient = payoutAddRecipient;
    window.payoutRemoveRecipient = payoutRemoveRecipient;
    window.payoutImportCSV = payoutImportCSV;
    window.payoutUpdateSummary = payoutUpdateSummary;
    window.payoutHandleReview = payoutHandleReview;
    window.payoutShowForm = payoutShowForm;
    window.payoutHandleSend = payoutHandleSend;
    window.payoutResetForm = payoutResetForm;
    window.payoutDownloadReceipt = payoutDownloadReceipt;
    window.payoutFormatUSD = payoutFormatUSD;
    window.PAYOUT_TOKENS = PAYOUT_TOKENS;
    window.PAYOUT_CHAINS = PAYOUT_CHAINS;
    window.TOKEN_ADDRESSES = TOKEN_ADDRESSES;
    window.resolveTokenAddress = resolveTokenAddress;
