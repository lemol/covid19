import firebase from "firebase-admin";
import * as Sentry from "@sentry/node";
import * as Integrations from "@sentry/integrations";

export type Sample = {
  active: number | null;
  suspects: number | null;
  recovered: number | null;
  deaths: number | null;
  timestamp: Date;
  country: string;
};

const SENTRY_DSN = process.env.SENTRY_DSN as string;
const FIREBASE_KEY = process.env.FIREBASE_KEY as string;

console.assert(SENTRY_DSN, "Invalid SENTRY_DSN");
console.assert(FIREBASE_KEY, "Invalid FIREBASE_KEY");

export let db: firebase.firestore.Firestore;

initializeFirebase();

Sentry.init({
  dsn: SENTRY_DSN,
  integrations: [new Integrations.CaptureConsole()]
});

// STORE

function initializeFirebase() {
  const serviceAccountJSON = Buffer.from(FIREBASE_KEY, "base64").toString();
  const serviceAccount = JSON.parse(serviceAccountJSON);

  firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount)
  });

  db = firebase.firestore();
}

export async function getSamples(): Promise<Sample[]> {
  const query = await db
    .collection("samples")
    .orderBy("timestamp")
    .get();

  return query.docs.map(x => {
    const result = x.data();

    return {
      ...result,
      timestamp: result.timestamp.toDate()
    } as Sample;
  });
}
