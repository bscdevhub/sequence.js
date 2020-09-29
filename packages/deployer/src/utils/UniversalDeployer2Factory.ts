/* Generated by ts-generator ver. 0.0.8 */
/* tslint:disable */

import { Contract, ContractFactory, Signer } from "ethers";
import { Provider } from "ethers/providers";
import { UnsignedTransaction } from "ethers/utils/transaction";

import { TransactionOverrides } from ".";
import { UniversalDeployer2 } from "./UniversalDeployer2";

export class UniversalDeployer2Factory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer);
  }

  deploy(overrides?: TransactionOverrides): Promise<UniversalDeployer2> {
    return super.deploy(overrides) as Promise<UniversalDeployer2>;
  }
  getDeployTransaction(overrides?: TransactionOverrides): UnsignedTransaction {
    return super.getDeployTransaction(overrides);
  }
  attach(address: string): UniversalDeployer2 {
    return super.attach(address) as UniversalDeployer2;
  }
  connect(signer: Signer): UniversalDeployer2Factory {
    return super.connect(signer) as UniversalDeployer2Factory;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): UniversalDeployer2 {
    return new Contract(address, _abi, signerOrProvider) as UniversalDeployer2;
  }
}

const _abi = [
  {
    anonymous: true,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_addr",
        type: "address"
      }
    ],
    name: "Deploy",
    type: "event"
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "_creationCode",
        type: "bytes"
      },
      {
        internalType: "uint256",
        name: "_instance",
        type: "uint256"
      }
    ],
    name: "deploy",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  }
];

const _bytecode =
  "0x608060405234801561001057600080fd5b5061013d806100206000396000f3fe60806040526004361061001e5760003560e01c80639c4ae2d014610023575b600080fd5b6100cb6004803603604081101561003957600080fd5b81019060208101813564010000000081111561005457600080fd5b82018360208201111561006657600080fd5b8035906020019184600183028401116401000000008311171561008857600080fd5b91908080601f01602080910402602001604051908101604052809392919081815260200183838082843760009201919091525092955050913592506100cd915050565b005b60008183516020850134f56040805173ffffffffffffffffffffffffffffffffffffffff83168152905191925081900360200190a050505056fea264697066735822122005bee52d30dc340bc6a02c2bccfac4bbf15d5e44ead052d6a6ff0f9f040f8cfd64736f6c63430006080033";