const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

// Currency configuration
const CURRENCY_MAP = {
    'USD': { symbol: '$', insight: 'Monitor Federal Reserve interest rate hikes which may impact borrowing costs.' },
    'EUR': { symbol: '€', insight: 'Watch European Central Bank inflation targets; consider Eurozone-wide supply chain risks.' },
    'GBP': { symbol: '£', insight: 'Stay updated on UK-specific trade regulations and Sterling volatility.' },
    'INR': { symbol: '₹', insight: 'Consider the impact of local GST regulations and seasonal demand shifts.' },
    'JPY': { symbol: '¥', insight: 'Monitor Bank of Japan yield curve control policies and export-heavy market trends.' },
};

function analyzeData(data) {
    const sales = parseFloat(data.sales) || 0;
    const expenses = parseFloat(data.expenses) || 0;
    const inventory = parseFloat(data.inventory) || 0;
    const currency = data.currency || 'USD';

    const currInfo = CURRENCY_MAP[currency] || { symbol: '$', insight: 'Maintain global market awareness.' };
    const symbol = currInfo.symbol;

    // 1. Profit Calculation
    const profit = sales - expenses;

    // 2. Problem Detection Engine
    const problems = [];
    if (profit < 0) problems.push("Negative profit (Loss)");

    const overstock = inventory > sales;
    if (overstock) problems.push(`Overstocking detected (Inventory > Sales in ${currency})`);

    const profitMargin = sales > 0 ? profit / sales : 0;
    if (sales > 0 && profitMargin < 0.1 && profit >= 0) problems.push("Low profit margin (< 10%)");

    // 3. Health Score System (Base 50)
    let score = 50;
    if (profit > 0) score += 20;
    if (profitMargin >= 0.2) score += 20;
    if (overstock) score -= 30;
    score = Math.max(0, Math.min(100, score));

    // 4. Recommendation Engine
    const suggestions = [];
    for (const prob of problems) {
        if (prob.includes("Overstocking")) suggestions.push("Reduce inventory by running a clearance sale or halting orders.");
        if (prob.includes("Negative profit")) suggestions.push("Critically review and cut non-essential expenses or increase pricing.");
        if (prob.includes("Low profit margin")) suggestions.push("Adjust pricing strategy upwards or find cheaper wholesale suppliers.");
    }
    if (problems.length === 0) suggestions.push("Keep up the good work! Maintain steady operations.");

    // Add currency-specific insight
    suggestions.push(`Currency Focus (${currency}): ${currInfo.insight}`);

    // 5. Simulation Engine (10% price increase, 5% volume drop)
    const simPriceIncreaseRate = 0.10;
    const simDemandDropRate = 0.05;
    const simulatedSales = sales * (1 + simPriceIncreaseRate) * (1 - simDemandDropRate);
    const simulatedProfit = simulatedSales - expenses;
    const simulatedChange = simulatedProfit - profit;

    return {
        score: Math.round(score),
        profit: Math.round(profit * 100) / 100,
        problems,
        suggestions,
        simulation: {
            scenario: "Increase price by 10% (Assuming 5% volume drop)",
            new_profit: Math.round(simulatedProfit * 100) / 100,
            profit_change: Math.round(simulatedChange * 100) / 100,
        },
        symbol,
        currency,
    };
}

const server = http.createServer((req, res) => {
    // Handle POST /analyze
    if (req.method === 'POST' && req.url === '/analyze') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const result = analyzeData(data);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid request body' }));
            }
        });
        return;
    }

    // Serve static files from /public
    if (req.method === 'GET') {
        let urlPath = req.url === '/' ? '/index.html' : req.url;
        const filePath = path.join(PUBLIC_DIR, urlPath);

        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
                return;
            }
            const ext = path.extname(filePath);
            const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(content);
        });
        return;
    }

    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
});

server.listen(PORT, () => {
    console.log(`Starting API + Static server on port ${PORT}...`);
    console.log(`Open http://localhost:${PORT} in your browser.`);
});
