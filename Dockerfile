FROM node:12.5.0-alpine as builder
# Create app directory
WORKDIR /app
RUN chown -R node:node /app
USER node
# copy the package json and install first to optimize docker cache for node modules
COPY package.json /app/
COPY package-lock.json /app/
RUN npm ci
COPY . ./
RUN npm run build

# Runtime image
FROM node:12.5.0-alpine
WORKDIR /app
RUN chown -R node:node /app
# we use numerical UID to be k8s friendly but it's the same as user node
USER 1000
RUN mkdir dist && mkdir node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/entry-point.sh .
COPY --from=builder --chown=node:node ./app/migrate-mongo-config.js .
COPY --from=builder --chown=node:node ./app/migrations ./migrations

ARG COMMIT_ID
ENV CLINICAL_COMMIT_ID=${COMMIT_ID}
ARG VERSION
ENV CLINICAL_VERSION=${VERSION}
EXPOSE 3000
CMD ["./entry-point.sh"]