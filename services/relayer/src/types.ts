export interface DelegateFunctionCall {
  methodName: string;
  /** Base64-encoded UTF-8 JSON args, matching the NEP-366 FunctionCall action. */
  args: string;
  /** Decimal gas units. */
  gas: string;
  /** Must be "0" for a function-call-key delegate. */
  deposit: string;
}

export interface NonDelegateAction {
  functionCall: DelegateFunctionCall;
}

export interface DelegateAction {
  senderId: string;
  receiverId: string;
  actions: NonDelegateAction[];
  /** Decimal u64 nonce; kept as a string to avoid JS precision loss. */
  nonce: string;
  maxBlockHeight: number;
  publicKey: string;
}

export interface SignedDelegateAction {
  delegateAction: DelegateAction;
  /** Signature bytes (base64) or an opaque signature fingerprint; never a private key. */
  signature: string;
}

export interface DelegateSignatureVerifier {
  verify(signed: SignedDelegateAction): boolean;
}
