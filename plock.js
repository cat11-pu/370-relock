// plock.js：申请与释放后的锁状态（基线：一律原样返回）
export function takeOf(lock, owner) {
  return lock;
}

export function giveOf(lock, owner) {
  return lock;
}
