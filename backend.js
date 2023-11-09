const key = require("./apikey.json").key;
const db = require("./database.js");

const express = require("express");
const app = express();
const port = process.env.PORT || 9989;

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
        "Content-Type": "application/json;charset=UTF-8",
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
    `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/usd/${toCurrencyLowerCase}.json`,
    {
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
      },
    }
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
  const [eur, dkk] = await generateForeignCurrencyArray(["eur", "dkk"]);

  // now it is time to create the data object which we want to save to the database
  const obj = {};
  obj.date = new Date().toISOString();
  obj.name = dataObject.Summary.Name;
  obj.stockSymbol = dataObject.Summary.StockSymbol;
  obj.priceUSD = dataObject.Summary.Price;
  obj[`${eur.propName}`] = Number(
    (obj.priceUSD * eur.latestExchangeRate).toFixed(2)
  );
  obj[`${dkk.propName}`] = Number(
    (obj.priceUSD * dkk.latestExchangeRate).toFixed(2)
  );
  db.run(
    `INSERT INTO stockSummary VALUES (NULL, ?, ?, ?, ?, ?, ?)`,
    [
      obj.date,
      obj.name,
      obj.stockSymbol,
      obj.priceUSD,
      obj.priceEUR,
      obj.priceDKK,
    ],
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

async function generateForeignCurrencyArray(arrayOfStringCurrencies) {
  // first we need to check if the parameter used for the function call even was given, if it in an array and if all elements are strings
  if (
    !arrayOfStringCurrencies ||
    !Array.isArray(arrayOfStringCurrencies) ||
    !allElementsAreStrings(arrayOfStringCurrencies)
  ) {
    return alert("Parameter has to be an array of strings");
  }

  // at this point we know the parameter used for the function call lives up to our minimum criteria, so we can continue...
  // first we need to loop over the array of currencyCodes and fetch some data
  const resArray = [];

  for (let i = 0; i < arrayOfStringCurrencies.length; i++) {
    const currencyCode = arrayOfStringCurrencies[i];

    const exchangeRateObj = await fetchExchangeRate(currencyCode);
    exchangeRateObj.propName = await generatePropertyName(currencyCode);

    // Save result object to the result array variable
    await resArray.push(exchangeRateObj);
  }

  if (!Array.isArray(resArray)) {
    console.log("resArray is not an array...");
    return;
  }
  if (resArray.length === 0) {
    console.log("resArray is still empty...");
    return;
  }
  if (!resArray) {
    console.log("resArray does not exist...");
    return;
  }

  if (resArray.length > 0) return resArray;
}

function generatePropertyName(currencyCode) {
  let propName = "";

  const defaultPropName = "price";
  const currencyCodeUpperCase = currencyCode.toUpperCase();
  propName = defaultPropName.concat(currencyCodeUpperCase);

  // Return generated propName
  return propName;
}

function allElementsAreStrings(array) {
  if (!array || !Array.isArray(array)) {
    return alert("Parameter is not an array");
  }
  let countStringElements = 0;

  array.forEach((element) => {
    if (typeof element === "string") countStringElements++;
  });

  return countStringElements === array.length;
}
