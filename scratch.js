const updates = [
  {
    channelId: "foo",
    balance0: 10,
    balance1: 10,
    sequenceNumber: null
  },
  {
    channelId: "foo",
    balance0: 11,
    balance1: 9,
    sequenceNumber: null
  },
  {
    channelId: "foo",
    balance0: 12,
    balance1: 8,
    sequenceNumber: null
  },
  {
    channelId: "foo",
    balance0: 13,
    balance1: 7,
    sequenceNumber: null
  },
  {
    channelId: "foo",
    balance0: 14,
    balance1: 6,
    sequenceNumber: null
  }
];

console.log(
  updates.reduce((acc, item, index, arr) => {
    if (index > 0 && arr[index + 1]) {
      acc = `${acc}\n${item.channelId},${arr[index + 1].balance0 -
        item.balance0},${item.date}`;
    }
    return acc;
  }, "channelId,amount")
);
