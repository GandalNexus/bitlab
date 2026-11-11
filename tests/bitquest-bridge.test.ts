import { describe, expect, it } from 'vitest';
import {
  buildReturnUrl,
  isValidReturnValue,
  kindToTab,
  parseBitquestMission,
  RETURN_FIELD_BY_KIND,
  type BitquestMission,
} from '../src/lib/bitquest-bridge';

const BASE = {
  questCode: 'tx-basics',
  kind: 'TX',
  network: 'testnet4',
  returnTo: 'https://bitquest.local/quests/tx-basics',
};

function params(extra: Partial<Record<string, string>> = {}) {
  return new URLSearchParams({ ...BASE, ...extra } as Record<string, string>);
}

describe('parseBitquestMission', () => {
  it('parses a minimal valid mission (no signature)', () => {
    const m = parseBitquestMission(params());
    expect(m).toEqual({
      questCode: 'tx-basics',
      kind: 'TX',
      network: 'testnet4',
      returnTo: BASE.returnTo,
      ts: null,
      sig: null,
      title: null,
      instructions: null,
    });
  });

  it('parses title + instructions quand fournis (hints I2)', () => {
    const m = parseBitquestMission(
      params({
        title: "Anatomie d'une transaction",
        instructions: "Construis un paiement de 45000 sats dans l'atelier.",
      }),
    );
    expect(m?.title).toBe("Anatomie d'une transaction");
    expect(m?.instructions).toBe("Construis un paiement de 45000 sats dans l'atelier.");
  });

  it('tronque title à 120 chars et instructions à 300 chars (défense en profondeur)', () => {
    const longTitle = 'A'.repeat(200);
    const longInstructions = 'B'.repeat(500);
    const m = parseBitquestMission(params({ title: longTitle, instructions: longInstructions }));
    expect(m?.title).toHaveLength(120);
    expect(m?.instructions).toHaveLength(300);
  });

  it('retourne title/instructions null si vides après trim', () => {
    const m = parseBitquestMission(params({ title: '   ', instructions: '' }));
    expect(m?.title).toBeNull();
    expect(m?.instructions).toBeNull();
  });

  it('strip les caractères de contrôle des hints (anti-injection affichage)', () => {
    const m = parseBitquestMission(
      params({ title: 'Mission\u0000propre\u0001', instructions: 'Instructions\u001Fnettes' }),
    );
    expect(m?.title).toBe('Missionpropre');
    expect(m?.instructions).toBe('Instructionsnettes');
  });

  it('parses ts + sig when present', () => {
    const m = parseBitquestMission(params({ ts: '1794960000', sig: 'a'.repeat(32) }));
    expect(m?.ts).toBe(1794960000);
    expect(m?.sig).toBe('a'.repeat(32));
  });

  it('rejects unknown kind', () => {
    expect(parseBitquestMission(params({ kind: 'TAPROOT' }))).toBeNull();
  });

  it('rejects unknown network (mainnet refused by policy)', () => {
    expect(parseBitquestMission(params({ network: 'mainnet' }))).toBeNull();
  });

  it('rejects non-kebab questCode', () => {
    expect(parseBitquestMission(params({ questCode: 'Tx_Basics' }))).toBeNull();
  });

  it('rejects javascript: scheme in returnTo (open-redirect guard)', () => {
    expect(parseBitquestMission(params({ returnTo: 'javascript:alert(1)' }))).toBeNull();
  });

  it('rejects malformed returnTo URL', () => {
    expect(parseBitquestMission(params({ returnTo: 'not a url' }))).toBeNull();
  });

  it('ignores ts/sig when ts is not numeric', () => {
    const m = parseBitquestMission(params({ ts: 'abc', sig: 'a'.repeat(32) }));
    expect(m?.ts).toBeNull();
  });

  it('ignores sig when too short', () => {
    const m = parseBitquestMission(params({ ts: '100', sig: 'short' }));
    expect(m?.sig).toBeNull();
  });
});

describe('isValidReturnValue', () => {
  it.each([
    ['TX', 'a'.repeat(64), true],
    ['TX', 'a'.repeat(63), false],
    ['TX', 'z'.repeat(64), false],
    ['BLOCK', 'f'.repeat(64), true],
    ['INVOICE', 'lnbc100n1p0abcdef', true],
    ['INVOICE', 'bc1qabcdef', false],
    ['CHANNEL', '859100x1234x0', true],
    ['CHANNEL', '12345678901234', true],
    ['CHANNEL', 'notascid', false],
    ['ADDRESS', 'tb1qwhatever123456', true],
    ['ADDRESS', 'x', false],
  ] as const)('%s / %s → %s', (kind, v, expected) => {
    expect(isValidReturnValue(kind, v)).toBe(expected);
  });

  it('rejects empty / whitespace', () => {
    expect(isValidReturnValue('TX', '   ')).toBe(false);
  });
});

describe('buildReturnUrl', () => {
  const mission: BitquestMission = {
    questCode: 'tx-basics',
    kind: 'TX',
    network: 'testnet4',
    returnTo: 'https://bitquest.local/q/tx-basics',
    ts: null,
    sig: null,
    title: null,
    instructions: null,
  };

  it('appends bitlab_result + kind + network + value field', () => {
    const url = new URL(buildReturnUrl(mission, 'a'.repeat(64)));
    expect(url.searchParams.get('bitlab_result')).toBe('1');
    expect(url.searchParams.get('kind')).toBe('TX');
    expect(url.searchParams.get('network')).toBe('testnet4');
    expect(url.searchParams.get(RETURN_FIELD_BY_KIND.TX)).toBe('a'.repeat(64));
    expect(url.searchParams.has('ts')).toBe(false);
    expect(url.searchParams.has('sig')).toBe(false);
  });

  it('echoes ts + sig when the sender signed the link', () => {
    const signed = { ...mission, ts: 1794960000, sig: 'z'.repeat(32) };
    const url = new URL(buildReturnUrl(signed, 'a'.repeat(64)));
    expect(url.searchParams.get('ts')).toBe('1794960000');
    expect(url.searchParams.get('sig')).toBe('z'.repeat(32));
  });

  it('uses the correct field name per kind', () => {
    const invoiceMission: BitquestMission = { ...mission, kind: 'INVOICE' };
    const url = new URL(buildReturnUrl(invoiceMission, 'lnbc100n1p0abc'));
    expect(url.searchParams.get('bolt11')).toBe('lnbc100n1p0abc');
    expect(url.searchParams.has('txid')).toBe(false);
  });
});

describe('kindToTab', () => {
  it.each([
    ['TX', 'transactions'],
    ['BLOCK', 'mineur'],
    ['INVOICE', 'lightning'],
    ['CHANNEL', 'lightning'],
    ['ADDRESS', 'portefeuille'],
  ] as const)('%s → %s', (kind, tab) => {
    expect(kindToTab(kind)).toBe(tab);
  });
});
