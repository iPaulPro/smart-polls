# Smart Polls

Smart Polls transform Lens posts into polls using the Ethereum Attestation Service (EAS) for on-chain voting.

`EasPollActionModule.sol` is an Open Action Module (Publication Module) for Lens Protocol that can be added to any publication to create a poll. The poll options and votes are stored on-chain and can be queried using the EAS GraphQL API or by running a subgraph.

## Packages

- `EasPollActionModule`: The Open Action module contract for creating and querying polls and votes. 
- `eas-poll-action-module`: A helper library for interacting with `EasPollActionModule`, available for [installation](#install-eas-poll-action-module-helper-library) via npm.

## Benefits over using Snapshot

The `EasPollActionModule` contract provides a number of benefits over using Snapshot for polls:

1. **100% on-chain**: The poll and votes are stored on-chain, providing a high level of trust and transparency.
2. **Protocol-wide**: Unlike Snapshot, the `EasPollActionModule` can be used on any Lens Protocol publication, and polls can be voted on from any Lens app. No DAO hack necessary!
3. **EAS Integration**: Ethereum Attestation Service (EAS) allows for easy and permissionless querying of votes using their GraphQL API or your own subgraph.
4. **Token gating**: Easily restrict voting to followers of the publication author or to any arbitrary ERC20/ERC721 token holders.
5. **Require Signature**: Optionally require a signature for voting, creating a [delegated attestation](https://docs.attest.sh/docs/core--concepts/delegated-attestations).

## Using the EasPollActionModule Contract

To use the live `EasPollActionModule` you can use the address and metadata below:

| Network | Chain ID | Deployed Contract                                                                                                               | Metadata                                                                     | EAS Schema UID                                                                                                                                                                          |
|---------|----------|---------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Mumbai  | 80001    | [0xc91C3d3eD7089a9b52945c8967CF0854f08E9e7a](https://mumbai.polygonscan.com/address/0xc91C3d3eD7089a9b52945c8967CF0854f08E9e7a) | [link](https://gateway.irys.xyz/NTOWrzOZxJH_RJHEha1MC_m9s6-kAY7igCyhSDE6seU) | [0x44c235a2465c4d70bd980bdcf968d1997b237e2c7d30a2de1b59b98fee4a1f37](https://polygon-mumbai.easscan.org/schema/view/0x44c235a2465c4d70bd980bdcf968d1997b237e2c7d30a2de1b59b98fee4a1f37) |

The `EasPollActionModule` contract can be used as an Open Action Module on Lens Protocol publications. Here are examples of successful transactions on Mumbai using the poll module:

[`Post (init)` transaction](https://mumbai.polygonscan.com/tx/0xc20b03ff16c67a5e04d461b5535426137a6afc186fab3f33517d45bee8f18eeb)

[`Act (process)` transaction](https://mumbai.polygonscan.com/tx/0x17519fee2af6cec2b5fe508646a135aecf6beac7bc4478cbca6e247e38718b02)

[Example Attestation](https://polygon-mumbai.easscan.org/attestation/view/0x8787529ab2627b903970b971dfe52576ae7ef62570f42bfb9ff28a4a0ee395fc)

### Install `eas-poll-action-module` Helper Library

The helper library provides functions for creating the Lens SDK `OpenActionModuleInput` and `ActOnOpenActionRequest` which can be used to attach and act on the Open Action Module. To use the `eas-poll-action-module` helper library, you can install it from npm:

```bash
npm i -D eas-poll-action-module
```
```bash
yarn add -D eas-poll-action-module
```
```bash
pnpm add -D eas-poll-action-module
```

### Create a Poll

To create a poll, the initialize calldata ABI is:

| Name                | Type         | Description                                                                           | Required |
|---------------------|:-------------|---------------------------------------------------------------------------------------|----------|
| `options`           | `bytes32[4]` | An array of 2 to 4 voting choice strings that have been encoded into `bytes32` format | true     |
| `followersOnly`     | `bool`       | Restrict voting to followers of the publication author                                | false    |
| `endTimestamp`      | `uint40`     | The timestamp (in seconds) when the poll ends or zero for open-ended                  | false    |
| `signatureRequired` | `bool`       | Whether a signature is required for voting                                            | false    |
| `gateParams`        | `tuple`      | Token gating parameters                                                               | false    |

The optional `gateParams` tuple is used to restrict voting to holders of a specific ERC20 or ERC721 token:

| Name           | Type      | Description                          | Required |
|----------------|-----------|--------------------------------------|----------|
| `tokenAddress` | `address` | The address of the token contract    | true     |
| `minBalance`   | `uint256` | The minimum balance required to vote | true     |

Here's an example of creating the poll action with the `eas-poll-action-module` helper library:

```typescript
import { OpenActionModuleInput, OnchainPostRequest } from "@lens-protocol/client";
import { type EasPoll, createPollActionModuleInput } from "eas-poll-action-module";

const poll: EasPoll = {
  options: ["Option A", "Option B", "Option C", "Option D"],
  followersOnly: true, // Optional
  endTimestamp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Optional
  signatureRequired: false, // Optional
  gateParams: { // Optional
    tokenAddress: "0x9B8cc6320F22325759B7D2CA5CD27347bB4eCD86",
    minBalance: 1000000000000000000n,
  }
};

const pollAction: OpenActionModuleInput = createPollActionModuleInput(poll);

const postRequest: OnchainPostRequest = { contentURI };
postRequest.openActionModules= [{ unknownOpenAction: pollAction }];
await lensClient.publication.postOnchain(postRequest);
````
### Vote on a Poll

To vote on a poll, you create a `vote` tuple:

| Parameter              | Description                                         | Type      |
|------------------------|-----------------------------------------------------|-----------|
| `publicationProfileId` | The profile id of the publication author            | `uint256` |
| `publicationId`        | The publication id                                  | `uint256` |
| `actorProfileId`       | The profile id of the voter                         | `uint256` |
| `actorProfileOwner`    | The address of the voter                            | `address` |
| `transactionExecutor`  | The address of the transaction executor             | `address` |
| `optionIndex`          | The index of the option the voter selected (0 to 3) | `uint8`   |
| `timestamp`            | The timestamp (in seconds) when the vote was cast   | `uint40`  |

Here's how you can use the `eas-poll-action-module` helper library to create the `vote` "act on" request to be used with the Lens SDK:

```typescript
import { ActOnOpenActionRequest } from "@lens-protocol/client";
import { type EasVote, createVoteActionRequest } from "eas-poll-action-module";

const vote: EasVote = {
  publicationId: "0xd8-0x01",
  optionIndex: 1,
};

const voteAction: ActOnOpenActionRequest = createVoteActionRequest(vote);
await lensClient.publication.actions.actOn(voteAction);
```

#### ⚠️ Note:
When `signatureRequired` is `true` on the `Poll` you must sign the `vote` using the `transactionExecutor` address. You can provide an `ethers.Signer` to the `createVoteActionRequest` function to sign the vote.

### EAS GraphQL API

The `scemaUid` can also be used to query the [EAS GraphQL API](https://docs.attest.sh/docs/developer-tools/api) for votes. The `eas-poll-action-module` helper library provides functions for encoding the `pollId` and `optionIndex` to be used in the GraphQL query.

Here's how you can get an attestation (vote) count from EAS:

```typescript
import { createVoteCountQueryVariables, getVoteCount } from "eas-poll-action-module";

const variables = createVoteCountQueryVariables(publicationId);
const count = await getVoteCount(variables);
```

Here's how you can get an attestation (vote) count for a specific option from EAS.

```typescript
import { createVoteCountForOptionQueryVariables, getVoteCountForOption } from "eas-poll-action-module";

const optionIndex = 1;
const variables = createVoteCountForOptionQueryVariables(publicationId, optionIndex);
const count = await getVoteCountForOption(variables);
```

### Get Poll Results

The contract also provides many ways to get poll results.

```solidity
/**
 * @dev Get the number of votes/attestations for a publication.
 * @param profileId The profile id of the publication author
 * @param pubId The publication id
 * @return The number of attestations
 */
function getAttestationCount(
    uint256 profileId,
    uint256 pubId
) external view returns (uint256);

/**
 * @dev Get the attestation for a vote at a specific index.
 * @param profileId The profile id of the publication author
 * @param pubId The publication id
 * @param index The index of the vote
 * @return The vote
 */
function getAttestationByIndex(
    uint256 profileId,
    uint256 pubId,
    uint256 index
) external view returns (bytes32);

/**
 * @dev Get the attested vote for an actor.
 * @param profileId The profile id of the publication author
 * @param pubId The publication id
 * @param actor The actor address
 * @return The vote
 */
function getVote(
    uint256 profileId,
    uint256 pubId,
    address actor
) external view returns (Vote memory);

/**
 * @dev Get the attestation for a vote at a specific index.
 * @param profileId The profile id of the publication author
 * @param pubId The publication id
 * @param index The index of the vote
 * @return The vote
 */
function getVoteByIndex(
    uint256 profileId,
    uint256 pubId,
    uint256 index
) external view returns (Vote memory);
```