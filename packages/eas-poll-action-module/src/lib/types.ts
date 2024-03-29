export type PollOption = 0 | 1 | 2 | 3;

export type GateParams = {
  /**
   * The address of ERC20/ERC721 token used for gating the action
   */
  tokenAddress: `0x${string}`;

  /**
   * The minimum balance threshold of the gated token required to execute an action
   */
  minThreshold: bigint;
};

export type EasPoll = {
  /**
   * The options of the poll. Minimum 2, maximum 4. Each option max 32 bytes.
   */
  options: string[];

  /**
   * Whether the poll can only be voted on by followers of the publication author.
   */
  followersOnly?: boolean;

  /**
   * The end timestamp of the poll (in seconds).
   */
  endTimestamp?: number;

  /**
   * Whether the poll requires a signature to vote.
   */
  signatureRequired?: boolean;

  /**
   * The token gating parameters of the poll.
   */
  gateParams?: GateParams;
};

export type EasVote = {
  /**
   * The full ID of the publication as a hex string (eg. 0xd8-0x01).
   */
  publicationId: string;

  /**
   * The index of the voted option.
   */
  optionIndex: PollOption;
};

export type SignedEasVote = EasVote & {
  /**
   * The profile ID of the voter (as a hex string).
   */
  actorProfileId?: string;

  /**
   * The address of the voter.
   */
  actorProfileOwner?: `0x${string}`;

  /**
   * The address of the transaction executor.
   */
  transactionExecutor?: `0x${string}`;

  /**
   * The timestamp of the vote (in seconds).
   */
  timestamp?: number;
};

export const isSignedVote = (vote: EasVote): vote is SignedEasVote =>
  "actorProfileId" in vote && "actorProfileOwner" in vote;

export type GetVoteCountVariables = {
  schemaId: string;
  pollId: string;
};

export interface GetVoteCountForOptionIndexVariables extends GetVoteCountVariables {
  optionIndex: string;
}

export type GetVoteForActorVariables = {
  schemaId: string;
  data: string;
};

export interface GetVoteCountResponse {
  groupByAttestation: {
    _count: {
      _all: number;
    };
  }[];
}

export type AttestationData = {
  publicationProfileId: string;
  publicationId: string;
  actorProfileId: string;
  actorProfileOwner: `0x${string}`;
  transactionExecutor: `0x${string}`;
  optionIndex: number;
  timestamp: number;
};

export type VoteAttestation = {
  attester: string;
  id: string;
  revoked: boolean;
  data: AttestationData;
};
