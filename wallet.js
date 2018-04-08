// @ts-check
const lotion = require("lotion");
const coins = require("coins");
const crypto = require("crypto");
const vorpal = require("vorpal")();
const genesis = require("./genesis.json");
const fetch = require("node-fetch");
let { createHash } = require("crypto");
const express = require("express");
let fs = require("fs");
// privkey 3bf043479e89222f876399065d688beba3b90c951568a32d091da5da274f54d6
// pubkey 8ph4U3TAzB5cCErrAar5b5RtMe96buDDE

// console.log(crypto.randomBytes(32).toString("hex"));

function hashFunc(algo) {
  return data =>
    createHash(algo)
      .update(JSON.stringify(data))
      .digest();
}

let sha256 = hashFunc("sha256");

const channels = {};
let client;
let wallet;
let myAddress;
let nodeNumber;

!(async () => {
  nodeNumber = Number(process.argv[2]);
  console.log(nodeNumber);
  client = await lotion.connect(genesis.GCI);

  wallet = coins.wallet("./node_" + nodeNumber, client);

  // console.log(wallet);

  // wallet methods:
  myAddress = wallet.address();
  console.log(`node ${nodeNumber}, address: ${myAddress}`); // 'OGccsuLV2xuoDau1XRc6hc7uO24'

  // const result = await wallet.send("04oDVBPIYP8h5V1eC1PSc/JU6Vo", 5);
  // console.log(result); // { height: 42 }
})();

vorpal.show();

vorpal
  .command(
    "createChannel <channelId> <counterparty> <myBalance> <theirBalance>"
  )
  .action(async ({ channelId, counterparty, theirBalance, myBalance }) => {
    await client.send({
      type: "createChannel",
      channelId,
      address0: wallet.address(),
      address1: counterparty,
      balance0: myBalance,
      signature: ""
    });
    channels[channelId] = {
      channelId,
      me: 0,
      address0: wallet.address(),
      address1: counterparty,
      balance0: myBalance,
      balance1: theirBalance,
      updates: [
        {
          channelId,
          balance0: myBalance,
          balance1: theirBalance,
          sequenceNumber: null,
          date: new Date().toLocaleString()
        }
      ]
    };
  });

vorpal
  .command("joinChannel <channelId> <counterparty> <myBalance> <theirBalance>")
  .action(async ({ channelId, counterparty, theirBalance, myBalance }) => {
    client.send({
      type: "joinChannel",
      channelId,
      address: wallet.address(),
      balance: myBalance,
      signature: ""
    });
    channels[channelId] = {
      channelId,
      me: 1,
      address0: counterparty,
      address1: wallet.address(),
      balance0: theirBalance,
      balance1: myBalance,
      updates: [
        {
          channelId,
          balance0: theirBalance,
          balance1: myBalance,
          sequenceNumber: null,
          date: new Date().toLocaleString()
        }
      ]
    };
  });

function postTo(url, body) {
  // @ts-ignore
  fetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  });
}

vorpal
  .command("sendPayment <url> <channelId> <amount>")
  .action(async ({ url, channelId, amount }) => {
    console.log("sendpayment");
    const { balance0, balance1, sequenceNumber } = channels[channelId];
    const body = {
      channelId,
      balance0: balance0 + amount,
      balance1: balance1 - amount,
      sequenceNumber: sequenceNumber + 1,
      date: new Date().toLocaleString()
    };

    postTo(url + "/payment", body);

    channels[channelId].sequenceNumber = body.sequenceNumber;
    channels[channelId].balance0 = body.balance0;
    channels[channelId].balance1 = body.balance1;
    channels[channelId].updates.push(body);
  });

vorpal.command("tax <channelId>").action(async ({ channelId }) => {
  const csv = channels[channelId].updates.reduce((acc, item, index, arr) => {
    if (index > 0 && arr[index + 1]) {
      acc = `${acc}\n${item.channelId},${arr[index + 1].balance0 -
        item.balance0},${item.date}`;
    }
    return acc;
  }, "channelId,amount,date");
  console.log(csv);

  fs.writeFile("./tax.csv", csv, () => console.log("wrote tax.csv"));
});

const app = express();

app.use(express.json());

app.post("/payment", (req, res) => {
  console.log("received payment");
  const { channelId, balance0, balance1, sequenceNumber } = req.body;

  // channelExists(channelId);
  // channelIsNotSettled(channelId);
  // channelIsNotClosed(channelId);
  // sequenceNumberIsHighest(channelId, sequenceNumber);

  // if (channels[channelId].me === 0) {

  // }

  channels[channelId].sequenceNumber = sequenceNumber;
  channels[channelId].balance0 = balance0;
  channels[channelId].balance1 = balance1;
  channels[channelId].updates.push(req.body);
});

app.listen(3100 + nodeNumber, () =>
  console.log("Example app listening on port " + (3100 + nodeNumber))
);
