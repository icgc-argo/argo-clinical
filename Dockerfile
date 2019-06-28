FROM node:8

# Create app directory
WORKDIR /app

COPY . ./
RUN npm ci
RUN npm run build

EXPOSE 3000

COPY . .
CMD ["npm", "start"]