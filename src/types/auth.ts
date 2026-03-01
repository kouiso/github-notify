export interface DeviceFlowInfo {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface TokenVerification {
  valid: boolean;
  login?: string;
  avatarUrl?: string;
}
