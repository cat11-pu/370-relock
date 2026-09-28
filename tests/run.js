import assert from "node:assert";
import { takeOf, giveOf } from "../plock.js";
import { step, close } from "../plockrun.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { holder: "", depth: 0, log: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "take", owner: "a" }],
  bad_owner_code: "E_BAD_OWNER", held_code: "E_HELD",
  not_owner_code: "E_NOT_OWNER", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("takeOf returns a lock", () => {
  const got = takeOf({ holder: "", depth: 0 }, "a");
  assert.strictEqual(typeof got.depth, "number");
});

check("giveOf returns a lock", () => {
  const got = giveOf({ holder: "a", depth: 1 }, "a");
  assert.strictEqual(typeof got.holder, "string");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
