// plock.js：申请与释放之后的锁状态（不可变更新，对不上时保持原样）
export function takeOf(lock, owner) {
  if (lock.holder === "") {
    return { holder: owner, depth: 1 };
  }
  if (lock.holder === owner) {
    return { holder: lock.holder, depth: lock.depth + 1 };
  }
  return lock;
}

export function giveOf(lock, owner) {
  if (lock.holder !== owner || lock.holder === "") {
    return lock;
  }
  const depth = lock.depth - 1;
  return { holder: depth === 0 ? "" : lock.holder, depth: depth };
}
