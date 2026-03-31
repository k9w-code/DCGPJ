FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port (Back4App Containers typically uses the PORT env var, our app supports this)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
