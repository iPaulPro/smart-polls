# EasPollActionModule

`EasPollActionModule.sol` is an Open Action Module (Publication Module) for Lens Protocol. It allows users to create and vote on polls using the Ethereum Attestation Service (EAS).


## Using the EasPollActionModule Contract

To use the live `EasPollActionModule` you can use the address and metadata below:

| Network | Chain ID | Deployed Contract                                                                                                               | Metadata                                                                     | EAS Schema UID                                                                                                                                                                          |
|---------|----------|---------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Mumbai  | 80001    | [0xBd43F2Bc51020347619c2cC243E3B21859f4f64c](https://mumbai.polygonscan.com/address/0xBd43F2Bc51020347619c2cC243E3B21859f4f64c) | [link](https://gateway.irys.xyz/-zJdOuwtPMPwVoFbSNO2d0dAg1lhUwHlCFOhrg8ZBVc) | [0x5e67b8b854d74789f6fa56f202907f85e3e53b87abe3d218c9f6dee1cc60ecbd](https://polygon-mumbai.easscan.org/schema/view/0x5e67b8b854d74789f6fa56f202907f85e3e53b87abe3d218c9f6dee1cc60ecbd) |

The `EasPollActionModule` contract can be used as an Open Action Module on Lens Protocol publications. Here are examples of successful transactions on Mumbai using the poll module:

[`Post` transaction](https://mumbai.polygonscan.com/tx/0xc20b03ff16c67a5e04d461b5535426137a6afc186fab3f33517d45bee8f18eeb)

[`Act` transaction](https://mumbai.polygonscan.com/tx/0x17519fee2af6cec2b5fe508646a135aecf6beac7bc4478cbca6e247e38718b02)

[Attestation](https://polygon-mumbai.easscan.org/attestation/view/0x8787529ab2627b903970b971dfe52576ae7ef62570f42bfb9ff28a4a0ee395fc)

### Install `eas-poll-action-module` Helper Library

The helper library provides functions for creating the Lens SDK `OpenActionModuleInput` and `ActOnOpenActionRequest` which can be used to attach and act on the Open Action Module. To use the `eas-poll-action-module` helper library, you can install it using npm:

```bash
npm install eas-poll-action-module
```

### Create a Poll

To create a poll, the initialize calldata ABI is:

| Name                | Description                                                                           | Type         |
|---------------------|---------------------------------------------------------------------------------------|--------------|
| `options`           | An array of 2 to 4 voting choice strings that have been encoded into `bytes32` format | `bytes32[4]` |
| `followersOnly`     | Restrict voting to followers of the publication author                                | `bool`       |
| `endTimestamp`      | The timestamp (in seconds) when the poll ends or zero for open-ended                  | `uint40`     |
| `signatureRequired` | Whether a signature is required for voting                                            | `bool`       |

Here's an example of creating the poll action with the `eas-poll-action-module` helper library:

```typescript
import { OpenActionModuleInput, OnchainPostRequest } from "@lens-protocol/client";
import { type EasPoll, createPollActionModuleInput } from "eas-poll-action-module";

const poll: EasPoll = {
  options: ["Option A", "Option B", "Option C", "Option D"],
  followersOnly: true, // Optional
  endTimestamp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Optional
  signatureRequired: false, // Optional
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

const publicationId = "0xd8-0x01";
const vote: EasVote = {
  publicationId: publicationId,
  actorProfileId: "0x01",
  actorProfileOwner: "0x1234567890123456789012345678901234567890",
  optionIndex: 1,
};

const voteAction: ActOnOpenActionRequest = createVoteActionRequest(vote, post.id);

await lensClient.publication.actions.actOn(voteAction);
```

#### ⚠️ Note:
When `signatureRequired` is `true` on the `Poll` you must sign the `vote` using the `transactionExecutor` address. You can provide an `ethers.Signer` to the `createVoteActionRequest` function to sign the vote.

### EAS GraphQL API

The `scemaUid` can also be used to query the EAS GraphQL API for votes. The `eas-poll-action-module` helper library provides functions for encoding the `pollId` and `optionIndex` to be used in the GraphQL query.

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