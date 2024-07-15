const pcsclite = require("pcsclite");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const syncRequest = require("sync-request");
const atrMapping = require("./db.js");

const pcsc = pcsclite();

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
const RESET_READER = Buffer.from([0x62, 0x00, 0x00, 0x00]);

const READ_BLOCK = (block) => Buffer.from([0xff, 0xb0, 0x00, block, 16]); // Command to read a block
const READ_SECTOR = (sector) => Buffer.from([0xff, 0xb0, 0x00, sector * 4, 16]); // Command to read a whole sector
const WRITE_BLOCK = (block, data) => Buffer.from([0xff, 0xd7, 0x00, block, 0x05, 0x00, data]); // Data = long int, 4 bytes

let cardInfo = {
    uid: null,
    isCuid: null,
    atr: null,
    blocks: {},
    firmwareVersion: null,
    piccOperatingParameters: null,
    readerStatus: null,
    cardName: null,
    // Additional, inconsistent stuff for mifare classic tool compatibility
    Created: "ACR122u-App",
    FileType: "mfcard",
};

let readerDevice;
const keys = []; // Array in ram for speedy iteration

const downloadedKeysDir = path.join(__dirname, "keys");
if (!fs.existsSync(downloadedKeysDir)) {
    fs.mkdirSync(downloadedKeysDir, { recursive: true });
}

const downloadKeys = () => {
    try {
        const response = syncRequest("GET", "https://api.github.com/repos/ikarus23/MifareClassicTool/contents/Mifare%20Classic%20Tool/app/src/main/assets/key-files?ref=master", {
            headers: {
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "ACR122u-App/1.0",
            },
        });
        const files = JSON.parse(response.getBody());

        files.forEach((file) => {
            const fileUrl = file.download_url;
            const filePath = path.join(downloadedKeysDir, file.name);
            console.log(`Downloading ${file.name}...`);
            const response = syncRequest("GET", fileUrl);
            fs.writeFileSync(filePath, response.getBody());
            console.log(`${path.basename(filePath)} downloaded successfully.`);
        });

        console.log("Key downloads finished.");
        const keysDir = path.join(__dirname, "keys/");

        fs.readdirSync(keysDir).forEach((file) => {
            if (path.extname(file) === ".keys") {
                const filePath = path.join(keysDir, file);
                const fileKeys = fs.readFileSync(filePath, "utf8").split("\n");
                fileKeys.forEach((line) => {
                    try {
                        line = line.trim();
                        if (line && !line.startsWith("#")) {
                            const keyBuffer = Buffer.from(line, "hex");
                            if (!keys.some((existingKey) => existingKey.equals(keyBuffer))) {
                                keys.push(keyBuffer);
                            }
                        }
                    } catch (err) {
                        console.error(`Failed to parse key: ${line} in file: ${file}`, err);
                    }
                });
            }
        });
    } catch (error) {
        console.error("Error initializing:", error);
    } finally {
        console.log("Looking for a reader device...");
    }
};

downloadKeys();

// Initialize and then set up pcsc event listeners
pcsc.on("reader", async (reader) => {
    readerDevice = reader;
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

                    // Find the card name based on ATR
                    cardInfo.cardName = Object.keys(atrMapping).find((key) => atrMapping[key].atr.toLowerCase() === cardInfo.atr.toLowerCase()) || "Unknown card model";
                    console.log("Card Name:", cardInfo.cardName);

                    const uidResponse = (await transmit(reader, protocolReturned, GET_UID)).toString("hex");
                    const uidResponseCode = uidResponse.slice(-4);
                    cardInfo.uid = uidResponse.slice(0, -4);
                    console.log("Card UID:", cardInfo.uid, "with status:", uidResponseCode);

                    const isCuidResponse = (await transmit(reader, protocolReturned, GET_UID_CHANGEABILITY)).toString("hex");
                    cardInfo.isCuid = Buffer.from(isCuidResponse).equals(Buffer.from([0x00, 0x00, 0x00, 0x00]));
                    console.log("Card UID changeable:", cardInfo.isCuid);

                    cardInfo.firmwareVersion = (await transmit(reader, protocolReturned, GET_FIRMWARE_VERSION)).toString("hex");
                    console.log("Firmware Version:", cardInfo.firmwareVersion);

                    cardInfo.piccOperatingParameters = (await transmit(reader, protocolReturned, GET_PICC_OPERATING_PARAMETERS)).toString("hex");
                    console.log("PICC Operating Parameters:", cardInfo.piccOperatingParameters);

                    cardInfo.readerStatus = (await transmit(reader, protocolReturned, GET_READER_STATUS)).toString("hex");
                    console.log("Reader Status:", cardInfo.readerStatus);

                    await readCardData(reader, protocolReturned);

                    saveCardInfoToFile(cardInfo);

                    // writeBlock(reader, protocolReturned, 0, "");
                    // writeBlock0FromString(reader, protocolReturned, 0, "");
                } catch (err) {
                    console.error("Error reading card info:", err);
                } finally {
                    await disconnect(reader);
                    console.log("----------");
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
const authenticate = async (reader, protocol, block) => {
    const sector = Math.floor(block / 4); // Calculate sector from block number
    for (let key of keys) {
        for (let keyType of [0x60, 0x61]) {
            // 0x60 for Key A, 0x61 for Key B
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
                console.log(`Authentication successful with key: ${key.toString("hex")} and key type: ${keyType === 0x60 ? "A" : "B"}`);
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
            cardInfo.blocks[`${block}`] = data.toString("hex").slice(0, -4);
            console.log(`Block ${block} data:`, data.toString("hex").slice(0, -4));
        } catch (err) {
            console.error(`Error reading block ${block}:`, err.message);
        }
    }
};

const writeBlock = async (reader, protocol, block, data) => {
    try {
        await authenticate(reader, protocol, block);
        const command = WRITE_BLOCK(block, data);
        const response = await transmit(reader, protocol, command);
        console.log(`Block ${block} written successfully with response:`, response.toString("hex"));
    } catch (err) {
        console.error(`Error writing block ${block}:`, err.message);
    }
};

const writeBlock0FromString = async (reader, protocol, block, hexString) => {
    const data = Buffer.from(hexString, "hex");
    if (data.length !== 16) {
        throw new Error("Block 0 data must be exactly 16 bytes.");
    }

    try {
        await authenticate(reader, protocol, block);
        const command = WRITE_BLOCK(block, data);
        const response = await transmit(reader, protocol, command);
        console.log(`Block 0 written successfully with response:`, response.toString("hex"));
    } catch (err) {
        console.error(`Error writing block 0:`, err.message);
    }
};

const saveCardInfoToFile = (cardInfo) => {
    const exportsDir = path.join(__dirname, "exports");
    if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir);
    }
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const filename = path.join(exportsDir, `${timestamp}.json`);
    fs.writeFileSync(filename, JSON.stringify(cardInfo, null, 2), "utf8");
    console.log(`Card info saved to ${filename}`);
};

const resetReader = (reader) => {
    console.log("Resetting the reader...");
    const resetReaderControlCode = 0x310000; // ACR122U-specific control code for reset
    const resetCommand = RESET_READER; // Reset command
    reader.control(resetCommand, resetReaderControlCode, 2, (err, response) => {
        if (err) {
            console.error("Error resetting the reader:", err.message);
        } else {
            console.log("Reader reset successfully:", response.toString("hex"));
        }
    });
};
