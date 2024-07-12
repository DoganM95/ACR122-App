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
    udev \
    usbutils 

# Install pm2 globally
RUN npm install -g pm2

# Install npm dependencies
COPY package*.json ./
RUN npm install

# Copy more stuff
# COPY ./index.js ./
# COPY ./keylist.keys ./
# COPY ./entrypoint.sh ./
COPY . .

# Create blacklist
RUN mkdir -p /etc/modprobe.d/
RUN touch /etc/modprobe.d/blacklist.conf
RUN echo 'install nfc /bin/false' > /etc/modprobe.d/blacklist.conf
RUN echo 'install pn533 /bin/false' >> /etc/modprobe.d/blacklist.conf

# Fix permissions
RUN chmod +x ./entrypoint.sh

# Expose the port the app runs on
EXPOSE 3000

# Set the entrypoint to the script
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]

# Command to run the app with pm2
CMD ["pm2-runtime", "index.js"]
