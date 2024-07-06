const pcsclite = require("pcsclite"); // https://www.npmjs.com/package/pcsclite
const fs = require("fs");
const path = require("path");
const pcsc = pcsclite();

console.log("Looking for a reader device...");

// Commands specific to ACR122U
const GET_ATR = Buffer.from([0xff, 0xca, 0x01, 0x00, 0x00]);
const GET_FIRMWARE_VERSION = Buffer.from([0xff, 0x00, 0x48, 0x00, 0x00]);
const GET_PICC_OPERATING_PARAMETERS = Buffer.from([0xff, 0x00, 0x50, 0x00, 0x00]);
const GET_READER_STATUS = Buffer.from([0xff, 0x00, 0x64, 0x00, 0x00]);
const GET_UID = Buffer.from([0xff, 0xca, 0x00, 0x00, 0x00]);

const READ_SECTOR = (sector) => Buffer.from([0xff, 0xb0, 0x00, sector * 4, 16]); // Command to read sector

let cardInfo = {
    uid: null,
    atr: null,
    sectors: {},
    firmwareVersion: null,
    piccOperatingParameters: null,
    readerStatus: null,
};

const keys = [];
const keysFilePath = path.join(__dirname, "keylist.keys");

fs.readFileSync(keysFilePath, "utf8")
    .split("\n")
    .forEach((line) => {
        line = line.trim();
        if (line && !line.startsWith("#")) {
            try {
                keys.push(Buffer.from(line, "hex"));
            } catch (err) {
                console.error(`Failed to parse key: ${line}`, err);
            }
        }
    });

pcsc.on("reader", async (reader) => {
    console.log("Reader detected:", reader.name);

    reader.on("error", (err) => {
        console.error("Error(", reader.name, "):", err.message);
    });

    reader.on("status", async (status) => {
        console.log(status.state);
        const changes = reader.state ^ status.state; // bitwise XOR operation to check for changes
        if (changes) {
            if (changes & reader.SCARD_STATE_EMPTY && status.state & reader.SCARD_STATE_EMPTY) {
                console.log("Card removed");
                await disconnect(reader)
                    .then(() => console.log("Disconnected."))
                    .catch((err) => console.error("Disconnect error:", err));
            } else if (changes & reader.SCARD_STATE_PRESENT && status.state & reader.SCARD_STATE_PRESENT) {
                console.log("Card inserted");
                let protocolReturned;
                await connect(reader)
                    .then((protocol) => (protocolReturned = protocol))
                    .catch((err) => console.error("Failed to retrieve the protocol." + err));
                try {
                    cardInfo.uid = (await transmit(reader, protocol, GET_UID)).toString("hex");
                    console.log("Card UID:", cardInfo.uid);

                    cardInfo.atr = (await transmit(reader, protocol, GET_ATR)).toString("hex");
                    console.log("Card ATR:", cardInfo.atr);

                    cardInfo.firmwareVersion = (await transmit(reader, protocol, GET_FIRMWARE_VERSION)).toString("hex");
                    console.log("Firmware Version:", cardInfo.firmwareVersion);

                    cardInfo.piccOperatingParameters = (await transmit(reader, protocol, GET_PICC_OPERATING_PARAMETERS)).toString("hex");
                    console.log("PICC Operating Parameters:", cardInfo.piccOperatingParameters);

                    cardInfo.readerStatus = (await transmit(reader, protocol, GET_READER_STATUS)).toString("hex");
                    console.log("Reader Status:", cardInfo.readerStatus);

                    await readAllSectors(reader, protocol);
                } catch (err) {
                    console.error("Error reading card info:", err);
                } finally {
                    await disconnect(reader);
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
                console.log("Disconnected");
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

const authenticate = async (reader, protocol, sector) => {
    for (let key of keys) {
        const command = Buffer.concat([Buffer.from([0xff, 0x86, 0x00, 0x00, 0x05, 0x01, 0x00, sector, 0x60, 0x00]), key]);
        try {
            await transmit(reader, protocol, command);
            console.log(`Authentication successful with key: ${key.toString("hex")}`);
            return key;
        } catch (err) {
            // Continue to the next key
        }
    }
    throw new Error(`Authentication failed for sector ${sector}`);
};

const readAllSectors = async (reader, protocol) => {
    let sector = 0;
    while (true) {
        try {
            const key = await authenticate(reader, protocol, sector);
            const command = READ_SECTOR(sector);
            const data = await transmit(reader, protocol, command);
            cardInfo.sectors[`sector${sector}`] = data.toString("hex");
            console.log(`Sector ${sector} data:`, data.toString("hex"));
            sector++;
        } catch (err) {
            console.error(`Error reading sector ${sector}:`, err.message);
            break;
        }
    }
};
