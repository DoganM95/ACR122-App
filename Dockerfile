FROM node:22

# Set working directory
WORKDIR /usr/src/app

# Install packages
RUN apt update 
RUN apt install -y \
    libccid \
    libpcsclite-dev \
    libpcsclite1 \
    pcsc-tools \
    pcscd \
    usbutils

# Install npm dependencies
COPY package*.json ./
RUN npm install

# Copy more stuff
COPY ./index.js ./
COPY ./keylist.keys ./
COPY ./entrypoint.sh ./

# Fix permissions
RUN chmod +x ./entrypoint.sh

# Expose the port the app runs on
EXPOSE 3000

# Set the entrypoint to the script
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]

# Command to run the app
CMD ["node", "index.js"]