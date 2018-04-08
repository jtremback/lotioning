let lotion = require("lotion");
let coins = require("coins");
let fs = require("fs");
let { createHash } = require("crypto");

let app = lotion({ initialState: {}, devMode: true });

function hashFunc(algo) {
  return data =>
    createHash(algo)
      .update(data)
      .digest();
}

let sha256 = hashFunc("sha256");

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

app.use((state, tx, chainInfo) => {
  if (tx.type === "newChannel") {
    console.log(tx);
    state.accounts[tx.address0].balance = safeSubtract(
      state.accounts[tx.address0].balance,
      tx.balance0
    );
    state.accounts[tx.address1].balance = safeSubtract(
      state.accounts[tx.address0].balance,
      tx.balance1
    );

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

  if (tx.type === "submitPreimage") {
    if (tx.hashed !== sha256(tx.preImage)) {
      throw new Error("hash does not match preimage");
      state.seenPreimage[tx.hashed] = true;
    }
  }

  if (tx.type === "startSettlingPeriod") {
    state.channels[tx.channelId].settlingPeriodStarted = true;
    state.channels[tx.channelId].settlingPeriodEnd =
      chainInfo.height + state.channels[tx.channelId].settlingPeriodLength;
  }

  if (tx.type === "closeChannel") {
    closeChannelInternal(tx.channelId);
  }
});

function closeChannelInternal(state, channelId) {
  state.channels[channelId].closed = true;
}

function getHashlockAdjustment(hashlocks) {
  return hashlocks.reduce((acc, { hash, adjustment }) => {
    if (state.seenPreimage[hash]) {
      acc = acc + adjustment;
    }

    return acc;
  }, 0);
}

function applyHashlockAdjustment(state, channelId, adjustment) {
  return {
    balance0: (state.channels[channelId].balance0 += adjustment),
    balance1: (state.channels[channelId].balance0 -= adjustment)
  };
}

app.listen(3000).then(genesis => {
  console.log(genesis);
  fs.writeFile("./genesis.json", JSON.stringify(genesis, null, 2));
});
