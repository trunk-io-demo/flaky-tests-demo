# `third-party-apis`

> [!NOTE]
> **Depends on seventeen third parties.** These go red when a service is degraded, under maintenance, or
> its status page will not answer. Every failure message links the page it read.

## Prototypical examples

| Test                                                      | Why this one                                                                       | Production                                                                                                                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`OpenAI is operational`](__tests__/status-pages.test.ts) | One of the fifteen Statuspage readers, on a service that actually posts incidents. | [history](https://app.trunk.io/flaky-tests-demo/flaky-tests/collections/43f4L2BT/tests/31fd0870-eb39-48c0-b2a6-a3e3643e5f07_5cd88393-b658-5b1d-94f5-443a81f96212?tab=history) |

## What this demonstrates

**Failures that cluster in time and correlate across tests.**

Most of the time a handful of these are amber for their own unrelated reasons. Then a shared dependency
goes — a CDN, a cloud region, a certificate — and eight of them turn together in one run and recover
together. No per-test failure rate models that, because the cause is outside every one of them.

It is also the only story here whose rate nobody chose. Each service has whatever real uptime it has.

## The list

Fifteen services on Atlassian Statuspage, which exposes the same `/api/v2/status.json` on every page it
hosts — one client, fifteen tests via `it.each`:

| Registries                     | Infrastructure                             | AI                                      |
| ------------------------------ | ------------------------------------------ | --------------------------------------- |
| npm, PyPI, crates.io, RubyGems | Cloudflare, HashiCorp, CircleCI, Atlassian | OpenAI, Anthropic, Braintrust, Langfuse |
|                                | Sentry, Datadog, LaunchDarkly              |                                         |

Plus the two clouds, in [`cloud-providers.test.ts`](__tests__/cloud-providers.test.ts). Neither is on
Statuspage, so neither reports an indicator — they publish incident feeds, and "is anything open" is the
nearest equivalent question:

| Test                                         | Reads                                                  |
| -------------------------------------------- | ------------------------------------------------------ |
| `google cloud has no open incident`          | `status.cloud.google.com/incidents.json`, any product. |
| `the vertex gemini api has no open incident` | The same feed, filtered to one product.                |
| `aws has no current event`                   | `status.aws.amazon.com/currentevents.json`.            |

Gemini can be red while Google Cloud as a whole is green, which is the point of naming one product inside a
very large cloud. And these three are the tests most likely to _explain_ the other file: when a cloud region
goes, a dozen status pages follow within minutes.

**AWS needs its own decoding.** The feed is JSON encoded **UTF-16 with a byte-order mark**, so
`response.json()` fails on it outright — the bytes are read as an `ArrayBuffer` and decoded by BOM. That is
the whole reason it is not just another reader.

**GitHub is deliberately absent.** [`apps/github-uptime`](../github-uptime/) already reads that page at a
`major` threshold; polling it here as well would be one story told in two places.

## Anything other than operational is red

Including **maintenance**. A service under maintenance is one you cannot rely on right now, which is the
question these ask. The message says so when that is the reason, because it is the one indicator a reader
might expect to be excused.

So `none` passes and `minor`, `major`, `critical`, `maintenance` all fail. A status page that will not
answer also fails, with a different message — that is its own kind of bad news, but not the same as the
service being down.

## Parsing

Every response goes through a [zod](https://zod.dev) schema rather than a cast. Two choices are worth
knowing:

- **Unknown severities degrade to `none`**, and missing fields take defaults, via `.catch()`. A new
  indicator word appearing upstream should not read as fifteen services breaking at once.
- **`looseObject`** where the feed carries far more per entry than any test needs, which is both cloud feed.

A response that cannot be parsed at all fails with the first zod issue in the message, which is a different
failure from the service being down.

## Read once, in parallel, before any test runs

Fifteen hosts sampled at the same instant is what makes "together" mean anything. If each test fetched when
it happened to run, a correlated outage would smear across whichever ones were unlucky.

## What you should see

A count every run — `status pages: 4/15 not operational — RubyGems, CircleCI, Cloudflare, OpenAI` — and
usually a few red. Over a week: mostly independent scatter, punctuated by moments where many go at once.
Those moments are the point.

## Telling a real problem from a working monitor

1. `healthcheck always passes` reads no status page. Green means the suite is fine and the internet is not.
2. Every failure links the page it read. Open it; if the service says it is degraded, the monitor worked.
3. "Could not read" is a different message from "reports minor". The first is usually the runner's network.

## Usage

```bash
pnpm --filter @flaky-tests-demo/apps-third-party-apis test
```

Non-zero exit is expected. Seventeen outbound requests per run, hourly, to pages built to be polled —
worth keeping in mind before lengthening the list.
