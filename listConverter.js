const fs = require("fs");

const list = fs.readFileSync("./list.txt", "utf-8");

const lines = [...new Set(list.split("\n").map((l) => l.trim()))];
fs.writeFileSync("./list.txt", lines.join("\n"));
console.log(lines.length);

let addedNames = {};

let resultMap = {};

for (const line of lines) {
  const [link, name, code] = line.split("\t");
  const id = link.match(/\d+/)[0];

  if (!resultMap[code]) {
    const discount = parseInt(code.match(/\d+/)[0]) / 100;
    resultMap[code] = { code, discount, products: new Set() };
  }
  if (addedNames[name]) {
    //console.log(`${name} is duped`);
    if (addedNames[name].length < id.length) {
      resultMap[code].products.delete(addedNames[name]);
    } else {
      continue;
    }
  } else {
    addedNames[name] = id;
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
