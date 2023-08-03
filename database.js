const sqlite3 = require("sqlite3").verbose();
const DBSOURCE = "db.sqlite";

let db = new sqlite3.Database(DBSOURCE, (err) => {
  if (err) {
    // Cannot open database
    console.error(err.message);
    throw err;
  } else {
    console.log("Connected to the SQLite database.");
    db.run(
      `CREATE TABLE stockSummary (id INTEGER PRIMARY KEY AUTOINCREMENT,date text,name text,stockSymbol text,priceUSD integer,priceEUR integer)`,
      (err) => {
        if (err) {
          console.log("Table already created.");
        } else {
          console.log("Table just created.");
        }
      }
    );
  }
});

module.exports = db;
