// plockrun.js：按整批共用的处理预算处理事件，用尽后未处理的连着载压账；收尾不限预算把账做完。
import { takeOf, giveOf } from "./plock.js";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function cloneState(state) {
  state = state || {};
  return {
    holder: state.holder || "",
    depth: typeof state.depth === "number" ? state.depth : 0,
    log: Array.isArray(state.log)
      ? state.log.map(function (row) { return [row[0], row[1], row[2]]; }) : [],
    ledger: Array.isArray(state.ledger)
      ? state.ledger.map(function (row) { return [row[0], row[1]]; }) : [],
    applied: Array.isArray(state.applied) ? state.applied.slice() : []
  };
}

// 结构先验，名字空其次，两者都先于按当前持有者的判断。
function inspect(item, spec) {
  const kind = item && item.kind;
  if (kind !== "take" && kind !== "give") {
    fail(spec.event_error_code || "E_BAD_EVENT");
  }
  const owner = item.owner;
  if (typeof owner !== "string" || owner === "") {
    fail(spec.bad_owner_code || "E_BAD_OWNER");
  }
  return { kind: kind, owner: owner };
}

function run(spec, budgeted) {
  const state = cloneState(spec.state);
  const events = Array.isArray(spec.events) ? spec.events : [];
  const budget = budgeted
    ? (Number.isFinite(spec.budget) ? Math.max(0, Math.floor(spec.budget)) : 0)
    : Infinity;

  // 旧账在前、本批新事件在后；已登记（处理过或已压账）的事件重放时不再入队。
  const queue = state.ledger.map(function (row) {
    return { kind: row[0], owner: row[1], id: null };
  });
  events.forEach(function (event) {
    const id = event && Object.prototype.hasOwnProperty.call(event, "id") ? event.id : null;
    if (id !== null && state.applied.indexOf(id) !== -1) return;
    queue.push({
      kind: event ? event.kind : undefined,
      owner: event ? event.owner : undefined,
      id: id
    });
  });

  let served = 0;
  let capacity = budget;
  const ledger = [];
  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i];
    if (budgeted && capacity <= 0) {
      // 预算用尽：本条起连着载压账，入账即登记，重放不再重复处理。
      for (let j = i; j < queue.length; j += 1) {
        const parked = queue[j];
        ledger.push([parked.kind, parked.owner]);
        if (parked.id !== null && state.applied.indexOf(parked.id) === -1) {
          state.applied.push(parked.id);
        }
      }
      break;
    }
    const checked = inspect(item, spec);
    if (checked.kind === "take") {
      if (state.holder !== "" && state.holder !== checked.owner) {
        fail(spec.held_code || "E_HELD");
      }
    } else if (state.holder !== checked.owner) {
      fail(spec.not_owner_code || "E_NOT_OWNER");
    }
    const next = checked.kind === "take"
      ? takeOf({ holder: state.holder, depth: state.depth }, checked.owner)
      : giveOf({ holder: state.holder, depth: state.depth }, checked.owner);
    state.holder = next.holder;
    state.depth = next.depth;
    state.log.push([checked.kind, state.holder, state.depth]);
    if (item.id !== null && state.applied.indexOf(item.id) === -1) {
      state.applied.push(item.id);
    }
    served += 1;
    if (budgeted) capacity -= 1;
  }
  state.ledger = ledger;
  return { state: state, served: served, judged: events.length, judged_bound: events.length };
}

export function step(spec) {
  const result = run(spec, true);
  return {
    state: result.state,
    served: result.served,
    ledger_before: result.state.ledger.length,
    ledger: result.state.ledger,
    judged: result.judged,
    judged_bound: result.judged_bound
  };
}

export function close(spec) {
  const result = run(spec, false);
  return { state: result.state, catchup: result.served };
}
