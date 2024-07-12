// atrMapping.js

const atrMapping = {
    feliCa212K: {
        atr: "3b8f8001804f0ca00000030603F011000000006a",
        blockSize: "16",
        uidLengths: ["8"],
    },
    feliCa424K: {
        atr: "3b8f8001804f0ca00000030603F012000000006a",
        blockSize: "16",
        uidLengths: ["8"],
    },
    icodeSlix2: {
        atr: "3b8f8001804f0ca00000030603F020000000006a",
        blockSize: "variable",
        uidLengths: ["7"],
    },
    icodeSlix: {
        atr: "3b8f8001804f0ca000000306030025000000006a",
        blockSize: "variable",
        uidLengths: ["7"],
    },
    iso14443A4ByteUid: {
        atr: "3b8f8001804f0ca00000030603F030000000006a",
        blockSize: "variable",
        uidLengths: ["4"],
    },
    iso14443A7ByteUid: {
        atr: "3b8f8001804f0ca00000030603F040000000006a",
        blockSize: "variable",
        uidLengths: ["7"],
    },
    iso14443A10ByteUid: {
        atr: "3b8f8001804f0ca00000030603F050000000006a",
        blockSize: "variable",
        uidLengths: ["10"],
    },
    iso14443B4ByteUid: {
        atr: "3b8f8001804f0ca00000030603F060000000006a",
        blockSize: "variable",
        uidLengths: ["4"],
    },
    iso14443B7ByteUid: {
        atr: "3b8f8001804f0ca00000030603F070000000006a",
        blockSize: "variable",
        uidLengths: ["7"],
    },
    mifareDesfireEv1: {
        atr: "3b8f8001804f0ca00000030603F025000000006a",
        blockSize: "variable",
        uidLengths: ["7", "8"],
    },
    mifareDesfireEv2: {
        atr: "3b8f8001804f0ca00000030603F027000000006a",
        blockSize: "variable",
        uidLengths: ["7", "8"],
    },
    mifareClassic1K: {
        atr: "3b8f8001804f0ca000000306030001000000006a",
        blockSize: "16",
        uidLengths: ["4", "7"],
    },
    mifareClassic4K: {
        atr: "3b8f8001804f0ca000000306030002000000006a",
        blockSize: "16",
        uidLengths: ["4", "7"],
    },
    mifareMini: {
        atr: "3b8f8001804f0ca000000306030026000000006a",
        blockSize: "16",
        uidLengths: ["4", "7"],
    },
    mifareUltralight: {
        atr: "3b8f8001804f0ca000000306030003000000006a",
        blockSize: "4",
        uidLengths: ["7"],
    },
    ntag203: {
        atr: "3b8f8001804f0ca000000306030021000000006a",
        blockSize: "4",
        uidLengths: ["7"],
    },
    ntag213: {
        atr: "3b8f8001804f0ca000000306030022000000006a",
        blockSize: "4",
        uidLengths: ["7"],
    },
    ntag215: {
        atr: "3b8f8001804f0ca000000306030023000000006a",
        blockSize: "4",
        uidLengths: ["7"],
    },
    ntag216: {
        atr: "3b8f8001804f0ca000000306030024000000006a",
        blockSize: "4",
        uidLengths: ["7"],
    },
    topazAndJewel: {
        atr: "3b8f8001804f0ca00000030603F004000000006a",
        blockSize: "variable",
        uidLengths: ["7"],
    },
    ntag213StickerAliexpress: {
        atr: "3b8f8001804f0ca0000003060300030000000068",
        blockSize: "4",
        uidLengths: ["7"],
    },
};

module.exports = atrMapping;
