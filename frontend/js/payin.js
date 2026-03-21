    // ============================================
    // PAY IN VIEW
    // ============================================
    const PAYIN_RATES = { USDC: 1, USDT: 1, DAI: 1 };

    const payinSelected = {
      denomination: { type: 'crypto', value: 'USDC', icon: 'icons/tokens/usdc.svg', symbol: 'USDC' },
      chain: { value: 'Base', icon: 'icons/chains/base.svg' },
      receiveToken: { value: 'USDC', icon: 'icons/tokens/usdc.svg' }
    };

    // Initialize payin icons from ICON_MAP on load
    function payinInitIcons() {
      // Denomination select icon
      const denomImg = document.getElementById('payin-denom-select-img');
      if (denomImg) denomImg.src = resolveIcon(payinSelected.denomination.icon);

      // Chain select icon
      const chainImg = document.getElementById('payin-chain-select-img');
      if (chainImg) chainImg.src = resolveIcon(payinSelected.chain.icon);

      // Token select icon
      const tokenImg = document.getElementById('payin-token-select-img');
      if (tokenImg) tokenImg.src = resolveIcon(payinSelected.receiveToken.icon);

      // Result token icon
      const resultTokenIcon = document.getElementById('payin-result-token-icon');
      if (resultTokenIcon) resultTokenIcon.src = resolveIcon(payinSelected.receiveToken.icon);

      // Denomination dropdown option icons (crypto only)
      document.querySelectorAll('.payin-denom-opt-img').forEach(function(img) {
        var iconPath = img.getAttribute('data-icon');
        if (iconPath) img.src = resolveIcon(iconPath);
      });

      // Chain dropdown option icons
      document.querySelectorAll('.payin-chain-opt-img').forEach(function(img) {
        var iconPath = img.getAttribute('data-icon');
        if (iconPath) img.src = resolveIcon(iconPath);
      });

      // Token dropdown option icons
      document.querySelectorAll('.payin-token-opt-img').forEach(function(img) {
        var iconPath = img.getAttribute('data-icon');
        if (iconPath) img.src = resolveIcon(iconPath);
      });
    }

    // Dropdown logic
    function payinToggleDropdown(type) {
      var select = document.getElementById('payin-' + type + '-select');
      var menu = document.getElementById('payin-' + type + '-dropdown');
      var isOpen = menu.classList.contains('open');

      payinCloseAllDropdowns();

      if (!isOpen) {
        select.classList.add('open');
        menu.classList.add('open');
      }
    }

    function payinCloseAllDropdowns() {
      document.querySelectorAll('#view-payin .dropdown-menu').forEach(function(m) { m.classList.remove('open'); });
      document.querySelectorAll('#view-payin .form-select').forEach(function(s) { s.classList.remove('open'); });
    }

    // Close payin dropdowns on outside click
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#view-payin .dropdown-wrapper')) {
        payinCloseAllDropdowns();
      }
    });

    // Unified denomination selector (fiat + crypto in one dropdown)
    function payinSelectDenomination(type, value, icon, symbol) {
      payinSelected.denomination = { type: type, value: value, icon: icon, symbol: symbol };

      // Rebuild trigger button
      var select = document.getElementById('payin-denomination-select');
      var iconHtml = icon
        ? '<img src="' + resolveIcon(icon) + '" alt="' + value + '">'
        : '<span class="denom-text-icon">' + symbol + '</span>';
      select.innerHTML = iconHtml + ' ' + value + ' <span class="chevron">&#9660;</span>';

      // Mark selected in menu
      document.querySelectorAll('#payin-denomination-dropdown .dropdown-option').forEach(function(opt) {
        opt.classList.toggle('selected', opt.dataset.value === value);
      });

      payinUpdateReceiveAsRow();
      payinUpdateConversionLabel();
      payinCloseAllDropdowns();
    }

    // Chain selector
    function payinSelectChain(value, icon) {
      payinSelected.chain = { value: value, icon: icon };
      var select = document.getElementById('payin-chain-select');
      select.innerHTML = '<img src="' + resolveIcon(icon) + '" alt="' + value + '"> ' + value + ' <span class="chevron">&#9660;</span>';
      document.querySelectorAll('#payin-chain-dropdown .dropdown-option').forEach(function(opt) {
        opt.classList.toggle('selected', opt.dataset.value === value);
      });
      payinCloseAllDropdowns();
    }

    // Receive token selector (only shown in fiat mode)
    function payinSelectReceiveToken(value, icon) {
      payinSelected.receiveToken = { value: value, icon: icon };
      var select = document.getElementById('payin-token-select');
      select.innerHTML = '<img src="' + resolveIcon(icon) + '" alt="' + value + '"> ' + value + ' <span class="chevron">&#9660;</span>';
      document.querySelectorAll('#payin-token-dropdown .dropdown-option').forEach(function(opt) {
        opt.classList.toggle('selected', opt.dataset.value === value);
      });
      payinUpdateConversionLabel();
      payinCloseAllDropdowns();
    }

    // Show/hide token selector based on denomination type
    function payinUpdateReceiveAsRow() {
      var isFiat = payinSelected.denomination.type === 'fiat';
      document.getElementById('payin-token-wrapper').style.display = isFiat ? '' : 'none';
    }

    // Update conversion label
    function payinUpdateConversionLabel() {
      var amount = parseFloat(document.getElementById('payin-amount-input').value) || 0;
      var label = document.getElementById('payin-conversion-label');
      var isFiat = payinSelected.denomination.type === 'fiat';
      var denom = payinSelected.denomination.value;

      if (amount === 0) {
        label.textContent = '';
        return;
      }

      if (isFiat) {
        var fiatRate = PAYIN_RATES[denom] || 1;
        var tokenRate = PAYIN_RATES[payinSelected.receiveToken.value] || 1;
        var cryptoAmount = (amount * fiatRate / tokenRate).toFixed(2);
        label.textContent = '\u2248 ' + cryptoAmount + ' ' + payinSelected.receiveToken.value;
      } else {
        var rate = PAYIN_RATES[denom] || 1;
        var usdAmount = amount * rate;
        label.textContent = '\u2248 $' + usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }

    // Generate link
    function payinHandleGenerate() {
      if (!isAuthenticated) {
        openAuthModal(function() { payinHandleGenerate(); });
        return;
      }
      if (isProd()) {
        payinCreateProdPayment();
      } else {
        payinShowResult();
      }
    }

    var _lastPaymentId = null;

    async function payinCreateProdPayment() {
      var amount = document.getElementById('payin-amount-input').value || '0';
      var desc = document.getElementById('payin-desc-input').value;
      var isFiat = payinSelected.denomination.type === 'fiat';
      var token = isFiat ? payinSelected.receiveToken.value : payinSelected.denomination.value;
      var chain = payinSelected.chain.value.toLowerCase();

      try {
        var payment = await apiPost('payments', {
          amount: amount,
          token: token,
          chain: chain,
          description: desc || undefined
        });
        _lastPaymentId = payment.id;

        // Show result with real data
        if (isFiat) {
          document.getElementById('payin-result-amount').textContent =
            payinSelected.denomination.symbol + parseFloat(amount).toFixed(2);
          document.getElementById('payin-result-token-icon').src = resolveIcon(payinSelected.receiveToken.icon);
          document.getElementById('payin-result-token-icon').alt = token;
          document.getElementById('payin-result-token-text').textContent =
            token + ' on ' + payinSelected.chain.value;
        } else {
          var decimals = (token === 'ETH' || token === 'WBTC') ? 6 : 2;
          document.getElementById('payin-result-amount').textContent =
            parseFloat(amount).toFixed(decimals) + ' ' + token;
          document.getElementById('payin-result-token-icon').src = resolveIcon(payinSelected.denomination.icon);
          document.getElementById('payin-result-token-icon').alt = token;
          document.getElementById('payin-result-token-text').textContent =
            token + ' on ' + payinSelected.chain.value;
        }
        document.getElementById('payin-result-desc').textContent = desc || '';

        // QR with real checkout URL
        var checkoutUrl = payment.checkoutUrl || (window.location.origin + '/pay.html?id=' + payment.id);
        var qr = qrcode(0, 'M');
        qr.addData(checkoutUrl);
        qr.make();
        document.getElementById('payin-qr-container').innerHTML = qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true });

        // Show settlement warning if module not configured
        var warningEl = document.getElementById('payin-settlement-warning');
        if (payment.warning) {
          if (!warningEl) {
            warningEl = document.createElement('div');
            warningEl.id = 'payin-settlement-warning';
            warningEl.style.cssText = 'background:#fef3c7;color:#92400e;font-size:11px;padding:10px 12px;border-radius:8px;margin-top:12px;text-align:left;line-height:1.4;';
            document.getElementById('payin-invoice-result').appendChild(warningEl);
          }
          warningEl.textContent = '⚠ ' + payment.warning;
          warningEl.style.display = 'block';
        } else if (warningEl) {
          warningEl.style.display = 'none';
        }

        document.getElementById('payin-invoice-form').style.display = 'none';
        document.getElementById('payin-invoice-result').style.display = 'block';
      } catch (e) {
        showToast('Failed to create payment: ' + e.message);
      }
    }

    function payinShowResult() {
      var amount = document.getElementById('payin-amount-input').value || '0';
      var desc = document.getElementById('payin-desc-input').value;
      var isFiat = payinSelected.denomination.type === 'fiat';

      if (isFiat) {
        document.getElementById('payin-result-amount').textContent =
          payinSelected.denomination.symbol + parseFloat(amount).toFixed(2);
        document.getElementById('payin-result-token-icon').src = resolveIcon(payinSelected.receiveToken.icon);
        document.getElementById('payin-result-token-icon').alt = payinSelected.receiveToken.value;
        document.getElementById('payin-result-token-text').textContent =
          payinSelected.receiveToken.value + ' on ' + payinSelected.chain.value;
      } else {
        var decimals = (payinSelected.denomination.value === 'ETH' || payinSelected.denomination.value === 'WBTC') ? 6 : 2;
        document.getElementById('payin-result-amount').textContent =
          parseFloat(amount).toFixed(decimals) + ' ' + payinSelected.denomination.value;
        document.getElementById('payin-result-token-icon').src = resolveIcon(payinSelected.denomination.icon);
        document.getElementById('payin-result-token-icon').alt = payinSelected.denomination.value;
        document.getElementById('payin-result-token-text').textContent =
          payinSelected.denomination.value + ' on ' + payinSelected.chain.value;
      }

      document.getElementById('payin-result-desc').textContent = desc || '';

      // Generate QR code
      var qr = qrcode(0, 'M');
      qr.addData('https://pay.omniflow.xyz/inv/a8f3k2');
      qr.make();
      document.getElementById('payin-qr-container').innerHTML = qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true });

      document.getElementById('payin-invoice-form').style.display = 'none';
      document.getElementById('payin-invoice-result').style.display = 'block';
    }

    function payinShowForm() {
      document.getElementById('payin-invoice-result').style.display = 'none';
      document.getElementById('payin-invoice-form').style.display = 'block';
    }

    function payinCopyLink() {
      var url = (isProd() && _lastPaymentId)
        ? (window.location.origin + '/pay.html?id=' + _lastPaymentId)
        : 'https://pay.omniflow.xyz/inv/a8f3k2';
      navigator.clipboard.writeText(url);
      var btn = document.getElementById('payin-btn-copy');
      var origHTML = btn.innerHTML;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
      setTimeout(function() { btn.innerHTML = origHTML; }, 2000);
    }

    var payerPreviewOriginalUsd = 0;
    var payerPreviewChain = '';
    var payerPreviewToken = 'USDC';
    var payerPreviewDesc = '';
    var PAYER_TOKENS = ['USDC', 'USDT', 'DAI'];
    var PAYER_TOKEN_ICONS = {
      USDC: 'icons/tokens/usdc.svg',
      USDT: 'icons/tokens/usdt.svg',
      DAI: 'icons/tokens/dai.svg'
    };
    var PAYER_CHAINS = [
      { name: 'Base', icon: 'icons/chains/base.svg' },
      { name: 'Ethereum', icon: 'icons/chains/eth_chain.svg' },
      { name: 'Arbitrum', icon: 'icons/chains/arb.svg' },
      { name: 'Optimism', icon: 'icons/chains/optimism.svg' },
      { name: 'Polygon', icon: 'icons/chains/polygon.svg' },
      { name: 'BNB Chain', icon: 'icons/chains/bnb.svg' }
    ];

    function openPayerPreview() {
      var amountText = document.getElementById('payin-result-amount').textContent;
      var desc = document.getElementById('payin-result-desc').textContent;
      var tokenText = document.getElementById('payin-result-token-text').textContent;

      var parts = tokenText.split(' on ');
      var currentToken = parts[0] || 'USDC';
      payerPreviewChain = parts[1] || 'Base';
      payerPreviewToken = currentToken;
      payerPreviewDesc = desc || '';

      var numStr = amountText.replace(/[^0-9.]/g, '');
      var num = parseFloat(numStr) || 0;
      var rate = PAYIN_RATES[currentToken] || 1;
      payerPreviewOriginalUsd = num * rate;

      // Populate step 1
      var isStable = (currentToken === 'USDC' || currentToken === 'USDT');
      var step1Amount = isStable
        ? '$' + num.toFixed(2)
        : num.toFixed(6) + ' ' + currentToken;
      document.getElementById('payer-step1-amount').textContent = step1Amount;
      document.getElementById('payer-step1-desc').textContent = payerPreviewDesc;
      document.getElementById('payer-step1-desc').style.display = payerPreviewDesc ? 'block' : 'none';
      document.getElementById('payer-step1-token-icon').src = resolveIcon(PAYER_TOKEN_ICONS[currentToken]);
      document.getElementById('payer-step1-token-text').textContent = currentToken + ' on ' + payerPreviewChain;

      // Always reset to step 1
      document.getElementById('payer-step-1').classList.add('active');
      document.getElementById('payer-step-2').classList.remove('active');
      document.getElementById('payer-step-3').classList.remove('active');

      document.getElementById('payer-preview-modal').classList.add('active');
    }

    function payerConnectWallet() {
      // Hide step 1, show step 2
      document.getElementById('payer-step-1').classList.remove('active');
      document.getElementById('payer-step-2').classList.add('active');

      // Set description
      document.getElementById('payer-preview-desc').textContent = payerPreviewDesc;
      document.getElementById('payer-preview-desc').style.display = payerPreviewDesc ? 'block' : 'none';

      // Render chips
      renderPayerChainChips(payerPreviewChain);
      renderPayerTokenChips(payerPreviewToken);
      selectPayerToken(payerPreviewToken);
    }

    function renderPayerChainChips(activeChain) {
      var container = document.getElementById('payer-chain-chips');
      container.innerHTML = '';
      PAYER_CHAINS.forEach(function(chain) {
        var chip = document.createElement('div');
        chip.className = 'payer-chain-chip' + (chain.name === activeChain ? ' active' : '');
        chip.onclick = function() { selectPayerChain(chain.name); };
        chip.innerHTML = '<img src="' + resolveIcon(chain.icon) + '" alt="' + chain.name + '"> ' + chain.name;
        container.appendChild(chip);
      });
    }

    function selectPayerChain(name) {
      payerPreviewChain = name;
      var chips = document.querySelectorAll('.payer-chain-chip');
      chips.forEach(function(c) { c.classList.remove('active'); });
      chips.forEach(function(c) {
        if (c.textContent.trim() === name) c.classList.add('active');
      });
      updatePayerConversionInfo();
    }

    function renderPayerTokenChips(activeToken) {
      var container = document.getElementById('payer-token-chips');
      container.innerHTML = '';
      PAYER_TOKENS.forEach(function(token) {
        var chip = document.createElement('div');
        chip.className = 'payer-token-chip' + (token === activeToken ? ' active' : '');
        chip.onclick = function() { selectPayerToken(token); };
        chip.innerHTML = '<img src="' + resolveIcon(PAYER_TOKEN_ICONS[token]) + '" alt="' + token + '"> ' + token;
        container.appendChild(chip);
      });
    }

    function selectPayerToken(token) {
      payerPreviewToken = token;
      var chips = document.querySelectorAll('.payer-token-chip');
      chips.forEach(function(c) { c.classList.remove('active'); });
      chips.forEach(function(c) {
        if (c.textContent.trim() === token) c.classList.add('active');
      });

      var rate = PAYIN_RATES[token] || 1;
      var converted = payerPreviewOriginalUsd / rate;
      var isStable = (token === 'USDC' || token === 'USDT');
      var formatted = isStable
        ? '$' + converted.toFixed(2)
        : converted.toFixed(6) + ' ' + token;

      document.getElementById('payer-preview-amount').textContent = formatted;
      document.getElementById('payer-pay-btn').textContent = 'Pay ' + (isStable ? '$' + converted.toFixed(2) : converted.toFixed(6) + ' ' + token);
      updatePayerConversionInfo();
    }

    function updatePayerConversionInfo() {
      var rate = PAYIN_RATES[payerPreviewToken] || 1;
      var converted = payerPreviewOriginalUsd / rate;
      var isStable = (payerPreviewToken === 'USDC' || payerPreviewToken === 'USDT');
      var info = isStable
        ? '\u2248 ' + converted.toFixed(2) + ' ' + payerPreviewToken + ' on ' + payerPreviewChain
        : '\u2248 ' + converted.toFixed(6) + ' ' + payerPreviewToken + ' on ' + payerPreviewChain;
      document.getElementById('payer-conversion-info').textContent = info;
    }

    function payerClickPay() {
      // Populate success step
      document.getElementById('payer-success-amount').textContent =
        document.getElementById('payer-preview-amount').textContent;
      document.getElementById('payer-success-desc').textContent = payerPreviewDesc;
      document.getElementById('payer-success-desc').style.display = payerPreviewDesc ? 'block' : 'none';

      var chainObj = PAYER_CHAINS.find(function(c) { return c.name === payerPreviewChain; }) || PAYER_CHAINS[0];
      document.getElementById('payer-success-token').innerHTML =
        '<img src="' + resolveIcon(PAYER_TOKEN_ICONS[payerPreviewToken]) + '" alt="' + payerPreviewToken + '"> ' + payerPreviewToken;
      document.getElementById('payer-success-chain').innerHTML =
        '<img src="' + resolveIcon(chainObj.icon) + '" alt="' + chainObj.name + '"> ' + chainObj.name;

      // Hide step 2, show step 3
      document.getElementById('payer-step-2').classList.remove('active');
      document.getElementById('payer-step-3').classList.add('active');
    }

    function closePayerPreview() {
      document.getElementById('payer-preview-modal').classList.remove('active');
    }

    document.getElementById('payer-preview-modal').addEventListener('click', function(e) {
      if (e.target === this) closePayerPreview();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && document.getElementById('payer-preview-modal').classList.contains('active')) {
        closePayerPreview();
      }
    });

    // Init payin icons and conversion on DOMContentLoaded
    window.addEventListener('DOMContentLoaded', function() {
      payinInitIcons();
      payinUpdateReceiveAsRow();
      payinUpdateConversionLabel();
    });


    // ============================================
    // EXPOSE PAYIN GLOBALS
    // ============================================
    window.payinToggleDropdown = payinToggleDropdown;
    window.payinCloseAllDropdowns = payinCloseAllDropdowns;
    window.payinSelectDenomination = payinSelectDenomination;
    window.payinSelectChain = payinSelectChain;
    window.payinSelectReceiveToken = payinSelectReceiveToken;
    window.payinUpdateConversionLabel = payinUpdateConversionLabel;
    window.payinHandleGenerate = payinHandleGenerate;
    window.payinShowForm = payinShowForm;
    window.payinCopyLink = payinCopyLink;
    window.payinInitIcons = payinInitIcons;
    window.payinUpdateReceiveAsRow = payinUpdateReceiveAsRow;
    window.openPayerPreview = openPayerPreview;
    window.payerConnectWallet = payerConnectWallet;
    window.renderPayerChainChips = renderPayerChainChips;
    window.selectPayerChain = selectPayerChain;
    window.renderPayerTokenChips = renderPayerTokenChips;
    window.selectPayerToken = selectPayerToken;
    window.updatePayerConversionInfo = updatePayerConversionInfo;
    window.payerClickPay = payerClickPay;
    window.closePayerPreview = closePayerPreview;
