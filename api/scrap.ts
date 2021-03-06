import { NowRequest, NowResponse } from "@now/node";
import axios from "axios";
import cheerio from "cheerio";
import * as Sentry from "@sentry/node";
import { db } from "./_common";

type Sample = {
  active: number | null;
  suspects: number | null;
  recovered: number | null;
  deaths: number | null;
};

const API_KEY = process.env.SCRAPER_API_KEY as string;
const COUNTRY = process.env.COUNTRY || "angola";
const SOURCE_URL = process.env.SOURCE_URL || "https://covid19.gov.ao/";

console.assert(API_KEY && API_KEY.length > 8, "Invalid SCRAPER_API_KEY");
console.assert(COUNTRY, "Invalid COUNTRY");
console.assert(SOURCE_URL, "Invalid SOURCE_URL");

// MAIN

export = async function(req: NowRequest, res: NowResponse) {
  const apiKey =
    req.headers.authorization &&
    req.headers.authorization.substr("Bearer ".length);

  if (apiKey !== API_KEY) {
    res.status(401).json({ message: "invalid or no api key" });
    return;
  }

  try {
    await run();
    res
      .status(200)
      .json({ message: "success" })
      .end();
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "something wrong happen" })
      .end();
  }
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
  const response = await axios.get(SOURCE_URL);
  const $ = cheerio.load(response.data);

  const statElement = (index: number) => {
    const selector = `body > section.lastsection.container.box.effect7 > div > div > div > div > div:nth-child(${index}) > span.big-number.text-black`;
    const element = $(selector);

    if (!element || !element.length) {
      Sentry.captureEvent({
        message: "element null",
        extra: {
          index,
          selector
        }
      });
      return null;
    }

    return parseInt(element.text());
  };

  const active = statElement(2);
  const suspects = statElement(3);
  const recovered = statElement(4);
  const deaths = statElement(5);

  return {
    active,
    suspects,
    recovered,
    deaths
  };
}

// STORE

async function save(timestamp: Date, data: Sample) {
  await db.collection("samples").add({
    timestamp,
    ...data,
    country: COUNTRY
  });
}

async function getCurrent() {
  try {
    const query = await db
      .collection("samples")
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();

    return query.docs[0].data();
  } catch (error) {
    console.error(error);
    return null;
  }
}

// HELPERS

function changed(sample1: Sample, sample2: Sample) {
  return !(
    sample1.active === sample2.active &&
    sample1.suspects === sample2.suspects &&
    sample1.recovered === sample2.recovered &&
    sample1.deaths === sample2.deaths
  );
}
