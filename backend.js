const key = require("./apikey.json").key;
const db = require("./database.js");

const express = require("express");
const app = express();
const port = process.env.PORT || 9999;

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

async function main() {
  const stockData = await fetchData("msft");

  addToDatabase(stockData);
}

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

async function fetchExchangeRate(fromCurrency, toCurrency) {
  const response = await fetch(
    `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/${fromCurrency}/${toCurrency}.json`
  );

  const json = await response.json();
  const rate = await json.eur;

  return rate;
}

async function addToDatabase(dataObject) {
  const exchangeRate = await fetchExchangeRate("usd", "eur");

  const obj = {};
  obj.date = new Date().toISOString();
  obj.name = dataObject.Summary.Name;
  obj.stockSymbol = dataObject.Summary.StockSymbol;
  obj.priceUSD = dataObject.Summary.Price;
  obj.priceEUR = Number((obj.priceUSD * exchangeRate).toFixed(2));

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
