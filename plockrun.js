// plockrun.js：按共用处理预算处理事件，用尽则挂账，close 不限预算把账做完
import { takeOf, giveOf } from "./plock.js";

const CODES = {
  badOwner: "E_BAD_OWNER",
  held: "E_HELD",
  notOwner: "E_NOT_OWNER",
  badEvent: "E_BAD_EVENT"
};

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function cloneState(state) {
  const src = state || {};
  return {
    holder: src.holder || "",
    depth: Number(src.depth) || 0,
    log: Array.isArray(src.log) ? src.log.slice() : [],
    ledger: Array.isArray(src.ledger) ? src.ledger.slice() : [],
    applied: Array.isArray(src.applied) ? src.applied.slice() : []
  };
}

function asBudget(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

// 先校验结构，再校验名字；随后按当前持有者判定占用关系。
function validated(event, codes) {
  if (!event || typeof event !== "object"
      || (event.kind !== "take" && event.kind !== "give")) {
    fail(codes.badEvent, "事件结构不合法");
  }
  if (typeof event.owner !== "string" || event.owner.length === 0) {
    fail(codes.badOwner, "持有者名字不能为空");
  }
  return { kind: event.kind, owner: event.owner };
}

function applyEvent(state, event, codes) {
  if (event.kind === "take") {
    if (state.holder && state.holder !== event.owner) {
      fail(codes.held, "锁已被别人持有");
    }
    const next = takeOf(state, event.owner);
    state.holder = next.holder;
    state.depth = next.depth;
  } else {
    if (state.holder !== event.owner) {
      fail(codes.notOwner, "不是当前持有者不能释放");
    }
    const next = giveOf(state, event.owner);
    state.holder = next.holder;
    state.depth = next.depth;
  }
  state.log.push([event.kind, state.holder, state.depth]);
}

function codesOf(spec) {
  return {
    badOwner: (spec && spec.bad_owner_code) || CODES.badOwner,
    held: (spec && spec.held_code) || CODES.held,
    notOwner: (spec && spec.not_owner_code) || CODES.notOwner,
    badEvent: (spec && spec.event_error_code) || CODES.badEvent
  };
}

// 共用一条调度通道：旧账先做（FIFO），再按顺序做新事件。
// 每处理一条花一次预算；预算用尽后，剩下的连着压回账本（不再校验）。
function run(spec, unlimited) {
  const codes = codesOf(spec);
  const state = cloneState(spec.state);
  const events = Array.isArray(spec.events) ? spec.events : [];
  let budget = unlimited ? Number.POSITIVE_INFINITY : asBudget(spec.budget);

  const work = state.ledger.slice().map(function (token) {
    return { token: token, event: { kind: token[0], owner: token[1] } };
  });
  events.forEach(function (event) {
    work.push({ token: null, event: event });
  });
  const bound = work.length;
  state.ledger = [];

  let served = 0;
  let judged = 0;
  let exhausted = false;

  work.forEach(function (item) {
    if (exhausted) {
      state.ledger.push(item.token || [item.event && item.event.kind, item.event && item.event.owner]);
      return;
    }
    if (item.token) {
      if (state.applied.indexOf(item.token) !== -1) {
        return;
      }
    } else if (state.applied.indexOf(item.event.id) !== -1
               && item.event.id !== undefined && item.event.id !== null) {
      return;
    }
    if (!(budget > 0)) {
      exhausted = true;
      state.ledger.push(item.token || [item.event && item.event.kind, item.event && item.event.owner]);
      return;
    }
    budget -= 1;
    judged += 1;
    const clean = validated(item.event, codes);
    applyEvent(state, clean, codes);
    served += 1;
    state.applied.push(item.token !== null ? item.token : item.event.id);
  });

  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.slice(),
    judged: judged,
    judged_bound: bound
  };
}

export function step(spec) {
  return run(spec, false);
}

export function close(spec) {
  const result = run(Object.assign({}, spec, { events: [] }), true);
  // 账本条目是挂账时的事件快照；按 [动作, 名字] 对回原事件 id，
  // 让重放认得这些动作已经做过，不重复处理。
  const events = Array.isArray(spec.events) ? spec.events : [];
  const mapped = [];
  result.state.applied.forEach(function (token) {
    if (typeof token !== "object" || token === null) {
      mapped.push(token);
      return;
    }
    const hit = events.find(function (event) {
      return event && event.kind === token[0] && event.owner === token[1]
        && mapped.indexOf(event.id) === -1
        && result.state.applied.indexOf(event.id) === -1;
    });
    mapped.push(hit ? hit.id : token);
  });
  result.state.applied = mapped;
  return { state: result.state, catchup: result.served };
}
