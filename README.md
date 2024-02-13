# EasPollActionModule

`EasPollActionModule.sol` is an Open Action Module (Publication Module) for Lens Protocol. It allows users to create and vote on polls using the Ethereum Attestation Service (EAS).


## Using the EasPollActionModule Contract

To use the live `EasPollActionModule` you can use the address and metadata below:

| Network | Chain ID | Deployed Contract                                                                                                               | Metadata                                                                     | EAS Schema UID                                                                                                                                                                          |
|---------|----------|---------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Mumbai  | 80001    | [0xBd43F2Bc51020347619c2cC243E3B21859f4f64c](https://mumbai.polygonscan.com/address/0xBd43F2Bc51020347619c2cC243E3B21859f4f64c) | [link](https://gateway.irys.xyz/-zJdOuwtPMPwVoFbSNO2d0dAg1lhUwHlCFOhrg8ZBVc) | [0x5e67b8b854d74789f6fa56f202907f85e3e53b87abe3d218c9f6dee1cc60ecbd](https://polygon-mumbai.easscan.org/schema/view/0x5e67b8b854d74789f6fa56f202907f85e3e53b87abe3d218c9f6dee1cc60ecbd) 


The `EasPollActionModule` contract can be used as an Open Action Module on Lens Protocol publications.

### Create a Poll
To create a poll, the initialize calldata ABI is:

```json
[
  {
    "type": "tuple(bytes32[4],bool,uint40,bool)",
    "name": "poll",
    "components": [
      { "type": "bytes32[4]", "name": "options" },
      { "type": "bool", "name": "followersOnly" },
      { "type": "uint40", "name": "endTimestamp" },
      { "type": "bool", "name": "signatureRequired" }
    ]
  }
]
```

| Parameter           | Description                                                                           | Type         |
|---------------------|---------------------------------------------------------------------------------------|--------------|
| `options`           | An array of 2 to 4 voting choice strings that have been encoded into `bytes32` format | `bytes32[4]` |
| `followersOnly`     | Restrict voting to followers of the publication author                                | `bool`       |
| `endTimestamp`      | The timestamp (in seconds) when the poll ends or zero for open-ended                  | `uint40`     |
| `signatureRequired` | Whether a signature is required for voting                                            | `bool`       |

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

Where `optionIndex` is the index of the option to vote for. 

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