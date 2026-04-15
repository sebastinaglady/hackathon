from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze")
async def analyze(data: dict):
    # Extract inputs
    sales = float(data.get('sales', 0))
    expenses = float(data.get('expenses', 0))
    inventory = float(data.get('inventory', 0))
    currency = data.get('currency', 'USD')

    currency_map = {
        'USD': {'symbol': '$', 'insight': 'Monitor Federal Reserve interest rate hikes which may impact borrowing costs.'},
        'EUR': {'symbol': '€', 'insight': 'Watch European Central Bank inflation targets; consider Eurozone-wide supply chain risks.'},
        'GBP': {'symbol': '£', 'insight': 'Stay updated on UK-specific trade regulations and Sterling volatility.'},
        'INR': {'symbol': '₹', 'insight': 'Consider the impact of local GST regulations and seasonal demand shifts.'},
        'JPY': {'symbol': '¥', 'insight': 'Monitor Bank of Japan yield curve control policies and export-heavy market trends.'}
    }

    curr_info = currency_map.get(currency, {'symbol': '$', 'insight': 'Maintain global market awareness.'})
    symbol = curr_info['symbol']

    profit = sales - expenses

    problems = []
    if profit < 0:
        problems.append("Negative profit (Loss)")

    overstock = inventory > sales
    if overstock:
        problems.append(f"Overstocking detected (Inventory > Sales in {currency})")

    profit_margin = (profit / sales) if sales > 0 else 0
    if sales > 0 and profit_margin < 0.1 and profit >= 0:
        problems.append("Low profit margin (< 10%)")

    score = 50
    if profit > 0:
        score += 20
    if profit_margin >= 0.2:
        score += 20
    if overstock:
        score -= 30

    score = max(0, min(100, score))

    suggestions = []
    for prob in problems:
        if "Overstocking" in prob:
            suggestions.append("Reduce inventory by running a clearance sale or halting orders.")
        if "Negative profit" in prob:
            suggestions.append("Critically review and cut non-essential expenses or increase pricing.")
        if "Low profit margin" in prob:
            suggestions.append("Adjust pricing strategy upwards or find cheaper wholesale suppliers.")

    if not problems:
        suggestions.append("Keep up the good work! Maintain steady operations.")

    suggestions.append(f"Currency Focus ({currency}): {curr_info['insight']}")

    simulated_sales = sales * 1.10 * 0.95
    simulated_profit = simulated_sales - expenses
    simulated_change = simulated_profit - profit

    return {
        "score": int(score),
        "profit": round(profit, 2),
        "problems": problems,
        "suggestions": suggestions,
        "simulation": {
            "scenario": "Increase price by 10% (Assuming 5% volume drop)",
            "new_profit": round(simulated_profit, 2),
            "profit_change": round(simulated_change, 2)
        },
        "symbol": symbol,
        "currency": currency
    }