    // ============================================
    // HISTORY VIEW
    // ============================================
    var historyCurrentPage = 1;
    var historyActiveTab = 'all';
    var historyFilters = { chain: 'all', token: 'all', status: 'all' };
    var HISTORY_PAGE_SIZE = 7;

    var historyAllTransactions = [
      // TODAY
      { date: 'TODAY', type: 'payout', desc: 'Batch #12 \u00b7 5 recipients', chain: 'base', chainLabel: 'Base', chainIcon: 'icons/chains/base.svg', crossChain: null, token: 'usdc', amount: '-$5,240', amountClass: 'outgoing', time: '14:14', status: 'completed' },
      { date: 'TODAY', type: 'payin', desc: 'Invoice #23 from <span class="mono">0xAb..3f</span>', chain: 'ethereum', chainLabel: 'Ethereum', chainIcon: 'icons/chains/eth_chain.svg', crossChain: { toLabel: 'Base', toIcon: 'icons/chains/base.svg' }, token: 'usdc', amount: '+$2,100', amountClass: 'incoming', time: '13:45', status: 'completed' },
      { date: 'TODAY', type: 'topup', desc: 'Top Up from MetaMask', chain: 'ethereum', chainLabel: 'Ethereum', chainIcon: 'icons/chains/eth_chain.svg', crossChain: null, token: 'usdc', amount: '+$10,000', amountClass: 'incoming', time: '11:30', status: 'completed' },
      // YESTERDAY
      { date: 'YESTERDAY', type: 'payout', desc: 'Payout to <span class="mono">0x8b..34</span>', chain: 'arbitrum', chainLabel: 'Arbitrum', chainIcon: 'icons/chains/arb.svg', crossChain: null, token: 'usdc', amount: '-$1,200', amountClass: 'outgoing', time: '16:20', status: 'completed' },
      { date: 'YESTERDAY', type: 'payin', desc: 'Received from <span class="mono">0x3f..bC</span>', chain: 'polygon', chainLabel: 'Polygon', chainIcon: 'icons/chains/polygon.svg', crossChain: null, token: 'usdc', amount: '+$3,330', amountClass: 'incoming', time: '09:15', status: 'processing' },
      // MAR 2
      { date: 'MAR 2', type: 'payout', desc: 'Batch #11 \u00b7 3 recipients', chain: 'base', chainLabel: 'Base', chainIcon: 'icons/chains/base.svg', crossChain: null, token: 'usdc', amount: '-$8,750', amountClass: 'outgoing', time: '14:00', status: 'completed' },
      { date: 'MAR 2', type: 'topup', desc: 'Top Up from MetaMask', chain: 'base', chainLabel: 'Base', chainIcon: 'icons/chains/base.svg', crossChain: null, token: 'usdc', amount: '+$15,000', amountClass: 'incoming', time: '10:00', status: 'completed' },
      // MAR 1
      { date: 'MAR 1', type: 'payin', desc: 'Invoice #22 from <span class="mono">0xCd..9a</span>', chain: 'ethereum', chainLabel: 'Ethereum', chainIcon: 'icons/chains/eth_chain.svg', crossChain: null, token: 'eth', amount: '+$6,400', amountClass: 'incoming', time: '15:30', status: 'completed' },
      { date: 'MAR 1', type: 'payout', desc: 'Payout to <span class="mono">0x2e..7F</span>', chain: 'base', chainLabel: 'Base', chainIcon: 'icons/chains/base.svg', crossChain: null, token: 'usdc', amount: '-$900', amountClass: 'outgoing', time: '12:45', status: 'pending' },
      // FEB 28
      { date: 'FEB 28', type: 'topup', desc: 'Top Up from Rabby', chain: 'arbitrum', chainLabel: 'Arbitrum', chainIcon: 'icons/chains/arb.svg', crossChain: null, token: 'usdc', amount: '+$5,000', amountClass: 'incoming', time: '09:00', status: 'completed' },
      { date: 'FEB 28', type: 'payout', desc: 'Batch #10 \u00b7 8 recipients', chain: 'base', chainLabel: 'Base', chainIcon: 'icons/chains/base.svg', crossChain: null, token: 'usdc', amount: '-$12,400', amountClass: 'outgoing', time: '17:30', status: 'completed' },
      { date: 'FEB 28', type: 'payin', desc: 'Received from <span class="mono">0xFa..12</span>', chain: 'optimism', chainLabel: 'Optimism', chainIcon: 'icons/chains/optimism.svg', crossChain: { toLabel: 'Base', toIcon: 'icons/chains/base.svg' }, token: 'usdc', amount: '+$1,850', amountClass: 'incoming', time: '11:20', status: 'completed' },
      // FEB 27
      { date: 'FEB 27', type: 'payout', desc: 'Payout to <span class="mono">0x91..eC</span>', chain: 'ethereum', chainLabel: 'Ethereum', chainIcon: 'icons/chains/eth_chain.svg', crossChain: null, token: 'eth', amount: '-$3,200', amountClass: 'outgoing', time: '14:10', status: 'completed' },
      { date: 'FEB 27', type: 'topup', desc: 'Top Up from MetaMask', chain: 'polygon', chainLabel: 'Polygon', chainIcon: 'icons/chains/polygon.svg', crossChain: null, token: 'usdc', amount: '+$2,000', amountClass: 'incoming', time: '10:30', status: 'completed' },
      // FEB 26
      { date: 'FEB 26', type: 'payin', desc: 'Invoice #21 from <span class="mono">0xBb..4D</span>', chain: 'base', chainLabel: 'Base', chainIcon: 'icons/chains/base.svg', crossChain: null, token: 'usdc', amount: '+$4,500', amountClass: 'incoming', time: '16:00', status: 'completed' },
      { date: 'FEB 26', type: 'payout', desc: 'Batch #9 \u00b7 2 recipients', chain: 'arbitrum', chainLabel: 'Arbitrum', chainIcon: 'icons/chains/arb.svg', crossChain: null, token: 'usdc', amount: '-$2,100', amountClass: 'outgoing', time: '13:15', status: 'completed' },
      { date: 'FEB 26', type: 'topup', desc: 'Top Up from Rabby', chain: 'ethereum', chainLabel: 'Ethereum', chainIcon: 'icons/chains/eth_chain.svg', crossChain: null, token: 'usdc', amount: '+$8,000', amountClass: 'incoming', time: '09:45', status: 'completed' }
    ];

    function historyGetFilteredTransactions() {
      return historyAllTransactions.filter(function(tx) {
        if (historyActiveTab !== 'all' && tx.type !== historyActiveTab) return false;
        if (historyFilters.chain !== 'all' && tx.chain !== historyFilters.chain) return false;
        if (historyFilters.token !== 'all' && tx.token !== historyFilters.token) return false;
        if (historyFilters.status !== 'all' && tx.status !== historyFilters.status) return false;
        return true;
      });
    }

    function historyRenderTransactions() {
      if (isProd()) {
        var container = document.getElementById('history-tx-list');
        if (container) container.innerHTML = '<div style="text-align:center;color:#c4b5fd;font-size:12px;padding:40px 0;">Coming soon</div>';
        return;
      }
      var filtered = historyGetFilteredTransactions();
      var totalPages = Math.max(1, Math.ceil(filtered.length / HISTORY_PAGE_SIZE));
      if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;

      var start = (historyCurrentPage - 1) * HISTORY_PAGE_SIZE;
      var page = filtered.slice(start, start + HISTORY_PAGE_SIZE);

      var container = document.getElementById('history-tx-list');
      var html = '';
      var lastDate = '';

      page.forEach(function(tx) {
        if (tx.date !== lastDate) {
          html += '<div class="history-date-header">' + tx.date + '</div>';
          lastDate = tx.date;
        }

        var iconClass = (tx.type === 'payout') ? 'outgoing' : 'incoming';
        var iconArrow = (tx.type === 'payout') ? '\u2191' : '\u2193';

        var chainHtml = '';
        if (tx.crossChain) {
          chainHtml = '<img src="' + resolveIcon(tx.chainIcon) + '" alt="' + tx.chainLabel + '"> ' + tx.chainLabel + ' <span class="arrow">\u2192</span> <img src="' + resolveIcon(tx.crossChain.toIcon) + '" alt="' + tx.crossChain.toLabel + '"> ' + tx.crossChain.toLabel;
        } else {
          chainHtml = '<img src="' + resolveIcon(tx.chainIcon) + '" alt="' + tx.chainLabel + '"> ' + tx.chainLabel;
        }

        var statusHtml = '';
        if (tx.status !== 'completed') {
          statusHtml = '<div class="history-tx-status-badge ' + tx.status + '">' + tx.status + '</div>';
        }

        html +=
          '<div class="history-tx-row" data-type="' + tx.type + '" data-chain="' + tx.chain + '" data-token="' + tx.token + '" data-status="' + tx.status + '">' +
            '<div class="history-tx-icon ' + iconClass + '">' + iconArrow + '</div>' +
            '<div class="history-tx-info">' +
              '<div class="history-tx-desc">' + tx.desc + '</div>' +
              '<div class="history-tx-chain">' + chainHtml + '</div>' +
            '</div>' +
            '<div class="history-tx-right">' +
              '<div class="history-tx-amount ' + tx.amountClass + '">' + tx.amount + '</div>' +
              '<div class="history-tx-time">' + tx.time + '</div>' +
              statusHtml +
            '</div>' +
          '</div>';
      });

      if (page.length === 0) {
        html = '<div style="text-align:center;padding:32px 0;color:#b0b4bd;font-size:14px;">No transactions found</div>';
      }

      container.innerHTML = html;

      // Update pagination info
      var total = filtered.length;
      var showStart = total === 0 ? 0 : start + 1;
      var showEnd = Math.min(start + HISTORY_PAGE_SIZE, total);
      document.getElementById('history-pagination-info').textContent = 'Showing ' + showStart + '\u2013' + showEnd + ' of ' + total;

      // Update page buttons
      var pageBtns = document.querySelectorAll('#view-history .history-page-btn[data-page]');
      pageBtns.forEach(function(btn) {
        var p = parseInt(btn.dataset.page);
        btn.classList.toggle('active', p === historyCurrentPage);
        btn.style.display = p <= totalPages ? '' : 'none';
      });
    }

    // History tab switching
    function historyInitTabs() {
      var tabs = document.querySelectorAll('#history-tabs .history-tab');
      tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          tabs.forEach(function(t) { t.classList.remove('active'); });
          tab.classList.add('active');
          historyActiveTab = tab.dataset.filter;
          historyCurrentPage = 1;
          historyRenderTransactions();
        });
      });
    }

    // History filter dropdowns
    function historyToggleFilter(type) {
      var pill = document.getElementById('history-' + type + '-filter');
      var dropdown = document.getElementById('history-' + type + '-filter-dropdown');
      var isOpen = dropdown.classList.contains('open');

      historyCloseAllFilters();

      if (!isOpen) {
        pill.classList.add('open');
        dropdown.classList.add('open');
      }
    }

    function historyCloseAllFilters() {
      document.querySelectorAll('#view-history .history-filter-pill').forEach(function(p) { p.classList.remove('open'); });
      document.querySelectorAll('#view-history .history-filter-dropdown').forEach(function(d) { d.classList.remove('open'); });
    }

    function historySelectFilter(type, label, value, event) {
      event.stopPropagation();
      historyFilters[type] = value;

      var pill = document.getElementById('history-' + type + '-filter');
      pill.childNodes[0].textContent = label + ' ';

      var dropdown = document.getElementById('history-' + type + '-filter-dropdown');
      dropdown.querySelectorAll('.history-filter-option').forEach(function(opt) {
        opt.classList.toggle('selected', opt.dataset.value === value);
      });

      historyCloseAllFilters();
      historyCurrentPage = 1;
      historyRenderTransactions();
    }

    // Close history filters on outside click
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.history-filter-pill')) {
        historyCloseAllFilters();
      }
    });

    // History pagination
    function historyGoPage(page) {
      var filtered = historyGetFilteredTransactions();
      var totalPages = Math.max(1, Math.ceil(filtered.length / HISTORY_PAGE_SIZE));
      if (page < 1 || page > totalPages) return;
      historyCurrentPage = page;
      historyRenderTransactions();
    }

    // History CSV export
    function historyExportCSV() {
      var filtered = historyGetFilteredTransactions();
      var csv = 'Date,Type,Description,Chain,Token,Amount,Status,Time\n';
      filtered.forEach(function(tx) {
        var desc = tx.desc.replace(/<[^>]*>/g, '');
        csv += tx.date + ',' + tx.type + ',"' + desc + '",' + tx.chainLabel + ',' + tx.token.toUpperCase() + ',"' + tx.amount + '",' + tx.status + ',' + tx.time + '\n';
      });

      var blob = new Blob([csv], { type: 'text/csv' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'omniflow-history-' + Date.now() + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      if (typeof showToast === 'function') showToast('History CSV downloaded');
    }

    // History icon init - resolve data-icon attributes in filter dropdowns
    function historyInitIcons() {
      document.querySelectorAll('#view-history .history-filter-option img[data-icon]').forEach(function(img) {
        var iconPath = img.getAttribute('data-icon');
        if (iconPath) img.src = resolveIcon(iconPath);
      });
    }


    // ============================================
    // EXPOSE HISTORY GLOBALS
    // ============================================
    window.historyRenderTransactions = historyRenderTransactions;
    window.historyInitTabs = historyInitTabs;
    window.historyToggleFilter = historyToggleFilter;
    window.historySelectFilter = historySelectFilter;
    window.historyGoPage = historyGoPage;
    window.historyExportCSV = historyExportCSV;
    window.historyInitIcons = historyInitIcons;
