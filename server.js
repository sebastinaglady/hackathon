const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const anthropic = new Anthropic();
const app = express();

// ── Session & Passport ───────────────────────────────────────────
app.use(session({
    secret: process.env.SESSION_SECRET || 'biz-doctor-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/auth/google/callback`,
    }, (_, __, profile, done) => done(null, {
        id: profile.id,
        name: profile.displayName,
        email: profile.emails?.[0]?.value,
        avatar: profile.photos?.[0]?.value,
        provider: 'google',
    })));
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/auth/github/callback`,
    }, (_, __, profile, done) => done(null, {
        id: profile.id,
        name: profile.displayName || profile.username,
        email: profile.emails?.[0]?.value,
        avatar: profile.photos?.[0]?.value,
        provider: 'github',
    })));
}

// ── Auth Routes ──────────────────────────────────────────────────
app.get('/auth/config', (req, res) => {
    res.json({
        google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    });
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=1' }),
    (req, res) => res.redirect('/'));

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
app.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/login?error=1' }),
    (req, res) => res.redirect('/'));

app.get('/auth/logout', (req, res) => req.logout(() => res.redirect('/login')));

app.get('/auth/user', (req, res) => {
    res.json({ user: req.isAuthenticated() ? req.user : null });
});

// ── Auth Middleware ──────────────────────────────────────────────
function requireAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    if (req.accepts('html')) return res.redirect('/login');
    res.status(401).json({ error: 'Unauthorized' });
}

// ── Industry Benchmarks ──────────────────────────────────────────
const INDUSTRY_BENCHMARKS = {
    'electronics': { profitMargin: 8,  expenseRatio: 71, label: 'Electronics Retail' },
    'retail':      { profitMargin: 5,  expenseRatio: 75, label: 'General Retail' },
    'grocery':     { profitMargin: 2,  expenseRatio: 82, label: 'Grocery / Food' },
    'food':        { profitMargin: 4,  expenseRatio: 78, label: 'Food & Beverage' },
    'restaurant':  { profitMargin: 6,  expenseRatio: 78, label: 'Restaurant' },
    'wholesale':   { profitMargin: 3,  expenseRatio: 80, label: 'Wholesale' },
    'software':    { profitMargin: 20, expenseRatio: 60, label: 'Software / SaaS' },
    'manufacturing':{ profitMargin: 10,expenseRatio: 72, label: 'Manufacturing' },
    'healthcare':  { profitMargin: 12, expenseRatio: 70, label: 'Healthcare' },
    'fashion':     { profitMargin: 6,  expenseRatio: 74, label: 'Fashion / Apparel' },
    'default':     { profitMargin: 7,  expenseRatio: 73, label: 'General Industry' },
};

function getBenchmark(industry) {
    if (!industry) return INDUSTRY_BENCHMARKS.default;
    const key = industry.toLowerCase();
    for (const [k, v] of Object.entries(INDUSTRY_BENCHMARKS)) {
        if (k !== 'default' && key.includes(k)) return v;
    }
    return { ...INDUSTRY_BENCHMARKS.default, label: industry };
}

// ── Business Logic ───────────────────────────────────────────────
const CURRENCY_MAP = {
    'USD': { symbol: '$' }, 'EUR': { symbol: '€' }, 'GBP': { symbol: '£' },
    'INR': { symbol: '₹' }, 'JPY': { symbol: '¥' },
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
    const expenseRatio = sales > 0 ? expenses / sales : 0;

    const problems = [];
    if (profit < 0) problems.push('Negative profit (Loss)');
    if (overstock) problems.push('Overstocking detected (Inventory > Sales)');
    if (sales > 0 && profitMargin < 0.1 && profit >= 0) problems.push('Low profit margin (< 10%)');

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
        expenseRatio: Math.round(expenseRatio * 1000) / 10,
        score: Math.round(score),
        problems,
        simulation: {
            scenario: 'Increase price by 10% (Assuming 5% volume drop)',
            new_profit: Math.round(simProfit * 100) / 100,
            profit_change: Math.round((simProfit - profit) * 100) / 100,
        },
    };
}

async function getAISuggestions(metrics, extra = {}) {
    const { sales, expenses, inventory, currency, profit, profitMargin, score, problems } = metrics;
    const { revenue_breakdown, expense_breakdown, trend, observations, industry } = extra;

    let context = `You are a concise business advisor. A business has these monthly metrics:
- Currency: ${currency}
- Sales: ${sales}, Expenses: ${expenses}, Inventory: ${inventory}
- Net Profit: ${profit} (${profitMargin}% margin)
- Health Score: ${score}/100
- Industry: ${industry || 'Unknown'}
- Detected Issues: ${problems.length > 0 ? problems.join(', ') : 'None'}`;

    if (trend) context += `\n- Trend: ${trend}`;
    if (revenue_breakdown?.length) context += `\n- Revenue by category: ${revenue_breakdown.map(r => `${r.label} ${r.pct}%`).join(', ')}`;
    if (expense_breakdown?.length) context += `\n- Expense breakdown: ${expense_breakdown.map(e => `${e.label} ${e.pct}%`).join(', ')}`;
    if (observations?.length) context += `\n- Key observations: ${observations.join('; ')}`;

    context += `\n\nProvide exactly 4 short, actionable recommendations specific to their numbers. Each 1-2 sentences. Be direct, concrete, reference actual figures. Consider ${currency} market context.`;

    const stream = anthropic.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 600,
        thinking: { type: 'adaptive' },
        messages: [{ role: 'user', content: context }],
    });

    const response = await stream.finalMessage();
    const text = response.content.find(b => b.type === 'text')?.text || '';
    const lines = text.split('\n').map(l => l.replace(/^[-•*\d.]\s*/, '').trim()).filter(Boolean);
    return lines.length >= 2 ? lines : [text];
}

async function analyzeFromPDF(pdfBase64) {
    const extractResponse = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        system: 'You are a financial data extraction assistant. Extract numbers accurately and respond only with valid JSON.',
        messages: [{
            role: 'user',
            content: [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
                {
                    type: 'text',
                    text: `Extract all business financial data. Return ONLY this JSON (no extra text):
{
  "sales": <latest monthly sales as number>,
  "expenses": <latest monthly expenses as number>,
  "inventory": <total inventory value as number>,
  "currency": "<USD|EUR|GBP|INR|JPY>",
  "industry": "<detected industry eg Electronics Retail, Grocery, Restaurant>",
  "trend": "<improving|declining|stable>",
  "revenue_breakdown": [{"label": "<category>", "value": <number>, "pct": <percent>}],
  "expense_breakdown": [{"label": "<category>", "value": <number>, "pct": <percent>}],
  "observations": ["<key insight from document>"]
}
Use 0 for missing values. Default currency to USD. Up to 5 breakdown items. Up to 4 observations.`,
                },
            ],
        }],
    });

    const extractText = extractResponse.content.find(b => b.type === 'text')?.text || '{}';
    const jsonMatch = extractText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not extract financial data from the PDF. Please ensure it contains sales, expenses, and inventory figures.');
    const extracted = JSON.parse(jsonMatch[0]);

    const metrics = computeMetrics(extracted);
    const suggestions = await getAISuggestions(metrics, extracted);
    const benchmark = getBenchmark(extracted.industry);

    return {
        score: metrics.score,
        profit: metrics.profit,
        profitMargin: metrics.profitMargin,
        expenseRatio: metrics.expenseRatio,
        problems: metrics.problems,
        suggestions,
        simulation: metrics.simulation,
        symbol: metrics.symbol,
        currency: metrics.currency,
        trend: extracted.trend,
        industry: extracted.industry,
        revenue_breakdown: extracted.revenue_breakdown || [],
        expense_breakdown: extracted.expense_breakdown || [],
        observations: extracted.observations || [],
        comparison: {
            industry: benchmark.label,
            yourMargin: metrics.profitMargin,
            industryMargin: benchmark.profitMargin,
            yourExpenseRatio: metrics.expenseRatio,
            industryExpenseRatio: benchmark.expenseRatio,
        },
    };
}

// ── Routes ───────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/');
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/analyze', express.json({ limit: '50mb' }), requireAuth, async (req, res) => {
    try {
        if (!req.body.pdf) return res.status(400).json({ error: 'No PDF provided' });
        const result = await analyzeFromPDF(req.body.pdf);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'Analysis failed' });
    }
});

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`AI Business Doctor running at http://localhost:${PORT}`);
    if (!process.env.GOOGLE_CLIENT_ID) console.warn('⚠  GOOGLE_CLIENT_ID not set — Google auth disabled');
    if (!process.env.GITHUB_CLIENT_ID) console.warn('⚠  GITHUB_CLIENT_ID not set — GitHub auth disabled');
});
