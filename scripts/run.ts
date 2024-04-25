import { parseArgs } from "util";
import { Flow } from "../src";

process.on("SIGINT", () => {
  console.log("Stopping Flow");
  process.exit();
});

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    config: {
      type: "string",
    },
  },
  strict: true,
  allowPositionals: true,
});

if (!values.config) throw new Error("need --config option");

console.log("This is flow");
console.log(`Using config file ${values.config}`);

let config = { flow: [], options: {} };
const configFile = await Bun.file(values.config);
if (await configFile.exists()) {
  config = await configFile.json();
} else {
  await Bun.write(values.config, JSON.stringify(config));
}

const flow = new Flow(config);

flow.addEventListener("update", (event) =>
  Bun.write(values.config, JSON.stringify(event.detail)),
);

Bun.serve({ fetch: flow.fetch });

