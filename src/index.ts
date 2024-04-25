import Mustache from "mustache";
import vm from "node:vm";

Mustache.escape = (text) => text;
Mustache.tags = ["<%", "%>"];

export class Flow extends EventTarget {
  constructor(options: any) {
    super();
    this.flows = options.flows ?? [];
  }

  get fetch() {
    return this._fetch.bind(this);
  }

  async _fetch(request: Request) {
    const url = new URL(request.url);

    // @todo check host header
    const flow = this.flows[0];

    if (!flow)
      return new Response("No flow found", { status: 500 });

    switch (url.pathname) {
      case "/admin/flows":
        switch (request.method) {
          case "GET":
            return new Response(JSON.stringify(this.flows));
          case "POST":
            this.flows = await request.json();
            this.dispatchEvent(
              new CustomEvent("update", {
                detail: { flows: this.flows },
              }),
            );
            return new Response(JSON.stringify(this.flows));
        }
        break;
    }

    console.log(`Processing request for ${url.pathname}`);

    const maximumDepth = 20;
    let depth = 0;
    let step = flow.steps[0];

    if (!step)
      return new Response("No first step found in flow", { status: 500 });

    const context = {};
    let responseBody = "";
    let responseCode = 200;
    let responseHeaders = new Headers();

    do {
      depth++;

      const contextId = step.as ?? step.id;
      let nextStepId = step.next;

      console.log(`Running ${flow.id}/${step.id} (${step.type})`);

      switch (step.type) {
        case "redirect":
          responseCode = 302;
          responseHeaders.set("Location", step.input.value);
          break;

        case "fetch":
          const result = await fetch(step.input.url, {
            method: step.input.method,
          });
          // @todo auto-detect result type
          context[contextId] = await result.text();
          break;

        case "route":
          for (const [key, value] of Object.entries(step.input.routes)) {
            if (url.pathname === key) nextStepId = value;
          }
          break;

        case "evaluateJavascript":
          vm.createContext(context);
          context.___result___ = undefined;
          const script = `___result___ = (() => { ${step.input.value} })();`;
          vm.runInContext(script, context);
          context[contextId] = context.___result___;
          delete context.___result___;
          break;

        case "authHeaderToken":
          const [type, token] =
            request.headers.get("Authorization")?.split(" ") ?? [];
          if (
            type !== step.input.type ||
            token !== step.input.token
          ) {
            responseBody = "Unauthorized";
            responseCode = 401;
            nextStepId = null;
          } else {
            context[contextId] = { type, token };
          }
          break;

        case "plainTextResponse":
          responseBody = Mustache.render(step.input.value, {
            ...context,
          });
          responseHeaders.set(
            "Content-Type",
            step.input.contentType ?? "text/plain",
          );
          context[contextId] = responseBody;
          break;

        case "jsonResponse":
          responseBody = Mustache.render(
            JSON.stringify(step.input.value),
            {
              ...context,
            },
          );
          context[contextId] = responseBody;
          break;
      }

      if (!nextStepId) {
         console.log("This is the final step, returning a result");
         break;
      }

      if (depth > maximumDepth)
        return new Response("Reached maximum depth", { status: 500 });

      step = flow.steps.find((step) => step.id === nextStepId);

      if (!step)
        return new Response(`Could not find the next step ${nextStepId}`, {
          status: 500,
        });
    } while (true);

    return new Response(responseBody, {
      status: responseCode,
      headers: responseHeaders,
    });
  }
}
