document.addEventListener('DOMContentLoaded', () => {
    const landingPage = document.getElementById('landing-page');
    const formPage = document.getElementById('form-page');
    const loadingPage = document.getElementById('loading-page');
    const resultsPage = document.getElementById('results-page');

    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    const browseBtn = document.getElementById('browse-btn');
    const pdfInput = document.getElementById('pdf-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const uploadZone = document.getElementById('upload-zone');
    const fileNameEl = document.getElementById('file-name');

    let selectedFile = null;

    // Load user info into nav
    fetch('/auth/user').then(r => r.json()).then(({ user }) => {
        if (!user) return;
        const navUser = document.getElementById('nav-user');
        const avatarEl = document.getElementById('user-avatar');
        const nameEl = document.getElementById('user-name');
        if (user.avatar) avatarEl.src = user.avatar;
        else avatarEl.style.display = 'none';
        nameEl.textContent = user.name || user.email || '';
        navUser.style.display = 'flex';
    });

    function showView(viewElement) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('section-active'));
        viewElement.classList.add('section-active');
    }

    startBtn.addEventListener('click', () => showView(formPage));

    restartBtn.addEventListener('click', () => {
        selectedFile = null;
        pdfInput.value = '';
        fileNameEl.textContent = '';
        analyzeBtn.disabled = true;
        uploadZone.classList.remove('upload-zone--active');
        showView(landingPage);
    });

    browseBtn.addEventListener('click', () => pdfInput.click());
    pdfInput.addEventListener('change', () => { if (pdfInput.files[0]) setFile(pdfInput.files[0]); });

    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('upload-zone--hover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('upload-zone--hover'));
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('upload-zone--hover');
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            setFile(file);
        } else {
            fileNameEl.textContent = 'Please drop a PDF file.';
            fileNameEl.style.color = 'var(--status-red)';
        }
    });

    function setFile(file) {
        selectedFile = file;
        fileNameEl.textContent = file.name;
        fileNameEl.style.color = 'var(--status-green)';
        uploadZone.classList.add('upload-zone--active');
        analyzeBtn.disabled = false;
    }

    analyzeBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        showView(loadingPage);
        try {
            const base64 = await readFileAsBase64(selectedFile);
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pdf: base64 }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Analysis failed');
            }
            const data = await response.json();
            renderResults(data);
            showView(resultsPage);
        } catch (error) {
            console.error('Error during analysis:', error);
            alert(`Error: ${error.message}\n\nPlease ensure your PDF contains financial figures (sales, expenses, inventory).`);
            showView(formPage);
        }
    });

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function renderResults(data) {
        const symbol = data.symbol || '$';

        // Industry label in header
        const industryEl = document.getElementById('dashboard-industry');
        if (industryEl && data.industry) industryEl.textContent = data.industry;

        // 1. Health Score
        const scoreValue = document.getElementById('score-value');
        const scoreProgress = document.getElementById('score-progress');
        const scoreLabel = document.getElementById('score-label');
        scoreValue.textContent = data.score;
        const offset = 283 - (283 * data.score) / 100;
        setTimeout(() => { scoreProgress.style.strokeDashoffset = offset; }, 100);
        let bgClass = 'bg-red', labelText = 'Critical', colorHex = 'var(--status-red)';
        if (data.score >= 70) { bgClass = 'bg-green'; labelText = 'Healthy'; colorHex = 'var(--status-green)'; }
        else if (data.score >= 40) { bgClass = 'bg-yellow'; labelText = 'Warning'; colorHex = 'var(--status-yellow)'; }
        scoreLabel.textContent = labelText;
        scoreLabel.className = `score-label ${bgClass}`;
        scoreProgress.style.stroke = colorHex;

        // 2. Profit KPI
        const profitValue = document.getElementById('profit-value');
        const profitLabel = document.getElementById('profit-label');
        profitValue.textContent = `${symbol}${data.profit.toLocaleString()}`;
        profitLabel.textContent = data.profit > 0 ? 'Profitable' : 'Loss Making';
        profitLabel.className = `badge ${data.profit > 0 ? 'bg-green' : 'bg-red'}`;

        const marginEl = document.getElementById('profit-margin');
        if (marginEl) marginEl.textContent = data.profitMargin != null ? `${data.profitMargin}%` : '—';

        const trendEl = document.getElementById('trend-value');
        if (trendEl && data.trend) {
            const trendMap = {
                improving: { text: '▲ Improving', cls: 'status-green' },
                declining:  { text: '▼ Declining',  cls: 'status-red' },
                stable:     { text: '→ Stable',      cls: 'status-yellow' },
            };
            const t = trendMap[data.trend] || { text: data.trend, cls: '' };
            trendEl.textContent = t.text;
            trendEl.className = `kpi-meta-value ${t.cls}`;
        }

        // 3. Industry Comparison
        const compCard = document.getElementById('comparison-card');
        if (data.comparison) {
            const c = data.comparison;
            document.getElementById('comp-industry-label').textContent = c.industry;

            setCompBar('comp-margin-yours-bar', 'comp-margin-yours-val', c.yourMargin, 40, 'var(--primary)');
            setCompBar('comp-margin-ind-bar',   'comp-margin-ind-val',   c.industryMargin, 40, 'rgba(148,163,184,0.5)');
            setCompBar('comp-exp-yours-bar',    'comp-exp-yours-val',    c.yourExpenseRatio, 100, 'var(--status-red)');
            setCompBar('comp-exp-ind-bar',      'comp-exp-ind-val',      c.industryExpenseRatio, 100, 'rgba(148,163,184,0.5)');

            const verdictEl = document.getElementById('comp-verdict');
            const marginBetter = c.yourMargin >= c.industryMargin;
            const expBetter = c.yourExpenseRatio <= c.industryExpenseRatio;
            if (marginBetter && expBetter) {
                verdictEl.textContent = 'Above industry average on both margin and efficiency.';
                verdictEl.className = 'comp-verdict verdict-good';
            } else if (!marginBetter && !expBetter) {
                verdictEl.textContent = 'Below industry average — focus on margin and cost control.';
                verdictEl.className = 'comp-verdict verdict-bad';
            } else {
                verdictEl.textContent = marginBetter
                    ? 'Good margin, but expenses are higher than industry peers.'
                    : 'Lean on expenses, but profit margin trails the industry.';
                verdictEl.className = 'comp-verdict verdict-mixed';
            }
            compCard.style.display = '';
        } else {
            compCard.style.display = 'none';
        }

        // 4. Problems
        const problemsList = document.getElementById('problems-list');
        problemsList.innerHTML = '';
        if (data.problems.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No critical problems detected.';
            li.style.borderLeftColor = 'var(--status-green)';
            problemsList.appendChild(li);
        } else {
            data.problems.forEach(prob => {
                const li = document.createElement('li');
                li.textContent = prob;
                problemsList.appendChild(li);
            });
        }

        // 5. Suggestions
        const suggestionsList = document.getElementById('suggestions-list');
        suggestionsList.innerHTML = '';
        data.suggestions.forEach(sugg => {
            const li = document.createElement('li');
            li.textContent = sugg;
            suggestionsList.appendChild(li);
        });

        // 6. Revenue Breakdown
        const revCard = document.getElementById('revenue-breakdown-card');
        const revEl = document.getElementById('revenue-breakdown');
        if (data.revenue_breakdown && data.revenue_breakdown.length > 0) {
            revEl.innerHTML = '';
            revCard.style.display = '';
            data.revenue_breakdown.forEach(item => revEl.appendChild(buildBar(item.label, item.value, item.pct, symbol, 'var(--primary)')));
        } else {
            revCard.style.display = 'none';
        }

        // 7. Expense Breakdown
        const expCard = document.getElementById('expense-breakdown-card');
        const expEl = document.getElementById('expense-breakdown');
        if (data.expense_breakdown && data.expense_breakdown.length > 0) {
            expEl.innerHTML = '';
            expCard.style.display = '';
            data.expense_breakdown.forEach(item => expEl.appendChild(buildBar(item.label, item.value, item.pct, symbol, 'var(--status-red)')));
        } else {
            expCard.style.display = 'none';
        }

        // 8. Observations
        const obsCard = document.getElementById('observations-card');
        const obsList = document.getElementById('observations-list');
        if (data.observations && data.observations.length > 0) {
            obsList.innerHTML = '';
            obsCard.style.display = '';
            data.observations.forEach(obs => {
                const li = document.createElement('li');
                li.textContent = obs;
                obsList.appendChild(li);
            });
        } else {
            obsCard.style.display = 'none';
        }

        // 9. Simulation
        const simScenarioText = document.getElementById('sim-scenario-text');
        const simProfit = document.getElementById('sim-new-profit');
        const simChange = document.getElementById('sim-change');
        if (data.simulation) {
            simScenarioText.textContent = data.simulation.scenario;
            simProfit.textContent = `${symbol}${data.simulation.new_profit.toLocaleString()}`;
            const changeSign = data.simulation.profit_change >= 0 ? '+' : '-';
            simChange.textContent = `${changeSign}${symbol}${Math.abs(data.simulation.profit_change).toLocaleString()}`;
            simChange.className = data.simulation.profit_change >= 0 ? 'value impact-positive' : 'value impact-negative';
        }
    }

    function setCompBar(barId, valId, value, maxVal, color) {
        const bar = document.getElementById(barId);
        const val = document.getElementById(valId);
        if (val) val.textContent = `${value}%`;
        if (bar) {
            bar.style.background = color;
            setTimeout(() => { bar.style.width = `${Math.min((value / maxVal) * 100, 100)}%`; }, 100);
        }
    }

    function buildBar(label, value, pct, symbol, color) {
        const row = document.createElement('div');
        row.className = 'breakdown-row';
        row.innerHTML = `
            <div class="breakdown-label">
                <span>${label}</span>
                <span class="breakdown-value">${symbol}${Number(value).toLocaleString()} <span class="breakdown-pct">(${pct}%)</span></span>
            </div>
            <div class="breakdown-bar-bg">
                <div class="breakdown-bar-fill" style="width:0%;background:${color}" data-pct="${pct}"></div>
            </div>`;
        setTimeout(() => { row.querySelector('.breakdown-bar-fill').style.width = `${pct}%`; }, 100);
        return row;
    }
});
