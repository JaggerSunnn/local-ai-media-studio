# Model catalog guide

`catalog.mjs` is the product's capability manifest. The frontend does not contain provider request contracts; it renders fields from the catalog and sends normalized values to the local adapter.

Each model definition includes:

| Field | Meaning |
| --- | --- |
| `id` | Stable client identifier |
| `group` | Provider or capability group |
| `label` | Display name |
| `short` | Short user explanation |
| `endpoint` | DreamAPI submit endpoint |
| `outputKind` | `image`, `video`, `audio`, or `data` |
| `inputs` | Prompt and media requirements |
| `options` | Resolution, duration, ratio, quality, seed, and other controls |
| `fixed` | Provider fields that users should not edit |
| `contentProfiles` | Profiles accepted by the adapter |
| `pricing` | Verified estimate or a dynamic-price label |
| `status` | Catalog availability |

## Default-setting rule

Use the lowest supported value that can complete a valid generation for that model:

- video: lowest verified resolution and a supported short duration;
- image: lowest standard size with one output;
- audio: default language and one voice where required;
- avatar: lowest verified resolution, with duration derived from the source audio when applicable.

A shared task default must be accepted by every model shown for that task. If no common value exists, the adapter should keep model-specific defaults instead of forcing one global value.

## Release rule

Catalog metadata and documentation mapping are not proof of a successful paid request. Before marking a model production-ready:

1. validate authentication and upload contracts;
2. submit the minimum-cost valid request;
3. poll the same task ID through success or failure;
4. verify output parsing and download;
5. record redacted request and response schemas;
6. verify actual billing against the displayed estimate.
