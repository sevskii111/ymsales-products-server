const fs = require("fs");

const list = fs.readFileSync("./list.txt", "utf-8");

const lines = list.split("\n").map((l) => l.trim());

let resultMap = {};

for (const line of lines) {
  const [link, _, code] = line.split("\t");
  const id = link.match(/\d+/)[0];

  if (!resultMap[code]) {
    const discount = parseInt(code.match(/\d+/)[0]) / 100;
    resultMap[code] = { code, discount, products: new Set() };
  }
  resultMap[code].products.add(id);
}

let result = [];

for (const code in resultMap) {
  result.push({
    code,
    discount: resultMap[code].discount,
    products: [...resultMap[code].products],
  });
}

fs.writeFileSync("listCodes.js", JSON.stringify(result));
