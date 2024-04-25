FROM oven/bun:1 as base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

ENV NODE_ENV=production

FROM base AS release
RUN mkdir -p /usr/src/app/src
RUN mkdir -p /usr/src/app/scripts
RUN mkdir -p /config
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/src/index.ts ./src
COPY --from=prerelease /usr/src/app/default.json /config
COPY --from=prerelease /usr/src/app/scripts/run.ts ./scripts
COPY --from=prerelease /usr/src/app/package.json .

USER bun
EXPOSE 3000/tcp
WORKDIR /usr/src/app
ENTRYPOINT [ "bun", "scripts/run.ts", "--", "--config=/config" ]
