import { ethers } from 'ethers'
import { BytesLike } from '@ethersproject/bytes'
import { Web3Provider as EthersWeb3Provider, ExternalProvider, JsonRpcProvider, Networkish } from "@ethersproject/providers"
import { TypedDataDomain, TypedDataField, TypedDataSigner } from '@ethersproject/abstract-signer'
import { NetworkConfig, Networks, WalletContext, ChainId, JsonRpcHandler, JsonRpcHandlerFunc, JsonRpcFetchFunc, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcResponse, maybeNetworkId, JsonRpcVersion, JsonRpcSender, isJsonRpcProvider } from '@0xsequence/network'
import { Signer } from '@0xsequence/wallet'
import { WalletConfig, WalletState } from '@0xsequence/config'
import { Relayer } from '@0xsequence/relayer'
import { Deferrable, shallowCopy, resolveProperties } from '@0xsequence/utils'
import { TransactionRequest, TransactionResponse, Transactionish, SignedTransactions } from '@0xsequence/transactions'
import { WalletRequestHandler } from './transports/wallet-request-handler'

// naming..?
// Web3Provider, Web3Signer, Web3Relayer, Web3Indexer
//
//.. or.... SequenceProvider, SequenceSigner, SequenceRelayer, SequenceIndexer
//

export class Web3Provider extends EthersWeb3Provider implements JsonRpcHandler {

  // also, make to separate util method
  // static isSequenceProvider(cand: any): cand is Web3Provider {
  // }

  readonly _sender: JsonRpcSender


  // defaultChainId is the default chainId to use with requests, but may be
  // overridden by passing chainId argument to a specific request
  readonly _defaultChainId?: number

  constructor(provider: JsonRpcProvider | JsonRpcHandler | JsonRpcFetchFunc, defaultChainId?: ChainId) {
    const sender = new JsonRpcSender(provider, maybeNetworkId(defaultChainId))
    provider = sender

    super(provider, 'any')

    this._sender = sender
    this._defaultChainId = maybeNetworkId(defaultChainId)
  }

  sendAsync(request: JsonRpcRequest, callback: JsonRpcResponseCallback | ((error: any, response: any) => void), chainId?: number) {
    this._sender.sendAsync(request, callback, chainId)
  }

  send(method: string, params: Array<any>, chainId?: number): Promise<any> {
    return this._sender.send(method, params, chainId)
  }

  getSigner(): Web3Signer {
    return new Web3Signer(this, this._defaultChainId)
  }

  async getChainId(): Promise<number> {
    const result = await this.send('eth_chainId', [])
    const chainId = ethers.BigNumber.from(result).toNumber()

    if (this._defaultChainId && this._defaultChainId !== chainId) {
      throw new Error(`provider chainId (${chainId}) does not match provider-bound chainId ${this._defaultChainId}`)
    }

    return chainId
  }
}

export class LocalWeb3Provider extends Web3Provider {
  constructor(signer: Signer, networks?: Networks) {
    const walletRequestHandler = new WalletRequestHandler(signer, null, networks)
    super(walletRequestHandler)
  }
}

export class Web3Signer extends Signer implements TypedDataSigner {
  readonly provider: Web3Provider
  readonly defaultChainId?: number

  constructor(provider: Web3Provider, defaultChainId?: number) {
    super()
    this.provider = provider
    this.defaultChainId = defaultChainId
  }

  // memoized
  _address: string
  _index: number
  _context: WalletContext
  _networks: NetworkConfig[]
  private _providers: {[key: number]: Web3Provider} = {}

  //
  // ethers AbstractSigner methods
  //

  async getAddress(): Promise<string> {
    if (this._address) return this._address
    const accounts = await this.provider.send('eth_accounts', [])
    this._address = accounts[0]
    this._index = 0
    return this._address
  }

  signTransaction(transaction: Deferrable<TransactionRequest>): Promise<string> {
    // TODO .. since ethers isn't using this method, perhaps we will?
    throw new Error('signTransaction is unsupported, use signTransactions instead')
  }

  connect(provider: ethers.providers.Provider): ethers.providers.JsonRpcSigner {
    throw new Error('unsupported: cannot alter JSON-RPC Signer connection')
  }

  //
  // Sequence Signer methods
  //

  // getProvider returns a Web3Provider instance for the current chain. Note that this method
  // and signer is bound to a particular chain to prevent misuse. If you'd like a provider
  // for a specific chain, try getSender(chainId), or wallet.getProvider(chainId).
  async getProvider(chainId?: number): Promise<Web3Provider | undefined> {
    if (chainId) {
      const currentChainId = await this.getChainId()
      if (currentChainId !== chainId) {
        throw new Error(`signer is attempting to access chain ${chainId}, but is already bound to chain ${currentChainId}`)
      }
    }
    return this.provider
  }

  // getSender returns a Web3Provider instance via the signer transport. Note: for our case
  // the of sequence wallet, this will bring up the wallet window whenever using it, as the json-rpc
  // requests are sent to the window transport. Therefore, for anything non-signing related
  // you can write a higher-order JsonRpcRouter sender to route to the public provider endpoints
  // as we do in the WalletProvider.
  //
  // This method is primarily utilized internally when routing requests to a particular chainId.
  async getSender(chainId?: number): Promise<Web3Provider | undefined> {
    if (!chainId || (chainId && chainId === this.defaultChainId)) {
      return this.provider
    }
    if (!this._providers[chainId]) {
      this._providers[chainId] = new Web3Provider(new JsonRpcSender(this.provider, chainId), chainId)
    }
    return this._providers[chainId]
  }

  getRelayer(chainId?: number): Promise<Relayer | undefined> {
    // TODO: JsonRpcRelayer ......? or, Web3Relayer.. or SequenceRelayer?
    // sequence_estimateGasLimits
    // sequence_gasRefundOptions
    // sequence_getNonce
    // sequence_relay
    throw new Error('TODO')
  }

  async getWalletContext(): Promise<WalletContext> {
    if (!this._context) {
      this._context = await this.provider.send('sequence_getWalletContext', [])
    }
    return this._context
  }

  async getWalletConfig(chainId?: ChainId): Promise<WalletConfig[]> {
    return await this.provider.send('sequence_getWalletConfig', [], maybeNetworkId(chainId) || this.defaultChainId)
  }

  async getWalletState(chainId?: ChainId): Promise<WalletState[]> {
    return await this.provider.send('sequence_getWalletState', [], maybeNetworkId(chainId) || this.defaultChainId)
  }

  async getNetworks(): Promise<NetworkConfig[]> {
    if (!this._networks) {
      this._networks = await this.provider.send('sequence_getNetworks', [])
    }
    return this._networks
  }

  async getSigners(): Promise<string[]> {
    const networks = await this.getNetworks()

    const authChainId = networks.find(n => n.isAuthChain)
    if (!authChainId) {
      throw new Error('authChainId could not be determined from network list')
    }

    const walletConfig = await this.getWalletConfig(authChainId)
    if (!walletConfig || walletConfig.length === 0) {
      throw new Error(`walletConfig returned zero results for authChainId {authChainId}`)
    }

    return walletConfig[0].signers.map(s => s.address)
  }

  // signMessage matches implementation from ethers JsonRpcSigner for compatibility, but with
  // multi-chain support.
  async signMessage(message: BytesLike, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    const provider = await this.getSender(maybeNetworkId(chainId) || this.defaultChainId)

    const data = ((typeof (message) === 'string') ? ethers.utils.toUtf8Bytes(message) : message)
    const address = await this.getAddress()

    // https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign
    return await provider.send('eth_sign', [
      address.toLowerCase(), ethers.utils.hexlify(data)
    ])
  }

  // signTypedData matches implementation from ethers JsonRpcSigner for compatibility, but with
  // multi-chain support.
  async signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    // Populate any ENS names (in-place)
    const populated = await ethers.utils._TypedDataEncoder.resolveNames(domain, types, value, (name: string) => {
      return this.provider.resolveName(name)
    })

    return await this.provider.send('eth_signTypedData_v4', [
      (await this.getAddress()).toLowerCase(),
      ethers.utils._TypedDataEncoder.getPayload(populated.domain, types, populated.value)
    ], maybeNetworkId(chainId) || this.defaultChainId)
  }

  // sendTransaction matches implementation from ethers JsonRpcSigner for compatibility, but with
  // multi-chain support.
  async sendTransaction(transaction: Deferrable<TransactionRequest>, chainId?: ChainId, allSigners?: boolean): Promise<TransactionResponse> {
    const provider = await this.getSender(maybeNetworkId(chainId) || this.defaultChainId)

    return this.sendUncheckedTransaction(transaction, chainId).then((hash) => {
      return ethers.utils.poll(() => {
        return provider.getTransaction(hash).then((tx: TransactionResponse) => {
          if (tx === null) { return undefined }
          return provider._wrapTransaction(tx, hash)
        })
      }, { onceBlock: this.provider }).catch((error: Error) => {
        (<any>error).transactionHash = hash
        throw error
      })
    })
  }

  signTransactions(transaction: Deferrable<TransactionRequest>, chainId?: ChainId, allSigners?: boolean): Promise<SignedTransactions> {
    transaction = shallowCopy(transaction)
    // TODO: transaction argument..? make sure to resolve any properties and serialize property before sending over
    // the wire.. see sendUncheckedTransaction and resolveProperties
    return this.provider.send('eth_signTransaction', [transaction], maybeNetworkId(chainId) || this.defaultChainId)
  }

  sendSignedTransactions(signedTxs: SignedTransactions, chainId?: ChainId): Promise<TransactionResponse> {
    // sequence_relay
    throw new Error('TODO')
  }

  // updateConfig..
  // NOTE: this is not supported by the remote wallet by default.
  async updateConfig(newConfig?: WalletConfig): Promise<[WalletConfig, TransactionResponse | undefined]> {
    // sequence_updateConfig
    const [config, tx] = await this.provider.send('sequence_updateConfig', [newConfig], this.defaultChainId)
    if (tx === null) {
      return [config, undefined]
    }

    const provider = await this.getSender(this.defaultChainId)
    return [config, provider._wrapTransaction(tx, tx.hash)]
  }

  // publishConfig..
  // NOTE: this is not supported by the remote wallet by default.
  async publishConfig(): Promise<TransactionResponse | undefined> {
    const provider = await this.getSender(this.defaultChainId)

    const tx = await provider.send('sequence_publishConfig', [])
    if (tx === null) {
      return undefined
    }
    return provider._wrapTransaction(tx, tx.hash)
  }

  async isDeployed(chainId?: ChainId): Promise<boolean> {
    const provider = await this.getSender(maybeNetworkId(chainId))
    const walletCode = await provider.getCode(await this.getAddress())
    return walletCode && walletCode !== "0x"
  }

  //
  // ethers JsonRpcSigner methods
  //

  async _signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    return this.signTypedData(domain, types, value, chainId, allSigners)
  }

  // sendUncheckedTransaction matches implementation from ethers JsonRpcSigner for compatibility, but with
  // multi-chain support.
  async sendUncheckedTransaction(transaction: Deferrable<TransactionRequest>, chainId?: ChainId): Promise<string> {
    transaction = shallowCopy(transaction)

    const fromAddress = this.getAddress().then((address) => {
      if (address) { address = address.toLowerCase() }
      return address
    })

    // The JSON-RPC for eth_sendTransaction uses 90000 gas; if the user
    // wishes to use this, it is easy to specify explicitly, otherwise
    // we look it up for them.
    if (transaction.gasLimit == null) {
      const estimate = shallowCopy(transaction)
      estimate.from = fromAddress
      transaction.gasLimit = this.provider.estimateGas(estimate)
    }

    const provider = await this.getSender(maybeNetworkId(chainId) || this.defaultChainId)

    return resolveProperties({
      tx: resolveProperties(transaction),
      sender: fromAddress
    }).then(({ tx, sender }) => {
      if (tx.from != null) {
        if (tx.from.toLowerCase() !== sender) {
          // logger.throwArgumentError("from address mismatch", "transaction", transaction)
          throw new Error(`from address mismatch for transaction ${transaction}`)
        }
      } else {
        tx.from = sender;
      }

      const hexTx = (<any>this.provider.constructor).hexlifyTransaction(tx, { from: true })

      return provider.send('eth_sendTransaction', [hexTx]).then((hash) => {
        return hash
      }, (error) => {
        // return checkError("sendTransaction", error, hexTx)
        throw new Error(`sendTransaction ${error}`)
      })
    })
  }

  connectUnchecked(): ethers.providers.JsonRpcSigner {
    throw new Error('connectUnchecked is unsupported')
  }

  async unlock(password: string): Promise<boolean> {
    const address = await this.getAddress()
    return this.provider.send("personal_unlockAccount", [address.toLowerCase(), password, null])
  }
}
