const pcsclite = require("pcsclite"); // https://www.npmjs.com/package/pcsclite
const fs = require("fs");
const path = require("path");
const pcsc = pcsclite();

console.log("Looking for a reader device...");

// Commands specific to ACR122U, with SW1,SW2 = (0900: success), (6300: error-operation-failed), (6A81: error-func-not-supported)
const GET_ATR = Buffer.from([0xff, 0xca, 0x00, 0x00, 0x00]); // Response: {ATS} (SW1) (SW2)
const GET_ATR_FULL_LENGTH = Buffer.from([0xff, 0xca, 0x01, 0x00, 0x00]); // Response: (UID-LSB) () () (UID MSB) (SW1) (SW2) = 6 Bytes
const GET_FIRMWARE_VERSION = Buffer.from([0xff, 0x00, 0x48, 0x00, 0x00]);
const GET_PICC_OPERATING_PARAMETERS = Buffer.from([0xff, 0x00, 0x50, 0x00, 0x00]);
const GET_READER_STATUS = Buffer.from([0xff, 0x00, 0x64, 0x00, 0x00]); // TODO: check
const GET_UID = Buffer.from([0xff, 0xca, 0x00, 0x00, 0x00]); // Returns UID + 2 Bytes (00, 00)
const GET_UID_PDF = Buffer.from([0xff, 0xca, 0x00, 0x00, 0x04]);
const GET_ATS_PDF = Buffer.from([0xff, 0xca, 0x01, 0x00, 0x04]);
const GET_UID_CHANGEABILITY = Buffer.from([0x40, 0x00, 0x00, 0x00]);

const READ_BLOCK = (block) => Buffer.from([0xff, 0xb0, 0x00, block, 16]); // Command to read a block
const READ_SECTOR = (sector) => Buffer.from([0xff, 0xb0, 0x00, sector * 4, 16]); // Command to read a whole sector
const WRITE_BLOCK = (block, data) => Buffer.from([0xff, 0xd7, 0x00, block, 0x05, 0x00, data]); // Data = long int, 4 bytes

let cardInfo = {
    uid: null,
    isCuid: null,
    atr: null,
    sectors: {},
    firmwareVersion: null,
    piccOperatingParameters: null,
    readerStatus: null,
    cardName: null,
};

// Mapping of ATRs to card names, explained byte by byte, see page 8
// Bytes: (0: Initial header), (1: T0), (2: TD1), (3: TD2), (4 to 3+N: T1, Tk, RFU), (4+N: TCK)
const atrMapping = {
    "3b8f8001804f0ca00000030603F011000000006a": "FeliCa 212K", // See ACR122u Datasheet
    "3b8f8001804f0ca00000030603F012000000006a": "FeliCa 424K", // See ACR122u Datasheet
    "3b8f8001804f0ca00000030603F020000000006a": "ICODE SLIX2", // See NXP datasheet
    "3b8f8001804f0ca000000306030025000000006a": "ICODE SLIX", // See NXP datasheet
    "3b8f8001804f0ca00000030603F030000000006a": "ISO14443A 4-byte UID", // General pattern for ISO14443A
    "3b8f8001804f0ca00000030603F040000000006a": "ISO14443A 7-byte UID", // General pattern for ISO14443A
    "3b8f8001804f0ca00000030603F050000000006a": "ISO14443A 10-byte UID", // General pattern for ISO14443A
    "3b8f8001804f0ca00000030603F060000000006a": "ISO14443B 4-byte UID", // General pattern for ISO14443B
    "3b8f8001804f0ca00000030603F070000000006a": "ISO14443B 7-byte UID", // General pattern for ISO14443B
    "3b8f8001804f0ca00000030603F025000000006a": "MIFARE DESFire EV1", // See NXP datasheet
    "3b8f8001804f0ca00000030603F027000000006a": "MIFARE DESFire EV2", // See NXP datasheet
    "3b8f8001804f0ca000000306030001000000006a": "MIFARE Classic 1K", // See ACR122u Datasheet
    "3b8f8001804f0ca000000306030002000000006a": "MIFARE Classic 4K", // See ACR122u Datasheet
    "3b8f8001804f0ca000000306030026000000006a": "MIFARE Mini", // See ACR122u Datasheet
    "3b8f8001804f0ca000000306030003000000006a": "MIFARE Ultralight", // See ACR122u Datasheet
    "3b8f8001804f0ca000000306030021000000006a": "NTAG203", // Common for NTAG203
    "3b8f8001804f0ca000000306030022000000006a": "NTAG213", // Common for NTAG213
    "3b8f8001804f0ca000000306030023000000006a": "NTAG215", // Common for NTAG215
    "3b8f8001804f0ca000000306030024000000006a": "NTAG216", // Common for NTAG216
    "3b8f8001804f0ca00000030603F004000000006a": "Topaz and Jewel", // See ACR122u Datasheet
    // Some exotic, wild cards from aliexpress
    "3b8f8001804f0ca0000003060300030000000068": "NTAG213 Sticker", // Model GYH4749, Brand CUJMH
};

const keys = []; // Array in ram for speedy iteration
const keysFilePath = path.join(__dirname, "keylist.keys");
fs.readFileSync(keysFilePath, "utf8")
    .split("\n")
    .forEach((line) => {
        try {
            line = line.trim();
            if (line && !line.startsWith("#")) {
                keys.push(Buffer.from(line, "hex"));
            }
        } catch (err) {
            console.error(`Failed to parse key: ${line}`, err);
        }
    });

pcsc.on("reader", async (reader) => {
    console.log("Reader detected:", reader.name);

    reader.on("error", (err) => {
        console.error("Error(", reader.name, "):", err.message);
    });

    reader.on("status", async (status) => {
        console.log("Status state: " + status.state);
        const changes = reader.state ^ status.state; // bitwise XOR operation to check for changes
        if (changes) {

            if (changes & reader.SCARD_STATE_EMPTY && status.state & reader.SCARD_STATE_EMPTY) {
                console.log("Card removed");
                await disconnect(reader)
                    .then(() => console.log("Disconnected."))
                    .catch((err) => console.error("Disconnect error:", err));

            } else if (changes & reader.SCARD_STATE_PRESENT && status.state & reader.SCARD_STATE_PRESENT) {
                console.log("Card inserted");
                try {
                    let protocolReturned;
                    await connect(reader)
                        .then((protocol) => (protocolReturned = protocol))
                        .catch((err) => console.error("Failed to retrieve the protocol." + err));
                    cardInfo.atr = status.atr.toString("hex");
                    console.log("Card ATR by connection:", cardInfo.atr);

                    let atrExplicit = (await transmit(reader, protocolReturned, GET_ATR_FULL_LENGTH)).toString("hex");
                    console.log("Card ATR by calling GET_ATR_FULL_LENGTH:", atrExplicit);

                    cardInfo.cardName = atrMapping[cardInfo.atr.toLowerCase()] || "Unknown card model";
                    console.log("Card Name:", cardInfo.cardName);

                    const uidResponse = (await transmit(reader, protocolReturned, GET_UID)).toString("hex");
                    const uidResponseCode = uidResponse.slice(-4);
                    cardInfo.uid = uidResponse.slice(0, -4);
                    console.log("Card UID:", cardInfo.uid, "with status:", uidResponseCode);

                    const isCuidResponse = (await transmit(reader, protocolReturned, GET_UID_CHANGEABILITY)).toString("hex");
                    cardInfo.isCuid = Buffer.from(isCuidResponse).equals(Buffer.from([0x00, 0x00, 0x00, 0x00]))
                    console.log("Card UID changeable:", cardInfo.isCuid)

                    cardInfo.firmwareVersion = (await transmit(reader, protocolReturned, GET_FIRMWARE_VERSION)).toString("hex");
                    console.log("Firmware Version:", cardInfo.firmwareVersion);

                    cardInfo.piccOperatingParameters = (await transmit(reader, protocolReturned, GET_PICC_OPERATING_PARAMETERS)).toString("hex");
                    console.log("PICC Operating Parameters:", cardInfo.piccOperatingParameters);

                    cardInfo.readerStatus = (await transmit(reader, protocolReturned, GET_READER_STATUS)).toString("hex");
                    console.log("Reader Status:", cardInfo.readerStatus);

                    await readCardData(reader, protocolReturned);
                } catch (err) {
                    console.error("Error reading card info:", err);
                } finally {
                    await disconnect(reader);
                    console.log("----------")
                    console.log("Card reading complete:", cardInfo);
                }
            }
        }
    });

    reader.on("end", () => {
        console.log("Reader", reader.name, "removed");
    });
});

pcsc.on("error", (err) => {
    console.error("PCSC error", err.message);
});

const connect = async (reader) => {
    return new Promise((resolve, reject) => {
        reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, function (err, protocol) {
            if (err) {
                reject(err);
            } else {
                console.log("Connected, protocol:", protocol);
                resolve(protocol);
            }
        });
    });
};

const disconnect = async (reader) => {
    return new Promise((resolve, reject) => {
        reader.disconnect(reader.SCARD_LEAVE_CARD, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

const transmit = async (reader, protocol, command) => {
    return new Promise((resolve, reject) => {
        reader.transmit(command, 40, protocol, function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
};

// Sectors are divided into 4 blocks each, 16th Sector's last block = 0x3F (= 16h*04h)
// Authentication on Mifare 1K is necessary only once per sector, each block in that sector can be read afterwards
// Auth key response: (SW1) (SW2) = 2 Bytes with (9000: success), (6300: error)
// block = block number to be authenticated, keyT = key type used for auth (TYPE A = 60 || TYPE B = 61)
// keyN = key Number (0x00 || 0x01)
const authenticate = async (reader, protocol, block, sector) => {
    for (let key of keys) {
        for (let keyType of [0x60, 0x61]) { // 0x60 for Key A, 0x61 for Key B
            let tryNextKey = false;
            const keyN = 0x00; // Usually 0x00

            const loadAuthKeysApduFormatIntoReader11Bytes = Buffer.concat([Buffer.from([0xff, 0x82, 0x00, keyN, 0x06]), key]);
            const authenticateData5Bytes = Buffer.from([0x01, 0x00, block, keyType, 0x00]);
            const loadAuthKeysApduFormatFromReader10Bytes = Buffer.concat([Buffer.from([0xff, 0x86, 0x00, 0x00, 0x05]), authenticateData5Bytes]);

            try {
                let bufRes1 = await transmit(reader, protocol, loadAuthKeysApduFormatIntoReader11Bytes).catch((err) => (tryNextKey = true));
                if (tryNextKey) continue;
                let bufRes2 = await transmit(reader, protocol, loadAuthKeysApduFormatFromReader10Bytes).catch((err) => (tryNextKey = true));
                if (tryNextKey) continue;
                console.log(`Authentication successful with key: ${key.toString("hex")} and key type: ${keyType === 0x60 ? 'A' : 'B'}`);
                return { key, keyType };
            } catch (err) {
                // Continue to the next key
            }
        }
    }
    throw new Error(`Authentication failed for sector ${sector}`);
};

const readCardData = async (reader, protocol) => {
    const maxBlocks = 64; // For MIFARE Classic 1K, it has 16 sectors (each with 4 blocks), 64 blocks in total
    for (let block = 0; block < maxBlocks; block++) {
        try {
            console.log("--- Authenticating block", block);
            await authenticate(reader, protocol, block);
            const command = READ_BLOCK(block);
            const data = await transmit(reader, protocol, command); // Response = (block: N Bytes + sw1,sw2: 2 Bytes)
            cardInfo.sectors[`block${block}`] = data.toString("hex").slice(0, -4);
            console.log(`Block ${block} data:`, data.toString("hex").slice(0, -4));
        } catch (err) {
            console.error(`Error reading block ${block}:`, err.message);
        }
    }
};