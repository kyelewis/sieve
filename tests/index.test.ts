import { describe, expect, test } from "bun:test";
import { Flow } from "../src";

describe("flow types", () => {
  test("plainTextResponse", async () => {
    const flow = new Flow({
      flows: [
        {
          id: "default",
          steps: [
            {
              id: "replyWithHelloWorld",
              type: "plainTextResponse",
              input: {
                value: "Hello, World!",
              },
            },
          ],
        },
      ],
    });

    const request = new Request("http://site.com/");
    const response = await flow.fetch(request);
    expect(await response.text()).toBe("Hello, World!");
  });
  test("evaluateJavascript", async () => {
    const flow = new Flow({
      flows: [
        {
          id: "default",
          steps: [
            {
              id: "onePlusOne",
              type: "evaluateJavascript",
              input: {
                value: "return 1+1",
              },
              next: "returnResult",
            },
            {
              id: "returnResult",
              type: "jsonResponse",
              input: {
                value: { result: "<% onePlusOne %>" },
              },
            },
          ],
        },
      ],
    });

    const request = new Request("http://site.com/");
    const response = await flow.fetch(request);
    expect(await response.json()).toEqual({ result: "2" });
  });
  test("bearerAuth", async () => {
    const flow = new Flow({
      flows: [
        {
          id: "default",
          steps: [
            {
              id: "checkAuth",
              type: "authHeaderToken",
              input: {
                type: "Bearer",
                token: "abc123",
              },
              next: "replyWithHelloWorld",
            },
            {
              id: "replyWithHelloWorld",
              type: "plainTextResponse",
              input: {
                value: "Hello, World! Your token was <% checkAuth.token %>",
              },
            },
          ],
        },
      ],
    });

    {
      const request = new Request("http://site.com/");
      const response = await flow.fetch(request);
      expect(await response.text()).toBe("Unauthorized");
    }

    {
      const request = new Request("http://site.com/", {
        headers: { Authorization: "Bearer abc123" },
      });
      const response = await flow.fetch(request);
      expect(await response.text()).toBe("Hello, World! Your token was abc123");
    }
  });
  test("redirect", async () => {
    const flow = new Flow({
      flows: [
        {
          id: "default",
          steps: [
            {
              id: "redirectToGoogle",
              type: "redirect",
              input: {
                value: "https://google.com/",
              },
            },
          ],
        },
      ],
    });

    const request = new Request("http://site.com/");
    const response = await flow.fetch(request);
    expect(await response.headers.get("Location")).toBe("https://google.com/");
    expect(await response.status).toBe(302);
  });
});
