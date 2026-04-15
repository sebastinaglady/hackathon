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

    // File selection via button
    browseBtn.addEventListener('click', () => pdfInput.click());

    pdfInput.addEventListener('change', () => {
        if (pdfInput.files[0]) setFile(pdfInput.files[0]);
    });

    // Drag & drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('upload-zone--hover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('upload-zone--hover');
    });

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

    // Analyze
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
            reader.onload = () => {
                // Strip the data URL prefix ("data:application/pdf;base64,")
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Render Results Logic
    function renderResults(data) {
        // 1. Health Score
        const scoreValue = document.getElementById('score-value');
        const scoreProgress = document.getElementById('score-progress');
        const scoreLabel = document.getElementById('score-label');

        scoreValue.textContent = data.score;

        const offset = 283 - (283 * data.score) / 100;
        setTimeout(() => { scoreProgress.style.strokeDashoffset = offset; }, 100);

        let bgClass = 'bg-red';
        let labelText = 'Critical';
        let colorHex = 'var(--status-red)';

        if (data.score >= 70) {
            bgClass = 'bg-green'; labelText = 'Healthy'; colorHex = 'var(--status-green)';
        } else if (data.score >= 40) {
            bgClass = 'bg-yellow'; labelText = 'Warning'; colorHex = 'var(--status-yellow)';
        }

        scoreLabel.textContent = labelText;
        scoreLabel.className = `score-label ${bgClass}`;
        scoreProgress.style.stroke = colorHex;

        // 2. Profit
        const profitValue = document.getElementById('profit-value');
        const profitLabel = document.getElementById('profit-label');
        const symbol = data.symbol || '$';

        profitValue.textContent = `${symbol}${data.profit.toLocaleString()}`;
        if (data.profit > 0) {
            profitLabel.textContent = "Profitable";
            profitLabel.className = "badge bg-green";
        } else {
            profitLabel.textContent = "Loss Making";
            profitLabel.className = "badge bg-red";
        }

        // Profit margin & trend
        const marginEl = document.getElementById('profit-margin');
        if (marginEl) marginEl.textContent = data.profitMargin != null ? `${data.profitMargin}%` : '—';

        const trendEl = document.getElementById('trend-value');
        if (trendEl && data.trend) {
            const trendMap = { improving: { text: '▲ Improving', cls: 'status-green' }, declining: { text: '▼ Declining', cls: 'status-red' }, stable: { text: '→ Stable', cls: 'status-yellow' } };
            const t = trendMap[data.trend] || { text: data.trend, cls: '' };
            trendEl.textContent = t.text;
            trendEl.className = `kpi-meta-value ${t.cls}`;
        }

        // 3. Problems List
        const problemsList = document.getElementById('problems-list');
        problemsList.innerHTML = '';
        if (data.problems.length === 0) {
            const li = document.createElement('li');
            li.textContent = "No critical problems detected.";
            li.style.borderLeftColor = 'var(--status-green)';
            problemsList.appendChild(li);
        } else {
            data.problems.forEach(prob => {
                const li = document.createElement('li');
                li.textContent = prob;
                problemsList.appendChild(li);
            });
        }

        // 4. Suggestions List
        const suggestionsList = document.getElementById('suggestions-list');
        suggestionsList.innerHTML = '';
        data.suggestions.forEach(sugg => {
            const li = document.createElement('li');
            li.textContent = sugg;
            suggestionsList.appendChild(li);
        });

        // 5. Revenue Breakdown
        const revCard = document.getElementById('revenue-breakdown-card');
        const revEl = document.getElementById('revenue-breakdown');
        if (data.revenue_breakdown && data.revenue_breakdown.length > 0) {
            revEl.innerHTML = '';
            revCard.style.display = '';
            data.revenue_breakdown.forEach(item => {
                revEl.appendChild(buildBar(item.label, item.value, item.pct, symbol, 'var(--primary)'));
            });
        } else {
            revCard.style.display = 'none';
        }

        // 6. Expense Breakdown
        const expCard = document.getElementById('expense-breakdown-card');
        const expEl = document.getElementById('expense-breakdown');
        if (data.expense_breakdown && data.expense_breakdown.length > 0) {
            expEl.innerHTML = '';
            expCard.style.display = '';
            data.expense_breakdown.forEach(item => {
                expEl.appendChild(buildBar(item.label, item.value, item.pct, symbol, 'var(--status-red)'));
            });
        } else {
            expCard.style.display = 'none';
        }

        // 7. Key Observations
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

        // 8. Simulation
        const simScenarioText = document.getElementById('sim-scenario-text');
        const simProfit = document.getElementById('sim-new-profit');
        const simChange = document.getElementById('sim-change');

        if (data.simulation) {
            simScenarioText.textContent = data.simulation.scenario;
            simProfit.textContent = `${symbol}${data.simulation.new_profit.toLocaleString()}`;
            const changeSign = data.simulation.profit_change >= 0 ? '+' : '-';
            const absChange = Math.abs(data.simulation.profit_change);
            simChange.textContent = `${changeSign}${symbol}${absChange.toLocaleString()}`;
            simChange.className = data.simulation.profit_change >= 0 ? 'value impact-positive' : 'value impact-negative';
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
                <div class="breakdown-bar-fill" style="width:0%; background:${color}" data-pct="${pct}"></div>
            </div>`;
        setTimeout(() => {
            row.querySelector('.breakdown-bar-fill').style.width = `${pct}%`;
        }, 100);
        return row;
    }
});
