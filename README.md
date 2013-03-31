Early beginnings of a Firebase adapter.

## Why?

Firebase is weird because it sort of works as a standard CRUD store, with the unique twist of being able to live update models and collections.

## Usage

Don't yet. Please.

## Implemented

### CRUD

* `find(id)`
* `findAll()`
* `createRecord()`
* `updateRecord()`

### Live Updating

* `addChild` on collection (todo: make optional)
* `addChild` on model's properties (enable with `live: true` in a model definition)

## Todo

Literally just about everything. I mean assocations, most live updating, etc.

And assocations are going to be a trainwreck, probably. So I'm excited for that!

## Tests

Create a Firebase DB for testing, then create a `tests/firebase_db.js` file like so:

```javascript
window.DB_NAME = "your_db_subdomain_here`;
```
