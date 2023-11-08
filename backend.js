const key = require("./apikey.json").key;
const db = require("./database.js");

const express = require("express");
const app = express();
const port = process.env.PORT || 9969;

app.get("/api/stockdata", (req, res) => {
  try {
    db.all(`SELECT * FROM stockSummary`, [], (err, rows) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.json({
        message: "success",
        data: rows,
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Something broke!" });
  }
});

app.get("/api/stockdata/:id", (req, res) => {
  try {
    const sql = "select * from stockSummary where id = ?";
    const params = req.params.id;
    db.get(sql, [params], (err, row) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.json({
        message: "success",
        row: row,
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Something is not working right!" });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

main();

/**
 * The main function which is called upon app launch.
 */
async function main() {
  const stockData = await fetchData("aapl");

  addToDatabase(stockData);
}

/**
 * Fetch data of the stock with a given stock symbol
 * @param {string} stockSymbol - Symbol of a stock, e.g. AAPL for Apple Inc.
 * @returns {Object} Object containing fetched stock data
 */
async function fetchData(stockSymbol) {
  const response = await fetch(
    `https://api.aletheiaapi.com/StockData?symbol=${stockSymbol}&summary=true`,
    {
      method: "GET",
      headers: {
        key: key,
      },
    }
  );

  const json = await response.json();

  return json;
}

/**
 * Use this function to find the exchange rate between USD and another given currency
 * @param {string} toCurrency - Currency code of the foreign currency that you want the currency value of, e.g. EUR is the currency code for the currency Euro
 * @returns {number} Exchange rate between USD and the foreign currency
 */
async function fetchExchangeRate(toCurrency) {
  // for the fetch request to work, we need to ensure that the currency code is all in lower case
  const toCurrencyLowerCase = toCurrency.toLowerCase();

  const response = await fetch(
    `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/usd/${toCurrencyLowerCase}.json`
  );

  const json = await response.json();
  const rate = await json[`${toCurrencyLowerCase}`];

  // create an object that can be returned
  const obj = { currencyCode: toCurrencyLowerCase, latestExchangeRate: rate };

  return obj;
}

/**
 * Adds a data object to the sqlite3 database
 * @param {Object} dataObject - Pre-existing fetched data object containing stock data
 * @param {string} dataObject.Summary.Name - Name of the company behind the stock
 * @param {string} dataObject.Summary.StockSymbol - The stock symbol
 * @param {number} dataObject.Summary.Price - Latest price in USD
 */
async function addToDatabase(dataObject) {
  const res = await fetchExchangeRate("EUR");

  // the fetch returns an object with information we want to save in variables and modify
  const exchangeRate = res?.latestExchangeRate;
  const currencyCode = res?.currencyCode;

  // use the currencyCode variable to construct a property name like "Price" combined with the currency code in all upper case
  // we need the dynamic property name for later when we construct the data object that is to be saved in our database
  const defaultPropName = "price";
  const currencyCodeUpperCase = currencyCode.toUpperCase();
  const propName = defaultPropName.concat(currencyCodeUpperCase);

  const obj = {};
  obj.date = new Date().toISOString();
  obj.name = dataObject.Summary.Name;
  obj.stockSymbol = dataObject.Summary.StockSymbol;
  obj.priceUSD = dataObject.Summary.Price;
  obj[`${propName}`] = Number((obj.priceUSD * exchangeRate).toFixed(2));

  db.run(
    `INSERT INTO stockSummary VALUES (NULL, ?, ?, ?, ?, ?)`,
    [obj.date, obj.name, obj.stockSymbol, obj.priceUSD, obj.priceEUR],
    (err) => {
      if (err) {
        console.log(err.message);
        return;
      }
      console.log({
        message: "success",
        row: obj,
      });
    }
  );
}
