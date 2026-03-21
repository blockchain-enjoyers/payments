    // ============================================
    // TOP UP VIEW
    // ============================================
    const TOPUP_RATES = { USDC: 1, USDT: 1, DAI: 1 };

    const TOPUP_CHAIN_IDS = {
      Polygon: 137, Avalanche: 43114, Base: 8453, Optimism: 10, Arbitrum: 42161
    };
    const TOPUP_TOKEN_ADDRESSES = {
      USDC: { Polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', Avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', Base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', Optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', Arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
      USDT: { Polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', Avalanche: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', Base: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', Optimism: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', Arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
      DAI:  { Polygon: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', Avalanche: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', Base: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', Optimism: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', Arbitrum: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' }
    };
    const TOPUP_TOKEN_DECIMALS = { USDC: 6, USDT: 6, DAI: 18 };
    const TOPUP_EXPLORERS = {
      Polygon: 'https://polygonscan.com/tx/', Avalanche: 'https://snowtrace.io/tx/',
      Base: 'https://basescan.org/tx/', Optimism: 'https://optimistic.etherscan.io/tx/',
      Arbitrum: 'https://arbiscan.io/tx/'
    };

    var _topupExternalWallet = null; // connected external wallet address

    const topupSelected = {
      chain: { value: 'Base', icon: 'icons/chains/base.svg' },
      token: { value: 'USDC', icon: 'icons/tokens/usdc.svg' }
    };

    // Initialize topup icons from ICON_MAP on load
    function topupInitIcons() {
      // Chain select icon
      const chainImg = document.getElementById('topup-chain-select-img');
      if (chainImg) chainImg.src = resolveIcon(topupSelected.chain.icon);

      // Token select icon
      const tokenImg = document.getElementById('topup-token-select-img');
      if (tokenImg) tokenImg.src = resolveIcon(topupSelected.token.icon);

      // Success chain icon
      const successChainIcon = document.getElementById('topup-success-chain-icon');
      if (successChainIcon) successChainIcon.src = resolveIcon(topupSelected.chain.icon);

      // Chain dropdown option icons
      document.querySelectorAll('.topup-chain-opt-img').forEach(img => {
        const iconPath = img.getAttribute('data-icon');
        if (iconPath) img.src = resolveIcon(iconPath);
      });

      // Token dropdown option icons
      document.querySelectorAll('.topup-token-opt-img').forEach(img => {
        const iconPath = img.getAttribute('data-icon');
        if (iconPath) img.src = resolveIcon(iconPath);
      });
    }

    // Connect external wallet via MetaMask / injected provider
    async function topupConnectWallet() {
      if (!window.ethereum) {
        alert('No wallet detected. Please install MetaMask or another Web3 wallet.');
        return;
      }
      try {
        var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) return;
        _topupExternalWallet = accounts[0];
        document.querySelector('.source-wallet-address').textContent =
          '\u00B7 ' + _topupExternalWallet.slice(0, 6) + '...' + _topupExternalWallet.slice(-4);
        // Detect wallet name
        var walletName = window.ethereum.isMetaMask ? 'MetaMask' : (window.ethereum.isRabby ? 'Rabby' : 'Wallet');
        document.querySelector('.source-wallet-label').textContent = walletName;
        document.getElementById('topup-state-connect').style.display = 'none';
        document.getElementById('topup-state-form').style.display = 'block';
        // Update balance for selected token
        topupRefreshBalance();
      } catch (e) {
        console.error('Wallet connect failed:', e);
      }
    }

    function topupDisconnectWallet() {
      _topupExternalWallet = null;
      document.getElementById('topup-state-form').style.display = 'none';
      document.getElementById('topup-state-connect').style.display = 'block';
      document.getElementById('topup-balance-hint').textContent = '';
    }

    // Fetch real ERC-20 balance from external wallet
    async function topupRefreshBalance() {
      if (!_topupExternalWallet || !window.ethereum) return;
      var chain = topupSelected.chain.value;
      var token = topupSelected.token.value;
      var tokenAddr = (TOPUP_TOKEN_ADDRESSES[token] || {})[chain];
      var decimals = TOPUP_TOKEN_DECIMALS[token] || 6;
      if (!tokenAddr) { document.getElementById('topup-balance-hint').textContent = 'Token not available on ' + chain; return; }

      try {
        // Switch chain if needed
        var targetChainId = '0x' + TOPUP_CHAIN_IDS[chain].toString(16);
        var currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (currentChainId !== targetChainId) {
          try {
            await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetChainId }] });
          } catch (switchErr) {
            document.getElementById('topup-balance-hint').textContent = 'Switch to ' + chain + ' in your wallet';
            return;
          }
        }

        // balanceOf(address) → ERC-20
        var balData = '0x70a08231000000000000000000000000' + _topupExternalWallet.slice(2).toLowerCase();
        var result = await window.ethereum.request({ method: 'eth_call', params: [{ to: tokenAddr, data: balData }, 'latest'] });
        var rawBal = BigInt(result);
        var formatted = Number(rawBal) / Math.pow(10, decimals);
        document.getElementById('topup-balance-hint').textContent =
          'Balance: ' + formatted.toLocaleString('en-US', { maximumFractionDigits: decimals > 6 ? 4 : 2 }) + ' ' + token;
      } catch (e) {
        console.error('Balance fetch failed:', e);
        document.getElementById('topup-balance-hint').textContent = 'Could not fetch balance';
      }
    }

    // Dropdown logic
    function topupToggleDropdown(type) {
      const select = document.getElementById('topup-' + type + '-select');
      const menu = document.getElementById('topup-' + type + '-dropdown');
      const isOpen = menu.classList.contains('open');

      topupCloseAllDropdowns();

      if (!isOpen) {
        select.classList.add('open');
        menu.classList.add('open');
      }
    }

    function topupCloseAllDropdowns() {
      document.querySelectorAll('#view-topup .dropdown-menu').forEach(m => m.classList.remove('open'));
      document.querySelectorAll('#view-topup .form-select').forEach(s => s.classList.remove('open'));
    }

    // Close topup dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#view-topup .dropdown-wrapper')) {
        topupCloseAllDropdowns();
      }
    });

    // Chain selector
    function topupSelectChain(value, icon) {
      topupSelected.chain = { value, icon };
      const select = document.getElementById('topup-chain-select');
      select.innerHTML = '<img src="' + resolveIcon(icon) + '" alt="' + value + '"> ' + value + ' <span class="chevron">&#9660;</span>';
      document.querySelectorAll('#topup-chain-dropdown .dropdown-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === value);
      });
      // Update destination label
      document.getElementById('topup-destination-label').textContent = 'Your OmniFlow on ' + value;
      topupCloseAllDropdowns();
      topupRefreshBalance();
    }

    // Token selector
    function topupSelectToken(value, icon) {
      topupSelected.token = { value, icon };
      const select = document.getElementById('topup-token-select');
      select.innerHTML = '<img src="' + resolveIcon(icon) + '" alt="' + value + '"> ' + value + ' <span class="chevron">&#9660;</span>';
      document.querySelectorAll('#topup-token-dropdown .dropdown-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === value);
      });
      topupUpdateConversion();
      topupCloseAllDropdowns();
      topupRefreshBalance();
    }

    // Update conversion label
    function topupUpdateConversion() {
      const amount = parseFloat(document.getElementById('topup-amount-input').value) || 0;
      const label = document.getElementById('topup-conversion-label');
      const token = topupSelected.token.value;
      const rate = TOPUP_RATES[token] || 1;

      if (amount === 0) {
        label.textContent = '';
        return;
      }

      const usdAmount = amount * rate;
      label.textContent = '\u2248 $' + usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Handle top up — real ERC-20 transfer
    async function topupHandleTopUp() {
      if (!isAuthenticated) {
        openAuthModal(function() { topupHandleTopUp(); });
        return;
      }
      if (!_topupExternalWallet || !window.ethereum) {
        alert('Please connect your wallet first.');
        return;
      }
      var recipient = CURRENT_USER && (CURRENT_USER.smartAccountAddress || CURRENT_USER.walletAddress);
      if (!recipient) {
        alert('Wallet address not found. Please re-login.');
        return;
      }

      var chain = topupSelected.chain.value;
      var token = topupSelected.token.value;
      var amount = parseFloat(document.getElementById('topup-amount-input').value) || 0;
      if (amount <= 0) { alert('Enter an amount.'); return; }

      var tokenAddr = (TOPUP_TOKEN_ADDRESSES[token] || {})[chain];
      var decimals = TOPUP_TOKEN_DECIMALS[token] || 6;
      if (!tokenAddr) { alert(token + ' is not available on ' + chain); return; }

      // Switch chain if needed
      var targetChainId = '0x' + TOPUP_CHAIN_IDS[chain].toString(16);
      try {
        var currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (currentChainId !== targetChainId) {
          await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetChainId }] });
        }
      } catch (e) {
        alert('Please switch to ' + chain + ' in your wallet.');
        return;
      }

      // Build ERC-20 transfer(address,uint256) calldata
      var rawAmount = BigInt(Math.round(amount * Math.pow(10, decimals)));
      var amountHex = rawAmount.toString(16).padStart(64, '0');
      var toHex = recipient.slice(2).toLowerCase().padStart(64, '0');
      var data = '0xa9059cbb' + toHex + amountHex;

      // Update button state
      var btn = document.querySelector('.btn-topup');
      var originalBtnHtml = btn.innerHTML;
      btn.innerHTML = 'Confirm in wallet...';
      btn.disabled = true;

      try {
        var txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: _topupExternalWallet,
            to: tokenAddr,
            data: data
          }]
        });
        topupShowSuccess(amount, token, chain, txHash);
      } catch (e) {
        console.error('Top up failed:', e);
        if (e.code !== 4001) alert('Transaction failed: ' + (e.message || e));
      } finally {
        btn.innerHTML = originalBtnHtml;
        btn.disabled = false;
      }
    }

    function topupShowSuccess(amount, token, chain, txHash) {
      var decimals = (TOPUP_TOKEN_DECIMALS[token] || 6) > 6 ? 4 : 2;
      document.getElementById('topup-success-amount').textContent =
        parseFloat(amount).toFixed(decimals) + ' ' + token;
      document.getElementById('topup-success-chain-icon').src = resolveIcon(topupSelected.chain.icon);
      document.getElementById('topup-success-chain-icon').alt = chain;
      document.getElementById('topup-success-chain-text').textContent = 'via ' + chain;

      // Show real tx hash with explorer link
      var txEl = document.querySelector('#topup-success-card .success-tx-hash');
      if (txEl && txHash) {
        var explorer = TOPUP_EXPLORERS[chain] || '';
        txEl.innerHTML = '<a href="' + explorer + txHash + '" target="_blank" style="color:#a78bfa;text-decoration:none;">' +
          txHash.slice(0, 8) + '...' + txHash.slice(-6) + '</a>';
      }

      document.getElementById('topup-card').style.display = 'none';
      document.getElementById('topup-success-card').style.display = 'block';

      // Refresh dashboard balance after a short delay
      setTimeout(function() { if (isProd()) loadProdDashboard(); }, 3000);
    }

    function topupShowForm() {
      document.getElementById('topup-success-card').style.display = 'none';
      document.getElementById('topup-card').style.display = 'block';
    }

    function topupUpdateDestinationAddress() {
      var addr = CURRENT_USER && (CURRENT_USER.smartAccountAddress || CURRENT_USER.walletAddress);
      var el = document.getElementById('topup-destination-address');
      if (el && addr) el.textContent = addr.slice(0, 6) + '...' + addr.slice(-4);
    }

    // Init topup icons and conversion on DOMContentLoaded
    window.addEventListener('DOMContentLoaded', () => {
      topupInitIcons();
      topupUpdateConversion();
      topupUpdateDestinationAddress();
    });

    // ============================================
    // EXPOSE TOPUP GLOBALS
    // ============================================
    window.topupConnectWallet = topupConnectWallet;
    window.topupDisconnectWallet = topupDisconnectWallet;
    window.topupToggleDropdown = topupToggleDropdown;
    window.topupCloseAllDropdowns = topupCloseAllDropdowns;
    window.topupSelectChain = topupSelectChain;
    window.topupSelectToken = topupSelectToken;
    window.topupUpdateConversion = topupUpdateConversion;
    window.topupHandleTopUp = topupHandleTopUp;
    window.topupShowForm = topupShowForm;
    window.topupUpdateDestinationAddress = topupUpdateDestinationAddress;
    window.topupInitIcons = topupInitIcons;
    window.topupRefreshBalance = topupRefreshBalance;
