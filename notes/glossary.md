# Glossary

## Live

A reactive value with current state, subscriptions, and operations.

## Live state

The current status of a Live: loading, absent, or holding a value.

## Operation

A change applied to a Live, such as setting or deleting its value. An operation
does not identify which Live it targets.

## Key

The address used by a registry or message to select a Live.

## Message

A transport envelope that addresses a Live and carries an operation,
subscription request, state, or result.

## Snapshot

A state used to initialize or resynchronize a Live.

## Derived Live

A Live computed from one or more other Lives.

## Live registry

The component that returns the canonical Live for a key. `LiveModelClient` and
`BackendLiveModel` currently provide separate registries.

## Transport

The mechanism that moves messages between replicas, such as WebSocket or HTTP.

## Storage adapter

An environment-specific persistence implementation used by a storage-backed
Live.

## Origin

The client or backend source that submitted an operation.
