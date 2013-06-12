## What? 

This is a [Firebase](https://www.firebase.com/) adapter for [Ember Data](https://github.com/emberjs/data).

## Why?

Firebase is powerful because it sort of works as a standard CRUD store, with the unique twist of being able to live update models and collections.

Honestly, it's a bit weird mixing standard Ember Data CRUD operations with real-time updates, but it seems to be working out so far, and only feels *slightly* hacky. 

This adapter can be used as a normal CRUD adapter, or to automatically add or remove models and properties as they are changed on your Firebase backend. This makes it shockingly powerful for combining persistence and live updates.

## How?

Refer to the [wiki](https://github.com/thomasboyt/ember-firebase-adapter/wiki) for usage information.

## Todo

There's [a lot of work left to do](https://github.com/thomasboyt/ember-firebase-adapter/issues?state=open). Much of it is waiting for changes in Ember Data. For example, in Ember Data, there is essentially no (documented) way to return a "404/not found" on a find query, so that has yet to be implemented in this adapter, as well as a lot of other error handling.

Remember, since the Firebase object is exposed by the adapter, if you find yourself faced with an edge case that the adapter can't handle, you may be able to do it manually!

## Building

This project is built with [Grunt](http://gruntjs.com/). If you'd like to build it yourself, you'll want to clone the repo, `npm install .` to load dependencies into `node_modules/`, and then build it with `grunt build`. Running `grunt dist` will output a minified version in the `dist/` folder.

Note that this project uses [Square's ES6 Module Transplier](https://github.com/square/es6-module-transpiler) to compile scripts that use the ECMAScript 6 module script syntax to AMD modules, then loads them with [Almond](https://github.com/jrburke/almond) in the final output. Almond minifies down to like < 1kb, though, so it's not exactly a huge overhead to worry about.

## Testing

Create a Firebase DB for testing, then create a `test/firebase_db.js` file like so:

```javascript
window.DB_NAME = "your_db_subdomain_here";
```

Create a static server with "grunt test" and navigate to `http://localhost:9001/test/` to run the tests.
