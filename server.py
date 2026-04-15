import json
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler

class BusinessDoctorAPIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="public", **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self):
        if self.path == '/analyze':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            # Extract inputs
            sales = float(data.get('sales', 0))
            expenses = float(data.get('expenses', 0))
            inventory = float(data.get('inventory', 0))
            currency = data.get('currency', 'USD')

            # Currency configuration
            currency_map = {
                'USD': {'symbol': '$', 'insight': 'Monitor Federal Reserve interest rate hikes which may impact borrowing costs.'},
                'EUR': {'symbol': '€', 'insight': 'Watch European Central Bank inflation targets; consider Eurozone-wide supply chain risks.'},
                'GBP': {'symbol': '£', 'insight': 'Stay updated on UK-specific trade regulations and Sterling volatility.'},
                'INR': {'symbol': '₹', 'insight': 'Consider the impact of local GST regulations and seasonal demand shifts.'},
                'JPY': {'symbol': '¥', 'insight': 'Monitor Bank of Japan yield curve control policies and export-heavy market trends.'}
            }

            curr_info = currency_map.get(currency, {'symbol': '$', 'insight': 'Maintain global market awareness.'})
            symbol = curr_info['symbol']

            # 1. Profit Calculation
            profit = sales - expenses

            # 2. Problem Detection Engine
            problems = []
            if profit < 0:
                problems.append("Negative profit (Loss)")
            
            overstock = inventory > sales
            if overstock:
                problems.append(f"Overstocking detected (Inventory > Sales in {currency})")
            
            profit_margin = (profit / sales) if sales > 0 else 0
            if sales > 0 and profit_margin < 0.1 and profit >= 0:
                problems.append("Low profit margin (< 10%)")

            # 3. Health Score System (Base 50)
            score = 50
            if profit > 0:
                score += 20
            if profit_margin >= 0.2:
                score += 20
            if overstock:
                score -= 30
            
            score = max(0, min(100, score))

            # 4. Recommendation Engine
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

            # 5. Simulation Engine
            sim_price_increase_rate = 0.10
            sim_demand_drop_rate = 0.05
            
            simulated_sales = sales * (1 + sim_price_increase_rate) * (1 - sim_demand_drop_rate)
            simulated_profit = simulated_sales - expenses
            simulated_change = simulated_profit - profit

            simulation = {
                "scenario": "Increase price by 10% (Assuming 5% volume drop)",
                "new_profit": round(simulated_profit, 2),
                "profit_change": round(simulated_change, 2)
            }

            response_data = {
                "score": int(score),
                "profit": round(profit, 2),
                "problems": problems,
                "suggestions": suggestions,
                "simulation": simulation,
                "symbol": symbol,
                "currency": currency
            }

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def run(server_class=HTTPServer, handler_class=BusinessDoctorAPIHandler, port=3000):
    os.makedirs("public", exist_ok=True)
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f"Starting API + Static server on port {port}...")
    httpd.serve_forever()

if __name__ == '__main__':
    run()