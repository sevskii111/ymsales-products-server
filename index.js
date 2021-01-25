require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const MongoClient = require("mongodb").MongoClient;
const codes = require("./codes.js");

const config = {
  cachedProductTimeout: process.env.cachedProductTimeout || 60000,
  port: process.env.PORT || 1338,
  mongodbURI: process.env.mongodbURI || "mongodb://localhost:27017/", //"mongodb://localhost:27017/",
};

const mongoClient = new MongoClient(config.mongodbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoClient.connect(async function (err, client) {
  if (err) {
    console.error(err);
    return;
  }
  const db = client.db("ymsales");
  const productsCollection = db.collection("products");
  const categoriesCollection = db.collection("categories");

  const productsInCodes = [
    ...codes.reduce(
      (prev, curr) => new Set([...prev, ...curr.products]),
      new Set()
    ),
  ];

  const app = express();
  app.use(bodyParser.json());

  async function init() {
    const productsInDB = await productsCollection
      .find({ id: { $in: productsInCodes } })
      .toArray();
    const productsInDBIds = new Set(productsInDB.map((product) => product.id));
    const productsToInsert = [];
    for (const code of codes) {
      for (const prodcutID of code.products) {
        if (!productsInDBIds.has(prodcutID)) {
          productsToInsert.push({ id: prodcutID });
          productsInDBIds.add(prodcutID);
        }
      }
    }
    if (productsToInsert.length > 0) {
      await productsCollection.insertMany(productsToInsert);
    }
  }

  await init();

  let returnedProductsCache = [];
  async function getNextProduct() {
    returnedProductsCache = returnedProductsCache.filter(
      (cachedProduct) =>
        Date.now() - cachedProduct.timestamp < config.cachedProductTimeout
    );

    const emptyProduct = await productsCollection.findOne({
      id: {
        $nin: returnedProductsCache.map((product) => product.id),
        $in: productsInCodes,
      },
      lastUpdate: { $exists: false },
    });
    if (emptyProduct) {
      returnedProductsCache.push({
        id: emptyProduct.id,
        timestamp: Date.now(),
      });
      return emptyProduct.id;
    } else {
      const oldestProduct = await productsCollection
        .find({
          id: {
            $nin: returnedProductsCache.map((product) => product.id),
            $in: productsInCodes,
          },
        })
        .sort({ lastUpdate: 1 })
        .limit(1);
      returnedProductsCache.push({
        id: oldestProduct.id,
        timestamp: Date.now(),
      });
      return oldestProduct.id;
    }
  }

  app.get("/product", async (req, res) => {
    res.send(await getNextProduct());
  });

  app.post("/product", async (req, res) => {
    const { id, name, category, img, price } = req.body;
    res.send(await getNextProduct());
    await productsCollection.updateOne(
      { id },
      {
        $set: {
          id,
          name,
          category,
          img,
          price,
          lastUpdate: Date.now(),
        },
      }
    );
  });

  app.get("/products", async (req, res) => {
    const products = await productsCollection
      .find({ id: { $in: productsInCodes } })
      .toArray();
    let result = {};
    for (const code of codes) {
      const codeProducts = new Set(code.products);
      for (const product of products.filter(
        (product) => product.price && product.price >= 0
      )) {
        if (codeProducts.has(product.id) && !result[product.id]) {
          result[product.id] = {
            id: product.id,
            name: product.name,
            img: product.img,
            category: product.category,
            old_price: product.price,
            price: Math.floor(product.price * (1 - code.discount)),
            code: code.code,
          };
        }
      }
    }
    let resultArr = [];
    for (product in result) {
      resultArr.push(result[product]);
    }
    res.json(resultArr);
  });

  app.post("/category", async (req, res) => {
    const { category, categoryLink } = req.body;
    await categoriesCollection.updateOne(
      { subCategory: category },
      { $set: { subCategory: category, categoryLink } },
      { upsert: true }
    );
    res.status(200).send("");
  });

  app.get("/categories", async (req, res) => {
    const categories = await categoriesCollection.find({}).toArray();
    let categoriesMap = {};
    for (const category of categories) {
      categoriesMap[category.subCategory] = category.categoryLink;
    }
    res.json(categoriesMap);
  });

  app.get("/codes", (req, res) => {
    res.json(codes.sort((a, b) => b.discount - a.discount));
  });

  app.listen(config.port, (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log("Listening on 1338");
    }
  });
});
