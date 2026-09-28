// plock.js：申请与释放之后的锁状态（纯转移，不改入参）
export function takeOf(lock, owner) {
  const current = lock || { holder: "", depth: 0 };
  if (current.holder && current.holder !== owner) {
    return current;
  }
  if (!current.holder) {
    return { holder: owner, depth: 1 };
  }
  return { holder: current.holder, depth: (Number(current.depth) || 0) + 1 };
}

export function giveOf(lock, owner) {
  const current = lock || { holder: "", depth: 0 };
  if (current.holder !== owner) {
    return current;
  }
  const depth = (Number(current.depth) || 0) - 1;
  if (depth <= 0) {
    return { holder: "", depth: 0 };
  }
  return { holder: current.holder, depth: depth };
}
