const pcsclite = require("pcsclite");
const pcsc = pcsclite();

console.log("Looking for a reader device...");

// Commands specific to ACR122U
const GET_ATR = Buffer.from([0xff, 0xca, 0x01, 0x00, 0x00]);
const GET_FIRMWARE_VERSION = Buffer.from([0xff, 0x00, 0x48, 0x00, 0x00]);
const GET_PICC_OPERATING_PARAMETERS = Buffer.from([0xff, 0x00, 0x50, 0x00, 0x00]);
const GET_READER_STATUS = Buffer.from([0xff, 0x00, 0x64, 0x00, 0x00]);
const GET_UID = Buffer.from([0xff, 0xca, 0x00, 0x00, 0x00]);

const READ_SECTOR = (sector) => Buffer.from([0xff, 0xb0, 0x00, sector * 4, 16]);

const DEFAULT_KEYS = [
    Buffer.from([0xff, 0x82, 0x00, 0x00, 0x06, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]), // Default key
    Buffer.from([0xff, 0x82, 0x00, 0x00, 0x06, 0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5]), // Key A
    Buffer.from([0xff, 0x82, 0x00, 0x00, 0x06, 0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5]), // Key B
    Buffer.from([0xff, 0x82, 0x00, 0x00, 0x06, 0x4d, 0x3a, 0x99, 0xc3, 0x51, 0xdd]), // Transport key
    Buffer.from([0xff, 0x82, 0x00, 0x00, 0x06, 0x1a, 0x98, 0x2c, 0x7e, 0x45, 0x9d]), // Custom key 1
    Buffer.from([0xff, 0x82, 0x00, 0x00, 0x06, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]), // Custom key 2
];

let cardInfo = {
    uid: null,
    atr: null,
    sectors: {},
    firmwareVersion: null,
    piccOperatingParameters: null,
    readerStatus: null,
};

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

const authenticate = async (reader, protocol, sector, key) => {
    const command = Buffer.concat([Buffer.from([0xff, 0x86, 0x00, 0x00, 0x05, 0x01, 0x00, sector * 4, 0x60, 0x00]), key]);
    return transmit(reader, protocol, command);
};

const readAllSectors = async (reader, protocol) => {
    let sector = 0;
    while (true) {
        let authenticated = false;
        for (let key of DEFAULT_KEYS) {
            try {
                await authenticate(reader, protocol, sector, key);
                authenticated = true;
                break;
            } catch (err) {
                console.error(`Authentication failed for sector ${sector} with key ${key.toString("hex")}:`, err.message);
            }
        }
        if (!authenticated) {
            console.error(`Failed to authenticate sector ${sector}`);
            break;
        }

        for (let block = sector * 4; block < sector * 4 + 4; block++) {
            try {
                const command = READ_SECTOR(block);
                const data = await transmit(reader, protocol, command);
                cardInfo.sectors[`block${block}`] = data.toString("hex");
                console.log(`Block ${block} data:`, data.toString("hex"));
            } catch (err) {
                console.error(`Error reading block ${block}:`, err.message);
                break;
            }
        }
        sector++;
    }
};
