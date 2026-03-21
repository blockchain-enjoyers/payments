    // ============================================
    // API CONFIG & MODE
    // ============================================
    var API_BASE = window.__OMNIFLOW_API_URL__
      || (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://omniflow.up.railway.app');
    var APP_MODE = localStorage.getItem('omniflow_mode') || 'demo'; // 'demo' | 'prod'
    var AUTH_TOKEN = localStorage.getItem('omniflow_token') || null;
    var CURRENT_USER = null;

    function isProd() { return APP_MODE === 'prod'; }

    // ---- API helpers ----
    async function api(method, path, body) {
      var headers = { 'Content-Type': 'application/json' };
      if (AUTH_TOKEN) headers['Authorization'] = 'Bearer ' + AUTH_TOKEN;
      var opts = { method: method, headers: headers };
      if (body) opts.body = JSON.stringify(body);
      var res = await fetch(API_BASE + '/v1/' + path, opts);
      var data = await res.json();
      if (!res.ok) throw new Error(data.message || 'API error ' + res.status);
      return data;
    }

    function apiGet(path) { return api('GET', path); }
    function apiPost(path, body) { return api('POST', path, body); }

    // ---- Mode toggle ----
    function toggleMode() {
      APP_MODE = APP_MODE === 'demo' ? 'prod' : 'demo';
      localStorage.setItem('omniflow_mode', APP_MODE);
      updateModeUI();
      // Reset auth state when switching modes
      if (APP_MODE === 'demo') {
        isAuthenticated = false;
        AUTH_TOKEN = null;
        CURRENT_USER = null;
        localStorage.removeItem('omniflow_token');
        document.getElementById('nav-connect').style.display = '';
        document.getElementById('nav-balance').style.display = '';
        document.getElementById('wallet-pill').style.display = 'none';
        document.getElementById('main').classList.remove('auth-active');
        document.getElementById('activity').style.display = '';
      } else {
        // In prod mode, check if we have a stored token
        if (AUTH_TOKEN) {
          restoreSession();
        } else {
          isAuthenticated = false;
          document.getElementById('nav-connect').style.display = '';
          document.getElementById('nav-balance').style.display = '';
          document.getElementById('wallet-pill').style.display = 'none';
          document.getElementById('main').classList.remove('auth-active');
          document.getElementById('activity').style.display = '';
        }
      }
      showToast(APP_MODE === 'prod' ? 'Switched to Prod mode' : 'Switched to Demo mode');
    }

    function updateModeUI() {
      var label = document.getElementById('mode-label');
      var track = document.getElementById('mode-track');
      if (APP_MODE === 'prod') {
        label.textContent = 'PROD';
        label.className = 'mode-toggle-label prod';
        track.classList.add('active');
        // Clear ALL hardcoded mock data in prod mode
        clearMockData();
      } else {
        label.textContent = 'DEMO';
        label.className = 'mode-toggle-label demo';
        track.classList.remove('active');
      }
    }

    function clearMockData() {
      var empty = '<div style="text-align:center;color:#c4b5fd;font-size:12px;padding:20px 0;">No activity yet</div>';

      // Dashboard
      var el = document.querySelector('#view-dashboard .balance-amount');
      if (el) el.textContent = '$0.00';
      el = document.querySelector('#view-dashboard .chain-chips');
      if (el) el.innerHTML = '';
      el = document.querySelector('#view-dashboard .activity-list');
      if (el) el.innerHTML = empty;

      // Home
      el = document.querySelector('#view-home .activity-list');
      if (el) el.innerHTML = empty;

      // Nav balance
      el = document.getElementById('nav-balance');
      if (el) el.textContent = '$0';

      // Payout — clear state and re-render
      el = document.querySelector('#payout-balance span');
      if (el) el.textContent = '$0';
      el = document.getElementById('payout-memo-input');
      if (el) el.value = '';
      el = document.getElementById('payout-result-total-amount');
      if (el) el.textContent = '';
      el = document.getElementById('payout-result-total-meta');
      if (el) el.textContent = '';
      if (typeof payoutState !== 'undefined') {
        payoutState.recipients = [{ address: '', amount: '', token: 'USDC', chain: 'Base' }];
        payoutState.memo = '';
        payoutState.balance = 0;
        if (typeof payoutRenderRecipients === 'function') payoutRenderRecipients();
        if (typeof payoutUpdateSummary === 'function') payoutUpdateSummary();
      }

      // Payin result
      el = document.getElementById('payin-result-amount');
      if (el) el.textContent = '';

      // Top Up
      el = document.querySelector('.source-wallet-address');
      if (el) el.textContent = '';
      el = document.getElementById('topup-conversion-label');
      if (el) el.textContent = '';
      el = document.querySelector('.destination-address');
      if (el) el.textContent = '';
      el = document.getElementById('topup-fee-amount');
      if (el) el.textContent = '';
      el = document.getElementById('topup-amount-input');
      if (el) el.value = '';
      el = document.getElementById('topup-balance-hint');
      if (el) el.textContent = '';

      // Payer modal
      el = document.getElementById('payer-step1-amount');
      if (el) el.textContent = '';
      el = document.getElementById('payer-step1-desc');
      if (el) el.textContent = '';
      el = document.getElementById('payer-preview-amount');
      if (el) el.textContent = '';
      el = document.getElementById('payer-preview-desc');
      if (el) el.textContent = '';
      el = document.getElementById('payer-pay-btn');
      if (el) el.textContent = 'Pay';
      el = document.getElementById('payer-success-amount');
      if (el) el.textContent = '';
      el = document.getElementById('payer-success-desc');
      if (el) el.textContent = '';
      el = document.getElementById('payer-success-from');
      if (el) el.textContent = '';
      el = document.getElementById('payer-success-tx');
      if (el) el.textContent = '';
    }

    async function restoreSession() {
      try {
        var results = await Promise.all([
          apiGet('auth/me'),
          isProd() ? apiGet('wallet/balances').catch(function() { return null; }) : Promise.resolve(null)
        ]);
        var user = results[0];
        CURRENT_USER = user;
        isAuthenticated = true;
        applyAuthUI(user, results[1]);
      } catch (e) {
        AUTH_TOKEN = null;
        CURRENT_USER = null;
        localStorage.removeItem('omniflow_token');
        isAuthenticated = false;
      }
    }

    function copyWalletAddress() {
      var addr = CURRENT_USER && (CURRENT_USER.smartAccountAddress || CURRENT_USER.walletAddress);
      if (!addr) return;
      navigator.clipboard.writeText(addr).then(function() {
        var pill = document.getElementById('wallet-pill');
        var original = pill.innerHTML;
        pill.innerHTML = 'Copied!';
        setTimeout(function() { pill.innerHTML = original; }, 1500);
      });
    }

    function applyAuthUI(user, prefetchedBalances) {
      document.getElementById('nav-connect').style.display = 'none';
      document.getElementById('wallet-pill').style.display = 'flex';
      if (user && user.smartAccountAddress) {
        var addr = user.smartAccountAddress;
        document.getElementById('wallet-pill').innerHTML =
          addr.slice(0, 6) + '...' + addr.slice(-4) +
          ' <span class="copy">&#x1f4cb;</span>';
      }
      document.getElementById('main').classList.add('auth-active');
      document.getElementById('activity').style.display = 'block';
      topupUpdateDestinationAddress();

      // Update balance in nav + dashboard + payout + settings if on that page
      if (isProd()) {
        if (prefetchedBalances) {
          renderProdDashboard(prefetchedBalances);
        } else {
          loadProdDashboard();
        }
        var currentHash = location.hash.slice(1) || 'home';
        if (currentHash === 'settings') loadSettingsPage();
      } else {
        document.getElementById('nav-balance').style.display = 'block';
      }
    }


    // Init mode UI on load
    window.addEventListener('DOMContentLoaded', function() {
      updateModeUI();
      if (isProd() && AUTH_TOKEN) {
        restoreSession();
      }
    });
    // ============================================
    // ICON MAP — all 10 SVG data URIs
    // ============================================
    const ICON_MAP = {
      "icons/tokens/eth.svg": "data:image/svg+xml,%3Csvg%20width%3D%22220%22%20height%3D%22220%22%20viewBox%3D%220%200%20220%20220%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cg%20clip-path%3D%22url(%23clip0_108_167)%22%3E%0A%3Cpath%20d%3D%22M110%20220C170.751%20220%20220%20170.751%20220%20110C220%2049.2487%20170.751%200%20110%200C49.2487%200%200%2049.2487%200%20110C0%20170.751%2049.2487%20220%20110%20220Z%22%20fill%3D%22%23627EEA%22%2F%3E%0A%3Cpath%20d%3D%22M113.424%2027.5V88.4813L164.966%20111.512L113.424%2027.5Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.602%22%2F%3E%0A%3Cpath%20d%3D%22M113.424%2027.5L61.875%20111.512L113.424%2088.4813V27.5Z%22%20fill%3D%22white%22%2F%3E%0A%3Cpath%20d%3D%22M113.424%20151.031V192.467L165%20121.111L113.424%20151.031Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.602%22%2F%3E%0A%3Cpath%20d%3D%22M113.424%20192.467V151.024L61.875%20121.111L113.424%20192.467Z%22%20fill%3D%22white%22%2F%3E%0A%3Cpath%20d%3D%22M113.424%20141.44L164.966%20111.513L113.424%2088.4956V141.44Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.2%22%2F%3E%0A%3Cpath%20d%3D%22M61.875%20111.513L113.424%20141.44V88.4956L61.875%20111.513Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.602%22%2F%3E%0A%3C%2Fg%3E%0A%3Cdefs%3E%0A%3CclipPath%20id%3D%22clip0_108_167%22%3E%0A%3Crect%20width%3D%22220%22%20height%3D%22220%22%20fill%3D%22white%22%2F%3E%0A%3C%2FclipPath%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E",
      "icons/tokens/usdc.svg": "data:image/svg+xml,%3Csvg%20width%3D%22220%22%20height%3D%22220%22%20viewBox%3D%220%200%20220%20220%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cg%20clip-path%3D%22url(%23clip0_108_15)%22%3E%0A%3Cpath%20d%3D%22M110%20220C131.756%20220%20153.023%20213.549%20171.113%20201.462C189.202%20189.375%20203.301%20172.195%20211.627%20152.095C219.952%20131.995%20222.131%20109.878%20217.886%2088.5401C213.642%2067.2022%20203.165%2047.6021%20187.782%2032.2183C172.398%2016.8345%20152.798%206.35804%20131.46%202.11367C110.122%20-2.13071%2088.0045%200.0476608%2067.9047%208.3733C47.8048%2016.6989%2030.6251%2030.7979%2018.5382%2048.8873C6.45123%2066.9767%20-0.000155252%2088.2441%20-0.000155252%20110C-0.035768%20124.455%202.78516%20138.775%208.30056%20152.137C13.816%20165.499%2021.9171%20177.64%2032.1387%20187.861C42.3602%20198.083%2054.5007%20206.184%2067.8626%20211.699C81.2245%20217.215%2095.5444%20220.036%20110%20220Z%22%20fill%3D%22%232775CA%22%2F%3E%0A%3Cpath%20d%3D%22M140.25%20127.42C140.25%20111.42%20130.63%20105.87%20111.38%20103.58C97.6199%20101.75%2094.8799%2098.0799%2094.8799%2091.6699C94.8799%2085.2599%2099.4599%2081.1199%20108.62%2081.1199C116.88%2081.1199%20121.46%2083.8699%20123.75%2090.7499C123.996%2091.4127%20124.439%2091.984%20125.021%2092.3865C125.602%2092.7889%20126.293%2093.003%20127%2092.9999H134.33C134.754%2093.0109%20135.177%2092.9354%20135.571%2092.7779C135.966%2092.6205%20136.324%2092.3845%20136.624%2092.0842C136.924%2091.7839%20137.16%2091.4256%20137.318%2091.0312C137.475%2090.6368%20137.551%2090.2144%20137.54%2089.7899V89.3399C136.654%2084.3722%20134.153%2079.8362%20130.424%2076.4365C126.695%2073.0369%20121.948%2070.964%20116.92%2070.5399V59.5399C116.92%2057.7099%20115.54%2056.3399%20113.25%2055.8799H106.37C104.54%2055.8799%20103.17%2057.2499%20102.71%2059.5399V70.1199C88.9199%2071.9999%2080.2099%2081.1199%2080.2099%2092.5799C80.2099%20107.71%2089.3799%20113.67%20108.63%20115.96C121.46%20118.25%20125.63%20120.96%20125.63%20128.33C125.63%20135.7%20119.22%20140.71%20110.51%20140.71C98.5899%20140.71%2094.5099%20135.71%2093.0899%20128.79C92.9589%20128.017%2092.5609%20127.314%2091.9652%20126.804C91.3695%20126.295%2090.6139%20126.01%2089.8299%20126H81.9999C81.5757%20125.99%2081.154%20126.067%2080.7602%20126.225C80.3664%20126.383%2080.0087%20126.619%2079.7087%20126.919C79.4087%20127.219%2079.1726%20127.576%2079.0147%20127.97C78.8568%20128.364%2078.7803%20128.786%2078.7899%20129.21V129.67C80.6299%20141.13%2087.9599%20149.38%20103.09%20151.67V162.67C103.09%20164.5%20104.46%20165.88%20106.75%20166.34H113.63C115.46%20166.34%20116.84%20164.96%20117.29%20162.67V151.67C131.04%20149.38%20140.21%20139.75%20140.21%20127.38L140.25%20127.42Z%22%20fill%3D%22white%22%2F%3E%0A%3Cpath%20d%3D%22M86.6199%20175.54C73.4321%20170.703%2062.0474%20161.933%2054.0047%20150.417C45.962%20138.9%2041.6492%20125.192%2041.6492%20111.145C41.6492%2097.0979%2045.962%2083.3896%2054.0047%2071.873C62.0474%2060.3565%2073.4321%2051.5869%2086.6199%2046.7498C87.4998%2046.3692%2088.2389%2045.7232%2088.7337%2044.902C89.2286%2044.0809%2089.4545%2043.1256%2089.3799%2042.1698V35.7498C89.4416%2034.9077%2089.196%2034.0717%2088.6885%2033.3969C88.181%2032.7221%2087.446%2032.2541%2086.6199%2032.0798C85.9747%2032.0125%2085.3265%2032.1754%2084.7899%2032.5398C68.104%2037.8433%2053.5386%2048.319%2043.202%2062.4505C32.8655%2076.5821%2027.2939%2093.6363%2027.2939%20111.145C27.2939%20128.653%2032.8655%20145.707%2043.202%20159.839C53.5386%20173.971%2068.104%20184.446%2084.7899%20189.75C85.1709%20189.971%2085.599%20190.099%2086.0391%20190.123C86.4792%20190.147%2086.9187%20190.067%2087.3216%20189.888C87.7245%20189.71%2088.0794%20189.438%2088.3572%20189.096C88.6351%20188.754%2088.8279%20188.351%2088.9199%20187.92C89.3799%20187.46%2089.3799%20187%2089.3799%20186.08V179.67C89.3799%20178.29%2087.9999%20176.46%2086.6199%20175.54ZM135.21%2032.5398C134.828%2032.3184%20134.399%2032.1907%20133.959%2032.1673C133.518%2032.1438%20133.078%2032.2252%20132.675%2032.4048C132.272%2032.5844%20131.917%2032.8571%20131.64%2033.2004C131.362%2033.5437%20131.171%2033.9479%20131.08%2034.3798C130.63%2034.8298%20130.63%2035.2898%20130.63%2036.2098V42.6198C130.707%2043.5441%20130.995%2044.4385%20131.472%2045.2341C131.949%2046.0298%20132.601%2046.7057%20133.38%2047.2098C146.568%2052.0469%20157.952%2060.8165%20165.995%2072.333C174.038%2083.8496%20178.351%2097.5579%20178.351%20111.605C178.351%20125.652%20174.038%20139.36%20165.995%20150.877C157.952%20162.393%20146.568%20171.163%20133.38%20176C132.501%20176.381%20131.763%20177.027%20131.27%20177.848C130.777%20178.67%20130.553%20179.625%20130.63%20180.58V187C130.568%20187.84%20130.812%20188.675%20131.317%20189.35C131.823%20190.024%20132.556%20190.493%20133.38%20190.67C134.025%20190.737%20134.673%20190.574%20135.21%20190.21C151.889%20184.833%20166.434%20174.304%20176.751%20160.139C187.068%20145.973%20192.626%20128.899%20192.626%20111.375C192.626%2093.8501%20187.068%2076.7769%20176.751%2062.6111C166.434%2048.4452%20151.889%2037.9167%20135.21%2032.5398Z%22%20fill%3D%22white%22%2F%3E%0A%3C%2Fg%3E%0A%3Cdefs%3E%0A%3CclipPath%20id%3D%22clip0_108_15%22%3E%0A%3Crect%20width%3D%22220%22%20height%3D%22220%22%20fill%3D%22white%22%2F%3E%0A%3C%2FclipPath%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E",
      "icons/tokens/usdt.svg": "data:image/svg+xml,%3Csvg%20width%3D%22220%22%20height%3D%22220%22%20viewBox%3D%220%200%20220%20220%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cg%20clip-path%3D%22url(%23clip0_108_407)%22%3E%0A%3Cpath%20d%3D%22M110%20220C170.751%20220%20220%20170.751%20220%20110C220%2049.2487%20170.751%200%20110%200C49.2487%200%200%2049.2487%200%20110C0%20170.751%2049.2487%20220%20110%20220Z%22%20fill%3D%22%2326A17B%22%2F%3E%0A%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M123.214%20119.51V119.497C122.458%20119.552%20118.56%20119.785%20109.863%20119.785C102.919%20119.785%2098.0311%20119.579%2096.3124%20119.497V119.517C69.5824%20118.342%2049.6311%20113.687%2049.6311%20108.118C49.6311%20102.557%2069.5824%2097.9022%2096.3124%2096.7059V114.883C98.0586%20115.007%20103.064%20115.303%20109.98%20115.303C118.278%20115.303%20122.437%20114.959%20123.214%20114.89V96.7197C149.889%2097.9091%20169.792%20102.563%20169.792%20108.118C169.792%20113.687%20149.889%20118.328%20123.214%20119.51ZM123.214%2094.8291V78.5628H160.435V53.7578H59.0911V78.5628H96.3124V94.8222C66.0624%2096.2109%2043.313%20102.206%2043.313%20109.383C43.313%20116.561%2066.0624%20122.549%2096.3124%20123.945V176.071H123.214V123.931C153.416%20122.542%20176.11%20116.554%20176.11%20109.383C176.11%20102.213%20153.416%2096.2247%20123.214%2094.8291Z%22%20fill%3D%22white%22%2F%3E%0A%3C%2Fg%3E%0A%3Cdefs%3E%0A%3CclipPath%20id%3D%22clip0_108_407%22%3E%0A%3Crect%20width%3D%22220%22%20height%3D%22220%22%20fill%3D%22white%22%2F%3E%0A%3C%2FclipPath%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E",
      "icons/tokens/wbtc.svg": "data:image/svg+xml,%3Csvg%20width%3D%22220%22%20height%3D%22220%22%20viewBox%3D%220%200%20220%20220%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cg%20clip-path%3D%22url(%23clip0_108_3)%22%3E%0A%3Cpath%20d%3D%22M220%20110C220%20131.756%20213.549%20153.023%20201.462%20171.113C189.375%20189.202%20172.195%20203.301%20152.095%20211.627C131.995%20219.952%20109.878%20222.131%2088.5401%20217.886C67.2022%20213.642%2047.6021%20203.166%2032.2183%20187.782C16.8345%20172.398%206.35804%20152.798%202.11367%20131.46C-2.13071%20110.122%200.0476608%2088.0047%208.3733%2067.9048C16.6989%2047.805%2030.7979%2030.6253%2048.8873%2018.5383C66.9767%206.45139%2088.2441%200%20110%200C139.174%200%20167.153%2011.5893%20187.782%2032.2183C208.411%2052.8473%20220%2080.8262%20220%20110Z%22%20fill%3D%22%23F7931A%22%2F%3E%0A%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M78.1801%2050.2304L103.46%2057.0004L109.11%2035.9404L121.75%2039.3704L116.32%2059.5604L126.63%2062.3304L132.07%2041.9204L144.93%2045.3604L139.39%2065.8804C139.39%2065.8804%20160.39%2070.5304%20165.33%2087.6104C170.27%20104.69%20154.47%20113.66%20149.59%20114C149.59%20114%20167.99%20124.09%20161.67%20143.94C155.35%20163.79%20135.95%20167.34%20115.54%20162.79L110%20184.07L97.1401%20180.63L102.79%20159.68L92.5901%20156.9L86.9401%20178L74.1801%20174.57L79.8401%20153.57L53.8901%20146.57L60.4301%20132.05C60.4301%20132.05%2067.7501%20134.05%2070.5201%20134.71C73.2901%20135.37%2075.0701%20132.49%2075.8501%20129.61C76.6301%20126.73%2088.3801%2079.0004%2089.4901%2075.0704C90.6001%2071.1404%2090.1501%2068.0704%2085.4901%2066.8604C80.8301%2065.6504%2074.4901%2063.7604%2074.4901%2063.7604L78.1801%2050.2304ZM103.68%20113.44L96.6801%20141.27C96.6801%20141.27%20131.39%20153.8%20135.83%20136.17C140.27%20118.54%20103.68%20113.44%20103.68%20113.44ZM106.9%20100.24L113.77%2074.7404C113.77%2074.7404%20143.49%2080.0604%20139.83%2094.2504C136.17%20108.44%20118.65%20103%20106.9%20100.24Z%22%20fill%3D%22white%22%2F%3E%0A%3C%2Fg%3E%0A%3Cdefs%3E%0A%3CclipPath%20id%3D%22clip0_108_3%22%3E%0A%3Crect%20width%3D%22220%22%20height%3D%22220%22%20fill%3D%22white%22%2F%3E%0A%3C%2FclipPath%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E",
      "icons/tokens/dai.svg": "data:image/svg+xml,%3Csvg%20width%3D%22220%22%20height%3D%22220%22%20viewBox%3D%220%200%20220%20220%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%22110%22%20cy%3D%22110%22%20r%3D%22110%22%20fill%3D%22%23F5AC37%22%2F%3E%3Cpath%20d%3D%22M139.4%2078.8H119.3C107.1%2078.8%2097.4%2086.6%2093.7%2097.6H85V105.4H91.5C91.4%20106.3%2091.3%20107.1%2091.3%20108V112H85V119.8H91.6C94.3%20131.8%20105.1%20140.8%20119.3%20140.8H139.4V128H119.3C112.1%20128%20105.9%20123.3%20103.3%20119.8H131V112H100.6C100.4%20110.7%20100.3%20109.4%20100.3%20108C100.3%20107.1%20100.3%20106.3%20100.4%20105.4H131V97.6H103.2C105.6%2093%20111.5%2091.5%20119.3%2091.5H139.4V78.8Z%22%20fill%3D%22white%22%2F%3E%3C%2Fsvg%3E",
      "icons/chains/base.svg": "data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cg%20clip-path%3D%22url(%23clip0_195_1728)%22%3E%0A%3Cpath%20d%3D%22M30%2060C46.5685%2060%2060%2046.5685%2060%2030C60%2013.4315%2046.5685%200%2030%200C13.4315%200%200%2013.4315%200%2030C0%2046.5685%2013.4315%2060%2030%2060Z%22%20fill%3D%22%230052FF%22%2F%3E%0A%3Cpath%20d%3D%22M30.1327%2050.8476C41.7604%2050.8476%2051.1862%2041.4379%2051.1862%2029.8305C51.1862%2018.2232%2041.7604%208.8136%2030.1327%208.8136C19.1012%208.8136%2010.0513%2017.2833%209.15247%2028.0639H36.9805V31.5972H9.15247C10.0513%2042.3777%2019.1012%2050.8476%2030.1327%2050.8476Z%22%20fill%3D%22white%22%2F%3E%0A%3C%2Fg%3E%0A%3Cdefs%3E%0A%3CclipPath%20id%3D%22clip0_195_1728%22%3E%0A%3Crect%20width%3D%2260%22%20height%3D%2260%22%20fill%3D%22white%22%2F%3E%0A%3C%2FclipPath%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E",
      "icons/chains/bnb.svg": "data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20d%3D%22M14.3009%209.19025L30.0893%200L45.8777%209.19025L40.0731%2012.5854L30.0893%206.79025L20.1054%2012.5854L14.3009%209.19025ZM45.8777%2020.7805L40.0731%2017.3854L30.0893%2023.1805L20.1054%2017.3854L14.3009%2020.7805V27.5708L24.2847%2033.3659V44.9561L30.0893%2048.3512L35.8939%2044.9561V33.3659L45.8777%2027.5708V20.7805ZM45.8777%2039.161V32.3708L40.0731%2035.7659V42.5561L45.8777%2039.161ZM49.999%2041.561L40.0152%2047.3561V54.1463L55.8036%2044.9561V26.5756L49.999%2029.9708V41.561ZM44.1944%2014.9854L49.999%2018.3805V25.1708L55.8036%2021.7756V14.9854L49.999%2011.5902L44.1944%2014.9854ZM24.2847%2049.8146V56.6049L30.0893%2060L35.8939%2056.6049V49.8146L30.0893%2053.2097L24.2847%2049.8146ZM14.3009%2039.161L20.1054%2042.5561V35.7659L14.3009%2032.3708V39.161ZM24.2847%2014.9854L30.0893%2018.3805L35.8939%2014.9854L30.0893%2011.5902L24.2847%2014.9854ZM10.1796%2018.3805L15.9841%2014.9854L10.1796%2011.5902L4.375%2014.9854V21.7756L10.1796%2025.1708V18.3805ZM10.1796%2029.9708L4.375%2026.5756V44.9561L20.1634%2054.1463V47.3561L10.1796%2041.561V29.9708Z%22%20fill%3D%22%23F0B90B%22%2F%3E%0A%3C%2Fsvg%3E",
      "icons/chains/optimism.svg": "data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cg%20clip-path%3D%22url(%23clip0_198_3655)%22%3E%0A%3Cpath%20d%3D%22M30%2060C46.5685%2060%2060%2046.5685%2060%2030C60%2013.4315%2046.5685%200%2030%200C13.4315%200%200%2013.4315%200%2030C0%2046.5685%2013.4315%2060%2030%2060Z%22%20fill%3D%22white%22%2F%3E%0A%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M30%2060C46.5685%2060%2060%2046.5685%2060%2030C60%2013.4315%2046.5685%200%2030%200C13.4315%200%200%2013.4315%200%2030C0%2046.5685%2013.4315%2060%2030%2060ZM18.7092%2038.2404C19.53%2038.4988%2020.4192%2038.628%2021.3768%2038.628C23.5808%2038.628%2025.3364%2038.1188%2026.6436%2037.1004C27.9508%2036.0668%2028.8628%2034.5088%2029.3796%2032.4264C29.5316%2031.7728%2029.676%2031.1192%2029.8128%2030.4656C29.9648%2029.812%2030.094%2029.1508%2030.2004%2028.482C30.3828%2027.4484%2030.3524%2026.544%2030.1092%2025.7688C29.8812%2024.9936%2029.4784%2024.34%2028.9008%2023.808C28.3384%2023.276%2027.6468%2022.8808%2026.826%2022.6224C26.0204%2022.3488%2025.1388%2022.212%2024.1812%2022.212C21.962%2022.212%2020.1988%2022.744%2018.8916%2023.808C17.5844%2024.872%2016.68%2026.43%2016.1784%2028.482C16.0264%2029.1508%2015.8744%2029.812%2015.7224%2030.4656C15.5856%2031.1192%2015.4564%2031.7728%2015.3348%2032.4264C15.1676%2033.46%2015.198%2034.3644%2015.426%2035.1396C15.6692%2035.9148%2016.072%2036.5608%2016.6344%2037.0776C17.1968%2037.5944%2017.8884%2037.982%2018.7092%2038.2404ZM23.8392%2034.6152C23.216%2035.1016%2022.494%2035.3448%2021.6732%2035.3448C20.8372%2035.3448%2020.2368%2035.1016%2019.872%2034.6152C19.5072%2034.1288%2019.416%2033.3536%2019.5984%2032.2896C19.72%2031.6208%2019.8416%2030.99%2019.9632%2030.3972C20.1%2029.8044%2020.252%2029.1888%2020.4192%2028.5504C20.6776%2027.4864%2021.1108%2026.7112%2021.7188%2026.2248C22.342%2025.7384%2023.064%2025.4952%2023.8848%2025.4952C24.7056%2025.4952%2025.306%2025.7384%2025.686%2026.2248C26.066%2026.7112%2026.1572%2027.4864%2025.9596%2028.5504C25.8532%2029.1888%2025.7316%2029.8044%2025.5948%2030.3972C25.4732%2030.99%2025.3288%2031.6208%2025.1616%2032.2896C24.9032%2033.3536%2024.4624%2034.1288%2023.8392%2034.6152ZM30.7685%2038.2404C30.8597%2038.3468%2030.9812%2038.4%2031.1333%2038.4H34.2341C34.4012%2038.4%2034.5456%2038.3468%2034.6673%2038.2404C34.8041%2038.134%2034.8876%2037.9972%2034.9181%2037.83L35.9669%2032.8368H39.0449C41.0057%2032.8368%2042.5636%2032.4188%2043.7189%2031.5828C44.8892%2030.7468%2045.6644%2029.4548%2046.0445%2027.7068C46.2269%2026.8252%2046.2192%2026.0576%2046.0217%2025.404C45.824%2024.7352%2045.4745%2024.1804%2044.9729%2023.7396C44.4713%2023.2988%2043.8404%2022.972%2043.0805%2022.7592C42.3356%2022.5464%2041.4996%2022.44%2040.5725%2022.44H34.5077C34.3556%2022.44%2034.2113%2022.4932%2034.0745%2022.5996C33.9377%2022.706%2033.854%2022.8428%2033.8237%2023.01L30.6773%2037.83C30.6468%2037.9972%2030.6773%2038.134%2030.7685%2038.2404ZM39.1817%2029.6904H36.5597L37.4489%2025.6092H40.1849C40.7321%2025.6092%2041.1348%2025.7004%2041.3933%2025.8828C41.6669%2026.0652%2041.8265%2026.3084%2041.8721%2026.6124C41.9177%2026.9164%2041.9024%2027.266%2041.8265%2027.6612C41.6744%2028.3452%2041.3477%2028.8544%2040.8461%2029.1888C40.3596%2029.5232%2039.8048%2029.6904%2039.1817%2029.6904Z%22%20fill%3D%22%23FF0420%22%2F%3E%0A%3C%2Fg%3E%0A%3Cdefs%3E%0A%3CclipPath%20id%3D%22clip0_198_3655%22%3E%0A%3Crect%20width%3D%2260%22%20height%3D%2260%22%20fill%3D%22white%22%2F%3E%0A%3C%2FclipPath%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E",
      "icons/chains/polygon.svg": "data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2255%22%20viewBox%3D%220%200%2060%2055%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20d%3D%22M22.4995%2018.4471L16.8749%2015.1915L0%2024.9577V44.4889L16.8749%2054.2552L33.7506%2044.4889V14.106L43.1249%208.68084L52.5006%2014.106V24.9577L43.1249%2030.3829L37.5003%2027.1283V35.8081L43.1249%2039.0638L60%2029.2975V9.76628L43.1249%200L26.2502%209.76628V40.1492L16.8749%2045.5744L7.50016%2040.1492V29.2975L16.8749%2023.8723L22.4995%2027.1269V18.4471Z%22%20fill%3D%22%236600FF%22%2F%3E%0A%3C%2Fsvg%3E",
      "icons/chains/arb.svg": "data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cg%20clip-path%3D%22url(%23clip0_195_1668)%22%3E%0A%3Cpath%20d%3D%22M29.7116%203.72457C29.8586%203.72457%2029.9942%203.76169%2030.1298%203.8345L52.1332%2016.6314C52.3916%2016.7784%2052.5515%2017.0497%2052.5386%2017.3437L52.453%2042.8019C52.453%2043.0974%2052.2931%2043.3672%2052.0347%2043.5142L29.9571%2056.1626C29.8343%2056.2369%2029.6873%2056.2726%2029.5388%2056.2726C29.3903%2056.2726%2029.2562%2056.2355%2029.1205%2056.1626L7.11858%2043.3672C6.86019%2043.2202%206.7003%2042.9489%206.71315%2042.6548L6.79881%2017.1967C6.79881%2016.9012%206.95869%2016.6314%207.21709%2016.4843L29.3061%203.82307C29.4289%203.76169%2029.5759%203.72457%2029.7116%203.72457ZM29.7244%200C28.9378%200%2028.1512%200.197007%2027.4503%200.602441L5.37265%2013.2508C3.95934%2014.0631%203.08566%2015.5621%203.08566%2017.1853L3%2042.6434C3%2044.2666%203.86083%2045.7655%205.2613%2046.5893L27.2647%2059.3861C27.9656%2059.7916%2028.7522%2060.0014%2029.5388%2060.0014C30.3254%2060.0014%2031.112%2059.8044%2031.813%2059.399L53.8906%2046.7506C55.3039%2045.9397%2056.1776%2044.4393%2056.1776%2042.8176L56.2632%2017.3594C56.2632%2015.7363%2055.4024%2014.2373%2054.0019%2013.4136L31.9985%200.615289C31.2976%200.209855%2030.511%200%2029.7244%200Z%22%20fill%3D%22%231B4ADD%22%2F%3E%0A%3Cpath%20d%3D%22M34.1852%2013.8776H30.9646C30.7191%2013.8776%2030.5092%2014.0246%2030.4235%2014.2587L20.0493%2042.6905C19.975%2042.8747%2020.1235%2043.0717%2020.3191%2043.0717H23.5397C23.7853%2043.0717%2023.9951%2042.9247%2024.0808%2042.6905L34.455%2014.2587C34.5293%2014.0746%2034.3808%2013.8776%2034.1852%2013.8776ZM28.5434%2013.8776H25.3228C25.0772%2013.8776%2024.8674%2014.0246%2024.7817%2014.2587L14.4189%2042.6791C14.3446%2042.8633%2014.4931%2043.0603%2014.6887%2043.0603H17.9093C18.1549%2043.0603%2018.3647%2042.9132%2018.4504%2042.6791L28.8132%2014.2587C28.8875%2014.0746%2028.7518%2013.8776%2028.5434%2013.8776ZM32.7234%2024.8914C32.6377%2024.633%2032.268%2024.633%2032.1823%2024.8914L30.5106%2029.4882C30.4621%2029.611%2030.4621%2029.758%2030.5106%2029.8822L35.1817%2042.6791C35.2673%2042.9004%2035.4772%2043.0603%2035.7227%2043.0603H38.9434C39.1404%2043.0603%2039.2874%2042.8633%2039.2132%2042.6791L32.7234%2024.8914ZM44.8436%2042.6791L35.5386%2017.1596C35.4529%2016.9012%2035.0832%2016.9012%2034.9975%2017.1596L33.3258%2021.7564C33.2773%2021.8792%2033.2773%2022.0262%2033.3258%2022.1504L40.8121%2042.6791C40.8977%2042.9004%2041.1076%2043.0603%2041.3531%2043.0603H44.5738C44.7822%2043.0731%2044.9178%2042.8633%2044.8436%2042.6791Z%22%20fill%3D%22%231B4ADD%22%2F%3E%0A%3C%2Fg%3E%0A%3Cdefs%3E%0A%3CclipPath%20id%3D%22clip0_195_1668%22%3E%0A%3Crect%20width%3D%2260%22%20height%3D%2260%22%20fill%3D%22white%22%2F%3E%0A%3C%2FclipPath%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E",
      "icons/chains/avalanche.svg": "data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%2230%22%20fill%3D%22%23E84142%22%2F%3E%3Cpath%20d%3D%22M40.7%2041H35.9C35.1%2041%2034.5%2040.6%2034.1%2039.9L30.3%2032.5C30.1%2032.2%2029.9%2032.2%2029.7%2032.5L25.9%2039.9C25.5%2040.6%2024.9%2041%2024.1%2041H19.3C18.8%2041%2018.5%2040.7%2018.5%2040.3C18.5%2040.1%2018.6%2040%2018.7%2039.8L29.4%2019.6C29.6%2019.2%2030%2019%2030.4%2019C30.8%2019%2031.2%2019.2%2031.4%2019.6L41.3%2039.8C41.4%2040%2041.5%2040.1%2041.5%2040.3C41.5%2040.7%2041.2%2041%2040.7%2041Z%22%20fill%3D%22white%22%2F%3E%3C%2Fsvg%3E",
      "icons/chains/eth_chain.svg": "data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cg%20clip-path%3D%22url(%23clip0_197_3187)%22%3E%0A%3Cpath%20opacity%3D%220.6%22%20d%3D%22M29.993%2021.8877L11.5781%2030.2593L29.993%2041.1486L48.4146%2030.2593L29.993%2021.8877Z%22%20fill%3D%22black%22%2F%3E%0A%3Cpath%20opacity%3D%220.45%22%20d%3D%22M11.585%2030.2526L29.9998%2041.1418V-0.300049L11.585%2030.2526Z%22%20fill%3D%22black%22%2F%3E%0A%3Cpath%20opacity%3D%220.8%22%20d%3D%22M30%20-0.300049V41.1418L48.4148%2030.2526L30%20-0.300049Z%22%20fill%3D%22black%22%2F%3E%0A%3Cpath%20opacity%3D%220.45%22%20d%3D%22M11.5781%2033.7458L29.993%2059.6999V44.6283L11.5781%2033.7458Z%22%20fill%3D%22black%22%2F%3E%0A%3Cpath%20opacity%3D%220.8%22%20d%3D%22M29.9932%2044.6283V59.6999L48.4216%2033.7458L29.9932%2044.6283Z%22%20fill%3D%22black%22%2F%3E%0A%3C%2Fg%3E%0A%3Cdefs%3E%0A%3CclipPath%20id%3D%22clip0_197_3187%22%3E%0A%3Crect%20width%3D%2260%22%20height%3D%2260%22%20fill%3D%22white%22%2F%3E%0A%3C%2FclipPath%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E"
    };

    function resolveIcon(path) {
      return ICON_MAP[path] || path;
    }

    // ============================================
    // DASHBOARD ICONS INIT
    // ============================================
    function initDashboardIcons() {
      const iconAssignments = {
        'dash-chain-base': 'icons/chains/base.svg',
        'dash-chain-arb': 'icons/chains/arb.svg',
        'dash-chain-eth': 'icons/chains/eth_chain.svg',
        'dash-token-usdc': 'icons/tokens/usdc.svg'
      };
      for (const [id, path] of Object.entries(iconAssignments)) {
        const el = document.getElementById(id);
        if (el) el.src = resolveIcon(path);
      }
    }

    document.addEventListener('DOMContentLoaded', initDashboardIcons);

    // ============================================
    // SPA ROUTER
    // ============================================
    function navigateTo(view) {
      location.hash = view;
    }

    var _currentView = '';

    function handleRoute() {
      const hash = location.hash.slice(1) || 'home';
      const validViews = ['landing', 'home', 'dashboard', 'payin', 'payout', 'topup', 'history', 'settings'];
      const view = validViews.includes(hash) ? hash : 'home';

      // Cleanup previous view
      if (_currentView === 'landing' && view !== 'landing') {
        if (typeof landingCleanup === 'function') landingCleanup();
      }

      _currentView = view;

      // Toggle body class for landing
      document.body.classList.toggle('on-landing', view === 'landing');

      // Deactivate all views
      document.querySelectorAll('.view.active').forEach(v => v.classList.remove('active'));

      // Activate target view
      const target = document.getElementById('view-' + view);
      if (target) {
        requestAnimationFrame(() => {
          target.classList.add('active');
        });
      }

      // Update nav active state
      document.querySelectorAll('.topnav .nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (view === 'home') {
          link.classList.remove('active');
        } else if (href === '#' + view) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });

      // Init landing view
      if (view === 'landing') {
        if (typeof landingInit === 'function') landingInit();
      }
    }

    window.addEventListener('hashchange', function() { handleRoute(); });
    window.addEventListener('DOMContentLoaded', function() { handleRoute(); });

    // ============================================
    // TOAST (shared)
    // ============================================
    function showToast(msg) {
      var toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(function() { toast.classList.remove('show'); }, 2500);
    }

    // ============================================
    // CARD MOUSE-TRACKING SPOTLIGHT
    // ============================================
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
        card.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
      });
    });

    // Card clicks navigate to SPA views
    document.querySelector('#view-home .card-payin').addEventListener('click', () => {
      navigateTo('payin');
    });
    document.querySelector('#view-home .card-payout').addEventListener('click', () => {
      navigateTo('payout');
    });

    // ============================================
    // EXPOSE GLOBALS for other script files
    // ============================================
    window.API_BASE = API_BASE;
    window.APP_MODE = APP_MODE;
    window.AUTH_TOKEN = AUTH_TOKEN;
    window.CURRENT_USER = CURRENT_USER;
    window.isProd = isProd;
    window.api = api;
    window.apiGet = apiGet;
    window.apiPost = apiPost;
    window.toggleMode = toggleMode;
    window.updateModeUI = updateModeUI;
    window.clearMockData = clearMockData;
    window.restoreSession = restoreSession;
    window.copyWalletAddress = copyWalletAddress;
    window.applyAuthUI = applyAuthUI;
    window.showToast = showToast;
    window.navigateTo = navigateTo;
    window.handleRoute = handleRoute;
    window.resolveIcon = resolveIcon;
    window.initDashboardIcons = initDashboardIcons;
    window.ICON_MAP = ICON_MAP;

    // Mutable state — already on window via top-level var declarations
