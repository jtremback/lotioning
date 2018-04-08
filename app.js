let lotion = require("lotion");
let coins = require("coins");
var fs = require("fs");

let app = lotion({ initialState: {}, devMode: true });

app.use(
  coins({
    name: "kittycoin",
    initialBalances: {
      // map addresses to balances
      "04oDVBPIYP8h5V1eC1PSc/JU6Vo": 108,
      OGccsuLV2xuoDau1XRc6hc7uO24: 20,
      "8ph4U3TAzB5cCErrAar5b5RtMe96buDDE": 30
    },
    channels: {}
  })
);

// newChannel

// channelId,
// address0,
// address1,
// balance0,
// balance1,
// settlingPeriodLength,
// signature0,
// signature1

function safeSubtract(a, b) {
  const c = a - b;
  if (c <= 0) {
    throw new Error("balances cannot go below 0");
  }
}

app.use((state, tx) => {
  if (tx.type === "newChannel") {
    console.log(tx);
    state.accounts[tx.address0].balance =
      state.accounts[tx.address0].balance - tx.balance0;
    state.accounts[tx.address1].balance =
      state.accounts[tx.address0].balance - tx.balance1;

    state.channels[tx.channelId] = {
      channelId: tx.channelId,
      address0: tx.address0,
      address1: tx.address1,
      totalBalance: tx.balance0 + tx.balance1,
      balance0: tx.balance0,
      balance1: tx.balance1,
      hashlocks: [],
      sequence: 0,
      settlingPeriodLength: tx.settlingPeriodLength
    };
  }

  if (tx.type === "updateState") {
    state.channels[tx.channelId].sequenceNumber = tx.sequenceNumber;
    state.channels[tx.channelId].balance0 = tx.balance0;
    state.channels[tx.channelId].balance1 = tx.balance1;
    state.channels[tx.channelId].hashlocks = tx.hashlocks;
  }
});

app.listen(3000).then(genesis => {
  console.log(genesis);
  fs.writeFile("./genesis.json", JSON.stringify(genesis, null, 2));
});
