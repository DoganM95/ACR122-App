# Use an official Node.js runtime as a parent image
FROM node:alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Install pcscd and libpcsclite1
RUN apt update 
RUN apt install -y pcscd libpcsclite1 libpcsclite-dev

# Install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy more stuff
COPY ./index.js ./

# Expose the port the app runs on
EXPOSE 8080

# Command to run the app
CMD ["node", "index.js"]