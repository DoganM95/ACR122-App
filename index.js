const pcsclite = require("pcsclite");
const pcsc = pcsclite();

console.log("Looking for a reader device...");

// Commands specific to acr122u
const GET_UID = Buffer.from([0xff, 0xca, 0x00, 0x00, 0x00]);

let cardUid;
let cardData;

pcsc.on("reader", function (reader) {
    console.log("Reader detected:", reader.name);

    reader.on("error", function (err) {
        console.error("Error(", reader.name, "):", err.message);
    });

    reader.on("status", function (status) {
        console.log(status.state);
        const changes = reader.state ^ status.state; // bitwise XOR operation
        if (changes) {
            // bitwise AND operation
            if (changes & reader.SCARD_STATE_EMPTY && status.state & reader.SCARD_STATE_EMPTY) {
                console.log("Card removed");
                reader.disconnect(reader.SCARD_LEAVE_CARD, function (err) {
                    if (!err) {
                        console.log("Disconnected");
                    } else {
                        console.error("Disconnect error:", err);
                    }
                });
            } else if (changes & reader.SCARD_STATE_PRESENT && status.state & reader.SCARD_STATE_PRESENT) {
                console.log("Card inserted");
                reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, function (err, protocol) {
                    if (!err) {
                        console.log("Connected, protocol:", protocol);
                        reader.transmit(GET_UID, 40, protocol, function (err, data) {
                            if (!err) {
                                console.log("Card UID:", data.toString("hex"));
                                cardUid = data.toString("hex");
                            } else {
                                console.error("Transmit error:", err);
                            }
                        });
                    } else {
                        console.error("Connect error:", err);
                    }
                });
            }
        }
    });

    reader.on("end", function () {
        console.log("Reader", reader.name, "removed");
    });
});

pcsc.on("error", function (err) {
    console.error("PCSC error", err.message);
});
