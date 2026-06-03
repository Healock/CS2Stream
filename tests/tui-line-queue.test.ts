import { describe, expect, test } from "vitest";
import { LineQuestionQueue } from "../src/tui/line-queue.js";

describe("line question queue", () => {
  test("returns buffered lines in order", async () => {
    const queue = new LineQuestionQueue();

    queue.pushLine("9");
    queue.pushLine("1");

    await expect(queue.question()).resolves.toBe("9");
    await expect(queue.question()).resolves.toBe("1");
  });

  test("resolves pending question when a line arrives", async () => {
    const queue = new LineQuestionQueue();
    const answer = queue.question();

    queue.pushLine("zh");

    await expect(answer).resolves.toBe("zh");
  });

  test("returns undefined when closed with no buffered input", async () => {
    const queue = new LineQuestionQueue();

    queue.close();

    await expect(queue.question()).resolves.toBeUndefined();
  });

  test("resolves pending question as undefined when closed", async () => {
    const queue = new LineQuestionQueue();
    const answer = queue.question();

    queue.close();

    await expect(answer).resolves.toBeUndefined();
  });
});
