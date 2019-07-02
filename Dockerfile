FROM node:12.5.0-alpine

# Create app directory
WORKDIR /app

# copy the package json and install first to optimize docker cache for node modules
COPY package.json /app/
COPY package-lock.json /app/
RUN npm ci

COPY . ./
RUN npm run build

EXPOSE 3000

COPY . .
CMD ["npm", "start"]