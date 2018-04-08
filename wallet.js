let lotion = require("lotion");
let coins = require("coins");
let crypto = require("crypto");
let genesis = require("./genesis.json");
// privkey 3bf043479e89222f876399065d688beba3b90c951568a32d091da5da274f54d6
// pubkey E4L1KBG1XAFQ6Mhe1FX5EDaxKK7zJrwZx

// console.log(crypto.randomBytes(32).toString("hex"));

!(async () => {
  let client = await lotion.connect(genesis.GCI);

  let wallet = coins.wallet("./private_key", client);

  console.log(wallet);

  // wallet methods:
  let address = wallet.address();
  console.log(address); // 'OGccsuLV2xuoDau1XRc6hc7uO24'

  let result = await wallet.send("04oDVBPIYP8h5V1eC1PSc/JU6Vo", 5);
  console.log(result); // { height: 42 }
})();
