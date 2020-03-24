import { NowRequest, NowResponse } from "@now/node";
import * as puppeteer from "puppeteer-core";
import * as firebase from "firebase-admin";

type Sample = {
  confirmed: number | null;
  suspects: number | null;
  recovered: number | null;
  deaths: number | null;
};

const API_KEY = process.env.SCRAPER_API_KEY;
const url = process.env.PAGE_URL || "https://covid19.gov.ao/";
let db: firebase.firestore.Firestore;

console.assert(API_KEY && API_KEY.length > 8, "Invalid API_KEY");

initializeFirebase();

// MAIN

export = async function(req: NowRequest, res: NowResponse) {
  const apiKey = req.headers.authorization?.substr("Bearer ".length);

  if (apiKey !== API_KEY) {
    res.status(401);
    res.json({
      error: "invalid or no api key"
    });
    return;
  }

  run();
  res.json(200);
  res.json({});
};

async function run() {
  const current = await getCurrent();
  const next = await sample();

  if (current && !changed(current as any, next)) {
    return;
  }

  const timestamp = new Date();
  await save(timestamp, next);
}

// SCRAPER

async function sample() {
  return runBrowser(async browser => {
    const page = await browser.newPage();
    await page.goto(url);

    const result = await page.evaluate<() => Sample>(() => {
      const statElement = (index: number) =>
        document.querySelector(
          `body > section > section.lastsection.container.box.effect7 > div > div > div > div > div:nth-child(${index}) > span.big-number.text-black`
        );

      const confirmed = parseInt(statElement(2)?.textContent);
      const suspects = parseInt(statElement(3)?.textContent);
      const recovered = parseInt(statElement(4)?.textContent);
      const deaths = parseInt(statElement(5)?.textContent);

      return {
        confirmed,
        suspects,
        recovered,
        deaths
      };
    });

    return result;
  });
}

// STORE

function initializeFirebase() {
  const serviceAccountJSON = Buffer.from(
    process.env.FIREBASE_KEY,
    "base64"
  ).toString();
  const serviceAccount = JSON.parse(serviceAccountJSON);

  firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount)
  });

  db = firebase.firestore();
}

async function save(timestamp: Date, data: Sample) {
  await db.collection("samples").add({
    timestamp,
    ...data,
    country: "angola"
  });
}

async function getCurrent() {
  const query = await db
    .collection("samples")
    .orderBy("timestamp", "desc")
    .limit(1);
  return (await query.get()).docs[0].data();
}

// HELPERS

function changed(sample1: Sample, sample2: Sample) {
  return !(
    sample1.confirmed === sample2.confirmed &&
    sample1.suspects === sample2.suspects &&
    sample1.recovered === sample2.recovered &&
    sample1.deaths === sample2.deaths
  );
}

async function runBrowser<T>(
  handler: (b: puppeteer.Browser) => Promise<T | null>
) {
  let options: puppeteer.LaunchOptions;

  if (process.env.NOW_REGION) {
    const chrome = require("chrome-aws-lambda");
    options = {
      args: chrome.args,
      executablePath: await chrome.executablePath,
      headless: chrome.headless
    };
  } else {
    const chrome = require("puppeteer");
    options = {
      args: chrome.defaultArgs(),
      executablePath: chrome.executablePath(),
      headless: false
    };
  }

  const browser = await puppeteer.launch(options);
  let result: T;

  try {
    result = await handler(browser);
  } catch (e) {
    console.log(e);
    result = null;
  } finally {
    browser.close();
  }

  return result;
}
