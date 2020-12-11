import { TransactionResponse, TransactionRequest, Provider } from '@ethersproject/providers'
import { Signer as AbstractSigner, Contract, ethers, BytesLike, BigNumberish } from 'ethers'
import { Deferrable } from 'ethers/lib/utils'
import { walletContracts } from '@0xsequence/abi'
import { ContractWallet } from './contract-wallet'
import { NotEnoughSigners } from './errors'
import { Transactionish } from '@0xsequence/transactions'
import { WalletConfig, addressOf, imageHash, isConfig } from '@0xsequence/auth'
import { resolveArrayProperties } from './utils'

import { NetworkConfig, WalletContext } from '@0xsequence/networks'


// TODO: Add more details to network
// authChain, mainNetwork, etc

// TODO: move "network" types to @0xsequence/networks

// Network wallet is the wallet on a particular network..
// .. hmpf.
// TOOD: move this to ./types.ts
export type NetworkWallet = {
  wallet: ContractWallet,
  network: NetworkConfig
}

export type SmartWalletOptions = {
  context: WalletContext,
  initialConfig: WalletConfig,
  signers: AbstractSigner[],
  networks: NetworkConfig[]
}

type FullConfig = {
  threshold: Threshold[],
  signers: Signer[]
}

type Threshold = {
  chaind: number,
  weight: number
}

type Signer = {
  address: string,
  networks: {
    chaind: number,
    weight: number
  }[]
}

export class SmartWallet extends AbstractSigner {
  private readonly _wallets: NetworkWallet[]
  provider: ethers.providers.JsonRpcProvider

  constructor(opts: SmartWalletOptions) {
    super()

    if (opts.networks.length === 0) throw new Error('SmartWallet must have networks')

    // Generate wallets using the initial configuration
    this._wallets = opts.networks.map((network) => {
      const wallet = new ContractWallet(opts.initialConfig, opts.context, ...opts.signers)
      wallet.setProvider(network.rpcUrl)
      if (network.relayer) {
        wallet.setRelayer(network.relayer)
      }
      return {
        network: network,
        wallet: wallet
      }
    })

    this.provider = this._wallets[0].wallet.provider
  }

  get address(): string {
    return this._wallets[0].wallet.address
  }

  getAddress(): Promise<string> {
    return this._wallets[0].wallet.getAddress()
  }

  // getFullConfig builds the FullConfig object which contains all configs across all networks.
  // This is useful to shows all keys/devices connected to a wallet across networks.
  async getFullConfig(): Promise<FullConfig> {
    const allConfigs = await Promise.all(this._wallets.map(async (w) => ({ wallet: w, config: await this.currentConfig(w.wallet) })))
    const thresholds = allConfigs.map((c) => ({ chaind: c.wallet.network.chainId, weight: c.config.threshold }))
    const allSigners = allConfigs.reduce((p, config) => {
      config.config.signers.forEach((signer) => {
        const item = p.find((c) => c.address === signer.address)
        const netEntry = {
          weight: signer.weight,
          chaind: config.wallet.network.chainId
        }

        if (!item) {
          p.push({
            address: signer.address,
            networks: [netEntry]
          })
        } else {
          item.networks.push(netEntry)
        }
      })
      return p
    }, [] as Signer[])

    return {
      threshold: thresholds,
      signers: allSigners
    }
  }

  async signAuthMessage(message: BytesLike, onlyFullSign: boolean = true): Promise<string> {
    return this.signMessage(message, this.authWallet(), onlyFullSign)
  }

  async signMessage(message: BytesLike, target?: ContractWallet | NetworkConfig | BigNumberish, onlyFullSign: boolean = true): Promise<string> {
    const wallet = (() => {
      if (!target) return this.mainWallet()
      if ((<ContractWallet>target).address) {
        return target as ContractWallet
      }
      return this.getNetworkWallet(target as NetworkConfig)
    })()

    // TODO: Skip this step if wallet is authWallet
    let thisConfig = await this.currentConfig(wallet)
    thisConfig = thisConfig ? thisConfig : this._wallets[0].wallet.config

    // See if wallet has enough signer power
    const weight = await wallet.useConfig(thisConfig).signWeight()
    if (weight.lt(thisConfig.threshold) && onlyFullSign) {
      throw new NotEnoughSigners(`Sign message - wallet combined weight ${weight.toString()} below required ${thisConfig.threshold.toString()}`)
    }

    return wallet.useConfig(thisConfig).signMessage(message)
  }

  async sendTransaction(dtransactionish: Deferrable<Transactionish>, network?: NetworkConfig | BigNumberish, onlyFullSign: boolean = true): Promise<TransactionResponse> {
    const transaction = await resolveArrayProperties<Transactionish>(dtransactionish)
    const wallet = network ? this.getNetworkWallet(network) : this.mainWallet()

    // TODO: Skip this step if wallet is authWallet
    const [thisConfig, lastConfig] = await Promise.all([
      this.currentConfig(wallet), this.currentConfig()
    ])

    // See if wallet has enough signer power
    const weight = await wallet.useConfig(thisConfig).signWeight()
    if (weight.lt(thisConfig.threshold) && onlyFullSign) {
      throw new NotEnoughSigners(`Send transaction - wallet combined weight ${weight.toString()} below required ${thisConfig.threshold.toString()}`)
    }

    // If the wallet is updated, procede to transaction send
    if (isConfig(lastConfig, thisConfig)) {
      return wallet.useConfig(lastConfig).sendTransaction(transaction)
    }

    // Bundle with configuration update
    const transactionParts = (() => {
      if (Array.isArray(transaction)) {
        return transaction
      } else {
        return [transaction]
      }
    })()

    return wallet.useConfig(thisConfig).sendTransaction([
      ...await wallet.buildUpdateConfig(lastConfig, false),
      ...transactionParts
    ])
  }

  async updateConfig(newConfig: WalletConfig): Promise<TransactionResponse | undefined> {
    // The config is the default config, see if the wallet has been deployed
    if (isConfig(this._wallets[0].wallet.config, newConfig)) {
      if (!(await this.isDeployed())) {
        // Deploy the wallet and publish initial configuration
        return this.authWallet().publishConfig()
      }
    }

    // Get latest config, update only if neccesary
    const lastConfig = await this.currentConfig()
    if (isConfig(lastConfig, newConfig)) {
      return undefined
    }

    // Update to new configuration
    // lazy update all other networks
    const [_, tx] = await this.authWallet()
      .useConfig(lastConfig)
      .updateConfig(newConfig, undefined, true)

    return tx
  }

  async isDeployed(target?: ContractWallet | NetworkConfig): Promise<boolean> {
    const wallet = (() => {
      if (!target) return this.authWallet()
      if ((<ContractWallet>target).address) {
        return target as ContractWallet
      }
      return this.getNetworkWallet(target as NetworkConfig)
    })()

    const walletCode = await wallet.provider.getCode(this.address)
    return walletCode && walletCode !== "0x"
  }

  // TODO: Split this to it's own class "configProvider" or something
  // this process can be done in different ways (caching, api, utils, etc)
  async currentConfig(target?: ContractWallet | NetworkConfig): Promise<WalletConfig | undefined> {
    const address = this.address
    const wallet = (() => {
      if (!target) return this.authWallet()
      if ((<ContractWallet>target).address) {
        return target as ContractWallet
      }
      return this.getNetworkWallet(target as NetworkConfig)
    })()
  
    const walletContract = new Contract(address, walletContracts.mainModuleUpgradable.abi, wallet.provider)

    const authWallet = this.authWallet()
    const authContract = new Contract(authWallet.context.requireUtils, walletContracts.requireUtils.abi, authWallet.provider)

    const currentImageHash = walletContract.functions.imageHash.call([])
    currentImageHash.catch(() => {}) // Ignore no imageHash defined
    const currentImplementation = ethers.utils.defaultAbiCoder.decode(
      ['address'], await wallet.provider.getStorageAt(address, address)
    )[0]

    let event: any
    if (currentImplementation === wallet.context.mainModuleUpgradable) {
      // Test if given config is the updated config
      if (imageHash(this._wallets[0].wallet.config) === await currentImageHash) {
        return this._wallets[0].wallet.config
      }

      // The wallet has been updated
      // lookup configuration using imageHash
      const filter = authContract.filters.RequiredConfig(null, await currentImageHash)
      const logs = await authWallet.provider.getLogs({ fromBlock: 0, toBlock: 'latest', ...filter})
      if (logs.length === 0) return undefined
      const lastLog = logs[logs.length - 1]
      event = authContract.interface.decodeEventLog('RequiredConfig', lastLog.data, lastLog.topics)
    } else {
      // Test if given config is counter-factual config
      if (addressOf(this._wallets[0].wallet.config, this._wallets[0].wallet.context).toLowerCase() === address.toLowerCase()) {
        return this._wallets[0].wallet.config
      }

      // The wallet it's using the counter-factual configuration
      const filter = authContract.filters.RequiredConfig(address)
      const logs = await authWallet.provider.getLogs({ fromBlock: 0, toBlock: 'latest', ...filter})
      if (logs.length === 0) return undefined
      const lastLog = logs[0] // TODO: Search for real counter-factual config
      event = authContract.interface.decodeEventLog('RequiredConfig', lastLog.data, lastLog.topics)
    }

    const signers = ethers.utils.defaultAbiCoder.decode(
      [`tuple(
        uint256 weight,
        address signer
      )[]`], event._signers
    )[0]

    const config = {
      address: address,
      threshold: event._threshold,
      signers: signers.map((s: any) => ({
        address: s.signer,
        weight: s.weight
      }))
    }

    return config
  }

  private getNetworkWallet(network: NetworkConfig | BigNumberish): ContractWallet {
    const chainId = (() => {
      if ((<NetworkConfig>network).chainId) {
        return (<NetworkConfig>network).chainId
      }
      return ethers.BigNumber.from(network as BigNumberish).toNumber()
    })()

    return this._wallets.find((w) => w.network.chainId === chainId).wallet
  }

  private mainWallet(): ContractWallet {
    const found = this._wallets.find((w) => w.network.isMainChain).wallet
    return found ? found : this._wallets[0].wallet
  }

  private authWallet(): ContractWallet {
    const found = this._wallets.find((w) => w.network.isAuthChain).wallet
    return found ? found : this._wallets[0].wallet
  }

  static isSmartWallet(signer: AbstractSigner): signer is SmartWallet {
    return (<SmartWallet>signer).updateConfig !== undefined
  }

  signTransaction(_: Deferrable<TransactionRequest>): Promise<string> {
    throw new Error('Method not implemented.')
  }
  connect(_: Provider): AbstractSigner {
    throw new Error('Method not implemented.')
  }
}