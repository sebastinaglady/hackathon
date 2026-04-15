const http = require('http');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const anthropic = new Anthropic();

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

const CURRENCY_MAP = {
    'USD': { symbol: '$' },
    'EUR': { symbol: '€' },
    'GBP': { symbol: '£' },
    'INR': { symbol: '₹' },
    'JPY': { symbol: '¥' },
};

function computeMetrics(data) {
    const sales = parseFloat(data.sales) || 0;
    const expenses = parseFloat(data.expenses) || 0;
    const inventory = parseFloat(data.inventory) || 0;
    const currency = data.currency || 'USD';

    const symbol = (CURRENCY_MAP[currency] || { symbol: '$' }).symbol;
    const profit = sales - expenses;
    const overstock = inventory > sales;
    const profitMargin = sales > 0 ? profit / sales : 0;

    const problems = [];
    if (profit < 0) problems.push("Negative profit (Loss)");
    if (overstock) problems.push(`Overstocking detected (Inventory > Sales)`);
    if (sales > 0 && profitMargin < 0.1 && profit >= 0) problems.push("Low profit margin (< 10%)");

    let score = 50;
    if (profit > 0) score += 20;
    if (profitMargin >= 0.2) score += 20;
    if (overstock) score -= 30;
    score = Math.max(0, Math.min(100, score));

    const simSales = sales * 1.10 * 0.95;
    const simProfit = simSales - expenses;

    return {
        sales, expenses, inventory, currency, symbol,
        profit: Math.round(profit * 100) / 100,
        profitMargin: Math.round(profitMargin * 1000) / 10,
        score: Math.round(score),
        problems,
        overstock,
        simulation: {
            scenario: "Increase price by 10% (Assuming 5% volume drop)",
            new_profit: Math.round(simProfit * 100) / 100,
            profit_change: Math.round((simProfit - profit) * 100) / 100,
        },
    };
}

async function getAISuggestions(metrics) {
    const { sales, expenses, inventory, currency, profit, profitMargin, score, problems } = metrics;

    const prompt = `You are a concise business advisor. A business has submitted these monthly metrics:
- Currency: ${currency}
- Sales: ${sales}
- Expenses: ${expenses}
- Inventory Value: ${inventory}
- Net Profit: ${profit} (${profitMargin}% margin)
- Health Score: ${score}/100
- Detected Issues: ${problems.length > 0 ? problems.join(', ') : 'None'}

Provide exactly 3-4 short, actionable recommendations specific to their numbers. Each should be 1-2 sentences max. Be direct and concrete, not generic. Consider their currency region (${currency}) for market-specific advice.`;

    const stream = anthropic.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 512,
        thinking: { type: 'adaptive' },
        messages: [{ role: 'user', content: prompt }],
    });

    const response = await stream.finalMessage();
    const text = response.content.find(b => b.type === 'text')?.text || '';

    // Split into bullet points if Claude used them, otherwise split by sentence
    const lines = text.split('\n').map(l => l.replace(/^[-•*\d.]\s*/, '').trim()).filter(Boolean);
    return lines.length >= 2 ? lines : [text];
}

async function analyzeData(data) {
    const metrics = computeMetrics(data);
    const suggestions = await getAISuggestions(metrics);

    return {
        score: metrics.score,
        profit: metrics.profit,
        problems: metrics.problems,
        suggestions,
        simulation: metrics.simulation,
        symbol: metrics.symbol,
        currency: metrics.currency,
    };
}

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/analyze') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const result = await analyzeData(data);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (err) {
                console.error(err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message || 'Analysis failed' }));
            }
        });
        return;
    }

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
    console.log(`Starting AI Business Doctor on port ${PORT}...`);
    console.log(`Open http://localhost:${PORT} in your browser.`);
});
