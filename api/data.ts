import { NowRequest, NowResponse } from "@now/node";
import * as firebase from "firebase-admin";
import * as Sentry from "@sentry/node";
import * as Integrations from "@sentry/integrations";

type Sample = {
  confirmed: number | null;
  suspects: number | null;
  recovered: number | null;
  deaths: number | null;
  timestamp: Date;
  country: string;
};

const SENTRY_DSN = process.env.SENTRY_DSN;

let db: firebase.firestore.Firestore;

console.assert(SENTRY_DSN, "Invalid SENTRY_DSN");

initializeFirebase();
Sentry.init({
  dsn: SENTRY_DSN,
  integrations: [new Integrations.CaptureConsole()]
});

// MAIN

export = async function(req: NowRequest, res: NowResponse) {
  try {
    const samples = await getSamples();
    res.status(200).json({ data: samples });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "something wrong happen on backend" });
  }
};

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

async function getSamples() {
  const query = await db
    .collection("samples")
    .orderBy("timestamp")
    .get();

  return query.docs.map(x => x.data());
}
