import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAssistantContent,
  visibleQuestions,
  matchSavedQuestion,
  searchSavedQuestions,
  safeIllustrationUrl,
  starterAssistantContent,
} from "../../src/app/joko-today/assistant/content.ts";
import { contentFixture } from "./ask-joko-fixture.mjs";
test("complete translations and confirmed guidance are the only visible saved answers", () => {
  assert.equal(
    visibleQuestions(contentFixture, "th").some((q) => q.id === "en-only"),
    false,
  );
  assert.equal(
    visibleQuestions(contentFixture, "zh").some((q) => q.id === "en-only"),
    false,
  );
  assert.equal(
    visibleQuestions(contentFixture, "en").some((q) => q.id === "hidden"),
    false,
  );
  assert.deepEqual(
    visibleQuestions(contentFixture, "en", "guide").map((q) => q.id),
    ["gluten"],
  );
  assert.equal(visibleQuestions(contentFixture, "en", "live").length, 1);
});
test("aliases match deterministically, ambiguity never chooses a potentially wrong policy", () => {
  assert.equal(
    matchSavedQuestion(contentFixture, "en", " HOW TO PLACE AN ORDER ? ").id,
    "order",
  );
  assert.equal(
    matchSavedQuestion(contentFixture, "zh", "怎样下单？").id,
    "order",
  );
  assert.equal(
    matchSavedQuestion(contentFixture, "th", "สั่งยังไง").id,
    "order",
  );
  assert.equal(
    matchSavedQuestion(contentFixture, "en", "What croissants can I preorder?"),
    undefined,
  );
  const duplicate = structuredClone(contentFixture);
  duplicate.questions.push({ ...duplicate.questions[0], id: "another-policy" });
  assert.equal(
    matchSavedQuestion(duplicate, "en", "How do I order?"),
    undefined,
  );
  assert.deepEqual(
    searchSavedQuestions(contentFixture, "en", "order").map((q) => q.id),
    ["order"],
  );
});
test("invalid content and unsafe images/links cannot enter the public widget", () => {
  assert.doesNotThrow(() => parseAssistantContent(contentFixture));
  const bad = structuredClone(contentFixture);
  bad.questions[0].links[0].path = "//evil.test/tracking";
  assert.throws(() => parseAssistantContent(bad));
  bad.questions[0].links = [];
  bad.questions.push(bad.questions[0]);
  assert.throws(() => parseAssistantContent(bad));
  assert.equal(safeIllustrationUrl("javascript:alert(1)"), false);
  assert.equal(safeIllustrationUrl("https://evil.test/image.png"), false);
  assert.equal(
    safeIllustrationUrl("https://joko.today/assets/image.webp"),
    true,
  );
});
test("starter diet questions remain hidden until answered and maker-confirmed", () => {
  const content = starterAssistantContent();
  assert.doesNotThrow(() => parseAssistantContent(content));
  assert.equal(visibleQuestions(content, "en", "guide").length, 0);
  assert.equal(visibleQuestions(content, "th", "faq").length, 1);
});
