// @ts-check
let lotion = require("lotion");
let coins = require("coins");
let fs = require("fs");
let { createHash } = require("crypto");
let secp256k1 = require("secp256k1");
let app = lotion({ initialState: {}, devMode: true });

const settlingPeriodLength = 20;

function hashFunc(algo) {
  return data =>
    createHash(algo)
      .update(JSON.stringify(data))
      .digest();
}

let sha256 = hashFunc("sha256");

app.use(
  coins({
    name: "kittycoin",
    initialBalances: {
      "8ph4U3TAzB5cCErrAar5b5RtMe96buDDE": 100,
      K8XKzxe4kjTn3sNYQijzVUriwTnhbZRt7: 100,
      "3cfCrd2uyaHj3bpBAT2r6P3vtAafuMdaX": 100
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
      secp256k1.verify(fingerprint, signature, address0) ||
      secp256k1.verify(fingerprint, signature, address1)
    )
  ) {
    throw new Error("not signed");
  }
}

function signedBy(fingerprint, signature, address) {
  if (!secp256k1.verify(fingerprint, signature, address)) {
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
  if (balance0.add(balance1) !== state.channels[channelId].totalBalance) {
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
  console.log(tx);
  if (tx.type === "newChannel") {
    const {
      channelId,
      address0,
      address1,
      balance0,
      balance1,
      signature0,
      signature1
    } = tx;
    channelDoesNotExist(state, channelId);
    const fingerprint = sha256([
      "new",
      channelId,
      address0,
      address1,
      balance0,
      balance1
    ]);
    signedByBoth(fingerprint, signature0, signature1, address0, address1);

    state.accounts[address0].balance = safeSubtract(
      state.accounts[address0].balance,
      balance0
    );

    state.accounts[address1].balance = safeSubtract(
      state.accounts[address0].balance,
      balance1
    );

    state.channels[channelId] = {
      channelId: channelId,
      address0: address0,
      address1: address1,
      totalBalance: balance0 + balance1,
      balance0: balance0,
      balance1: balance1,
      hashlocks: [],
      sequence: 0,
      settlingPeriodLength
    };
  }

  if (tx.type === "createChannel") {
    const { channelId, address0, address1, balance0, signature } = tx;
    channelDoesNotExist(state, channelId);

    const fingerprint = sha256([
      "create",
      channelId,
      address0,
      address1,
      balance0
    ]);

    signedBy(fingerprint, signature, address0);

    state.accounts[address0].balance = safeSubtract(
      state.accounts[address0].balance,
      balance0
    );

    state.channels[channelId] = {
      channelId: channelId,
      address0: address0,
      address1: address1,
      totalBalance: balance0,
      balance0: balance0,
      balance1: 0,
      hashlocks: [],
      sequence: 0,
      settlingPeriodLength: settlingPeriodLength
    };
  }

  if (tx.type === "joinChannel") {
    const { channelId, address, balance, signature } = tx;

    channelExists(state, channelId);
    channelIsNotSettled(state, channelId);
    channelIsNotClosed(state, channelId);

    const fingerprint = sha256(["join", channelId, address, balance]);

    signedBy(fingerprint, signature, address);

    state.accounts[address].balance = safeSubtract(
      state.accounts[address].balance,
      balance
    );

    state.channels[channelId].balance1 = balance;
  }

  if (tx.type === "updateState") {
    const {
      channelId,
      sequenceNumber,
      balance0,
      balance1,
      hashlocks,
      signature0,
      signature1
    } = tx;

    channelExists(state, tx.channelId);
    channelIsNotSettled(state, tx.channelId);
    channelIsNotClosed(state, tx.channelId);
    sequenceNumberIsHighest(state, tx.channelId, tx.sequenceNumber);

    const fingerprint = sha256([
      "update",
      channelId,
      sequenceNumber,
      balance0,
      balance1,
      hashlocks
    ]);

    signedByBoth(
      fingerprint,
      signature0,
      signature1,
      state.channels[channelId].address0,
      state.channels[channelId].address1
    );

    state.channels[channelId].sequenceNumber = sequenceNumber;
    state.channels[channelId].balance0 = balance0;
    state.channels[channelId].balance1 = balance1;
    state.channels[channelId].hashlocks = hashlocks;
  }

  if (tx.type === "submitPreimage") {
    if (tx.hashed !== sha256(tx.preImage)) {
      throw new Error("hash does not match preimage");
    }
    state.seenPreimage[tx.hashed] = true;
  }

  if (tx.type === "startSettlingPeriod") {
    const { channelId, signature } = tx;
    channelExists(state, tx.channelId);
    channelSettlingPeriodNotStarted(state, tx.channelId);

    const fingerprint = sha256(["settle", tx.channelId]);

    signedByOne(
      fingerprint,
      signature,
      state.channels[channelId].address0,
      state.channels[channelId].address1
    );

    state.channels[channelId].settlingPeriodStarted = true;
    state.channels[channelId].settlingPeriodEnd =
      chainInfo.height + state.channels[channelId].settlingPeriodLength;
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
  let adjustment = getHashlockAdjustment(
    state,
    state.channels[channelId].hashlocks
  );

  let adjustedBalances = applyHashlockAdjustment(channelId, adjustment);

  state.accounts[state.channels[channelId].address0].balance +=
    adjustedBalances.balance0;

  state.accounts[state.channels[channelId].address1].balance +=
    adjustedBalances.balance1;
}

function getHashlockAdjustment(state, hashlocks) {
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
  fs.writeFile("./genesis.json", JSON.stringify(genesis, null, 2), () =>
    console.log("wrote genesis.json")
  );
});
