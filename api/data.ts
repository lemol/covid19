import { NowRequest, NowResponse } from "@now/node";
import { getSamples } from "./_common";

export = async function(_req: NowRequest, res: NowResponse) {
  try {
    const samples = await getSamples();
    res.status(200).json({ data: samples });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "something wrong happen on backend" });
  }
};
