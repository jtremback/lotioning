let lotion = require("lotion");
let coins = require("coins");
let fs = require("fs");
let { createHash } = require("crypto");
let secp256k1 = require("secp256k1");
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

function signedByBoth(fingerprint, signature0, signature1, address0, address1) {
  if (
    !(
      secp256k1.verify(fingerprint, signature0, address0) &&
      secp256k1.verify(fingerprint, signature1, address1)
    )
  ) {
    throw new Error("not signed by both");
  }
}

function signedByOne(fingerprint, signature, address0, address1) {
  if (
    !(
      secp256k1.verify(fingerprint, signature0, address0) ||
      secp256k1.verify(fingerprint, signature1, address1)
    )
  ) {
    throw new Error("not signed");
  }
}
function channelDoesNotExist(state, channelId) {
  if (
    state.channels[channelId] !== null &&
    state.channels[channelId] !== undefined
  ) {
    throw new Error("channel exists");
  }
}

function channelExists(state, channelId) {
  if (
    state.channels[channelId] === null ||
    state.channels[channelId] === undefined
  ) {
    throw new Error("channel does not exist");
  }
}

function channelSettlingPeriodStarted(state, channelId) {
  if (!state.channels[channelId].settlingPeriodStarted) {
    throw new Error("channel not settling yet");
  }
}

function channelSettlingPeriodNotStarted(state, channelId) {
  if (state.channels[channelId].settlingPeriodStarted) {
    throw new Error("channel already settling");
  }
}

function channelIsNotClosed(state, channelId) {
  if (state.channels[channelId].closed) {
    throw new Error("channel closed");
  }
}

function channelIsSettled(state, channelId) {
  if (
    state.channels[channelId].settlingPeriodStarted &&
    state.channels[channelId].sequenceNumber <
      state.channels[channelId].settlingPeriodEnd
  ) {
    throw new Error("channel not finished settling");
  }
}

function channelIsNotSettled(state, channelId) {
  if (
    !(
      state.channels[channelId].settlingPeriodStarted &&
      state.channels[channelId].sequenceNumber <
        state.channels[channelId].settlingPeriodEnd
    )
  ) {
    throw new Error("channel already finished settling");
  }
}

function balancesEqualTotal(state, channelId, balance0, balance1) {
  if (balance0.add(_balance1) !== state.channels[channelId].totalBalance) {
    throw new Error("balances dont add up");
  }
}

function sequenceNumberIsHighest(state, channelId, sequenceNumber) {
  if (sequenceNumber <= state.channels[channelId].sequenceNumber) {
    throw new Error("updating from old state");
  }
}

function safeSubtract(a, b) {
  const c = a - b;
  if (c <= 0) {
    throw new Error("balances cannot go below 0");
  }
}

app.use((state, tx, chainInfo) => {
  if (tx.type === "newChannel") {
    console.log(tx);
    channelDoesNotExist(state, channelId);
    fingerprint = sha256(
      "new",
      tx.channelId,
      tx.address0,
      tx.address1,
      tx.balance0,
      tx.balance1,
      tx.settlingPeriodLength
    );
    signedByBoth(
      fingerprint,
      tx.signature0.tx.signature1,
      tx.address0,
      tx.address1
    );
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
    channelExists(state, tx.channelId);
    channelIsNotSettled(state, tx.channelId);
    channelIsNotClosed(state, tx.channelId);
    sequenceNumberIsHighest(state, tx.channelId, tx.sequenceNumber);
    fingerprint = sha256(
      "update",
      tx.channelId,
      tx.sequenceNumber,
      tx.balance0,
      tx.balance1,
      tx.hashlocks
    );
    signedByBoth(
      fingerprint,
      tx.signature0.tx.signature1,
      channels[tx.channelId].address0,
      channels[tx.channelId].address1
    );
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
    channelExists(state, tx.channelId);
    channelSettlingPeriodNotStarted(state, tx.channelId);
    fingerprint = sha256("settle", tx.channelId);
    signedByOne(
      fingerprint,
      tx.signature,
      channels[tx.channelId].address0,
      channels[tx.channelId].address1
    );
    state.channels[tx.channelId].settlingPeriodStarted = true;
    state.channels[tx.channelId].settlingPeriodEnd =
      chainInfo.height + state.channels[tx.channelId].settlingPeriodLength;
  }

  if (tx.type === "closeChannel") {
    channelExists(state, tx.channelId);
    channelIsSettled(state, tx.channelId);
    channelIsNotClosed(state, tx.channelId);
    closeChannelInternal(tx.channelId);
  }
});

function closeChannelInternal(state, channelId) {
  state.channels[channelId].closed = true;
  let adjustment = getHashlockAdjustment(state.channels[channelId].hashlocks);
  let balances = applyHashlockAdjustment(
    channelId,
    state.channels[channelId].balance0,
    state.channels[channelId].balance1,
    adjustment
  ).balance0;
  incrementBalance(state.channels[channelId].address0, balances.balance0);
  incrementBalance(state.channels[channelId].address1, balances.balance1);
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
