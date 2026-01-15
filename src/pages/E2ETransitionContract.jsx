import { useState } from 'react';
import { pizzaioloTransitionOrderV2 } from '../lib/ordersApi';

export default function E2ETransitionContract() {
  const [result, setResult] = useState('idle');

  const onSend = async () => {
    try {
      setResult('pending');
      const res = await pizzaioloTransitionOrderV2({
        orderId: 'e2e-test-order',
        action: 'ACCEPT',
        expectedUpdatedAtMs: 123,
      });
      setResult(`ok:${JSON.stringify(res || {})}`);
    } catch (err) {
      setResult(`error:${err?.message || String(err)}`);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-white">
      <h1 className="text-xl font-semibold">E2E Transition Contract</h1>
      <p className="mt-2 text-sm text-white/70">
        Page de test (VITE_E2E=true). Vérifie que le payload callable contient action.
      </p>
      <button
        type="button"
        onClick={onSend}
        className="mt-4 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black"
      >
        Send ACCEPT
      </button>
      <div data-testid="e2e-result" className="mt-4 text-xs text-white/70">
        {result}
      </div>
    </div>
  );
}
