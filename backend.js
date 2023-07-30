const key = require("./apikey.json").key;

main();

async function main() {
  const exchangeRate = await fetchExchangeRate("usd", "eur");
  const stockData = await fetchData();

  const stockPrice = stockData.Summary.Price;

  console.log("price, USD: ", stockPrice);
  console.log("Exchange rate: ", exchangeRate);
  console.log("Price, EUR: ", stockPrice * exchangeRate);
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
