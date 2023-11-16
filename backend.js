require("dotenv").config();
// @ts-ignore
const key = require("./apikey.json").key;
const db = require("./database.js");
const express = require("express");
const app = express();
let port;

// Check whether we are working in development or production mode
if (process.env.STATUS === "development") {
  port = process.env.DEV_PORT;
} else {
  port = process.env.PROD_PORT;
}

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
  console.log(
    `Server in ${process.env.STATUS} mode, listening on port ${port}`
  );
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
 * @async
 * @param {string} stockSymbol - Symbol of a stock, e.g. AAPL for Apple Inc.
 * @returns {Promise<object>} Promise object containing fetched stock data
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
 * @async
 * @param {string} toCurrency - Currency code of the foreign currency that you want the currency value of, e.g. EUR is the currency code for the currency Euro
 * @returns {Promise<object>} Promise object containing the currency code of the currency that the user wants to convert the stock price into and the exchange rate between USD and the foreign currency
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
 * @typedef {object} dataObject
 * @property {object} dataObject.Summary - A Summary object
 * @property {string} dataObject.Summary.Name - Name of the company behind the stock
 * @property {string} dataObject.Summary.StockSymbol - The stock symbol
 * @property {number} dataObject.Summary.Price - Latest price in USD
 */

/**
 * Adds a data object to the sqlite3 database
 * @async
 * @param {dataObject} dataObject - Pre-existing fetched data object containing stock data
 */
async function addToDatabase(dataObject) {
  /**
   * @type {object}
   */
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

/**
 * @typedef {object} currencyObject
 * @property {string} currencyCode - a currency code in string format, e.g. "usd", "eur", "sek", etc.
 * @property {number} latestExchangeRate - latest exchange rate
 * @property {string} propName - generated property name of shape "price" + currency code in all upper case
 */

/**
 * Generates an array consisting of information on given currency codes
 * @async
 * @param {string[]} arrayOfStringCurrencies Array of currency codes in string format, e.g. "eur", "sek", "inr", etc.
 * @promise {Promise<currencyObject>} currencyObject - An object containing information about a certain currency
 * @rejects {Error}
 */
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
  const currencyObject = [];

  for (let i = 0; i < arrayOfStringCurrencies.length; i++) {
    const currencyCode = arrayOfStringCurrencies[i];

    const exchangeRateObj = await fetchExchangeRate(currencyCode);
    exchangeRateObj.propName = await generatePropertyName(currencyCode);

    // Save result object to the result array variable
    await currencyObject.push(exchangeRateObj);
  }

  if (!Array.isArray(currencyObject)) {
    console.log("resArray is not an array...");
    return;
  }
  if (currencyObject.length === 0) {
    console.log("resArray is still empty...");
    return;
  }
  if (!currencyObject) {
    console.log("resArray does not exist...");
    return;
  }

  console.log("resArray:", currencyObject);
  if (currencyObject.length > 0) return currencyObject;
}

/**
 * Generate property name consisting string "price" + a currency code in all capital letters given a currency code in string format
 * @param {string} currencyCode Currency code in string format
 * @returns {string} Returns property name, e.g. "priceEUR", "priceSEK", etc.
 */
function generatePropertyName(currencyCode) {
  let propName = "";

  const defaultPropName = "price";
  const currencyCodeUpperCase = currencyCode.toUpperCase();
  propName = defaultPropName.concat(currencyCodeUpperCase);

  // Return generated propName
  return propName;
}

/**
 * Check if all elements of an array are of type string
 * @param {array} array Any array
 * @returns {boolean|void} Returns true if all elements of given array are of type string
 */
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
