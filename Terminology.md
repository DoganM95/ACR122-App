# Terminology

Here is some gtp generated explanation of the nfc terminology for this device, out of its docs

## ATS (Answer to Select)

- Definition: ATS is a response message sent by a smart card to a reader after a successful selection process in the ISO/IEC 14443 Type A communication protocol.
- Purpose: It provides information about the card's communication parameters and capabilities, including the supported data rates and frame sizes.

## PICC (Proximity Integrated Circuit Card)

- Definition: PICC refers to the smart card or NFC tag that contains an integrated circuit and communicates with the reader via radio frequency (RF) within close proximity.
- Examples: Contactless payment cards, access control cards, and NFC-enabled devices like smartphones.

## APDU (Application Protocol Data Unit)

- Definition: APDU is a communication unit exchanged between a smart card reader and a smart card. There are two types of APDUs: command APDUs (sent by the reader) and response APDUs (sent by the card).
- Structure: Command APDU includes a header (CLA, INS, P1, P2) and optionally, a data field. Response APDU includes a data field and a status word (SW1, SW2).

## ATR (Answer to Reset)

- Definition: ATR is a message sent by a smart card to the reader after a reset operation. It provides information about the card's protocols, configuration, and capabilities.
- Purpose: It helps the reader understand how to communicate with the card.

## UID (Unique Identifier)

- Definition: UID is a unique identifier for the card or NFC tag. It is used to uniquely identify each card or tag in the communication process.
- Importance: Essential for anti-collision mechanisms and card identification.

## PCSC (Personal Computer/Smart Card)

- Definition: PCSC is a standard for integrating smart cards with computers. It defines APIs for applications to interface with smart cards and readers.
- Components: PCSC service, middleware, and APIs.

## T=CL (Transport Protocol)

- Definition: T=CL is a protocol used for communication between the reader and the card in contactless smart card systems. It defines how data is exchanged over the RF interface.

## ISO/IEC 14443

- Definition: ISO/IEC 14443 is an international standard for proximity cards used for identification and secure transactions. It defines the physical characteristics, RF power and signal interface, initialization and anti-collision, and transmission protocol.
- Types: There are two types, Type A and Type B, which differ in their communication methods and signal modulation.

## NFC (Near Field Communication)

- Definition: NFC is a set of communication protocols for establishing communication between two electronic devices over a distance of 4 cm or less.
- Uses: Contactless payments, data transfer, and access control.

## MIFARE

- Definition: MIFARE is a series of chips widely used in contactless smart cards and proximity cards. They follow the ISO/IEC 14443 Type A standard.
- Variants: MIFARE Classic, MIFARE DESFire, etc.

## SAM (Secure Access Module)

- Definition: SAM is a cryptographic module used in smart card readers to enhance security by storing keys and performing cryptographic operations.

## TLV (Tag-Length-Value)

- Definition: TLV is a data encoding scheme used in smart card communication where each data element is encoded with a tag (identifier), length, and value.

## Overview of Communication Flow

- Reader Initialization: The reader powers up and initializes the communication protocols.
- Card Detection: The reader continuously polls for cards. When a card enters the RF field, it responds with an ATR.
- Card Selection: The reader selects the card using anti-collision mechanisms to avoid interference from multiple cards.
- Data Exchange: The reader sends command APDUs, and the card responds with response APDUs. This can include reading the UID, ATS, or sector data.
- Disconnection: The communication ends when the card is removed from the RF field or the reader initiates a disconnect command.

### Example Commands

- GET_UID: Retrieves the unique identifier of the card.
- GET_ATR: Retrieves the Answer to Reset message from the card.
- READ_SECTOR: Reads data from a specific sector on the card.
