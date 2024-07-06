const pcsclite = require("pcsclite");
const pcsc = pcsclite();

console.log("Looking for a reader device...");

pcsc.on("reader", function (reader) {
    console.log("Reader detected:", reader.name);

    reader.on("error", function (err) {
        console.error("Error(", reader.name, "):", err.message);
    });

    reader.on("status", (status) => {
        console.log(status);
    });

    reader.on("end", function () {
        console.log("Reader", reader.name, "removed");
    });
});

pcsc.on("error", function (err) {
    console.error("PCSC error", err.message);
});
