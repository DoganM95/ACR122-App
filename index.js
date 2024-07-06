const pcsclite = require("pcsclite");
const pcsc = pcsclite();

console.log("Looking for a reader device...");

// Commands specific to ACR122U
const GET_ATR = Buffer.from([0xff, 0xca, 0x01, 0x00, 0x00]);
const GET_FIRMWARE_VERSION = Buffer.from([0xff, 0x00, 0x48, 0x00, 0x00]);
const GET_PICC_OPERATING_PARAMETERS = Buffer.from([0xff, 0x00, 0x50, 0x00, 0x00]);
const GET_READER_STATUS = Buffer.from([0xff, 0x00, 0x64, 0x00, 0x00]);
const GET_UID = Buffer.from([0xff, 0xca, 0x00, 0x00, 0x00]);

const AUTHENTICATE = (sector) => Buffer.from([0xff, 0x86, 0x00, 0x00, 0x05, 0x01, 0x00, sector * 4, 0x60, 0x00]);
const READ_BLOCK = (block) => Buffer.from([0xff, 0xb0, 0x00, block, 0x10]);

const DEFAULT_KEY = Buffer.from([0xff, 0x82, 0x00, 0x00, 0x06, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

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
                let protocol;
                await connect(reader)
                    .then((proto) => (protocol = proto))
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

const readAllSectors = async (reader, protocol) => {
    let sector = 0;
    while (true) {
        try {
            await transmit(reader, protocol, DEFAULT_KEY);
            await transmit(reader, protocol, AUTHENTICATE(sector));

            for (let block = sector * 4; block < sector * 4 + 4; block++) {
                const command = READ_BLOCK(block);
                const data = await transmit(reader, protocol, command);
                cardInfo.sectors[`block${block}`] = data.toString("hex");
                console.log(`Block ${block} data:`, data.toString("hex"));
            }
            sector++;
        } catch (err) {
            if (err.message.includes("SW1/SW2")) {
                console.log("No more sectors to read.");
                break;
            } else {
                console.error(`Error reading sector ${sector}:`, err.message);
                break;
            }
        }
    }
};
