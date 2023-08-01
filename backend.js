const key = require("./apikey.json").key;
const db = require("./database.js");

main();
db.all(`SELECT * FROM stockSummary`, [], (err, rows) => {
  if (err) {
    console.log(err.message);
    return;
  }
  console.log({
    message: "success",
    data: rows,
  });
});

async function main() {
  const stockData = await fetchData();

  addToDatabase(stockData);
}

async function fetchData() {
  const response = await fetch(
    "https://api.aletheiaapi.com/StockData?symbol=msft&summary=true",
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
  obj.priceUSD = dataObject.Summary.Price;
  obj.priceEUR = Number((obj.priceUSD * exchangeRate).toFixed(2));

  db.run(
    `INSERT INTO stockSummary VALUES (NULL, ?, ?, ?, ?)`,
    [obj.date, obj.name, obj.priceUSD, obj.priceEUR],
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
