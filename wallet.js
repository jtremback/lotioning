let lotion = require("lotion");
let coins = require("coins");
let crypto = require("crypto");

// privkey {GgEQ&kVV=^LhY
// pubkey

// console.log(crypto.randomBytes(32).toString("hex"));

!(async () => {
  let client = await lotion.connect(
    "8ab03c9258e22934a8c406103775d73030c12cffcd7f3948911dd80938159c18"
  );

  let wallet = coins.wallet(
    Buffer.from(
      "3bf043479e89222f876399065d688beba3b90c951568a32d091da5da274f54d6",
      "hex"
    ),
    client
  );

  console.log(wallet);

  // wallet methods:
  let address = wallet.address;
  console.log(address); // 'OGccsuLV2xuoDau1XRc6hc7uO24'

  let balance = await wallet.getBalance();
  console.log(balance); // 20

  let result = await wallet.send("04oDVBPIYP8h5V1eC1PSc/JU6Vo", 5);
  console.log(result); // { height: 42 }
})();
