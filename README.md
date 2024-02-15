# EasPollActionModule

`EasPollActionModule.sol` is an Open Action Module (Publication Module) for Lens Protocol. It allows users to create and vote on polls using the Ethereum Attestation Service (EAS).


## Using the EasPollActionModule Contract

To use the live `EasPollActionModule` you can use the address and metadata below:

| Network | Chain ID | Deployed Contract                                                                                                               | Metadata                                                                     | EAS Schema UID                                                                                                                                                                          |
|---------|----------|---------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Mumbai  | 80001    | [0xBd43F2Bc51020347619c2cC243E3B21859f4f64c](https://mumbai.polygonscan.com/address/0xBd43F2Bc51020347619c2cC243E3B21859f4f64c) | [link](https://gateway.irys.xyz/-zJdOuwtPMPwVoFbSNO2d0dAg1lhUwHlCFOhrg8ZBVc) | [0x5e67b8b854d74789f6fa56f202907f85e3e53b87abe3d218c9f6dee1cc60ecbd](https://polygon-mumbai.easscan.org/schema/view/0x5e67b8b854d74789f6fa56f202907f85e3e53b87abe3d218c9f6dee1cc60ecbd) 

The `EasPollActionModule` contract can be used as an Open Action Module on Lens Protocol publications. Here are examples of successful transactions on Mumbai using the poll module:

[`Post` transaction](https://mumbai.polygonscan.com/tx/0xc20b03ff16c67a5e04d461b5535426137a6afc186fab3f33517d45bee8f18eeb)

[`Act` transaction](https://mumbai.polygonscan.com/tx/0x17519fee2af6cec2b5fe508646a135aecf6beac7bc4478cbca6e247e38718b02)

[Attestation](https://polygon-mumbai.easscan.org/attestation/view/0x8787529ab2627b903970b971dfe52576ae7ef62570f42bfb9ff28a4a0ee395fc)


### Create a Poll
To create a poll, the initialize calldata ABI is:

| Name                | Description                                                                           | Type         |
|---------------------|---------------------------------------------------------------------------------------|--------------|
| `options`           | An array of 2 to 4 voting choice strings that have been encoded into `bytes32` format | `bytes32[4]` |
| `followersOnly`     | Restrict voting to followers of the publication author                                | `bool`       |
| `endTimestamp`      | The timestamp (in seconds) when the poll ends or zero for open-ended                  | `uint40`     |
| `signatureRequired` | Whether a signature is required for voting                                            | `bool`       |

Here's an example of creating the encoded calldata with the Lens SDK:

```typescript
import { encodeBytes32String } from "ethers";
import { encodeData, type OpenActionModuleInput } from "@lens-protocol/client";

const options = ["Option A", "Option B", "Option C", "Option D"];
const timestamp = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 1 day
const data = encodeData(
  [
    {
      type: "tuple",
      name: "poll",
      components: [
        { type: "bytes32[4]", name: "options" },
        { type: "bool", name: "followersOnly" },
        { type: "uint40", name: "endTimestamp" },
        { type: "bool", name: "signatureRequired" },
      ],
    },
  ],
  [
    options.map(encodeBytes32String), // options
    false, // followersOnly
    timestamp.toString(), // endTimestamp
    true, // signatureRequired
  ] as ModuleData,
);

const actions: OpenActionModuleInput[] = [
    {
      unknownOpenAction: {
        address: '0xBd43F2Bc51020347619c2cC243E3B21859f4f64c',
        data,
      }
    },
];
````
### Vote on a Poll

To vote on a `signatureRequired` poll, the process calldata ABI is:

```json
[
    {
      "type": "tuple(uint256,uint256,uint256,address,uint8,uint40)",
      "name": "vote",
      "components": [
        { "type": "uint256", "name": "publicationProfileId" },
        { "type": "uint256", "name": "publicationId" },
        { "type": "uint256", "name": "actorProfileId" },
        { "type": "address", "name": "actorProfileOwner" },
        { "type": "address", "name": "transactionExecutor" },
        { "type": "uint8", "name": "optionIndex" },
        { "type": "uint40", "name": "timestamp" }
      ]
    },
    {
      "type": "tuple(uint8,bytes32,bytes32)",
      "name": "signature",
      "components": [
        { "type": "uint8", "name": "v" },
        { "type": "bytes32", "name": "r" },
        { "type": "bytes32", "name": "s" }
      ]
    },
    { "type": "uint64", "name": "deadline" }
  ]
```

Here's the description of the `vote` tuple:

| Parameter              | Description                                         | Type      |
|------------------------|-----------------------------------------------------|-----------|
| `publicationProfileId` | The profile id of the publication author            | `uint256` |
| `publicationId`        | The publication id                                  | `uint256` |
| `actorProfileId`       | The profile id of the voter                         | `uint256` |
| `actorProfileOwner`    | The address of the voter                            | `address` |
| `transactionExecutor`  | The address of the transaction executor             | `address` |
| `optionIndex`          | The index of the option the voter selected (0 to 3) | `uint8`   |
| `timestamp`            | The timestamp (in seconds) when the vote was cast   | `uint40`  |


#### ⚠️ Note:
The `signature` and `deadline` are only required when `signatureRequired` is `true` on the `Poll`.

### Get Poll Results

The contract provides many ways to get poll results.

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

### EAS GraphQL API

The `scemaUid` can also be used to query the EAS GraphQL API for votes.

Here's how you can get an attestation (vote) count from EAS:

```typescript
import { encodeData } from '@lens-protocol/client';

// Construct the pollId string to filter by calldata
const pollId = encodeData(
  [{ name: "publicationProfileId", type: "publicationId" }],
  [ profileId, pubId ],
);
```

```graphql
query GetVoteCount($schemaId: String!, $pollId: String!) {
    groupByAttestation(
        where: {
            schemaId: { equals: $schemaId },
            data: { startsWith: $pollId }
            revoked: { equals: false },
        }
        by: [schemaId]
        orderBy: [ { _count: { schemaId: asc } } ]
    ) {
        schemaId
        _count {
            _all
        }
    }
}
```

Here's how you can get an attestation (vote) count for a specific option from EAS.

```typescript
import { encodeData } from '@lens-protocol/client';

const voteIndex = 1; // The option the user selected

// Construct the JSON string with the optionIndex value to filter by decodedDataJson
const optionIndex = `{"name":"optionIndex","type":"uint8","value":${voteIndex}}`;
```

And the GraphQL query would look like this:

```graphql
query GetVoteCountForOptionIndex(
    $schemaId: String!,
    $pollId: String!,
    $optionIndex: String!
) {
  groupByAttestation(
    where: {
        schemaId: { equals: $schemaId },
        decodedDataJson: { contains: $optionIndex },
        data: { startsWith: $pollId },
        revoked: { equals: false }
    }
    by: [schemaId]
  ) {
    _count {
      _all
    }
  }
}
```