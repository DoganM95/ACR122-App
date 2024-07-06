FROM node:22

# Set working directory
WORKDIR /usr/src/app

# Install packages
RUN apt update 
RUN apt install -y pcscd libpcsclite1 libpcsclite-dev usbutils pcsc-tools pcsc-ccid

# Install npm dependencies
COPY package*.json ./
RUN npm install

# Copy more stuff
COPY ./index.js ./
COPY ./entrypoint.sh ./

# Fix permissions
RUN chmod +x ./entrypoint.sh

# Expose the port the app runs on
EXPOSE 8080

# Set the entrypoint to the script
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]

# Command to run the app
CMD ["node", "index.js"]