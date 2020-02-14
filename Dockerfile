FROM node:12.5.0-alpine as builder
# Create app directory
WORKDIR /app
RUN chown -R 1000 /app
USER 1000
# copy the package json and install first to optimize docker cache for node modules
COPY package.json /app/
COPY package-lock.json /app/
RUN npm ci
COPY . ./
RUN npm run build

# Runtime image
FROM node:12.5.0-alpine
WORKDIR /app
RUN chown -R node /app
# we use numerical UID to be k8s friendly but it's the same as user node
USER 1000
RUN mkdir dist && mkdir node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
ARG COMMIT_ID
ENV CLINICAL_COMMIT_ID=${COMMIT_ID}
ARG VERSION
ENV CLINICAL_VERSION=${VERSION}
EXPOSE 3000
CMD ["node", "dist/src/server.js"]