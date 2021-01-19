import { JsonRpcProvider } from '@ethersproject/providers'
import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcMiddlewareHandler, JsonRpcHandler } from '../types'

export const SignerJsonRpcMethods = [
  'personal_sign', 'eth_sign', 'eth_signTypedData',
  'eth_sendTransaction', 'eth_sendRawTransaction',
  
  'sequence_getWalletContext', 'sequence_getWalletConfig', 'sequence_getWalletState', 'sequence_getNetworks',
  'sequence_updateConfig', 'sequence_publishConfig', 'sequence_estimateGasLimits', 'sequence_gasRefundOptions',
  'sequence_getNonce', 'sequence_relay'
]

export class SigningProvider implements JsonRpcMiddlewareHandler {

  private provider: JsonRpcHandler

  constructor(provider: JsonRpcHandler) {
    this.provider = provider
  }

  sendAsyncMiddleware = (next: JsonRpcHandlerFunc) => {
    return (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
      // Forward signing requests to the signing provider
      if (SignerJsonRpcMethods.includes(request.method)) {
        this.provider.sendAsync(request, callback, chainId)
        return
      }

      // Continue to next handler
      next(request, callback, chainId)
    }
  }

}