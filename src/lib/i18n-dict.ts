/**
 * BitLab — Dictionnaire de traduction anglaise.
 * Clé = phrase française exacte utilisée dans l'UI (apostrophes typographiques ’).
 * Valeur = traduction anglaise. Support minimal : {variables} interpolées.
 */
export const EN: Record<string, string> = {
  /* ─────────────────────────── Sidebar ─────────────────────────── */
  'Laboratoire': 'Laboratory',
  'Tableau de bord': 'Dashboard',
  'Portefeuille': 'Wallet',
  'Modules': 'Modules',
  'Transactions': 'Transactions',
  'Explorateur': 'Explorer',
  'Ressources': 'Resources',
  'Guide développeur': 'Developer guide',
  'mempool.space — explorateur': 'mempool.space — explorer',
  'Index des BIPs': 'BIP index',
  'ldk-node — référence': 'ldk-node — reference',
  'BOLT #11 — factures': 'BOLT #11 — invoices',
  'Navigation du laboratoire': 'Laboratory navigation',
  'Déplier la barre latérale': 'Expand sidebar',
  'Replier la barre latérale': 'Collapse sidebar',
  'Déplier': 'Expand',
  'Replier': 'Collapse',

  /* ─────────────────────────── Header ─────────────────────────── */
  'Ouvrir la navigation': 'Open navigation',
  'Changer de réseau Bitcoin': 'Switch Bitcoin network',
  'Sélecteur de réseau Bitcoin': 'Bitcoin network selector',
  'Réseau Bitcoin': 'Bitcoin network',
  'Fonds réels': 'Real funds',
  'Fonds réels — prudence': 'Real funds — caution',
  'Sans risque financier': 'No financial risk',
  'Données via les nœuds publics mempool.space — l’explorateur et les liens suivent le réseau choisi.':
    'Data from public mempool.space nodes — the explorer and links follow the selected network.',
  'Hauteur du dernier bloc {net}': 'Latest block height {net}',
  'bloc {n}': 'block {n}',
  'Basculer entre mode jour et mode nuit': 'Toggle between day and night mode',
  'Traduire l’interface (FR → EN)': 'Translate the interface (FR → EN)',

  /* ─────────────────────────── Dashboard ─────────────────────────── */
  'Créez. Signez. Diffusez.': 'Create. Sign. Broadcast.',
  'Créez des clés, envoyez des transactions, minez des blocs — pas à pas, Bitcoin n’aura plus de secret pour vous. Commencez par':
    'Create keys, send transactions, mine blocks — step by step, Bitcoin will hold no secrets from you. Start by',
  'créer un portefeuille,': 'creating a wallet,',
  'puis': 'then',
  'signez votre première transaction': 'sign your first transaction',
  'ou': 'or',
  'démarrez un nœud Lightning': 'start a Lightning node',
  'sur {net}.': 'on {net}.',
  'Créer mon premier portefeuille': 'Create my first wallet',
  'Gérer mes portefeuilles': 'Manage my wallets',
  'Construire une transaction': 'Build a transaction',
  'État du réseau {net}': '{net} network status',
  'Dernier bloc': 'Latest block',
  '{n} tx · miné {ago}': '{n} tx · mined {ago}',
  'Frais — prioritaire': 'Fees — priority',
  'éco : {eco} · lent : {slow}': 'eco: {eco} · slow: {slow}',
  'estimation temps réel': 'real-time estimate',
  'transactions en attente de confirmation': 'transactions awaiting confirmation',
  'file d’attente du réseau': 'network queue',
  'Votre labo': 'Your lab',
  'portefeuille(s) — clés locales': 'wallet(s) — local keys',
  'Workflow pédagogique': 'Learning workflow',
  'Générer': 'Generate',
  'Créez des clés et adresses Legacy, SegWit ou Taproot depuis le module Portefeuille.':
    'Create Legacy, SegWit or Taproot keys and addresses from the Wallet module.',
  'Construire': 'Build',
  'Sélectionnez vos UTXO, définissez sorties et frais en sat/vB dans le Constructeur.':
    'Select your UTXOs, set outputs and fees in sat/vB in the Builder.',
  'Signer': 'Sign',
  'Signature locale ECDSA/Schnorr — la clé privée ne quitte jamais le navigateur.':
    'Local ECDSA/Schnorr signing — the private key never leaves the browser.',
  'Diffuser': 'Broadcast',
  'Publiez la transaction signée sur le Testnet et suivez-la dans l’explorateur.':
    'Publish the signed transaction to the Testnet and follow it in the explorer.',

  /* ─────────────────────────── Wallet ─────────────────────────── */
  'Générez des paires de clés {net} (Legacy, SegWit, Taproot), importez une phrase BIP39 ou une clé WIF, et pilotez votre bibliothèque locale.':
    'Generate {net} key pairs (Legacy, SegWit, Taproot), import a BIP39 phrase or a WIF key, and run your local library.',
  'Importer': 'Import',
  'Mes portefeuilles': 'My wallets',
  'Créer une paire de clés {net}': 'Create a {net} key pair',
  'La clé privée est tirée d’un aléa cryptographique local, puis dérivée selon le chemin BIP du format choisi.':
    'The private key is drawn from local cryptographic randomness, then derived along the BIP path of the chosen format.',
  'Longueur mnémonique': 'Mnemonic length',
  '12 mots (128 bits)': '12 words (128 bits)',
  '24 mots (256 bits)': '24 words (256 bits)',
  'Générer le portefeuille': 'Generate wallet',
  'Aperçu du nouveau portefeuille': 'New wallet preview',
  'non enregistré': 'unsaved',
  'Enregistrer dans le lab': 'Save to the lab',
  'Annuler': 'Cancel',
  'Portefeuille généré': 'Wallet generated',
  'Adresse {tech} créée localement.': '{tech} address created locally.',
  'Erreur de génération': 'Generation error',
  'Portefeuille enregistré': 'Wallet saved',
  'Ajouté à votre bibliothèque locale (IndexedDB).': 'Added to your local library (IndexedDB).',
  'Importer des clés pour test': 'Import keys for testing',
  'Importez une phrase mnémonique BIP39 ou une clé privée WIF (format {net}).':
    'Import a BIP39 mnemonic phrase or a WIF private key ({net} format).',
  'Mnémonique BIP39': 'BIP39 mnemonic',
  'Clé privée WIF': 'WIF private key',
  'Phrase de récupération (12 ou 24 mots)': 'Recovery phrase (12 or 24 words)',
  'Chemin appliqué ({net}) :': 'Applied path ({net}):',
  '— dérivation déterministe BIP32.': '— deterministic BIP32 derivation.',
  'Format d’adresse dérivé': 'Derived address format',
  'Importer la mnémonique': 'Import mnemonic',
  'Clé privée WIF {net}': '{net} WIF private key',
  'Réseau Mainnet sélectionné : seules les clés WIF mainnet (5/K/L) sont acceptées — les fonds sont réels.':
    'Mainnet selected: only mainnet WIF keys (5/K/L) are accepted — funds are real.',
  'Les clés mainnet (5/K/L) sont rejetées — le réseau actif est {net}, sans risque financier.':
    'Mainnet keys (5/K/L) are rejected — the active network is {net}, with no financial risk.',
  'Format d’adresse correspondant': 'Matching address format',
  'Importer la clé WIF': 'Import WIF key',
  'Import réussi': 'Import successful',
  'Adresse {a} ajoutée.': 'Address {a} added.',
  'Import impossible': 'Import failed',
  'Aucun portefeuille {net}': 'No {net} wallet',
  'Générez un premier portefeuille {net} depuis l’onglet « Générer » pour commencer les expérimentations.':
    'Generate a first {net} wallet from the “Generate” tab to start experimenting.',
  '{n} portefeuille(s) existent sur d’autres réseaux — changez de réseau pour les voir.':
    '{n} wallet(s) exist on other networks — switch networks to see them.',
  'Supprimer le portefeuille': 'Delete wallet',
  'Portefeuille supprimé du lab': 'Wallet removed from the lab',
  'généré': 'generated',
  'actif': 'active',
  'Portefeuille actif': 'Active wallet',
  'Adresse': 'Address',
  'Clé publique': 'Public key',
  'Solde': 'Balance',
  'chargement…': 'loading…',
  'indisponible': 'unavailable',
  '{v} en attente': '{v} pending',
  'Type : ': 'Type: ',
  'Chemin de dérivation : ': 'Derivation path: ',
  'import WIF (sans chemin HD)': 'WIF import (no HD path)',
  'Secrets du laboratoire — ne jamais partager': 'Lab secrets — never share',
  'Masquer': 'Hide',
  'Révéler': 'Reveal',
  'Phrase mnémonique BIP39 ({n} mots)': 'BIP39 mnemonic phrase ({n} words)',
  'Clé privée (hex)': 'Private key (hex)',
  'Clé privée (WIF)': 'Private key (WIF)',
  'Masqué par défaut. Ces données restent dans votre navigateur ; aucun serveur n’y a accès.':
    'Hidden by default. This data stays in your browser; no server has access to it.',
  'Format historique Pay-to-Public-Key-Hash. Scripts les plus volumineux, frais les plus élevés.':
    'Historic Pay-to-Public-Key-Hash format. Largest scripts, highest fees.',
  'Native SegWit (bech32). Réduction d’environ 40 % des frais par rapport au Legacy.':
    'Native SegWit (bech32). Roughly 40% lower fees than Legacy.',
  'Schnorr + MAST : confidentialité des scripts et frais optimisés (bech32m).':
    'Schnorr + MAST: script privacy and optimized fees (bech32m).',

  /* ─────────────────────────── Faucet ─────────────────────────── */
  'Faucet — obtenir des BTC de test': 'Faucet — get test BTC',
  'Copiez l’adresse de votre portefeuille actif, collez-la sur un faucet externe ci-dessous, puis suivez la transaction dans l’explorateur.':
    'Copy your active wallet address, paste it into one of the external faucets below, then follow the transaction in the explorer.',
  'Recevez des sats {net} (sans valeur réelle) : collez votre adresse active sur un faucet externe, puis suivez la transaction dans l’explorateur.':
    'Receive {net} sats (no real value): paste your active address into an external faucet, then follow the transaction in the explorer.',
  'Mainnet — bitcoins réels, aucun faucet': 'Mainnet — real bitcoin, no faucet',
  'Ici, chaque satoshi a une valeur réelle : personne ne les distribue gratuitement. Pour vous entraîner sans risque, basculez sur Testnet, Signet ou Regtest depuis le sélecteur de réseau en haut à droite.':
    'Here every satoshi carries real value — nobody hands them out for free. To practice risk-free, switch to Testnet, Signet or Regtest from the network selector at the top right.',
  'Toute transaction déplace des bitcoins ayant une valeur monétaire — vérifiez chaque adresse avant diffusion.':
    'Every transaction moves bitcoin with real monetary value — double-check each address before broadcasting.',
  'Votre adresse active à financer': 'Your active address to fund',
  'Générez et sélectionnez un portefeuille {net} pour utiliser le faucet.':
    'Generate and select a {net} wallet to use the faucet.',
  'Faucets externes — copiez l’adresse ci-dessus, collez-la, recevez :':
    'External faucets — copy the address above, paste it, receive:',
  'sans compte': 'no account',
  'connexion requise': 'login required',
  'Faucet officiel de mempool.space, 0,01 BTC par demande.': 'Official mempool.space faucet, 0.01 BTC per request.',
  'Faucet Testnet4 simple, 0,01 BTC par demande.': 'Simple Testnet4 faucet, 0.01 BTC per request.',
  'Faucet communautaire Testnet4.': 'Community Testnet4 faucet.',
  'Faucet historique, retrait toutes les heures.': 'Long-standing faucet, hourly withdrawal.',
  'Faucet Testnet3 historique, retrait toutes les heures.': 'Historic Testnet3 faucet, hourly withdrawal.',
  'Faucet Testnet3 à grande capacité, sans inscription.': 'High-capacity Testnet3 faucet, no sign-up.',
  'Faucet Signet communautaire — distribution rapide de sats.': 'Community Signet faucet — fast sats delivery.',
  'Faucet Signet alternatif en cas d’indisponibilité du premier.': 'Alternative Signet faucet if the first is unavailable.',
  'POST api.hiro.so/extended/v3/faucets/btc — sats Signet via API (selon disponibilité).':
    'POST api.hiro.so/extended/v3/faucets/btc — Signet sats via API (availability may vary).',
  'cN… / cS… (préfixe testnet 0xEF)': 'cN… / cS… (testnet prefix 0xEF)',
  '5H… / Kx… / L1… (préfixe mainnet 0x80)': '5H… / Kx… / L1… (mainnet prefix 0x80)',

  /* ─────────────────────────── QR / bits ─────────────────────────── */
  'Code QR : {v}': 'QR code: {v}',
  'Génération du code QR…': 'Generating QR code…',
  'Copier dans le presse-papiers': 'Copy to clipboard',
  'il y a {n} s': '{n} s ago',
  'il y a {n} min': '{n} min ago',
  'il y a {n} h': '{n} h ago',
  'il y a {n} j': '{n} d ago',
  'Mo': 'MB',

  /* ─────────────────────────── Tx builder ─────────────────────────── */
  'Sélectionner': 'Select',
  'Constructeur de transactions': 'Transaction builder',
  'Sélection des UTXO, définition des sorties, frais en sat/vB, signature locale puis diffusion {net}.':
    'UTXO selection, output definition, sat/vB fees, local signing then broadcast on {net}.',
  'Réinitialiser': 'Reset',
  'Aucun portefeuille actif': 'No active wallet',
  'Créez un portefeuille dans le module « Portefeuille », obtenez des sats via un faucet, puis revenez construire votre transaction.':
    'Create a wallet in the “Wallet” module, get sats from a faucet, then come back to build your transaction.',
  'Portefeuille utilisé pour cette transaction': 'Wallet used for this transaction',
  'Choisir le portefeuille': 'Choose the wallet',
  'Choisir un portefeuille': 'Choose a wallet',
  ' · actif': ' · active',
  '{n} portefeuille(s) {net} disponibles — changer de portefeuille réinitialise la sélection d’UTXO.':
    '{n} {net} wallet(s) available — changing wallet resets the UTXO selection.',
  'Portefeuille sélectionné': 'Selected wallet',
  'Frais réseau actuels': 'Current network fees',
  'UTXO sélectionnés': 'Selected UTXOs',
  'UTXO disponibles (Unspent Transaction Outputs)': 'Available UTXOs (Unspent Transaction Outputs)',
  'actualisation…': 'refreshing…',
  'Aucun UTXO sur cette adresse. Alimentez-la via le faucet intégré du module Portefeuille, ou choisissez un autre portefeuille ci-dessus.':
    'No UTXOs on this address. Fund it via the faucet in the Wallet module, or choose another wallet above.',
  'Sélectionner UTXO {id}': 'Select UTXO {id}',
  'confirmé': 'confirmed',
  'en attente': 'pending',
  'hauteur {n}': 'height {n}',
  'Sorties de la transaction': 'Transaction outputs',
  '+ sortie': '+ output',
  'Adresse destinataire': 'Recipient address',
  'Montant (sats)': 'Amount (sats)',
  'Retirer cette sortie': 'Remove this output',
  'Taux de frais :': 'Fee rate:',
  'utiliser l’estimation réseau ({n})': 'use the network estimate ({n})',
  'Taux de frais en satoshis par octet virtuel': 'Fee rate in satoshis per virtual byte',
  '1 (économie)': '1 (economy)',
  '~20 (rapide)': '~20 (fast)',
  '80 (prioritaire)': '80 (priority)',
  'vsize estimé': 'estimated vsize',
  'frais estimés': 'estimated fee',
  'monnaie restante': 'change',
  'ajoutée aux frais (< 546)': 'added to fees (< 546)',
  'Adresse de monnaie restante (change)': 'Change address',
  'Le reste des UTXO moins les frais revient sur cette adresse. Laissez vide pour abandonner la monnaie aux mineurs.':
    'The UTXO remainder minus fees returns to this address. Leave empty to donate the change to miners.',
  'total entrées': 'total input',
  'Scripts avancés — construction multisig (m-de-n)': 'Advanced scripts — multisig (m-of-n)',
  'Sélectionnez les clés publiques des portefeuilles du lab pour composer un portefeuille à seuil : dépenser exige la signature de {m} participants sur {n}. L’adresse combine les clés dans un script P2WSH (Miniscript compatible BDK).':
    'Select public keys from your lab wallets to compose a threshold wallet: spending requires {m}-of-{n} signatures. The address combines the keys into a P2WSH script (BDK-compatible Miniscript).',
  'Seuil m (de {n})': 'Threshold m (of {n})',
  'Générer l’adresse {m}-de-{n}': 'Generate the {m}-of-{n} address',
  'Sélectionnez au moins 2 portefeuilles.': 'Select at least 2 wallets.',
  'Adresse multisig {m}-de-{n} (P2WSH)': 'Multisig address {m}-of-{n} (P2WSH)',
  'Script témoin (witness script)': 'Witness script',
  'Pour dépenser, chaque participant signe la transaction ; la dernière signature déclenche la finalisation du script.':
    'To spend, each participant signs the transaction; the last signature triggers script finalization.',
  'Signature locale avec la clé privée du portefeuille actif': 'Local signing with the active wallet’s private key',
  'La signature ECDSA/Schnorr est calculée dans votre navigateur. La transaction est ensuite sérialisée en hexadécimal brut (Raw Transaction) prêt pour le réseau.':
    'The ECDSA/Schnorr signature is computed in your browser. The transaction is then serialized into raw hexadecimal ready for the network.',
  'Signer {n} UTXO → {m} sortie(s)': 'Sign {n} UTXO → {m} output(s)',
  'Signature impossible': 'Signing failed',
  'Aucun portefeuille actif.': 'No active wallet.',
  'Renseignez au moins une sortie valide à l’étape Construire.': 'Provide at least one valid output in the Build step.',
  // Maturité des coinbase (sorties de minage regtest) et diagnostics du constructeur.
  'mûr dans {n} bloc(s) — non dépensable avant': 'matures in {n} block(s) — not spendable yet',
  'coinbase mûre (100 confirmations)': 'mature coinbase (100 confirmations)',
  'Adresse invalide pour {net} — format attendu : {hint}': 'Invalid address for {net} — expected format: {hint}',
  'Montant en sats entiers requis (≥ 546).': 'Amount required in whole sats (≥ 546).',
  'sorties + frais supérieurs aux entrées': 'outputs + fees exceed inputs',
  'Sortie {i} : l’adresse « {a} » n’est pas valide pour {net} — format attendu : {hint}':
    'Output {i}: the address “{a}” is not valid for {net} — expected format: {hint}',
  'Sortie {i} : adresse destinataire manquante.': 'Output {i}: missing recipient address.',
  'Sortie {i} : montant invalide (entiers en sats requis).': 'Output {i}: invalid amount (whole sats required).',
  'Adresse de sortie « {a} » invalide pour le réseau {net} — format attendu : {hint}':
    'Output address “{a}” is invalid on the {net} network — expected format: {hint}',
  'Adresse de monnaie restante « {a} » invalide pour le réseau {net} — format attendu : {hint}':
    'Change address “{a}” is invalid on the {net} network — expected format: {hint}',
  'Transaction signée': 'Transaction signed',
  'Frais : {fee} sats · vsize {v} vB': 'Fee: {fee} sats · vsize {v} vB',
  'Frais réels': 'Actual fee',
  'Taille virtuelle': 'Virtual size',
  '{r} sat/vB réel': '{r} actual sat/vB',
  'Monnaie rendue': 'Change returned',
  'pas de sortie de change': 'no change output',
  'Transaction brute signée (Raw Transaction hexadécimale)': 'Signed raw transaction (hexadecimal)',
  'Contenu décodé de la transaction ({i} entrée(s), {o} sortie(s))': 'Decoded transaction content ({i} input(s), {o} output(s))',
  'Diffusion au réseau {net}': 'Broadcast to the {net} network',
  'Seul le corps de transaction signé est envoyé au nœud via le proxy Edge — la clé privée reste locale.':
    'Only the signed transaction body is sent to the node via the Edge proxy — the private key stays local.',
  'Diffusion en cours…': 'Broadcasting…',
  'Diffuser sur {net}': 'Broadcast on {net}',
  'Transaction acceptée par le réseau': 'Transaction accepted by the network',
  'Diffusion refusée': 'Broadcast rejected',
  'Précédent': 'Back',
  'Suivant': 'Next',
  'Transaction diffusée — surveillez-la dans l’explorateur.': 'Transaction broadcast — watch it in the explorer.',
  'Nouvelle transaction': 'New transaction',
  'Transaction diffusée': 'Transaction broadcast',
  'La transaction a été modifiée depuis la dernière signature — signez à nouveau.':
    'The transaction was modified since it was last signed — sign it again.',
  'Transaction signée — prête pour la diffusion.': 'Transaction signed — ready to broadcast.',
  'Appuyez sur « Suivant » pour passer à l’étape Diffuser.': 'Press “Next” to move on to the Broadcast step.',
  'Retrouvez-la dans l’Explorateur — cliquez la transaction pour son anatomie locale.':
    'Find it in the Explorer — click the transaction for its local anatomy.',

  /* ─────────────────────────── Explorer ─────────────────────────── */
  'Transactions en attente': 'Pending transactions',
  '{v} MvB occupés': '{v} MvB used',
  'Frais totaux en attente': 'Total pending fees',
  'cumul des frais de la file d’attente': 'queue fee total',
  'Flux récent': 'Recent flow',
  'échantillon des dernières transmissions': 'sample of the latest broadcasts',
  'Dernières transactions observées (rafraîchi toutes les 15 s)': 'Latest observed transactions (refreshed every 15 s)',
  'Nœud {net} momentanément injoignable — nouvelle tentative automatique en cours.':
    '{net} node temporarily unreachable — automatic retry in progress.',
  'Derniers blocs minés': 'Latest mined blocks',
  'Mempool vide — diffusez une transaction depuis le module Transactions et elle apparaîtra ici.':
    'Empty mempool — broadcast a transaction from the Transactions module and it will appear here.',
  'Anatomie décodée localement — aucun explorateur public sur ce réseau.':
    'Anatomy decoded locally — no public explorer on this network.',
  'Bloc indisponible.': 'Block unavailable.',
  'hash du bloc': 'block hash',
  'racine de Merkle': 'Merkle root',
  'bloc précédent': 'previous block',
  'Transactions du bloc ({n})': 'Block transactions ({n})',
  'Décodeur de transaction brute': 'Raw transaction decoder',
  'Collez une transaction hexadécimale (raw tx) pour l’inspecter champ par champ : version, entrées, sorties, témoin SegWit. Le décodage s’effectue localement dans votre navigateur.':
    'Paste a hexadecimal transaction (raw tx) to inspect it field by field: version, inputs, outputs, SegWit witness. Decoding happens locally in your browser.',
  '02000000000101…  (hexadécimal de la transaction)': '02000000000101…  (transaction hexadecimal)',
  'Décoder localement': 'Decode locally',
  'Charger un exemple': 'Load a sample',
  'Transaction décodée': 'Transaction decoded',
  '{i} entrée(s) · {o} sortie(s)': '{i} input(s) · {o} output(s)',
  'Résultat du décodage': 'Decoding result',
  'Taille': 'Size',
  '{b} octets · {v} vB': '{b} bytes · {v} vB',
  'État': 'Status',
  'signée': 'signed',
  'non signée': 'unsigned',
  'Entrées ({n})': 'Inputs ({n})',
  '(coinbase ou txid absent)': '(coinbase or missing txid)',
  'witness : {n} élément(s) — {w}…': 'witness: {n} item(s) — {w}…',
  'Sorties ({n})': 'Outputs ({n})',
  'Hexadécimal analysé': 'Analyzed hexadecimal',
  'Mempool {net} en direct et décodeur de transactions brutes — champ par champ, sans quitter votre navigateur.':
    'Live {net} mempool and raw transaction decoder — field by field, without leaving your browser.',
  'Mempool live': 'Live mempool',
  'Décodeur raw': 'Raw decoder',
  'Transaction brute': 'Raw transaction',

  /* ─────────────────────────── Lightning ─────────────────────────── */
  'hors service': 'offline',
  'démarrage…': 'starting…',
  'en course': 'running',
  'opérationnel': 'ready',
  'erreur': 'error',
  'Lightning Network — nœud LDK réel': 'Lightning Network — real LDK node',
  'Deux vrais nœuds LDK (Lightning Dev Kit) tournent côté serveur, synchronisés sur la chaîne via Esplora. Canaux, factures BOLT11 et paiements HTLC sont réels — aucune simulation.':
    'Two real LDK nodes (Lightning Dev Kit) run server-side, synced to the chain via Esplora. Channels, BOLT11 invoices and HTLC payments are real — no simulation.',
  'Lightning indisponible sur {net}': 'Lightning unavailable on {net}',
  'Le moteur LDK réel embarqué dans BitLab supporte Testnet3 et Signet.': 'The real LDK engine built into BitLab supports Testnet3 and Signet.',
  'Le mainnet est volontairement exclu du laboratoire pour éviter tout risque financier.':
    'Mainnet is deliberately excluded from the lab to avoid any financial risk.',
  'Basculez de réseau via le sélecteur en haut à droite.': 'Switch networks with the selector at the top right.',
  'Passer sur Testnet3': 'Switch to Testnet3',
  'Passer sur Signet': 'Switch to Signet',
  'en ligne': 'online',
  'Nœud {alias}': 'Node {alias}',
  'Rafraîchir': 'Refresh',
  ' · bloc {n}': ' · block {n}',
  'Échec': 'Failed',
  'on-chain dépensable': 'on-chain spendable',
  'solde Lightning': 'Lightning balance',
  'Nouvelle adresse': 'New address',
  'canal prêt': 'channel ready',
  'canal en attente de confirmations': 'channel awaiting confirmations',
  'canal fermé': 'channel closed',
  'paiement reçu': 'payment received',
  'paiement réglé': 'payment settled',
  'paiement échoué': 'payment failed',
  'paiement réclamable': 'payment claimable',
  'paiement routé': 'payment forwarded',
  'erreur de boucle': 'loop error',
  'réglé': 'settled',
  'en cours': 'in progress',
  'échoué': 'failed',
  'Ouvrir un canal réel': 'Open a real channel',
  'Le financement est une vraie transaction on-chain signée par le nœud A. Laissez le pair vide pour ouvrir vers BitLab-B (le second nœud du laboratoire, joignable en localhost).':
    'Funding is a real on-chain transaction signed by node A. Leave the peer empty to open towards BitLab-B (the lab’s second node, reachable on localhost).',
  'Clé publique du pair (vide = BitLab-B)': 'Peer public key (empty = BitLab-B)',
  'Adresse pair (host:port)': 'Peer address (host:port)',
  'Capacité (sats)': 'Capacity (sats)',
  'Poussé au pair (sats — liquidité entrante)': 'Pushed to peer (sats — inbound liquidity)',
  'Canal annoncé publiquement': 'Publicly announced channel',
  'Financer et ouvrir': 'Fund and open',
  'Le nœud A doit être opérationnel.': 'Node A must be ready.',
  'Connexion P2P établie': 'P2P connection established',
  'Poignée de main Noise réelle entre les deux nœuds du laboratoire.': 'Real Noise handshake between the two lab nodes.',
  'Connexion impossible': 'Connection failed',
  'Capacité insuffisante': 'Insufficient capacity',
  'Un canal Lightning exige au moins 20 000 sats.': 'A Lightning channel requires at least 20,000 sats.',
  'Push invalide': 'Invalid push',
  'Le montant poussé au pair doit être compris entre 0 et la capacité.': 'The pushed amount must be between 0 and the capacity.',
  'Pair incomplet': 'Incomplete peer',
  'Renseignez la clé publique et l’adresse du pair (ou laissez vide pour BitLab-B).':
    'Provide the peer’s public key and address (or leave empty for BitLab-B).',
  'Transaction de financement diffusée': 'Funding transaction broadcast',
  'Le canal sera prêt après les confirmations on-chain (suivi réel par le nœud).':
    'The channel will be ready after on-chain confirmations (tracked by the node).',
  'Ouverture impossible': 'Cannot open channel',
  'Fermeture forcée': 'Force close',
  'Fermeture coopérative': 'Cooperative close',
  'Transaction de clôture réelle — suivez-la dans l’explorateur.': 'Real closing transaction — follow it in the explorer.',
  'Échec de fermeture': 'Close failed',
  'Pair local BitLab-B : {s}': 'Local peer BitLab-B: {s}',
  'connecté (handshake réel)': 'connected (real handshake)',
  'non connecté': 'not connected',
  'Aucun canal. Financez le nœud A via son adresse on-chain (faucet), puis ouvrez un canal.':
    'No channels. Fund node A via its on-chain address (faucet), then open a channel.',
  'prêt': 'ready',
  'en financement': 'funding',
  ' · {c}/{r} conf.': ' · {c}/{r} conf.',
  'sortant {n}': 'out {n}',
  'entrant {n}': 'in {n}',
  'financement {h}': 'funding {h}',
  'Fermer': 'Close',
  'Créer une facture BOLT11 réelle': 'Create a real BOLT11 invoice',
  'La facture est signée par la clé du nœud A (schnorr/secp256k1 via LDK). Un portefeuille testnet disposant d’un canal vers ce nœud pourrait la payer réellement.':
    'The invoice is signed by node A’s key (schnorr/secp256k1 via LDK). A testnet wallet with a channel to this node could actually pay it.',
  'Mémo (description)': 'Memo (description)',
  'Café au bureau, mission BitQuest…': 'Office coffee, BitQuest mission…',
  'Générer la facture': 'Generate invoice',
  'Montant invalide': 'Invalid amount',
  'Indiquez un montant en sats entre 1 et 4 294 967.': 'Enter an amount in sats between 1 and 4,294,967.',
  'Facture BOLT11 signée': 'Signed BOLT11 invoice',
  'Facture réelle émise par le nœud — valide 1 heure.': 'Real invoice issued by the node — valid for 1 hour.',
  'Facture BitLab': 'BitLab invoice',
  'hash de paiement : {h}': 'payment hash: {h}',
  'Décoder une facture (analyseur LDK réel)': 'Decode an invoice (real LDK parser)',
  'Collez une facture BOLT11 de testnet3 pour la décoder — signature, hash, expiration vérifiés par LDK.':
    'Paste a testnet3 BOLT11 invoice to decode it — signature, hash and expiry verified by LDK.',
  'Décoder': 'Decode',
  'Payer une facture BOLT11': 'Pay a BOLT11 invoice',
  'Pathfinding réel par LDK (graph RGS/P2P + canaux locaux). Sans liquidité ou sans route vers le destinataire, le paiement échoue — l’erreur exacte du réseau est affichée.':
    'Real LDK pathfinding (RGS/P2P graph + local channels). Without liquidity or a route to the recipient, the payment fails — the exact network error is shown.',
  'Facture invalide': 'Invalid invoice',
  'Une facture BOLT11 testnet commence par « lntb ».': 'A testnet BOLT11 invoice starts with “lntb”.',
  'Paiement HTLC envoyé': 'HTLC payment sent',
  'Montant {n} sats — le règlement final dépend du routage réel du réseau.':
    'Amount {n} sats — final settlement depends on real network routing.',
  'Paiement refusé': 'Payment rejected',
  'Payer': 'Pay',
  'Aucun paiement. Les règlements réels (entrants et sortants) apparaîtront ici.':
    'No payments yet. Real settlements (in and out) will appear here.',
  'Paiement sortant': 'Outgoing payment',
  'Paiement entrant': 'Incoming payment',
  'frais {n} sats': 'fee {n} sats',
  'Réseau Lightning mondial': 'Global Lightning network',
  'Données réelles de mempool.space (exploration du mainnet).': 'Real data from mempool.space (mainnet exploration).',
  'nœuds': 'nodes',
  'canaux': 'channels',
  'capacité totale': 'total capacity',
  'réseau non supporté': 'unsupported network',

  /* ─────────────────────────── Footer / page ─────────────────────────── */
  '{net} · clés 100 % locales': '{net} · 100% local keys',

  /* ─────────────────────────── Guide docs ─────────────────────────── */
  'Guide du développeur': 'Developer guide',
  'Ouvrir le laboratoire': 'Open the lab',
  'Documentation officielle du laboratoire': 'Official lab documentation',
  'Le guide du développeur Bitcoin & Lightning': 'The Bitcoin & Lightning developer guide',
  'Clés et adresses, construction de transactions, multi-réseaux, nœuds LDK réels et API du laboratoire — tout ce que BitLab exécute, expliqué au niveau du protocole.':
    'Keys and addresses, transaction building, multi-network, real LDK nodes and the lab API — everything BitLab runs, explained at the protocol level.',
  'Sur cette page': 'On this page',
  'Retour au laboratoire': 'Back to the lab',
  'Sections du guide': 'Guide sections',
  'Démarrer': 'Getting started',
  'Clés & adresses': 'Keys & addresses',
  'Réseaux & connectivité': 'Networks & connectivity',
  'Lightning — LDK réel': 'Lightning — real LDK',
  'API du laboratoire': 'Lab API',
  'Bonnes pratiques': 'Best practices',
  'BitLab est un laboratoire Bitcoin et Lightning où l’on apprend en manipulant les vraies primitives du protocole. La cryptographie — génération de clés, construction et signature des transactions — s’exécute intégralement dans votre navigateur, avec des bibliothèques auditées et les règles de consensus exactes du réseau. Les données publiques (blocs, soldes, frais) proviennent de nœuds Esplora publics, et deux véritables nœuds Lightning LDK compilés en WebAssembly s’exécutent dans votre navigateur. Rien n’est maquetté : ce qui s’affiche à l’écran s’est réellement produit sur un réseau Bitcoin.':
    'BitLab is a Bitcoin and Lightning laboratory where you learn by manipulating the real primitives of the protocol. Cryptography — key generation, transaction building and signing — runs entirely in your browser, with audited libraries and the exact consensus rules of the network. Public data (blocks, balances, fees) comes from public Esplora nodes, and two genuine Lightning LDK nodes compiled to WebAssembly run inside your browser. Nothing is mocked: what appears on screen actually happened on a Bitcoin network.',
  'Le projet suit le principe': 'The project follows the',
  'Zero-Knowledge': 'Zero-Knowledge',
  ' : les clés privées, phrases mnémoniques et clés WIF sont générées puis conservées exclusivement dans le stockage local de votre navigateur. Le serveur n’agit que comme un proxy de données publiques — il ne détient aucun secret utilisateur, n’héberge aucun nœud Lightning, et ne peut ni lire ni déplacer vos fonds.':
    ' principle: private keys, mnemonic phrases and WIF keys are generated then kept exclusively in your browser’s local storage. The server only acts as a public-data proxy — it holds no user secret, hosts no Lightning node, and can neither read nor move your funds.',
  'Le parcours recommandé': 'The recommended path',
  'Créez une graine BIP39 puis des adresses Legacy, SegWit ou Taproot depuis le module Portefeuille ; importez aussi une clé WIF ou une phrase existante.':
    'Create a BIP39 seed then Legacy, SegWit or Taproot addresses from the Wallet module; also import a WIF key or an existing phrase.',
  'Obtenir des sats de test': 'Get test sats',
  'Créditez votre adresse depuis un faucet externe du réseau actif — les liens vérifiés sont fournis dans le module Portefeuille.':
    'Fund your address from an external faucet of the active network — verified links are provided in the Wallet module.',
  'Sélectionnez vos UTXO, composez les sorties, ajustez les frais en sat/vB, signez localement (ECDSA ou Schnorr) puis diffusez sur le réseau.':
    'Select your UTXOs, compose the outputs, adjust fees in sat/vB, sign locally (ECDSA or Schnorr) then broadcast to the network.',
  'Observer dans l’explorateur': 'Watch in the explorer',
  'Suivez les confirmations de vos transactions et décodez des transactions brutes hexadécimales pour comprendre leur anatomie.':
    'Follow your transactions’ confirmations and decode raw hexadecimal transactions to understand their anatomy.',
  'Expérimenter Lightning': 'Experiment with Lightning',
  'Activez le lab Lightning : les deux nœuds LDK réels démarrent dans votre navigateur ; ouvrez un canal financé on-chain, émettez et payez des factures BOLT11 ou des offers BOLT12 instantanément.':
    'Switch the Lightning lab on: the two real LDK nodes start inside your browser; open an on-chain funded channel, then issue and pay BOLT11 invoices or BOLT12 offers instantly.',
  'Offers BOLT12': 'BOLT12 offers',
  'L’onglet Paiements sépare volontairement les deux protocoles pour éviter toute confusion. Une offer BOLT12 (lno1…) est un code de paiement réutilisable : A demande une facture au nœud B via messages onion chiffrés, B répond par une vraie facture BOLT12 portant un chemin de paiement aveuglé, puis le HTLC part sur le canal. Montant facultatif (paiement libre possible), note au payeur, décodeur intégré — le flux BOLT12 complet tourne réellement dans votre navigateur.':
    'The payments tab deliberately separates the two protocols to avoid any confusion. A BOLT12 offer (lno1…) is a reusable payment code: A requests an invoice from node B over encrypted onion messages, B answers with a real BOLT12 invoice carrying a blinded payment path, then the HTLC leaves over the channel. Optional amount (free-amount payments possible), payer note, built-in decoder — the complete BOLT12 flow genuinely runs in your browser.',
  'Le lab démarre sur': 'The lab starts on',
  '(sats sans valeur). Le Lightning réel supporte Testnet4, Testnet3 et Signet. Le mainnet reste accessible pour l’exploration mais y est volontairement verrouillé côté financement.':
    '(valueless sats). Real Lightning supports Testnet4, Testnet3 and Signet. Mainnet remains accessible for exploration but funding is deliberately locked there.',
  'Chaque portefeuille naît d’une entropie locale transformée en phrase mnémonique BIP39 (12 ou 24 mots). La graine dérivée alimente une arborescence BIP32 dont chaque branche correspond à un standard d’adresse : BIP44 pour les Legacy P2PKH, BIP84 pour les SegWit P2WPKH et BIP86 pour les Taproot P2TR. BitLab s’appuie sur les bibliothèques auditées':
    'Every wallet is born from local entropy turned into a BIP39 mnemonic phrase (12 or 24 words). The derived seed feeds a BIP32 tree whose branches map to address standards: BIP44 for Legacy P2PKH, BIP84 for SegWit P2WPKH and BIP86 for Taproot P2TR. BitLab relies on the audited libraries',
  '— les mêmes primitives que de nombreux portefeuilles en production.': '— the same primitives as many production wallets.',
  'Type': 'Type',
  'Chemin de dérivation': 'Derivation path',
  'Script': 'Script',
  'Préfixe exemple': 'Example prefix',
  'Le': 'The',
  'suit le réseau :': 'follows the network:',
  'pour le mainnet,': 'for mainnet,',
  'pour tous les réseaux de test. Cette cloison garantit l’étanchéité des portefeuilles entre réseaux — aucun portefeuille de test ne peut être manipulé sur mainnet, et inversement. Les adresses sont encodées en base58check ou bech32/bech32m selon le format, avec le préfixe humain propre au réseau.':
    'for all test networks. This partition guarantees wallet isolation across networks — no test wallet can be used on mainnet, and vice versa. Addresses are encoded in base58check or bech32/bech32m depending on the format, with the human-readable prefix of the network.',
  'Importer une clé existante': 'Importing an existing key',
  'Une clé privée importée en WIF (Wallet Import Format) est décodée puis re-dérivée dans les trois formats, comme si elle venait d’être générée. BitLab vérifie le préfixe réseau (0x80 pour le mainnet, 0xEF pour les testnets) et refuse toute clé appartenant à un autre réseau que le réseau actif. L’import par phrase BIP39 applique le chemin de dérivation correspondant au format choisi, affiché en clair avant validation.':
    'A private key imported in WIF (Wallet Import Format) is decoded then re-derived in all three formats, as if it had just been generated. BitLab checks the network prefix (0x80 for mainnet, 0xEF for testnets) and rejects any key belonging to a network other than the active one. BIP39 phrase import applies the derivation path of the chosen format, displayed in clear before validation.',
  'Sur mainnet, les adresses deviennent': 'On mainnet, addresses become',
  'et les clés WIF commencent par': 'and WIF keys start with',
  '. Toute transaction y engage des fonds réels — le module Portefeuille affiche un avertissement permanent et le financement automatique est désactivé.':
    '. Every transaction there commits real funds — the Wallet module shows a permanent warning and automatic funding is disabled.',
  'Bitcoin fonctionne en modèle UTXO (Unspent Transaction Outputs) : une transaction consomme des sorties non dépensées comme entrées et produit de nouvelles sorties. La différence entre le total des entrées et le total des sorties — moins ce que l’on rend à soi-même en monnaie (change) — constitue les frais perçus par le mineur. Le constructeur de BitLab expose ce modèle sans abstraction : vous choisissez précisément quels UTXO dépenser, à qui envoyer quoi, et à quel prix vous voulez que le réseau traite votre transaction.':
    'Bitcoin runs on the UTXO model (Unspent Transaction Outputs): a transaction consumes unspent outputs as inputs and produces new outputs. The difference between total inputs and total outputs — minus what you return to yourself as change — is the fee collected by the miner. BitLab’s builder exposes this model without abstraction: you choose precisely which UTXOs to spend, who receives what, and at what price you want the network to process your transaction.',
  'Le flux complet en quatre étapes': 'The complete flow in four steps',
  'Récupération des UTXO de l’adresse active via Esplora. Les sorties confirmées et en attente sont distinguées ; vous cochez celles qui financeront la transaction.':
    'The active address’s UTXOs are fetched via Esplora. Confirmed and pending outputs are distinguished; you check the ones that will fund the transaction.',
  'Assemblage des entrées et sorties, ajout du change automatique lorsque le reliquat dépasse la limite de poussière (546 sats), estimation de la taille virtuelle en direct.':
    'Assembly of inputs and outputs, automatic change when the remainder exceeds the dust limit (546 sats), live virtual size estimation.',
  'Signature locale : ECDSA pour Legacy et SegWit, Schnorr et tweak Taproot (BIP86) pour P2TR. La clé privée ne quitte jamais le navigateur.':
    'Local signing: ECDSA for Legacy and SegWit, Schnorr and Taproot tweak (BIP86) for P2TR. The private key never leaves the browser.',
  'Publication de l’hexadécimal signé vers le nœud du réseau actif via le proxy, puis suivi des confirmations dans l’explorateur intégré.':
    'The signed hexadecimal is published to the active network’s node via the proxy, then confirmations are tracked in the built-in explorer.',
  'Tailles et frais': 'Sizes and fees',
  'Les frais s’expriment en': 'Fees are expressed in',
  '(satoshis par octet virtuel) et les recommandations en temps réel (économie, rapide, prioritaire) proviennent de l’estimation mempool.space. Plus les entrées sont anciennes au format, plus la transaction est lourde : c’est pourquoi le choix du format d’adresse influence directement le coût d’usage.':
    '(satoshis per virtual byte) and real-time recommendations (economy, fast, priority) come from mempool.space estimation. The older the input format, the heavier the transaction: that is why the address format directly influences usage cost.',
  'Format d’entrée': 'Input format',
  'Poids approximatif': 'Approximate weight',
  'Usage': 'Use',
  '~148 vB par entrée': '~148 vB per input',
  '~68 vB par entrée': '~68 vB per input',
  '~57 vB par entrée': '~57 vB per input',
  'démonstrations pédagogiques': 'teaching demos',
  'standard actuel': 'current standard',
  'le plus économique': 'the most economical',
  'Le constructeur embarque une composition multisig m-de-n : sélectionnez plusieurs clés publiques de votre bibliothèque, BitLab dérive l’adresse P2WSH correspondante et son script témoin — la dépense exigera la signature de m participants sur n.':
    'The builder includes m-of-n multisig composition: select several public keys from your library, BitLab derives the matching P2WSH address and its witness script — spending will require m-of-n signatures.',
  'BitLab est multi-réseaux : le sélecteur en haut à droite bascule l’intégralité des modules — portefeuilles, constructeur, explorateur et Lightning. Toutes les données on-chain transitent par un proxy Edge unique':
    'BitLab is multi-network: the selector at the top right switches all modules — wallets, builder, explorer and Lightning. All on-chain data flows through a single Edge proxy,',
  'qui applique une liste blanche stricte de chemins (protection anti-injection), un cache mémoire de 60 secondes par réseau, et relaie vers l’API Esplora publique correspondante. Aucune donnée utilisateur ne transite par ce canal : uniquement des informations publiques de la blockchain.':
    'which applies a strict path allow-list (anti-injection protection), a 60-second in-memory cache per network, and relays to the corresponding public Esplora API. No user data flows through this channel: only public blockchain information.',
  'Réseau': 'Network',
  'API Esplora': 'Esplora API',
  'Rôle au laboratoire': 'Role in the lab',
  'exploration seule — fonds réels': 'exploration only — real funds',
  'réseau on-chain par défaut du lab': 'the lab’s default on-chain network',
  'on-chain + Lightning LDK réel': 'on-chain + real Lightning LDK',
  'S’approvisionner en sats de test': 'Getting test sats',
  'Chaque réseau de test expose ses faucets dans le module Portefeuille — avec une mention honnête de ce qu’ils exigent (aucun compte, captcha, ou connexion). Copiez votre adresse active, demandez des sats, puis observez la transaction apparaître dans votre solde — le laboratoire rafraîchit automatiquement les soldes via Esplora.':
    'Each test network lists its faucets in the Wallet module — with an honest note of what they require (no account, captcha, or login). Copy your active address, request sats, then watch the transaction appear in your balance — the lab refreshes balances automatically via Esplora.',
  'Étanchéité réseau': 'Network isolation',
  'Les portefeuilles sont étiquetés par réseau à la création. Le sélecteur n’affiche que les portefeuilles du réseau actif — un import mainnet en testnet est refusé, et une signature croisée entre réseaux est structurellement impossible.':
    'Wallets are labeled per network at creation. The selector only shows wallets of the active network — a mainnet import on testnet is rejected, and cross-network signing is structurally impossible.',
  'Le module Lightning n’est': 'The Lightning module is',
  'pas une simulation': 'not a simulation',
  ' : BitLab exécute deux nœuds':
    ': BitLab runs two',
  '— le cœur Rust du Lightning Dev Kit, compilé en WebAssembly depuis rust/lnlab et piloté par un Web Worker dans votre navigateur. Ils se synchronisent sur la chaîne via le proxy Esplora et dialoguent par le protocole Lightning authentique (poignée de main Noise, messages BOLT) sur une paire de sockets en mémoire. Chaque nœud possède sa propre graine conservée exclusivement dans votre IndexedDB, ses canaux et son historique de paiements.':
    '— the Rust core of the Lightning Dev Kit, compiled to WebAssembly from rust/lnlab and driven by a Web Worker inside your browser. They sync to the chain through the Esplora proxy and speak the authentic Lightning protocol (Noise handshake, BOLT messages) over an in-memory socket pair. Each node owns a seed kept exclusively in your IndexedDB, its channels and its payment history.',
  'Cycle de vie d’un canal': 'Channel lifecycle',
  'les nœuds se reconstruisent depuis leur graine, se resynchronisent (blocs, frais) puis passent à l’état « opérationnel ».':
    'the nodes rebuild from their seed, re-sync (blocks, fees) then reach the “ready” state.',
  'l’ouverture génère une adresse de financement P2WSH ; créditez-la depuis l’un de vos portefeuilles BitLab — la transaction est construite et signée localement, puis diffusée via le proxy.':
    'opening generates a P2WSH funding address; fund it from any of your BitLab wallets — the transaction is built and signed locally, then broadcast through the proxy.',
  'A et B sont reliés par une paire de sockets en mémoire : chaque octet échangé est du vrai protocole (handshake Noise authentique), mais rien ne quitte votre machine.':
    'A and B are linked by an in-memory socket pair: every exchanged byte is real protocol data (authentic Noise handshake), but nothing leaves your machine.',
  'la transaction de financement 2-de-2 est signée par les deux parties et diffusée ; le canal passe « en financement » puis « prêt » après confirmations.':
    'the 2-of-2 funding transaction is signed by both parties and broadcast; the channel goes “funding” then “ready” after confirmations.',
  'le payeur signe un HTLC vers la facture BOLT11 émise par le bénéficiaire ; le règlement met à jour les soldes locaux sans écriture on-chain.':
    'the payer signs an HTLC towards the BOLT11 invoice issued by the payee; settlement updates local balances with no on-chain write.',
  'clôture coopérative (une transaction consensuelle) ou forcée (diffusion d’un ancien état, assortie d’une pénalité).':
    'cooperative close (a consensual transaction) or force close (broadcast of a revoked state, with a penalty).',
  'Les factures émises par les nœuds sont réellement signées par leur clé Lightning et encodées au format BOLT11 : copiez le QR ou la chaîne lntb/lntbs et payez-la depuis n’importe quel portefeuille du réseau correspondant. Montant, hash de paiement, secret et expiration sont générés et vérifiés par le nœud lui-même.':
    'Invoices issued by the nodes are genuinely signed by their Lightning key and encoded in BOLT11: copy the QR or the lntb/lntbs string and pay it from any wallet of the corresponding network. Amount, payment hash, secret and expiry are generated and verified by the node itself.',
  'Liquidité et honnêteté des erreurs': 'Liquidity and error honesty',
  'À l’ouverture d’un canal, le champ « poussé au pair » transfère immédiatement de la liquidité à la contrepartie : en ouvrant A vers B avec 100 000 sats de capacité dont 40 000 poussés, B dispose d’un solde Lightning réel de 40 000 sats et peut émettre des factures que A paie instantanément. Le routage est un saut direct entre A et B — correct par construction pour un lab à deux nœuds — : sans liquidité suffisante, le paiement échoue et':
    'When opening a channel, the “pushed to peer” field immediately transfers liquidity to the counterparty: opening A to B with 100,000 sats of capacity of which 40,000 pushed gives B a real Lightning balance of 40,000 sats, able to issue invoices that A pays instantly. Routing is a direct hop between A and B — correct by construction for a two-node lab —: with insufficient liquidity, the payment fails and',
  'l’erreur exacte du réseau est affichée': 'the exact network error is shown',
  '— jamais masquée, jamais simulée. C’est précisément ce comportement qu’un développeur Lightning doit apprendre à lire.':
    '— never hidden, never simulated. This is precisely the behavior a Lightning developer must learn to read.',
  'Pourquoi deux nœuds ?': 'Why two nodes?',
  'Lightning n’a de sens qu’entre pairs. Le lab embarque A et B pour réaliser un cycle complet (canal, facture, paiement, clôture) sans aucune dépendance externe ni serveur : tout tient dans votre navigateur.':
    'Lightning only makes sense between peers. The lab ships A and B to complete a full cycle (channel, invoice, payment, close) with no external dependency and no server: everything lives in your browser.',
  'Un unique proxy serveur alimente l’interface. Il n’expose aucune donnée sensible, filtre strictement les chemins autorisés, ajoute un cache court par réseau et relaie aussi les blocs bruts dont le lab Lightning se nourrit. Le module Lightning lui-même ne passe plus par le serveur : il vit dans votre navigateur.':
    'A single server proxy powers the interface. It exposes no sensitive data, strictly filters allowed paths, adds a short per-network cache and also relays the raw blocks the Lightning lab feeds on. The Lightning module itself no longer goes through the server: it lives in your browser.',
  ' — proxy Esplora multi-réseaux': ' — multi-network Esplora proxy',
  'Endpoint': 'Endpoint',
  'Description': 'Description',
  'recommandations de frais (économie → prioritaire)': 'fee recommendations (economy → priority)',
  'hauteur du dernier bloc': 'latest block height',
  'UTXO dépensables d’une adresse': 'spendable UTXOs of an address',
  'détails et confirmations d’une transaction': 'transaction details and confirmations',
  'statistiques mondiales Lightning (mainnet)': 'global Lightning statistics (mainnet)',
  'diffusion d’une transaction signée (hexadécimal)': 'broadcast of a signed transaction (hex)',
  ' — Web Worker + WebAssembly': ' — Web Worker + WebAssembly',
  'Aucun endpoint HTTP : les deux nœuds tournent dans un Web Worker (public/lnlab/worker.js) qui charge le module WASM au premier démarrage. Les graines, monitors de canal et historiques restent dans l’IndexedDB du site, et seules les données publiques (blocs, frais, diffusion) transitent par /api/bitcoin. Le serveur n’héberge plus aucun nœud.':
    'No HTTP endpoint: the two nodes run in a Web Worker (public/lnlab/worker.js) that loads the WASM module on first start. Seeds, channel monitors and history stay in the site’s IndexedDB, and only public data (blocks, fees, broadcast) flows through /api/bitcoin. The server no longer hosts any node.',
  'hauteur du bloc n (flux du lab Lightning)': 'height of block n (Lightning lab feed)',
  'bloc brut binaire (flux du lab Lightning)': 'raw binary block (Lightning lab feed)',
  'Clés locales uniquement': 'Local keys only',
  'la signature s’exécute dans le navigateur ; aucun octet de clé privée ne transite par le réseau, ni vers BitLab ni vers un tiers.':
    'signing runs in the browser; not a single byte of private key travels the network, neither to BitLab nor to any third party.',
  'Stockage local': 'Local storage',
  'portefeuilles et préférences vivent dans IndexedDB sur votre appareil ; effacez les données du site pour repartir de zéro.':
    'wallets and preferences live in IndexedDB on your device; clear the site’s data to start from scratch.',
  'Graines Lightning locales': 'Local Lightning seeds',
  'les nœuds LDK détiennent leurs propres graines (IndexedDB du site, jamais transmises au serveur) : n’y financez que des montants de test.':
    'the LDK nodes hold their own seeds (site IndexedDB, never transmitted to the server): only fund them with test amounts.',
  'Mainnet = danger': 'Mainnet = danger',
  'sur mainnet, frais, montants et destinataires sont irrévocables ; le lab verrouille tout financement mainnet par conception.':
    'on mainnet, fees, amounts and recipients are irrevocable; the lab locks all mainnet funding by design.',
  'Vérifiez toujours': 'Always verify',
  'adresse de réception complète, montant en sats, réseau actif dans le sélecteur : trois réflexes avant toute diffusion.':
    'full recipient address, amount in sats, active network in the selector: three reflexes before any broadcast.',
  'Transparence des erreurs': 'Error transparency',
  'chaque écran reflète l’état réel : une erreur Lightning (route absente, pair injoignable, fonds insuffisants) est affichée telle quelle.':
    'every screen reflects the real state: a Lightning error (missing route, unreachable peer, insufficient funds) is shown as-is.',
  'Environnement restreint': 'Restricted environment',
  'Le lab Lightning s’exécute entièrement dans votre navigateur : aucun port sortant n’est nécessaire, et seul le proxy Esplora de l’application a besoin d’un accès Internet. Il fonctionne donc derrière les pare-feux les plus restrictifs.':
    'The Lightning lab runs entirely in your browser: no outgoing ports are required, and only the application’s Esplora proxy needs Internet access. It therefore works behind the most restrictive firewalls.',
  'Références officielles': 'Official references',
  'BOLT #11 (factures)': 'BOLT #11 (invoices)',
  'BitLab — pilier du projet GandalNexus · « Vires in Numeris ». Les données publiques proviennent des nœuds mempool.space ; les nœuds Lightning tournent dans le navigateur via LDK (Lightning Dev Kit).':
    'BitLab — cornerstone of the GandalNexus project · “Vires in Numeris”. Public data comes from mempool.space nodes; the Lightning nodes run in the browser via LDK (Lightning Dev Kit).',

  /* ─────────────────────────── docs-art (SVG) ─────────────────────────── */
  'Du navigateur au réseau Bitcoin': 'From the browser to the Bitcoin network',
  'Dérivation hiérarchique des clés': 'Hierarchical key derivation',
  'Modèle UTXO d’une transaction': 'UTXO model of a transaction',
  'Multi-réseaux via un proxy unique': 'Multi-network via a single proxy',
  'Canal Lightning entre deux nœuds réels': 'Lightning channel between two real nodes',
  'Architecture API du laboratoire': 'Lab API architecture',
  'Les clés restent dans le navigateur': 'Keys stay in the browser',
  '1 · clés & adresses': '1 · keys & addresses',
  'entrées (UTXO)': 'inputs (UTXOs)',
  'différence = frais du mineur': 'difference = miner fee',
  'Chaque satoshi suit une chaîne de propriété vérifiable': 'Every satoshi follows a verifiable chain of ownership',
  'Un sélecteur, quatre réseaux, mêmes primitives': 'One selector, four networks, same primitives',
  'liquidité sortante': 'outbound liquidity',
  'liquidité entrante': 'inbound liquidity',
  'Paiements instantanés, routage par gossip, règlement sans écriture on-chain':
    'Instant payments, gossip-based routing, settlement without on-chain writes',
  'nœuds réels · factures · canaux': 'real nodes · invoices · channels',
  'Un proxy strict, zéro donnée sensible exposée': 'One strict proxy, zero sensitive data exposed',
  'clés privées · IndexedDB locale': 'private keys · local IndexedDB',
  'aucun secret détenu': 'no secrets held',
  'seules les données publiques transitent': 'only public data flows',
  'votre navigateur': 'your browser',
  '2 · construction & signature': '2 · building & signing',
  '3 · diffusion & confirmation': '3 · broadcast & confirmation',
  'BitLab — le cycle complet, en vrai': 'BitLab — the full cycle, for real',
  'phrase BIP39 (12/24 mots)': 'BIP39 phrase (12/24 words)',
  'graine 512 bits': '512-bit seed',
  'Une graine, une arborescence, trois formats d’adresse': 'One seed, one tree, three address formats',
  'signature ECDSA / Schnorr — dans le navigateur': 'ECDSA / Schnorr signing — in the browser',
  'sorties': 'outputs',
  'destinataire · 50 000 sats': 'recipient · 50,000 sats',
  'monnaie rendue · 9 200 sats': 'change · 9,200 sats',
  'proxy Esplora unique · cache 60 s · liste blanche': 'single Esplora proxy · 60 s cache · allow-list',
  'Canal Lightning entre deux nœuds': 'Lightning channel between two nodes',
  'financement on-chain 2/2': 'on-chain 2-of-2 funding',
  'Architecture des API du laboratoire': 'Lab API architecture',
  'interface BitLab': 'BitLab interface',
  'proxy serveur': 'server proxy',
  'module Lightning — navigateur': 'Lightning module — browser',
  'liste blanche · cache · aucun secret': 'allow-list · cache · no secrets',
  'blocs · adresses · UTXO · frais · diffusion': 'blocks · addresses · UTXOs · fees · broadcast',
  'serveur': 'server',
  'architecture Zero-Knowledge': 'Zero-Knowledge architecture',
  'Ce que le navigateur signe, le serveur ne le saura jamais': 'What the browser signs, the server will never know',

  /* ─────────────────────────── Libs (erreurs) ─────────────────────────── */
  'Phrase mnémonique BIP39 invalide (mots inconnus ou checksum erroné).':
    'Invalid BIP39 mnemonic phrase (unknown words or bad checksum).',
  'Échec de la dérivation HD.': 'HD derivation failed.',
  'Clé WIF invalide ou incompatible avec le réseau sélectionné.': 'Invalid WIF key, or incompatible with the selected network.',
  'Aucun UTXO sélectionné.': 'No UTXO selected.',
  'Adresse de sortie invalide : {a}': 'Invalid output address: {a}',
  'Montant de sortie invalide (sats entiers requis).': 'Invalid output amount (integer sats required).',
  'Montant inférieur à la limite de poussière ({n} sats).': 'Amount below the dust limit ({n} sats).',
  'TXID d’UTXO invalide.': 'Invalid UTXO TXID.',
  'Clé interne Taproot manquante.': 'Missing Taproot internal key.',
  'Au moins une sortie est requise.': 'At least one output is required.',
  'Le total des sorties dépasse le total des UTXO sélectionnés.': 'Total outputs exceed the selected UTXOs.',
  'Hexadécimal de transaction invalide.': 'Invalid transaction hexadecimal.',
  'Le multisig nécessite au moins 2 clés publiques.': 'Multisig requires at least 2 public keys.',
  'Seuil m invalide (1 ≤ m ≤ {n}).': 'Invalid threshold m (1 ≤ m ≤ {n}).',
  'Clé publique invalide (hex compressé 33 octets attendu).': 'Invalid public key (33-byte compressed hex expected).',
  'Nœud {net} indisponible. Vérifiez la connexion puis réessayez.': '{net} node unavailable. Check the connection and try again.',
  'Diffusion refusée par le nœud {net} : {err}': 'Broadcast rejected by the {net} node: {err}',
  'erreur {status}': '{status} error',
  'Le montant doit être un multiple de 1000 sats.': 'The amount must be a multiple of 1000 sats.',

  /* ─────────────────────────── Compléments ─────────────────────────── */
  'Canaux': 'Channels',
  'Factures': 'Invoices',
  'Paiements': 'Payments',
  'Création impossible': 'Cannot create invoice',
  'Réseaux': 'Networks',
  'Générer un portefeuille': 'Generate a wallet',
  'Factures BOLT11': 'BOLT11 invoices',
  'Financer': 'Fund',
  'Connecter': 'Connect',
  'Ouvrir': 'Open',
  'Démarrer les nœuds': 'Start the nodes',
  'et': 'and',
  'créée localement': 'created locally',

  /* ───────────────────── Laboratoire Lightning (WASM) ───────────────────── */
  'Laboratoire Lightning': 'Lightning lab',
  'Deux nœuds LDK réels compilés en WebAssembly tournent dans votre navigateur : canaux financés on-chain, factures BOLT11 signées, paiements HTLC authentiques. Vos clés et vos données restent dans votre navigateur.':
    'Two real LDK nodes compiled to WebAssembly run in your browser: on-chain funded channels, signed BOLT11 invoices, authentic HTLC payments. Your keys and data stay in your browser.',
  'désactivé': 'off',
  'arrêt…': 'stopping…',
  'Nœud {n}': 'Node {n}',
  'Capacité sortante': 'Outbound capacity',
  'Capacité entrante': 'Inbound capacity',
  'Activer le laboratoire': 'Activate the lab',
  'Démarre deux nœuds Lightning dans ce navigateur ({net}). Désactivé, aucune ressource n’est consommée.':
    'Boots two Lightning nodes inside this browser ({net}). When off, no resource is consumed.',
  'A connecté à B': 'A connected to B',
  'pairs déconnectés': 'peers disconnected',
  'Reconnecter': 'Reconnect',
  'Chargement du module WASM et synchronisation initiale…': 'Loading the WASM module and performing initial sync…',
  'Ouvrir un canal A → B': 'Open a channel A → B',
  'Le canal est financé on-chain : A construit la transaction de financement, B l’accepte, puis 6 confirmations verrouillent le canal.':
    'The channel is funded on-chain: A builds the funding transaction, B accepts it, then 6 confirmations lock the channel in.',
  'Push vers B (msat)': 'Push to B (msat)',
  'Demander l’ouverture': 'Request opening',
  'Capacité invalide': 'Invalid capacity',
  '1000 sats minimum.': '1000 sats minimum.',
  'Montant poussé trop élevé': 'Push amount too high',
  'Le push ne peut pas dépasser la capacité.': 'The push cannot exceed the capacity.',
  'Fermeture demandée': 'Closure requested',
  'La transaction de fermeture sera diffusée on-chain.': 'The closing transaction will be broadcast on-chain.',
  'Canaux du nœud A': 'Node A channels',
  'Aucun canal pour le moment.': 'No channels yet.',
  '{c}/{r} confirmations': '{c}/{r} confirmations',
  'Capacité': 'Capacity',
  'Sortant': 'Outbound',
  'Entrant': 'Inbound',
  'Financer le canal (on-chain)': 'Fund the channel (on-chain)',
  'Le nœud A attend une transaction de {sats} sats vers l’adresse de financement P2WSH ci-dessous. Payez depuis l’un de vos portefeuilles : la transaction est signée localement, la clé ne quitte jamais le navigateur.':
    'Node A is waiting for a {sats} sats transaction to the P2WSH funding address below. Pay from one of your wallets: the transaction is signed locally, the key never leaves the browser.',
  'Script de financement illisible.': 'Unreadable funding script.',
  'Adresse de financement': 'Funding address',
  'Portefeuille source': 'Source wallet',
  'Construire, signer et diffuser': 'Build, sign and broadcast',
  'Créez et alimentez d’abord un portefeuille (module Bitcoin, robinet testnet).':
    'Create and fund a wallet first (Bitcoin module, testnet faucet).',
  'Financement diffusé': 'Funding broadcast',
  'La transaction de financement est sur la chaîne — attendez les confirmations.':
    'The funding transaction is on-chain — wait for confirmations.',
  'Échec du financement': 'Funding failed',
  'Créer une facture BOLT11 (nœud B)': 'Create a BOLT11 invoice (node B)',
  'Créer': 'Create',
  'Facture créée': 'Invoice created',
  'Signée par le nœud B — faites-la payer par A.': 'Signed by node B — have node A pay it.',
  'Montant invalide.': 'Invalid amount.',
  'Payer une facture (nœud A)': 'Pay an invoice (node A)',
  'Paiement lancé': 'Payment started',
  'Le HTLC circule sur le canal A → B.': 'The HTLC is travelling over the A → B channel.',
  'Une facture neuve à chaque paiement : montant verrouillé, expiration d’une heure.':
    'A fresh invoice for every payment: locked amount, one-hour expiry.',
  'Collez une facture lntb…/lntbs… : le montant est déjà inscrit dedans.':
    'Paste an lntb…/lntbs… invoice: the amount is already encoded in it.',
  'Facture à usage unique': 'Single-use invoice',
  'Un montant fixe, une expiration, un seul paiement — comme un ticket de caisse.':
    'A fixed amount, an expiry, a single payment — like a cashier’s receipt.',
  'Offer réutilisable': 'Reusable offer',
  'Un code de paiement réutilisable, montant parfois libre — la facture est demandée au moment du paiement.':
    'A reusable payment code, sometimes with a free amount — the invoice is requested at payment time.',
  'facture': 'invoice',
  'offer': 'offer',
  'Créer une offer BOLT12 (nœud B)': 'Create a BOLT12 offer (node B)',
  'Un même code lno1… pour un nombre illimité de paiements. Montant facultatif : laissez 0 pour un paiement libre.':
    'One lno1… code for unlimited payments. Amount optional: leave 0 for a free-amount payment.',
  'Montant (sats, 0 = libre)': 'Amount (sats, 0 = free)',
  'Créer l’offer': 'Create offer',
  'Offer créée': 'Offer created',
  'Signée par le nœud B — réutilisable autant de fois que voulu.':
    'Signed by node B — reusable as many times as you like.',
  'Offer illisible': 'Unreadable offer',
  'Payer une offer (nœud A)': 'Pay an offer (node A)',
  'Le nœud A demande d’abord une facture au destinataire via messages onion chiffrés, puis la paie sur le canal.':
    'Node A first requests an invoice from the recipient over encrypted onion messages, then pays it over the channel.',
  'Vérifier': 'Verify',
  'Montant': 'Amount',
  'montant libre': 'free amount',
  'Émetteur': 'Issuer',
  'Note au payeur (facultatif)': 'Payer note (optional)',
  'Demander et payer': 'Request & pay',
  'Montant requis': 'Amount required',
  'Cette offer ne fixe pas de montant : indiquez combien payer.':
    'This offer has no fixed amount: enter how much to pay.',
  'Demande de facture envoyée': 'Invoice request sent',
  'A interroge B via messages onion chiffrés, puis paie la facture retournée. Suivez le journal.':
    'A asks B over encrypted onion messages, then pays the returned invoice. Watch the journal.',
  'Deux nœuds LDK réels compilés en WebAssembly tournent dans votre navigateur : canaux financés on-chain, factures BOLT11, offers BOLT12 réutilisables via messages onion, paiements HTLC authentiques. Vos clés et vos données restent dans votre navigateur.':
    'Two real LDK nodes compiled to WebAssembly run in your browser: on-chain funded channels, BOLT11 invoices, reusable BOLT12 offers over onion messages, authentic HTLC payments. Your keys and data stay in your browser.',
  'Événements Lightning': 'Lightning events',
  'Aucun événement pour le moment.': 'No events yet.',
  'Diffusions on-chain': 'On-chain broadcasts',
  'Transactions émises par les nœuds (financement, fermeture, sanctions).':
    'Transactions emitted by the nodes (funding, closing, justice).',
  'Aucune diffusion pour le moment.': 'No broadcasts yet.',
  'Journal LDK': 'LDK log',
  'Réinitialiser le laboratoire': 'Reset the lab',
  'Efface les graines, canaux et données locales des deux nœuds sur ce réseau. Les fonds on-chain du canal seront perdus si des canaux sont ouverts.':
    'Wipes both nodes’ seeds, channels and local data on this network. On-chain channel funds will be lost if channels are open.',
  'Confirmer la suppression': 'Confirm deletion',
  'Réinitialiser…': 'Reset…',
  'Laboratoire réinitialisé': 'Lab reset',
  'Toutes les données Lightning locales ont été supprimées.': 'All local Lightning data has been deleted.',
  'financement du canal attendu': 'channel funding awaited',
  'paiement envoyé': 'payment sent',
  'tentative de routage échouée': 'routing attempt failed',
  'financement abandonné': 'funding discarded',
  'sorties récupérables (fermeture)': 'spendable outputs (closing)',

  /* ── Mineur Testnet4 (PoW réel dans le navigateur, règle BIP 94) ── */
  'Mineur Testnet4 — PoW réel dans votre navigateur': 'Testnet4 miner — real PoW in your browser',
  'Sans faucet accessible, minez vos propres sats de test : quand un bloc testnet4 arrive plus de 20 minutes après le précédent, le suivant devient minable à difficulté minimale (règle BIP 94). Récompense : 50 tBTC par bloc, utilisables après 100 confirmations.':
    'When no faucet is reachable, mine your own test sats: whenever a testnet4 block arrives more than 20 minutes after the previous one, the next block becomes mineable at minimum difficulty (BIP 94 rule). Reward: 50 tBTC per block, spendable after 100 confirmations.',
  'Le minage est désactivé sur le Mainnet : votre navigateur ne peut pas rivaliser avec le réseau réel, et tout bloc ici aurait une valeur monétaire.':
    'Mining is disabled on Mainnet: your browser cannot compete with the real network, and any block here would carry monetary value.',
  'Signet ne peut pas être miné : chaque bloc doit être signé par les signataires du réseau (BIP 325). Utilisez les faucets ci-dessous, ou Testnet4 pour le minage réel.':
    'Signet cannot be mined: every block must be signed by the network signers (BIP 325). Use the faucets below, or Testnet4 for real mining.',
  'Adresse récompensée (portefeuille actif)': 'Reward address (active wallet)',
  'Mineur arrêté': 'Miner stopped',
  'Surveillance de la chaîne': 'Watching the chain',
  'Fenêtre active — minage en cours': 'Window open — mining now',
  'Diffusion du bloc…': 'Broadcasting block…',
  'Erreur': 'Error',
  '{n} threads': '{n} threads',
  'moteur {e}': '{e} engine',
  'âge du tip : {s} s': 'tip age: {s}s',
  'tip daté {s} s dans le futur (bots BIP 94)': 'tip dated {s}s in the future (BIP 94 bots)',
  'Premier bloc d’une période : difficulté réelle requise — pause du mineur.':
    'First block of a difficulty period: real difficulty required — miner paused.',
  'Prochaine fenêtre minable dans ~{m} min': 'Next mineable window in ~{m} min',
  'Prochaine fenêtre minable dans ~{s} s': 'Next mineable window in ~{s}s',
  'Démarrer le mineur': 'Start the miner',
  'Arrêter': 'Stop',
  'Threads': 'Threads',
  'Miner automatiquement dès la génération d’une clé': 'Mine automatically as soon as a key is generated',
  'Blocs trouvés — récompense mûre après {n} confirmations :': 'Blocks found — reward matures after {n} confirmations:',
  '{c}/{n} conf.': '{c}/{n} conf.',
  'mûr': 'mature',
  'Pédagogie : le mineur construit un bloc vide (coinbase seule) vers votre adresse et balaie les nonces en SHA-256d — exactement le travail des mineurs Bitcoin, en version jouable. Les threads sont bornés pour rester doux avec votre machine.':
    'How it works: the miner builds an empty block (coinbase only) paying your address and sweeps nonces in SHA-256d — exactly what Bitcoin miners do, in playable form. Threads are capped to stay gentle on your machine.',
  'Mineur démarré automatiquement': 'Miner started automatically',
  'Il minera vers {a} pendant les fenêtres BIP 94 — le panneau ci-dessous suit la progression.':
    'It will mine to {a} during BIP 94 windows — the panel below tracks progress.',

  /* ── Regtest : mineur navigateur & nœud externe (mode avancé) ── */
  'Mineur Regtest — PoW réel sur votre chaîne privée': 'Regtest miner — real PoW on your private chain',
  'Mineur — indisponible sur ce réseau': 'Miner — unavailable on this network',
  'Ce réseau ne peut pas être miné depuis le navigateur (faucets du module Portefeuille, ou nœud signataire requis). Utilisez Testnet4 ou Regtest pour le minage réel.':
    'This network cannot be mined from the browser (see the Wallet module faucets, or a signer node is required). Use Testnet4 or Regtest for real mining.',
  'Générez et sélectionnez un portefeuille {net} : le mineur paiera directement son adresse.':
    'Generate and select a {net} wallet: the miner will pay straight to its address.',
  'Blocs instantanés vers {a} sur la chaîne regtest — le panneau ci-dessous suit la progression.':
    'Instant blocks to {a} on the regtest chain — the panel below tracks progress.',
  'Hôte du nœud': 'Node host',
  'Port RPC/REST': 'RPC/REST port',
  'rpcuser (bitcoin.conf)': 'rpcuser (bitcoin.conf)',
  'rpcpass / rpcauth': 'rpcpass / rpcauth',
  'Hôte hors boucle locale : le serveur BitLab n’accepte que les adresses locales ou privées (127.0.0.1, LAN).':
    'Non-loopback host: the BitLab server only accepts loopback or private addresses (127.0.0.1, LAN).',
  'Enregistrer et tester': 'Save & test',
  'Nœud connecté': 'Node connected',
  'Nœud injoignable — Core tourne-t-il avec -regtest -rest=1 ?': 'Node unreachable — is Core running with -regtest -rest=1?',
  'REST OK mais RPC refusé — vérifiez rpcuser/rpcpass': 'REST OK but RPC refused — check rpcuser/rpcpass',
  'Identifiants stockés uniquement dans votre navigateur et transmis au serveur BitLab local, qui ne cible jamais d’hôte public.':
    'Credentials are stored in your browser only and sent to the local BitLab server, which never targets a public host.',
  'Le laboratoire Lightning est disponible sur testnet4, testnet3, signet et regtest. Changez de réseau dans la barre latérale.':
    'The Lightning lab is available on testnet4, testnet3, signet and regtest. Switch networks in the sidebar.',
  'Journal': 'Log',

  /* ───────────────── Regtest embarqué (moteur + faucet + mineur) ───────────────── */
  'Chaîne regtest — laboratoire local': 'Regtest chain — local laboratory',
  'La chaîne privée est embarquée dans BitLab : rien à installer, ni Docker, ni machine virtuelle.':
    'The private chain is embedded in BitLab: nothing to install — no Docker, no virtual machine.',
  'Mode avancé : BitLab dialogue avec votre Bitcoin Core local (-regtest -rest=1) au lieu du moteur embarqué.':
    'Advanced mode: BitLab talks to your local Bitcoin Core (-regtest -rest=1) instead of the embedded engine.',
  'Nœud externe (Bitcoin Core)': 'External node (Bitcoin Core)',
  'Désactivé : le moteur embarqué de BitLab sert la chaîne. Activé : votre Core local fait foi.':
    'Off: BitLab’s embedded engine serves the chain. On: your local Core is the authority.',
  'Hauteur': 'Height',
  'Subvention / bloc': 'Subsidy / block',
  'Halving dans': 'Halving in',
  '{n} blocs': '{n} blocks',
  'Mempool': 'Mempool',
  'Faucet intégré — sats de test instantanés': 'Built-in faucet — instant test sats',
  'Le serveur signe une vraie transaction depuis son pool préminé puis mine 1 bloc : le solde est dépensable immédiatement.':
    'The server signs a real transaction from its pre-mined pool then mines 1 block: the balance is spendable immediately.',
  'Recevoir sur {a}': 'Send to {a}',
  'Miner 10 blocs': 'Mine 10 blocks',
  'Générez et sélectionnez un portefeuille pour recevoir des sats.': 'Generate and select a wallet to receive sats.',
  '{sats} sats envoyés — confirmés au bloc #{h}.': '{sats} sats sent — confirmed at block #{h}.',
  '10 blocs minés — hauteur {h}. La récompense mûrit après 100 blocs.': '10 blocks mined — height {h}. The reward matures after 100 blocks.',
  'Chaîne réinitialisée — genèse neuf, pool faucet reconstitué.': 'Chain reset — fresh genesis, faucet pool rebuilt.',
  'Pool faucet : {m} BTC mûrs · {i} BTC en maturation.': 'Faucet pool: {m} BTC mature · {i} BTC maturing.',
  'Réinitialiser la chaîne': 'Reset the chain',
  'Le regtest est embarqué dans BitLab : la chaîne privée tourne dans l’application — ni Docker, ni machine virtuelle, ni nœud à installer. Le faucet intégré distribue des BTC de test instantanément, et le mineur difficulty 1 fait tourner la PoW réelle dans votre navigateur.':
    'Regtest is embedded in BitLab: the private chain runs inside the application — no Docker, no virtual machine, no node to install. The built-in faucet hands out test BTC instantly, and the difficulty-1 miner runs real PoW in your browser.',
  'Le regtest est votre chaîne personnelle : difficulté 1, chaque bloc se trouve en quelques hachages et la récompense de 50 BTC de test est payée à votre adresse. Chaque bloc est remis à la chaîne regtest embarquée de BitLab (ou à votre nœud externe si configuré) — la récompense mûrit après 100 blocs.':
    'Regtest is your personal chain: difficulty 1, each block takes a few hashes and the 50 test-BTC reward pays your address. Every block is submitted to BitLab’s embedded regtest chain (or your external node if configured) — the reward matures after 100 blocks.',
  'Minez des blocs depuis l’onglet Mineur pour confirmer.': 'Mine blocks from the Miner tab to confirm.',
  '6 blocs minés automatiquement.': '6 blocks mined automatically.',

  /* ───────────────── Module Mineur (page dédiée, PoW réel) ───────────────── */
  'Mineur': 'Miner',
  'Mineur — PoW réel dans votre navigateur': 'Miner — real PoW in your browser',
  'Choisissez le réseau à miner, le portefeuille qui recevra les récompenses, puis démarrez : le hachage SHA-256d est réel, seule la difficulté est jouable.':
    'Pick the network to mine, the wallet that will receive the rewards, then start: the SHA-256d hashing is real, only the difficulty is playable.',
  'Réseau miné': 'Mining network',
  'Testnet4 — fenêtres BIP 94 à difficulté minimale, diffusion P2P aux nœuds publics.':
    'Testnet4 — BIP 94 minimum-difficulty windows, P2P broadcast to public nodes.',
  'Regtest — difficulté 1 en continu sur la chaîne embarquée de BitLab.':
    'Regtest — continuous difficulty 1 on BitLab’s embedded chain.',
  'Récompense vers': 'Payout to',
  'Adresse récompensée': 'Reward address',
  'Aucun portefeuille {net} : créez-en un dans le module Portefeuille — il recevra la récompense de chaque bloc trouvé.':
    'No {net} wallet: create one in the Wallet module — it will receive the reward of every block found.',

  /* ───────────────── Maturation des récompenses (regtest) ───────────────── */
  'Maturation des récompenses': 'Reward maturation',
  'Une récompense de minage attend {n} blocs avant d’être dépensable (consensus Bitcoin). Les blocs minés ici alimentent le pool du faucet — vos récompenses déjà en chaîne mûrissent avec eux.':
    'A mining reward waits {n} blocks before it is spendable (Bitcoin consensus). Blocks mined here feed the faucet pool — your on-chain rewards mature along with them.',
  '{s} sats en maturation': '{s} sats maturing',
  'mûr dans {k} bloc(s)': 'mature in {k} block(s)',
  'Miner {k} bloc(s) pour tout débloquer': 'Mine {k} block(s) to unlock all',
  'minage des blocs…': 'mining blocks…',

  /* ───────────────── Journal d’activité (logs lisibles par module) ───────────────── */
  'Journal d’activité': 'Activity log',
  'Opérations du laboratoire : réseau, portefeuilles, transactions, minage. Aucun secret n’y figure — les clés restent dans votre navigateur.':
    'Lab operations: network, wallets, transactions, mining. No secrets here — keys stay in your browser.',
  'Tout': 'All',
  'Effacer': 'Clear',
  'Aucune entrée pour ce module pour le moment.': 'No entries for this module yet.',
  'Sorties brutes des nœuds (niveau LDK) : A en émeraude, B en violet, messages système en bleu.':
    'Raw node output (LDK level): A in emerald, B in violet, system messages in blue.',
};
