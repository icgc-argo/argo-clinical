FROM node:12.5.0-alpine as builder

# Create app directory
WORKDIR /app

# copy the package json and install first to optimize docker cache for node modules
COPY package.json /app/
COPY package-lock.json /app/
RUN npm ci

COPY . ./
RUN npm run build

FROM node:12.5.0-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
ARG COMMIT_ID
ENV CLINICAL_COMMIT_ID=${COMMIT_ID}
ARG VERSION
ENV CLINICAL_VERSION=${VERSION}
EXPOSE 3000
CMD ["node", "dist/src/server.js"]