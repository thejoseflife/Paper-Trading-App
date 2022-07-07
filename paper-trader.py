from flask import Flask, request, render_template, jsonify
from flask import Flask
from flaskext.mysql import MySQL
import yfinance as yf

# Instantiate Flask
app = Flask(__name__)
mysql = MySQL()
app.config['MYSQL_DATABASE_USER'] = ' (user) '
app.config['MYSQL_DATABASE_PASSWORD'] = ' (password) '
app.config['MYSQL_DATABASE_DB'] = ' (database) '
app.config['MYSQL_DATABASE_HOST'] = ' (host) '
mysql.init_app(app)

# Yahoo Finance API for quote
@app.route("/quote")
def display_quote():
        symbol = str(request.args.get('symbol', default = "GME")).upper()
        quote = yf.Ticker(symbol)
        return jsonify(quote.info)

# Yahoo Finance API for history
@app.route("/history")
def display_history():
        symbol = str(request.args.get('symbol', default = "GME")).upper()
        period = request.args.get('period', default = "1d")
        interval = request.args.get('interval', default = "1m")

        quote = yf.Ticker(symbol)       
        hist = quote.history(period = period, interval = interval)
        data = hist.to_json()
        
        return data

# Home page
@app.route("/")
def home():
    return render_template("homepage.html")

def get_current_stock_price(ticker):
        ticker = str(ticker).upper()
        if ticker == "CASH":
                return 1.0
        
        quote = yf.Ticker(ticker)       
        hist = quote.history(period = "1d", interval = "1m")
        data = hist['Close']
        if len(data) > 0:
                return float(data[len(data) - 1])
        else:
                return 0.0
                

# Insert value to database
def insert_value_to_db(ticker, quantity):
        ticker = str(ticker).upper()
        db = mysql.connect()
        cursor = db.cursor()
        sqlFormula = "INSERT INTO positions (ticker, quantity) VALUES (%s, %s)"
        insert = (ticker, quantity)
        cursor.execute(sqlFormula, insert)
        db.commit()
        cursor.close()

# Update value in database
def update_value_in_db(ticker, quantity):
        ticker = str(ticker).upper()
        db = mysql.connect()
        cursor = db.cursor()
        sql = "UPDATE positions SET quantity = " + str(quantity) + " WHERE ticker = '" + ticker + "'"
        cursor.execute(sql)
        db.commit()
        cursor.close()

# Remove value from database
def delete_value_from_db(ticker):
        ticker = str(ticker).upper()
        db = mysql.connect()
        cursor = db.cursor()
        sql = "DELETE FROM positions WHERE ticker = '" + ticker + "'"
        cursor.execute(sql)
        db.commit()
        cursor.close()

def fetch_all_data_from_db():
        db = mysql.connect()
        cursor = db.cursor()
        cursor.execute("SELECT * FROM positions")
        db.commit()
        result = cursor.fetchall()
        cursor.close()
        return result


# Returns amount of cash as int
def fetch_cash_from_db():
        db = mysql.connect()
        cursor = db.cursor()
        cursor.execute("SELECT * FROM positions WHERE ticker = 'CASH'")
        db.commit()
        result = cursor.fetchone()
        cursor.close()
        if result is None:
                return 0
        else:
                return float(result[1])

# Returns owned quantity of ticker as int
def fetch_quantity_from_db(ticker):
        ticker = str(ticker).upper()
        db = mysql.connect()
        cursor = db.cursor()
        cursor.execute("SELECT * FROM positions WHERE ticker = '" + ticker + "'")
        result = cursor.fetchone()
        cursor.close()
        if result is None:
                return 0
        else:
                return float(result[1])

@app.route("/portfolio")
def calculate_portfolio_value():
        data = fetch_all_data_from_db()

        total = 0
        for row in data:
                total += float(row[1]) * get_current_stock_price(row[0])
                
        return str(total)

@app.route("/reset")
def reset_portfolio():
        db = mysql.connect()
        cursor = db.cursor()
        sql_delete = "DELETE FROM positions WHERE ticker <> 'CASH'"
        cursor.execute(sql_delete)
        sql_update = "UPDATE positions SET quantity = 100000 WHERE ticker = 'CASH'"
        cursor.execute(sql_update)
        db.commit()
        cursor.close()
        
        return "1"

@app.route("/loadpositions")
def load_positions():

        result = fetch_all_data_from_db()

        data = []
        for row in result:
                ticker = row[0]
                price = get_current_stock_price(ticker)
                        
                data.append([ticker, row[1], price])
        
        return jsonify(data)

# Returns 0 if insufficient cash, 1 if success
@app.route("/buy")
def buy_stock():
        ticker = str(request.args.get('symbol', default = "GME")).upper()
        
        # Check if sufficient cash
        cash = fetch_cash_from_db()
        
        # Get current price of stock
        price = get_current_stock_price(ticker)
        
        new_cash = cash - price

        # Not enough cash
        if new_cash < 0:
                return "0"

        # Subtract price from cash in DB, add 1 share
        update_value_in_db("CASH", str(new_cash))
        
        current_quantity = fetch_quantity_from_db(ticker)

        if current_quantity == 0:
                insert_value_to_db(ticker, 1)
        else:
                new_quantity = current_quantity + 1
                update_value_in_db(ticker, str(new_quantity))

        
        # return 1 for success
        return "1"

# Returns 0 if insufficient shares, 1 if success
@app.route("/sell")
def sell_stock():
        ticker = str(request.args.get('symbol', default = "GME")).upper()
        
        # Check if sufficient shares
        current_quantity = fetch_quantity_from_db(ticker)
        
        # Not enough shares
        if current_quantity <= 0:
                return "0"
        
        cash = fetch_cash_from_db()
        new_cash = cash + get_current_stock_price(ticker)
            
        
        # Remove 1 share to database, update cash
        new_quantity = current_quantity - 1.0
        if new_quantity == 0:
                delete_value_from_db(ticker)
        else:
                update_value_in_db(ticker, str(new_quantity))

        update_value_in_db("CASH", str(new_cash))
        
        return "1"

def create_database():
        db = mysql.connect()
        cursor = db.cursor()
        cursor.execute("CREATE TABLE positions (ticker VARCHAR(255), quantity FLOAT(40, 2))")

# run the flask app.
if __name__ == "__main__":
        app.run(debug = True)
