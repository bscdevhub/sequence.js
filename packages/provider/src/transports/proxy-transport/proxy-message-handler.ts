import { BaseWalletTransport } from '../base-wallet-transport'
import { WalletRequestHandler } from '../wallet-request-handler'
import { ProviderMessage } from '../../types'
import { ProxyMessageChannelPort } from './proxy-message-channel'

export class ProxyMessageHandler extends BaseWalletTransport {

  private port: ProxyMessageChannelPort

  constructor(walletRequestHandler: WalletRequestHandler, port: ProxyMessageChannelPort) {
    super(walletRequestHandler)
    this.port = port
  }

  register() {
    this.port.handleMessage = (message: ProviderMessage<any>): void => {
      this.handleMessage(message)
    }
  }

  unregister() {
    this.port.handleMessage = undefined
  }

  sendMessage(message: ProviderMessage<any>) {
    this.port.sendMessage(message)
  }

}
