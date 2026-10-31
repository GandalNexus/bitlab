import { NETWORK, TEST_NETWORK } from '@scure/btc-signer';
import type { BTC_NETWORK } from '@scure/btc-signer/utils.js';

export type NetId = 'mainnet' | 'testnet3' | 'testnet4' | 'signet' | 'regtest';

export interface FaucetLink {
  name: string;
  url: string;
  desc: string;
  req: 'none' | 'captcha' | 'account';
}

export type Mineable = 'bip94' | 'local' | 'none';

export interface NetConfig {
  id: NetId;
  label: string;
  apiBase: string;
  explorer: string;
  realFunds: boolean;
  local: boolean;
  mineable: Mineable;
  addressHint: string;
  wifHint: string;
  coinType: number;
  dotCls: string;
  faucets: FaucetLink[];
  faucetNote: string;
}

export const NETWORKS: Record<NetId, NetConfig> = {
  testnet4: {
    id: 'testnet4',
    label: 'Testnet4',
    apiBase: 'https://mempool.space/testnet4/api',
    explorer: 'https://mempool.space/testnet4',
    realFunds: false,
    local: false,
    mineable: 'bip94',
    addressHint: 'tb1q… / m… / n… / 2…',
    wifHint: 'cN… / cS… (préfixe testnet 0xEF)',
    coinType: 1,
    dotCls: 'bg-emerald-500',
    faucetNote: 'Copiez l’adresse de votre portefeuille actif, collez-la sur un faucet externe ci-dessous, puis suivez la transaction dans l’explorateur.',
    faucets: [
      { name: 'mempool.space — Faucet Testnet4', url: 'https://mempool.space/testnet4/faucet', desc: 'Faucet officiel de mempool.space, 0,01 BTC par demande.', req: 'account' },
      { name: 'faucet.testnet4.dev', url: 'https://faucet.testnet4.dev/', desc: 'Faucet Testnet4 simple, 0,01 BTC par demande.', req: 'captcha' },
      { name: 'testnet4.info', url: 'https://testnet4.info/', desc: 'Faucet communautaire Testnet4.', req: 'account' },
      { name: 'CoinFaucet.eu', url: 'https://coinfaucet.eu/en/btc-testnet4/', desc: 'Faucet historique, retrait toutes les heures.', req: 'none' },
    ],
  },
  testnet3: {
    id: 'testnet3',
    label: 'Testnet3',
    apiBase: 'https://mempool.space/testnet/api',
    explorer: 'https://mempool.space/testnet',
    realFunds: false,
    local: false,
    mineable: 'none',
    addressHint: 'tb1q… / m… / n… / 2…',
    wifHint: 'cN… / cS… (préfixe testnet 0xEF)',
    coinType: 1,
    dotCls: 'bg-sky-500',
    faucetNote: 'Recevez des sats Testnet3 (sans valeur réelle) : collez votre adresse active sur un faucet externe, puis suivez la transaction dans l’explorateur.',
    faucets: [
      { name: 'CoinFaucet.eu', url: 'https://coinfaucet.eu/en/btc-testnet/', desc: 'Faucet Testnet3 historique, retrait toutes les heures.', req: 'none' },
      { name: 'bitcoinfaucet.uo1.net', url: 'https://bitcoinfaucet.uo1.net/', desc: 'Faucet Testnet3 à grande capacité, sans inscription.', req: 'none' },
    ],
  },
  signet: {
    id: 'signet',
    label: 'Signet',
    apiBase: 'https://mempool.space/signet/api',
    explorer: 'https://mempool.space/signet',
    realFunds: false,
    local: false,
    mineable: 'none',
    addressHint: 'tb1q… / m… / n… / 2…',
    wifHint: 'cN… / cS… (préfixe testnet 0xEF)',
    coinType: 1,
    dotCls: 'bg-violet-500',
    faucetNote: 'Recevez des sats Signet (sans valeur réelle) : collez votre adresse active sur un faucet externe, puis suivez la transaction dans l’explorateur.',
    faucets: [
      { name: 'signetfaucet.com', url: 'https://signetfaucet.com/', desc: 'Faucet Signet communautaire — distribution rapide de sats.', req: 'captcha' },
      { name: 'alt.signetfaucet.com', url: 'https://alt.signetfaucet.com/', desc: 'Faucet Signet alternatif en cas d’indisponibilité du premier.', req: 'captcha' },
      { name: 'Faucet Hiro (API publique)', url: 'https://docs.stacks.co/reference/api/stacks-blockchain-api/faucets', desc: 'POST api.hiro.so/extended/v3/faucets/btc — sats Signet via API (selon disponibilité).', req: 'none' },
    ],
  },
  regtest: {
    id: 'regtest',
    label: 'Regtest',
    apiBase: '',
    explorer: '',
    realFunds: false,
    local: true,
    mineable: 'local',
    addressHint: 'bcrt1q… / m… / n… / 2…',
    wifHint: 'cN… / cS… (préfixe regtest 0xEF)',
    coinType: 1,
    dotCls: 'bg-amber-500',
    faucetNote: 'Le regtest est embarqué dans BitLab : la chaîne privée tourne dans l’application — ni Docker, ni machine virtuelle, ni nœud à installer. Le faucet intégré distribue des BTC de test instantanément, et le mineur difficulty 1 fait tourner la PoW réelle dans votre navigateur.',
    faucets: [],
  },
  mainnet: {
    id: 'mainnet',
    label: 'Mainnet',
    apiBase: 'https://mempool.space/api',
    explorer: 'https://mempool.space',
    realFunds: true,
    local: false,
    mineable: 'none',
    addressHint: 'bc1q… / 1… / 3…',
    wifHint: '5H… / Kx… / L1… (préfixe mainnet 0x80)',
    coinType: 0,
    dotCls: 'bg-orange-500',
    faucetNote: '',
    faucets: [],
  },
};

export const NET_ORDER: NetId[] = ['testnet4', 'testnet3', 'signet', 'regtest', 'mainnet'];

export const DEFAULT_NET: NetId = 'testnet4';

let netGetter: (() => NetId | undefined) | null = null;
export function registerNetGetter(fn: () => NetId | undefined): void {
  netGetter = fn;
}

export function currentNet(): NetId {
  return netGetter?.() ?? DEFAULT_NET;
}

export function currentNetConfig(): NetConfig {
  return NETWORKS[currentNet()];
}

export const REGTEST_NETWORK: BTC_NETWORK = {
  bech32: 'bcrt',
  pubKeyHash: 111,
  scriptHash: 196,
  wif: 0xef,
};

export function signerNetwork(net: NetId = currentNet()): BTC_NETWORK {
  if (net === 'mainnet') return NETWORK;
  if (net === 'regtest') return REGTEST_NETWORK;
  return TEST_NETWORK;
}

export function pathForNetwork(path: string, net: NetId = currentNet()): string {
  return NETWORKS[net].coinType === 0 ? path.replace("/1'", "/0'") : path;
}
