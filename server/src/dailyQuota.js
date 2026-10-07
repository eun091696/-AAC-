'use strict';

/**
 * 하루 사용량 상한 (유료 API 비용 보호). 한국 시간 자정에 초기화.
 * - perKey: 한 사용자(IP)당 하루 최대
 * - total: 서버 전체 하루 최대 (키가 유출되거나 공격받아도 비용이 이 이상 안 나감)
 * 단일 프로세스 메모리 기준. 서버가 재시작되면 초기화됨.
 */
function createDailyQuota({ perKey, total }, now = () => Date.now()) {
  const kstDay = () => new Date(now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  let day = kstDay();
  let used = 0;
  const byKey = new Map();

  function roll() {
    const d = kstDay();
    if (d !== day) { day = d; used = 0; byKey.clear(); }
  }

  return {
    /** 쓸 수 있으면 1회 차감하고 { ok: true }, 아니면 { ok: false, reason } */
    tryUse(key) {
      roll();
      if (used >= total) return { ok: false, reason: 'total' };
      const n = byKey.get(key) || 0;
      if (n >= perKey) return { ok: false, reason: 'user' };
      byKey.set(key, n + 1);
      used += 1;
      return { ok: true };
    },
    stats() { roll(); return { day, used, total, users: byKey.size }; },
  };
}

module.exports = { createDailyQuota };
