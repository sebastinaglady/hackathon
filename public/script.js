document.addEventListener('DOMContentLoaded', () => {
    // Nav elements
    const landingPage = document.getElementById('landing-page');
    const formPage = document.getElementById('form-page');
    const loadingPage = document.getElementById('loading-page');
    const resultsPage = document.getElementById('results-page');

    // Buttons
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    const analysisForm = document.getElementById('analysis-form');

    // Navigation Logic
    function showView(viewElement) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('section-active'));
        viewElement.classList.add('section-active');
    }

    startBtn.addEventListener('click', () => {
        showView(formPage);
    });

    restartBtn.addEventListener('click', () => {
        analysisForm.reset();
        showView(landingPage);
    });

    // Form Submission
    analysisForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const sales = document.getElementById('sales').value;
        const expenses = document.getElementById('expenses').value;
        const inventory = document.getElementById('inventory').value;
        const currency = document.getElementById('currency').value;

        const payload = {
            sales: parseFloat(sales),
            expenses: parseFloat(expenses),
            inventory: parseFloat(inventory),
            currency: currency
        };

        showView(loadingPage);

        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            renderResults(data);
            showView(resultsPage);
        } catch (error) {
            console.error('Error during analysis:', error);
            alert('An error occurred while analyzing the data. Please ensure the backend is running.');
            showView(formPage);
        }
    });

    // Render Results Logic
    function renderResults(data) {
        // 1. Health Score
        const scoreValue = document.getElementById('score-value');
        const scoreProgress = document.getElementById('score-progress');
        const scoreLabel = document.getElementById('score-label');

        scoreValue.textContent = data.score;

        // Calculate stroke-dashoffset (max 283)
        const offset = 283 - (283 * data.score) / 100;
        // Small timeout to allow transition to play
        setTimeout(() => {
            scoreProgress.style.strokeDashoffset = offset;
        }, 100);

        // Color Indicator Logic for Score
        let scoreClass = 'status-red';
        let bgClass = 'bg-red';
        let labelText = 'Critical';
        let colorHex = 'var(--status-red)';

        if (data.score >= 70) {
            scoreClass = 'status-green';
            bgClass = 'bg-green';
            labelText = 'Healthy';
            colorHex = 'var(--status-green)';
        } else if (data.score >= 40) {
            scoreClass = 'status-yellow';
            bgClass = 'bg-yellow';
            labelText = 'Warning';
            colorHex = 'var(--status-yellow)';
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

        // 5. Simulation
        const simScenarioText = document.getElementById('sim-scenario-text');
        const simProfit = document.getElementById('sim-new-profit');
        const simChange = document.getElementById('sim-change');

        if (data.simulation) {
            simScenarioText.textContent = data.simulation.scenario;
            simProfit.textContent = `${symbol}${data.simulation.new_profit.toLocaleString()}`;

            const changeSign = data.simulation.profit_change >= 0 ? '+' : '-';
            const absChange = Math.abs(data.simulation.profit_change);
            const changeStr = `${changeSign}${symbol}${absChange.toLocaleString()}`;
            simChange.textContent = changeStr;

            if (data.simulation.profit_change >= 0) {
                simChange.className = 'value impact-positive';
            } else {
                simChange.className = 'value impact-negative';
            }
        }
    }
});
